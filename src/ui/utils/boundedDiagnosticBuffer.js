export const MAX_CONSOLE_ENTRIES = 256;
export const MAX_CONSOLE_CHARACTERS = 256 * 1024;
export const MAX_CONSOLE_ENTRY_CHARACTERS = 16 * 1024;

export function appendBoundedDiagnosticLog(buffer, entry) {
  const text = String(entry);
  const suffix = "… [truncated]";
  buffer.push(
    text.length > MAX_CONSOLE_ENTRY_CHARACTERS
      ? text.slice(0, MAX_CONSOLE_ENTRY_CHARACTERS - suffix.length) + suffix
      : text,
  );
  let keepFrom = Math.max(0, buffer.length - MAX_CONSOLE_ENTRIES);
  let characters = 0;
  for (let index = buffer.length - 1; index >= keepFrom; index -= 1) {
    characters += buffer[index].length;
    if (characters > MAX_CONSOLE_CHARACTERS) {
      keepFrom = index + 1;
      break;
    }
  }
  if (keepFrom > 0) buffer.splice(0, keepFrom);
}
