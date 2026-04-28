import { CRLF_BREAK, MAX_LINE_LENGTH } from "ts-ics";

const encoder = new TextEncoder();

/**
 * Fold an ICS content line per RFC 5545 Section 3.1.
 * Lines longer than 75 **octets** are split with CRLF + SPACE continuation.
 * Uses byte-level counting to handle multi-byte UTF-8 characters correctly.
 */
export function foldLine(line: string): string {
  const bytes = encoder.encode(line);
  if (bytes.length <= MAX_LINE_LENGTH) {
    return line;
  }

  const parts: string[] = [];
  let byteOffset = 0;
  let isFirst = true;

  while (byteOffset < bytes.length) {
    // First line: 75 octets; continuation lines: 74 octets (space prefix occupies 1)
    const maxBytes = isFirst ? MAX_LINE_LENGTH : MAX_LINE_LENGTH - 1;
    let end = Math.min(byteOffset + maxBytes, bytes.length);

    // Avoid splitting inside a multi-byte UTF-8 sequence
    // UTF-8 continuation bytes have the form 10xxxxxx (0x80..0xBF)
    while (end < bytes.length && end > byteOffset && (bytes[end] & 0xC0) === 0x80) {
      end--;
    }

    const chunk = new TextDecoder().decode(bytes.slice(byteOffset, end));
    parts.push(isFirst ? chunk : ` ${chunk}`);
    byteOffset = end;
    isFirst = false;
  }

  return parts.join(CRLF_BREAK);
}
