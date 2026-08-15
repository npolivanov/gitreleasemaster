import { useCallback, useEffect, useRef, useState } from "react";
import { onMessage, postMessage } from "../../../../vscode";

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
  /** Продолжить после ручного резолва конфликта (`cherry-pick --continue`). */
  continueAfterConflict: () => void;
  /** Прервать незавершённый cherry-pick (`cherry-pick --abort`). */
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
 *   skipped → пункт «пропущен» (уже в ветке / пустой патч), следующий;
 *   conflict → стоп, фаза "conflict" (пользователь резолвит в VS Code,
 *              затем `continueAfterConflict`);
 *   error    → стоп, фаза "error".
 *
 * Подписка `onMessage` создаётся один раз (mount-once); актуальные очередь и
 * индекс хранятся в refs — защита от stale closure (паттерн как в остальных
 * хуках проекта).
 */
export function useApplyCommits(
  commits: ApplyCommitsItem[],
  branch?: string,
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

  const setPhaseBoth = useCallback((next: ApplyPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  /** Отправить cherry-pick для sha с текущей целевой веткой. */
  const sendPick = useCallback((sha: string) => {
    postMessage({
      command: "cherryPick",
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
  useEffect(() => {
    const unsubscribe = onMessage((message) => {
      if (message.command === "cherryPickResult") {
        if (phaseRef.current !== "running") return; // устаревший ответ
        const {
          sha,
          status,
          files,
          message: msg,
          skippedReason,
        } = message.data;

        console.log("status >>>>", status);
        setApplyBranch(message.data.branch || null);

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

      if (message.command === "cherryPickContinueResult") {
        if (phaseRef.current !== "conflict") return; // устаревший ответ
        const { status, files, message: msg } = message.data;
        const currentSha = queueRef.current[idxRef.current];

        if (status === "applied") {
          setConflictFiles([]);
          // Текущий конфликтный коммит завершён — продолжаем очередь.
          setStatuses((prev) => ({ ...prev, [currentSha]: "done" }));

          const nextIdx = idxRef.current + 1;
          if (nextIdx >= queueRef.current.length) {
            idxRef.current = nextIdx;
            setPhaseBoth("idle");
            return;
          }
          idxRef.current = nextIdx;
          const nextSha = queueRef.current[nextIdx];
          setStatuses((prev) => ({ ...prev, [nextSha]: "in-progress" }));
          setPhaseBoth("running");
          sendPick(nextSha);
          return;
        }
        if (status === "conflict") {
          // Пользователь ещё не зарезолвил всё — остаёмся в конфликте.
          setConflictFiles(files);
          return;
        }
        setStatuses((prev) => ({ ...prev, [currentSha]: "error" }));
        setConflictFiles([]);
        setError(msg);
        setPhaseBoth("error");
        return;
      }

      if (message.command === "cherryPickAborted") {
        if (phaseRef.current !== "conflict") return;
        const currentSha = queueRef.current[idxRef.current];
        if (message.data.ok) {
          setStatuses((prev) => ({ ...prev, [currentSha]: "pending" }));
          setConflictFiles([]);
          setPhaseBoth("idle");
        } else {
          setError(message.data.message);
          setPhaseBoth("error");
        }
      }
    });
    return unsubscribe;
  }, [advanceAfterDone, sendPick, setPhaseBoth]);

  // При изменении списка коммитов (повторное «Добавить») — сброс статусов,
  // но только если процесс не активен.
  useEffect(() => {
    if (phaseRef.current !== "idle") return;
    setStatuses({});
    setSkipReasons({});
    setConflictFiles([]);
    setError(null);
  }, [commits]);

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

  const continueAfterConflict = useCallback(() => {
    if (phaseRef.current !== "conflict") return;
    postMessage({ command: "cherryPickContinue" });
  }, []);

  const abort = useCallback(() => {
    if (phaseRef.current !== "conflict") return;
    postMessage({ command: "cherryPickAbort" });
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
    continueAfterConflict,
    abort,
    openConflicts,
  };
}
