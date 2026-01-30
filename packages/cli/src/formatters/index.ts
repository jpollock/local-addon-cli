/**
 * Output Formatters
 *
 * Format command output for different modes:
 * - table: Human-readable ASCII tables (default)
 * - json: JSON output for scripting
 * - quiet: Minimal output (IDs/names only)
 */

import Table from 'cli-table3';
import chalk from 'chalk';

export type OutputFormat = 'table' | 'json' | 'quiet';

export interface FormatterOptions {
  json?: boolean;
  quiet?: boolean;
  noColor?: boolean;
}

/**
 * Get the output format from CLI options
 */
export function getOutputFormat(options: FormatterOptions): OutputFormat {
  if (options.json) return 'json';
  if (options.quiet) return 'quiet';
  return 'table';
}

/**
 * Format data as a table
 */
export function formatTable(
  headers: string[],
  rows: string[][],
  options: { noColor?: boolean } = {}
): string {
  const table = new Table({
    head: options.noColor ? headers : headers.map((h) => chalk.bold(h)),
    style: {
      head: options.noColor ? [] : ['cyan'],
      border: options.noColor ? [] : ['grey'],
    },
  });

  rows.forEach((row) => table.push(row));

  return table.toString();
}

/**
 * Format data as JSON
 */
export function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Format data as quiet output (one item per line)
 */
export function formatQuiet(items: string[]): string {
  return items.join('\n');
}

/**
 * Format a success message
 */
export function formatSuccess(message: string, options: { noColor?: boolean } = {}): string {
  if (options.noColor) {
    return `✓ ${message}`;
  }
  return chalk.green(`✓ ${message}`);
}

/**
 * Format an error message
 */
export function formatError(message: string, options: { noColor?: boolean } = {}): string {
  if (options.noColor) {
    return `✗ ${message}`;
  }
  return chalk.red(`✗ ${message}`);
}

/**
 * Format a warning message
 */
export function formatWarning(message: string, options: { noColor?: boolean } = {}): string {
  if (options.noColor) {
    return `⚠ ${message}`;
  }
  return chalk.yellow(`⚠ ${message}`);
}

/**
 * Format a status badge
 */
export function formatStatus(
  status: 'running' | 'stopped' | 'error' | string,
  options: { noColor?: boolean } = {}
): string {
  if (options.noColor) {
    return status;
  }

  switch (status) {
    case 'running':
      return chalk.green(status);
    case 'stopped':
      return chalk.gray(status);
    case 'error':
      return chalk.red(status);
    default:
      return status;
  }
}

/**
 * Site formatter for list command
 */
export interface SiteInfo {
  id: string;
  name: string;
  domain: string;
  status: string;
  path?: string;
}

export function formatSiteList(
  sites: SiteInfo[],
  format: OutputFormat,
  options: { noColor?: boolean } = {}
): string {
  switch (format) {
    case 'json':
      return formatJson(sites);

    case 'quiet':
      return formatQuiet(sites.map((s) => s.name));

    case 'table':
    default:
      if (sites.length === 0) {
        return 'No sites found.';
      }

      return formatTable(
        ['Name', 'Domain', 'Status'],
        sites.map((s) => [s.name, s.domain, formatStatus(s.status, options)]),
        options
      );
  }
}

/**
 * Site detail formatter
 */
export function formatSiteDetail(
  site: Record<string, unknown>,
  format: OutputFormat,
  options: { noColor?: boolean } = {}
): string {
  switch (format) {
    case 'json':
      return formatJson(site);

    case 'quiet':
      return String(site.name || site.id);

    case 'table':
    default:
      const rows = Object.entries(site).map(([key, value]) => [
        key,
        typeof value === 'object' ? JSON.stringify(value) : String(value),
      ]);

      return formatTable(['Property', 'Value'], rows, options);
  }
}
