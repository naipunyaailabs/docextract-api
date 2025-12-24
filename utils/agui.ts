/**
 * Shared AG-UI (Agent UI) streaming primitives
 * 
 * This module provides the core types, enums, and helper functions for
 * implementing Server-Sent Events (SSE) streaming compatible with the AG-UI protocol.
 * 
 * @see https://github.com/agui-org/agui for protocol specification
 */

/**
 * AG-UI Event Types
 * Defines all possible event types in the AG-UI protocol
 */
export enum AGUIEventType {
  RUN_STARTED = "run_started",
  RUN_FINISHED = "run_finished",
  RUN_ERROR = "run_error",
  TEXT_MESSAGE_START = "text_message_start",
  TEXT_MESSAGE_CONTENT = "text_message_content",
  TEXT_MESSAGE_END = "text_message_end",
  TOOL_CALL_START = "tool_call_start",
  TOOL_CALL_ARGS = "tool_call_args",
  TOOL_CALL_END = "tool_call_end",
  STATE_DELTA = "state_delta"
}

/**
 * Base event interface that all AG-UI events extend
 */
export interface AGUIBaseEvent {
  type: AGUIEventType;
  timestamp?: number;
}

/**
 * Run lifecycle events
 */
export interface RunStartedEvent extends AGUIBaseEvent {
  type: AGUIEventType.RUN_STARTED;
  threadId: string;
  runId: string;
}

export interface RunFinishedEvent extends AGUIBaseEvent {
  type: AGUIEventType.RUN_FINISHED;
  threadId: string;
  runId: string;
  result?: any;
}

export interface RunErrorEvent extends AGUIBaseEvent {
  type: AGUIEventType.RUN_ERROR;
  message: string;
  code?: string;
}

/**
 * Text message events for streaming text content
 */
export interface TextMessageStartEvent extends AGUIBaseEvent {
  type: AGUIEventType.TEXT_MESSAGE_START;
  messageId: string;
  role: "assistant" | "user" | "system";
}

export interface TextMessageContentEvent extends AGUIBaseEvent {
  type: AGUIEventType.TEXT_MESSAGE_CONTENT;
  messageId: string;
  delta: string;
}

export interface TextMessageEndEvent extends AGUIBaseEvent {
  type: AGUIEventType.TEXT_MESSAGE_END;
  messageId: string;
}

/**
 * Tool call events for function/tool invocations
 */
export interface ToolCallStartEvent extends AGUIBaseEvent {
  type: AGUIEventType.TOOL_CALL_START;
  toolCallId: string;
  toolName: string;
  parentMessageId?: string;
}

export interface ToolCallArgsEvent extends AGUIBaseEvent {
  type: AGUIEventType.TOOL_CALL_ARGS;
  toolCallId: string;
  delta: string;
}

export interface ToolCallEndEvent extends AGUIBaseEvent {
  type: AGUIEventType.TOOL_CALL_END;
  toolCallId: string;
  result?: any;
}

/**
 * State management events for updating UI state
 */
export interface StateDeltaEvent extends AGUIBaseEvent {
  type: AGUIEventType.STATE_DELTA;
  delta: Record<string, any>;
}

/**
 * Union type of all possible AG-UI events
 */
export type AGUIEvent = 
  | RunStartedEvent
  | RunFinishedEvent
  | RunErrorEvent
  | TextMessageStartEvent
  | TextMessageContentEvent
  | TextMessageEndEvent
  | ToolCallStartEvent
  | ToolCallArgsEvent
  | ToolCallEndEvent
  | StateDeltaEvent;

/**
 * Creates an AG-UI event with automatic timestamp injection
 * 
 * @param event - Event data without timestamp
 * @returns Event with timestamp added
 * 
 * @example
 * ```typescript
 * const event = createAGUIEvent<RunStartedEvent>({
 *   type: AGUIEventType.RUN_STARTED,
 *   threadId: "thread_123",
 *   runId: "run_456"
 * });
 * ```
 */
export function createAGUIEvent<T extends AGUIEvent>(event: Omit<T, 'timestamp'>): T {
  return {
    ...event,
    timestamp: Date.now()
  } as T;
}

/**
 * Sends an AG-UI event through a Server-Sent Events stream
 * 
 * @param controller - The ReadableStreamDefaultController for the SSE stream
 * @param event - The AG-UI event to send
 * 
 * @example
 * ```typescript
 * sendSSEEvent(controller, createAGUIEvent<TextMessageContentEvent>({
 *   type: AGUIEventType.TEXT_MESSAGE_CONTENT,
 *   messageId: "msg_123",
 *   delta: "Processing..."
 * }));
 * ```
 */
export function sendSSEEvent(
  controller: ReadableStreamDefaultController,
  event: AGUIEvent
): void {
  const data = JSON.stringify(event);
  controller.enqueue(`data: ${data}\n\n`);
}

/**
 * Creates standard SSE response headers for AG-UI streams
 * 
 * @param additionalHeaders - Optional additional headers to include
 * @returns Headers object configured for SSE streaming
 */
export function createSSEHeaders(additionalHeaders?: Record<string, string>): HeadersInit {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*",
    ...additionalHeaders
  };
}

/**
 * Generates unique IDs for threads, runs, and messages
 */
export function generateThreadId(): string {
  return `thread_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function generateRunId(): string {
  return `run_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function generateToolCallId(): string {
  return `tool_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

