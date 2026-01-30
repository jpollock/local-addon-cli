/**
 * E2E Global Teardown
 *
 * Runs after all E2E tests. Does NOT stop the site to avoid
 * hanging Local's GraphQL server.
 */

export default async function globalTeardown() {
  console.log('\n=== E2E Test Teardown ===\n');
  console.log('Leaving test site as-is (no cleanup).\n');
  console.log('=== Teardown Complete ===\n');
}
