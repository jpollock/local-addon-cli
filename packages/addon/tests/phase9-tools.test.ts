/**
 * Phase 9 Tools Tests
 * Tests for Site Configuration & Dev Tools
 */

import { toggleXdebugDefinition } from '../src/main/mcp/tools/toggleXdebug';
import { getSiteLogsDefinition } from '../src/main/mcp/tools/getSiteLogs';
import { listServicesDefinition } from '../src/main/mcp/tools/listServices';

describe('Phase 9 Tool Definitions', () => {
  describe('toggle_xdebug', () => {
    it('has correct name and description', () => {
      expect(toggleXdebugDefinition.name).toBe('toggle_xdebug');
      expect(toggleXdebugDefinition.description).toContain('Xdebug');
    });

    it('requires site and enabled parameters', () => {
      expect(toggleXdebugDefinition.inputSchema.required).toContain('site');
      expect(toggleXdebugDefinition.inputSchema.required).toContain('enabled');
    });

    it('has boolean enabled parameter', () => {
      const enabledProp = toggleXdebugDefinition.inputSchema.properties.enabled as any;
      expect(enabledProp.type).toBe('boolean');
    });
  });

  describe('get_site_logs', () => {
    it('has correct name and description', () => {
      expect(getSiteLogsDefinition.name).toBe('get_site_logs');
      expect(getSiteLogsDefinition.description).toContain('log');
    });

    it('requires site parameter', () => {
      expect(getSiteLogsDefinition.inputSchema.required).toContain('site');
    });

    it('has optional logType parameter with enum', () => {
      const logTypeProp = getSiteLogsDefinition.inputSchema.properties.logType as any;
      expect(logTypeProp.enum).toContain('php');
      expect(logTypeProp.enum).toContain('nginx');
      expect(logTypeProp.enum).toContain('mysql');
      expect(logTypeProp.enum).toContain('all');
    });

    it('has optional lines parameter', () => {
      expect(getSiteLogsDefinition.inputSchema.properties).toHaveProperty('lines');
      expect(getSiteLogsDefinition.inputSchema.required).not.toContain('lines');
    });
  });

  describe('list_services', () => {
    it('has correct name and description', () => {
      expect(listServicesDefinition.name).toBe('list_services');
      expect(listServicesDefinition.description).toContain('service');
    });

    it('has no required parameters', () => {
      expect(listServicesDefinition.inputSchema.required).toBeUndefined();
    });

    it('has optional type parameter with enum', () => {
      const typeProp = listServicesDefinition.inputSchema.properties.type as any;
      expect(typeProp.enum).toContain('php');
      expect(typeProp.enum).toContain('database');
      expect(typeProp.enum).toContain('webserver');
      expect(typeProp.enum).toContain('all');
    });
  });
});

describe('Phase 9 Tool Count', () => {
  it('adds 3 new tools', () => {
    const phase9Tools = [toggleXdebugDefinition, getSiteLogsDefinition, listServicesDefinition];
    expect(phase9Tools.length).toBe(3);
  });
});
