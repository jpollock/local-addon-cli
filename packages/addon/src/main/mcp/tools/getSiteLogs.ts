/**
 * get_site_logs Tool
 * Retrieve log files for a site
 */

import { McpToolDefinition, McpToolResult, LocalServices } from '../../../common/types';
import { validateRequiredParam, findSiteOrError } from './helpers';
import * as fs from 'fs';
import * as path from 'path';

export const getSiteLogsDefinition: McpToolDefinition = {
  name: 'get_site_logs',
  description: 'Get log file contents for a site (PHP errors, access logs, etc.)',
  inputSchema: {
    type: 'object',
    properties: {
      site: {
        type: 'string',
        description: 'Site name or ID',
      },
      logType: {
        type: 'string',
        enum: ['php', 'nginx', 'mysql', 'all'],
        description: 'Type of logs to retrieve (default: php)',
      },
      lines: {
        type: 'number',
        description: 'Number of lines to return from end of log (default: 100)',
      },
    },
    required: ['site'],
  },
};

interface GetSiteLogsArgs {
  site: string;
  logType?: 'php' | 'nginx' | 'mysql' | 'all';
  lines?: number;
}

function readLastLines(filePath: string, numLines: number): string {
  try {
    if (!fs.existsSync(filePath)) {
      return `[Log file not found: ${path.basename(filePath)}]`;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const lastLines = lines.slice(-numLines).join('\n');
    return lastLines || '[Log file is empty]';
  } catch (error: any) {
    return `[Error reading log: ${error.message}]`;
  }
}

function findLogFiles(logsDir: string, serviceType: string): string[] {
  const servicePath = path.join(logsDir, serviceType);
  const logFiles: string[] = [];

  try {
    if (fs.existsSync(servicePath) && fs.statSync(servicePath).isDirectory()) {
      const files = fs.readdirSync(servicePath);
      for (const file of files) {
        if (file.endsWith('.log')) {
          logFiles.push(path.join(servicePath, file));
        }
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }

  return logFiles;
}

export async function getSiteLogs(
  args: Record<string, unknown>,
  services: LocalServices
): Promise<McpToolResult> {
  const { site: siteQuery, logType = 'php', lines = 100 } = args as unknown as GetSiteLogsArgs;

  const paramError = validateRequiredParam(siteQuery, 'site');
  if (paramError) return paramError;

  const siteResult = findSiteOrError(siteQuery, services.siteData);
  if ('error' in siteResult) return siteResult.error;
  const { site } = siteResult;

  try {
    // Get logs directory from site paths
    const logsDir = site.paths?.logs || path.join(site.path, 'logs');

    if (!fs.existsSync(logsDir)) {
      return {
        content: [{ type: 'text', text: `Logs directory not found: ${logsDir}` }],
        isError: true,
      };
    }

    const results: string[] = [];
    const numLines = Math.min(Math.max(lines, 10), 1000); // Clamp between 10 and 1000

    const serviceTypes = logType === 'all' ? ['php', 'nginx', 'mysql'] : [logType];

    for (const serviceType of serviceTypes) {
      const logFiles = findLogFiles(logsDir, serviceType);

      if (logFiles.length === 0) {
        results.push(`=== ${serviceType.toUpperCase()} ===\n[No log files found]`);
        continue;
      }

      for (const logFile of logFiles) {
        const fileName = path.basename(logFile);
        const content = readLastLines(logFile, numLines);
        results.push(`=== ${serviceType.toUpperCase()}: ${fileName} ===\n${content}`);
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: `Logs for "${site.name}" (last ${numLines} lines):\n\n${results.join('\n\n')}`,
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: `Failed to get site logs: ${error.message}` }],
      isError: true,
    };
  }
}
