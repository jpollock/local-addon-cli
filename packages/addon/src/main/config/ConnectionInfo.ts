/**
 * Connection Info Manager
 * Handles saving/loading MCP connection info for external tools
 */

import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { McpConnectionInfo } from '../../common/types';
import { CONNECTION_INFO_FILENAME } from '../../common/constants';

export class ConnectionInfoManager {
  private logger: any;

  constructor(logger: any) {
    this.logger = logger;
  }

  /**
   * Get platform-specific path for connection info file
   */
  getFilePath(): string {
    const platform = os.platform();

    switch (platform) {
      case 'darwin':
        return path.join(
          os.homedir(),
          'Library',
          'Application Support',
          'Local',
          CONNECTION_INFO_FILENAME
        );
      case 'win32':
        return path.join(process.env.APPDATA || '', 'Local', CONNECTION_INFO_FILENAME);
      case 'linux':
      default:
        return path.join(os.homedir(), '.config', 'Local', CONNECTION_INFO_FILENAME);
    }
  }

  /**
   * Save connection info to file
   */
  async save(info: McpConnectionInfo): Promise<void> {
    const filePath = this.getFilePath();

    try {
      await fs.ensureDir(path.dirname(filePath));
      await fs.writeJson(filePath, info, { spaces: 2 });
      this.logger.info(`[MCP] Connection info saved to: ${filePath}`);
    } catch (error: any) {
      this.logger.error(`[MCP] Failed to save connection info:`, error);
      throw error;
    }
  }

  /**
   * Load connection info from file
   */
  async load(): Promise<McpConnectionInfo | null> {
    const filePath = this.getFilePath();

    try {
      if (await fs.pathExists(filePath)) {
        return await fs.readJson(filePath);
      }
      return null;
    } catch (error: any) {
      this.logger.error(`[MCP] Failed to load connection info:`, error);
      return null;
    }
  }

  /**
   * Delete connection info file
   */
  async delete(): Promise<void> {
    const filePath = this.getFilePath();

    try {
      if (await fs.pathExists(filePath)) {
        await fs.remove(filePath);
        this.logger.info(`[MCP] Connection info deleted`);
      }
    } catch (error: any) {
      this.logger.error(`[MCP] Failed to delete connection info:`, error);
    }
  }
}
