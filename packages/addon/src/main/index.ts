/**
 * CLI Bridge Addon - Main Process Entry Point
 *
 * This addon extends Local's capabilities:
 * - GraphQL mutations for deleteSite, wpCli (for local-cli)
 * - MCP Server for AI tool integration (Claude Code, ChatGPT, etc.)
 */

import * as LocalMain from '@getflywheel/local/main';
import { ipcMain } from 'electron';
import gql from 'graphql-tag';
import { McpServer } from './mcp/McpServer';
import { MCP_SERVER } from '../common/constants';
import { LocalServices } from '../common/types';

const ADDON_NAME = 'MCP Server';

let mcpServer: McpServer | null = null;

/**
 * GraphQL type definitions for CLI Bridge
 */
const typeDefs = gql`
  input DeleteSiteInput {
    "The site ID to delete"
    id: ID!
    "Whether to move site files to trash (true) or just remove from Local (false)"
    trashFiles: Boolean = true
    "Whether to update the hosts file"
    updateHosts: Boolean = true
  }

  type DeleteSiteResult {
    "Whether the deletion was successful"
    success: Boolean!
    "Error message if deletion failed"
    error: String
    "The ID of the deleted site"
    siteId: ID
  }

  input WpCliInput {
    "The site ID to run WP-CLI against"
    siteId: ID!
    "WP-CLI command and arguments (e.g., ['plugin', 'list', '--format=json'])"
    args: [String!]!
    "Skip loading plugins (default: true)"
    skipPlugins: Boolean = true
    "Skip loading themes (default: true)"
    skipThemes: Boolean = true
  }

  type WpCliResult {
    "Whether the command executed successfully"
    success: Boolean!
    "Command output (stdout)"
    output: String
    "Error message if command failed"
    error: String
  }

  input CreateSiteInput {
    "Site name (required)"
    name: String!
    "PHP version (e.g., '8.2.10'). Uses Local default if not specified."
    phpVersion: String
    "Web server type"
    webServer: String
    "Database type"
    database: String
    "WordPress admin username (default: admin)"
    wpAdminUsername: String
    "WordPress admin password (default: password)"
    wpAdminPassword: String
    "WordPress admin email (default: admin@local.test)"
    wpAdminEmail: String
    "Blueprint name to create site from. Use list_blueprints to see available blueprints."
    blueprint: String
  }

  type CreateSiteResult {
    "Whether site creation was initiated successfully"
    success: Boolean!
    "Error message if creation failed"
    error: String
    "The created site ID"
    siteId: ID
    "The site name"
    siteName: String
    "The site domain"
    siteDomain: String
  }

  input OpenSiteInput {
    "The site ID to open"
    siteId: ID!
    "Path to open (default: /, use /wp-admin for admin)"
    path: String = "/"
  }

  type OpenSiteResult {
    "Whether the site was opened successfully"
    success: Boolean!
    "Error message if failed"
    error: String
    "The URL that was opened"
    url: String
  }

  input CloneSiteInput {
    "The site ID to clone"
    siteId: ID!
    "Name for the cloned site"
    newName: String!
  }

  type CloneSiteResult {
    "Whether cloning was successful"
    success: Boolean!
    "Error message if failed"
    error: String
    "The new site ID"
    newSiteId: ID
    "The new site name"
    newSiteName: String
    "The new site domain"
    newSiteDomain: String
  }

  input ExportSiteInput {
    "The site ID to export"
    siteId: ID!
    "Output directory path (default: ~/Downloads)"
    outputPath: String
  }

  type ExportSiteResult {
    "Whether export was successful"
    success: Boolean!
    "Error message if failed"
    error: String
    "Path to the exported zip file"
    exportPath: String
  }

  type Blueprint {
    "Blueprint name"
    name: String!
    "Last modified date"
    lastModified: String
    "PHP version"
    phpVersion: String
    "Web server type"
    webServer: String
    "Database type"
    database: String
  }

  type BlueprintsResult {
    "Whether query was successful"
    success: Boolean!
    "Error message if failed"
    error: String
    "List of blueprints"
    blueprints: [Blueprint!]
  }

  input SaveBlueprintInput {
    "The site ID to save as blueprint"
    siteId: ID!
    "Name for the blueprint"
    name: String!
  }

  type SaveBlueprintResult {
    "Whether save was successful"
    success: Boolean!
    "Error message if failed"
    error: String
    "The blueprint name"
    blueprintName: String
  }

  # Phase 8: WordPress Development Tools
  input ExportDatabaseInput {
    "The site ID"
    siteId: ID!
    "Output file path (optional, defaults to ~/Downloads/<site-name>.sql)"
    outputPath: String
  }

  type ExportDatabaseResult {
    "Whether export was successful"
    success: Boolean!
    "Error message if failed"
    error: String
    "Path to the exported SQL file"
    outputPath: String
  }

  input ImportDatabaseInput {
    "The site ID"
    siteId: ID!
    "Path to the SQL file to import"
    sqlPath: String!
  }

  type ImportDatabaseResult {
    "Whether import was successful"
    success: Boolean!
    "Error message if failed"
    error: String
  }

  input OpenAdminerInput {
    "The site ID"
    siteId: ID!
  }

  type OpenAdminerResult {
    "Whether opening was successful"
    success: Boolean!
    "Error message if failed"
    error: String
  }

  input TrustSslInput {
    "The site ID"
    siteId: ID!
  }

  type TrustSslResult {
    "Whether trust was successful"
    success: Boolean!
    "Error message if failed"
    error: String
  }

  input McpRenameSiteInput {
    "The site ID"
    siteId: ID!
    "New name for the site"
    newName: String!
  }

  type McpRenameSiteResult {
    "Whether rename was successful"
    success: Boolean!
    "Error message if failed"
    error: String
    "The new name"
    newName: String
  }

  input ChangePhpVersionInput {
    "The site ID"
    siteId: ID!
    "Target PHP version"
    phpVersion: String!
  }

  type ChangePhpVersionResult {
    "Whether change was successful"
    success: Boolean!
    "Error message if failed"
    error: String
    "The new PHP version"
    phpVersion: String
  }

  input ImportSiteInput {
    "Path to the zip file to import"
    zipPath: String!
    "Name for the imported site (optional)"
    siteName: String
  }

  type ImportSiteResult {
    "Whether import was successful"
    success: Boolean!
    "Error message if failed"
    error: String
    "The imported site ID"
    siteId: ID
    "The imported site name"
    siteName: String
  }

  # Phase 9: Site Configuration & Dev Tools
  input ToggleXdebugInput {
    "The site ID"
    siteId: ID!
    "Whether to enable or disable Xdebug"
    enabled: Boolean!
  }

  type ToggleXdebugResult {
    "Whether toggle was successful"
    success: Boolean!
    "Error message if failed"
    error: String
    "Current Xdebug state"
    enabled: Boolean
  }

  input GetSiteLogsInput {
    "The site ID"
    siteId: ID!
    "Type of logs to retrieve (php, nginx, mysql, all)"
    logType: String = "php"
    "Number of lines to return"
    lines: Int = 100
  }

  type LogEntry {
    "Log type"
    type: String!
    "Log content"
    content: String!
    "Log file path"
    path: String!
  }

  type GetSiteLogsResult {
    "Whether retrieval was successful"
    success: Boolean!
    "Error message if failed"
    error: String
    "Log entries"
    logs: [LogEntry!]
  }

  type ServiceInfo {
    "Service role (php, database, webserver)"
    role: String!
    "Service name"
    name: String!
    "Service version"
    version: String!
  }

  type ListServicesResult {
    "Whether listing was successful"
    success: Boolean!
    "Error message if failed"
    error: String
    "Available services"
    services: [ServiceInfo!]
  }

  extend type Mutation {
    "Create a new WordPress site with full WordPress installation"
    createSite(input: CreateSiteInput!): CreateSiteResult!

    "Delete a site from Local"
    deleteSite(input: DeleteSiteInput!): DeleteSiteResult!

    "Delete multiple sites from Local"
    deleteSites(ids: [ID!]!, trashFiles: Boolean = true): DeleteSiteResult!

    "Run a WP-CLI command against a site"
    wpCli(input: WpCliInput!): WpCliResult!

    "Open a site in the default browser"
    openSite(input: OpenSiteInput!): OpenSiteResult!

    "Clone an existing site"
    cloneSite(input: CloneSiteInput!): CloneSiteResult!

    "Export a site to a zip file"
    exportSite(input: ExportSiteInput!): ExportSiteResult!

    "Save a site as a blueprint"
    saveBlueprint(input: SaveBlueprintInput!): SaveBlueprintResult!

    # Phase 8: WordPress Development Tools
    "Export site database to SQL file"
    exportDatabase(input: ExportDatabaseInput!): ExportDatabaseResult!

    "Import SQL file into site database"
    importDatabase(input: ImportDatabaseInput!): ImportDatabaseResult!

    "Open Adminer database management UI"
    openAdminer(input: OpenAdminerInput!): OpenAdminerResult!

    "Trust site SSL certificate"
    trustSsl(input: TrustSslInput!): TrustSslResult!

    "Rename a site (MCP version)"
    mcpRenameSite(input: McpRenameSiteInput!): McpRenameSiteResult!

    "Change site PHP version"
    changePhpVersion(input: ChangePhpVersionInput!): ChangePhpVersionResult!

    "Import site from zip file"
    importSite(input: ImportSiteInput!): ImportSiteResult!

    # Phase 9: Site Configuration & Dev Tools
    "Toggle Xdebug for a site"
    toggleXdebug(input: ToggleXdebugInput!): ToggleXdebugResult!

    "Get site log files"
    getSiteLogs(input: GetSiteLogsInput!): GetSiteLogsResult!
  }

  extend type Query {
    "Run a WP-CLI command against a site (read-only operations)"
    wpCliQuery(input: WpCliInput!): WpCliResult!

    "List all available blueprints"
    blueprints: BlueprintsResult!

    "List available service versions"
    listServices(type: String): ListServicesResult!

    # Phase 11: WP Engine Connect
    "Check WP Engine authentication status"
    wpeStatus: WpeAuthStatus!

    "List all sites from WP Engine account"
    listWpeSites(accountId: String): ListWpeSitesResult!

    # Phase 11b: Site Linking
    "Get WP Engine connection details for a local site"
    getWpeLink(siteId: ID!): GetWpeLinkResult!
  }

  # Phase 11: WP Engine Connect Types
  type WpeAuthStatus {
    "Whether authenticated with WP Engine"
    authenticated: Boolean!
    "User email if authenticated"
    email: String
    "Account ID if authenticated"
    accountId: String
    "Account name if authenticated"
    accountName: String
    "Token expiry time"
    tokenExpiry: String
    "Error message if status check failed"
    error: String
  }

  type WpeAuthResult {
    "Whether authentication was successful"
    success: Boolean!
    "User email if successful"
    email: String
    "Message about the authentication result"
    message: String
    "Error message if failed"
    error: String
  }

  type WpeLogoutResult {
    "Whether logout was successful"
    success: Boolean!
    "Message about the logout result"
    message: String
    "Error message if failed"
    error: String
  }

  type WpeSite {
    "Install ID"
    id: String!
    "Install name"
    name: String!
    "Environment (production, staging, development)"
    environment: String!
    "PHP version"
    phpVersion: String
    "Primary domain"
    primaryDomain: String
    "Account ID"
    accountId: String
    "Account name"
    accountName: String
    "SFTP host"
    sftpHost: String
    "SFTP user"
    sftpUser: String
  }

  type ListWpeSitesResult {
    "Whether query was successful"
    success: Boolean!
    "Error message if failed"
    error: String
    "List of WP Engine sites"
    sites: [WpeSite!]
    "Total count of sites"
    count: Int
  }

  # Phase 11b: Site Linking Types
  type WpeConnection {
    "Remote install ID (UUID from WP Engine)"
    remoteInstallId: String!
    "Install name (human-readable, used in portal URLs)"
    installName: String
    "Environment (production, staging, development)"
    environment: String
    "Account ID"
    accountId: String
    "WP Engine portal URL"
    portalUrl: String
    "Primary domain/CNAME"
    primaryDomain: String
  }

  "Sync capabilities available for WPE-connected sites"
  type WpeSyncCapabilities {
    "Whether user can push to WP Engine"
    canPush: Boolean!
    "Whether user can pull from WP Engine"
    canPull: Boolean!
    "Available sync modes"
    syncModes: [String!]!
    "Whether Magic Sync (select files) is available"
    magicSyncAvailable: Boolean!
    "Whether database sync is available"
    databaseSyncAvailable: Boolean!
  }

  type GetWpeLinkResult {
    "Whether site is linked to WP Engine"
    linked: Boolean!
    "Site name"
    siteName: String
    "WP Engine connections"
    connections: [WpeConnection!]
    "Number of connections"
    connectionCount: Int
    "Sync capabilities (only present if linked)"
    capabilities: WpeSyncCapabilities
    "Message (for unlinked sites)"
    message: String
    "Error message if failed"
    error: String
  }

  # Phase 11c: Sync Operations Types
  type SyncHistoryEvent {
    "Remote install name"
    remoteInstallName: String
    "Unix timestamp"
    timestamp: Float!
    "Environment (production, staging, development)"
    environment: String!
    "Sync direction"
    direction: String!
    "Sync status"
    status: String
  }

  type GetSyncHistoryResult {
    "Whether the query was successful"
    success: Boolean!
    "Site name"
    siteName: String
    "Sync history events"
    events: [SyncHistoryEvent!]
    "Number of events"
    count: Int
    "Error message if failed"
    error: String
  }

  type SyncResult {
    "Whether the sync was initiated successfully"
    success: Boolean!
    "Status message"
    message: String
    "Error message if failed"
    error: String
  }

  # File change detection
  type FileChange {
    "File path relative to site root"
    path: String!
    "Change type: create, upload, download, delete, modify"
    instruction: String!
    "File size in bytes"
    size: Int
    "File type: - (file) or d (directory)"
    type: String
  }

  type GetSiteChangesResult {
    "Whether the query was successful"
    success: Boolean!
    "Site name"
    siteName: String
    "Direction of comparison"
    direction: String
    "Files that would be added/uploaded"
    added: [FileChange!]
    "Files that would be modified"
    modified: [FileChange!]
    "Files that would be deleted"
    deleted: [FileChange!]
    "Total number of changes"
    totalChanges: Int
    "Summary message"
    message: String
    "Error message if failed"
    error: String
  }

  # Phase 10: Cloud Backup Types
  type BackupProviderStatus {
    "Whether authenticated with provider"
    authenticated: Boolean!
    "Account ID"
    accountId: String
    "Account email"
    email: String
  }

  type BackupStatusResult {
    "Whether backups are available"
    available: Boolean!
    "Whether the feature is enabled"
    featureEnabled: Boolean!
    "Dropbox authentication status"
    dropbox: BackupProviderStatus
    "Google Drive authentication status"
    googleDrive: BackupProviderStatus
    "Message if backups unavailable"
    message: String
    "Error message if failed"
    error: String
  }

  type BackupMetadata {
    "Snapshot ID"
    snapshotId: String!
    "Backup timestamp (ISO format)"
    timestamp: String
    "Backup note/description"
    note: String
    "Site domain"
    siteDomain: String
    "Services info (JSON)"
    services: String
  }

  type ListBackupsResult {
    "Whether query was successful"
    success: Boolean!
    "Site name"
    siteName: String
    "Backup provider"
    provider: String
    "List of backups"
    backups: [BackupMetadata!]
    "Number of backups"
    count: Int
    "Error message if failed"
    error: String
  }

  type CreateBackupResult {
    "Whether backup was created successfully"
    success: Boolean!
    "Snapshot ID"
    snapshotId: String
    "Backup timestamp"
    timestamp: String
    "Status message"
    message: String
    "Error message if failed"
    error: String
  }

  type RestoreBackupResult {
    "Whether restore was successful"
    success: Boolean!
    "Status message"
    message: String
    "Error message if failed"
    error: String
  }

  type DeleteBackupResult {
    "Whether deletion was successful"
    success: Boolean!
    "Deleted snapshot ID"
    deletedSnapshotId: String
    "Status message"
    message: String
    "Error message if failed"
    error: String
  }

  type DownloadBackupResult {
    "Whether download was successful"
    success: Boolean!
    "Path to downloaded file"
    filePath: String
    "Status message"
    message: String
    "Error message if failed"
    error: String
  }

  type EditBackupNoteResult {
    "Whether edit was successful"
    success: Boolean!
    "Updated snapshot ID"
    snapshotId: String
    "Updated note"
    note: String
    "Error message if failed"
    error: String
  }

  extend type Query {
    # Phase 10: Cloud Backups
    "Check if cloud backups are available and authenticated"
    backupStatus: BackupStatusResult!

    "List all backups for a site"
    listBackups(siteId: ID!, provider: String!): ListBackupsResult!

    # Phase 11c: Sync Operations
    "Get sync history for a local site"
    getSyncHistory(siteId: ID!, limit: Int): GetSyncHistoryResult!

    "Get file changes between local site and WP Engine (dry-run comparison)"
    getSiteChanges(siteId: ID!, direction: String = "push"): GetSiteChangesResult!
  }

  extend type Mutation {
    # Phase 10: Cloud Backups
    "Create a backup of a site to cloud storage"
    createBackup(siteId: ID!, provider: String!, note: String): CreateBackupResult!

    "Restore a site from a cloud backup"
    restoreBackup(
      siteId: ID!
      provider: String!
      snapshotId: String!
      confirm: Boolean = false
    ): RestoreBackupResult!

    "Delete a backup from cloud storage"
    deleteBackup(
      siteId: ID!
      provider: String!
      snapshotId: String!
      confirm: Boolean = false
    ): DeleteBackupResult!

    "Download a backup as a ZIP file"
    downloadBackup(siteId: ID!, provider: String!, snapshotId: String!): DownloadBackupResult!

    "Update the note/description for a backup"
    editBackupNote(
      siteId: ID!
      provider: String!
      snapshotId: String!
      note: String!
    ): EditBackupNoteResult!

    # Phase 11: WP Engine Connect
    "Authenticate with WP Engine (opens browser for OAuth)"
    wpeAuthenticate: WpeAuthResult!

    "Logout from WP Engine"
    wpeLogout: WpeLogoutResult!

    # Phase 11c: Sync Operations
    "Push local site to WP Engine"
    pushToWpe(
      localSiteId: ID!
      remoteInstallId: ID!
      includeSql: Boolean = false
      confirm: Boolean = false
    ): SyncResult!

    "Pull from WP Engine to local site"
    pullFromWpe(localSiteId: ID!, remoteInstallId: ID!, includeSql: Boolean = false): SyncResult!
  }
`;

