#!/usr/bin/env node

import { createHash, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  canonicalJson,
  observeEngineInputIdentity,
  verifyPreparedEngine,
} from './engine-prepared-input.mjs';

export const ENGINE_CONSUMER_ARTIFACT_SCHEMA = 'superdoc-engine-consumer-artifact.v1';

const publicRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const engineRoot = path.resolve(publicRoot, '..', 'v2');
const archiveRoot = path.join(publicRoot, '.ci-docx-engine');
const installedRoot = path.join(publicRoot, 'packages', 'superdoc', 'node_modules', '@superdoc', 'docx-engine');
const receiptName = 'engine-consumer-receipt.json';
const digestPattern = /^[0-9a-f]{64}$/u;

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function sha256File(filePath) {
  return sha256(readFileSync(filePath));
}

function withDigest(body) {
  return { ...body, digest: sha256(canonicalJson(body)) };
}

function assertExactKeys(value, expected, label) {
  const actual = Object.keys(value ?? {}).sort();
  const sortedExpected = [...expected].sort();
  if (canonicalJson(actual) !== canonicalJson(sortedExpected)) {
    throw new Error(`${label} has unsupported fields: ${actual.join(', ')}.`);
  }
}

function writeJsonAtomic(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
  try {
    writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
    renameSync(temporaryPath, filePath);
  } finally {
    rmSync(temporaryPath, { force: true });
  }
}

function assertRegularFile(filePath, label) {
  const state = lstatSync(filePath, { throwIfNoEntry: false });
  if (!state?.isFile() || state.isSymbolicLink()) {
    throw new Error(`${label} must be a regular file: ${filePath}.`);
  }
  return state;
}

function assertPlainTree(root, label) {
  const state = lstatSync(root, { throwIfNoEntry: false });
  if (!state?.isDirectory() || state.isSymbolicLink()) {
    throw new Error(`${label} must be a regular directory: ${root}.`);
  }
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`${label} contains a symlink: ${absolute}.`);
      if (entry.isDirectory()) walk(absolute);
      else if (!entry.isFile()) throw new Error(`${label} contains an unsupported entry: ${absolute}.`);
    }
  };
  walk(root);
}

export function engineConsumerReceiptPath(root = archiveRoot) {
  return path.join(root, receiptName);
}

export function createEnginePackArguments({ v2Root = engineRoot, destination = archiveRoot } = {}) {
  return [
    path.join(v2Root, 'scripts', 'pack-v2-package.mjs'),
    '--package',
    v2Root,
    '--pack-destination',
    destination,
    '--no-build',
    '--no-document-api-build',
  ];
}

export function writeEngineConsumerArtifactReceipt({
  root = archiveRoot,
  engineArchive,
  verifiedEngine,
}) {
  const archiveState = assertRegularFile(engineArchive, 'DOCX Engine consumer tarball');
  const archiveRelative = path.relative(root, engineArchive).split(path.sep).join('/');
  if (
    archiveRelative.includes('/') ||
    !/^superdoc-docx-engine-.+\.tgz$/u.test(archiveRelative)
  ) {
    throw new Error('DOCX Engine consumer tarball must be one file directly under its artifact root.');
  }
  const producerReceipt = verifiedEngine?.receipt;
  if (
    !digestPattern.test(producerReceipt?.digest ?? '') ||
    !digestPattern.test(producerReceipt?.inputIdentity?.digest ?? '') ||
    !digestPattern.test(verifiedEngine?.surfaces?.dist?.digest ?? '') ||
    !digestPattern.test(verifiedEngine?.surfaces?.['dist-cdn']?.digest ?? '')
  ) {
    throw new Error('Verified DOCX Engine input is incomplete; cannot bind its consumer tarball.');
  }
  const body = {
    schema: ENGINE_CONSUMER_ARTIFACT_SCHEMA,
    package: { name: '@superdoc/docx-engine', version: verifiedEngine.engineVersion },
    producerReceiptDigest: producerReceipt.digest,
    producerInputIdentityDigest: producerReceipt.inputIdentity.digest,
    surfaces: {
      dist: verifiedEngine.surfaces.dist.digest,
      'dist-cdn': verifiedEngine.surfaces['dist-cdn'].digest,
    },
    tarball: {
      path: archiveRelative,
      sha256: sha256File(engineArchive),
      sizeBytes: archiveState.size,
    },
  };
  const receipt = withDigest(body);
  const filePath = engineConsumerReceiptPath(root);
  writeJsonAtomic(filePath, receipt);
  return { filePath, receipt };
}

