/**
 * Lenient JSON.parse for bodies that occasionally include raw ASCII control characters
 * inside string values (invalid JSON per RFC 8259). Same repair as some OpenRouter
 * responses with wrapped base64 in `data:` URLs.
 */

export function stripUnescapedAsciiControlsInJsonStrings(input: string): string {
  let out = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i]!;
    if (!inString) {
      if (c === '"') inString = true;
      out += c;
      continue;
    }
    if (escaped) {
      out += c;
      escaped = false;
      continue;
    }
    if (c === '\\') {
      out += c;
      escaped = true;
      continue;
    }
    if (c === '"') {
      inString = false;
      out += c;
      continue;
    }
    const code = c.charCodeAt(0);
    if (code < 0x20) {
      continue;
    }
    out += c;
  }
  return out;
}

/**
 * Strict parse first; on SyntaxError, strip unescaped controls inside strings and parse again.
 */
export function parseJsonLenient(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) throw new SyntaxError('Empty JSON body');
  try {
    return JSON.parse(trimmed);
  } catch (first) {
    if (!(first instanceof SyntaxError)) throw first;
    const repaired = stripUnescapedAsciiControlsInJsonStrings(trimmed);
    return JSON.parse(repaired);
  }
}
