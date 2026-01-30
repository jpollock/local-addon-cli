/**
 * Types for MCP client communication
 */

export interface McpToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

export interface McpToolCallRequest {
  method: 'tools/call';
  params: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

export interface McpToolCallResponse {
  result?: McpToolResult;
  error?: {
    code: number;
    message: string;
  };
}

export interface McpError extends Error {
  code?: number;
  isError: true;
}

export function createMcpError(message: string, code?: number): McpError {
  const error = new Error(message) as McpError;
  error.isError = true;
  error.code = code;
  return error;
}
