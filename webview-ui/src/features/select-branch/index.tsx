import { Autocomplete, TextField, CircularProgress } from "@mui/material";
import type { BranchOption } from "../../types";
import { useBranchSearch } from "./useBranchSearch";

export interface SelectBranchProps {
  /** Имя выбранной ветки (или "" если ничего не выбрано). */
  value: string;
  /** Вызывается с именем выбранной ветки (или "" при очистке). */
  onChange: (value: string) => void;
  /** Заблокировать выбор (например, когда чекбокс делает выбор неактуальным). */
  disabled?: boolean;
  /** Надпись над полем. */
  label?: string;
  /** Плейсхолдер. */
  placeholder?: string;
}

/**
 * Переиспользуемый select с поиском по всем веткам репозитория.
 *
 * Все ветки грузятся с хоста ОДИН раз при открытии (через `useBranchSearch`) и
 * кэшируются. Дальнейший поиск идёт клиентски, дефолтным `filterOptions` MUI
 * Autocomplete — поэтому фильтрация мгновенная, без задержек на round-trip.
 *
 * Компонент форм-агностичный: ничего не знает про react-hook-form, только
 * `value`/`onChange`/`disabled`. Вызывающая сторона биндит его через `<Controller>`.
 */
export function SelectBranch({
  value,
  onChange,
  disabled,
  label,
  placeholder = "Начните вводить название ветки…",
}: SelectBranchProps) {
  const { allBranches, query, setQuery, loading } = useBranchSearch();

  // Текущий выбранный объект для рендера значения в Autocomplete. Берём из
  // кэша; если ветки в кэше нет (маловероятно), строим объект из строки, чтобы
  // имя осталось видно в инпуте.
  const selected: BranchOption | null = value
    ? allBranches.find((b) => b.name === value) ?? { name: value, sha: "" }
    : null;

  return (
    <Autocomplete
      size="small"
      fullWidth
      options={allBranches}
      loading={loading}
      disabled={disabled}
      value={selected}
      inputValue={query}
      getOptionLabel={(option) => option.name}
      isOptionEqualToValue={(option, val) => option.name === val.name}
      // Дефолтный filterOptions фильтрует кэш в памяти — мгновенно, без запросов.
      noOptionsText={
        allBranches.length === 0
          ? "Загрузка веток…"
          : query.trim() === ""
            ? "Начните вводить название ветки"
            : "Ветки не найдены"
      }
      onInputChange={(_, next) => setQuery(next)}
      onChange={(_, next) => {
        onChange(next ? next.name : "");
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
          slotProps={{
            ...params.slotProps,
            input: {
              ...params.slotProps?.input,
              endAdornment: (
                <>
                  {loading ? (
                    <CircularProgress color="inherit" size={16} />
                  ) : null}
                  {params.slotProps?.input?.endAdornment}
                </>
              ),
            },
          }}
        />
      )}
    />
  );
}
