import { Box, Typography, Stack, Divider } from "@mui/material";
import { styled } from "@mui/material/styles";
import { useFieldArray, useForm } from "react-hook-form";
import { UnstagedCommitsList } from "./unstaged";

const StackWrapper = styled(Stack)`
  width: 100%;
`;
const Item = styled("div")`
  width: 50%;
`;

/** One entry in the commits list — a single string field (SHA or message). */
export interface CommitItem {
  value: string;
}

/** Shape of the whole create-release form. */
export interface CreateReleaseFormValues {
  commits: CommitItem[];
  isDeleted: boolean;
  addFormBranch: string;
}

/**
 * Release creation screen.
 *
 * Owns the form state: `useForm` + `useFieldArray` live here, while the
 * rendering of each row is delegated to `UnstagedCommitsList`.
 */
export function CreateReleaseScreen() {
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
    console.log(data);
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
        <Item>234234234234234</Item>
      </StackWrapper>
    </form>
  );
}
