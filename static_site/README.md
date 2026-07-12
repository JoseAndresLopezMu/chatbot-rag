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

Frontend estático (React) de este proyecto. El backend real (LangChain.js,
retrieval híbrido, LLM) corre en Vercel + Supabase — ver el `README.md` en la
raíz del repositorio para la arquitectura completa y el código fuente.

Hugging Face ya no permite alojar backends con cómputo real de forma gratuita,
así que esta página solo sirve los ficheros estáticos compilados
(`npm run build`), que llaman a la API desplegada en Vercel.

## Caso de uso: evaluación de ofertas en licitación pública

El corpus por defecto es un pliego técnico real (Fundación Madri+d, expediente
S_2026_003) más tres ofertas de proveedores (ficticias, para ilustrar la
comparación). Pregunta sobre requisitos, SLA, precios o cumplimiento normativo
para ver la recuperación híbrida + comparación entre documentos en acción.

Si subes tu propio documento, el asistente responde **solo** con ese documento
(no se mezcla con el corpus por defecto, y no se guarda en ningún sitio).
