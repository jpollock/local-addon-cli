/**
 * MCP Server Types
 */

export interface McpConnectionInfo {
  url: string;
  authToken: string;
  port: number;
  version: string;
  tools: string[];
}

export interface McpServerConfig {
  port: number;
  authToken?: string;
}

export interface McpServerStatus {
  running: boolean;
  port: number;
  uptime: number;
  error?: string;
}

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface McpToolResult {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}

export interface McpRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: {
    name?: string;
    arguments?: Record<string, unknown>;
  };
}

export interface McpResponse {
  jsonrpc: '2.0';
  id: number | string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface LocalServices {
  siteData: {
    getSites(): any[];
    getSite(id: string): any | undefined;
    updateSite?(siteID: string, site: Partial<{ name: string; xdebugEnabled: boolean }>): void;
  };
  siteProcessManager: {
    start(site: any): Promise<void>;
    stop(site: any): Promise<void>;
    restart(site: any): Promise<void>;
    getSiteStatus(site: any): Promise<string>;
  };
  wpCli: {
    run(site: any, args: string[], opts?: any): Promise<string | null>;
  };
  deleteSite: {
    deleteSite(opts: { site: any; trashFiles: boolean; updateHosts: boolean }): Promise<void>;
  };
  addSite: {
    addSite(opts: {
      newSiteInfo: {
        siteName: string;
        siteDomain: string;
        sitePath?: string;
        multiSite?: 'no' | 'ms-subdir' | 'ms-subdomain';
        phpVersion?: string;
        webServer?: 'nginx' | 'apache';
        database?: 'mysql' | 'mariadb';
      };
      wpCredentials?: {
        adminUsername?: string;
        adminPassword?: string;
        adminEmail?: string;
      };
      goToSite?: boolean;
    }): Promise<any>;
  };
  localLogger: {
    info(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
    error(message: string, ...args: any[]): void;
    debug(message: string, ...args: any[]): void;
  };
  // Optional services for extended functionality
  browserManager?: {
    openURL(url: string): Promise<void>;
  };
  cloneSite?: (site: any, newName: string) => Promise<any>;
  exportSite?: (site: any, outputPath: string) => Promise<void>;
  blueprints?: {
    getBlueprints(): Promise<any[]>;
    saveBlueprint(site: any, options: { name: string; description?: string }): Promise<any>;
  };
  // Phase 8 services
  adminer?: {
    open(site: any): Promise<void>;
  };
  x509Cert?: {
    trustCert(site: any): Promise<void>;
  };
  siteProvisioner?: {
    swapService(
      site: any,
      role: string,
      serviceName: string,
      serviceBinVersion: string,
      restartRouter?: boolean
    ): Promise<void>;
  };
  importSite?: {
    run(settings: { importType?: string; zipPath: string; siteName: string }): Promise<any>;
  };
  // Phase 9 services
  lightningServices?: {
    getRegisteredServices(role?: string): Record<string, Record<string, any>>;
    getServices(role?: string): Promise<Record<string, Record<string, any>>>;
  };
  // Phase 11: WP Engine Connect services
  wpeOAuth?: {
    getAccessToken(): Promise<string | undefined>;
    authenticate(): Promise<{ accessToken: string; refreshToken: string; idToken: string }>;
    clearTokens(): Promise<void>;
  };
  capi?: {
    getInstallList(): Promise<any[] | undefined>;
    getAccountList(): Promise<any[] | undefined>;
    getCurrentUser(): Promise<{ id?: string; email?: string } | undefined>;
    getInstall(
      installId: string
    ): Promise<{ id: string; name: string; environment?: string; cname?: string } | undefined>;
  };
  // Phase 11c: Sync services
  wpePush?: {
    push(args: {
      includeSql?: boolean;
      wpengineInstallName: string;
      wpengineInstallId: string;
      wpengineSiteId: string;
      wpenginePrimaryDomain: string;
      localSiteId: string;
      environment?: string;
      files?: string[];
      isMagicSync?: boolean;
    }): Promise<void>;
    pushDatabase(args: {
      wpengineInstallName: string;
      localSiteId: string;
      wpenginePrimaryDomain: string;
    }): Promise<void>;
  };
  wpePull?: {
    pull(args: {
      includeSql?: boolean;
      wpengineInstallName: string;
      wpengineInstallId: string;
      wpengineSiteId: string;
      wpenginePrimaryDomain: string;
      localSiteId: string;
      environment?: string;
      files?: string[];
      isMagicSync?: boolean;
    }): Promise<void>;
    pullDatabase(args: {
      wpengineInstallName: string;
      localSiteId: string;
      wpenginePrimaryDomain: string;
    }): Promise<void>;
  };
  connectHistory?: {
    getEvents(siteId: string): Array<{
      remoteInstallName?: string;
      timestamp: number;
      environment: string;
      direction: 'push' | 'pull';
      status?: 'started' | 'failed' | 'completed';
    }>;
  };
  // Magic Sync change detection
  wpeConnectBase?: {
    listModifications(args: {
      connectArgs: {
        wpengineInstallName: string;
        wpengineInstallId: string;
        wpengineSiteId: string;
        wpenginePrimaryDomain: string;
        localSiteId: string;
      };
      direction: 'push' | 'pull';
      includeIgnored?: boolean;
    }): Promise<
      Array<{
        path: string;
        type: string;
        size: number;
        mtime: number;
        instruction: string;
      }>
    >;
  };
  // Phase 10: Cloud Backup services
  backup?: {
    createBackup(args: {
      site: any;
      provider: 'dropbox' | 'googleDrive';
      accountId: string;
      note?: string;
    }): Promise<{ snapshotId: string; timestamp: string }>;
    listBackups(args: {
      site: any;
      provider: 'dropbox' | 'googleDrive';
      accountId: string;
    }): Promise<
      Array<{
        snapshotId: string;
        timestamp: string;
        note?: string;
        siteDomain: string;
        services: Record<string, string>;
      }>
    >;
    restoreBackup(args: {
      site: any;
      provider: 'dropbox' | 'googleDrive';
      accountId: string;
      snapshotId: string;
    }): Promise<void>;
    deleteBackup(args: {
      site: any;
      provider: 'dropbox' | 'googleDrive';
      accountId: string;
      snapshotId: string;
    }): Promise<void>;
    downloadZip(args: {
      site: any;
      provider: 'dropbox' | 'googleDrive';
      accountId: string;
      snapshotId: string;
    }): Promise<string>; // Returns file path
    editBackupDescription(args: {
      site: any;
      provider: 'dropbox' | 'googleDrive';
      accountId: string;
      snapshotId: string;
      newDescription: string;
    }): Promise<void>;
  };
  dropbox?: {
    isAuthenticated(accountId: string): Promise<boolean>;
    getAccount(accountId: string): Promise<{ id: string; email: string } | undefined>;
  };
  googleDrive?: {
    isAuthenticated(accountId: string): Promise<boolean>;
    getAccount(accountId: string): Promise<{ id: string; email: string } | undefined>;
  };
  featureFlags?: {
    isFeatureEnabled(flag: string): boolean;
  };
  // UserData for reading cloud storage accounts
  userData?: {
    get(opts: {
      name: string;
      defaults: any;
      includeCreatedTime?: boolean;
      persistDefaults?: boolean;
      persistDefaultsEncrypted?: boolean;
    }): any;
  };
}