/**
 * Create GraphQL resolvers that use Local's internal services
 */
function createResolvers(services: any) {
  const {
    deleteSite: deleteSiteService,
    siteData,
    localLogger,
    wpCli,
    siteProcessManager,
    addSite: addSiteService,
    cloneSite: cloneSiteService,
    exportSite: exportSiteService,
    blueprints: blueprintsService,
    browserManager,
    adminer,
    x509Cert,
    siteProvisioner,
    importSite: importSiteService,
    lightningServices,
    siteDatabase,
    importSQLFile: importSQLFileService,
    // Phase 11: WP Engine Connect
    wpeOAuth: wpeOAuthService,
    capi: capiService,
    // Phase 11c: Sync services
    wpePush: wpePushService,
    wpePull: wpePullService,
    connectHistory: connectHistoryService,
    wpeConnectBase: wpeConnectBaseService,
    // Note: Phase 10 Cloud Backup services are accessed via IPC to the Cloud Backups addon
    // (backupService, dropbox, googleDrive, featureFlags, userData)
  } = services;

  // Helper to invoke IPC calls to the Cloud Backups addon
  // This uses the same pattern as the BackupAIBridge
  // Timeout constants for backup operations (in milliseconds)
  const BACKUP_IPC_TIMEOUT = 600000; // 10 minutes for backup operations
  const DEFAULT_IPC_TIMEOUT = 30000; // 30 seconds for quick operations

  const invokeBackupIPC = async (
    channel: string,
    timeoutMs: number = BACKUP_IPC_TIMEOUT,
    ...args: any[]
  ): Promise<any> => {
    return new Promise((resolve, reject) => {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substr(2, 9);
      const successReplyChannel = `${channel}-success-${timestamp}-${random}`;
      const errorReplyChannel = `${channel}-error-${timestamp}-${random}`;

      const timeoutSeconds = Math.round(timeoutMs / 1000);
      const timeout = setTimeout(() => {
        ipcMain.removeAllListeners(successReplyChannel);
        ipcMain.removeAllListeners(errorReplyChannel);
        reject(new Error(`IPC call to ${channel} timed out after ${timeoutSeconds} seconds`));
      }, timeoutMs);

      ipcMain.once(successReplyChannel, (_event: any, result: any) => {
        clearTimeout(timeout);
        ipcMain.removeAllListeners(errorReplyChannel);
        localLogger.info(`[${ADDON_NAME}] IPC success from ${channel}`);
        resolve({ result });
      });

      ipcMain.once(errorReplyChannel, (_event: any, error: any) => {
        clearTimeout(timeout);
        ipcMain.removeAllListeners(successReplyChannel);
        localLogger.error(`[${ADDON_NAME}] IPC error from ${channel}: ${error?.message}`);
        resolve({ error });
      });

      const mockEvent = {
        reply: (replyChannel: string, data: any) => {
          ipcMain.emit(replyChannel, null, data);
        },
        sender: {
          send: (replyChannel: string, data: any) => {
            ipcMain.emit(replyChannel, null, data);
          },
        },
      };

      const replyChannels = { successReplyChannel, errorReplyChannel };
      localLogger.info(`[${ADDON_NAME}] Invoking backup IPC: ${channel}`);
      ipcMain.emit(channel, mockEvent, replyChannels, ...args);
    });
  };

  // Helper to get backup providers from the Cloud Backups addon
  const getBackupProviders = async (): Promise<Array<{ id: string; name: string }>> => {
    try {
      const result = await invokeBackupIPC('backups:enabled-providers', DEFAULT_IPC_TIMEOUT);
      localLogger.info(`[${ADDON_NAME}] Raw IPC result: ${JSON.stringify(result)}`);

      if (result.error) {
        localLogger.error(
          `[${ADDON_NAME}] Failed to get backup providers: ${result.error.message}`
        );
        return [];
      }

      // The response is double-nested: result.result.result contains the array
      // Structure: { result: { result: [providers...] } }
      let providers: any = result.result;

      // Unwrap nested result if present
      if (providers && typeof providers === 'object' && !Array.isArray(providers)) {
        if (Array.isArray(providers.result)) {
          providers = providers.result;
        } else if (providers.result && typeof providers.result === 'object') {
          // Even deeper nesting
          providers = providers.result;
        }
      }

      localLogger.info(`[${ADDON_NAME}] Extracted providers: ${JSON.stringify(providers)}`);

      if (Array.isArray(providers)) {
        localLogger.info(`[${ADDON_NAME}] Got ${providers.length} backup providers`);
        return providers;
      }

      localLogger.warn(
        `[${ADDON_NAME}] Unexpected providers format after unwrapping: ${typeof providers}`
      );
      return [];
    } catch (error: any) {
      localLogger.error(`[${ADDON_NAME}] Error getting backup providers: ${error.message}`);
      return [];
    }
  };

  // Shared WP-CLI execution logic
  const executeWpCli = async (
    _parent: any,
    args: { input: { siteId: string; args: string[]; skipPlugins?: boolean; skipThemes?: boolean } }
  ) => {
    const { siteId, args: wpArgs, skipPlugins = true, skipThemes = true } = args.input;

    try {
      localLogger.info(`[${ADDON_NAME}] Running WP-CLI: wp ${wpArgs.join(' ')}`);

      const site = siteData.getSite(siteId);
      if (!site) {
        return {
          success: false,
          output: null,
          error: `Site not found: ${siteId}`,
        };
      }

      const status = await siteProcessManager.getSiteStatus(site);
      if (status !== 'running') {
        return {
          success: false,
          output: null,
          error: `Site "${site.name}" is not running. Start it first with: local-cli start ${site.name}`,
        };
      }

      const output = await wpCli.run(site, wpArgs, {
        skipPlugins,
        skipThemes,
        ignoreErrors: false,
      });

      localLogger.info(`[${ADDON_NAME}] WP-CLI completed successfully`);

      return {
        success: true,
        output: output?.trim() || '',
        error: null,
      };
    } catch (error: any) {
      localLogger.error(`[${ADDON_NAME}] WP-CLI failed:`, error);
      return {
        success: false,
        output: null,
        error: error.message || 'Unknown error',
      };
    }
  };

  return {
    Query: {
      wpCliQuery: executeWpCli,

      blueprints: async () => {
        try {
          localLogger.info(`[${ADDON_NAME}] Fetching blueprints`);

          const blueprintsList = await blueprintsService.getBlueprints();

          return {
            success: true,
            error: null,
            blueprints: blueprintsList.map((bp: any) => ({
              name: bp.name,
              lastModified: bp.lastModified,
              // Handle nested objects - extract just the name/type string
              phpVersion:
                typeof bp.phpVersion === 'object'
                  ? bp.phpVersion?.name || bp.phpVersion?.version
                  : bp.phpVersion,
              webServer:
                typeof bp.webServer === 'object'
                  ? bp.webServer?.name || bp.webServer?.type
                  : bp.webServer,
              database:
                typeof bp.database === 'object'
                  ? bp.database?.name || bp.database?.type
                  : bp.database,
            })),
          };
        } catch (error: any) {
          localLogger.error(`[${ADDON_NAME}] Failed to fetch blueprints:`, error);
          return {
            success: false,
            error: error.message || 'Unknown error',
            blueprints: [],
          };
        }
      },

      listServices: async (_parent: any, args: { type?: string }) => {
        const { type = 'all' } = args;

        try {
          localLogger.info(`[${ADDON_NAME}] Listing services (type: ${type})`);

          if (!lightningServices) {
            return {
              success: false,
              error: 'Lightning services not available',
              services: [],
            };
          }

          const roleMap: Record<string, string> = {
            php: 'php',
            database: 'mysql',
            webserver: 'nginx',
          };

          const roleFilter = type !== 'all' ? roleMap[type] : undefined;
          const registeredServices = lightningServices.getRegisteredServices(roleFilter);

          const serviceList: Array<{ role: string; name: string; version: string }> = [];

          for (const [role, versions] of Object.entries(registeredServices)) {
            for (const [version, info] of Object.entries(versions as Record<string, any>)) {
              serviceList.push({
                role,
                name: info?.name || role,
                version,
              });
            }
          }

          return {
            success: true,
            error: null,
            services: serviceList,
          };
        } catch (error: any) {
          localLogger.error(`[${ADDON_NAME}] Failed to list services:`, error);
          return {
            success: false,
            error: error.message || 'Unknown error',
            services: [],
          };
        }
      },

      // Phase 11: WP Engine Connect
      wpeStatus: async () => {
        try {
          localLogger.info(`[${ADDON_NAME}] Checking WP Engine authentication status`);

          if (!wpeOAuthService) {
            return {
              authenticated: false,
              email: null,
              accountId: null,
              accountName: null,
              tokenExpiry: null,
              error: 'WP Engine OAuth service not available',
            };
          }

          // Check if we have valid credentials by trying to get access token
          const accessToken = await wpeOAuthService.getAccessToken();

          if (!accessToken) {
            return {
              authenticated: false,
              email: null,
              accountId: null,
              accountName: null,
              tokenExpiry: null,
              error: null,
            };
          }

          // Try to get user info from CAPI if available
          let email = null;
          if (capiService) {
            try {
              const currentUser = await capiService.getCurrentUser();
              email = currentUser?.email || null;
            } catch {
              // User info not available, but still authenticated
            }
          }

          return {
            authenticated: true,
            email,
            accountId: null,
            accountName: null,
            tokenExpiry: null,
            error: null,
          };
        } catch (error: any) {
          localLogger.error(`[${ADDON_NAME}] Failed to check WPE status:`, error);
          return {
            authenticated: false,
            email: null,
            accountId: null,
            accountName: null,
            tokenExpiry: null,
            error: error.message || 'Unknown error',
          };
        }
      },

      listWpeSites: async (_parent: any, args: { accountId?: string }) => {
        const { accountId } = args;

        try {
          localLogger.info(
            `[${ADDON_NAME}] Listing WP Engine sites${accountId ? ` for account ${accountId}` : ''}`
          );

          if (!wpeOAuthService) {
            return {
              success: false,
              error: 'WP Engine OAuth service not available',
              sites: [],
              count: 0,
            };
          }

          // Check if authenticated by trying to get access token
          const accessToken = await wpeOAuthService.getAccessToken();
          if (!accessToken) {
            return {
              success: false,
              error: 'Not authenticated with WP Engine. Use wpe_authenticate first.',
              sites: [],
              count: 0,
            };
          }

          if (!capiService) {
            return {
              success: false,
              error: 'WP Engine CAPI service not available',
              sites: [],
              count: 0,
            };
          }

          // Get installs from CAPI using getInstallList
          const installs = await capiService.getInstallList();

          if (!installs) {
            return {
              success: true,
              error: null,
              sites: [],
              count: 0,
            };
          }

          const sites = installs.map((install: any) => ({
            id: install.id,
            name: install.name,
            environment: install.environment || 'production',
            phpVersion: install.phpVersion || null,
            primaryDomain: install.primaryDomain || install.cname || null,
            accountId: install.accountId || accountId || null,
            accountName: install.accountName || null,
            sftpHost: `${install.name}.ssh.wpengine.net`,
            sftpUser: install.name,
          }));

          return {
            success: true,
            error: null,
            sites,
            count: sites.length,
          };
        } catch (error: any) {
          localLogger.error(`[${ADDON_NAME}] Failed to list WPE sites:`, error);
          return {
            success: false,
            error: error.message || 'Unknown error',
            sites: [],
            count: 0,
          };
        }
      },

      // Phase 11b: Site Linking
      getWpeLink: async (_parent: any, args: { siteId: string }) => {
        const { siteId } = args;

        try {
          localLogger.info(`[${ADDON_NAME}] Getting WP Engine link for site ${siteId}`);

          // Get site from siteData
          const site = siteData.getSite(siteId);
          if (!site) {
            return {
              linked: false,
              siteName: null,
              connections: [],
              connectionCount: 0,
              message: null,
              error: `Site not found: ${siteId}`,
            };
          }

          // Get hostConnections from site
          const hostConnections = site.hostConnections || [];
          const wpeConnections = hostConnections.filter((c: any) => c.hostId === 'wpe');

          if (wpeConnections.length === 0) {
            return {
              linked: false,
              siteName: site.name,
              connections: [],
              connectionCount: 0,
              message:
                'Site is not linked to any WP Engine environment. Use Connect in Local to pull a site from WPE.',
              error: null,
            };
          }

          // Transform connections for output, enriching with CAPI data if available
          const connections = await Promise.all(
            wpeConnections.map(async (c: any) => {
              let installName = c.remoteSiteId; // Default to UUID
              let portalUrl = null;
              let primaryDomain = null;

              // Try to get install details from CAPI to get the actual name
              // remoteSiteId matches install.site.id (WPE Site ID), not install.id
              if (capiService && typeof capiService.getInstallList === 'function') {
                try {
                  localLogger.info(
                    `[${ADDON_NAME}] Looking for install with site.id=${c.remoteSiteId}, env=${c.remoteSiteEnv}`
                  );
                  const installs = await capiService.getInstallList();
                  localLogger.info(
                    `[${ADDON_NAME}] Got ${installs?.length || 0} installs from CAPI`
                  );
                  if (installs && installs.length > 0) {
                    // Log first install structure for debugging
                    localLogger.info(
                      `[${ADDON_NAME}] Sample install structure: ${JSON.stringify(installs[0], null, 2)}`
                    );

                    // Match by site.id (remoteSiteId is the WPE Site ID, not Install ID)
                    // Also filter by environment if available
                    const matchingInstall = installs.find(
                      (i: any) =>
                        i.site?.id === c.remoteSiteId &&
                        (!c.remoteSiteEnv || i.environment === c.remoteSiteEnv)
                    );

                    if (matchingInstall) {
                      localLogger.info(`[${ADDON_NAME}] Found match: ${matchingInstall.name}`);
                      installName = matchingInstall.name;
                      portalUrl = `https://my.wpengine.com/installs/${matchingInstall.name}`;
                      primaryDomain =
                        matchingInstall.primary_domain || matchingInstall.cname || null;
                    } else {
                      localLogger.warn(
                        `[${ADDON_NAME}] No matching install found for site.id=${c.remoteSiteId}`
                      );
                    }
                  }
                } catch (e: any) {
                  localLogger.warn(
                    `[${ADDON_NAME}] Could not look up install from CAPI: ${e.message}`
                  );
                }
              } else {
                localLogger.warn(`[${ADDON_NAME}] capiService or getInstallList not available`);
              }

              return {
                remoteInstallId: c.remoteSiteId,
                installName,
                environment: c.remoteSiteEnv || null,
                accountId: c.accountId || null,
                portalUrl,
                primaryDomain,
              };
            })
          );

          // Capabilities are always the same for WPE-connected sites
          const capabilities = {
            canPush: true,
            canPull: true,
            syncModes: ['all_files', 'select_files', 'database_only'],
            magicSyncAvailable: true,
            databaseSyncAvailable: true,
          };

          return {
            linked: true,
            siteName: site.name,
            connections,
            connectionCount: connections.length,
            capabilities,
            message: null,
            error: null,
          };
        } catch (error: any) {
          localLogger.error(`[${ADDON_NAME}] Failed to get WPE link:`, error);
          return {
            linked: false,
            siteName: null,
            connections: [],
            connectionCount: 0,
            message: null,
            error: error.message || 'Unknown error',
          };
        }
      },

      // Phase 10: Cloud Backups
      backupStatus: async () => {
        try {
          localLogger.info(`[${ADDON_NAME}] Checking backup status`);

          // Get providers from Cloud Backups addon via IPC
          const providers = await getBackupProviders();
          localLogger.info(`[${ADDON_NAME}] Got ${providers.length} backup providers`);

          if (providers.length === 0) {
            return {
              available: false,
              featureEnabled: false,
              dropbox: null,
              googleDrive: null,
              message:
                'No cloud storage providers configured. Connect Google Drive or Dropbox in Local Hub (hub.localwp.com/addons/cloud-backups).',
              error: null,
            };
          }

          // Map provider info to our response format
          const dropboxProvider = providers.find(
            (p: any) => p.id === 'dropbox' || p.name?.toLowerCase().includes('dropbox')
          ) as any;
          const googleProvider = providers.find(
            (p: any) => p.id === 'google' || p.name?.toLowerCase().includes('google')
          ) as any;

          const dropboxStatus = dropboxProvider
            ? {
                authenticated: true,
                accountId: dropboxProvider.id,
                email: dropboxProvider.email || null,
              }
            : {
                authenticated: false,
                accountId: null as string | null,
                email: null as string | null,
              };

          const googleDriveStatus = googleProvider
            ? {
                authenticated: true,
                accountId: googleProvider.id,
                email: googleProvider.email || null,
              }
            : {
                authenticated: false,
                accountId: null as string | null,
                email: null as string | null,
              };

          const hasProvider = providers.length > 0;

          return {
            available: hasProvider,
            featureEnabled: true,
            dropbox: dropboxStatus,
            googleDrive: googleDriveStatus,
            message: hasProvider
              ? null
              : 'No cloud storage provider authenticated. Connect Dropbox or Google Drive in Local settings.',
            error: null,
          };
        } catch (error: any) {
          localLogger.error(`[${ADDON_NAME}] Failed to check backup status:`, error);
          return {
            available: false,
            featureEnabled: false,
            dropbox: null,
            googleDrive: null,
            message: null,
            error: error.message || 'Unknown error',
          };
        }
      },

      listBackups: async (_parent: any, args: { siteId: string; provider: string }) => {
        const { siteId, provider } = args;

        try {
          localLogger.info(`[${ADDON_NAME}] Listing backups for site ${siteId} from ${provider}`);

          // Get site
          const site = siteData.getSite(siteId);
          if (!site) {
            return {
              success: false,
              siteName: null,
              provider,
              backups: [],
              count: 0,
              error: `Site not found: ${siteId}`,
            };
          }

          // Get providers from Cloud Backups addon
          const providers = await getBackupProviders();
          if (providers.length === 0) {
            return {
              success: false,
              siteName: site.name,
              provider,
              backups: [],
              count: 0,
              error:
                'No cloud storage providers configured. Connect Google Drive or Dropbox in Local Hub.',
            };
          }

          // Find the matching provider (map 'googleDrive' to 'google' for the addon)
          const providerMap: Record<string, string> = { googleDrive: 'google', dropbox: 'dropbox' };
          const providerId = providerMap[provider] || provider;
          const matchedProvider = providers.find((p: any) => p.id === providerId);

          if (!matchedProvider) {
            return {
              success: false,
              siteName: site.name,
              provider,
              backups: [],
              count: 0,
              error: `Provider '${provider}' not configured. Available: ${providers.map((p: any) => p.name).join(', ')}`,
            };
          }

          // For listing snapshots, use the Hub provider ID directly (e.g., 'google')
          // NOT the rclone backend name ('drive') - the Hub queries expect the OAuth provider name
          // Also pass pageOffset parameter (0 for first page)
          const result = await invokeBackupIPC(
            'backups:provider-snapshots',
            DEFAULT_IPC_TIMEOUT,
            siteId,
            matchedProvider.id,
            0
          );
          localLogger.info(
            `[${ADDON_NAME}] Provider snapshots raw result: ${JSON.stringify(result)}`
          );

          if (result.error) {
            return {
              success: false,
              siteName: site.name,
              provider,
              backups: [],
              count: 0,
              error: result.error.message || 'Failed to list backups',
            };
          }

          // Unwrap nested result structure (similar to providers)
          let backupsData = result.result;
          if (backupsData && typeof backupsData === 'object' && !Array.isArray(backupsData)) {
            // Check for nested result or snapshots array
            if (Array.isArray(backupsData.result)) {
              backupsData = backupsData.result;
            } else if (Array.isArray(backupsData.snapshots)) {
              backupsData = backupsData.snapshots;
            } else if (backupsData.result && Array.isArray(backupsData.result.snapshots)) {
              backupsData = backupsData.result.snapshots;
            }
          }

          const backups = Array.isArray(backupsData) ? backupsData : [];
          localLogger.info(`[${ADDON_NAME}] Extracted ${backups.length} backups`);

          return {
            success: true,
            siteName: site.name,
            provider,
            backups: backups.map((b: any) => ({
              // Use hash for snapshotId as that's what restic uses for restore/delete operations
              // The Hub ID (b.id) is just a database identifier
              snapshotId: b.hash || b.snapshotId || b.short_id,
              timestamp: b.updatedAt || b.createdAt || b.timestamp || b.time || b.created,
              note:
                b.configObject?.description || b.note || b.description || b.tags?.description || '',
              siteDomain: b.configObject?.name
                ? `${b.configObject.name}.local`
                : b.siteDomain || site.domain,
              services: JSON.stringify(b.configObject?.services || b.services || {}),
            })),
            count: backups.length,
            error: null,
          };
        } catch (error: any) {
          localLogger.error(`[${ADDON_NAME}] Failed to list backups:`, error);
          return {
            success: false,
            siteName: null,
            provider,
            backups: [],
            count: 0,
            error: error.message || 'Unknown error',
          };
        }
      },

      // Phase 11c: Sync History
      getSyncHistory: async (_parent: any, args: { siteId: string; limit?: number }) => {
        const { siteId, limit = 30 } = args;

        try {
          localLogger.info(`[${ADDON_NAME}] Getting sync history for site ${siteId}`);

          // Get site to verify it exists
          const site = siteData.getSite(siteId);
          if (!site) {
            return {
              success: false,
              siteName: null,
              events: [],
              count: 0,
              error: `Site not found: ${siteId}`,
            };
          }

          // Check if connectHistory service is available
          if (!connectHistoryService || typeof connectHistoryService.getEvents !== 'function') {
            return {
              success: false,
              siteName: site.name,
              events: [],
              count: 0,
              error: 'Sync history service not available',
            };
          }

          const events = connectHistoryService.getEvents(siteId);
          const limitedEvents = events.slice(0, limit);

          return {
            success: true,
            siteName: site.name,
            events: limitedEvents.map((e: any) => ({
              remoteInstallName: e.remoteInstallName || null,
              timestamp: e.timestamp,
              environment: e.environment,
              direction: e.direction,
              status: e.status || null,
            })),
            count: limitedEvents.length,
            error: null,
          };
        } catch (error: any) {
          localLogger.error(`[${ADDON_NAME}] Failed to get sync history:`, error);
          return {
            success: false,
            siteName: null,
            events: [],
            count: 0,
            error: error.message || 'Unknown error',
          };
        }
      },

      // Get file changes between local and WPE (dry-run comparison)
      getSiteChanges: async (_parent: any, args: { siteId: string; direction?: string }) => {
        const { siteId, direction = 'push' } = args;

        try {
          localLogger.info(
            `[${ADDON_NAME}] Getting site changes for ${siteId}, direction=${direction}`
          );

          // Validate direction
          if (direction !== 'push' && direction !== 'pull') {
            return {
              success: false,
              siteName: null,
              direction,
              added: [],
              modified: [],
              deleted: [],
              totalChanges: 0,
              message: null,
              error: 'Invalid direction. Must be "push" or "pull".',
            };
          }

          // Get site
          const site = siteData.getSite(siteId);
          if (!site) {
            return {
              success: false,
              siteName: null,
              direction,
              added: [],
              modified: [],
              deleted: [],
              totalChanges: 0,
              message: null,
              error: `Site not found: ${siteId}`,
            };
          }

          // Check WPE connection
          const wpeConnection = site.hostConnections?.find((c: any) => c.hostId === 'wpe');
          if (!wpeConnection) {
            return {
              success: false,
              siteName: site.name,
              direction,
              added: [],
              modified: [],
              deleted: [],
              totalChanges: 0,
              message: null,
              error:
                'Site is not linked to WP Engine. Use Connect in Local to link the site first.',
            };
          }

          // Check service availability
          if (
            !wpeConnectBaseService ||
            typeof wpeConnectBaseService.listModifications !== 'function'
          ) {
            return {
              success: false,
              siteName: site.name,
              direction,
              added: [],
              modified: [],
              deleted: [],
              totalChanges: 0,
              message: null,
              error: 'WPE Connect service not available',
            };
          }

          // Get install details from CAPI
          let installName = wpeConnection.remoteSiteId;
          let primaryDomain = '';
          let installId = '';

          if (capiService && typeof capiService.getInstallList === 'function') {
            const installs = await capiService.getInstallList();
            const matchingInstall = installs?.find(
              (i: any) =>
                i.site?.id === wpeConnection.remoteSiteId &&
                (!wpeConnection.remoteSiteEnv || i.environment === wpeConnection.remoteSiteEnv)
            );
            if (matchingInstall) {
              installName = matchingInstall.name;
              primaryDomain =
                matchingInstall.primary_domain ||
                matchingInstall.cname ||
                `${matchingInstall.name}.wpengine.com`;
              installId = matchingInstall.id;
            }
          }

          if (!primaryDomain) {
            return {
              success: false,
              siteName: site.name,
              direction,
              added: [],
              modified: [],
              deleted: [],
              totalChanges: 0,
              message: null,
              error:
                'Could not determine WP Engine install details. Please ensure you are authenticated.',
            };
          }

          // Call listModifications (dry-run rsync comparison)
          localLogger.info(`[${ADDON_NAME}] Calling listModifications for ${installName}`);
          const modifications = await wpeConnectBaseService.listModifications({
            connectArgs: {
              wpengineInstallName: installName,
              wpengineInstallId: installId,
              wpengineSiteId: wpeConnection.remoteSiteId,
              wpenginePrimaryDomain: primaryDomain,
              localSiteId: site.id,
            },
            direction: direction as 'push' | 'pull',
            includeIgnored: false,
          });

          // Categorize changes
          const added = modifications
            .filter(
              (f: any) =>
                f.instruction === 'create' ||
                f.instruction === 'upload' ||
                f.instruction === 'download'
            )
            .map((f: any) => ({
              path: f.path,
              instruction: f.instruction,
              size: f.size,
              type: f.type,
            }));

          const modified = modifications
            .filter((f: any) => f.instruction === 'modify')
            .map((f: any) => ({
              path: f.path,
              instruction: f.instruction,
              size: f.size,
              type: f.type,
            }));

          const deleted = modifications
            .filter((f: any) => f.instruction === 'delete')
            .map((f: any) => ({
              path: f.path,
              instruction: f.instruction,
              size: f.size,
              type: f.type,
            }));

          const totalChanges = added.length + modified.length + deleted.length;
          const directionLabel = direction === 'push' ? 'local → WPE' : 'WPE → local';

          return {
            success: true,
            siteName: site.name,
            direction,
            added,
            modified,
            deleted,
            totalChanges,
            message:
              totalChanges > 0
                ? `${totalChanges} file(s) changed (${directionLabel}): ${added.length} added, ${modified.length} modified, ${deleted.length} deleted`
                : `No changes detected (${directionLabel})`,
            error: null,
          };
        } catch (error: any) {
          localLogger.error(`[${ADDON_NAME}] Failed to get site changes:`, error);
          return {
            success: false,
            siteName: null,
            direction,
            added: [],
            modified: [],
            deleted: [],
            totalChanges: 0,
            message: null,
            error: error.message || 'Unknown error',
          };
        }
      },
    },
    Mutation: {
      wpCli: executeWpCli,

      createSite: async (
        _parent: any,
        args: {
          input: {
            name: string;
            phpVersion?: string;
            webServer?: string;
            database?: string;
            wpAdminUsername?: string;
            wpAdminPassword?: string;
            wpAdminEmail?: string;
            blueprint?: string;
          };
        }
      ) => {
        // DEBUG: Log raw args received
        localLogger.info(`[${ADDON_NAME}] createSite called with args: ${JSON.stringify(args)}`);

        const {
          name,
          phpVersion,
          webServer = 'nginx',
          database = 'mysql',
          wpAdminUsername = 'admin',
          wpAdminPassword = 'password',
          wpAdminEmail = 'admin@local.test',
          blueprint,
        } = args.input;

        // DEBUG: Log destructured values
        localLogger.info(
          `[${ADDON_NAME}] Destructured - name: ${name}, blueprint: ${blueprint}, typeof blueprint: ${typeof blueprint}`
        );

        try {
          localLogger.info(
            `[${ADDON_NAME}] Creating site: ${name}${blueprint ? ` from blueprint: ${blueprint}` : ''}`
          );

          // Generate slug and domain from name
          const siteSlug = name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
          const siteDomain = `${siteSlug}.local`;

          const os = require('os');
          const path = require('path');
          const fs = require('fs');
          const sitePath = path.join(os.homedir(), 'Local Sites', siteSlug);

          // If blueprint is provided, use importSiteService instead of addSiteService
          if (blueprint) {
            localLogger.info(`[${ADDON_NAME}] Blueprint parameter received: ${blueprint}`);

            // Get the userDataPath from electron app
            const { app } = require('electron');
            const userDataPath = app.getPath('userData');
            const blueprintZipPath = path.join(userDataPath, 'blueprints', `${blueprint}.zip`);

            localLogger.info(`[${ADDON_NAME}] Looking for blueprint at: ${blueprintZipPath}`);

            // Verify blueprint exists
            if (!fs.existsSync(blueprintZipPath)) {
              localLogger.error(`[${ADDON_NAME}] Blueprint not found at: ${blueprintZipPath}`);
              return {
                success: false,
                error: `Blueprint not found: ${blueprint}. Use list_blueprints to see available blueprints.`,
                siteId: null,
                siteName: name,
                siteDomain: null,
              };
            }

            localLogger.info(`[${ADDON_NAME}] Found blueprint at: ${blueprintZipPath}`);

            // Read the local-site.json from the blueprint zip to get manifest
            let localSiteJSON: any;
            try {
              const StreamZip = require('node-stream-zip');
              localLogger.info(`[${ADDON_NAME}] node-stream-zip loaded successfully`);

              const zip = new StreamZip.async({ file: blueprintZipPath });
              const entries = await zip.entries();
              localLogger.info(
                `[${ADDON_NAME}] Zip entries loaded, count: ${Object.keys(entries).length}`
              );

              const filename = entries['local-site.json']
                ? 'local-site.json'
                : 'pressmatic-site.json';
              localLogger.info(`[${ADDON_NAME}] Reading manifest file: ${filename}`);

              const data = await zip.entryData(filename);
              localSiteJSON = JSON.parse(data.toString('utf8'));
              await zip.close();
              localLogger.info(
                `[${ADDON_NAME}] Successfully read manifest:`,
                JSON.stringify(localSiteJSON).substring(0, 200)
              );
            } catch (zipError: any) {
              localLogger.error(
                `[${ADDON_NAME}] Failed to read blueprint zip: ${zipError.message}`,
                zipError
              );
              return {
                success: false,
                error: `Failed to read blueprint manifest: ${zipError.message}`,
                siteId: null,
                siteName: name,
                siteDomain: null,
              };
            }

            // Build import settings
            const importSettings: any = {
              siteName: name,
              siteDomain: siteDomain,
              sitePath: sitePath,
              zip: blueprintZipPath,
              importData: {
                type: 'local-blueprint',
                oldSite: localSiteJSON,
              },
              environment: localSiteJSON.environment || 'flywheel',
              blueprint: blueprint,
            };

            // Copy service versions from blueprint if available
            if (localSiteJSON.services) {
              // Extract PHP version
              const phpService = Object.values(localSiteJSON.services).find(
                (s: any) => s.role === 'php'
              ) as any;
              if (phpService) {
                importSettings.phpVersion = phpService.version;
              }

              // Extract database
              const dbService = Object.values(localSiteJSON.services).find(
                (s: any) => s.role === 'database' || s.role === 'db'
              ) as any;
              if (dbService) {
                importSettings.database = `${dbService.name}-${dbService.version}`;
              }

              // Extract web server
              const webService = Object.values(localSiteJSON.services).find(
                (s: any) => s.role === 'http' || s.role === 'web'
              ) as any;
              if (webService) {
                importSettings.webServer = `${webService.name}-${webService.version}`;
              }
            } else if (localSiteJSON.phpVersion) {
              importSettings.phpVersion = localSiteJSON.phpVersion;
            }

            localLogger.info(
              `[${ADDON_NAME}] Import settings prepared:`,
              JSON.stringify(importSettings).substring(0, 500)
            );

            if (!importSiteService) {
              localLogger.error(`[${ADDON_NAME}] importSiteService is not available!`);
              return {
                success: false,
                error: 'Import service not available',
                siteId: null,
                siteName: name,
                siteDomain: null,
              };
            }

            localLogger.info(`[${ADDON_NAME}] Calling importSiteService.run()...`);

            // Use the importSiteService to create from blueprint
            const importResult = await importSiteService.run(importSettings);

            localLogger.info(
              `[${ADDON_NAME}] Import result:`,
              JSON.stringify(importResult || 'null').substring(0, 500)
            );

            if (importResult && importResult.id) {
              localLogger.info(
                `[${ADDON_NAME}] Successfully created site from blueprint: ${name} (${importResult.id})`
              );
              return {
                success: true,
                error: null,
                siteId: importResult.id,
                siteName: name,
                siteDomain: siteDomain,
              };
            } else {
              localLogger.warn(`[${ADDON_NAME}] Import returned but no site ID found`);
              return {
                success: true,
                error: null,
                siteId: null,
                siteName: name,
                siteDomain: siteDomain,
              };
            }
          }

          // No blueprint - create a fresh site
          const newSiteInfo: any = {
            siteName: name,
            siteDomain: siteDomain,
            sitePath: sitePath,
            webServer: webServer,
            database: database,
          };

          if (phpVersion) {
            newSiteInfo.phpVersion = phpVersion;
          }

          const wpCredentials = {
            adminUsername: wpAdminUsername,
            adminPassword: wpAdminPassword,
            adminEmail: wpAdminEmail,
          };

          const site = await addSiteService.addSite({
            newSiteInfo,
            wpCredentials,
            goToSite: false,
          });

          localLogger.info(`[${ADDON_NAME}] Successfully created site: ${name} (${site.id})`);

          return {
            success: true,
            error: null,
            siteId: site.id,
            siteName: name,
            siteDomain: siteDomain,
          };
        } catch (error: any) {
          localLogger.error(`[${ADDON_NAME}] Failed to create site:`, error);
          return {
            success: false,
            error: error.message || 'Unknown error',
            siteId: null,
            siteName: name,
            siteDomain: null,
          };
        }
      },

      deleteSite: async (
        _parent: any,
        args: { input: { id: string; trashFiles?: boolean; updateHosts?: boolean } }
      ) => {
        const { id, trashFiles = true, updateHosts = true } = args.input;

        try {
          localLogger.info(`[${ADDON_NAME}] Deleting site: ${id}`);

          const site = siteData.getSite(id);
          if (!site) {
            return {
              success: false,
              error: `Site not found: ${id}`,
              siteId: id,
            };
          }

          await deleteSiteService.deleteSite({
            site,
            trashFiles,
            updateHosts,
          });

          localLogger.info(`[${ADDON_NAME}] Successfully deleted site: ${site.name}`);

          return {
            success: true,
            error: null,
            siteId: id,
          };
        } catch (error: any) {
          localLogger.error(`[${ADDON_NAME}] Failed to delete site:`, error);
          return {
            success: false,
            error: error.message || 'Unknown error',
            siteId: id,
          };
        }
      },

      deleteSites: async (_parent: any, args: { ids: string[]; trashFiles?: boolean }) => {
        const { ids, trashFiles = true } = args;

        try {
          localLogger.info(`[${ADDON_NAME}] Deleting ${ids.length} sites`);

          await deleteSiteService.deleteSites({
            siteIds: ids,
            trashFiles,
            updateHosts: true,
          });

          localLogger.info(`[${ADDON_NAME}] Successfully deleted ${ids.length} sites`);

          return {
            success: true,
            error: null,
            siteId: ids.join(','),
          };
        } catch (error: any) {
          localLogger.error(`[${ADDON_NAME}] Failed to delete sites:`, error);
          return {
            success: false,
            error: error.message || 'Unknown error',
            siteId: ids.join(','),
          };
        }
      },

      openSite: async (_parent: any, args: { input: { siteId: string; path?: string } }) => {
        const { siteId, path = '/' } = args.input;

        try {
          const site = siteData.getSite(siteId);
          if (!site) {
            return {
              success: false,
              error: `Site not found: ${siteId}`,
              url: null,
            };
          }

          // Check if site is running
          const status = await siteProcessManager.getSiteStatus(site);
          if (status !== 'running') {
            return {
              success: false,
              error: `Site "${site.name}" must be running to open in browser. Start it first.`,
              url: null,
            };
          }

          const protocol = site.isStarred ? 'https' : 'http';
          const url = `${protocol}://${site.domain}${path}`;

          localLogger.info(`[${ADDON_NAME}] Opening site in browser: ${url}`);

          if (browserManager) {
            await browserManager.openInBrowser(url);
          } else {
            // Fallback to shell.openExternal
            const { shell } = require('electron');
            await shell.openExternal(url);
          }

          return {
            success: true,
            error: null,
            url,
          };
        } catch (error: any) {
          localLogger.error(`[${ADDON_NAME}] Failed to open site:`, error);
          return {
            success: false,
            error: error.message || 'Unknown error',
            url: null,
          };
        }
      },

      cloneSite: async (_parent: any, args: { input: { siteId: string; newName: string } }) => {
        const { siteId, newName } = args.input;

        try {
          const site = siteData.getSite(siteId);
          if (!site) {
            return {
              success: false,
              error: `Site not found: ${siteId}`,
              newSiteId: null,
              newSiteName: null,
              newSiteDomain: null,
            };
          }

          // Check if site is running - needed for database cloning
          const status = await siteProcessManager.getSiteStatus(site);
          if (status !== 'running') {
            return {
              success: false,
              error: `Site "${site.name}" must be running to clone. Start it first.`,
              newSiteId: null,
              newSiteName: null,
              newSiteDomain: null,
            };
          }

          localLogger.info(`[${ADDON_NAME}] Cloning site ${site.name} to ${newName}`);

          const newSite = await cloneSiteService.cloneSite({
            site,
            newSiteName: newName,
          });

          localLogger.info(
            `[${ADDON_NAME}] Successfully cloned site: ${newSite.name} (${newSite.id})`
          );

          return {
            success: true,
            error: null,
            newSiteId: newSite.id,
            newSiteName: newSite.name,
            newSiteDomain: newSite.domain,
          };
        } catch (error: any) {
          localLogger.error(`[${ADDON_NAME}] Failed to clone site:`, error);
          return {
            success: false,
            error: error.message || 'Unknown error',
            newSiteId: null,
            newSiteName: null,
            newSiteDomain: null,
          };
        }
      },

      exportSite: async (
        _parent: any,
        args: { input: { siteId: string; outputPath?: string } }
      ) => {
        const { siteId, outputPath } = args.input;
        const os = require('os');
        const path = require('path');

        try {
          const site = siteData.getSite(siteId);
          if (!site) {
            return {
              success: false,
              error: `Site not found: ${siteId}`,
              exportPath: null,
            };
          }

          // Check if site is running - needed for database export
          const status = await siteProcessManager.getSiteStatus(site);
          if (status !== 'running') {
            return {
              success: false,
              error: `Site "${site.name}" must be running to export. Start it first.`,
              exportPath: null,
            };
          }

          // Default to Downloads folder
          const outputDir = outputPath || path.join(os.homedir(), 'Downloads');
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
          const fileName = `${site.name}-${timestamp}.zip`;
          const fullPath = path.join(outputDir, fileName);

          localLogger.info(`[${ADDON_NAME}] Exporting site ${site.name} to ${fullPath}`);

          // Use default export filter (excludes archive files)
          const defaultExportFilter = '*.zip, *.tar.gz, *.bz2, *.tgz';

          await exportSiteService.exportSite({
            site,
            outputPath: fullPath,
            filter: defaultExportFilter,
          });

          localLogger.info(`[${ADDON_NAME}] Successfully exported site to: ${fullPath}`);

          return {
            success: true,
            error: null,
            exportPath: fullPath,
          };
        } catch (error: any) {
          localLogger.error(`[${ADDON_NAME}] Failed to export site:`, error);
          return {
            success: false,
            error: error.message || 'Unknown error',
            exportPath: null,
          };
        }
      },

      saveBlueprint: async (_parent: any, args: { input: { siteId: string; name: string } }) => {
        const { siteId, name } = args.input;

        try {
          const site = siteData.getSite(siteId);
          if (!site) {
            return {
              success: false,
              error: `Site not found: ${siteId}`,
              blueprintName: null,
            };
          }

          // Check if site is running - needed for database export
          const status = await siteProcessManager.getSiteStatus(site);
          if (status !== 'running') {
            return {
              success: false,
              error: `Site "${site.name}" must be running to save as blueprint. Start it first.`,
              blueprintName: null,
            };
          }

          localLogger.info(`[${ADDON_NAME}] Saving site ${site.name} as blueprint: ${name}`);

          // Use default export filter (excludes archive files)
          const defaultFilter = '*.zip, *.tar.gz, *.bz2, *.tgz';

          await blueprintsService.saveBlueprint({
            name,
            siteId,
            filter: defaultFilter,
          });

          localLogger.info(`[${ADDON_NAME}] Successfully saved blueprint: ${name}`);

          return {
            success: true,
            error: null,
            blueprintName: name,
          };
        } catch (error: any) {
          localLogger.error(`[${ADDON_NAME}] Failed to save blueprint:`, error);
          return {
            success: false,
            error: error.message || 'Unknown error',
            blueprintName: null,
          };
        }
      },

      // Phase 8: WordPress Development Tools
      exportDatabase: async (
        _parent: any,
        args: { input: { siteId: string; outputPath?: string } }
      ) => {
        const { siteId, outputPath } = args.input;
        const os = require('os');
        const pathModule = require('path');

        try {
          const site = siteData.getSite(siteId);
          if (!site) {
            return {
              success: false,
              error: `Site not found: ${siteId}`,
              outputPath: null,
            };
          }

          // Check if site is running - database must be accessible
          const status = await siteProcessManager.getSiteStatus(site);
          if (status !== 'running') {
            return {
              success: false,
              error: `Site "${site.name}" must be running to export database. Start it first.`,
              outputPath: null,
            };
          }

          // Default to Downloads folder with site name
          const defaultPath = pathModule.join(
            os.homedir(),
            'Downloads',
            `${site.name.replace(/[^a-z0-9]/gi, '-')}.sql`
          );
          const finalPath = outputPath || defaultPath;

          localLogger.info(`[${ADDON_NAME}] Exporting database for ${site.name} to ${finalPath}`);

          // Use siteDatabase.dump() which properly sets up MySQL environment
          if (!siteDatabase) {
            return {
              success: false,
              error: 'Database service not available',
              outputPath: null,
            };
          }

          await siteDatabase.dump(site, finalPath);

          localLogger.info(`[${ADDON_NAME}] Successfully exported database to: ${finalPath}`);

          return {
            success: true,
            error: null,
            outputPath: finalPath,
          };
        } catch (error: any) {
          localLogger.error(`[${ADDON_NAME}] Failed to export database:`, error);
          return {
            success: false,
            error: error.message || 'Unknown error',
            outputPath: null,
          };
        }
      },

      importDatabase: async (
        _parent: any,
        args: { input: { siteId: string; sqlPath: string } }
      ) => {
        const { siteId, sqlPath } = args.input;
        const fs = require('fs');

        try {
          const site = siteData.getSite(siteId);
          if (!site) {
            return {
              success: false,
              error: `Site not found: ${siteId}`,
            };
          }

          if (!fs.existsSync(sqlPath)) {
            return {
              success: false,
              error: `SQL file not found: ${sqlPath}`,
            };
          }

          // Check if site is running - database must be accessible
          const status = await siteProcessManager.getSiteStatus(site);
          if (status !== 'running') {
            return {
              success: false,
              error: `Site "${site.name}" must be running to import database. Start it first.`,
            };
          }

          localLogger.info(`[${ADDON_NAME}] Importing database for ${site.name} from ${sqlPath}`);

          // Use importSQLFile service which properly sets up MySQL environment
          if (!importSQLFileService) {
            return {
              success: false,
              error: 'Import SQL file service not available',
            };
          }

          await importSQLFileService(site, sqlPath);

          localLogger.info(`[${ADDON_NAME}] Successfully imported database from: ${sqlPath}`);

          return {
            success: true,
            error: null,
          };
        } catch (error: any) {
          localLogger.error(`[${ADDON_NAME}] Failed to import database:`, error);
          return {
            success: false,
            error: error.message || 'Unknown error',
          };
        }
      },

      openAdminer: async (_parent: any, args: { input: { siteId: string } }) => {
        const { siteId } = args.input;

        try {
          const site = siteData.getSite(siteId);
          if (!site) {
            return {
              success: false,
              error: `Site not found: ${siteId}`,
            };
          }

          // Check if site is running - database must be accessible
          const status = await siteProcessManager.getSiteStatus(site);
          if (status !== 'running') {
            return {
              success: false,
              error: `Site "${site.name}" must be running to open Adminer. Start it first.`,
            };
          }

          localLogger.info(`[${ADDON_NAME}] Opening Adminer for ${site.name}`);

          if (adminer) {
            await adminer.open(site);
          } else {
            return {
              success: false,
              error: 'Adminer service not available',
            };
          }

          return {
            success: true,
            error: null,
          };
        } catch (error: any) {
          localLogger.error(`[${ADDON_NAME}] Failed to open Adminer:`, error);
          return {
            success: false,
            error: error.message || 'Unknown error',
          };
        }
      },

      trustSsl: async (_parent: any, args: { input: { siteId: string } }) => {
        const { siteId } = args.input;

        try {
          const site = siteData.getSite(siteId);
          if (!site) {
            return {
              success: false,
              error: `Site not found: ${siteId}`,
            };
          }

          localLogger.info(`[${ADDON_NAME}] Trusting SSL for ${site.name}`);

          if (x509Cert) {
            await x509Cert.trustCert(site);
          } else {
            return {
              success: false,
              error: 'X509 certificate service not available',
            };
          }

          return {
            success: true,
            error: null,
          };
        } catch (error: any) {
          localLogger.error(`[${ADDON_NAME}] Failed to trust SSL:`, error);
          return {
            success: false,
            error: error.message || 'Unknown error',
          };
        }
      },

      mcpRenameSite: async (_parent: any, args: { input: { siteId: string; newName: string } }) => {
        const { siteId, newName } = args.input;

        try {
          const site = siteData.getSite(siteId);
          if (!site) {
            return {
              success: false,
              error: `Site not found: ${siteId}`,
              newName: null,
            };
          }

          localLogger.info(`[${ADDON_NAME}] Renaming ${site.name} to ${newName}`);

          // Update site name via siteData
          site.name = newName;
          await siteData.updateSite(siteId, { name: newName });

          localLogger.info(`[${ADDON_NAME}] Successfully renamed site to: ${newName}`);

          return {
            success: true,
            error: null,
            newName,
          };
        } catch (error: any) {
          localLogger.error(`[${ADDON_NAME}] Failed to rename site:`, error);
          return {
            success: false,
            error: error.message || 'Unknown error',
            newName: null,
          };
        }
      },

      changePhpVersion: async (
        _parent: any,
        args: { input: { siteId: string; phpVersion: string } }
      ) => {
        const { siteId, phpVersion } = args.input;

        try {
          const site = siteData.getSite(siteId);
          if (!site) {
            return {
              success: false,
              error: `Site not found: ${siteId}`,
              phpVersion: null,
            };
          }

          localLogger.info(
            `[${ADDON_NAME}] Changing PHP version for ${site.name} to ${phpVersion}`
          );

          if (siteProvisioner) {
            await siteProvisioner.swapService(site, 'php', phpVersion);
          } else {
            return {
              success: false,
              error: 'Site provisioner service not available',
              phpVersion: null,
            };
          }

          localLogger.info(`[${ADDON_NAME}] Successfully changed PHP version to: ${phpVersion}`);

          return {
            success: true,
            error: null,
            phpVersion,
          };
        } catch (error: any) {
          localLogger.error(`[${ADDON_NAME}] Failed to change PHP version:`, error);
          return {
            success: false,
            error: error.message || 'Unknown error',
            phpVersion: null,
          };
        }
      },

      importSite: async (_parent: any, args: { input: { zipPath: string; siteName?: string } }) => {
        const { zipPath, siteName } = args.input;
        const fs = require('fs');

        try {
          if (!fs.existsSync(zipPath)) {
            return {
              success: false,
              error: `Zip file not found: ${zipPath}`,
              siteId: null,
              siteName: null,
            };
          }

          localLogger.info(`[${ADDON_NAME}] Importing site from ${zipPath}`);

          if (!importSiteService) {
            return {
              success: false,
              error: 'Import site service not available',
              siteId: null,
              siteName: null,
            };
          }

          const result = await importSiteService.run({
            zipPath,
            siteName: siteName || undefined,
          });

          localLogger.info(`[${ADDON_NAME}] Successfully imported site: ${result.name}`);

          return {
            success: true,
            error: null,
            siteId: result.id,
            siteName: result.name,
          };
        } catch (error: any) {
          localLogger.error(`[${ADDON_NAME}] Failed to import site:`, error);
          return {
            success: false,
            error: error.message || 'Unknown error',
            siteId: null,
            siteName: null,
          };
        }
      },

      // Phase 9: Site Configuration & Dev Tools
      toggleXdebug: async (_parent: any, args: { input: { siteId: string; enabled: boolean } }) => {
        const { siteId, enabled } = args.input;

        try {
          const site = siteData.getSite(siteId);
          if (!site) {
            return {
              success: false,
              error: `Site not found: ${siteId}`,
              enabled: null,
            };
          }

          localLogger.info(
            `[${ADDON_NAME}] ${enabled ? 'Enabling' : 'Disabling'} Xdebug for ${site.name}`
          );

          // Update the site's xdebugEnabled property
          await siteData.updateSite(siteId, { xdebugEnabled: enabled });

          // Restart the site if it's running to apply the change
          const status = await siteProcessManager.getSiteStatus(site);
          if (status === 'running') {
            localLogger.info(`[${ADDON_NAME}] Restarting site to apply Xdebug change`);
            await siteProcessManager.restart(site);
          }

          localLogger.info(
            `[${ADDON_NAME}] Successfully ${enabled ? 'enabled' : 'disabled'} Xdebug`
          );

          return {
            success: true,
            error: null,
            enabled,
          };
        } catch (error: any) {
          localLogger.error(`[${ADDON_NAME}] Failed to toggle Xdebug:`, error);
          return {
            success: false,
            error: error.message || 'Unknown error',
            enabled: null,
          };
        }
      },

      getSiteLogs: async (
        _parent: any,
        args: { input: { siteId: string; logType?: string; lines?: number } }
      ) => {
        const { siteId, logType = 'php', lines = 100 } = args.input;
        const fs = require('fs');
        const fsPromises = fs.promises;
        const pathModule = require('path');

        // Helper for async file existence check
        const fileExists = async (filePath: string): Promise<boolean> => {
          try {
            await fsPromises.access(filePath);
            return true;
          } catch {
            return false;
          }
        };

        // Helper to read last N lines of a file
        const readLastLines = async (filePath: string, numLines: number): Promise<string> => {
          try {
            const content = await fsPromises.readFile(filePath, 'utf-8');
            const logLines = content.split('\n');
            return logLines.slice(-numLines).join('\n') || '(empty)';
          } catch {
            return '';
          }
        };

        try {
          const site = siteData.getSite(siteId);
          if (!site) {
            return {
              success: false,
              error: `Site not found: ${siteId}`,
              logs: [],
            };
          }

          localLogger.info(`[${ADDON_NAME}] Getting ${logType} logs for ${site.name}`);

          const logs: Array<{ type: string; content: string; path: string }> = [];
          const logsDir = pathModule.join(site.path, 'logs');

          const logFiles: Record<string, string[]> = {
            php: ['php', 'php-fpm'],
            nginx: ['nginx'],
            mysql: ['mysql'],
            all: ['php', 'php-fpm', 'nginx', 'mysql'],
          };

          const targetLogs = logFiles[logType] || logFiles.php;

          for (const logName of targetLogs) {
            // Check for error and access logs
            for (const suffix of ['error.log', 'access.log', '.log']) {
              const logPath = pathModule.join(
                logsDir,
                `${logName}${suffix === '.log' ? '' : '/'}${suffix}`
              );
              const altLogPath = pathModule.join(logsDir, `${logName}${suffix}`);

              let finalPath: string | null = null;
              if (await fileExists(logPath)) {
                finalPath = logPath;
              } else if (await fileExists(altLogPath)) {
                finalPath = altLogPath;
              }

              if (finalPath) {
                const content = await readLastLines(finalPath, lines);
                if (content) {
                  logs.push({
                    type: logName,
                    content,
                    path: finalPath,
                  });
                }
              }
            }
          }

          if (logs.length === 0) {
            // Try to find any log files
            if (await fileExists(logsDir)) {
              const entries = await fsPromises.readdir(logsDir, { withFileTypes: true });
              for (const entry of entries) {
                if (entry.isDirectory()) {
                  const subDir = pathModule.join(logsDir, entry.name);
                  const subEntries = await fsPromises.readdir(subDir);
                  for (const subFile of subEntries) {
                    if (subFile.endsWith('.log')) {
                      const logPath = pathModule.join(subDir, subFile);
                      const content = await readLastLines(logPath, lines);
                      if (content) {
                        logs.push({
                          type: entry.name,
                          content,
                          path: logPath,
                        });
                      }
                    }
                  }
                } else if (entry.name.endsWith('.log')) {
                  const logPath = pathModule.join(logsDir, entry.name);
                  const content = await readLastLines(logPath, lines);
                  if (content) {
                    logs.push({
                      type: entry.name.replace('.log', ''),
                      content,
                      path: logPath,
                    });
                  }
                }
              }
            }
          }

          return {
            success: true,
            error: null,
            logs,
          };
        } catch (error: any) {
          localLogger.error(`[${ADDON_NAME}] Failed to get logs:`, error);
          return {
            success: false,
            error: error.message || 'Unknown error',
            logs: [],
          };
        }
      },

      // Phase 10: Cloud Backup Mutations
      createBackup: async (
        _parent: any,
        args: { siteId: string; provider: string; note?: string }
      ) => {
        const { siteId, provider, note } = args;

        try {
          localLogger.info(`[${ADDON_NAME}] Creating backup for site ${siteId} to ${provider}`);

          // Get site
          const site = siteData.getSite(siteId);
          if (!site) {
            return {
              success: false,
              snapshotId: null,
              timestamp: null,
              message: null,
              error: `Site not found: ${siteId}`,
            };
          }

          // Get providers from Cloud Backups addon
          const providers = await getBackupProviders();
          if (providers.length === 0) {
            return {
              success: false,
              snapshotId: null,
              timestamp: null,
              message: null,
              error:
                'No cloud storage providers configured. Connect Google Drive or Dropbox in Local Hub.',
            };
          }

          // Find the matching provider (map 'googleDrive' to 'google' for the addon)
          const providerMap: Record<string, string> = { googleDrive: 'google', dropbox: 'dropbox' };
          const providerId = providerMap[provider] || provider;
          const matchedProvider = providers.find((p: any) => p.id === providerId);

          if (!matchedProvider) {
            return {
              success: false,
              snapshotId: null,
              timestamp: null,
              message: null,
              error: `Provider '${provider}' not configured. Available: ${providers.map((p: any) => p.name).join(', ')}`,
            };
          }

          // Map the Hub provider ID to rclone backend name
          // The addon uses 'google' in enabled-providers but expects 'drive' for backup operations
          const backupProviderMap: Record<string, string> = { google: 'drive', dropbox: 'dropbox' };
          const backupProviderId = backupProviderMap[matchedProvider.id] || matchedProvider.id;
          localLogger.info(
            `[${ADDON_NAME}] Using backup provider ID: ${backupProviderId} (from ${matchedProvider.id})`
          );

          // Create backup via IPC (use long timeout for backup operations)
          const description = note || 'Backup created via MCP';
          const result = await invokeBackupIPC(
            'backups:backup-site',
            BACKUP_IPC_TIMEOUT,
            siteId,
            backupProviderId,
            description
          );
          localLogger.info(`[${ADDON_NAME}] Backup IPC result: ${JSON.stringify(result)}`);

          // Check for top-level IPC error
          if (result.error) {
            return {
              success: false,
              snapshotId: null,
              timestamp: null,
              message: null,
              error: result.error.message || 'Backup creation failed',
            };
          }

          // Unwrap nested result structure - the actual result is at result.result
          const backupResult = result.result;

          // Check if the backup result contains an error (nested at result.result.error)
          if (backupResult?.error) {
            const errorMsg =
              backupResult.error.message || backupResult.error.original?.message || 'Backup failed';
            return {
              success: false,
              snapshotId: null,
              timestamp: null,
              message: null,
              error: errorMsg,
            };
          }

          // Try to extract snapshot ID (may be nested in result.result.result)
          let snapshotId = backupResult?.snapshotId || backupResult?.id;
          if (!snapshotId && backupResult?.result) {
            snapshotId = backupResult.result.snapshotId || backupResult.result.id;
          }

          // If no error was returned, the backup succeeded even if no snapshot ID is provided
          // The addon doesn't always return the snapshot ID in its IPC response
          return {
            success: true,
            snapshotId: snapshotId || null,
            timestamp: new Date().toISOString(),
            message: `Backup created successfully to ${matchedProvider.name}`,
            error: null,
          };
        } catch (error: any) {
          localLogger.error(`[${ADDON_NAME}] Failed to create backup:`, error);
          return {
            success: false,
            snapshotId: null,
            timestamp: null,
            message: null,
            error: error.message || 'Unknown error',
          };
        }
      },

      restoreBackup: async (
        _parent: any,
        args: { siteId: string; provider: string; snapshotId: string; confirm?: boolean }
      ) => {
        const { siteId, provider, snapshotId, confirm = false } = args;

        try {
          localLogger.info(`[${ADDON_NAME}] Restoring backup ${snapshotId} for site ${siteId}`);

          // Check confirmation
          if (!confirm) {
            return {
              success: false,
              message: null,
              error:
                'Restore requires confirm=true to prevent accidental data loss. Current site files and database will be overwritten.',
            };
          }

          // Get site
          const site = siteData.getSite(siteId);
          if (!site) {
            return {
              success: false,
              message: null,
              error: `Site not found: ${siteId}`,
            };
          }

          // Get providers from Cloud Backups addon
          const providers = await getBackupProviders();
          if (providers.length === 0) {
            return {
              success: false,
              message: null,
              error:
                'No cloud storage providers configured. Connect Google Drive or Dropbox in Local Hub.',
            };
          }

          // Find the matching provider (map 'googleDrive' to 'google' for the addon)
          const providerMap: Record<string, string> = { googleDrive: 'google', dropbox: 'dropbox' };
          const providerId = providerMap[provider] || provider;
          const matchedProvider = providers.find((p: any) => p.id === providerId);

          if (!matchedProvider) {
            return {
              success: false,
              message: null,
              error: `Provider '${provider}' not configured. Available: ${providers.map((p: any) => p.name).join(', ')}`,
            };
          }

          // Map the Hub provider ID to rclone backend name
          const backupProviderMap: Record<string, string> = { google: 'drive', dropbox: 'dropbox' };
          const backupProviderId = backupProviderMap[matchedProvider.id] || matchedProvider.id;

          // Restore backup via IPC (use long timeout for restore operations)
          const result = await invokeBackupIPC(
            'backups:restore-backup',
            BACKUP_IPC_TIMEOUT,
            siteId,
            backupProviderId,
            snapshotId
          );
          localLogger.info(`[${ADDON_NAME}] Restore result: ${JSON.stringify(result)}`);

          // Check for errors - can be at result.error or result.result.error (IPC async pattern)
          const ipcError = result.error || result.result?.error;
          if (ipcError) {
            const errorMessage =
              typeof ipcError === 'string' ? ipcError : ipcError.message || 'Restore failed';
            return {
              success: false,
              message: null,
              error: errorMessage,
            };
          }

          return {
            success: true,
            message: `Site restored from backup ${snapshotId}`,
            error: null,
          };
        } catch (error: any) {
          localLogger.error(`[${ADDON_NAME}] Failed to restore backup:`, error);
          return {
            success: false,
            message: null,
            error: error.message || 'Unknown error',
          };
        }
      },

      deleteBackup: async (
        _parent: any,
        args: { siteId: string; provider: string; snapshotId: string; confirm?: boolean }
      ) => {
        const { siteId, provider, snapshotId, confirm = false } = args;

        try {
          localLogger.info(`[${ADDON_NAME}] Deleting backup ${snapshotId} for site ${siteId}`);

          // Check confirmation
          if (!confirm) {
            return {
              success: false,
              deletedSnapshotId: null,
              message: null,
              error: 'Delete requires confirm=true to prevent accidental deletion.',
            };
          }

          // Get site
          const site = siteData.getSite(siteId);
          if (!site) {
            return {
              success: false,
              deletedSnapshotId: null,
              message: null,
              error: `Site not found: ${siteId}`,
            };
          }

          // Get providers from Cloud Backups addon
          const providers = await getBackupProviders();
          if (providers.length === 0) {
            return {
              success: false,
              deletedSnapshotId: null,
              message: null,
              error:
                'No cloud storage providers configured. Connect Google Drive or Dropbox in Local Hub.',
            };
          }

          // Find the matching provider (map 'googleDrive' to 'google' for the addon)
          const providerMap: Record<string, string> = { googleDrive: 'google', dropbox: 'dropbox' };
          const providerId = providerMap[provider] || provider;
          const matchedProvider = providers.find((p: any) => p.id === providerId);

          if (!matchedProvider) {
            return {
              success: false,
              deletedSnapshotId: null,
              message: null,
              error: `Provider '${provider}' not configured. Available: ${providers.map((p: any) => p.name).join(', ')}`,
            };
          }

          // Map the Hub provider ID to rclone backend name
          const backupProviderMap: Record<string, string> = { google: 'drive', dropbox: 'dropbox' };
          const backupProviderId = backupProviderMap[matchedProvider.id] || matchedProvider.id;

          // Try to delete backup via IPC (may not be supported by the addon)
          const result = await invokeBackupIPC(
            'backups:delete-backup',
            DEFAULT_IPC_TIMEOUT,
            siteId,
            backupProviderId,
            snapshotId
          );

          if (result.error) {
            // If the IPC channel doesn't exist or isn't supported, provide helpful message
            if (result.error.message?.includes('timed out')) {
              return {
                success: false,
                deletedSnapshotId: null,
                message: null,
                error:
                  'Delete backup operation is not available via MCP. Please delete backups through the Local UI.',
              };
            }
            return {
              success: false,
              deletedSnapshotId: null,
              message: null,
              error: result.error.message || 'Delete failed',
            };
          }

          return {
            success: true,
            deletedSnapshotId: snapshotId,
            message: 'Backup deleted',
            error: null,
          };
        } catch (error: any) {
          localLogger.error(`[${ADDON_NAME}] Failed to delete backup:`, error);
          return {
            success: false,
            deletedSnapshotId: null,
            message: null,
            error: error.message || 'Unknown error',
          };
        }
      },

      downloadBackup: async (
        _parent: any,
        args: { siteId: string; provider: string; snapshotId: string }
      ) => {
        const { siteId, provider, snapshotId } = args;

        try {
          localLogger.info(`[${ADDON_NAME}] Downloading backup ${snapshotId} for site ${siteId}`);

          // Get site
          const site = siteData.getSite(siteId);
          if (!site) {
            return {
              success: false,
              filePath: null,
              message: null,
              error: `Site not found: ${siteId}`,
            };
          }

          // Get providers from Cloud Backups addon
          const providers = await getBackupProviders();
          if (providers.length === 0) {
            return {
              success: false,
              filePath: null,
              message: null,
              error:
                'No cloud storage providers configured. Connect Google Drive or Dropbox in Local Hub.',
            };
          }

          // Find the matching provider (map 'googleDrive' to 'google' for the addon)
          const providerMap: Record<string, string> = { googleDrive: 'google', dropbox: 'dropbox' };
          const providerId = providerMap[provider] || provider;
          const matchedProvider = providers.find((p: any) => p.id === providerId);

          if (!matchedProvider) {
            return {
              success: false,
              filePath: null,
              message: null,
              error: `Provider '${provider}' not configured. Available: ${providers.map((p: any) => p.name).join(', ')}`,
            };
          }

          // Map the Hub provider ID to rclone backend name
          const backupProviderMap: Record<string, string> = { google: 'drive', dropbox: 'dropbox' };
          const backupProviderId = backupProviderMap[matchedProvider.id] || matchedProvider.id;

          // Try to download backup via IPC (use long timeout for downloads)
          const result = await invokeBackupIPC(
            'backups:download-backup',
            BACKUP_IPC_TIMEOUT,
            siteId,
            backupProviderId,
            snapshotId
          );

          if (result.error) {
            // If the IPC channel doesn't exist or isn't supported, provide helpful message
            if (result.error.message?.includes('timed out')) {
              return {
                success: false,
                filePath: null,
                message: null,
                error:
                  'Download backup operation is not available via MCP. Please download backups through the Local UI.',
              };
            }
            return {
              success: false,
              filePath: null,
              message: null,
              error: result.error.message || 'Download failed',
            };
          }

          return {
            success: true,
            filePath: result.result?.filePath || null,
            message: 'Backup downloaded to Downloads folder',
            error: null,
          };
        } catch (error: any) {
          localLogger.error(`[${ADDON_NAME}] Failed to download backup:`, error);
          return {
            success: false,
            filePath: null,
            message: null,
            error: error.message || 'Unknown error',
          };
        }
      },

      editBackupNote: async (
        _parent: any,
        args: { siteId: string; provider: string; snapshotId: string; note: string }
      ) => {
        const { siteId, provider, snapshotId, note } = args;

        try {
          localLogger.info(`[${ADDON_NAME}] Editing backup note for ${snapshotId}`);

          // Get site
          const site = siteData.getSite(siteId);
          if (!site) {
            return {
              success: false,
              snapshotId: null,
              note: null,
              error: `Site not found: ${siteId}`,
            };
          }

          // Get providers from Cloud Backups addon
          const providers = await getBackupProviders();
          if (providers.length === 0) {
            return {
              success: false,
              snapshotId: null,
              note: null,
              error:
                'No cloud storage providers configured. Connect Google Drive or Dropbox in Local Hub.',
            };
          }

          // Find the matching provider (map 'googleDrive' to 'google' for the addon)
          const providerMap: Record<string, string> = { googleDrive: 'google', dropbox: 'dropbox' };
          const providerId = providerMap[provider] || provider;
          const matchedProvider = providers.find((p: any) => p.id === providerId);

          if (!matchedProvider) {
            return {
              success: false,
              snapshotId: null,
              note: null,
              error: `Provider '${provider}' not configured. Available: ${providers.map((p: any) => p.name).join(', ')}`,
            };
          }

          // Map the Hub provider ID to rclone backend name
          const backupProviderMap: Record<string, string> = { google: 'drive', dropbox: 'dropbox' };
          const backupProviderId = backupProviderMap[matchedProvider.id] || matchedProvider.id;

          // Try to edit backup note via IPC (quick metadata operation)
          const result = await invokeBackupIPC(
            'backups:edit-note',
            DEFAULT_IPC_TIMEOUT,
            siteId,
            backupProviderId,
            snapshotId,
            note
          );

          if (result.error) {
            // If the IPC channel doesn't exist or isn't supported, provide helpful message
            if (result.error.message?.includes('timed out')) {
              return {
                success: false,
                snapshotId: null,
                note: null,
                error:
                  'Edit backup note operation is not available via MCP. Please edit backup notes through the Local UI.',
              };
            }
            return {
              success: false,
              snapshotId: null,
              note: null,
              error: result.error.message || 'Edit note failed',
            };
          }

          return {
            success: true,
            snapshotId,
            note,
            error: null,
          };
        } catch (error: any) {
          localLogger.error(`[${ADDON_NAME}] Failed to edit backup note:`, error);
          return {
            success: false,
            snapshotId: null,
            note: null,
            error: error.message || 'Unknown error',
          };
        }
      },

      // Phase 11: WP Engine Connect
      wpeAuthenticate: async () => {
        try {
          localLogger.info(`[${ADDON_NAME}] Initiating WP Engine authentication`);

          if (!wpeOAuthService) {
            return {
              success: false,
              email: null,
              message: null,
              error: 'WP Engine OAuth service not available',
            };
          }

          // Trigger OAuth flow - this will open browser for user consent
          // authenticate() returns OAuthTokens on success
          const tokens = await wpeOAuthService.authenticate();

          if (tokens && tokens.accessToken) {
            // Try to get user email from CAPI
            let email = null;
            if (capiService) {
              try {
                const currentUser = await capiService.getCurrentUser();
                email = currentUser?.email || null;
              } catch {
                // User info not available
              }
            }

            localLogger.info(
              `[${ADDON_NAME}] Successfully authenticated with WPE${email ? ` as ${email}` : ''}`
            );
            return {
              success: true,
              email,
              message: 'Successfully authenticated with WP Engine',
              error: null,
            };
          }

          return {
            success: true,
            email: null,
            message: 'Authentication initiated. Please complete the login in your browser.',
            error: null,
          };
        } catch (error: any) {
          localLogger.error(`[${ADDON_NAME}] WPE authentication failed:`, error);
          return {
            success: false,
            email: null,
            message: null,
            error: error.message || 'Authentication failed',
          };
        }
      },

      wpeLogout: async () => {
        try {
          localLogger.info(`[${ADDON_NAME}] Logging out from WP Engine`);

          if (!wpeOAuthService) {
            return {
              success: false,
              message: null,
              error: 'WP Engine OAuth service not available',
            };
          }

          // clearTokens() is the logout method
          await wpeOAuthService.clearTokens();

          localLogger.info(`[${ADDON_NAME}] Successfully logged out from WPE`);
          return {
            success: true,
            message: 'Logged out from WP Engine',
            error: null,
          };
        } catch (error: any) {
          localLogger.error(`[${ADDON_NAME}] WPE logout failed:`, error);
          return {
            success: false,
            message: null,
            error: error.message || 'Logout failed',
          };
        }
      },

      // Phase 11c: Push to WP Engine
      pushToWpe: async (
        _parent: any,
        args: {
          localSiteId: string;
          remoteInstallId: string;
          includeSql?: boolean;
          confirm?: boolean;
        }
      ) => {
        const { localSiteId, remoteInstallId, includeSql = false, confirm = false } = args;

        try {
          localLogger.info(
            `[${ADDON_NAME}] Push to WPE: site=${localSiteId}, remote=${remoteInstallId}, includeSql=${includeSql}`
          );

          // Require confirmation for push operations
          if (!confirm) {
            return {
              success: false,
              message: null,
              error:
                'Push requires confirm=true to prevent accidental overwrites. Set confirm=true to proceed.',
            };
          }

          // Verify site exists
          const site = siteData.getSite(localSiteId);
          if (!site) {
            return {
              success: false,
              message: null,
              error: `Site not found: ${localSiteId}`,
            };
          }

          // Check WPE connection exists
          const wpeConnection = site.hostConnections?.find((c: any) => c.hostId === 'wpe');
          if (!wpeConnection) {
            return {
              success: false,
              message: null,
              error:
                'Site is not linked to WP Engine. Use Connect in Local to link the site first.',
            };
          }

          // Check push service availability
          if (!wpePushService || typeof wpePushService.push !== 'function') {
            return {
              success: false,
              message: null,
              error: 'WPE Push service not available',
            };
          }

          // Get install details from CAPI to get required parameters
          let installName = remoteInstallId;
          let primaryDomain = '';
          let installId = '';

          if (capiService && typeof capiService.getInstallList === 'function') {
            const installs = await capiService.getInstallList();
            const matchingInstall = installs?.find(
              (i: any) =>
                i.site?.id === wpeConnection.remoteSiteId &&
                (!wpeConnection.remoteSiteEnv || i.environment === wpeConnection.remoteSiteEnv)
            );
            if (matchingInstall) {
              installName = matchingInstall.name;
              primaryDomain =
                matchingInstall.primary_domain ||
                matchingInstall.cname ||
                `${matchingInstall.name}.wpengine.com`;
              installId = matchingInstall.id;
            }
          }

          if (!primaryDomain) {
            return {
              success: false,
              message: null,
              error:
                'Could not determine WP Engine install details. Please ensure you are authenticated.',
            };
          }

          // Start the push operation (async - returns immediately)
          wpePushService
            .push({
              includeSql,
              wpengineInstallName: installName,
              wpengineInstallId: installId,
              wpengineSiteId: wpeConnection.remoteSiteId,
              wpenginePrimaryDomain: primaryDomain,
              localSiteId: site.id,
              environment: wpeConnection.remoteSiteEnv,
              isMagicSync: false,
            })
            .catch((err: any) => {
              localLogger.error(`[${ADDON_NAME}] Push failed:`, err);
            });

          return {
            success: true,
            message: `Push started to ${installName}. Check Local UI for progress.`,
            error: null,
          };
        } catch (error: any) {
          localLogger.error(`[${ADDON_NAME}] Failed to start push:`, error);
          return {
            success: false,
            message: null,
            error: error.message || 'Failed to start push',
          };
        }
      },

      // Phase 11c: Pull from WP Engine
      pullFromWpe: async (
        _parent: any,
        args: {
          localSiteId: string;
          remoteInstallId: string;
          includeSql?: boolean;
        }
      ) => {
        const { localSiteId, remoteInstallId, includeSql = false } = args;

        try {
          localLogger.info(
            `[${ADDON_NAME}] Pull from WPE: site=${localSiteId}, remote=${remoteInstallId}, includeSql=${includeSql}`
          );

          // Verify site exists
          const site = siteData.getSite(localSiteId);
          if (!site) {
            return {
              success: false,
              message: null,
              error: `Site not found: ${localSiteId}`,
            };
          }

          // Check WPE connection exists
          const wpeConnection = site.hostConnections?.find((c: any) => c.hostId === 'wpe');
          if (!wpeConnection) {
            return {
              success: false,
              message: null,
              error:
                'Site is not linked to WP Engine. Use Connect in Local to link the site first.',
            };
          }

          // Check pull service availability
          if (!wpePullService || typeof wpePullService.pull !== 'function') {
            return {
              success: false,
              message: null,
              error: 'WPE Pull service not available',
            };
          }

          // Get install details from CAPI
          let installName = remoteInstallId;
          let primaryDomain = '';
          let installId = '';

          if (capiService && typeof capiService.getInstallList === 'function') {
            const installs = await capiService.getInstallList();
            const matchingInstall = installs?.find(
              (i: any) =>
                i.site?.id === wpeConnection.remoteSiteId &&
                (!wpeConnection.remoteSiteEnv || i.environment === wpeConnection.remoteSiteEnv)
            );
            if (matchingInstall) {
              installName = matchingInstall.name;
              primaryDomain =
                matchingInstall.primary_domain ||
                matchingInstall.cname ||
                `${matchingInstall.name}.wpengine.com`;
              installId = matchingInstall.id;
            }
          }

          if (!primaryDomain) {
            return {
              success: false,
              message: null,
              error:
                'Could not determine WP Engine install details. Please ensure you are authenticated.',
            };
          }

          // Start the pull operation (async - returns immediately)
          wpePullService
            .pull({
              includeSql,
              wpengineInstallName: installName,
              wpengineInstallId: installId,
              wpengineSiteId: wpeConnection.remoteSiteId,
              wpenginePrimaryDomain: primaryDomain,
              localSiteId: site.id,
              environment: wpeConnection.remoteSiteEnv,
              isMagicSync: false,
            })
            .catch((err: any) => {
              localLogger.error(`[${ADDON_NAME}] Pull failed:`, err);
            });

          return {
            success: true,
            message: `Pull started from ${installName}. Check Local UI for progress.`,
            error: null,
          };
        } catch (error: any) {
          localLogger.error(`[${ADDON_NAME}] Failed to start pull:`, error);
          return {
            success: false,
            message: null,
            error: error.message || 'Failed to start pull',
          };
        }
      },
    },
  };
}

