import { useMemo, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  List,
  ListItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";

export interface TemplateTabProps {
  /** Добавить список значений в форму коммитов (как ручное добавление). */
  addMany: (values: string[]) => void;
}

/**
 * Таб «Создать шаблон»: разбиение вставленного текста на список коммитов.
 *
 * Текст делится на массив по строке из поля «Разделитель»; при активном
 * чекбоксе trim у каждого элемента удаляются пробелы по краям. Результат
 * сразу показывается списком внизу (превью до добавления), кнопка «Добавить»
 * кладёт элементы в форму — аналогично ручному добавлению.
 */
export function TemplateTab({ addMany }: TemplateTabProps) {
  const [separator, setSeparator] = useState(",");
  const [text, setText] = useState("");
  const [trim, setTrim] = useState(false);

  // `{Enter}` (в любом регистре, с пробелами по краям) — переносы строк.
  const effectiveSeparator = useMemo(() => {
    if (separator.trim().toLowerCase() === "{enter}") return "\n";
    return separator;
  }, [separator]);

  const result = useMemo(() => {
    // Пустой разделитель не разбивает ("".split("") дал бы массив букв).
    if (separator === "" || text === "") return [];
    const normalized =
      effectiveSeparator === "\n" ? text.replace(/\r\n/g, "\n") : text;
    const parts = normalized.split(effectiveSeparator);
    const prepared = trim ? parts.map((p) => p.trim()) : parts;
    // Пустые строки (после trim) бесполезны как коммиты — не показываем и не добавляем.
    return prepared.filter((p) => p !== "");
  }, [separator, text, trim, effectiveSeparator]);

  const handleAdd = () => {
    if (result.length === 0) return;
    addMany(result);
    setText("");
  };

  return (
    <Stack spacing={2}>
      <TextField
        size="small"
        label="Разделитель"
        value={separator}
        onChange={(e) => setSeparator(e.target.value)}
        helperText="Строка, по которой режется текст (например, , ; или {Enter} — перенос строки)"
      />

      <TextField
        size="small"
        label="Текст"
        multiline
        minRows={4}
        maxRows={12}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Вставьте список коммитов…"
        sx={{ width: 400, maxWidth: "100%" }}
      />

      <FormControlLabel
        control={
          <Checkbox checked={trim} onChange={(e) => setTrim(e.target.checked)} />
        }
        label="trim (удалить пробелы по краям)"
      />

      <Box>
        <Typography variant="subtitle2" gutterBottom>
          Результат ({result.length})
        </Typography>
        {result.length > 0 ? (
          <List dense disablePadding sx={{ maxHeight: 220, overflow: "auto" }}>
            {result.map((value, i) => (
              <ListItem
                key={`${i}-${value}`}
                divider
                sx={{ py: 0.5, pr: 4 }}
                secondaryAction={
                  <Typography variant="caption" color="text.secondary">
                    {i + 1}.
                  </Typography>
                }
              >
                <Tooltip title={value}>
                  <Typography
                    variant="body2"
                    sx={{
                      fontFamily: "ui-monospace, monospace",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {value}
                  </Typography>
                </Tooltip>
              </ListItem>
            ))}
          </List>
        ) : (
          <Typography variant="caption" color="text.secondary">
            Заполните текст и разделитель — результат появится здесь.
          </Typography>
        )}
      </Box>

      <Button
        size="small"
        variant="contained"
        startIcon={<AddIcon />}
        disabled={result.length === 0}
        onClick={handleAdd}
        sx={{ textTransform: "none", alignSelf: "flex-start" }}
      >
        Добавить
      </Button>
    </Stack>
  );
}
