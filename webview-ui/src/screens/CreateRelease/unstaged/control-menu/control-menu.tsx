import { Checkbox, FormControlLabel } from "@mui/material";
import {
  Controller,
  useWatch,
  type Control,
  type UseFormRegister,
} from "react-hook-form";
import type { CreateReleaseFormValues } from "../../types";
import { SelectBranch } from "../../../../features/select-branch";

interface ControlMenuProps {
  register: UseFormRegister<CreateReleaseFormValues>;
  control: Control<CreateReleaseFormValues>;
}

/**
 * Release controls: a "delete commits" checkbox and a branch selector.
 *
 * The checkbox is bound directly via `register`. The branch selector does an
 * async search across ALL repo branches (no prefix filter) and is disabled
 * whenever the checkbox is checked — the selected branch is irrelevant when
 * commits are being deleted.
 */
export const ControlMenu = ({ register, control }: ControlMenuProps) => {
  const isDeleted = useWatch({ control, name: "isDeleted" });

  return (
    <div>
      <FormControlLabel
        control={<Checkbox {...register("isDeleted")} color="error" />}
        label="Режим удаление"
      />

      <Controller
        control={control}
        name="addFormBranch"
        render={({ field }) => (
          <SelectBranch
            value={field.value}
            onChange={field.onChange}
            disabled={isDeleted}
            label={"Branch"}
          />
        )}
      />
    </div>
  );
};
