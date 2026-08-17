import { useCallback, useEffect, useRef, useState } from "react";
import { onMessage, postMessage } from "../../../../vscode";
import type { CherryPickResult } from "../../../../types";

/** Статус одного пункта списка при применении (cherry-pick). */
export type CommitApplyStatus =
  | "pending"
  | "in-progress"
  | "done"
  | "skipped"
  | "conflict"
  | "error";

/** Фаза всего процесса применения. */
export type ApplyPhase = "idle" | "running" | "conflict" | "error";

/** Причина пропуска коммита (хост возвращает в cherryPickResult). */
export type SkipReason = "in-branch" | "empty-patch";

export interface ApplyCommitsItem {
  sha: string;
}

/** Режим применения: cherry-pick (добавление) или revert (удаление). */
export type ApplyMode = "pick" | "revert";

export interface UseApplyCommitsResult {
  /** Статус каждого коммита по sha. */
  statuses: Record<string, CommitApplyStatus>;
  /** Фаза процесса. */
  phase: ApplyPhase;
  /** Конфликтующие файлы текущего конфликтного коммита. */
  conflictFiles: string[];
  /** Текст ошибки (фаза "error"). */
  error: string | null;
  /** Ветка, на которой хост выполняет cherry-pick (из последнего ответа). */
  applyBranch: string | null;
  /** Причина пропуска по sha (для пунктов со статусом "skipped"). */
  skipReasons: Record<string, SkipReason>;
  /** Начать применение: по порядку, от старых к новым. */
  apply: () => void;
  /**
   * Заново начать применение с первого пункта — после ручного резолва
   * конфликта в VS Code. Хост сам доведёт незавершённый cherry-pick и
   * пропустит уже применённые коммиты.
   */
  restart: () => void;
  /** Прервать незавершённый cherry-pick (`git cherry-pick --abort`). */
  abort: () => void;
  /** Открыть вкладку Source Control в VS Code (для резолва конфликтов). */
  openConflicts: () => void;
}

/**
 * Стейт-машина применения коммитов через cherry-pick.
 *
 * Принимает список коммитов, ОТСОРТИРОВАННЫЙ от старых к новым (порядок
 * применения), и опционально имя целевой ветки `branch` — хост перед
 * применением убедится, что активна именно она (и переключится при
 * необходимости).
 *
 * Управляет очередью: для каждого коммита шлёт `cherryPick` и по ответу
 * `cherryPickResult` двигается дальше:
 *   applied → пункт «пройден», следующий;
 *   skipped → пункт «пропущен» (пустой патч — изменения уже применены),
 *             следующий;
 *   conflict → стоп, фаза "conflict" (пользователь резолвит в VS Code,
 *              затем `restart` — применение начинается заново, хост сам
 *              доводит незавершённый cherry-pick);
 *   error    → стоп, фаза "error".
 *
 * Подписка `onMessage` создаётся один раз (mount-once); актуальные очередь и
 * индекс хранятся в refs — защита от stale closure (паттерн как в остальных
 * хуках проекта).
 */
