/**
 * Phase 10 Tools Tests
 * Tests for Cloud Backup tools
 */

import * as fs from 'fs';
import * as path from 'path';

// Extract tool definitions from the stdio script
function getToolDefinitions() {
  const scriptPath = path.join(__dirname, '..', 'bin', 'mcp-stdio.js');
  const content = fs.readFileSync(scriptPath, 'utf-8');

  // Find the tools array
  const toolsMatch = content.match(/const tools = \[([\s\S]*?)\n\];/);
  if (!toolsMatch) {
    throw new Error('Could not find tools array in mcp-stdio.js');
  }

  // Parse each tool definition (simplified extraction)
  const toolNames = [
    'backup_status',
    'list_backups',
    'create_backup',
    'restore_backup',
    'delete_backup',
    'download_backup',
    'edit_backup_note',
  ];

  return toolNames.map(name => {
    const toolMatch = content.match(new RegExp(`name: '${name}'[\\s\\S]*?inputSchema: \\{([\\s\\S]*?)\\},\\n  \\}`));
    return {
      name,
      found: toolMatch !== null,
    };
  });
}

describe('Phase 10 Cloud Backup Tools', () => {
  const tools = getToolDefinitions();

  describe('Tool definitions exist in stdio transport', () => {
    it('backup_status is defined', () => {
      const tool = tools.find(t => t.name === 'backup_status');
      expect(tool?.found).toBe(true);
    });

    it('list_backups is defined', () => {
      const tool = tools.find(t => t.name === 'list_backups');
      expect(tool?.found).toBe(true);
    });

    it('create_backup is defined', () => {
      const tool = tools.find(t => t.name === 'create_backup');
      expect(tool?.found).toBe(true);
    });

    it('restore_backup is defined', () => {
      const tool = tools.find(t => t.name === 'restore_backup');
      expect(tool?.found).toBe(true);
    });

    it('delete_backup is defined', () => {
      const tool = tools.find(t => t.name === 'delete_backup');
      expect(tool?.found).toBe(true);
    });

    it('download_backup is defined', () => {
      const tool = tools.find(t => t.name === 'download_backup');
      expect(tool?.found).toBe(true);
    });

    it('edit_backup_note is defined', () => {
      const tool = tools.find(t => t.name === 'edit_backup_note');
      expect(tool?.found).toBe(true);
    });
  });

  describe('Phase 10 Tool Count', () => {
    it('adds 7 new backup tools', () => {
      const phase10Tools = tools.filter(t => t.found);
      expect(phase10Tools.length).toBe(7);
    });
  });
});

describe('Phase 10 stdio script structure', () => {
  const scriptPath = path.join(__dirname, '..', 'bin', 'mcp-stdio.js');
  const content = fs.readFileSync(scriptPath, 'utf-8');

  describe('backup_status tool', () => {
    it('has no required parameters', () => {
      expect(content).toMatch(/name: 'backup_status'[\s\S]*?properties: \{\}/);
    });
  });

  describe('list_backups tool', () => {
    it('requires site and provider parameters', () => {
      expect(content).toMatch(/name: 'list_backups'[\s\S]*?required: \['site', 'provider'\]/);
    });
  });

  describe('create_backup tool', () => {
    it('requires site and provider parameters', () => {
      expect(content).toMatch(/name: 'create_backup'[\s\S]*?required: \['site', 'provider'\]/);
    });

    it('has optional note parameter', () => {
      expect(content).toMatch(/name: 'create_backup'[\s\S]*?note:[\s\S]*?description:/);
    });
  });

  describe('restore_backup tool', () => {
    it('requires confirm parameter', () => {
      expect(content).toMatch(/name: 'restore_backup'[\s\S]*?required:[\s\S]*?'confirm'/);
    });

    it('requires snapshot_id parameter', () => {
      expect(content).toMatch(/name: 'restore_backup'[\s\S]*?required:[\s\S]*?'snapshot_id'/);
    });
  });

  describe('delete_backup tool', () => {
    it('requires confirm parameter', () => {
      expect(content).toMatch(/name: 'delete_backup'[\s\S]*?required:[\s\S]*?'confirm'/);
    });
  });

  describe('download_backup tool', () => {
    it('requires site, provider, and snapshot_id parameters', () => {
      expect(content).toMatch(/name: 'download_backup'[\s\S]*?required: \['site', 'provider', 'snapshot_id'\]/);
    });
  });

  describe('edit_backup_note tool', () => {
    it('requires note parameter', () => {
      expect(content).toMatch(/name: 'edit_backup_note'[\s\S]*?required:[\s\S]*?'note'/);
    });
  });
});

describe('Phase 10 handler cases', () => {
  const scriptPath = path.join(__dirname, '..', 'bin', 'mcp-stdio.js');
  const content = fs.readFileSync(scriptPath, 'utf-8');

  it('has backup_status case handler', () => {
    expect(content).toMatch(/case 'backup_status':/);
  });

  it('has list_backups case handler', () => {
    expect(content).toMatch(/case 'list_backups':/);
  });

  it('has create_backup case handler', () => {
    expect(content).toMatch(/case 'create_backup':/);
  });

  it('has restore_backup case handler', () => {
    expect(content).toMatch(/case 'restore_backup':/);
  });

  it('has delete_backup case handler', () => {
    expect(content).toMatch(/case 'delete_backup':/);
  });

  it('has download_backup case handler', () => {
    expect(content).toMatch(/case 'download_backup':/);
  });

  it('has edit_backup_note case handler', () => {
    expect(content).toMatch(/case 'edit_backup_note':/);
  });
});
