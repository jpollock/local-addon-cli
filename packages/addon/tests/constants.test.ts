/**
 * Tests for constants
 */

import { MCP_SERVER, MCP_ENDPOINTS } from '../src/common/constants';

describe('Constants', () => {
  describe('MCP_SERVER', () => {
    it('should have correct default port', () => {
      expect(MCP_SERVER.DEFAULT_PORT).toBe(10789);
    });

    it('should have valid port range', () => {
      expect(MCP_SERVER.PORT_RANGE.MIN).toBeLessThan(MCP_SERVER.PORT_RANGE.MAX);
      expect(MCP_SERVER.PORT_RANGE.MIN).toBeGreaterThan(1024);
      expect(MCP_SERVER.PORT_RANGE.MAX).toBeLessThanOrEqual(65535);
    });

    it('should have version string', () => {
      expect(typeof MCP_SERVER.VERSION).toBe('string');
      expect(MCP_SERVER.VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('should have server name', () => {
      expect(typeof MCP_SERVER.NAME).toBe('string');
      expect(MCP_SERVER.NAME.length).toBeGreaterThan(0);
    });
  });

  describe('MCP_ENDPOINTS', () => {
    it('should have health endpoint', () => {
      expect(MCP_ENDPOINTS.HEALTH).toBe('/health');
    });

    it('should have SSE endpoint', () => {
      expect(MCP_ENDPOINTS.SSE).toBe('/mcp/sse');
    });

    it('should have messages endpoint', () => {
      expect(MCP_ENDPOINTS.MESSAGES).toBe('/mcp/messages');
    });
  });
});