export function verifyEngineConsumerArtifact({
  root = archiveRoot,
  expectedProducerReceiptDigest = null,
} = {}) {
  assertPlainTree(root, 'DOCX Engine consumer artifact');
  const receiptPath = engineConsumerReceiptPath(root);
  assertRegularFile(receiptPath, 'DOCX Engine consumer receipt');
  let receipt;
  try {
    receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
  } catch (error) {
    throw new Error(`DOCX Engine consumer receipt is unreadable: ${error.message}`);
  }
  if (receipt?.schema !== ENGINE_CONSUMER_ARTIFACT_SCHEMA) {
    throw new Error(`Unsupported DOCX Engine consumer receipt schema: ${receipt?.schema}.`);
  }
  assertExactKeys(
    receipt,
    [
      'schema',
      'package',
      'producerReceiptDigest',
      'producerInputIdentityDigest',
      'surfaces',
      'tarball',
      'digest',
    ],
    'DOCX Engine consumer receipt',
  );
  assertExactKeys(receipt.package, ['name', 'version'], 'DOCX Engine consumer package');
  assertExactKeys(receipt.surfaces, ['dist', 'dist-cdn'], 'DOCX Engine consumer surfaces');
  assertExactKeys(receipt.tarball, ['path', 'sha256', 'sizeBytes'], 'DOCX Engine consumer tarball');
  const { digest, ...body } = receipt;
  if (!digestPattern.test(digest ?? '') || digest !== sha256(canonicalJson(body))) {
    throw new Error('DOCX Engine consumer receipt failed its self-digest check.');
  }
  if (
    receipt.package?.name !== '@superdoc/docx-engine' ||
    typeof receipt.package?.version !== 'string' ||
    !digestPattern.test(receipt.producerReceiptDigest ?? '') ||
    !digestPattern.test(receipt.producerInputIdentityDigest ?? '') ||
    !digestPattern.test(receipt.surfaces?.dist ?? '') ||
    !digestPattern.test(receipt.surfaces?.['dist-cdn'] ?? '') ||
    !digestPattern.test(receipt.tarball?.sha256 ?? '') ||
    !Number.isSafeInteger(receipt.tarball?.sizeBytes) ||
    receipt.tarball.sizeBytes < 0 ||
    !/^superdoc-docx-engine-.+\.tgz$/u.test(receipt.tarball?.path ?? '') ||
    receipt.tarball.path.includes('/')
  ) {
    throw new Error('DOCX Engine consumer receipt has an invalid shape.');
  }
  if (expectedProducerReceiptDigest && receipt.producerReceiptDigest !== expectedProducerReceiptDigest) {
    throw new Error('DOCX Engine consumer artifact does not match the public producer receipt engine input.');
  }
  const entries = readdirSync(root).sort();
  const expectedEntries = [receiptName, receipt.tarball.path].sort();
  if (canonicalJson(entries) !== canonicalJson(expectedEntries)) {
    throw new Error(`DOCX Engine consumer artifact has unexpected entries: ${entries.join(', ')}.`);
  }
  const engineArchive = path.join(root, receipt.tarball.path);
  const archiveState = assertRegularFile(engineArchive, 'DOCX Engine consumer tarball');
  if (archiveState.size !== receipt.tarball.sizeBytes || sha256File(engineArchive) !== receipt.tarball.sha256) {
    throw new Error('DOCX Engine consumer tarball does not match its receipt.');
  }
  return { engineArchive, receipt, receiptPath };
}

