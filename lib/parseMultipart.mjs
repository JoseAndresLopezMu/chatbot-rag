import Busboy from "busboy";

/**
 * Parsea un request multipart/form-data (subida de fichero) sin depender de
 * Express/multer. Devuelve { fileName, buffer } del primer fichero recibido.
 */
export function parseMultipartFile(req) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: req.headers, limits: { fileSize: 20 * 1024 * 1024 } });
    let fileName = null;
    const chunks = [];

    busboy.on("file", (_name, stream, info) => {
      fileName = info.filename;
      stream.on("data", (chunk) => chunks.push(chunk));
    });

    busboy.on("error", reject);
    busboy.on("finish", () => {
      if (!fileName) {
        reject(new Error("No se recibio ningun fichero"));
        return;
      }
      resolve({ fileName, buffer: Buffer.concat(chunks) });
    });

    req.pipe(busboy);
  });
}
