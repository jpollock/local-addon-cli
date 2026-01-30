/**
 * open_site Tool
 * Open a WordPress site in the default browser
 */

import { McpToolDefinition, McpToolResult, LocalServices } from '../../../common/types';
import { findSite } from './helpers';

export const openSiteDefinition: McpToolDefinition = {
  name: 'open_site',
  description: 'Open a WordPress site in the default browser',
  inputSchema: {
    type: 'object',
    properties: {
      site: {
        type: 'string',
        description: 'Site name or ID',
      },
      path: {
        type: 'string',
        description: 'Path to open (default: /, use /wp-admin for admin panel)',
      },
    },
    required: ['site'],
  },
};

interface OpenSiteArgs {
  site: string;
  path?: string;
}

export async function openSite(
  args: Record<string, unknown>,
  services: LocalServices
): Promise<McpToolResult> {
  const { site: siteQuery, path = '/' } = args as unknown as OpenSiteArgs;

  if (!siteQuery) {
    return {
      content: [{ type: 'text', text: 'Error: site parameter is required' }],
      isError: true,
    };
  }

  try {
    const site = findSite(siteQuery, services.siteData);

    if (!site) {
      const allSites = services.siteData.getSites();
      const siteNames = allSites.map((s: any) => s.name).join(', ');
      return {
        content: [
          {
            type: 'text',
            text: `Site not found: "${siteQuery}". Available sites: ${siteNames || 'none'}`,
          },
        ],
        isError: true,
      };
    }

    // Get the site URL
    const domain = site.domain || `${site.name}.local`;
    const protocol = site.services?.nginx?.https === 'on' ? 'https' : 'http';
    const url = `${protocol}://${domain}${path}`;

    // Use the browser manager to open the URL
    if (services.browserManager) {
      await services.browserManager.openURL(url);
    } else {
      // Fallback to shell open
      const { shell } = require('electron');
      await shell.openExternal(url);
    }

    return {
      content: [{ type: 'text', text: `Opened ${url} in browser` }],
    };
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: `Failed to open site: ${error.message}` }],
      isError: true,
    };
  }
}
