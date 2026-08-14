#!/usr/bin/env node
/**
 * Keeps the docs editor demo on an exact stable release.
 *
 * `config/editor-demo-runtime.json` feeds a live jsDelivr URL in
 * `components/embeds/editor-demo.tsx`. Its exact runtime and engine versions
 * are deliberate stable pins: public examples should match the installation
 * guidance, even while the repository manifest advances through prereleases.
 *
 * `public/_headers` pins the same versions again, as exact CDN URLs in the CSP
 * allowlist. That copy is the dangerous one: a stale entry does not fail at
 * build time, it makes the browser block the editor runtime, styles, engine and
 * worker on the deployed site. `test:export` is the only thing connecting the
 * two, and it runs after the build that changes them.
 *
 * So this owns both derived surfaces. The local manifest supplies package and
 * export names, the config owns the stable version pair, and the CSP is derived
 * from the config. `test:content` rejects prerelease pins and `test:export`
 * asserts the generated CSP agrees.
 *
 * Usage:
 *   node scripts/sync-editor-demo-runtime.mjs [--check]
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const CONFIG = path.join(here, '../config/editor-demo-runtime.json');
const HEADERS = path.join(here, '../public/_headers');
const SUPERDOC_MANIFEST = path.join(here, '../../../packages/superdoc/package.json');

const checkOnly = process.argv.includes('--check');

const config = JSON.parse(await readFile(CONFIG, 'utf8'));
const manifest = JSON.parse(await readFile(SUPERDOC_MANIFEST, 'utf8'));

const engineSpecifier = manifest.dependencies?.[config.enginePackage];
if (!engineSpecifier) {
  process.stderr.write(`${config.enginePackage} is not a dependency of ${manifest.name}\n`);
  process.exit(1);
}

const uiModulePath = manifest.exports?.['./ui']?.import?.slice(1);
if (!uiModulePath) {
  process.stderr.write(`${manifest.name} does not export an ESM UI module\n`);
  process.exit(1);
}

for (const [name, version] of [
  ['runtimeVersion', config.runtimeVersion],
  ['engineVersion', config.engineVersion],
]) {
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/u.test(version)) {
    process.stderr.write(`${name} must be an exact stable version; received ${JSON.stringify(version)}\n`);
    process.exit(1);
  }
}

const expected = {
  ...config,
  runtimePackage: manifest.name,
  uiModulePath,
};

const drifted = Object.keys(expected).filter((key) => expected[key] !== config[key]);

/**
 * Rewrites every pinned CDN URL in the CSP to the versions the config now names.
 *
 * Matches on package and path rather than on the old version, so it repairs a
 * header that drifted to any version, not only the one we happen to be
 * replacing. Anything that is not one of these two packages is left alone.
 */
function retargetHeaders(headers) {
  const runtime = `${expected.cdnOrigin}/${expected.runtimePackage}@`;
  const engine = `${expected.cdnOrigin}/${expected.enginePackage}@`;
  return headers
    .replaceAll(new RegExp(`${escapeForRegExp(runtime)}[^/\\s]+`, 'gu'), `${runtime}${expected.runtimeVersion}`)
    .replaceAll(new RegExp(`${escapeForRegExp(engine)}[^/\\s]+`, 'gu'), `${engine}${expected.engineVersion}`);
}

function escapeForRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

const headers = await readFile(HEADERS, 'utf8');
const expectedHeaders = retargetHeaders(headers);
const headersDrifted = expectedHeaders !== headers;

if (drifted.length === 0 && !headersDrifted) {
  process.stdout.write('editor demo runtime already matches the stable package pin\n');
  process.exit(0);
}

const summary = [
  ...drifted.map((key) => `${key}: ${config[key]} -> ${expected[key]}`),
  ...(headersDrifted ? ['_headers CSP allowlist'] : []),
].join(', ');

if (checkOnly) {
  process.stderr.write(
    `editor demo runtime is stale (${summary}).\n` +
      'Run `pnpm --filter @superdoc/docs run sync:runtime` to update it.\n',
  );
  process.exit(1);
}

if (drifted.length > 0) await writeFile(CONFIG, `${JSON.stringify(expected, null, 2)}\n`);
if (headersDrifted) await writeFile(HEADERS, expectedHeaders);
process.stdout.write(`updated editor demo runtime (${summary})\n`);
