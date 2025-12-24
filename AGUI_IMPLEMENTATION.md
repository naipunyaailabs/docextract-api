# AG-UI Implementation for Document Processing System

This document explains how to use the AG-UI (Agent-User Interaction) protocol implementation in our document processing system.

## Overview

The AG-UI protocol provides a standardized way for AI agents to communicate with user interfaces through streaming events. This implementation allows real-time updates during document processing operations.

## Backend Implementation

### AG-UI Event Types

The system implements the following AG-UI event types:

1. **Run Events**
   - `run_started`: Indicates the start of a processing operation
   - `run_finished`: Indicates successful completion
   - `run_error`: Indicates an error occurred

2. **Text Message Events**
   - `text_message_start`: Beginning of a text response
   - `text_message_content`: Streaming content chunks
   - `text_message_end`: End of text response

3. **State Management Events**
   - `state_delta`: Incremental state updates

### API Endpoints

The AG-UI endpoint is available at:
```
POST /agui/{serviceId}
```

Where `serviceId` can be:
- `extract` - Field extraction
- `summarize` - Document summarization
- `summarize-rfp` - RFP summarization
- `create-rfp` - RFP creation
- `upload` - Template upload

### Authentication

The endpoint supports two authentication methods:
1. **Authorization Header**: `Authorization: Bearer {token}`
2. **Query Parameter**: `/agui/{serviceId}?token={token}`

### Response Format

The endpoint returns a Server-Sent Events (SSE) stream with JSON-formatted events.

## Frontend Implementation

### AGUIClient Hook

A React hook `AGUIClient` is provided for easy integration:

```typescript
import { AGUIClient } from "@/components/dashboard/agui-client"

const { 
  processDocument, 
  cancelProcessing, 
  isProcessing, 
  output, 
  status, 
  error 
} = AGUIClient({
  serviceId: "extract",
  onProcessStart: () => console.log("Processing started"),
  onProcessEnd: (result) => console.log("Processing completed", result),
  onProcessError: (error) => console.log("Processing error", error)
})
```

### Usage Example

```typescript
const formData = new FormData()
formData.append("document", selectedFile)
formData.append("prompt", "Extract invoice details")

await processDocument(formData)
```

## Event Flow

1. Client sends POST request to `/agui/{serviceId}` with document data
2. Server responds with SSE stream
3. Client receives events in real-time:
   - `run_started` - Processing begins
   - `text_message_start` - Response begins
   - `text_message_content` - Streaming content
   - `state_delta` - State updates
   - `text_message_end` - Response ends
   - `run_finished` - Processing completes
4. Client displays updates as they arrive

## Error Handling

Errors are communicated through:
- `run_error` events with error details
- HTTP error responses for authentication/initialization failures

## Benefits

1. **Real-time Feedback**: Users see processing progress as it happens
2. **Standardized Protocol**: Compatible with AG-UI specification
3. **Bidirectional Communication**: Supports cancellation and interaction
4. **Flexible Transport**: Uses standard HTTP/SSE technology
5. **Easy Integration**: Simple API for frontend implementation

## Demo

A demo page is available at `/dashboard/services/agui-demo` to showcase the functionality.