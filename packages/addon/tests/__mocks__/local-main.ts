/**
 * Mock for @getflywheel/local/main
 */

export const getServiceContainer = jest.fn(() => ({
  cradle: {
    siteData: {
      getSites: jest.fn(() => ({})),
      getSite: jest.fn(() => null),
    },
    siteProcessManager: {
      getSiteStatus: jest.fn(() => 'stopped'),
      start: jest.fn(),
      stop: jest.fn(),
      restart: jest.fn(),
    },
    wpCli: {
      run: jest.fn(() => ''),
    },
    deleteSite: {
      deleteSite: jest.fn(),
      deleteSites: jest.fn(),
    },
    addSite: {
      addSite: jest.fn(() => ({ id: 'test-id', name: 'test-site' })),
    },
    cloneSite: {
      cloneSite: jest.fn(() => ({ id: 'cloned-id', name: 'cloned-site', domain: 'cloned-site.local' })),
    },
    exportSite: {
      exportSite: jest.fn(),
    },
    blueprints: {
      getBlueprints: jest.fn(() => []),
      saveBlueprint: jest.fn(),
    },
    browserManager: {
      openInBrowser: jest.fn(),
    },
    localLogger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
    graphql: {
      registerGraphQLService: jest.fn(),
    },
  },
}));

export interface AddonMainContext {
  hooks: any;
  electron: any;
}

export default {
  getServiceContainer,
};