export function packEngine({
  publicWorkspaceRoot = publicRoot,
  v2Root = engineRoot,
  root = archiveRoot,
  run = runChecked,
  checkpoint = () => {},
} = {}) {
  if (!existsSync(path.join(v2Root, 'package.json'))) {
    rmSync(root, { recursive: true, force: true });
    console.log('[ci:docx-engine] No internal engine workspace found; using the installed package.');
    return null;
  }

  const temporaryParent = path.join(publicWorkspaceRoot, '.tmp');
  mkdirSync(temporaryParent, { recursive: true });
  const transactionRoot = mkdtempSync(path.join(temporaryParent, 'ci-docx-engine-pack-'));
  const nextRoot = path.join(transactionRoot, 'next');
  const previousRoot = path.join(transactionRoot, 'previous');
  let previousMoved = false;
  let nextMoved = false;
  try {
    mkdirSync(nextRoot);
    run(process.execPath, createEnginePackArguments({ v2Root, destination: nextRoot }), {
      cwd: publicWorkspaceRoot,
    });
    const engineArchive = findEngineArchive(nextRoot);
    for (const file of readdirSync(nextRoot)) {
      if (file.endsWith('.tgz') && path.join(nextRoot, file) !== engineArchive) rmSync(path.join(nextRoot, file));
    }
    const manifest = JSON.parse(readFileSync(path.join(v2Root, 'package.json'), 'utf8'));
    const verifiedEngine = verifyPreparedEngine({
      v2Root,
      expectedVersion: manifest.version,
      surfaces: ['dist', 'dist-cdn'],
      currentInputIdentity: observeEngineInputIdentity({ v2Root }),
    });
    const written = writeEngineConsumerArtifactReceipt({ root: nextRoot, engineArchive, verifiedEngine });
    verifyEngineConsumerArtifact({ root: nextRoot, expectedProducerReceiptDigest: verifiedEngine.receipt.digest });
    checkpoint('after-verify');
    if (existsSync(root)) {
      renameSync(root, previousRoot);
      previousMoved = true;
    }
    checkpoint('after-backup');
    renameSync(nextRoot, root);
    nextMoved = true;
    checkpoint('after-promote');
    rmSync(previousRoot, { recursive: true, force: true });
    console.log(
      `[ci:docx-engine] Packed ${path.basename(engineArchive)} (${written.receipt.digest.slice(0, 12)}).`,
    );
    return { ...written, filePath: engineConsumerReceiptPath(root) };
  } catch (error) {
    if (nextMoved) rmSync(root, { recursive: true, force: true });
    if (previousMoved && existsSync(previousRoot)) renameSync(previousRoot, root);
    throw error;
  } finally {
    rmSync(transactionRoot, { recursive: true, force: true });
  }
}

