/**
 * change_php_version Tool
 * Change PHP version for a site
 */

import { McpToolDefinition, McpToolResult, LocalServices } from '../../../common/types';
import { validateRequiredParam, findSiteOrError } from './helpers';

export const changePhpVersionDefinition: McpToolDefinition = {
  name: 'change_php_version',
  description: 'Change the PHP version for a site',
  inputSchema: {
    type: 'object',
    properties: {
      site: {
        type: 'string',
        description: 'Site name or ID',
      },
      phpVersion: {
        type: 'string',
        description: 'Target PHP version (e.g., "8.2.10", "8.1.27", "7.4.33")',
      },
    },
    required: ['site', 'phpVersion'],
  },
};

interface ChangePhpVersionArgs {
  site: string;
  phpVersion: string;
}

export async function changePhpVersion(
  args: Record<string, unknown>,
  services: LocalServices
): Promise<McpToolResult> {
  const { site: siteQuery, phpVersion } = args as unknown as ChangePhpVersionArgs;

  const siteError = validateRequiredParam(siteQuery, 'site');
  if (siteError) return siteError;

  const phpError = validateRequiredParam(phpVersion, 'phpVersion');
  if (phpError) return phpError;

  const siteResult = findSiteOrError(siteQuery, services.siteData);
  if ('error' in siteResult) return siteResult.error;
  const { site } = siteResult;

  try {
    // Check if siteProvisioner service exists
    if (!services.siteProvisioner) {
      return {
        content: [{ type: 'text', text: 'Site provisioner service not available' }],
        isError: true,
      };
    }

    // Get current PHP version for messaging
    const currentPhp =
      typeof site.phpVersion === 'object' ? site.phpVersion?.version : site.phpVersion;

    // Change PHP version using siteProvisioner.swapService
    // The service name is 'php' and role is 'php'
    await services.siteProvisioner.swapService(site, 'php', 'php', phpVersion, true);

    return {
      content: [
        {
          type: 'text',
          text: `Successfully changed PHP version for "${site.name}" from ${currentPhp || 'unknown'} to ${phpVersion}. Site services have been restarted.`,
        },
      ],
    };
  } catch (error: any) {
    // Provide helpful error message for version not found
    if (error.message?.includes('not found') || error.message?.includes('not available')) {
      return {
        content: [
          {
            type: 'text',
            text: `PHP version "${phpVersion}" not available. Use get_local_info to see available versions, or check Local preferences for installed PHP versions.`,
          },
        ],
        isError: true,
      };
    }
    return {
      content: [{ type: 'text', text: `Failed to change PHP version: ${error.message}` }],
      isError: true,
    };
  }
}
