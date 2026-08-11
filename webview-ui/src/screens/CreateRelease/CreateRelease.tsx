import { useCallback, useState } from "react";
import { Step1CreateBranch } from "./step-1-create-branch";
import { Step2Commits } from "./step-2-commits";
import type { ReleaseContext } from "./types";

/**
 * Экран создания релиза — двухшаговый wizard.
 *
 * Шаг 1: форма выбора ветки-источника и названия релиза; по «Далее» хост
 *        создаёт ветку `releasePrefix + releaseName` и переключается на неё.
 * Шаг 2: список коммитов и контролы релиза (существующий UI).
 *
 * Владелец состояния шага — `CreateReleaseScreen`. Контекст созданной ветки
 * сохраняется в `releaseCtx` и передаётся в Шаг 2.
 */
export function CreateReleaseScreen() {
  const [step, setStep] = useState<1 | 2>(1);
  const [releaseCtx, setReleaseCtx] = useState<ReleaseContext | null>(null);

  // Стабильная ссылка — чтобы в Step1 подписка onMessage не пересоздавалась
  // при каждом рендере (иначе возможна гонка при асинхронном ответе хоста).
  const handleCreated = useCallback((ctx: ReleaseContext) => {
    setReleaseCtx(ctx);
    setStep(2);
  }, []);

  if (step === 1) {
    return <Step1CreateBranch onCreated={handleCreated} />;
  }

  return <Step2Commits releaseCtx={releaseCtx} />;
}
