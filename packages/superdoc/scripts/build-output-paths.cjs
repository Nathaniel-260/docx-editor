'use strict';

const path = require('node:path');

const packageRoot = path.resolve(__dirname, '..');

function resolveOutputRoot(envName, fallback) {
  const configured = process.env[envName]?.trim();
  return configured ? path.resolve(configured) : path.join(packageRoot, fallback);
}

const npmDistRoot = resolveOutputRoot('SUPERDOC_PUBLIC_NPM_OUT_DIR', 'dist');
const cdnDistRoot = resolveOutputRoot('SUPERDOC_PUBLIC_CDN_OUT_DIR', 'dist-cdn');

function resolvePackageOutputPath(target) {
  const normalized = String(target).replaceAll('\\', '/');
  if (normalized === './dist' || normalized === 'dist') return npmDistRoot;
  if (normalized.startsWith('./dist/')) return path.join(npmDistRoot, normalized.slice('./dist/'.length));
  if (normalized === './dist-cdn' || normalized === 'dist-cdn') return cdnDistRoot;
  if (normalized.startsWith('./dist-cdn/')) return path.join(cdnDistRoot, normalized.slice('./dist-cdn/'.length));
  return path.resolve(packageRoot, target);
}

module.exports = { cdnDistRoot, npmDistRoot, packageRoot, resolvePackageOutputPath };
