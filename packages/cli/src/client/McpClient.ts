/**
 * MCP HTTP Client
 *
 * Communicates with the Local addon's MCP server via HTTP.
 */

import { ConnectionInfo } from '../bootstrap';
import { McpToolResult, McpToolCallResponse, createMcpError } from './types';

export interface McpClientOptions {
  timeout?: number;
  retries?: number;
}

export class McpClient {
  private baseUrl: string;
  private authToken: string;
  private timeout: number;
  private retries: number;

  constructor(connectionInfo: ConnectionInfo, options: McpClientOptions = {}) {
    this.baseUrl = `http://${connectionInfo.host}:${connectionInfo.port}`;
    this.authToken = connectionInfo.authToken;
    this.timeout = options.timeout || 30000;
    this.retries = options.retries || 1;
  }

  /**
   * Call an MCP tool
   */
  async callTool(name: string, args: Record<string, unknown> = {}): Promise<McpToolResult> {
    const url = `${this.baseUrl}/mcp/messages`;

    const body = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name,
        arguments: args,
      },
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.authToken}`,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw createMcpError(`HTTP ${response.status}: ${response.statusText}`, response.status);
        }

        const data = (await response.json()) as McpToolCallResponse;

        if (data.error) {
          throw createMcpError(data.error.message, data.error.code);
        }

        if (!data.result) {
          throw createMcpError('No result in response');
        }

        return data.result;
      } catch (error: any) {
        lastError = error;

        if (error.name === 'AbortError') {
          throw createMcpError('Request timed out');
        }

        // Don't retry on client errors (4xx)
        if (error.code && error.code >= 400 && error.code < 500) {
          throw error;
        }

        // Wait before retry
        if (attempt < this.retries - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }

    throw lastError || createMcpError('Unknown error');
  }

  /**
   * Execute a GraphQL query
   */
  async graphql<T = unknown>(
    query: string,
    variables: Record<string, unknown> = {}
  ): Promise<T> {
    const url = `${this.baseUrl}/graphql`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.authToken}`,
        },
        body: JSON.stringify({ query, variables }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw createMcpError(`HTTP ${response.status}: ${response.statusText}`, response.status);
      }

      const data = (await response.json()) as {
        data?: T;
        errors?: Array<{ message: string }>;
      };

      if (data.errors && data.errors.length > 0) {
        throw createMcpError(data.errors[0].message);
      }

      return data.data as T;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw createMcpError('Request timed out');
      }
      throw error;
    }
  }

  /**
   * Check if the server is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get the text content from a tool result
   */
  static getTextContent(result: McpToolResult): string {
    const textContent = result.content.find((c) => c.type === 'text');
    return textContent?.text || '';
  }

  /**
   * Parse JSON from a tool result
   */
  static parseJsonContent<T = unknown>(result: McpToolResult): T {
    const text = McpClient.getTextContent(result);
    return JSON.parse(text) as T;
  }
}
