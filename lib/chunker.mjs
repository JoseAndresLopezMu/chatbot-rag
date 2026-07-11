/**
 * Chunker recursivo simple: intenta partir primero por parrafos ("\n\n"),
 * y si un trozo sigue siendo mas grande que chunkSize, lo parte por lineas ("\n").
 * Equivalente en espiritu al RecursiveChunker que usaba la version Python (chonkie).
 */
export function chunkText(text, { chunkSize = 1000, minChars = 50 } = {}) {
  const paragraphs = text.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  const chunks = [];
  let current = "";

  const flush = () => {
    if (current.trim().length >= minChars) chunks.push(current.trim());
    current = "";
  };

  for (const para of paragraphs) {
    const piece = para.length > chunkSize ? splitByLines(para, chunkSize) : [para];
    for (const sub of piece) {
      if ((current + "\n\n" + sub).length > chunkSize && current) {
        flush();
      }
      current = current ? `${current}\n\n${sub}` : sub;
      if (current.length > chunkSize) flush();
    }
  }
  flush();

  return chunks;
}

function splitByLines(text, chunkSize) {
  const lines = text.split("\n");
  const parts = [];
  let current = "";
  for (const line of lines) {
    if ((current + "\n" + line).length > chunkSize && current) {
      parts.push(current.trim());
      current = "";
    }
    current = current ? `${current}\n${line}` : line;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}
