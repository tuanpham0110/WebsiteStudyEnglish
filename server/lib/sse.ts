/**
 * Parse a Server-Sent Events byte stream into the JSON payloads of its `data:` lines.
 * Handles events split across chunks and both \n\n and \r\n\r\n separators.
 */
export async function* parseSseJson(body: ReadableStream<Uint8Array>): AsyncGenerator<unknown, void, void> {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let boundary: RegExpExecArray | null;
      while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
        const rawEvent = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary[0].length);
        const payload = extractData(rawEvent);
        if (payload !== null) yield payload;
      }
    }
    const tail = extractData(buffer);
    if (tail !== null) yield tail;
  } finally {
    reader.releaseLock();
  }
}

function extractData(rawEvent: string): unknown {
  const data = rawEvent
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n');
  if (!data || data === '[DONE]') return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}
