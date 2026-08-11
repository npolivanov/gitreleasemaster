import { Box, Button, IconButton, Stack, TextField, Tooltip, Typography } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import {
  type Control,
  type FieldArrayWithId,
  type UseFormRegister,
} from "react-hook-form";
import type { CreateReleaseFormValues } from "../";
import AddIcon from "@mui/icons-material/Add";
import { ControlMenu } from "./control-menu/control-menu";

export interface UnstagedCommitsListProps {
  /** Field array entries produced by `useFieldArray`. */
  fields: FieldArrayWithId<CreateReleaseFormValues, "commits">[];
  /** `register` from the parent `useForm`, used to bind each input. */
  register: UseFormRegister<CreateReleaseFormValues>;
  /** `remove` from `useFieldArray`, deletes a row by its index. */
  remove: (index?: number | number[]) => void;
  add: () => void;
  /** When false (only one row left) the delete button is disabled. */
  canRemove: boolean;

  control: Control<CreateReleaseFormValues, unknown, CreateReleaseFormValues>;
}

/**
 * Presentational list of commit inputs.
 *
 * State lives in the parent (`useForm` + `useFieldArray`); this component only
 * renders one row per field and wires each input to the form via `register`.
 * The delete button is disabled on the last remaining row so the list can
 * never be emptied completely.
 */
export function UnstagedCommitsList({
  fields,
  register,
  remove,
  canRemove,
  add,
  control,
}: UnstagedCommitsListProps) {
  return (
    <>
      <Typography variant="h6">Коммиты для релиза</Typography>

      <ControlMenu register={register} control={control} />
      <Box
        sx={{
          marginTop: "30px",
        }}
      >
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
      </Box>
    </>
  );
}
