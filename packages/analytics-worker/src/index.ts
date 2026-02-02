/**
 * LWP Analytics Worker
 *
 * Receives anonymous usage analytics from the lwp CLI.
 * All requests are authenticated with HMAC-SHA256 signatures.
 * Stores events in D1 (SQLite at the edge).
 */

export interface Env {
  lwp_analytics: D1Database;
  ADMIN_TOKEN?: string;
}

interface AnalyticsEvent {
  command: string;
  success: boolean;
  duration_ms: number;
  timestamp: string;
  installation_id: string;
  session_id: string;
  cli_version: string;
  os: string;
  node_version: string;
  error_category?: string;
}

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Installation-Id, X-Signature, X-Secret-Key',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === '/health' && request.method === 'GET') {
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Event ingestion endpoint (authenticated)
    if (url.pathname === '/v1/events' && request.method === 'POST') {
      return handleEventIngestion(request, env);
    }

    // Stats endpoint (admin only)
    if (url.pathname === '/v1/stats' && request.method === 'GET') {
      return handleStats(request, env);
    }

    // Dashboard endpoint (signed URL)
    if (url.pathname.startsWith('/dashboard/') && request.method === 'GET') {
      return handleDashboard(request, env);
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  },
};

/**
 * Verify HMAC-SHA256 signature
 */
async function verifySignature(
  data: string,
  signature: string,
  secretKeyBase64: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const keyData = Uint8Array.from(atob(secretKeyBase64), (c) => c.charCodeAt(0));

    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
    const expectedSignature = Array.from(new Uint8Array(signatureBytes))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return signature === expectedSignature;
  } catch {
    return false;
  }
}

/**
 * Get or create installation record
 */
async function getInstallation(
  env: Env,
  installationId: string
): Promise<{ secret_key: string } | null> {
  const result = await env.lwp_analytics
    .prepare('SELECT secret_key FROM installations WHERE installation_id = ?')
    .bind(installationId)
    .first<{ secret_key: string }>();
  return result;
}

/**
 * Register a new installation with its secret key
 */
async function registerInstallation(
  env: Env,
  installationId: string,
  secretKey: string
): Promise<void> {
  await env.lwp_analytics
    .prepare(
      'INSERT OR IGNORE INTO installations (installation_id, secret_key, registered_at) VALUES (?, ?, ?)'
    )
    .bind(installationId, secretKey, new Date().toISOString())
    .run();
}

