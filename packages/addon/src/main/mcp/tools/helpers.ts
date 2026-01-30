/**
 * Tool Helper Functions
 */

/**
 * Find a site by name or ID
 * Supports partial name matching (case-insensitive)
 */
export function findSite(query: string, siteData: any): any | undefined {
  const sitesMap = siteData.getSites();
  const sites = Object.values(sitesMap) as any[];

  // Try exact ID match first
  const byId = sites.find((s: any) => s.id === query);
  if (byId) return byId;

  // Try exact name match (case-insensitive)
  const byExactName = sites.find((s: any) => s.name.toLowerCase() === query.toLowerCase());
  if (byExactName) return byExactName;

  // Try partial name match (case-insensitive)
  const byPartialName = sites.find((s: any) => s.name.toLowerCase().includes(query.toLowerCase()));
  if (byPartialName) return byPartialName;

  // Try domain match
  const byDomain = sites.find((s: any) => s.domain?.toLowerCase() === query.toLowerCase());
  if (byDomain) return byDomain;

  return undefined;
}
