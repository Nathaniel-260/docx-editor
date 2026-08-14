#!/usr/bin/env node

const { execFileSync } = require('node:child_process');
const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const superdocDir = path.join(rootDir, 'packages', 'superdoc');
const packageJsonPath = path.join(superdocDir, 'package.json');
const sealedTarballPath = path.join(superdocDir, 'superdoc.tgz');
const auditScript = path.join(rootDir, 'scripts', 'audit-publish-artifact.mjs');
const defaultRegistry = process.env.NPM_CONFIG_REGISTRY || 'https://registry.npmjs.org';

const run = (command, args, cwd) => {
  execFileSync(command, args, { stdio: 'inherit', cwd });
};

const isVersionLookupNotFoundError = (error) => {
  const details = [error?.stderr, error?.stdout, error?.message].filter(Boolean).join('\n');
  return /E404|Not found|not found|No match found/i.test(details);
};

const isVersionPublished = (packageName, version, registry = defaultRegistry) => {
  try {
    execFileSync('pnpm', ['view', `${packageName}@${version}`, 'version', '--registry', registry], {
      stdio: 'pipe',
    });
    return true;
  } catch (error) {
    if (isVersionLookupNotFoundError(error)) return false;
    throw error;
  }
};

const ensurePackageJson = () => {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  if (packageJson.name !== 'superdoc') throw new Error('Unexpected package name for packages/superdoc');
  return packageJson;
};

const assertPublicPublisherVersionAllowed = (version) => {
  const match = /^(\d+)\./.exec(String(version));
  if (!match) throw new Error(`Invalid SuperDoc package version: ${version}`);
  if (Number(match[1]) >= 2) {
    throw new Error(
      `SuperDoc ${version} is not eligible for this publisher; `
        + 'the public publisher is restricted to 1.x releases.',
    );
  }
};

function assertSealedTarball() {
  if (!existsSync(sealedTarballPath)) {
    throw new Error(`Missing sealed SuperDoc tarball: ${sealedTarballPath}`);
  }
  run(process.execPath, [auditScript, sealedTarballPath, '--label', 'superdoc-release-tarball', '--superdoc'], rootDir);
}

function createSealedTarball({ build, logger }) {
  logger.log(build ? 'Building and sealed-packing SuperDoc...' : 'Sealed-packing existing verified SuperDoc output...');
  if (build) run('pnpm', ['run', 'pack:es'], rootDir);
  else run('pnpm', ['--prefix', 'packages/superdoc', 'run', 'pack:sealed'], rootDir);
  assertSealedTarball();
  return sealedTarballPath;
}

function buildPublishArgs(tarballPath, { distTag, registry, access = 'public' }) {
  if (!tarballPath.endsWith('.tgz')) throw new Error(`publish target must be an audited tarball: ${tarballPath}`);
  return [
    'publish',
    tarballPath,
    '--access',
    access,
    '--tag',
    distTag,
    '--no-git-checks',
    '--registry',
    registry,
  ];
}

function ensureDistTag(packageName, version, distTag, registry) {
  run('pnpm', ['dist-tag', 'add', `${packageName}@${version}`, distTag, '--registry', registry], rootDir);
}

function publishPackages({
  distTag = 'latest',
  publishUnscoped = true,
  build = true,
  logger = console,
  registry = defaultRegistry,
} = {}) {
  const packageJson = ensurePackageJson();
  assertPublicPublisherVersionAllowed(packageJson.version);
  const baseTarball = createSealedTarball({ build, logger });

  if (publishUnscoped) {
    if (isVersionPublished(packageJson.name, packageJson.version, registry)) {
      logger.log(`superdoc@${packageJson.version} already published, ensuring dist-tag "${distTag}" and skipping.`);
      ensureDistTag(packageJson.name, packageJson.version, distTag, registry);
    } else {
      logger.log(`Publishing audited ${path.basename(baseTarball)} with dist-tag "${distTag}"...`);
      run('pnpm', buildPublishArgs(baseTarball, { distTag, registry }), rootDir);
    }
  }
}

function publishFromSemanticRelease(context, publish = publishPackages) {
  const { nextRelease, logger = console } = context;
  return publish({
    distTag: (nextRelease && nextRelease.channel) || 'latest',
    publishUnscoped: true,
    // semantic-release-pnpm stamps the release version during prepare. Build
    // after that mutation so the producer receipt, packed manifest, and bundle
    // all describe the version that is actually published.
    build: true,
    logger,
  });
}

const parseArgs = (argv) => {
  let distTag;
  let registry;
  let skipUnscoped = false;
  let skipBuild = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dist-tag' || arg === '--registry') {
      const value = argv[index + 1];
      if (!value) throw new Error(`${arg} requires a value`);
      if (arg === '--dist-tag') distTag = value;
      else registry = value;
      index += 1;
    } else if (arg === '--skip-unscoped') skipUnscoped = true;
    else if (arg === '--skip-build') skipBuild = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return {
    distTag: distTag || process.env.RELEASE_DIST_TAG || 'latest',
    registry: registry || defaultRegistry,
    publishUnscoped: !skipUnscoped && process.env.SKIP_UNSCOPED_PUBLISH !== 'true',
    build: !skipBuild && process.env.SKIP_BUILD !== 'true',
  };
};

if (require.main === module) {
  try {
    publishPackages(parseArgs(process.argv.slice(2)));
  } catch (error) {
    console.error(error.message || error);
    process.exit(1);
  }
}

module.exports = {
  assertPublicPublisherVersionAllowed,
  buildPublishArgs,
  publish: async (pluginConfig, context) => publishFromSemanticRelease(context),
  publishFromSemanticRelease,
  publishPackages,
};
