/**
 * trust_ssl Tool
 * Trust SSL certificate for a site
 */

import { McpToolDefinition, McpToolResult, LocalServices } from '../../../common/types';
import { validateRequiredParam, findSiteOrError } from './helpers';

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

  const paramError = validateRequiredParam(siteQuery, 'site');
  if (paramError) return paramError;

  const siteResult = findSiteOrError(siteQuery, services.siteData);
  if ('error' in siteResult) return siteResult.error;
  const { site } = siteResult;

  try {
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
