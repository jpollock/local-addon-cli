#!/usr/bin/env node
/**
 * Bundle Addon Script
 *
 * Copies the built addon into the CLI package so it can be
 * distributed as a single npm package.
 */

const fs = require('fs');
const path = require('path');

const ADDON_SRC = path.join(__dirname, '..', 'packages', 'addon');
const ADDON_DEST = path.join(__dirname, '..', 'packages', 'cli', 'addon-dist');

/**
 * Copy a directory recursively
 */
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Main bundling logic
 */
function bundle() {
  console.log('Bundling addon into CLI package...');

  // Check addon is built
  const addonLib = path.join(ADDON_SRC, 'lib');
  if (!fs.existsSync(addonLib)) {
    console.error('Error: Addon not built. Run "npm run build:addon" first.');
    process.exit(1);
  }

  // Clean destination
  if (fs.existsSync(ADDON_DEST)) {
    fs.rmSync(ADDON_DEST, { recursive: true });
  }
  fs.mkdirSync(ADDON_DEST, { recursive: true });

  // Copy lib/
  console.log('  Copying lib/...');
  copyDir(addonLib, path.join(ADDON_DEST, 'lib'));

  // Copy package.json
  console.log('  Copying package.json...');
  fs.copyFileSync(
    path.join(ADDON_SRC, 'package.json'),
    path.join(ADDON_DEST, 'package.json')
  );

  // Copy bin/ if exists
  const addonBin = path.join(ADDON_SRC, 'bin');
  if (fs.existsSync(addonBin)) {
    console.log('  Copying bin/...');
    copyDir(addonBin, path.join(ADDON_DEST, 'bin'));
  }

  console.log('Addon bundled successfully.');
}

bundle();
