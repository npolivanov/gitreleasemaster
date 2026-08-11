import { Divider, Stack } from "@mui/material";
import { styled } from "@mui/material/styles";
import { useFieldArray, useForm } from "react-hook-form";
import { UnstagedCommitsList } from "./unstaged";
import type { CreateReleaseFormValues, ReleaseContext } from "./types";

const StackWrapper = styled(Stack)`
  width: 100%;
`;
const Item = styled("div")`
  width: 50%;
`;

interface Step2CommitsProps {
  /** Контекст созданной ветки — из Шага 1. Пока информационный. */
  releaseCtx?: ReleaseContext | null;
}

/**
 * Шаг 2 — список коммитов и контролы релиза.
 *
 * Форма с `useForm` + `useFieldArray` и `<UnstagedCommitsList>` — ровно то,
 * что раньше было телом `CreateReleaseScreen`. Переехала сюда без изменений,
 * чтобы `CreateRelease.tsx` стал тонкой обёрткой-роутером шагов.
 */
export function Step2Commits({ releaseCtx }: Step2CommitsProps) {
  const { control, register, handleSubmit } = useForm<CreateReleaseFormValues>({
    defaultValues: {
      commits: [{ value: "" }],
      isDeleted: false,
      addFormBranch: "",
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
      <StackWrapper
        direction="row"
        divider={<Divider orientation="vertical" flexItem />}
      >
        <Item>
          <UnstagedCommitsList
            fields={fields}
            register={register}
            remove={remove}
            canRemove={fields.length > 1}
            add={handleAdd}
            control={control}
          />
        </Item>
        <Item />
      </StackWrapper>
    </form>
  );
}
