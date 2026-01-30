/**
 * save_blueprint Tool
 * Save a site as a blueprint
 */

import { McpToolDefinition, McpToolResult, LocalServices } from '../../../common/types';
import { findSite } from './helpers';

export const saveBlueprintDefinition: McpToolDefinition = {
  name: 'save_blueprint',
  description: 'Save a site as a blueprint (template) for creating new sites',
  inputSchema: {
    type: 'object',
    properties: {
      site: {
        type: 'string',
        description: 'Site name or ID to save as blueprint',
      },
      name: {
        type: 'string',
        description: 'Name for the blueprint',
      },
      description: {
        type: 'string',
        description: 'Optional description for the blueprint',
      },
    },
    required: ['site', 'name'],
  },
};

interface SaveBlueprintArgs {
  site: string;
  name: string;
  description?: string;
}

export async function saveBlueprint(
  args: Record<string, unknown>,
  services: LocalServices
): Promise<McpToolResult> {
  const { site: siteQuery, name, description } = args as unknown as SaveBlueprintArgs;

  if (!siteQuery) {
    return {
      content: [{ type: 'text', text: 'Error: site parameter is required' }],
      isError: true,
    };
  }

  if (!name) {
    return {
      content: [{ type: 'text', text: 'Error: name parameter is required' }],
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

    // Check if blueprints service exists
    if (!services.blueprints) {
      return {
        content: [{ type: 'text', text: 'Blueprints service not available' }],
        isError: true,
      };
    }

    // Save the blueprint
    const blueprint = await services.blueprints.saveBlueprint(site, {
      name,
      description: description || '',
    });

    return {
      content: [
        {
          type: 'text',
          text: `Successfully saved blueprint "${name}" from site "${site.name}" (ID: ${blueprint.id})`,
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: `Failed to save blueprint: ${error.message}` }],
      isError: true,
    };
  }
}
