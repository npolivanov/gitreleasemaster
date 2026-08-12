import { useFieldArray, useForm } from "react-hook-form";
import { UnstagedCommitsList } from "./unstaged";
import type { CreateReleaseFormValues, ReleaseContext } from "../types";
import { FlexBox } from "../../../components/ui/flex-box";
import { Box, Divider } from "@mui/material";

interface Step2CommitsProps {
  /** Контекст созданной ветки — из Шага 1. Пока информационный. */
  releaseCtx?: ReleaseContext | null;
}

export function Commits({ releaseCtx }: Step2CommitsProps) {
  const { control, register, handleSubmit } = useForm<CreateReleaseFormValues>({
    defaultValues: {
      commits: [{ value: "" }],
      isDeleteMode: false,
      upstreamBranch: "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "commits",
  });

  const handleAdd = () => append({ value: "" });

  const onSubmit = (data: CreateReleaseFormValues) => {
    // eslint-disable-next-line no-console
    console.log(data, releaseCtx);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <FlexBox
        sx={{
          width: "100%",
          justifyContent: "space-around",
        }}
      >
        <UnstagedCommitsList
          fields={fields}
          register={register}
          remove={remove}
          canRemove={fields.length > 1}
          add={handleAdd}
          control={control}
        />
        <Divider orientation="vertical" flexItem />
        <Box
          sx={{
            width: "100%",
          }}
        >
          123123
        </Box>
      </FlexBox>
    </form>
  );
}
