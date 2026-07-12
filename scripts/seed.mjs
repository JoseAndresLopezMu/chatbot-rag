// Script de ingesta: convierte los PDFs/DOCX de documents/, los trocea,
// calcula embeddings y los guarda en Supabase (documents + chunks).
// Sustituye a build_index.py / index.py de la version Python.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { convertToMarkdown } from "../lib/convertDoc.mjs";
import { chunkText } from "../lib/chunker.mjs";
import { embedPassages } from "../lib/embeddings.mjs";
import { getPool } from "../lib/db.mjs";

// Red de seguridad: algunas versiones de pdf-parse/pdf.js generan rechazos de
// promesa internos (advertencias sobre streams no soportados) que no estan
// atados al await principal. Sin este guard, tumban todo el proceso Node.
process.on("unhandledRejection", (reason) => {
  console.warn("Aviso (promesa no capturada, ignorada):", reason?.message || reason);
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = path.join(__dirname, "..", "documents");

async function main() {
  const pool = getPool();
  const files = fs.readdirSync(DOCS_DIR).filter((f) => /\.(pdf|docx|md|txt)$/i.test(f));
  console.log(`Encontrados ${files.length} documentos en ${DOCS_DIR}: ${files.join(", ")}`);

  for (const fileName of files) {
    const buffer = fs.readFileSync(path.join(DOCS_DIR, fileName));

    let converted;
    try {
      converted = await convertToMarkdown(buffer, fileName);
    } catch (err) {
      console.warn(`SALTADO ${fileName}: no se pudo convertir (${err.message})`);
      continue;
    }

    const { pages, sourceType } = converted;

    const docResult = await pool.query(
      "insert into documents (file_name, source_type, markdown) values ($1, $2, $3) returning id",
      [fileName, sourceType, converted.markdown]
    );
    const documentId = docResult.rows[0].id;

    const allChunks = [];
    for (const page of pages) {
      const pieces = chunkText(page.text);
      for (const piece of pieces) {
        allChunks.push({ content: piece, page: page.page });
      }
    }

    if (allChunks.length === 0) {
      console.warn(`${fileName}: 0 chunks generados, se omite indexado.`);
      continue;
    }

    const vectors = await embedPassages(allChunks.map((c) => c.content));

    for (let i = 0; i < allChunks.length; i++) {
      const vectorLiteral = `[${vectors[i].join(",")}]`;
      await pool.query(
        `insert into chunks (document_id, chunk_index, page_number, content, embedding)
         values ($1, $2, $3, $4, $5)`,
        [documentId, i, allChunks[i].page, allChunks[i].content, vectorLiteral]
      );
    }

    console.log(`OK ${fileName} -> documento ${documentId}, ${allChunks.length} chunks indexados.`);
  }

  await pool.end();
  console.log("Ingesta completa.");
}

main().catch((err) => {
  console.error("Error en la ingesta:", err);
  process.exit(1);
});
