import { useState } from "react";
import {
  Box,
  Button,
  IconButton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import {
  type Control,
  type FieldArrayWithId,
  type UseFormRegister,
} from "react-hook-form";
import type { CreateReleaseFormValues } from "../../types";
import AddIcon from "@mui/icons-material/Add";
import { ControlMenu } from "./control-menu/control-menu";
import { TemplateTab } from "./template-tab";

export interface UnstagedCommitsListProps {
  /** Field array entries produced by `useFieldArray`. */
  fields: FieldArrayWithId<CreateReleaseFormValues, "commits">[];
  /** `register` from the parent `useForm`, used to bind each input. */
  register: UseFormRegister<CreateReleaseFormValues>;
  /** `remove` from `useFieldArray`, deletes a row by its index. */
  remove: (index?: number | number[]) => void;
  add: () => void;
  /** Добавить сразу несколько заполненных строк (из таба «Создать шаблон»). */
  addMany: (values: string[]) => void;
  /** When false (only one row left) the delete button is disabled. */
  canRemove: boolean;

  control: Control<CreateReleaseFormValues, unknown, CreateReleaseFormValues>;
  loading?: boolean;
}

/**
 * Левая панель экрана коммитов: режимные контролы + два способа наполнения
 * списка коммитов (табы):
 *   1. «Ручное добавление» — по одному полю SHA/сообщения;
 *   2. «Создать шаблон» — разбиение вставленного текста по разделителю.
 *
 * Состояние формы живёт в родителе (`useForm` + `useFieldArray`); этот
 * компонент только рендерит строки и делегирует добавление через пропсы.
 */
export function UnstagedCommitsList({
  fields,
  register,
  remove,
  canRemove,
  add,
  addMany,
  control,
  loading,
}: UnstagedCommitsListProps) {
  const [tab, setTab] = useState<0 | 1>(0);

  return (
    <Box sx={{ padding: "10px", width: "100%" }}>
      <Typography variant="h6">Коммиты для релиза</Typography>

      <ControlMenu register={register} control={control} />

      <Tabs
        value={tab}
        onChange={(_, value) => setTab(value as 0 | 1)}
        sx={{
          marginTop: "20px",
          "& .MuiTab-root": { color: "text.secondary" },
          "& .MuiTab-root.Mui-selected": { color: "text.primary" },
          "& .MuiTabs-indicator": { backgroundColor: "text.primary" },
        }}
      >
        <Tab label="Ручное добавление релиза" />
        <Tab label="Создать шаблон" />
      </Tabs>

      {tab === 0 ? (
        <Box sx={{ marginTop: "10px" }}>
          {fields.map((field, index) => (
            <Stack
              key={field.id}
              direction="row"
              sx={{
                alignItems: "center",
                gap: 2,
                mb: 1,
              }}
            >
              <TextField
                size="small"
                fullWidth
                placeholder="SHA или сообщение коммита…"
                {...register(`commits.${index}.value` as const)}
                sx={{
                  "& .MuiInputBase-root": {
                    height: "32px", // Уменьшаем высоту
                    fontSize: "0.8rem",
                  },
                  "& .MuiInputBase-input": {
                    padding: "4px 8px", // Уменьшаем внутренние отступы
                  },
                }}
              />
              <Tooltip title="Удалить">
                <span>
                  <IconButton
                    size="small"
                    color="error"
                    disabled={!canRemove}
                    onClick={() => remove(index)}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          ))}
          <Button size="small" startIcon={<AddIcon />} onClick={add}>
            Добавить коммит
          </Button>
          <Box sx={{ padding: "0 10px", mt: 1 }}>
            <Button
              type="submit"
              variant="contained"
              disabled={loading}
              sx={{ textTransform: "none" }}
              size="small"
            >
              Добавить
            </Button>
          </Box>
        </Box>
      ) : (
        <Box sx={{ marginTop: "10px" }}>
          <TemplateTab
            addMany={(values) => {
              addMany(values);
              setTab(0);
            }}
          />
        </Box>
      )}
    </Box>
  );
}
