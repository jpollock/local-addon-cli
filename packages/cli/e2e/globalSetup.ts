/**
 * E2E Global Setup
 *
 * Runs before all E2E tests. Checks if Local is running,
 * verifies the MCP addon is enabled, and finds the test site.
 */

import { readConnectionInfo, waitForGraphQL } from '../src/bootstrap';
import { GraphQLClient } from '../src/client';
import type { E2EContext } from './helpers/context';

// Default test site - can be overridden via E2E_TEST_SITE env var
const DEFAULT_TEST_SITE = 'testblankjpp1';

interface Site {
  id: string;
  name: string;
  status: string;
}

async function findSiteByName(client: GraphQLClient, name: string): Promise<Site | null> {
  try {
    const result = await client.query<{ sites: Site[] }>(`
      query {
        sites {
          id
          name
          status
        }
      }
    `);

    return result.sites.find(s => s.name === name) || null;
  } catch {
    return null;
  }
}

/**
 * Check if the MCP addon is enabled by querying an addon-specific operation
 */
async function isAddonEnabled(client: GraphQLClient): Promise<boolean> {
  try {
    // Try to query blueprints - this operation only exists when the addon is enabled
    const result = await client.query<{ blueprints: { success: boolean } }>(`
      query {
        blueprints {
          success
        }
      }
    `);
    // Query succeeded - addon is enabled
    return result.blueprints !== undefined;
  } catch (error: any) {
    // Any error means addon is not enabled or not working
    // - "Cannot query field" = schema doesn't have this operation
    // - HTTP 400 = query is invalid (addon not loaded)
    // - Other errors = addon not functioning
    return false;
  }
}

export default async function globalSetup() {
  console.log('\n=== E2E Test Setup ===\n');

  const testSiteName = process.env.E2E_TEST_SITE || DEFAULT_TEST_SITE;

  const context: E2EContext = {
    isLocalAvailable: false,
    isAddonEnabled: false,
    connectionInfo: null,
    testSiteName: null,
    testSiteId: null,
  };

  // Check if connection info exists
  const connectionInfo = readConnectionInfo();

  if (!connectionInfo) {
    console.log('Local connection info not found.');
    console.log('Start Local and run tests again to execute E2E suite.\n');
    (global as any).__E2E_CONTEXT__ = context;
    return;
  }

  console.log(`Found connection info at port ${connectionInfo.port}`);

  // Check if GraphQL server is responding
  const graphqlReady = await waitForGraphQL(5000, 500);

  if (!graphqlReady) {
    console.log('Local GraphQL server not responding.');
    console.log('Start Local and run tests again to execute E2E suite.\n');
    (global as any).__E2E_CONTEXT__ = context;
    return;
  }

  console.log('GraphQL server is ready.');

  // Create client for further checks
  const client = new GraphQLClient(connectionInfo);

  // Check if MCP addon is enabled
  const addonEnabled = await isAddonEnabled(client);

  if (!addonEnabled) {
    console.log('MCP addon is not enabled in Local.');
    console.log('Enable the addon in Local preferences and restart Local.\n');
    context.isLocalAvailable = true; // Local is available, just not the addon
    (global as any).__E2E_CONTEXT__ = context;
    return;
  }

  console.log('MCP addon is enabled.');

  // Find the specified test site
  const testSite = await findSiteByName(client, testSiteName);

  if (!testSite) {
    console.log(`Test site "${testSiteName}" not found in Local.`);
    console.log('Create the site or set E2E_TEST_SITE env var.\n');
    context.isLocalAvailable = true;
    context.isAddonEnabled = true;
    (global as any).__E2E_CONTEXT__ = context;
    return;
  }

  console.log(`Using test site: ${testSite.name} (${testSite.status})`);

  // Set up context
  context.isLocalAvailable = true;
  context.isAddonEnabled = true;
  context.connectionInfo = connectionInfo;
  context.testSiteName = testSite.name;
  context.testSiteId = testSite.id;

  (global as any).__E2E_CONTEXT__ = context;

  console.log('\n=== Setup Complete ===\n');
}
