import { ChatGroq } from "@langchain/groq";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { evaluate as mathEvaluate } from "mathjs";
import { retrieve, retrieveFromChunks } from "./retrieval.mjs";

const RAG_SYSTEM_PROMPT = `Eres un asistente util y amable. Responde UNICAMENTE basandote en el siguiente contexto. No uses conocimiento externo ni informacion que no aparezca en el contexto.

Contexto:
{context}

Si la respuesta no esta en el contexto, responde exactamente: "No tengo esa informacion en los documentos disponibles."`;

const ROUTER_PROMPT = `Dada la pregunta del usuario, clasificala como 'calculo' o 'rag'.
- Usa 'calculo' UNICAMENTE si la pregunta pide evaluar una operacion aritmetica
  explicita y autocontenida (ej: "cuanto es 15 mas 20", "la raiz cuadrada de 81",
  "que es 250 entre 18"), donde todos los numeros necesarios ya estan en la pregunta.
- Usa 'rag' para CUALQUIER pregunta sobre el contenido de los documentos, aunque
  mencione cifras, presupuestos, comparaciones u ofertas (ej: "cual es el
  presupuesto maximo", "que oferta es mas barata", "cumple el SLA exigido").
  Ante la duda, responde 'rag'.

Devuelve una unica palabra: calculo o rag.

Pregunta: {input}`;

const CALC_PROMPT = `Convierte la siguiente pregunta en una unica expresion matematica evaluable por mathjs (sin explicaciones, solo la expresion).

Ejemplos:
Pregunta: cuanto es 5 elevado a la 3
Expresion: 5^3

Pregunta: la raiz cuadrada de 81
Expresion: sqrt(81)

Pregunta: 250 entre 18
Expresion: 250 / 18

Pregunta: {input}
Expresion:`;

function buildLlm() {
  return new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL || "qwen/qwen3.8-27b",
    temperature: 0,
  });
}

function toLangChainMessages(history) {
  return history.map((m) =>
    m.role === "user" ? new HumanMessage(m.content) : new AIMessage(m.content)
  );
}

async function classifyRoute(llm, input) {
  const chain = ChatPromptTemplate.fromTemplate(ROUTER_PROMPT)
    .pipe(llm)
    .pipe(new StringOutputParser());
  const route = await chain.invoke({ input });
  return route.toLowerCase().includes("calculo") ? "calculo" : "rag";
}

async function runCalculator(llm, input) {
  const chain = ChatPromptTemplate.fromTemplate(CALC_PROMPT)
    .pipe(llm)
    .pipe(new StringOutputParser());
  const expression = (await chain.invoke({ input })).trim();
  try {
    const result = mathEvaluate(expression);
    return { answer: `El resultado es: ${result}`, expression };
  } catch (err) {
    return { answer: `No pude evaluar la expresion "${expression}": ${err.message}`, expression };
  }
}

async function contextualizeQuestion(llm, input, history) {
  if (history.length === 0) return input;
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "Dada la conversacion, reescribe la pregunta de seguimiento para que sea una pregunta independiente. Devuelve solo la pregunta reescrita."],
    new MessagesPlaceholder("chat_history"),
    ["user", "{input}"],
  ]);
  const chain = prompt.pipe(llm).pipe(new StringOutputParser());
  return chain.invoke({ input, chat_history: toLangChainMessages(history) });
}

async function runRag(llm, input, history, sessionChunks) {
  const standaloneQuestion = await contextualizeQuestion(llm, input, history);
  const chunks = sessionChunks && sessionChunks.length > 0
    ? await retrieveFromChunks(standaloneQuestion, sessionChunks, { finalK: 5 })
    : await retrieve(standaloneQuestion, { finalK: 5 });

  const context = chunks.map((c) => `[${c.fileName}, pag. ${c.pageNumber}]\n${c.content}`).join("\n\n---\n\n");

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", RAG_SYSTEM_PROMPT],
    new MessagesPlaceholder("chat_history"),
    ["user", "{input}"],
  ]);
  const chain = prompt.pipe(llm).pipe(new StringOutputParser());
  const answer = await chain.invoke({
    input: input,
    context,
    chat_history: toLangChainMessages(history),
  });

  const sources = dedupeSources(chunks);
  return { answer, sources, standaloneQuestion, chunks };
}

function dedupeSources(chunks) {
  const seen = new Set();
  const sources = [];
  for (const c of chunks) {
    const key = `${c.fileName}#${c.pageNumber}`;
    if (!seen.has(key)) {
      seen.add(key);
      sources.push({ fileName: c.fileName, pageNumber: c.pageNumber });
    }
  }
  return sources;
}

/**
 * Punto de entrada del agente: clasifica la pregunta (calculo vs rag) y
 * ejecuta la ruta correspondiente. `history` es un array de
 * {role: 'user'|'assistant', content: string}.
 *
 * Con `includeContexts` la respuesta anade `contexts`: los fragmentos, en el
 * orden en que se pasaron al LLM. Lo usa la evaluacion (rag-eval) para medir
 * la fidelidad de la respuesta contra lo que el modelo vio de verdad.
 */
export async function runChat({ input, history = [], sessionChunks = [], includeContexts = false }) {
  const llm = buildLlm();
  const route = await classifyRoute(llm, input);

  if (route === "calculo") {
    const { answer, expression } = await runCalculator(llm, input);
    const result = { route, answer, expression, sources: [] };
    return includeContexts ? { ...result, contexts: [] } : result;
  }

  const { answer, sources, standaloneQuestion, chunks } = await runRag(llm, input, history, sessionChunks);
  const result = { route, answer, sources, standaloneQuestion };
  if (!includeContexts) return result;
  return {
    ...result,
    contexts: chunks.map((c) => ({ content: c.content, fileName: c.fileName, pageNumber: c.pageNumber })),
  };
}
