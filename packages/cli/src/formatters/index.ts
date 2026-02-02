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
  size?: string;
  sizeBytes?: number;
}

export function formatSiteList(
  sites: SiteInfo[],
  format: OutputFormat,
  options: { noColor?: boolean; showSize?: boolean } = {}
): string {
  const hasSize = options.showSize && sites.some((s) => s.size);

  switch (format) {
    case 'json':
      // Include size fields in JSON when showSize is true
      if (hasSize) {
        return formatJson(
          sites.map((s) => ({
            ...s,
            size: s.size,
            sizeBytes: s.sizeBytes,
          }))
        );
      }
      return formatJson(sites);

    case 'quiet':
      return formatQuiet(sites.map((s) => s.name));

    case 'table':
    default:
      if (sites.length === 0) {
        return 'No sites found.';
      }

      if (hasSize) {
        // Calculate total size
        const totalBytes = sites.reduce((acc, s) => acc + (s.sizeBytes || 0), 0);
        const totalFormatted = formatBytesSimple(totalBytes);

        const table = formatTable(
          ['Name', 'Domain', 'Status', 'Size'],
          sites.map((s) => [
            s.name,
            s.domain,
            formatStatus(s.status, options),
            s.size || '?',
          ]),
          options
        );

        return `${table}\n\nTotal: ${sites.length} site(s), ${totalFormatted}`;
      }

      return formatTable(
        ['Name', 'Domain', 'Status'],
        sites.map((s) => [s.name, s.domain, formatStatus(s.status, options)]),
        options
      );
  }
}

/**
 * Simple byte formatter for totals
 */
function formatBytesSimple(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '?';
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  const precision = i >= 3 ? 2 : i >= 2 ? 1 : 0;

  return `${value.toFixed(precision)} ${units[i]}`;
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
