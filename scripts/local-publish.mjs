#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_REGISTRY = 'http://localhost:4873';
const SOURCE_VERSION_PATTERN =
  /^(?<core>(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))(?<prerelease>-(?:[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;

export function nextLocalVersion(sourceVersion, publishedVersions) {
  const match = SOURCE_VERSION_PATTERN.exec(sourceVersion);
  if (!match?.groups) throw new Error(`source package version is not valid semantic version: ${sourceVersion}`);
  const prefix = match.groups.prerelease
    ? `${match.groups.core}${match.groups.prerelease}.local.`
    : `${match.groups.core}-local.`;
  const published = new Set(publishedVersions);
  for (let sequence = 0; sequence < Number.MAX_SAFE_INTEGER; sequence += 1) {
    const candidate = `${prefix}${sequence}`;
    if (!published.has(candidate)) return candidate;
  }
  throw new Error(`could not allocate a local version for ${sourceVersion}`);
}

function registryPackageUrl(registry, packageName) {
  const base = registry.endsWith('/') ? registry : `${registry}/`;
  return new URL(encodeURIComponent(packageName), base);
}

export async function readPublishedVersions({ registry, packageName, fetchImpl = fetch }) {
  const response = await fetchImpl(registryPackageUrl(registry, packageName));
  if (response.status === 404) return [];
  if (!response.ok) {
    throw new Error(`local registry returned HTTP ${response.status} while reading ${packageName}`);
  }
  const metadata = await response.json();
  return Object.keys(metadata?.versions ?? {});
}

function run(command, args, { cwd, env, spawn, phase }) {
  const result = spawn(command, args, { cwd, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${phase} failed with exit ${result.status ?? result.signal}`);
}

export async function publishLocalSuperDoc({
  publicRoot = PUBLIC_ROOT,
  registry = DEFAULT_REGISTRY,
  fetchImpl = fetch,
  spawn = spawnSync,
  env = process.env,
} = {}) {
  const packageRoot = path.join(publicRoot, 'packages', 'superdoc');
  const manifest = JSON.parse(readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
  const publishedVersions = await readPublishedVersions({ registry, packageName: manifest.name, fetchImpl });
  const version = nextLocalVersion(manifest.version, publishedVersions);
  const packEnv = { ...env, SUPERDOC_PACK_VERSION_OVERRIDE: version };

  run('pnpm', ['run', 'pack:es'], {
    cwd: publicRoot,
    env: packEnv,
    spawn,
    phase: 'local SuperDoc pack',
  });
  const tarballPath = path.join(packageRoot, 'superdoc.tgz');
  if (!existsSync(tarballPath)) throw new Error(`sealed pack did not produce ${tarballPath}`);
  run(
    'pnpm',
    ['publish', tarballPath, '--registry', registry, '--tag', 'local', '--no-git-checks'],
    { cwd: publicRoot, env, spawn, phase: `local SuperDoc publish ${version}` },
  );
  return { packageName: manifest.name, version, tarballPath, registry };
}

export function parseArgs(argv) {
  let registry = DEFAULT_REGISTRY;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--') {
      continue;
    } else if (argv[index] === '--registry' && argv[index + 1]) {
      registry = argv[index + 1];
      index += 1;
    } else {
      throw new Error(`unknown local-publish argument: ${argv[index]}`);
    }
  }
  return { registry };
}

function isCliEntry() {
  return process.argv[1] != null && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isCliEntry()) {
  try {
    const result = await publishLocalSuperDoc(parseArgs(process.argv.slice(2)));
    console.log(`[local-publish] published ${result.packageName}@${result.version} to ${result.registry}`);
  } catch (error) {
    console.error(`[local-publish] ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
    process.exitCode = 1;
  }
}
