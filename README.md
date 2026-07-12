---
title: Chatbot RAG
emoji: 💬
colorFrom: blue
colorTo: green
sdk: static
pinned: false
short_description: RAG chatbot con recuperacion hibrida y agente
---

# 💬 Chatbot RAG — recuperación híbrida + agente

Asistente conversacional que combina **RAG (Retrieval-Augmented Generation)** con
recuperación **híbrida** (semántica + léxica) y un agente que decide entre responder
con los documentos o resolver un cálculo. Sube documentos (PDF/DOCX/TXT/MD) y
pregunta sobre su contenido — las respuestas siempre citan la fuente.

**Caso de uso por defecto — evaluación de ofertas en licitación pública:**
el corpus incluido es un pliego técnico real (Fundación Madri+d, expediente
S_2026_003, mantenimiento de CPD/red/VoIP/nube privada) más tres ofertas de
proveedores (ficticias, para ilustrar la comparación entre precio, SLA y
cumplimiento normativo). Si subes tu propio documento, el asistente responde
**solo** con ese documento durante esa sesión (no se guarda, no se mezcla con
el corpus por defecto).

## Arquitectura

Esta página (Hugging Face) sirve solo el **frontend estático** (React compilado).
La lógica real —base de datos, embeddings, reranking, LLM— corre en **Vercel**
(funciones serverless Node.js) y **Supabase** (Postgres + pgvector), porque
Hugging Face ya no permite backends con cómputo real en el nivel gratuito.

| Capa | Tecnología |
|---|---|
| Frontend | React + Vite |
| Backend | Node.js (funciones serverless en Vercel) |
| Orquestación / agente | LangChain.js |
| LLM | Groq · Llama 3.3 70B |
| Base de datos vectorial | Postgres + `pgvector` (Supabase) |
| Búsqueda léxica | `tsvector`/`ts_rank` nativo de Postgres (equivalente a BM25) |
| Fusión de resultados | Reciprocal Rank Fusion (RRF), calculada en SQL |
| Reranking | Cross-encoder (`Xenova/ms-marco-MiniLM-L-6-v2`, vía `@huggingface/transformers`) |
| Diversidad final | MMR (Maximal Marginal Relevance) |
| Embeddings | `Xenova/all-MiniLM-L6-v2` (384 dims) |
| Conversión de documentos | Microservicio propio DOCX/PDF → Markdown (`mammoth` + `pdf-parse`), expuesto como API REST |

> **Nota sobre idioma:** el modelo de embeddings y el reranker están entrenados
> sobre todo en inglés (el corpus es en español). Se probaron alternativas
> multilingües (`bge-m3`, `multilingual-e5-small`, cross-encoders mMARCO), y
> funcionan mejor en precisión, pero sus pesos (~120MB+ por el tamaño del
> vocabulario multilingüe) superan el límite de 100MB por fichero de las
> funciones serverless de Vercel en el plan gratuito. Migrar a esos modelos
> requeriría servir los embeddings desde una API externa en vez de pesos
> locales empaquetados.

## Pipeline de recuperación

1. **BM25 léxico** (`tsvector` español) + **semántico** (`pgvector`, coseno) —
   cada uno se ejecuta como una consulta SQL independiente.
2. **Fusión RRF**: se combinan ambos rankings con Reciprocal Rank Fusion, en una
   sola función SQL (`hybrid_search`, ver `db/schema.sql`).
3. **Cross-encoder reranking**: los candidatos fusionados se reordenan por
   relevancia real (query, documento) con un modelo cross-encoder.
4. **MMR**: selección final diversificada, evitando pasar al LLM varios
   fragmentos casi idénticos.

## Agente

Un router (LLM) clasifica cada pregunta como `calculo` o `rag`:
- `calculo`: el LLM genera una expresión matemática, evaluada de forma segura
  con `mathjs` (sin ejecutar código arbitrario).
- `rag`: reformula la pregunta con el historial de conversación (para
  preguntas de seguimiento), recupera contexto con el pipeline de arriba, y
  genera una respuesta **solo** basada en ese contexto, citando fuente y página.

## Ejecutar en local

```bash
npm install
cp .env.example .env   # rellena DATABASE_URL y GROQ_API_KEY
npm run seed           # indexa los documentos de documents/ en Supabase
npm run dev:api        # backend (puerto 8787)
npm run dev:web        # frontend (puerto 5173, con proxy a /api)
```

## Estructura

```
api/                 Funciones serverless (Vercel): chat, search, convert, process-document
lib/                 Modulos compartidos: db, embeddings, reranker, mmr, chunker,
                     conversion de documentos, retrieval hibrido, agente LangChain.js
db/schema.sql        Esquema Postgres/pgvector + funcion hybrid_search (RRF)
scripts/seed.mjs      Ingesta inicial de documents/ en Supabase
src/                  Frontend React
documents/            Corpus por defecto (pliego real + ofertas de ejemplo)
server.dev.mjs        Servidor Express para desarrollo local (envuelve api/*.js)
vercel.json           Configuracion de despliegue en Vercel
```

## Despliegue

- **Vercel**: aloja `api/*.js` (backend Node) — variables de entorno `DATABASE_URL`
  y `GROQ_API_KEY`.
- **Supabase**: Postgres + `pgvector`, conexión vía "Transaction pooler" (recomendado
  para funciones serverless).
- **Hugging Face** (esta página): solo el frontend estático, compilado con
  `VITE_API_BASE_URL` apuntando a la URL de Vercel.