/**
 * Start the MCP server
 */
async function startMcpServer(services: LocalServices, logger: any): Promise<void> {
  if (mcpServer) {
    logger.warn(`[${ADDON_NAME}] MCP server already running`);
    return;
  }

  try {
    mcpServer = new McpServer({ port: MCP_SERVER.DEFAULT_PORT }, services, logger);

    await mcpServer.start();

    const info = mcpServer.getConnectionInfo();
    logger.info(`[${ADDON_NAME}] MCP server started on port ${info.port}`);
    logger.info(
      `[${ADDON_NAME}] MCP connection info saved to: ~/Library/Application Support/Local/mcp-connection-info.json`
    );
    logger.info(`[${ADDON_NAME}] Available tools: ${info.tools.join(', ')}`);
  } catch (error: any) {
    logger.error(`[${ADDON_NAME}] Failed to start MCP server:`, error);
  }
}

/**
 * Stop the MCP server
 */
async function stopMcpServer(logger: any): Promise<void> {
  if (mcpServer) {
    await mcpServer.stop();
    mcpServer = null;
    logger.info(`[${ADDON_NAME}] MCP server stopped`);
  }
}

/**
 * Register IPC handlers for renderer communication
 */
function registerIpcHandlers(services: LocalServices, logger: any): void {
  // Get MCP server status
  ipcMain.handle('mcp:getStatus', async () => {
    if (!mcpServer) {
      return { running: false, port: 0, uptime: 0 };
    }
    return mcpServer.getStatus();
  });

  // Get connection info
  ipcMain.handle('mcp:getConnectionInfo', async () => {
    if (!mcpServer) {
      return null;
    }
    return mcpServer.getConnectionInfo();
  });

  // Start MCP server
  ipcMain.handle('mcp:start', async () => {
    try {
      await startMcpServer(services, logger);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Stop MCP server
  ipcMain.handle('mcp:stop', async () => {
    try {
      await stopMcpServer(logger);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Restart MCP server
  ipcMain.handle('mcp:restart', async () => {
    try {
      await stopMcpServer(logger);
      await startMcpServer(services, logger);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Regenerate auth token
  ipcMain.handle('mcp:regenerateToken', async () => {
    if (!mcpServer) {
      return { success: false, error: 'MCP server not running' };
    }
    try {
      const newToken = await mcpServer.regenerateToken();
      return { success: true, token: newToken };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  logger.info(
    `[${ADDON_NAME}] Registered IPC handlers: mcp:getStatus, mcp:getConnectionInfo, mcp:start, mcp:stop, mcp:restart, mcp:regenerateToken`
  );
}

/**
 * Main addon initialization function
 */
export default function (_context: LocalMain.AddonMainContext): void {
  const services = LocalMain.getServiceContainer().cradle as any;
  const { localLogger, graphql } = services;

  try {
    localLogger.info(`[${ADDON_NAME}] Initializing...`);

    // Register GraphQL extensions (for local-cli and MCP)
    const resolvers = createResolvers(services);
    graphql.registerGraphQLService('mcp-server', typeDefs, resolvers);
    localLogger.info(`[${ADDON_NAME}] Registered GraphQL: 29 tools (Phase 1-11b)`);

    // Start MCP server (for AI tools)
    const localServices: LocalServices = {
      siteData: services.siteData,
      siteProcessManager: services.siteProcessManager,
      wpCli: services.wpCli,
      deleteSite: services.deleteSite,
      addSite: services.addSite,
      localLogger: services.localLogger,
      adminer: services.adminer,
      x509Cert: services.x509Cert,
      siteProvisioner: services.siteProvisioner,
      importSite: services.importSite,
      lightningServices: services.lightningServices,
      // Phase 11: WP Engine Connect
      wpeOAuth: services.wpeOAuth,
      capi: services.capi,
    };

    // MCP server disabled - CLI-only mode
    // To enable MCP server for AI tool integration, uncomment the following:
    // startMcpServer(localServices, localLogger);
    // registerIpcHandlers(localServices, localLogger);

    localLogger.info(`[${ADDON_NAME}] Successfully initialized (CLI-only mode)`);
  } catch (error: any) {
    localLogger.error(`[${ADDON_NAME}] Failed to initialize:`, error);
  }
}
