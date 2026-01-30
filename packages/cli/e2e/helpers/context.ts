/**
 * E2E Test Context
 *
 * Shared state between globalSetup and test files.
 */

import type { ConnectionInfo } from '../../src/bootstrap';

export interface E2EContext {
  isLocalAvailable: boolean;
  isAddonEnabled: boolean;
  connectionInfo: ConnectionInfo | null;
  testSiteName: string | null;
  testSiteId: string | null;
}

declare global {
  var __E2E_CONTEXT__: E2EContext;
}

export function getE2EContext(): E2EContext {
  return (
    global.__E2E_CONTEXT__ || {
      isLocalAvailable: false,
      isAddonEnabled: false,
      connectionInfo: null,
      testSiteName: null,
      testSiteId: null,
    }
  );
}
