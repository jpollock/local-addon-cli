/**
 * wp_cli Tool
 * Run WP-CLI commands against a site
 */

import { McpToolDefinition, McpToolResult, LocalServices } from '../../../common/types';
import {
  validateRequiredParam,
  findSiteOrError,
  isBlockedWpCommand,
  createErrorResult,
} from './helpers';

export const wpCliDefinition: McpToolDefinition = {
  name: 'wp_cli',
  description: 'Run a WP-CLI command against a WordPress site. The site must be running.',
  inputSchema: {
    type: 'object',
    properties: {
      site: {
        type: 'string',
        description: 'Site name or ID (partial names work)',
      },
      command: {
        oneOf: [
          {
            type: 'array',
            items: { type: 'string' },
            description: 'WP-CLI command as array, e.g. ["plugin", "list", "--format=json"]',
          },
          {
            type: 'string',
            description: 'WP-CLI command as string, e.g. "plugin list --format=json"',
          },
        ],
        description: 'WP-CLI command - either as array ["plugin", "list"] or string "plugin list"',
      },
    },
    required: ['site', 'command'],
  },
};

interface WpCliArgs {
  site: string;
  command: string[] | string;
}

export async function wpCli(
  args: Record<string, unknown>,
  services: LocalServices
): Promise<McpToolResult> {
  const { site: siteQuery, command: rawCommand } = args as unknown as WpCliArgs;

  // Validate required parameters
  const siteError = validateRequiredParam(siteQuery, 'site');
  if (siteError) return siteError;

  const commandError = validateRequiredParam(rawCommand, 'command');
  if (commandError) return commandError;

  // Normalize command to array - accept both string and array formats
  let command: string[];
  if (typeof rawCommand === 'string') {
    // Split string on whitespace, preserving quoted strings would be complex
    // For simple cases, split on spaces
    command = rawCommand.trim().split(/\s+/).filter(Boolean);
  } else if (Array.isArray(rawCommand)) {
    command = rawCommand;
  } else {
    return {
      content: [
        {
          type: 'text',
          text: 'Error: command must be a string or array of strings',
        },
      ],
      isError: true,
    };
  }

  if (command.length === 0) {
    return createErrorResult('Error: command cannot be empty');
  }

  // Security: Check for blocked commands
  const blockedCommand = isBlockedWpCommand(command);
  if (blockedCommand) {
    return createErrorResult(
      `Error: Command "${blockedCommand}" is blocked for security reasons. This command could allow arbitrary code execution.`
    );
  }

  // Find site or return error
  const siteResult = findSiteOrError(siteQuery, services.siteData);
  if ('error' in siteResult) return siteResult.error;
  const { site } = siteResult;

  try {
    const currentStatus = await services.siteProcessManager.getSiteStatus(site);

    if (currentStatus !== 'running') {
      return {
        content: [
          {
            type: 'text',
            text: `Site "${site.name}" is not running. Start it first with the start_site tool.`,
          },
        ],
        isError: true,
      };
    }

    const output = await services.wpCli.run(site, command, {
      skipPlugins: true,
      skipThemes: true,
      ignoreErrors: false,
    });

    return {
      content: [{ type: 'text', text: output?.trim() || '(no output)' }],
    };
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: `WP-CLI error: ${error.message}` }],
      isError: true,
    };
  }
}
