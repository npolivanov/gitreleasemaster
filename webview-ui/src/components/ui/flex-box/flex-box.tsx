import styled from "@emotion/styled";
import { Box } from "@mui/material";
import type { BoxProps } from "@mui/material";
import type { PropsWithChildren } from "react";

type Props = PropsWithChildren<BoxProps>;

const Flex = styled(Box)`
  display: flex;
`;

export const FlexBox = (props: Props) => {
  const { children, ...rest } = props;
  return <Flex {...rest}>{children}</Flex>;
};
