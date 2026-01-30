/**
 * list_blueprints Tool
 * List all available site blueprints
 */

import { McpToolDefinition, McpToolResult, LocalServices } from '../../../common/types';

export const listBlueprintsDefinition: McpToolDefinition = {
  name: 'list_blueprints',
  description: 'List all available site blueprints (templates)',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

export async function listBlueprints(
  _args: Record<string, unknown>,
  services: LocalServices
): Promise<McpToolResult> {
  try {
    // Check if blueprints service exists
    if (!services.blueprints) {
      return {
        content: [{ type: 'text', text: 'Blueprints service not available' }],
        isError: true,
      };
    }

    const blueprints = await services.blueprints.getBlueprints();

    if (!blueprints || blueprints.length === 0) {
      return {
        content: [{ type: 'text', text: 'No blueprints found. Create one using save_blueprint.' }],
      };
    }

    const blueprintList = blueprints.map((bp: any) => ({
      id: bp.id,
      name: bp.name,
      description: bp.description || '',
      createdAt: bp.createdAt,
    }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(blueprintList, null, 2),
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: `Failed to list blueprints: ${error.message}` }],
      isError: true,
    };
  }
}
