/**
 * MCP Server Addon - Renderer Entry Point
 * Adds MCP Server preferences panel to Local
 *
 * Uses class components for compatibility with Local's Electron environment.
 */

import React from 'react';
import { getThemeColors, onThemeChange, ThemeColors } from '../common/theme';

// Type definitions
interface McpStatus {
  running: boolean;
  port: number;
  uptime: number;
  error?: string;
}

interface ConnectionInfo {
  url: string;
  authToken: string;
  port: number;
  version: string;
  tools: string[];
}

interface McpPreferencesPanelProps {
  electron: {
    ipcRenderer?: {
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
    };
  };
}

interface McpPreferencesPanelState {
  status: McpStatus | null;
  connectionInfo: ConnectionInfo | null;
  loading: boolean;
  copied: boolean;
  actionInProgress: boolean;
  activeTab: 'status' | 'setup';
  colors: ThemeColors;
}

// MCP Preferences Panel Component (Class-based for Local compatibility)
class McpPreferencesPanel extends React.Component<
  McpPreferencesPanelProps,
  McpPreferencesPanelState
> {
  private statusInterval?: ReturnType<typeof setInterval>;
  private themeCleanup?: () => void;

  state: McpPreferencesPanelState = {
    status: null,
    connectionInfo: null,
    loading: true,
    copied: false,
    actionInProgress: false,
    activeTab: 'status',
    colors: getThemeColors(),
  };

  componentDidMount(): void {
    this.init();
    this.statusInterval = setInterval(() => this.fetchStatus(), 5000);
    this.themeCleanup = onThemeChange(() => {
      this.setState({ colors: getThemeColors() });
    });
  }

  componentWillUnmount(): void {
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
    }
    if (this.themeCleanup) {
      this.themeCleanup();
    }
  }

  private async init(): Promise<void> {
    await Promise.all([this.fetchStatus(), this.fetchConnectionInfo()]);
    this.setState({ loading: false });
  }

  private fetchStatus = async (): Promise<void> => {
    try {
      const result = (await this.props.electron?.ipcRenderer?.invoke('mcp:getStatus')) as
        | McpStatus
        | undefined;
      if (result) {
        this.setState({ status: result });
      }
    } catch (error) {
      console.error('Failed to fetch MCP status:', error);
    }
  };

  private fetchConnectionInfo = async (): Promise<void> => {
    try {
      const result = (await this.props.electron?.ipcRenderer?.invoke('mcp:getConnectionInfo')) as
        | ConnectionInfo
        | undefined;
      if (result) {
        this.setState({ connectionInfo: result });
      }
    } catch (error) {
      console.error('Failed to fetch connection info:', error);
    }
  };

  private handleCopyStdioConfig = (): void => {
    const config = {
      mcpServers: {
        local: {
          type: 'stdio',
          command: 'node',
          args: ['/path/to/local-addon-mcp-server/bin/mcp-stdio.js'],
        },
      },
    };
    navigator.clipboard.writeText(JSON.stringify(config, null, 2));
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2000);
  };

  private handleCopySseConfig = (): void => {
    const { connectionInfo } = this.state;
    if (connectionInfo) {
      const config = {
        mcpServers: {
          local: {
            url: `${connectionInfo.url}/mcp/sse`,
            transport: 'sse',
            headers: {
              Authorization: `Bearer ${connectionInfo.authToken}`,
            },
          },
        },
      };
      navigator.clipboard.writeText(JSON.stringify(config, null, 2));
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    }
  };

  private handleTestConnection = async (): Promise<void> => {
    const { connectionInfo } = this.state;
    try {
      const response = await fetch(`http://127.0.0.1:${connectionInfo?.port}/health`);
      const data = await response.json();
      if (data.status === 'ok') {
        alert('Connection successful! MCP server is healthy.');
      } else {
        alert('Connection failed: Server returned unexpected response');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      alert(`Connection failed: ${message}`);
    }
  };

  private handleStartStop = async (): Promise<void> => {
    const { status } = this.state;
    this.setState({ actionInProgress: true });
    try {
      if (status?.running) {
        await this.props.electron?.ipcRenderer?.invoke('mcp:stop');
      } else {
        await this.props.electron?.ipcRenderer?.invoke('mcp:start');
      }
      await this.fetchStatus();
      await this.fetchConnectionInfo();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      alert(`Action failed: ${message}`);
    } finally {
      this.setState({ actionInProgress: false });
    }
  };

  private handleRestart = async (): Promise<void> => {
    this.setState({ actionInProgress: true });
    try {
      await this.props.electron?.ipcRenderer?.invoke('mcp:restart');
      await this.fetchStatus();
      await this.fetchConnectionInfo();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      alert(`Restart failed: ${message}`);
    } finally {
      this.setState({ actionInProgress: false });
    }
  };

  private handleRegenerateToken = async (): Promise<void> => {
    if (
      !confirm(
        'Regenerate authentication token? You will need to update your AI tool configuration.'
      )
    ) {
      return;
    }
    this.setState({ actionInProgress: true });
    try {
      const result = (await this.props.electron?.ipcRenderer?.invoke('mcp:regenerateToken')) as {
        success?: boolean;
        error?: string;
      };
      if (result?.success) {
        await this.fetchConnectionInfo();
        alert('Token regenerated successfully. Please update your AI tool configuration.');
      } else {
        alert(`Failed to regenerate token: ${result?.error}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to regenerate token: ${message}`);
    } finally {
      this.setState({ actionInProgress: false });
    }
  };

  private getStatusColor(): string {
    const { status, colors } = this.state;
    if (!status) return colors.textMuted;
    if (status.running) return colors.successText;
    return colors.errorText;
  }

  private getStatusText(): string {
    const { loading, status } = this.state;
    if (loading) return 'Loading...';
    if (!status) return 'Unknown';
    if (status.running) return 'Running';
    return 'Stopped';
  }

  private formatUptime(seconds: number): string {
    if (seconds < 60) return `${Math.floor(seconds)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  }

  private getTabStyle(isActive: boolean): React.CSSProperties {
    const { colors } = this.state;
    return {
      padding: '8px 16px',
      border: 'none',
      borderBottom: isActive ? `2px solid ${colors.primary}` : '2px solid transparent',
      backgroundColor: 'transparent',
      color: isActive ? colors.primary : colors.textSecondary,
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: isActive ? 600 : 400,
    };
  }

  private getButtonStyle(bgColor: string, disabled?: boolean): React.CSSProperties {
    return {
      padding: '8px 16px',
      backgroundColor: bgColor,
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontSize: '13px',
      opacity: disabled ? 0.5 : 1,
    };
  }

  private renderStatusTab(): React.ReactNode {
    const { status, connectionInfo, actionInProgress, colors } = this.state;

    return (
      <>
        {/* Status Section */}
        <div style={{ marginBottom: '24px' }}>
          <h3
            style={{
              fontSize: '14px',
              fontWeight: 600,
              marginBottom: '12px',
              color: colors.textPrimary,
            }}
          >
            Server Status
          </h3>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px',
              backgroundColor: colors.panelBgSecondary,
              borderRadius: '6px',
            }}
          >
            <span
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: this.getStatusColor(),
              }}
            />
            <span style={{ fontWeight: 500, color: colors.textPrimary }}>
              {this.getStatusText()}
            </span>
            {status?.running && (
              <>
                <span style={{ color: colors.textSecondary }}>|</span>
                <span style={{ color: colors.textSecondary }}>Port: {status.port}</span>
                <span style={{ color: colors.textSecondary }}>|</span>
                <span style={{ color: colors.textSecondary }}>
                  Uptime: {this.formatUptime(status.uptime)}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Server Controls */}
        <div style={{ marginBottom: '24px' }}>
          <h3
            style={{
              fontSize: '14px',
              fontWeight: 600,
              marginBottom: '12px',
              color: colors.textPrimary,
            }}
          >
            Server Controls
          </h3>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              onClick={this.handleStartStop}
              disabled={actionInProgress}
              style={this.getButtonStyle(
                status?.running ? colors.errorText : colors.successText,
                actionInProgress
              )}
            >
              {status?.running ? 'Stop Server' : 'Start Server'}
            </button>
            <button
              onClick={this.handleRestart}
              disabled={actionInProgress || !status?.running}
              style={this.getButtonStyle('#6c757d', actionInProgress || !status?.running)}
            >
              Restart Server
            </button>
            <button
              onClick={this.handleTestConnection}
              disabled={!status?.running}
              style={this.getButtonStyle(
                status?.running ? '#17a2b8' : colors.textMuted,
                !status?.running
              )}
            >
              Test Connection
            </button>
          </div>
        </div>

        {/* Connection Info Section */}
        {connectionInfo && (
          <div style={{ marginBottom: '24px' }}>
            <h3
              style={{
                fontSize: '14px',
                fontWeight: 600,
                marginBottom: '12px',
                color: colors.textPrimary,
              }}
            >
              Connection Info
            </h3>
            <div
              style={{
                padding: '12px',
                backgroundColor: colors.panelBgSecondary,
                borderRadius: '6px',
                fontFamily: 'monospace',
                fontSize: '12px',
                color: colors.textPrimary,
              }}
            >
              <div style={{ marginBottom: '8px' }}>
                <strong>URL:</strong> {connectionInfo.url}
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>stdio script:</strong> bin/mcp-stdio.js
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>Version:</strong> {connectionInfo.version}
              </div>
              <div>
                <strong>Tools:</strong> {connectionInfo.tools.join(', ')}
              </div>
            </div>
          </div>
        )}

        {/* Security Section */}
        <div style={{ marginBottom: '24px' }}>
          <h3
            style={{
              fontSize: '14px',
              fontWeight: 600,
              marginBottom: '12px',
              color: colors.textPrimary,
            }}
          >
            Security
          </h3>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              onClick={this.handleRegenerateToken}
              disabled={actionInProgress || !status?.running}
              style={{
                padding: '8px 16px',
                backgroundColor: '#ffc107',
                color: '#212529',
                border: 'none',
                borderRadius: '4px',
                cursor: actionInProgress || !status?.running ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                opacity: actionInProgress || !status?.running ? 0.5 : 1,
              }}
            >
              Regenerate Token
            </button>
          </div>
          <p style={{ fontSize: '12px', color: colors.textSecondary, marginTop: '8px' }}>
            Regenerating the token will require you to update your AI tool configuration.
          </p>
        </div>
      </>
    );
  }

  private renderSetupTab(): React.ReactNode {
    const { connectionInfo, copied, colors } = this.state;

    return (
      <>
        {/* Claude Code Setup */}
        <div style={{ marginBottom: '24px' }}>
          <h3
            style={{
              fontSize: '14px',
              fontWeight: 600,
              marginBottom: '12px',
              color: colors.textPrimary,
            }}
          >
            Claude Code (Recommended)
          </h3>
          <div
            style={{
              padding: '16px',
              backgroundColor: colors.panelBgSecondary,
              borderRadius: '6px',
            }}
          >
            <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: colors.textPrimary }}>
              Add the following to your{' '}
              <code
                style={{
                  backgroundColor: colors.panelBgCode,
                  padding: '2px 4px',
                  borderRadius: '3px',
                  color: '#f8f8f2',
                }}
              >
                ~/.claude.json
              </code>{' '}
              file:
            </p>
            <pre
              style={{
                backgroundColor: colors.panelBgCode,
                color: '#f8f8f2',
                padding: '12px',
                borderRadius: '4px',
                fontSize: '11px',
                overflow: 'auto',
                margin: '0 0 12px 0',
              }}
            >
              {`{
  "mcpServers": {
    "local": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/local-addon-mcp-server/bin/mcp-stdio.js"]
    }
  }
}`}
            </pre>
            <button
              onClick={this.handleCopyStdioConfig}
              style={this.getButtonStyle(colors.primary)}
            >
              {copied ? 'Copied!' : 'Copy Config'}
            </button>
          </div>
        </div>

        {/* Claude.ai / ChatGPT Setup */}
        <div style={{ marginBottom: '24px' }}>
          <h3
            style={{
              fontSize: '14px',
              fontWeight: 600,
              marginBottom: '12px',
              color: colors.textPrimary,
            }}
          >
            Claude.ai / ChatGPT / Other AI Tools
          </h3>
          <div
            style={{
              padding: '16px',
              backgroundColor: colors.panelBgSecondary,
              borderRadius: '6px',
            }}
          >
            <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: colors.textPrimary }}>
              For tools that support SSE transport, use this configuration:
            </p>
            <pre
              style={{
                backgroundColor: colors.panelBgCode,
                color: '#f8f8f2',
                padding: '12px',
                borderRadius: '4px',
                fontSize: '11px',
                overflow: 'auto',
                margin: '0 0 12px 0',
              }}
            >
              {connectionInfo
                ? `{
  "mcpServers": {
    "local": {
      "url": "${connectionInfo.url}/mcp/sse",
      "transport": "sse",
      "headers": {
        "Authorization": "Bearer ${connectionInfo.authToken.substring(0, 20)}..."
      }
    }
  }
}`
                : 'Server not running'}
            </pre>
            <button
              onClick={this.handleCopySseConfig}
              disabled={!connectionInfo}
              style={this.getButtonStyle(
                connectionInfo ? colors.primary : colors.textMuted,
                !connectionInfo
              )}
            >
              {copied ? 'Copied!' : 'Copy SSE Config'}
            </button>
          </div>
        </div>

        {/* Available Commands */}
        <div style={{ marginBottom: '24px' }}>
          <h3
            style={{
              fontSize: '14px',
              fontWeight: 600,
              marginBottom: '12px',
              color: colors.textPrimary,
            }}
          >
            Example Commands
          </h3>
          <div
            style={{
              padding: '16px',
              backgroundColor: colors.infoBg,
              borderRadius: '6px',
              border: `1px solid ${colors.infoBorder}`,
            }}
          >
            <p
              style={{
                margin: '0 0 8px 0',
                fontSize: '13px',
                fontWeight: 500,
                color: colors.infoText,
              }}
            >
              Try saying to your AI assistant:
            </p>
            <ul
              style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: colors.infoText }}
            >
              <li>&quot;List my Local sites&quot;</li>
              <li>&quot;Start the blog site&quot;</li>
              <li>&quot;Create a new site called test-project&quot;</li>
              <li>&quot;Run wp plugin list on my-site&quot;</li>
              <li>&quot;Stop all running sites&quot;</li>
              <li>&quot;What plugins are installed on my-site?&quot;</li>
            </ul>
          </div>
        </div>
      </>
    );
  }

  render(): React.ReactNode {
    const { activeTab, colors } = this.state;

    return (
      <div style={{ padding: '20px', color: colors.textPrimary }}>
        <h2
          style={{
            marginBottom: '20px',
            fontSize: '18px',
            fontWeight: 600,
            color: colors.textPrimary,
          }}
        >
          MCP Server
        </h2>

        <p style={{ color: colors.textSecondary, marginBottom: '24px' }}>
          The MCP (Model Context Protocol) server enables AI tools like Claude Code to control your
          Local sites.
        </p>

        {/* Tab Navigation */}
        <div style={{ borderBottom: `1px solid ${colors.border}`, marginBottom: '24px' }}>
          <button
            style={this.getTabStyle(activeTab === 'status')}
            onClick={() => this.setState({ activeTab: 'status' })}
          >
            Status &amp; Controls
          </button>
          <button
            style={this.getTabStyle(activeTab === 'setup')}
            onClick={() => this.setState({ activeTab: 'setup' })}
          >
            AI Tool Setup
          </button>
        </div>

        {activeTab === 'status' && this.renderStatusTab()}
        {activeTab === 'setup' && this.renderSetupTab()}
      </div>
    );
  }
}

// Export as a constructor function that Local can instantiate
module.exports = function McpServerRenderer(context: { hooks: unknown; electron: unknown }): void {
  const { hooks, electron } = context as {
    hooks: { addFilter: (name: string, callback: (items: unknown[]) => unknown[]) => void };
    electron: McpPreferencesPanelProps['electron'];
  };

  console.log('[MCP Server] Renderer loading...');

  // Add MCP Server to preferences menu
  hooks.addFilter('preferencesMenuItems', (menuItems: unknown[]) => {
    console.log('[MCP Server] Adding MCP Server to preferences');

    (menuItems as Array<Record<string, unknown>>).push({
      path: 'mcp-server',
      displayName: 'MCP Server',
      sections: () => <McpPreferencesPanel electron={electron} />,
      onApply: () => {
        // No apply action needed for read-only display
      },
    });

    return menuItems;
  });

  console.log('[MCP Server] Renderer setup complete');
};
