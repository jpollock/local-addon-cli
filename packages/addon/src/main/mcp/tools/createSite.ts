/**
 * create_site Tool
 * Create a new WordPress site
 */

import os from 'os';
import path from 'path';
import { McpToolDefinition, McpToolResult, LocalServices } from '../../../common/types';

export const createSiteDefinition: McpToolDefinition = {
  name: 'create_site',
  description: 'Create a new WordPress site in Local',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Site name (required)',
      },
      domain: {
        type: 'string',
        description: 'Site domain (default: name.local)',
      },
      phpVersion: {
        type: 'string',
        description: 'PHP version (e.g., "8.2.10")',
      },
      webServer: {
        type: 'string',
        enum: ['nginx', 'apache'],
        description: 'Web server type (default: nginx)',
      },
      database: {
        type: 'string',
        enum: ['mysql', 'mariadb'],
        description: 'Database type (default: mysql)',
      },
      wpAdmin: {
        type: 'object',
        properties: {
          username: {
            type: 'string',
            description: 'WordPress admin username (default: admin)',
          },
          password: {
            type: 'string',
            description: 'WordPress admin password (default: password)',
          },
          email: {
            type: 'string',
            description: 'WordPress admin email (default: admin@local.test)',
          },
        },
        description: 'WordPress admin credentials',
      },
    },
    required: ['name'],
  },
};

interface CreateSiteArgs {
  name: string;
  domain?: string;
  phpVersion?: string;
  webServer?: 'nginx' | 'apache';
  database?: 'mysql' | 'mariadb';
  wpAdmin?: {
    username?: string;
    password?: string;
    email?: string;
  };
}

export async function createSite(
  args: Record<string, unknown>,
  services: LocalServices
): Promise<McpToolResult> {
  const {
    name,
    domain,
    phpVersion,
    webServer = 'nginx',
    database = 'mysql',
    wpAdmin = {},
  } = args as unknown as CreateSiteArgs;

  if (!name) {
    return {
      content: [{ type: 'text', text: 'Error: name parameter is required' }],
      isError: true,
    };
  }

  // Check if site with this name already exists
  const sitesMap = services.siteData.getSites();
  const existingSites = Object.values(sitesMap) as any[];
  const existingSite = existingSites.find((s: any) => s.name.toLowerCase() === name.toLowerCase());
  if (existingSite) {
    return {
      content: [{ type: 'text', text: `Error: A site named "${name}" already exists` }],
      isError: true,
    };
  }

  try {
    // Build site slug (used for domain and path)
    const siteSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Build site domain
    const siteDomain = domain || `${siteSlug}.local`;

    // Build site path - Local stores sites in ~/Local Sites/<site-slug>
    const sitePath = path.join(os.homedir(), 'Local Sites', siteSlug);

    // Build the site creation options
    const newSiteInfo: any = {
      siteName: name,
      siteDomain: siteDomain,
      sitePath: sitePath,
      webServer: webServer,
      database: database,
    };

    // Add PHP version if specified
    if (phpVersion) {
      newSiteInfo.phpVersion = phpVersion;
    }

    // Create the site using addSite service
    const newSite = await services.addSite.addSite({
      newSiteInfo,
      wpCredentials: {
        adminUsername: wpAdmin.username || 'admin',
        adminPassword: wpAdmin.password || 'password',
        adminEmail: wpAdmin.email || 'admin@local.test',
      },
      goToSite: false,
    });

    const result = {
      success: true,
      site: {
        id: newSite.id,
        name: newSite.name,
        domain: newSite.domain,
        path: newSite.path,
        url: `https://${newSite.domain}`,
        adminUrl: `https://${newSite.domain}/wp-admin`,
      },
      message: `Site "${name}" created successfully`,
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: `Failed to create site: ${error.message}` }],
      isError: true,
    };
  }
}
