import { env } from "@huggingface/transformers";

// En Vercel (funciones serverless) el sistema de ficheros es de solo lectura
// salvo /tmp. Sin esto, transformers.js intenta escribir su cache de modelos
// dentro de node_modules y falla con ENOENT.
env.cacheDir = "/tmp/hf-cache/";
