/**
 * Jest Test Setup
 * Global configuration and MSW server for GraphQL mocking
 */

import { setupServer } from 'msw/node';
import { graphql, HttpResponse } from 'msw';

// Mock site data
export interface MockSite {
  id: string;
  name: string;
  domain: string;
  status: string;
  path: string;
}

export const mockSites: MockSite[] = [
  {
    id: 'site-1',
    name: 'test-site',
    domain: 'test-site.local',
    status: 'running',
    path: '/tmp/test-site',
  },
  {
    id: 'site-2',
    name: 'another-site',
    domain: 'another-site.local',
    status: 'stopped',
    path: '/tmp/another-site',
  },
];

// MSW server with default handlers
export const server = setupServer(
  // List sites
  graphql.query('Sites', () => {
    return HttpResponse.json({
      data: { sites: mockSites },
    });
  }),

  // Get single site
  graphql.query('Site', ({ variables }) => {
    const site = mockSites.find((s) => s.id === variables.id);
    return HttpResponse.json({
      data: { site },
    });
  }),

  // Start site
  graphql.mutation('StartSite', ({ variables }) => {
    return HttpResponse.json({
      data: { startSite: { id: variables.id, status: 'running' } },
    });
  }),

  // Stop site
  graphql.mutation('StopSite', ({ variables }) => {
    return HttpResponse.json({
      data: { stopSite: { id: variables.id, status: 'stopped' } },
    });
  }),
);

// Setup/teardown
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Increase timeout for slower operations
jest.setTimeout(10000);