export function materializeEngine({
  publicWorkspaceRoot = publicRoot,
  root = archiveRoot,
  destination = installedRoot,
  consumerRoots = null,
  run = runChecked,
  checkpoint = () => {},
} = {}) {
  if (!existsSync(root)) {
    console.log('[ci:docx-engine] No internal engine artifact found; using the installed package.');
    return null;
  }

  const verified = verifyEngineConsumerArtifact({ root });
  const destinationParent = path.dirname(destination);
  mkdirSync(destinationParent, { recursive: true });
  const temporaryRoot = mkdtempSync(path.join(destinationParent, '.docx-engine-materialize-'));
  const extractedRoot = path.join(temporaryRoot, 'next');
  const backupRoot = path.join(temporaryRoot, 'previous');
  mkdirSync(extractedRoot);
  let previousMoved = false;
  let nextMoved = false;
  try {
    run('tar', ['-xzf', verified.engineArchive, '-C', extractedRoot, '--strip-components=1'], {
      cwd: publicWorkspaceRoot,
    });
    assertPlainTree(extractedRoot, 'Materialized DOCX Engine package');
    const manifest = JSON.parse(readFileSync(path.join(extractedRoot, 'package.json'), 'utf8'));
    if (manifest.name !== '@superdoc/docx-engine' || manifest.version !== verified.receipt.package.version) {
      throw new Error(`Unexpected materialized package identity: ${manifest.name}@${manifest.version}.`);
    }
    for (const required of [
      'DOCX-ENGINE-LICENSE.md',
      'build/license-banner.txt',
      'dist/docx-engine.es.js',
      'dist-cdn/docx-engine.es.js',
    ]) {
      assertRegularFile(path.join(extractedRoot, required), `Materialized DOCX Engine ${required}`);
    }
    checkpoint('after-verify');
    if (existsSync(destination)) {
      renameSync(destination, backupRoot);
      previousMoved = true;
    }
    checkpoint('after-backup');
    renameSync(extractedRoot, destination);
    nextMoved = true;
    checkpoint('after-promote');
    rmSync(backupRoot, { recursive: true, force: true });
  } catch (error) {
    if (nextMoved) rmSync(destination, { recursive: true, force: true });
    if (previousMoved && existsSync(backupRoot)) renameSync(backupRoot, destination);
    throw error;
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }

  const roots = consumerRoots ?? findSuperdocConsumerRoots(publicWorkspaceRoot);
  const linkedRoots = linkEngineIntoConsumerRoots(destination, roots);
  console.log(
    `[ci:docx-engine] Materialized @superdoc/docx-engine@${verified.receipt.package.version} for ${linkedRoots.length} workspace consumer(s).`,
  );
  return { ...verified, linkedRoots };
}

export function main(argv = process.argv.slice(2)) {
  const command = argv[0];
  if (argv.length !== 1) throw new Error('Usage: node scripts/ci-docx-engine-artifact.mjs <pack|materialize>');
  if (command === 'pack') return packEngine();
  if (command === 'materialize') return materializeEngine();
  throw new Error('Usage: node scripts/ci-docx-engine-artifact.mjs <pack|materialize>');
}

function findSuperdocConsumerRoots(workspaceRoot = publicRoot) {
  const result = spawnSync('pnpm', ['--recursive', 'list', '--depth', '-1', '--json'], {
    cwd: workspaceRoot,
    encoding: 'utf8',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('Failed to enumerate SuperDoc workspace consumers.');

  return JSON.parse(result.stdout)
    .map((workspace) => workspace.path)
    .filter((workspacePath) => typeof workspacePath === 'string' && workspacePath.startsWith(workspaceRoot))
    .filter((workspacePath) => {
      const manifestPath = path.join(workspacePath, 'package.json');
      if (!existsSync(manifestPath)) return false;
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      const dependencies = { ...manifest.dependencies, ...manifest.devDependencies, ...manifest.peerDependencies };
      return Boolean(dependencies.superdoc || dependencies['@superdoc/react']);
    });
}

export function linkEngineIntoConsumerRoots(materializedEngineRoot, consumerRoots) {
  const linkedRoots = [];
  for (const consumerRoot of consumerRoots) {
    const nodeModulesRoot = path.join(consumerRoot, 'node_modules');
    if (!existsSync(nodeModulesRoot)) continue;
    const scopeRoot = path.join(nodeModulesRoot, '@superdoc');
    const target = path.join(scopeRoot, 'docx-engine');
    if (path.resolve(target) === path.resolve(materializedEngineRoot)) continue;

    mkdirSync(scopeRoot, { recursive: true });
    rmSync(target, { recursive: true, force: true });
    symlinkSync(path.relative(scopeRoot, materializedEngineRoot), target, 'dir');
    linkedRoots.push(consumerRoot);
  }
  return linkedRoots;
}

function findEngineArchive(root = archiveRoot) {
  const archives = readdirSync(root)
    .filter((file) => /^superdoc-docx-engine-.+\.tgz$/u.test(file))
    .map((file) => path.join(root, file));
  if (archives.length !== 1) throw new Error(`Expected one DOCX Engine archive, found ${archives.length}.`);
  return archives[0];
}

function runChecked(executable, args, { cwd = publicRoot } = {}) {
  const result = spawnSync(executable, args, { cwd, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${executable} exited with ${result.status ?? result.signal}.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