async function handleEventIngestion(request: Request, env: Env): Promise<Response> {
  try {
    const installationId = request.headers.get('X-Installation-Id');
    const signature = request.headers.get('X-Signature');
    const secretKey = request.headers.get('X-Secret-Key'); // Only on first request

    if (!installationId || !signature) {
      return new Response(JSON.stringify({ error: 'Missing authentication headers' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const body = await request.text();

    // Check if installation exists
    let installation = await getInstallation(env, installationId);

    if (!installation) {
      // New installation - must provide secret key
      if (!secretKey) {
        return new Response(JSON.stringify({ error: 'New installation must provide secret key' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Verify signature with provided key before storing
      const isValid = await verifySignature(body, signature, secretKey);
      if (!isValid) {
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Register the installation
      await registerInstallation(env, installationId, secretKey);
      installation = { secret_key: secretKey };
    } else {
      // Existing installation - verify signature with stored key
      const isValid = await verifySignature(body, signature, installation.secret_key);
      if (!isValid) {
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    // Parse and validate event
    const event = JSON.parse(body) as AnalyticsEvent;

    if (
      !event.command ||
      typeof event.success !== 'boolean' ||
      typeof event.duration_ms !== 'number' ||
      !event.timestamp ||
      !event.installation_id ||
      !event.session_id ||
      !event.cli_version ||
      !event.os ||
      !event.node_version
    ) {
      return new Response(JSON.stringify({ error: 'Invalid event format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Ensure event installation_id matches header
    if (event.installation_id !== installationId) {
      return new Response(JSON.stringify({ error: 'Installation ID mismatch' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Insert event into D1
    await env.lwp_analytics
      .prepare(
        `INSERT INTO events (
        installation_id,
        session_id,
        command,
        success,
        duration_ms,
        error_category,
        cli_version,
        os,
        node_version,
        timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        event.installation_id,
        event.session_id,
        event.command,
        event.success ? 1 : 0,
        event.duration_ms,
        event.error_category || null,
        event.cli_version,
        event.os,
        event.node_version,
        event.timestamp
      )
      .run();

    return new Response(JSON.stringify({ status: 'accepted' }), {
      status: 202,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    console.error('Event ingestion error:', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}

async function handleStats(request: Request, env: Env): Promise<Response> {
  // Require admin token
  const authHeader = request.headers.get('Authorization');
  if (env.ADMIN_TOKEN && authHeader !== `Bearer ${env.ADMIN_TOKEN}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {
    const totalEvents = await env.lwp_analytics
      .prepare('SELECT COUNT(*) as count FROM events')
      .first<{ count: number }>();

    const uniqueInstallations = await env.lwp_analytics
      .prepare('SELECT COUNT(DISTINCT installation_id) as count FROM events')
      .first<{ count: number }>();

    const commandCounts = await env.lwp_analytics
      .prepare(
        `SELECT command, COUNT(*) as count
       FROM events
       GROUP BY command
       ORDER BY count DESC
       LIMIT 10`
      )
      .all<{ command: string; count: number }>();

    const versionCounts = await env.lwp_analytics
      .prepare(
        `SELECT cli_version, COUNT(*) as count
       FROM events
       GROUP BY cli_version
       ORDER BY count DESC
       LIMIT 5`
      )
      .all<{ cli_version: string; count: number }>();

    const osCounts = await env.lwp_analytics
      .prepare(
        `SELECT os, COUNT(*) as count
       FROM events
       GROUP BY os
       ORDER BY count DESC`
      )
      .all<{ os: string; count: number }>();

    const successRate = await env.lwp_analytics
      .prepare(
        `SELECT
         SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successes,
         COUNT(*) as total
       FROM events`
      )
      .first<{ successes: number; total: number }>();

    return new Response(
      JSON.stringify({
        total_events: totalEvents?.count || 0,
        unique_installations: uniqueInstallations?.count || 0,
        success_rate:
          successRate && successRate.total > 0
            ? ((successRate.successes / successRate.total) * 100).toFixed(1) + '%'
            : 'N/A',
        top_commands: commandCounts?.results || [],
        versions: versionCounts?.results || [],
        os_distribution: osCounts?.results || [],
      }),
      {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  } catch (error) {
    console.error('Stats error:', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}

async function handleDashboard(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const installationId = pathParts[2]; // /dashboard/{installationId}

    const expiration = url.searchParams.get('exp');
    const signature = url.searchParams.get('sig');

    if (!installationId || !expiration || !signature) {
      return new Response(JSON.stringify({ error: 'Missing parameters' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Check expiration
    const expTime = parseInt(expiration, 10);
    if (isNaN(expTime) || expTime < Math.floor(Date.now() / 1000)) {
      return new Response(JSON.stringify({ error: 'Link expired' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Get installation's secret key
    const installation = await getInstallation(env, installationId);
    if (!installation) {
      return new Response(JSON.stringify({ error: 'Installation not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Verify signature
    const payload = `${installationId}:${expiration}`;
    const isValid = await verifySignature(payload, signature, installation.secret_key);
    if (!isValid) {
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Get this installation's stats
    const totalEvents = await env.lwp_analytics
      .prepare('SELECT COUNT(*) as count FROM events WHERE installation_id = ?')
      .bind(installationId)
      .first<{ count: number }>();

    const commandCounts = await env.lwp_analytics
      .prepare(
        `SELECT command, COUNT(*) as count
       FROM events
       WHERE installation_id = ?
       GROUP BY command
       ORDER BY count DESC
       LIMIT 10`
      )
      .bind(installationId)
      .all<{ command: string; count: number }>();

    const successRate = await env.lwp_analytics
      .prepare(
        `SELECT
         SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successes,
         COUNT(*) as total
       FROM events
       WHERE installation_id = ?`
      )
      .bind(installationId)
      .first<{ successes: number; total: number }>();

    const recentEvents = await env.lwp_analytics
      .prepare(
        `SELECT command, success, duration_ms, timestamp
       FROM events
       WHERE installation_id = ?
       ORDER BY timestamp DESC
       LIMIT 20`
      )
      .bind(installationId)
      .all<{ command: string; success: number; duration_ms: number; timestamp: string }>();

    return new Response(
      JSON.stringify({
        installation_id: installationId,
        total_events: totalEvents?.count || 0,
        success_rate:
          successRate && successRate.total > 0
            ? ((successRate.successes / successRate.total) * 100).toFixed(1) + '%'
            : 'N/A',
        top_commands: commandCounts?.results || [],
        recent_events: recentEvents?.results || [],
      }),
      {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  } catch (error) {
    console.error('Dashboard error:', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}
