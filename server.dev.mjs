// Servidor de desarrollo local: envuelve las mismas funciones de api/*.js
// (formato Vercel: handler(req, res)) para poder probarlas por HTTP antes
// de desplegar. No se usa en produccion (ahi Vercel las sirve directamente).
import express from "express";
import cors from "cors";

import chatHandler from "./api/chat.js";
import searchHandler from "./api/search.js";
import convertHandler from "./api/convert.js";
import ingestHandler from "./api/ingest.js";

const app = express();
app.use(cors());

app.post("/api/chat", express.json({ limit: "1mb" }), (req, res) => chatHandler(req, res));
app.post("/api/search", express.json({ limit: "1mb" }), (req, res) => searchHandler(req, res));
app.post("/api/convert", (req, res) => convertHandler(req, res));
app.post("/api/ingest", (req, res) => ingestHandler(req, res));

app.get("/health", (_req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => console.log(`Servidor de desarrollo escuchando en http://localhost:${PORT}`));