export function useApplyCommits(
  commits: ApplyCommitsItem[],
  branch?: string,
  mode: ApplyMode = "pick",
): UseApplyCommitsResult {
  const [statuses, setStatuses] = useState<Record<string, CommitApplyStatus>>(
    {},
  );
  const [phase, setPhase] = useState<ApplyPhase>("idle");
  const [conflictFiles, setConflictFiles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [applyBranch, setApplyBranch] = useState<string | null>(null);
  const [skipReasons, setSkipReasons] = useState<Record<string, SkipReason>>(
    {},
  );

  // Актуальные очередь/индекс/фаза/ветка для подписчика (refs, не state).
  const queueRef = useRef<string[]>([]);
  const idxRef = useRef(0);
  const phaseRef = useRef<ApplyPhase>("idle");
  const branchRef = useRef<string | undefined>(branch);
  useEffect(() => {
    branchRef.current = branch;
  }, [branch]);
  const modeRef = useRef<ApplyMode>(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const setPhaseBoth = useCallback((next: ApplyPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  /** Отправить команду применения (cherry-pick или revert) для sha. */
  const sendPick = useCallback((sha: string) => {
    postMessage({
      command: modeRef.current === "revert" ? "revert" : "cherryPick",
      data: { sha, branch: branchRef.current },
    });
  }, []);

  /** Завершить текущий пункт и отправить следующий (или закончить). */
  const advanceAfterDone = useCallback(
    (sha: string, status: "done" | "skipped", reason?: SkipReason) => {
      setStatuses((prev) => ({ ...prev, [sha]: status }));
      if (reason) {
        setSkipReasons((prev) => ({ ...prev, [sha]: reason }));
      }

      const nextIdx = idxRef.current + 1;
      if (nextIdx >= queueRef.current.length) {
        // Очередь исчерпана — всё применено.
        idxRef.current = nextIdx;
        setConflictFiles([]);
        setPhaseBoth("idle");
        return;
      }

      idxRef.current = nextIdx;
      const nextSha = queueRef.current[nextIdx];
      setStatuses((prev) => ({ ...prev, [nextSha]: "in-progress" }));
      sendPick(nextSha);
    },
    [sendPick, setPhaseBoth],
  );

  // Единственная подписка на ответы хоста — живёт всё время монтирования.
  // Событие и abort-команда выбираются по текущему режиму (modeRef).
  useEffect(() => {
    const unsubscribe = onMessage((message) => {
      const result: CherryPickResult | null =
        modeRef.current === "revert"
          ? message.command === "revertResult"
            ? message.data
            : null
          : message.command === "cherryPickResult"
            ? message.data
            : null;

      if (result) {
        if (phaseRef.current !== "running") return; // устаревший ответ
        const { sha, status, files, message: msg, skippedReason } = result;

        console.log("apply status >>>>", status);
        setApplyBranch(result.branch || null);

        if (status === "applied") {
          advanceAfterDone(sha, "done");
          return;
        }
        if (status === "skipped") {
          advanceAfterDone(sha, "skipped", skippedReason);
          return;
        }
        if (status === "conflict") {
          setStatuses((prev) => ({ ...prev, [sha]: "conflict" }));
          setConflictFiles(files);
          setPhaseBoth("conflict");
          return;
        }
        setStatuses((prev) => ({ ...prev, [sha]: "error" }));
        setError(msg);
        setPhaseBoth("error");
        return;
      }

      const abortedData =
        modeRef.current === "revert"
          ? message.command === "revertAborted"
            ? message.data
            : null
          : message.command === "cherryPickAborted"
            ? message.data
            : null;
      if (abortedData) {
        if (phaseRef.current !== "conflict") return;
        const currentSha = queueRef.current[idxRef.current];
        if (abortedData.ok) {
          setStatuses((prev) => ({ ...prev, [currentSha]: "pending" }));
          setConflictFiles([]);
          setPhaseBoth("idle");
        } else {
          setError(abortedData.message);
          setPhaseBoth("error");
        }
      }
    });
    return unsubscribe;
  }, [advanceAfterDone, setPhaseBoth]);

  // При изменении списка коммитов (повторное «Добавить») — сброс статусов,
  // но только если процесс не активен.
  useEffect(() => {
    if (phaseRef.current !== "idle") return;
    setStatuses({});
    setSkipReasons({});
    setConflictFiles([]);
    setError(null);
  }, [commits]);

  /** Запустить применение с указанного индекса; пункты до него не трогаем. */
  const applyFrom = useCallback(
    (startIdx: number) => {
      if (commits.length === 0) return;

      const queue = commits.map((c) => c.sha);
      queueRef.current = queue;

      if (startIdx >= queue.length) {
        // Начинать не с чего — всё уже пройдено.
        idxRef.current = queue.length;
        setConflictFiles([]);
        setPhaseBoth("idle");
        return;
      }

      idxRef.current = startIdx;

      // Пункты до startIdx сохраняют статусы (done/skipped), начиная с него —
      // сброс в pending.
      setStatuses((prev) => {
        const next = { ...prev };
        for (let i = startIdx; i < queue.length; i++) {
          next[queue[i]] = "pending";
        }
        next[queue[startIdx]] = "in-progress";
        return next;
      });

      setConflictFiles([]);
      setError(null);
      setPhaseBoth("running");
      sendPick(queue[startIdx]);
    },
    [commits, sendPick, setPhaseBoth],
  );

  const apply = useCallback(() => {
    if (commits.length === 0) return;

    const queue = commits.map((c) => c.sha);
    queueRef.current = queue;
    idxRef.current = 0;

    const initial: Record<string, CommitApplyStatus> = {};
    for (const sha of queue) initial[sha] = "pending";
    initial[queue[0]] = "in-progress";

    setStatuses(initial);
    setSkipReasons({});
    setConflictFiles([]);
    setError(null);
    setPhaseBoth("running");
    sendPick(queue[0]);
  }, [commits, sendPick, setPhaseBoth]);

  /**
   * «Заново» после конфликта: доверяем, что пользователь зарезолвил конфликт
   * (алерт это просит), помечаем конфликтный пункт пройденным и продолжаем
   * СО СЛЕДУЮЩЕГО пункта — как в терминальном флоу.
   *
   * Если пользователь на самом деле НЕ зарезолвил — хост увидит незавершённый
   * cherry-pick с unmerged-файлами и вернёт conflict для того же sha: UI снова
   * покажет конфликт (самовосстановление).
   */
  const restart = useCallback(() => {
    const conflictIdx = commits.findIndex(
      (c) => statuses[c.sha] === "conflict",
    );

    if (conflictIdx === -1) {
      apply();
      return;
    }

    setStatuses((prev) => ({
      ...prev,
      [commits[conflictIdx].sha]: "done",
    }));
    applyFrom(conflictIdx + 1);
  }, [apply, applyFrom, commits, statuses]);

  const abort = useCallback(() => {
    if (phaseRef.current !== "conflict") return;
    postMessage({
      command: modeRef.current === "revert" ? "revertAbort" : "cherryPickAbort",
    });
  }, []);

  const openConflicts = useCallback(() => {
    postMessage({ command: "openScmView" });
  }, []);

  return {
    statuses,
    phase,
    conflictFiles,
    error,
    applyBranch,
    skipReasons,
    apply,
    restart,
    abort,
    openConflicts,
  };
}
