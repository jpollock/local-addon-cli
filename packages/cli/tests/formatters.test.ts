/**
 * Formatters Tests
 */

import {
  getOutputFormat,
  formatTable,
  formatJson,
  formatQuiet,
  formatSuccess,
  formatError,
  formatWarning,
  formatStatus,
  formatSiteList,
  formatSiteDetail,
  SiteInfo,
} from '../src/formatters';

describe('formatters', () => {
  describe('getOutputFormat', () => {
    it('returns json when json option is true', () => {
      expect(getOutputFormat({ json: true })).toBe('json');
    });

    it('returns quiet when quiet option is true', () => {
      expect(getOutputFormat({ quiet: true })).toBe('quiet');
    });

    it('returns table by default', () => {
      expect(getOutputFormat({})).toBe('table');
    });

    it('prefers json over quiet when both are set', () => {
      expect(getOutputFormat({ json: true, quiet: true })).toBe('json');
    });
  });

  describe('formatJson', () => {
    it('formats object as pretty JSON', () => {
      const result = formatJson({ name: 'test', count: 42 });
      expect(result).toBe('{\n  "name": "test",\n  "count": 42\n}');
    });

    it('formats array as pretty JSON', () => {
      const result = formatJson([1, 2, 3]);
      expect(result).toBe('[\n  1,\n  2,\n  3\n]');
    });
  });

  describe('formatQuiet', () => {
    it('joins items with newlines', () => {
      const result = formatQuiet(['site-1', 'site-2', 'site-3']);
      expect(result).toBe('site-1\nsite-2\nsite-3');
    });

    it('returns empty string for empty array', () => {
      expect(formatQuiet([])).toBe('');
    });
  });

  describe('formatSuccess', () => {
    it('includes checkmark', () => {
      const result = formatSuccess('Operation completed');
      expect(result).toContain('✓');
      expect(result).toContain('Operation completed');
    });

    it('works with noColor option', () => {
      const result = formatSuccess('Done', { noColor: true });
      expect(result).toBe('✓ Done');
    });
  });

  describe('formatError', () => {
    it('includes cross mark', () => {
      const result = formatError('Something failed');
      expect(result).toContain('✗');
      expect(result).toContain('Something failed');
    });

    it('works with noColor option', () => {
      const result = formatError('Failed', { noColor: true });
      expect(result).toBe('✗ Failed');
    });
  });

  describe('formatWarning', () => {
    it('includes warning symbol', () => {
      const result = formatWarning('Be careful');
      expect(result).toContain('⚠');
      expect(result).toContain('Be careful');
    });

    it('works with noColor option', () => {
      const result = formatWarning('Warning', { noColor: true });
      expect(result).toBe('⚠ Warning');
    });
  });

  describe('formatStatus', () => {
    it('formats running status', () => {
      const result = formatStatus('running', { noColor: true });
      expect(result).toBe('running');
    });

    it('formats stopped status', () => {
      const result = formatStatus('stopped', { noColor: true });
      expect(result).toBe('stopped');
    });

    it('formats error status', () => {
      const result = formatStatus('error', { noColor: true });
      expect(result).toBe('error');
    });

    it('passes through unknown status', () => {
      const result = formatStatus('unknown', { noColor: true });
      expect(result).toBe('unknown');
    });
  });

  describe('formatTable', () => {
    it('creates a table with headers and rows', () => {
      const result = formatTable(['Col1', 'Col2'], [['a', 'b'], ['c', 'd']], { noColor: true });
      expect(result).toContain('Col1');
      expect(result).toContain('Col2');
      expect(result).toContain('a');
      expect(result).toContain('b');
    });
  });

  describe('formatSiteList', () => {
    const sites: SiteInfo[] = [
      { id: '1', name: 'site-one', domain: 'site-one.local', status: 'running' },
      { id: '2', name: 'site-two', domain: 'site-two.local', status: 'stopped' },
    ];

    it('formats as JSON when format is json', () => {
      const result = formatSiteList(sites, 'json');
      const parsed = JSON.parse(result);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].name).toBe('site-one');
    });

    it('formats as quiet list when format is quiet', () => {
      const result = formatSiteList(sites, 'quiet');
      expect(result).toBe('site-one\nsite-two');
    });

    it('formats as table when format is table', () => {
      const result = formatSiteList(sites, 'table', { noColor: true });
      expect(result).toContain('Name');
      expect(result).toContain('Domain');
      expect(result).toContain('Status');
      expect(result).toContain('site-one');
      expect(result).toContain('site-one.local');
    });

    it('returns "No sites found." for empty list', () => {
      const result = formatSiteList([], 'table');
      expect(result).toBe('No sites found.');
    });
  });

  describe('formatSiteDetail', () => {
    const site = {
      id: 'site-123',
      name: 'my-site',
      status: 'running',
      services: [{ name: 'php', version: '8.2' }],
    };

    it('formats as JSON when format is json', () => {
      const result = formatSiteDetail(site, 'json');
      const parsed = JSON.parse(result);
      expect(parsed.name).toBe('my-site');
      expect(parsed.services).toHaveLength(1);
    });

    it('formats as quiet (name only) when format is quiet', () => {
      const result = formatSiteDetail(site, 'quiet');
      expect(result).toBe('my-site');
    });

    it('falls back to id if name is missing', () => {
      const result = formatSiteDetail({ id: 'site-id' }, 'quiet');
      expect(result).toBe('site-id');
    });

    it('formats as table when format is table', () => {
      const result = formatSiteDetail(site, 'table', { noColor: true });
      expect(result).toContain('Property');
      expect(result).toContain('Value');
      expect(result).toContain('id');
      expect(result).toContain('site-123');
      expect(result).toContain('name');
      expect(result).toContain('my-site');
    });

    it('stringifies nested objects in table', () => {
      const result = formatSiteDetail(site, 'table', { noColor: true });
      expect(result).toContain('services');
      expect(result).toContain('php');
    });
  });
});
