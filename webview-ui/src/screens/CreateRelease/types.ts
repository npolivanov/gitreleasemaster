/**
 * Общие типы формы create-release.
 *
 * Вынесены в отдельный файл, чтобы разорвать циклы импортов между
 * `CreateRelease.tsx`, `step-2-commits.tsx` и компонентами `unstaged/`.
 */

/** Один пункт в списке коммитов — строковое поле (SHA или сообщение). */
export interface CommitItem {
  value: string;
}

/** Форма всего экрана коммитов (Шаг 2). */
export interface CreateReleaseFormValues {
  commits: CommitItem[];
  isDeleted: boolean;
  addFormBranch: string;
}

/** Контекст созданной релизной ветки — передаётся из Шага 1 в Шаг 2. */
export interface ReleaseContext {
  fromBranch: string;
  releaseName: string;
}
