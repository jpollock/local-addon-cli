/**
 * MCP Server
 * Main server class that handles HTTP/SSE connections for MCP protocol
 */

import http from 'http';
import { URL } from 'url';
import { MCP_SERVER, MCP_ENDPOINTS } from '../../common/constants';
import {
  McpConnectionInfo,
  McpServerConfig,
  McpServerStatus,
  McpRequest,
  McpResponse,
  LocalServices,
} from '../../common/types';
import { McpAuth } from './McpAuth';
import { ConnectionInfoManager } from '../config/ConnectionInfo';
import { registerTools, getToolDefinitions, getToolNames, executeTool, hasTool } from './tools';

export class McpServer {
  private server: http.Server | null = null;
  private port: number;
  private auth: McpAuth;
  private connectionInfo: ConnectionInfoManager;
  private services: LocalServices;
  private logger: any;
  private startTime: number = 0;

  constructor(config: McpServerConfig, services: LocalServices, logger: any) {
    this.port = config.port || MCP_SERVER.DEFAULT_PORT;
    this.services = services;
    this.logger = logger;
    this.auth = new McpAuth(logger);
    this.connectionInfo = new ConnectionInfoManager(logger);

    // Set token if provided
    if (config.authToken) {
      this.auth.setToken(config.authToken);
    }

    // Register all tools
    registerTools();
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    if (this.server) {
      this.logger.warn('[MCP] Server already running');
      return;
    }

    // Try to load existing token from connection info (for persistence across restarts)
    const existingInfo = await this.connectionInfo.load();
    if (existingInfo?.authToken) {
      this.auth.setToken(existingInfo.authToken);
      this.logger.info(
        `[MCP] Loaded existing auth token: ${existingInfo.authToken.substring(0, 20)}...`
      );
    }

    // Find available port
    this.port = await this.findAvailablePort(this.port);

    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => this.handleRequest(req, res));

