/**
 * MCP Tools Registry
 * Central registry for all available MCP tools
 */

import { McpToolDefinition, McpToolResult, LocalServices } from '../../../common/types';
import { listSites, listSitesDefinition } from './listSites';
import { startSite, startSiteDefinition } from './startSite';
import { stopSite, stopSiteDefinition } from './stopSite';
import { restartSite, restartSiteDefinition } from './restartSite';
import { wpCli, wpCliDefinition } from './wpCli';
import { getSite, getSiteDefinition } from './getSite';
import { createSite, createSiteDefinition } from './createSite';
import { deleteSite, deleteSiteDefinition } from './deleteSite';
import { getLocalInfo, getLocalInfoDefinition } from './getLocalInfo';
import { openSite, openSiteDefinition } from './openSite';
import { cloneSite, cloneSiteDefinition } from './cloneSite';
import { exportSite, exportSiteDefinition } from './exportSite';
import { listBlueprints, listBlueprintsDefinition } from './listBlueprints';
import { saveBlueprint, saveBlueprintDefinition } from './saveBlueprint';
// Phase 8: WordPress Development Tools
import { exportDatabase, exportDatabaseDefinition } from './exportDatabase';
import { importDatabase, importDatabaseDefinition } from './importDatabase';
import { openAdminer, openAdminerDefinition } from './openAdminer';
import { trustSsl, trustSslDefinition } from './trustSsl';
import { renameSite, renameSiteDefinition } from './renameSite';
import { changePhpVersion, changePhpVersionDefinition } from './changePhpVersion';
import { importSite, importSiteDefinition } from './importSite';
// Phase 9: Site Configuration & Dev Tools
import { toggleXdebug, toggleXdebugDefinition } from './toggleXdebug';
import { getSiteLogs, getSiteLogsDefinition } from './getSiteLogs';
import { listServices, listServicesDefinition } from './listServices';

export type ToolHandler = (
  args: Record<string, unknown>,
  services: LocalServices
) => Promise<McpToolResult>;

interface ToolRegistration {
  definition: McpToolDefinition;
  handler: ToolHandler;
}

const tools: Map<string, ToolRegistration> = new Map();

/**
 * Register all available tools
 */
export function registerTools(): void {
  // Core site management
  tools.set('list_sites', { definition: listSitesDefinition, handler: listSites });
  tools.set('get_site', { definition: getSiteDefinition, handler: getSite });
  tools.set('start_site', { definition: startSiteDefinition, handler: startSite });
  tools.set('stop_site', { definition: stopSiteDefinition, handler: stopSite });
  tools.set('restart_site', { definition: restartSiteDefinition, handler: restartSite });

  // Site operations
  tools.set('create_site', { definition: createSiteDefinition, handler: createSite });
  tools.set('delete_site', { definition: deleteSiteDefinition, handler: deleteSite });
  tools.set('clone_site', { definition: cloneSiteDefinition, handler: cloneSite });
  tools.set('export_site', { definition: exportSiteDefinition, handler: exportSite });
  tools.set('open_site', { definition: openSiteDefinition, handler: openSite });

  // WordPress CLI
  tools.set('wp_cli', { definition: wpCliDefinition, handler: wpCli });

  // Blueprints
  tools.set('list_blueprints', { definition: listBlueprintsDefinition, handler: listBlueprints });
  tools.set('save_blueprint', { definition: saveBlueprintDefinition, handler: saveBlueprint });

  // System info
  tools.set('get_local_info', { definition: getLocalInfoDefinition, handler: getLocalInfo });

  // Phase 8: WordPress Development Tools
  tools.set('export_database', { definition: exportDatabaseDefinition, handler: exportDatabase });
  tools.set('import_database', { definition: importDatabaseDefinition, handler: importDatabase });
  tools.set('open_adminer', { definition: openAdminerDefinition, handler: openAdminer });
  tools.set('trust_ssl', { definition: trustSslDefinition, handler: trustSsl });
  tools.set('rename_site', { definition: renameSiteDefinition, handler: renameSite });
  tools.set('change_php_version', {
    definition: changePhpVersionDefinition,
    handler: changePhpVersion,
  });
  tools.set('import_site', { definition: importSiteDefinition, handler: importSite });

  // Phase 9: Site Configuration & Dev Tools
  tools.set('toggle_xdebug', { definition: toggleXdebugDefinition, handler: toggleXdebug });
  tools.set('get_site_logs', { definition: getSiteLogsDefinition, handler: getSiteLogs });
  tools.set('list_services', { definition: listServicesDefinition, handler: listServices });
}

/**
 * Get all tool definitions (for MCP tools/list response)
 */
export function getToolDefinitions(): McpToolDefinition[] {
  return Array.from(tools.values()).map((t) => t.definition);
}

/**
 * Get tool names
 */
export function getToolNames(): string[] {
  return Array.from(tools.keys());
}

/**
 * Execute a tool by name
 */
export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  services: LocalServices
): Promise<McpToolResult> {
  const tool = tools.get(name);

  if (!tool) {
    return {
      content: [{ type: 'text', text: `Unknown tool: ${name}` }],
      isError: true,
    };
  }

  try {
    return await tool.handler(args, services);
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: `Tool error: ${error.message}` }],
      isError: true,
    };
  }
}

/**
 * Check if a tool exists
 */
export function hasTool(name: string): boolean {
  return tools.has(name);
}
