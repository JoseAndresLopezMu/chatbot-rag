---
title: Chatbot RAG
emoji: 💬
colorFrom: blue
colorTo: green
sdk: docker
app_port: 8501
pinned: false
short_description: RAG chatbot with document Q&A and code execution
---

# RAG Chatbot with Agent and Code Execution

A conversational AI assistant that combines **Retrieval-Augmented Generation (RAG)** with an autonomous agent capable of executing Python code. Upload your documents and ask questions about them — the chatbot retrieves the most relevant passages and generates precise, grounded answers. When calculations are needed, it writes and runs code automatically.

## What it does

The application indexes your uploaded documents into a vector store and uses semantic search to find the most relevant chunks before generating each response. This means answers are always grounded in your actual documents rather than relying on the model's training data alone. The integrated Python executor lets the assistant go beyond text — it can compute statistics, generate plots, or run any analysis your documents require.

**Key capabilities:**
- Upload PDF, TXT, or Markdown documents and ask questions about their content
- Semantic search over document embeddings for accurate retrieval
- Grounded answers with source citations so you know where each fact comes from
- Python code execution for data analysis and calculations
- Conversation memory — the assistant remembers context across multiple turns

## Tech stack

| Layer | Technology |
|---|---|
| UI | Streamlit |
| LLM | Groq · LLaMA 3.3 70B |
| Embeddings | HuggingFace sentence-transformers |
| Vector store | FAISS |
| Agent framework | LangChain |
| Containerization | Docker |

## How to use

1. Upload one or more documents (PDF, TXT, MD) from the sidebar.
2. Wait for the indexing step to complete — the app will confirm when it's ready.
3. Type your question in the chat box. The assistant will retrieve relevant passages and generate an answer.
4. Source chunks used for each answer are shown in an expandable section below the response.

## Architecture

```
Document Upload
    │
    ▼
Text chunking + embedding (sentence-transformers)
    │
    ▼
FAISS vector store
    │
    ▼
User query ──► semantic search ──► top-k chunks
                                        │
                                        ▼
                              LLM (LLaMA 3.3 70B)
                                        │
                              ┌─────────┴──────────┐
                              │                    │
                         text answer          python_repl
                              │                    │
                              └─────────┬──────────┘
                                        ▼
                               Final answer + sources
```
