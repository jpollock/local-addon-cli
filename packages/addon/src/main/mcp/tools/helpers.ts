/**
 * Tool Helper Functions
 */

import * as path from 'path';
import * as os from 'os';

/**
 * Blocked WP-CLI commands that could allow arbitrary code execution
 */
export const BLOCKED_WP_COMMANDS = [
  'eval', // Execute arbitrary PHP code
  'eval-file', // Execute PHP from file
  'shell', // Interactive PHP shell
  'db query', // Raw SQL execution
  'db cli', // MySQL CLI access
];

/**
 * Check if a WP-CLI command is blocked for security reasons
 * Returns the blocked command name if blocked, null if safe
 */
export function isBlockedWpCommand(command: string[]): string | null {
  const commandStr = command.join(' ').toLowerCase();
  for (const blocked of BLOCKED_WP_COMMANDS) {
    if (commandStr.includes(blocked)) {
      return blocked;
    }
  }
  return null;
}

/**
 * Validate that a file path is safe (no path traversal)
 * Returns true if the path is within allowed directories
 */
export function isValidFilePath(filePath: string, allowedDirs?: string[]): boolean {
  // Resolve to absolute path
  const resolvedPath = path.resolve(filePath);

  // Default allowed directories: home, tmp, and common paths
  const homeDir = os.homedir();
  const defaultAllowed = [homeDir, os.tmpdir(), '/tmp', '/var/tmp'];

  const allowedDirectories = allowedDirs || defaultAllowed;

  // Check if path is within any allowed directory
  for (const allowedDir of allowedDirectories) {
    const resolvedAllowed = path.resolve(allowedDir);
    if (resolvedPath.startsWith(resolvedAllowed + path.sep) || resolvedPath === resolvedAllowed) {
      return true;
    }
  }

  return false;
}

/**
 * Validate that a SQL file path is safe
 * Must end in .sql and be in an allowed directory
 */
export function isValidSqlPath(sqlPath: unknown): boolean {
  if (typeof sqlPath !== 'string' || !sqlPath) {
    return false;
  }

  // Must end in .sql
  if (!sqlPath.toLowerCase().endsWith('.sql')) {
    return false;
  }

  // Must be in an allowed directory
  return isValidFilePath(sqlPath);
}

/**
 * MCP Tool Result type for error responses
 */
export interface McpErrorResult {
  content: Array<{ type: 'text'; text: string }>;
  isError: true;
}

/**
 * Create a standardized error result for MCP tools
 */
export function createErrorResult(message: string): McpErrorResult {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}

/**
 * Validate that a required parameter is present
 * Returns an error result if missing, null if valid
 */
export function validateRequiredParam(value: unknown, paramName: string): McpErrorResult | null {
  if (!value) {
    return createErrorResult(`Error: ${paramName} parameter is required`);
  }
  return null;
}

/**
 * Find a site by name or ID
 * Supports partial name matching (case-insensitive)
 */
export function findSite(query: string, siteData: any): any | undefined {
  const sitesMap = siteData.getSites();
  const sites = Object.values(sitesMap) as any[];

  // Try exact ID match first
  const byId = sites.find((s: any) => s.id === query);
  if (byId) return byId;

  // Try exact name match (case-insensitive)
  const byExactName = sites.find((s: any) => s.name.toLowerCase() === query.toLowerCase());
  if (byExactName) return byExactName;

  // Try partial name match (case-insensitive)
  const byPartialName = sites.find((s: any) => s.name.toLowerCase().includes(query.toLowerCase()));
  if (byPartialName) return byPartialName;

  // Try domain match
  const byDomain = sites.find((s: any) => s.domain?.toLowerCase() === query.toLowerCase());
  if (byDomain) return byDomain;

  return undefined;
}

/**
 * Get all site names as a comma-separated string
 */
export function getAllSiteNames(siteData: any): string {
  const sitesMap = siteData.getSites();
  const sites = Object.values(sitesMap) as any[];
  return sites.map((s: any) => s.name).join(', ') || 'none';
}

/**
 * Find a site or return an error result
 * Combines site lookup with standardized error handling
 */
export function findSiteOrError(
  query: string,
  siteData: any
): { site: any } | { error: McpErrorResult } {
  const site = findSite(query, siteData);
  if (!site) {
    const siteNames = getAllSiteNames(siteData);
    return {
      error: createErrorResult(`Site not found: "${query}". Available sites: ${siteNames}`),
    };
  }
  return { site };
}
