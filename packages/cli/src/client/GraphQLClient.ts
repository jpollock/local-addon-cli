/**
 * GraphQL Client
 *
 * Simple GraphQL client for communicating with Local's GraphQL server.
 */

import { ConnectionInfo } from '../bootstrap';

export interface GraphQLError {
  message: string;
  locations?: Array<{ line: number; column: number }>;
  path?: string[];
}

export interface GraphQLResponse<T = unknown> {
  data?: T;
  errors?: GraphQLError[];
}

export class GraphQLClientError extends Error {
  constructor(
    message: string,
    public errors?: GraphQLError[]
  ) {
    super(message);
    this.name = 'GraphQLClientError';
  }
}

export class GraphQLClient {
  private url: string;
  private authToken: string;
  private timeout: number;

  constructor(connectionInfo: ConnectionInfo, options: { timeout?: number } = {}) {
    this.url = connectionInfo.url;
    this.authToken = connectionInfo.authToken;
    this.timeout = options.timeout || 30000;
  }

  /**
   * Execute a GraphQL query or mutation
   */
  async query<T = unknown>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(this.url, {
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
        throw new GraphQLClientError(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = (await response.json()) as GraphQLResponse<T>;

      if (result.errors && result.errors.length > 0) {
        throw new GraphQLClientError(result.errors[0].message, result.errors);
      }

      if (!result.data) {
        throw new GraphQLClientError('No data in response');
      }

      return result.data;
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new GraphQLClientError('Request timed out');
      }

      if (error instanceof GraphQLClientError) {
        throw error;
      }

      throw new GraphQLClientError(error.message);
    }
  }

  /**
   * Execute a mutation (alias for query, for clarity)
   */
  async mutate<T = unknown>(mutation: string, variables: Record<string, unknown> = {}): Promise<T> {
    return this.query<T>(mutation, variables);
  }
}
