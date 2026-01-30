/**
 * GraphQL Client Tests
 */

import { http, HttpResponse } from 'msw';
import { server } from './setup';
import { GraphQLClient, GraphQLClientError } from '../src/client';
import { ConnectionInfo } from '../src/bootstrap';

describe('GraphQLClient', () => {
  const connectionInfo: ConnectionInfo = {
    url: 'http://127.0.0.1:4000/graphql',
    subscriptionUrl: 'ws://127.0.0.1:4000/graphql',
    port: 4000,
    authToken: 'test-token-123',
  };

  describe('successful queries', () => {
    it('returns data from successful query', async () => {
      server.use(
        http.post('http://127.0.0.1:4000/graphql', () => {
          return HttpResponse.json({
            data: {
              sites: [
                { id: '1', name: 'test-site' },
                { id: '2', name: 'another-site' },
              ],
            },
          });
        })
      );

      const client = new GraphQLClient(connectionInfo);
      const result = await client.query<{ sites: Array<{ id: string; name: string }> }>(
        'query { sites { id name } }'
      );

      expect(result.sites).toHaveLength(2);
      expect(result.sites[0].name).toBe('test-site');
    });

    it('passes variables correctly', async () => {
      let receivedVariables: Record<string, unknown> = {};

      server.use(
        http.post('http://127.0.0.1:4000/graphql', async ({ request }) => {
          const body = await request.json() as { variables: Record<string, unknown> };
          receivedVariables = body.variables;
          return HttpResponse.json({
            data: { site: { id: receivedVariables.id, name: 'test' } },
          });
        })
      );

      const client = new GraphQLClient(connectionInfo);
      await client.query('query($id: ID!) { site(id: $id) { id name } }', { id: 'site-123' });

      expect(receivedVariables).toEqual({ id: 'site-123' });
    });

    it('includes auth token in headers', async () => {
      let receivedAuth = '';

      server.use(
        http.post('http://127.0.0.1:4000/graphql', async ({ request }) => {
          receivedAuth = request.headers.get('Authorization') || '';
          return HttpResponse.json({ data: { sites: [] } });
        })
      );

      const client = new GraphQLClient(connectionInfo);
      await client.query('query { sites { id } }');

      expect(receivedAuth).toBe('Bearer test-token-123');
    });
  });

  describe('error handling', () => {
    it('throws on HTTP 401 Unauthorized', async () => {
      server.use(
        http.post('http://127.0.0.1:4000/graphql', () => {
          return new HttpResponse(null, { status: 401, statusText: 'Unauthorized' });
        })
      );

      const client = new GraphQLClient(connectionInfo);

      await expect(client.query('query { sites { id } }')).rejects.toThrow(
        'HTTP 401: Unauthorized'
      );
    });

    it('throws on HTTP 500 Internal Server Error', async () => {
      server.use(
        http.post('http://127.0.0.1:4000/graphql', () => {
          return new HttpResponse(null, { status: 500, statusText: 'Internal Server Error' });
        })
      );

      const client = new GraphQLClient(connectionInfo);

      await expect(client.query('query { sites { id } }')).rejects.toThrow('HTTP 500');
    });

    it('throws GraphQL error with first error message', async () => {
      server.use(
        http.post('http://127.0.0.1:4000/graphql', () => {
          return HttpResponse.json({
            errors: [
              { message: 'Site not found' },
              { message: 'Another error' },
            ],
          });
        })
      );

      const client = new GraphQLClient(connectionInfo);

      await expect(client.query('query { site(id: "x") { id } }')).rejects.toThrow(
        'Site not found'
      );
    });

    it('throws when data is null', async () => {
      server.use(
        http.post('http://127.0.0.1:4000/graphql', () => {
          return HttpResponse.json({ data: null });
        })
      );

      const client = new GraphQLClient(connectionInfo);

      await expect(client.query('query { sites { id } }')).rejects.toThrow(
        'No data in response'
      );
    });

    it('throws on timeout', async () => {
      server.use(
        http.post('http://127.0.0.1:4000/graphql', async () => {
          await new Promise((resolve) => setTimeout(resolve, 500));
          return HttpResponse.json({ data: { sites: [] } });
        })
      );

      const client = new GraphQLClient(connectionInfo, { timeout: 100 });

      await expect(client.query('query { sites { id } }')).rejects.toThrow('timed out');
    });

    it('preserves GraphQL errors array in exception', async () => {
      const errors = [
        { message: 'Error 1', path: ['field1'] },
        { message: 'Error 2', path: ['field2'] },
      ];

      server.use(
        http.post('http://127.0.0.1:4000/graphql', () => {
          return HttpResponse.json({ errors });
        })
      );

      const client = new GraphQLClient(connectionInfo);

      try {
        await client.query('query { sites { id } }');
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(GraphQLClientError);
        expect((error as GraphQLClientError).errors).toHaveLength(2);
      }
    });
  });

  describe('mutation alias', () => {
    it('mutate() is an alias for query()', async () => {
      server.use(
        http.post('http://127.0.0.1:4000/graphql', () => {
          return HttpResponse.json({
            data: { startSite: { id: 'site-1', status: 'running' } },
          });
        })
      );

      const client = new GraphQLClient(connectionInfo);
      const result = await client.mutate<{ startSite: { id: string; status: string } }>(
        'mutation { startSite(id: "site-1") { id status } }'
      );

      expect(result.startSite.status).toBe('running');
    });
  });
});
