/**
 * MCP Authentication Manager
 * Handles token generation and validation
 */

import crypto from 'crypto';
import { AUTH_TOKEN_LENGTH, TRUSTED_IPS } from '../../common/constants';

export class McpAuth {
  private token: string | null = null;
  private logger: any;

  constructor(logger: any) {
    this.logger = logger;
  }

  /**
   * Generate a new authentication token
   */
  generateToken(): string {
    this.token = crypto.randomBytes(AUTH_TOKEN_LENGTH / 2).toString('base64');
    this.logger.info(`[MCP] Generated new authentication token: ${this.token.substring(0, 20)}...`);
    return this.token;
  }

  /**
   * Get current token or generate if not exists
   */
  getToken(): string {
    if (!this.token) {
      return this.generateToken();
    }
    return this.token;
  }

  /**
   * Set token (for loading from saved config)
   */
  setToken(token: string): void {
    this.token = token;
  }

  /**
   * Regenerate the authentication token
   */
  regenerateToken(): string {
    this.logger.info('[MCP] Regenerating authentication token');
    return this.generateToken();
  }

  /**
   * Validate provided token against stored token
   */
  validateToken(providedToken: string | undefined): boolean {
    if (!this.token || !providedToken) {
      this.logger.warn(
        `[MCP Auth] Validation failed: token=${!!this.token}, provided=${!!providedToken}`
      );
      return false;
    }

    // Support both raw token and Bearer prefix
    const rawToken = providedToken.startsWith('Bearer ') ? providedToken.slice(7) : providedToken;

    const isValid = rawToken === this.token;
    if (!isValid) {
      this.logger.warn(
        `[MCP Auth] Token mismatch: provided=${rawToken.substring(0, 20)}... stored=${this.token.substring(0, 20)}...`
      );
    }
    return isValid;
  }

  /**
   * Validate that request comes from trusted IP
   */
  validateIP(ip: string | undefined): boolean {
    if (!ip) {
      return false;
    }
    return (TRUSTED_IPS as readonly string[]).includes(ip);
  }

  /**
   * Extract Bearer token from Authorization header
   */
  extractBearerToken(authHeader: string | undefined): string | undefined {
    if (!authHeader) {
      return undefined;
    }

    if (authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }

    return authHeader;
  }
}
