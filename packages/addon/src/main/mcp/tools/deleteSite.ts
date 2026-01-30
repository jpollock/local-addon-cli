/**
 * delete_site Tool
 * Delete a WordPress site (requires confirmation)
 */

import { McpToolDefinition, McpToolResult, LocalServices } from '../../../common/types';
import { validateRequiredParam, findSiteOrError, createErrorResult } from './helpers';

export const deleteSiteDefinition: McpToolDefinition = {
  name: 'delete_site',
  description: 'Delete a WordPress site. Requires confirm=true to prevent accidental deletion.',
  inputSchema: {
    type: 'object',
    properties: {
      site: {
        type: 'string',
        description: 'Site name or ID (partial names work)',
      },
      confirm: {
        type: 'boolean',
        description: 'Must be true to confirm deletion. This is a safety measure.',
      },
      trashFiles: {
        type: 'boolean',
        description: 'Move site files to trash instead of permanent deletion (default: true)',
      },
    },
    required: ['site', 'confirm'],
  },
};

interface DeleteSiteArgs {
  site: string;
  confirm: boolean;
  trashFiles?: boolean;
}

export async function deleteSite(
  args: Record<string, unknown>,
  services: LocalServices
): Promise<McpToolResult> {
  const { site: siteQuery, confirm, trashFiles = true } = args as unknown as DeleteSiteArgs;

  const paramError = validateRequiredParam(siteQuery, 'site');
  if (paramError) return paramError;

  if (confirm !== true) {
    return createErrorResult(
      'Error: Deletion not confirmed. You must set confirm=true to delete a site. This is a safety measure to prevent accidental deletion.'
    );
  }

  const siteResult = findSiteOrError(siteQuery, services.siteData);
  if ('error' in siteResult) return siteResult.error;
  const { site } = siteResult;

  try {
    // Stop the site if it's running
    const currentStatus = await services.siteProcessManager.getSiteStatus(site);
    if (currentStatus === 'running') {
      await services.siteProcessManager.stop(site);
    }

    // Delete the site
    await services.deleteSite.deleteSite({
      site,
      trashFiles,
      updateHosts: true,
    });

    const result = {
      success: true,
      message: `Site "${site.name}" deleted successfully`,
      trashFiles,
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: `Failed to delete site: ${error.message}` }],
      isError: true,
    };
  }
}
