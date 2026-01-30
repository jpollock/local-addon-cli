/**
 * MCP Server Constants
 */

export const MCP_SERVER = {
  NAME: 'Local MCP Server',
  VERSION: '1.0.0',
  DEFAULT_PORT: 10789,
  PORT_RANGE: {
    MIN: 10789,
    MAX: 10889,
  },
} as const;

export const MCP_ENDPOINTS = {
  SSE: '/mcp/sse',
  MESSAGES: '/mcp/messages',
  HEALTH: '/health',
  GRAPHQL: '/graphql',
} as const;

export const CONNECTION_INFO_FILENAME = 'mcp-connection-info.json';

export const TRUSTED_IPS = ['127.0.0.1', '::1', '::ffff:127.0.0.1'] as const;

export const AUTH_TOKEN_LENGTH = 128;

export const REQUEST_TIMEOUT_MS = 30000;
