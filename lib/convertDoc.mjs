import mammoth from "mammoth";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

/**
 * Convierte un buffer DOCX a Markdown (aproximado: mammoth exporta a HTML,
 * lo bajamos a Markdown simple manteniendo parrafos y encabezados).
 */
export async function docxToMarkdown(buffer) {
  const { value: html } = await mammoth.convertToHtml({ buffer });
  return html
    .replace(/<h1>(.*?)<\/h1>/gi, "\n# $1\n")
    .replace(/<h2>(.*?)<\/h2>/gi, "\n## $1\n")
    .replace(/<h3>(.*?)<\/h3>/gi, "\n### $1\n")
    .replace(/<strong>(.*?)<\/strong>/gi, "**$1**")
    .replace(/<em>(.*?)<\/em>/gi, "*$1*")
    .replace(/<li>(.*?)<\/li>/gi, "- $1\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Convierte un buffer PDF a texto plano, devolviendo tambien el numero de
 * paginas (pdf-parse no separa por pagina de forma nativa, asi que estimamos
 * limites de pagina por el caracter de form-feed que inserta internamente).
 */
export async function pdfToMarkdown(buffer) {
  const data = await pdfParse(buffer);
  const rawPages = data.text.split("\f");
  const pages = rawPages.map((text, idx) => ({
    page: idx + 1,
    text: text.replace(/\n{3,}/g, "\n\n").trim(),
  })).filter((p) => p.text.length > 0);
  return { fullText: data.text.trim(), pages, numPages: data.numpages };
}

/**
 * Punto de entrada del microservicio: dado un buffer + nombre de fichero,
 * detecta el tipo por extension y devuelve markdown/texto normalizado.
 */
export async function convertToMarkdown(buffer, fileName) {
  const ext = fileName.toLowerCase().split(".").pop();
  if (ext === "docx") {
    const markdown = await docxToMarkdown(buffer);
    return { markdown, pages: [{ page: 1, text: markdown }], sourceType: "docx" };
  }
  if (ext === "pdf") {
    const { fullText, pages } = await pdfToMarkdown(buffer);
    return { markdown: fullText, pages, sourceType: "pdf" };
  }
  if (ext === "md" || ext === "txt") {
    const text = buffer.toString("utf-8");
    return { markdown: text, pages: [{ page: 1, text }], sourceType: ext };
  }
  throw new Error(`Formato no soportado: .${ext} (admitidos: pdf, docx, md, txt)`);
}
