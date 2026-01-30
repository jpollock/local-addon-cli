/**
 * get_local_info Tool
 * Get information about the Local application
 */

import os from 'os';
import { McpToolDefinition, McpToolResult, LocalServices } from '../../../common/types';
import { MCP_SERVER } from '../../../common/constants';
import { getToolNames } from './index';

export const getLocalInfoDefinition: McpToolDefinition = {
  name: 'get_local_info',
  description:
    'Get information about the Local application including version, platform, MCP server status, and available tools',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

export async function getLocalInfo(
  _args: Record<string, unknown>,
  services: LocalServices
): Promise<McpToolResult> {
  try {
    const sitesMap = services.siteData.getSites();
    const allSites = Object.values(sitesMap) as any[];

    // Count sites by status
    let runningSites = 0;
    let stoppedSites = 0;
    for (const site of allSites) {
      const status = await services.siteProcessManager.getSiteStatus(site);
      if (status === 'running') {
        runningSites++;
      } else {
        stoppedSites++;
      }
    }

    const info = {
      local: {
        version: process.env.LOCAL_VERSION || 'unknown',
        platform: os.platform(),
        arch: os.arch(),
      },
      mcp: {
        version: MCP_SERVER.VERSION,
        name: MCP_SERVER.NAME,
        tools: getToolNames(),
      },
      sites: {
        total: allSites.length,
        running: runningSites,
        stopped: stoppedSites,
      },
      system: {
        nodeVersion: process.version,
        hostname: os.hostname(),
        homeDir: os.homedir(),
      },
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(info, null, 2) }],
    };
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: `Failed to get Local info: ${error.message}` }],
      isError: true,
    };
  }
}
