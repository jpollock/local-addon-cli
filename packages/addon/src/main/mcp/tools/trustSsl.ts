/**
 * trust_ssl Tool
 * Trust SSL certificate for a site
 */

import { McpToolDefinition, McpToolResult, LocalServices } from '../../../common/types';
import { findSite } from './helpers';

export const trustSslDefinition: McpToolDefinition = {
  name: 'trust_ssl',
  description: 'Trust the SSL certificate for a site (may require admin password)',
  inputSchema: {
    type: 'object',
    properties: {
      site: {
        type: 'string',
        description: 'Site name or ID',
      },
    },
    required: ['site'],
  },
};

interface TrustSslArgs {
  site: string;
}

export async function trustSsl(
  args: Record<string, unknown>,
  services: LocalServices
): Promise<McpToolResult> {
  const { site: siteQuery } = args as unknown as TrustSslArgs;

  if (!siteQuery) {
    return {
      content: [{ type: 'text', text: 'Error: site parameter is required' }],
      isError: true,
    };
  }

  try {
    const site = findSite(siteQuery, services.siteData);

    if (!site) {
      const allSites = services.siteData.getSites();
      const siteNames = allSites.map((s: any) => s.name).join(', ');
      return {
        content: [
          {
            type: 'text',
            text: `Site not found: "${siteQuery}". Available sites: ${siteNames || 'none'}`,
          },
        ],
        isError: true,
      };
    }

    // Check if x509Cert service exists
    if (!services.x509Cert) {
      return {
        content: [{ type: 'text', text: 'SSL certificate service not available' }],
        isError: true,
      };
    }

    // Trust the certificate
    await services.x509Cert.trustCert(site);

    return {
      content: [
        {
          type: 'text',
          text: `Successfully trusted SSL certificate for "${site.name}". You may need to restart your browser.`,
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: `Failed to trust SSL certificate: ${error.message}` }],
      isError: true,
    };
  }
}
