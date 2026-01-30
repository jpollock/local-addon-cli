/**
 * Phase 8 Tools Tests
 * Tests for WordPress Development Tools
 */

import { exportDatabaseDefinition } from '../src/main/mcp/tools/exportDatabase';
import { importDatabaseDefinition } from '../src/main/mcp/tools/importDatabase';
import { openAdminerDefinition } from '../src/main/mcp/tools/openAdminer';
import { trustSslDefinition } from '../src/main/mcp/tools/trustSsl';
import { renameSiteDefinition } from '../src/main/mcp/tools/renameSite';
import { changePhpVersionDefinition } from '../src/main/mcp/tools/changePhpVersion';
import { importSiteDefinition } from '../src/main/mcp/tools/importSite';

describe('Phase 8 Tool Definitions', () => {
  describe('export_database', () => {
    it('has correct name and description', () => {
      expect(exportDatabaseDefinition.name).toBe('export_database');
      expect(exportDatabaseDefinition.description).toContain('Export');
      expect(exportDatabaseDefinition.description).toContain('database');
    });

    it('requires site parameter', () => {
      expect(exportDatabaseDefinition.inputSchema.required).toContain('site');
    });

    it('has optional outputPath parameter', () => {
      expect(exportDatabaseDefinition.inputSchema.properties).toHaveProperty('outputPath');
      expect(exportDatabaseDefinition.inputSchema.required).not.toContain('outputPath');
    });
  });

  describe('import_database', () => {
    it('has correct name and description', () => {
      expect(importDatabaseDefinition.name).toBe('import_database');
      expect(importDatabaseDefinition.description).toContain('Import');
    });

    it('requires site and sqlPath parameters', () => {
      expect(importDatabaseDefinition.inputSchema.required).toContain('site');
      expect(importDatabaseDefinition.inputSchema.required).toContain('sqlPath');
    });
  });

  describe('open_adminer', () => {
    it('has correct name and description', () => {
      expect(openAdminerDefinition.name).toBe('open_adminer');
      expect(openAdminerDefinition.description).toContain('Adminer');
    });

    it('requires site parameter', () => {
      expect(openAdminerDefinition.inputSchema.required).toContain('site');
    });
  });

  describe('trust_ssl', () => {
    it('has correct name and description', () => {
      expect(trustSslDefinition.name).toBe('trust_ssl');
      expect(trustSslDefinition.description).toContain('SSL');
    });

    it('requires site parameter', () => {
      expect(trustSslDefinition.inputSchema.required).toContain('site');
    });
  });

  describe('rename_site', () => {
    it('has correct name and description', () => {
      expect(renameSiteDefinition.name).toBe('rename_site');
      expect(renameSiteDefinition.description).toContain('Rename');
    });

    it('requires site and newName parameters', () => {
      expect(renameSiteDefinition.inputSchema.required).toContain('site');
      expect(renameSiteDefinition.inputSchema.required).toContain('newName');
    });
  });

  describe('change_php_version', () => {
    it('has correct name and description', () => {
      expect(changePhpVersionDefinition.name).toBe('change_php_version');
      expect(changePhpVersionDefinition.description).toContain('PHP');
    });

    it('requires site and phpVersion parameters', () => {
      expect(changePhpVersionDefinition.inputSchema.required).toContain('site');
      expect(changePhpVersionDefinition.inputSchema.required).toContain('phpVersion');
    });
  });

  describe('import_site', () => {
    it('has correct name and description', () => {
      expect(importSiteDefinition.name).toBe('import_site');
      expect(importSiteDefinition.description).toContain('Import');
    });

    it('requires zipPath parameter', () => {
      expect(importSiteDefinition.inputSchema.required).toContain('zipPath');
    });

    it('has optional siteName parameter', () => {
      expect(importSiteDefinition.inputSchema.properties).toHaveProperty('siteName');
      expect(importSiteDefinition.inputSchema.required).not.toContain('siteName');
    });
  });
});

describe('Phase 8 Tool Count', () => {
  it('adds 7 new tools', () => {
    const phase8Tools = [
      exportDatabaseDefinition,
      importDatabaseDefinition,
      openAdminerDefinition,
      trustSslDefinition,
      renameSiteDefinition,
      changePhpVersionDefinition,
      importSiteDefinition,
    ];
    expect(phase8Tools.length).toBe(7);
  });
});
