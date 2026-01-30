/**
 * Mock for electron
 */

export const ipcMain = {
  handle: jest.fn(),
  on: jest.fn(),
  removeHandler: jest.fn(),
};

export const ipcRenderer = {
  invoke: jest.fn(),
  on: jest.fn(),
  send: jest.fn(),
};

export const shell = {
  openExternal: jest.fn(),
};

export default {
  ipcMain,
  ipcRenderer,
  shell,
};
