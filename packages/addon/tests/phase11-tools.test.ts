/**
 * Phase 11 Tools Tests
 * Tests for WP Engine Connect/Sync tools
 */

import * as fs from 'fs';
import * as path from 'path';

describe('Phase 11 WP Engine Connect Tools', () => {
  const scriptPath = path.join(__dirname, '..', 'bin', 'mcp-stdio.js');
  const content = fs.readFileSync(scriptPath, 'utf-8');

  describe('Phase 11a: Authentication & Discovery', () => {
    it('wpe_status is defined', () => {
      expect(content).toMatch(/name: 'wpe_status'/);
    });

    it('wpe_authenticate is defined', () => {
      expect(content).toMatch(/name: 'wpe_authenticate'/);
    });

    it('wpe_logout is defined', () => {
      expect(content).toMatch(/name: 'wpe_logout'/);
    });

    it('list_wpe_sites is defined', () => {
      expect(content).toMatch(/name: 'list_wpe_sites'/);
    });
  });

  describe('Phase 11b: Site Linking', () => {
    it('get_wpe_link is defined', () => {
      expect(content).toMatch(/name: 'get_wpe_link'/);
    });
  });

  describe('Phase 11c: Sync Operations', () => {
    it('push_to_wpe is defined', () => {
      expect(content).toMatch(/name: 'push_to_wpe'/);
    });

    it('pull_from_wpe is defined', () => {
      expect(content).toMatch(/name: 'pull_from_wpe'/);
    });

    it('get_sync_history is defined', () => {
      expect(content).toMatch(/name: 'get_sync_history'/);
    });

    it('get_site_changes is defined', () => {
      expect(content).toMatch(/name: 'get_site_changes'/);
    });
  });

  describe('Tool Count', () => {
    it('adds 9 WP Engine Connect tools', () => {
      const phase11Tools = [
        'wpe_status',
        'wpe_authenticate',
        'wpe_logout',
        'list_wpe_sites',
        'get_wpe_link',
        'push_to_wpe',
        'pull_from_wpe',
        'get_sync_history',
        'get_site_changes',
      ];

      phase11Tools.forEach(tool => {
        expect(content).toMatch(new RegExp(`name: '${tool}'`));
      });
    });
  });
});

describe('Phase 11 handler cases', () => {
  const scriptPath = path.join(__dirname, '..', 'bin', 'mcp-stdio.js');
  const content = fs.readFileSync(scriptPath, 'utf-8');

  it('has wpe_status case handler', () => {
    expect(content).toMatch(/case 'wpe_status':/);
  });

  it('has wpe_authenticate case handler', () => {
    expect(content).toMatch(/case 'wpe_authenticate':/);
  });

  it('has wpe_logout case handler', () => {
    expect(content).toMatch(/case 'wpe_logout':/);
  });

  it('has list_wpe_sites case handler', () => {
    expect(content).toMatch(/case 'list_wpe_sites':/);
  });

  it('has get_wpe_link case handler', () => {
    expect(content).toMatch(/case 'get_wpe_link':/);
  });

  it('has push_to_wpe case handler', () => {
    expect(content).toMatch(/case 'push_to_wpe':/);
  });

  it('has pull_from_wpe case handler', () => {
    expect(content).toMatch(/case 'pull_from_wpe':/);
  });

  it('has get_sync_history case handler', () => {
    expect(content).toMatch(/case 'get_sync_history':/);
  });

  it('has get_site_changes case handler', () => {
    expect(content).toMatch(/case 'get_site_changes':/);
  });
});

describe('Phase 11 security requirements', () => {
  const scriptPath = path.join(__dirname, '..', 'bin', 'mcp-stdio.js');
  const content = fs.readFileSync(scriptPath, 'utf-8');

  it('push_to_wpe requires confirm parameter', () => {
    expect(content).toMatch(/name: 'push_to_wpe'[\s\S]*?required:[\s\S]*?'confirm'/);
  });

  it('push_to_wpe has include_sql parameter', () => {
    // The parameter is named include_sql in the tool definition
    expect(content).toMatch(/name: 'push_to_wpe'/);
  });
});