      this.server.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          this.logger.error(`[MCP] Port ${this.port} is in use`);
          reject(new Error(`Port ${this.port} is already in use`));
        } else {
          this.logger.error('[MCP] Server error:', err);
          reject(err);
        }
      });

      this.server.listen(this.port, '127.0.0.1', async () => {
        this.startTime = Date.now();
        this.logger.info(`[MCP] Server started on http://127.0.0.1:${this.port}`);

        // Save connection info
        const info = this.getConnectionInfo();
        await this.connectionInfo.save(info);

        resolve();
      });
    });
  }

  /**
   * Stop the MCP server
   */
  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    return new Promise((resolve) => {
      this.server!.close(() => {
        this.logger.info('[MCP] Server stopped');
        this.server = null;
        this.connectionInfo.delete();
        resolve();
      });
    });
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.server !== null;
  }

  /**
   * Get server status
   */
  getStatus(): McpServerStatus {
    return {
      running: this.isRunning(),
      port: this.port,
      uptime: this.isRunning() ? (Date.now() - this.startTime) / 1000 : 0,
    };
  }

  /**
   * Get connection info for external tools
   */
  getConnectionInfo(): McpConnectionInfo {
    return {
      url: `http://127.0.0.1:${this.port}`,
      authToken: this.auth.getToken(),
      port: this.port,
      version: MCP_SERVER.VERSION,
      tools: getToolNames(),
    };
  }

  /**
   * Regenerate the authentication token
   */
  async regenerateToken(): Promise<string> {
    const newToken = this.auth.regenerateToken();
    // Update connection info file with new token
    const info = this.getConnectionInfo();
    await this.connectionInfo.save(info);
    this.logger.info(`[MCP] Auth token regenerated`);
    return newToken;
  }

  /**
   * Find an available port starting from the preferred port
   */
  private async findAvailablePort(preferredPort: number): Promise<number> {
    const isPortAvailable = (port: number): Promise<boolean> => {
      return new Promise((resolve) => {
        const testServer = http.createServer();
        testServer.once('error', () => resolve(false));
        testServer.once('listening', () => {
          testServer.close(() => resolve(true));
        });
        testServer.listen(port, '127.0.0.1');
      });
    };

    for (let port = preferredPort; port <= MCP_SERVER.PORT_RANGE.MAX; port++) {
      if (await isPortAvailable(port)) {
        if (port !== preferredPort) {
          this.logger.info(`[MCP] Port ${preferredPort} unavailable, using ${port}`);
        }
        return port;
      }
    }

    throw new Error(
      `No available ports in range ${MCP_SERVER.PORT_RANGE.MIN}-${MCP_SERVER.PORT_RANGE.MAX}`
    );
  }

  /**
   * Handle incoming HTTP requests
   */
  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = new URL(req.url || '/', `http://127.0.0.1:${this.port}`);
    const pathname = url.pathname;

    // IP check
    if (!this.auth.validateIP(req.socket.remoteAddress)) {
      this.sendError(res, 403, 'Forbidden: Only localhost connections allowed');
      return;
    }

    // Health endpoint (no auth required)
    if (pathname === MCP_ENDPOINTS.HEALTH) {
      this.handleHealth(req, res);
      return;
    }

    // Auth check for all other endpoints
    const authHeader = req.headers.authorization;
    if (!this.auth.validateToken(authHeader)) {
      this.sendError(res, 401, 'Unauthorized: Invalid or missing authentication token');
      return;
    }

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      });
      res.end();
      return;
    }

    // Route to appropriate handler
    if (pathname === MCP_ENDPOINTS.SSE && req.method === 'GET') {
      this.handleSSE(req, res);
    } else if (pathname === MCP_ENDPOINTS.MESSAGES && req.method === 'POST') {
      await this.handleMessage(req, res);
    } else {
      this.sendError(res, 404, 'Not Found');
    }
  }

  /**
   * Handle health check requests
   */
  private handleHealth(req: http.IncomingMessage, res: http.ServerResponse): void {
    const status = this.getStatus();
    const token = this.auth.getToken();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'ok',
        version: MCP_SERVER.VERSION,
        uptime: status.uptime,
        tools: getToolNames(),
        tokenPrefix: token.substring(0, 20),
      })
    );
  }

  /**
   * Handle SSE connection for MCP protocol
   */
  private handleSSE(req: http.IncomingMessage, res: http.ServerResponse): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    // Send endpoint information
    const messagesUrl = `http://127.0.0.1:${this.port}${MCP_ENDPOINTS.MESSAGES}`;
    res.write(`event: endpoint\ndata: ${messagesUrl}\n\n`);

    // Keep connection alive
    const keepAlive = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 30000);

    req.on('close', () => {
      clearInterval(keepAlive);
    });
  }

  /**
   * Handle MCP message requests
   */
  private async handleMessage(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', async () => {
      try {
        const request: McpRequest = JSON.parse(body);

        // Notifications don't have an id and don't expect a response
        if (request.method?.startsWith('notifications/')) {
          this.logger.info(`[MCP] Received notification: ${request.method}`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end('{}');
          return;
        }

        const response = await this.processMessage(request);

        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(JSON.stringify(response));
      } catch (error: any) {
        this.logger.error('[MCP] Message handling error:', error);
        this.sendError(res, 400, `Invalid request: ${error.message}`);
      }
    });
  }

  /**
   * Process an MCP message and return response
   */
  private async processMessage(request: McpRequest): Promise<McpResponse> {
    const { id, method, params } = request;

    switch (method) {
      case 'initialize':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: MCP_SERVER.NAME,
              version: MCP_SERVER.VERSION,
            },
          },
        };

      case 'tools/list':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            tools: getToolDefinitions(),
          },
        };

      case 'tools/call':
        if (!params?.name) {
          return {
            jsonrpc: '2.0',
            id,
            error: {
              code: -32602,
              message: 'Missing tool name',
            },
          };
        }

        if (!hasTool(params.name)) {
          return {
            jsonrpc: '2.0',
            id,
            error: {
              code: -32602,
              message: `Unknown tool: ${params.name}`,
            },
          };
        }

        const result = await executeTool(params.name, params.arguments || {}, this.services);

        return {
          jsonrpc: '2.0',
          id,
          result,
        };

      case 'ping':
        return {
          jsonrpc: '2.0',
          id,
          result: {},
        };

      default:
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: `Unknown method: ${method}`,
          },
        };
    }
  }

  /**
   * Send an error response
   */
  private sendError(res: http.ServerResponse, statusCode: number, message: string): void {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: message }));
  }
}
