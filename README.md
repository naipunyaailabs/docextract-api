# docapture-api

## Installation

To install dependencies:

```bash
bun install
```

## Configuration

Create a `.env` file in the root directory with the following variables:

```
OPENAI_API_KEY=your_openai_api_key
GROQ_API_KEY=your_groq_api_key
QDRANT_URL=your_qdrant_url
OLLAMA_BASE_URL=your_ollama_base_url
API_KEY=your_api_key_for_authentication
```

## Running the Application

To run:

```bash
bun run index.ts
```

## API Authentication

All API endpoints require authentication using an API key. Include the API key in the Authorization header:

```
Authorization: Bearer your_api_key
```

For development purposes, if no API_KEY is set in the environment variables, authentication will be disabled.

## Features

- **Multi-format Document Processing**: Supports PDF (with text extraction and OCR), image documents, and text-based documents
- **Language Detection**: Automatic language detection for documents using JavaScript-based detection
- **AI Integration**: Integrates with LLM services (Groq, OpenAI) for information extraction and summarization
- **Vector Storage**: Uses Qdrant for template storage and similarity search with OpenAI embeddings
- **Template Matching**: Store document templates and match new documents to extract predefined fields

## API Endpoints

- POST `/upload` - Upload and store document templates
- POST `/extract` - Extract information from documents
- POST `/summarize` - Generate document summaries
- POST `/reset` - Reset the vector store

This project was created using `bun init` in bun v1.2.11. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.