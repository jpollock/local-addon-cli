/**
 * list_services Tool
 * List available Lightning Services (PHP, MySQL, Nginx versions)
 */

import { McpToolDefinition, McpToolResult, LocalServices } from '../../../common/types';

export const listServicesDefinition: McpToolDefinition = {
  name: 'list_services',
  description: 'List available service versions (PHP, MySQL, Nginx) that can be used with sites',
  inputSchema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['php', 'database', 'webserver', 'all'],
        description: 'Type of services to list (default: all)',
      },
    },
  },
};

interface ListServicesArgs {
  type?: 'php' | 'database' | 'webserver' | 'all';
}

export async function listServices(
  args: Record<string, unknown>,
  services: LocalServices
): Promise<McpToolResult> {
  const { type = 'all' } = args as unknown as ListServicesArgs;

  try {
    // Check if lightningServices is available
    if (!services.lightningServices) {
      return {
        content: [{ type: 'text', text: 'Lightning Services not available' }],
        isError: true,
      };
    }

    const registeredServices = services.lightningServices.getRegisteredServices();

    if (!registeredServices) {
      return {
        content: [{ type: 'text', text: 'No services registered' }],
        isError: true,
      };
    }

    const results: string[] = [];

    // Helper to format service list
    const formatServices = (serviceName: string, serviceData: any): string[] => {
      const versions: string[] = [];
      if (serviceData && typeof serviceData === 'object') {
        for (const version of Object.keys(serviceData)) {
          const info = serviceData[version];
          const label = info?.label || serviceName;
          versions.push(`  - ${version}${label !== serviceName ? ` (${label})` : ''}`);
        }
      }
      return versions;
    };

    // PHP versions
    if (type === 'all' || type === 'php') {
      results.push('PHP Versions:');
      const phpVersions = formatServices('php', registeredServices.php);
      if (phpVersions.length > 0) {
        results.push(...phpVersions);
      } else {
        results.push('  [No PHP versions installed]');
      }
    }

    // Database versions (MySQL and MariaDB)
    if (type === 'all' || type === 'database') {
      results.push('\nDatabase Versions:');

      if (registeredServices.mysql) {
        results.push('  MySQL:');
        const mysqlVersions = formatServices('mysql', registeredServices.mysql);
        if (mysqlVersions.length > 0) {
          results.push(...mysqlVersions.map((v) => '  ' + v));
        }
      }

      if (registeredServices.mariadb) {
        results.push('  MariaDB:');
        const mariadbVersions = formatServices('mariadb', registeredServices.mariadb);
        if (mariadbVersions.length > 0) {
          results.push(...mariadbVersions.map((v) => '  ' + v));
        }
      }

      if (!registeredServices.mysql && !registeredServices.mariadb) {
        results.push('  [No database versions installed]');
      }
    }

    // Web server versions (Nginx)
    if (type === 'all' || type === 'webserver') {
      results.push('\nWeb Server Versions:');
      const nginxVersions = formatServices('nginx', registeredServices.nginx);
      if (nginxVersions.length > 0) {
        results.push(...nginxVersions);
      } else {
        results.push('  [No web server versions installed]');
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: results.join('\n'),
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: `Failed to list services: ${error.message}` }],
      isError: true,
    };
  }
}
