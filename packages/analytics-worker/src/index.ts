/**
 * LWP Analytics Worker
 *
 * Receives anonymous usage analytics from the lwp CLI.
 * Stores events in D1 (SQLite at the edge).
 */

export interface Env {
  DB: D1Database;
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
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
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

    // Event ingestion endpoint
    if (url.pathname === '/v1/events' && request.method === 'POST') {
      return handleEventIngestion(request, env);
    }

    // Stats endpoint (for admin/debugging)
    if (url.pathname === '/v1/stats' && request.method === 'GET') {
      return handleStats(env);
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  },
};

async function handleEventIngestion(request: Request, env: Env): Promise<Response> {
  try {
    const event = (await request.json()) as AnalyticsEvent;

    // Validate required fields
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

    // Insert into D1
    await env.DB.prepare(
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

    // Return 202 Accepted (fire-and-forget from CLI perspective)
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

async function handleStats(env: Env): Promise<Response> {
  try {
    // Get basic stats
    const totalEvents = await env.DB.prepare('SELECT COUNT(*) as count FROM events').first<{
      count: number;
    }>();

    const uniqueInstallations = await env.DB.prepare(
      'SELECT COUNT(DISTINCT installation_id) as count FROM events'
    ).first<{ count: number }>();

    const commandCounts = await env.DB.prepare(
      `SELECT command, COUNT(*) as count
       FROM events
       GROUP BY command
       ORDER BY count DESC
       LIMIT 10`
    ).all<{ command: string; count: number }>();

    const versionCounts = await env.DB.prepare(
      `SELECT cli_version, COUNT(*) as count
       FROM events
       GROUP BY cli_version
       ORDER BY count DESC
       LIMIT 5`
    ).all<{ cli_version: string; count: number }>();

    const osCounts = await env.DB.prepare(
      `SELECT os, COUNT(*) as count
       FROM events
       GROUP BY os
       ORDER BY count DESC`
    ).all<{ os: string; count: number }>();

    const successRate = await env.DB.prepare(
      `SELECT
         SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successes,
         COUNT(*) as total
       FROM events`
    ).first<{ successes: number; total: number }>();

    return new Response(
      JSON.stringify({
        total_events: totalEvents?.count || 0,
        unique_installations: uniqueInstallations?.count || 0,
        success_rate:
          successRate?.total > 0
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
