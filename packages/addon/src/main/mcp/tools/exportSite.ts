/**
 * export_site Tool
 * Export a WordPress site to a zip file
 */

import { McpToolDefinition, McpToolResult, LocalServices } from '../../../common/types';
import { findSite } from './helpers';
import * as os from 'os';
import * as path from 'path';

export const exportSiteDefinition: McpToolDefinition = {
  name: 'export_site',
  description: 'Export a WordPress site to a zip file',
  inputSchema: {
    type: 'object',
    properties: {
      site: {
        type: 'string',
        description: 'Site name or ID to export',
      },
      output_path: {
        type: 'string',
        description: 'Output directory path (default: ~/Downloads)',
      },
    },
    required: ['site'],
  },
};

interface ExportSiteArgs {
  site: string;
  output_path?: string;
}

export async function exportSite(
  args: Record<string, unknown>,
  services: LocalServices
): Promise<McpToolResult> {
  const { site: siteQuery, output_path } = args as unknown as ExportSiteArgs;

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

    // Check if exportSite service exists
    if (!services.exportSite) {
      return {
        content: [{ type: 'text', text: 'Export site service not available' }],
        isError: true,
      };
    }

    // Default output path to Downloads folder
    const outputDir = output_path || path.join(os.homedir(), 'Downloads');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `${site.name}-${timestamp}.zip`;
    const outputPath = path.join(outputDir, filename);

    // Export the site
    await services.exportSite(site, outputPath);

    return {
      content: [
        {
          type: 'text',
          text: `Successfully exported "${site.name}" to ${outputPath}`,
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: `Failed to export site: ${error.message}` }],
      isError: true,
    };
  }
}
