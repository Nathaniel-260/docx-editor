import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import {
  cp,
  link,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  rm,
} from 'node:fs/promises';
import { hostname } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

export const ARTIFACT_TREE_SCHEMA = 'superdoc-artifact-tree.v1';
export const ARTIFACT_CONTENT_SET_SCHEMA = 'superdoc-artifact-content-set.v1';
export const ARTIFACT_ENVELOPE_SCHEMA = 'superdoc-artifact-envelope.v1';
export const ARTIFACT_POINTER_SCHEMA = 'superdoc-artifact-pointer.v1';
export const ARTIFACT_PROMOTION_JOURNAL_SCHEMA = 'superdoc-artifact-promotion-journal.v1';

const DIGEST_RE = /^[0-9a-f]{64}$/u;
const SEGMENT_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;

export class ArtifactStoreError extends Error {
  constructor(message, code, options) {
    super(message, options);
    this.name = 'ArtifactStoreError';
    this.code = code;
  }
}

function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

export function canonicalArtifactJson(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new ArtifactStoreError('Canonical JSON rejects non-finite numbers.', 'json-value');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalArtifactJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort(compareUtf8);
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalArtifactJson(value[key])}`).join(',')}}`;
  }
  throw new ArtifactStoreError(`Canonical JSON cannot encode ${typeof value}.`, 'json-value');
}

export function artifactSha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function artifactCanonicalSha256(value) {
  return artifactSha256(canonicalArtifactJson(value));
}

function assertDigest(value, label) {
  if (typeof value !== 'string' || !DIGEST_RE.test(value)) {
    throw new ArtifactStoreError(`${label} must be a lowercase SHA-256 digest.`, 'invalid-digest');
  }
  return value;
}

function assertSegment(value, label) {
  if (typeof value !== 'string' || !SEGMENT_RE.test(value)) {
    throw new ArtifactStoreError(`${label} must be one portable path segment.`, 'invalid-segment');
  }
  return value;
}

function assertPortableRelativePath(value, label) {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.includes('\\')
    || path.posix.isAbsolute(value)
    || path.posix.normalize(value) !== value
    || value === '.'
    || value === '..'
    || value.startsWith('../')
  ) {
    throw new ArtifactStoreError(`${label} must be a normalized portable relative path.`, 'invalid-path');
  }
  return value;
}

function withSelfDigest(body) {
  return { ...body, digest: artifactCanonicalSha256(body) };
}

function assertSelfDigest(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ArtifactStoreError(`${label} must be an object.`, 'contract-shape');
  }
  const { digest, ...body } = value;
  assertDigest(digest, `${label}.digest`);
  if (digest !== artifactCanonicalSha256(body)) {
    throw new ArtifactStoreError(`${label} failed its self-digest check.`, 'contract-digest');
  }
  return value;
}

async function pathState(filePath) {
  return lstat(filePath).catch((error) => {
    if (error?.code === 'ENOENT') return null;
    throw error;
  });
}

async function assertDirectory(directory, label) {
  const state = await pathState(directory);
  if (!state) throw new ArtifactStoreError(`${label} does not exist: ${directory}`, 'missing-directory');
  if (state.isSymbolicLink()) throw new ArtifactStoreError(`${label} must not be a symlink: ${directory}`, 'tree-symlink');
  if (!state.isDirectory()) throw new ArtifactStoreError(`${label} must be a directory: ${directory}`, 'not-directory');
}

async function ensureDirectory(directory, label) {
  await mkdir(directory, { recursive: true });
  await assertDirectory(directory, label);
}

async function sha256File(filePath) {
  const hash = createHash('sha256');
  await new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', resolve);
  });
  return hash.digest('hex');
}

function treeDigestBody(tree) {
  return {
    schema: ARTIFACT_TREE_SCHEMA,
    directories: tree.directories,
    files: tree.files,
  };
}

function validateTreeSeal(tree, label = 'artifact tree seal') {
  if (!tree || typeof tree !== 'object' || Array.isArray(tree)) {
    throw new ArtifactStoreError(`${label} must be an object.`, 'tree-seal-shape');
  }
  if (tree.schema !== ARTIFACT_TREE_SCHEMA) {
    throw new ArtifactStoreError(`${label} has unsupported schema ${tree.schema}.`, 'tree-seal-schema');
  }
  if (!Array.isArray(tree.directories) || !Array.isArray(tree.files)) {
    throw new ArtifactStoreError(`${label} must contain directories and files arrays.`, 'tree-seal-shape');
  }
  const directories = new Set();
  for (const [index, relative] of tree.directories.entries()) {
    assertPortableRelativePath(relative, `${label}.directories[${index}]`);
    if (directories.has(relative)) throw new ArtifactStoreError(`${label} repeats directory ${relative}.`, 'tree-seal-shape');
    directories.add(relative);
  }
  const files = new Set();
  let sizeBytes = 0;
  for (const [index, entry] of tree.files.entries()) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new ArtifactStoreError(`${label}.files[${index}] must be an object.`, 'tree-seal-shape');
    }
    assertPortableRelativePath(entry.path, `${label}.files[${index}].path`);
    assertDigest(entry.sha256, `${label}.files[${index}].sha256`);
    if (!Number.isSafeInteger(entry.sizeBytes) || entry.sizeBytes < 0) {
      throw new ArtifactStoreError(`${label}.files[${index}].sizeBytes must be a non-negative integer.`, 'tree-seal-shape');
    }
    if (files.has(entry.path)) throw new ArtifactStoreError(`${label} repeats file ${entry.path}.`, 'tree-seal-shape');
    files.add(entry.path);
    sizeBytes += entry.sizeBytes;
  }
  const sortedDirectories = [...tree.directories].sort(compareUtf8);
  const sortedFiles = [...tree.files].sort((left, right) => compareUtf8(left.path, right.path));
  if (canonicalArtifactJson(sortedDirectories) !== canonicalArtifactJson(tree.directories)) {
    throw new ArtifactStoreError(`${label} directories are not in canonical order.`, 'tree-seal-order');
  }
  if (canonicalArtifactJson(sortedFiles) !== canonicalArtifactJson(tree.files)) {
    throw new ArtifactStoreError(`${label} files are not in canonical order.`, 'tree-seal-order');
  }
  assertDigest(tree.digest, `${label}.digest`);
  if (tree.digest !== artifactCanonicalSha256(treeDigestBody(tree))) {
    throw new ArtifactStoreError(`${label} digest does not match its exact tree.`, 'tree-seal-digest');
  }
  if (tree.fileCount !== tree.files.length || tree.sizeBytes !== sizeBytes) {
    throw new ArtifactStoreError(`${label} summary does not match its files.`, 'tree-seal-summary');
  }
  return tree;
}

export async function sealArtifactTree(root) {
  const absoluteRoot = path.resolve(root);
  await assertDirectory(absoluteRoot, 'artifact tree root');
  const directories = [];
  const files = [];

  async function walk(directory, relativeParent = '') {
    const entries = (await readdir(directory, { withFileTypes: true })).sort((left, right) =>
      compareUtf8(left.name, right.name),
    );
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      const relative = relativeParent ? path.posix.join(relativeParent, entry.name) : entry.name;
      const current = await lstat(absolute);
      if (current.isSymbolicLink()) {
        throw new ArtifactStoreError(`Artifact trees must not contain symlinks: ${absolute}`, 'tree-symlink');
      }
      if (current.isDirectory()) {
        directories.push(relative);
        await walk(absolute, relative);
      } else if (current.isFile()) {
        files.push({ path: relative, sha256: await sha256File(absolute), sizeBytes: current.size });
      } else {
        throw new ArtifactStoreError(`Artifact trees contain only regular files and directories: ${absolute}`, 'tree-entry');
      }
    }
  }

  await walk(absoluteRoot);
  directories.sort(compareUtf8);
  files.sort((left, right) => compareUtf8(left.path, right.path));
  const body = { schema: ARTIFACT_TREE_SCHEMA, directories, files };
  return validateTreeSeal(
    {
      ...body,
      digest: artifactCanonicalSha256(body),
      fileCount: files.length,
      sizeBytes: files.reduce((total, file) => total + file.sizeBytes, 0),
    },
    'generated artifact tree seal',
  );
}

export async function verifyArtifactTree(root, expectedSeal) {
  const expected = validateTreeSeal(expectedSeal);
  const actual = await sealArtifactTree(root);
  if (actual.digest !== expected.digest || canonicalArtifactJson(treeDigestBody(actual)) !== canonicalArtifactJson(treeDigestBody(expected))) {
    throw new ArtifactStoreError(
      `Artifact tree ${path.resolve(root)} does not match seal ${expected.digest}; found ${actual.digest}.`,
      'tree-mismatch',
    );
  }
  return actual;
}

function normalizeComponents(components) {
  if (!Array.isArray(components) || components.length === 0) {
    throw new ArtifactStoreError('A content set requires at least one component.', 'component-set');
  }
  const ids = new Set();
  const normalized = components.map((component, index) => {
    if (!component || typeof component !== 'object' || Array.isArray(component)) {
      throw new ArtifactStoreError(`components[${index}] must be an object.`, 'component-set');
    }
    const id = assertSegment(component.id, `components[${index}].id`);
    const objectDigest = assertDigest(component.objectDigest, `components[${index}].objectDigest`);
    if (ids.has(id)) throw new ArtifactStoreError(`Component id ${id} appears more than once.`, 'component-set');
    ids.add(id);
    return { id, objectDigest };
  });
  return normalized.sort((left, right) => compareUtf8(left.id, right.id));
}

export function computeArtifactContentSetDigest(components) {
  return artifactCanonicalSha256({ schema: ARTIFACT_CONTENT_SET_SCHEMA, components: normalizeComponents(components) });
}

async function syncDirectory(directory) {
  let handle;
  try {
    handle = await open(directory, 'r');
    await handle.sync();
  } catch (error) {
    if (!['EINVAL', 'ENOTSUP', 'EPERM', 'EISDIR'].includes(error?.code)) throw error;
  } finally {
    await handle?.close();
  }
}

async function writeJsonAtomic(filePath, value) {
  const parent = path.dirname(filePath);
  await ensureDirectory(parent, 'atomic JSON parent');
  const temporary = path.join(parent, `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`);
  let handle;
  try {
    handle = await open(temporary, 'wx');
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(temporary, filePath);
    await syncDirectory(parent);
  } finally {
    await handle?.close();
    await rm(temporary, { force: true });
  }
}

async function readRegularJson(filePath, label) {
  const state = await pathState(filePath);
  if (!state) return null;
  if (state.isSymbolicLink() || !state.isFile()) {
    throw new ArtifactStoreError(`${label} must be a regular file: ${filePath}`, 'contract-file');
  }
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    throw new ArtifactStoreError(`${label} is not valid JSON: ${filePath}`, 'contract-json', { cause: error });
  }
}

function isPathWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function pointerDigest(pointer) {
  return pointer?.digest ?? null;
}

async function invokeCheckpoint(checkpoint, name, detail = {}) {
  if (checkpoint) await checkpoint(name, detail);
}

export function createSuperDocArtifactStore(options) {
  if (!options?.root) throw new ArtifactStoreError('Artifact store root is required.', 'store-root');
  const root = path.resolve(options.root);
  const paths = Object.freeze({
    root,
    runs: path.join(root, 'runs'),
    objects: path.join(root, 'objects'),
    envelopes: path.join(root, 'envelopes'),
    pointers: path.join(root, 'pointers'),
    pointerVersions: path.join(root, 'pointers', 'versions'),
    pointer: path.join(root, 'pointers', 'current.json'),
    journal: path.join(root, 'promotion-journal.json'),
    lock: path.join(root, 'promotion.lock'),
  });
  const defaultCheckpoint = options.checkpoint;
  const lockPollMs = options.lockPollMs ?? 20;
  const lockTimeoutMs = options.lockTimeoutMs ?? 30_000;
  const orphanedLockMs = options.orphanedLockMs ?? 30_000;
  const lockCheckpoint = options.lockCheckpoint;

  async function ensureLayout() {
    await ensureDirectory(paths.root, 'artifact store root');
    await Promise.all([
      ensureDirectory(paths.runs, 'artifact run root'),
      ensureDirectory(paths.objects, 'artifact object root'),
      ensureDirectory(paths.envelopes, 'artifact envelope root'),
      ensureDirectory(paths.pointers, 'artifact pointer root'),
      ensureDirectory(paths.pointerVersions, 'artifact pointer version root'),
    ]);
  }

  async function createRun({ runId = randomUUID(), producer, metadata = null, checkpoint } = {}) {
    await ensureLayout();
    assertSegment(runId, 'runId');
    assertSegment(producer, 'producer');
    const runRoot = path.join(paths.runs, runId);
    try {
      await mkdir(runRoot);
    } catch (error) {
      if (error?.code === 'EEXIST') {
        throw new ArtifactStoreError(`Artifact run ${runId} already exists.`, 'run-exists');
      }
      throw error;
    }
    const stagingRoot = path.join(runRoot, 'staging', producer);
    await mkdir(stagingRoot, { recursive: true });
    await writeJsonAtomic(path.join(runRoot, 'run.json'), {
      schema: 'superdoc-artifact-run.v1',
      runId,
      producer,
      createdAt: new Date().toISOString(),
      metadata,
    });
    await invokeCheckpoint(checkpoint ?? defaultCheckpoint, 'run:created', { runId, producer, runRoot, stagingRoot });
    return Object.freeze({ runId, producer, root: runRoot, stagingRoot });
  }

  async function discardRun(run) {
    if (!run?.runId) throw new ArtifactStoreError('A created run is required.', 'run-reference');
    assertSegment(run.runId, 'run.runId');
    const expected = path.join(paths.runs, run.runId);
    if (path.resolve(run.root) !== expected) throw new ArtifactStoreError('Run root is outside this artifact store.', 'run-reference');
    await rm(expected, { recursive: true, force: true });
  }

  async function verifyObject(objectDigest) {
    const digest = assertDigest(objectDigest, 'objectDigest');
    const objectRoot = path.join(paths.objects, digest);
    const seal = await sealArtifactTree(objectRoot);
    if (seal.digest !== digest) {
      throw new ArtifactStoreError(`Immutable object ${digest} has tree digest ${seal.digest}.`, 'object-corrupt');
    }
    return { digest, root: objectRoot, relativePath: path.posix.join('objects', digest), seal };
  }

  async function installObject({ sourceRoot, seal, checkpoint } = {}) {
    await ensureLayout();
    const selectedCheckpoint = checkpoint ?? defaultCheckpoint;
    const expected = seal ? validateTreeSeal(seal) : await sealArtifactTree(sourceRoot);
    if (seal) await verifyArtifactTree(sourceRoot, expected);
    const destination = path.join(paths.objects, expected.digest);
    if (await pathState(destination)) {
      const existing = await verifyObject(expected.digest);
      return { ...existing, reused: true };
    }

    const incoming = path.join(paths.objects, `.incoming-${expected.digest}-${process.pid}-${randomUUID()}`);
    let installed = false;
    try {
      await cp(path.resolve(sourceRoot), incoming, { recursive: true, force: false, errorOnExist: true, dereference: false });
      await invokeCheckpoint(selectedCheckpoint, 'object:after-copy', { digest: expected.digest, incoming, destination });
      await verifyArtifactTree(incoming, expected);
      await invokeCheckpoint(selectedCheckpoint, 'object:after-verify', { digest: expected.digest, incoming, destination });
      await invokeCheckpoint(selectedCheckpoint, 'object:before-rename', { digest: expected.digest, incoming, destination });
      try {
        await rename(incoming, destination);
        installed = true;
        await syncDirectory(paths.objects);
      } catch (error) {
        if (!['EEXIST', 'ENOTEMPTY', 'EPERM'].includes(error?.code) || !(await pathState(destination))) throw error;
      }
      let object;
      try {
        object = await verifyObject(expected.digest);
      } catch (error) {
        if (installed) {
          await rm(destination, { recursive: true, force: true });
          await syncDirectory(paths.objects);
        }
        throw error;
      }
      await invokeCheckpoint(selectedCheckpoint, 'object:after-install', { digest: expected.digest, destination });
      return { ...object, reused: !installed };
    } finally {
      await rm(incoming, { recursive: true, force: true });
    }
  }

  function createEnvelope(components) {
    const normalized = normalizeComponents(components).map((component) => ({
      ...component,
      objectPath: path.posix.join('objects', component.objectDigest),
    }));
    const contentSetDigest = computeArtifactContentSetDigest(normalized);
    return withSelfDigest({ schema: ARTIFACT_ENVELOPE_SCHEMA, contentSetDigest, components: normalized });
  }

  function validateEnvelope(envelope) {
    assertSelfDigest(envelope, 'artifact envelope');
    if (envelope.schema !== ARTIFACT_ENVELOPE_SCHEMA) {
      throw new ArtifactStoreError(`Unsupported artifact envelope schema ${envelope.schema}.`, 'envelope-schema');
    }
    const normalized = normalizeComponents(envelope.components);
    if (computeArtifactContentSetDigest(normalized) !== envelope.contentSetDigest) {
      throw new ArtifactStoreError('Artifact envelope content-set digest is invalid.', 'envelope-content-set');
    }
    for (const [index, component] of envelope.components.entries()) {
      const expectedPath = path.posix.join('objects', normalized[index].objectDigest);
      if (component.id !== normalized[index].id || component.objectPath !== expectedPath) {
        throw new ArtifactStoreError('Artifact envelope component ordering or object path is invalid.', 'envelope-component');
      }
    }
    return envelope;
  }

  async function writeEnvelope(envelope) {
    validateEnvelope(envelope);
    const outputPath = path.join(paths.envelopes, `${envelope.contentSetDigest}.json`);
    const existing = await readRegularJson(outputPath, 'artifact envelope');
    if (existing) {
      validateEnvelope(existing);
      if (canonicalArtifactJson(existing) !== canonicalArtifactJson(envelope)) {
        throw new ArtifactStoreError(`Immutable envelope ${envelope.contentSetDigest} already has different bytes.`, 'envelope-conflict');
      }
      return outputPath;
    }
    await writeJsonAtomic(outputPath, envelope);
    return outputPath;
  }

  function validatePointer(pointer) {
    assertSelfDigest(pointer, 'artifact pointer');
    if (pointer.schema !== ARTIFACT_POINTER_SCHEMA) {
      throw new ArtifactStoreError(`Unsupported artifact pointer schema ${pointer.schema}.`, 'pointer-schema');
    }
    if (!Number.isSafeInteger(pointer.generation) || pointer.generation < 1) {
      throw new ArtifactStoreError('Artifact pointer generation must be a positive integer.', 'pointer-generation');
    }
    assertDigest(pointer.contentSetDigest, 'artifact pointer contentSetDigest');
    assertDigest(pointer.envelopeDigest, 'artifact pointer envelopeDigest');
    if (pointer.previousPointerDigest !== null) assertDigest(pointer.previousPointerDigest, 'artifact pointer previousPointerDigest');
    const expectedEnvelopePath = path.posix.join('envelopes', `${pointer.contentSetDigest}.json`);
    if (pointer.envelopePath !== expectedEnvelopePath) {
      throw new ArtifactStoreError('Artifact pointer envelope path is not content-addressed.', 'pointer-envelope');
    }
    return pointer;
  }

  function pointerContract(pointer) {
    if (!pointer) return null;
    const { envelope: _envelope, ...contract } = pointer;
    return validatePointer(contract);
  }

  async function writePointerVersion(pointer) {
    const contract = pointerContract(pointer);
    const outputPath = path.join(paths.pointerVersions, `${contract.digest}.json`);
    const existing = await readRegularJson(outputPath, 'artifact pointer version');
    if (existing) {
      validatePointer(existing);
      if (canonicalArtifactJson(existing) !== canonicalArtifactJson(contract)) {
        throw new ArtifactStoreError(`Immutable pointer version ${contract.digest} has different bytes.`, 'pointer-conflict');
      }
      return outputPath;
    }
    await writeJsonAtomic(outputPath, contract);
    return outputPath;
  }

  async function readEnvelopeForPointer(pointer, { verifyObjects = true } = {}) {
    const envelopePath = path.join(root, ...pointer.envelopePath.split('/'));
    const envelope = validateEnvelope(await readRegularJson(envelopePath, 'artifact envelope'));
    if (envelope.digest !== pointer.envelopeDigest || envelope.contentSetDigest !== pointer.contentSetDigest) {
      throw new ArtifactStoreError('Artifact pointer does not match its envelope.', 'pointer-envelope');
    }
    if (verifyObjects) {
      for (const component of envelope.components) await verifyObject(component.objectDigest);
    }
    return envelope;
  }

  async function readCurrentPointer({ verifyObjects = true } = {}) {
    await ensureLayout();
    const value = await readRegularJson(paths.pointer, 'artifact pointer');
    if (!value) return null;
    const pointer = validatePointer(value);
    const envelope = await readEnvelopeForPointer(pointer, { verifyObjects });
    return { ...pointer, envelope };
  }

  async function readPointerVersion(pointerVersionDigest, { verifyObjects = true } = {}) {
    await ensureLayout();
    const digest = assertDigest(pointerVersionDigest, 'pointerVersionDigest');
    const value = await readRegularJson(path.join(paths.pointerVersions, `${digest}.json`), 'artifact pointer version');
    if (!value) return null;
    const pointer = validatePointer(value);
    if (pointer.digest !== digest) {
      throw new ArtifactStoreError(`Pointer version path ${digest} contains ${pointer.digest}.`, 'pointer-version');
    }
    const envelope = await readEnvelopeForPointer(pointer, { verifyObjects });
    return { ...pointer, envelope };
  }

  function lockOwnerAlive(owner) {
    if (!owner || owner.hostname !== hostname() || !Number.isSafeInteger(owner.pid)) return true;
    try {
      process.kill(owner.pid, 0);
      return true;
    } catch (error) {
      return error?.code !== 'ESRCH';
    }
  }

  function lockObservationIdentity(state, owner) {
    return artifactCanonicalSha256({
      device: String(state.dev),
      inode: String(state.ino),
      ownerDigest: owner ? artifactCanonicalSha256(owner) : null,
    });
  }

  async function observePromotionLock() {
    const state = await pathState(paths.lock);
    if (!state) return null;
    if (state.isSymbolicLink() || !state.isDirectory()) {
      throw new ArtifactStoreError(`Promotion lock must be a directory: ${paths.lock}`, 'promotion-lock-shape');
    }
    const owner = await readRegularJson(path.join(paths.lock, 'owner.json'), 'promotion lock owner');
    return {
      identity: lockObservationIdentity(state, owner),
      mtimeMs: state.mtimeMs,
      owner,
    };
  }

  function validateReclaimClaim(claim, expectedLockIdentity) {
    if (
      !claim
      || typeof claim !== 'object'
      || Array.isArray(claim)
      || claim.schema !== 'superdoc-artifact-promotion-lock-reclaim.v1'
      || claim.lockIdentity !== expectedLockIdentity
      || typeof claim.token !== 'string'
      || !SEGMENT_RE.test(claim.token)
      || !Number.isSafeInteger(claim.pid)
      || typeof claim.hostname !== 'string'
      || typeof claim.acquiredAt !== 'string'
    ) {
      throw new ArtifactStoreError('Promotion lock reclaim claim is invalid.', 'promotion-lock-reclaim');
    }
    return claim;
  }

  async function retireAbandonedReclaimClaim(claimPath, claim, lockIdentity) {
    if (lockOwnerAlive(claim)) return false;
    const retiredPath = path.join(
      paths.lock,
      `.reclaim-abandoned-${lockIdentity}-${artifactSha256(claim.token)}.json`,
    );
    try {
      await link(claimPath, retiredPath);
    } catch (error) {
      if (error?.code === 'ENOENT' || error?.code === 'EEXIST') return false;
      throw error;
    }
    const [claimState, retiredState] = await Promise.all([pathState(claimPath), pathState(retiredPath)]);
    if (
      claimState
      && retiredState
      && claimState.dev === retiredState.dev
      && claimState.ino === retiredState.ino
    ) {
      await rm(claimPath, { force: true });
    }
    return true;
  }

  async function claimAbandonedPromotionLock(observation) {
    const claimPath = path.join(paths.lock, `.reclaim-${observation.identity}.json`);
    for (;;) {
      const token = randomUUID();
      const candidatePath = path.join(paths.root, `.promotion-lock-reclaim-${token}.json`);
      const claim = {
        schema: 'superdoc-artifact-promotion-lock-reclaim.v1',
        token,
        pid: process.pid,
        hostname: hostname(),
        acquiredAt: new Date().toISOString(),
        lockIdentity: observation.identity,
      };
      try {
        await writeJsonAtomic(candidatePath, claim);
        try {
          await link(candidatePath, claimPath);
          await syncDirectory(paths.lock);
          return { claim, claimPath };
        } catch (error) {
          if (error?.code === 'ENOENT') return null;
          if (error?.code !== 'EEXIST') throw error;
        }

        const existing = validateReclaimClaim(
          await readRegularJson(claimPath, 'promotion lock reclaim claim'),
          observation.identity,
        );
        if (!(await retireAbandonedReclaimClaim(claimPath, existing, observation.identity))) return null;
      } finally {
        await rm(candidatePath, { force: true });
      }
    }
  }

  async function clearAbandonedLocalLock() {
    const observed = await observePromotionLock();
    if (!observed) return false;
    const abandoned = observed.owner
      ? !lockOwnerAlive(observed.owner)
      : Date.now() - observed.mtimeMs >= orphanedLockMs;
    if (!abandoned) return false;

    await invokeCheckpoint(lockCheckpoint, 'lock:stale-observed', {
      identity: observed.identity,
      owner: observed.owner,
    });
    const reclaim = await claimAbandonedPromotionLock(observed);
    if (!reclaim) return false;
    await invokeCheckpoint(lockCheckpoint, 'lock:reclaim-claimed', {
      identity: observed.identity,
      claimPath: reclaim.claimPath,
      token: reclaim.claim.token,
    });

    const current = await observePromotionLock();
    if (!current || current.identity !== observed.identity) return false;
    const quarantinePath = path.join(paths.root, `.promotion-lock-abandoned-${observed.identity}`);
    try {
      await rename(paths.lock, quarantinePath);
      await syncDirectory(paths.root);
    } catch (error) {
      if (['ENOENT', 'EEXIST', 'ENOTEMPTY'].includes(error?.code)) return false;
      throw error;
    }
    await invokeCheckpoint(lockCheckpoint, 'lock:stale-quarantined', {
      identity: observed.identity,
      quarantinePath,
    });
    return true;
  }

  async function acquirePromotionLock() {
    await ensureLayout();
    const token = randomUUID();
    const started = Date.now();
    for (;;) {
      let lockCreated = false;
      try {
        await mkdir(paths.lock);
        lockCreated = true;
        await writeJsonAtomic(path.join(paths.lock, 'owner.json'), {
          schema: 'superdoc-artifact-promotion-lock.v1',
          token,
          pid: process.pid,
          hostname: hostname(),
          acquiredAt: new Date().toISOString(),
        });
        return async () => {
          const owner = await readRegularJson(path.join(paths.lock, 'owner.json'), 'promotion lock owner');
          if (owner?.token !== token) {
            throw new ArtifactStoreError('Promotion lock ownership changed before release.', 'promotion-lock-owner');
          }
          await rm(paths.lock, { recursive: true, force: true });
        };
      } catch (error) {
        if (lockCreated) {
          await rm(paths.lock, { recursive: true, force: true });
          throw error;
        }
        if (error?.code !== 'EEXIST') throw error;
        if (await clearAbandonedLocalLock()) continue;
        if (Date.now() - started >= lockTimeoutMs) {
          throw new ArtifactStoreError(`Timed out waiting for artifact promotion lock ${paths.lock}.`, 'promotion-lock-timeout');
        }
        await delay(lockPollMs);
      }
    }
  }

  function compatibilitySiblingPaths(destination, transactionId) {
    const parent = path.dirname(destination);
    const basename = path.basename(destination);
    return {
      stagedPath: path.join(parent, `.${basename}.superdoc-next-${transactionId}`),
      backupPath: path.join(parent, `.${basename}.superdoc-previous-${transactionId}`),
    };
  }

  function normalizeCompatibilityViews(views, components, transactionId) {
    if (!Array.isArray(views)) throw new ArtifactStoreError('compatibilityViews must be an array.', 'compatibility-view');
    const componentMap = new Map(components.map((component) => [component.id, component.objectDigest]));
    const ids = new Set();
    const destinations = [];
    const normalized = views.map((view, index) => {
      if (!view || typeof view !== 'object' || Array.isArray(view)) {
        throw new ArtifactStoreError(`compatibilityViews[${index}] must be an object.`, 'compatibility-view');
      }
      const id = assertSegment(view.id, `compatibilityViews[${index}].id`);
      const componentId = assertSegment(view.componentId, `compatibilityViews[${index}].componentId`);
      if (ids.has(id)) throw new ArtifactStoreError(`Compatibility view id ${id} appears more than once.`, 'compatibility-view');
      ids.add(id);
      const objectDigest = componentMap.get(componentId);
      if (!objectDigest) throw new ArtifactStoreError(`Compatibility view ${id} references unknown component ${componentId}.`, 'compatibility-view');
      if (typeof view.destination !== 'string' || !path.isAbsolute(view.destination)) {
        throw new ArtifactStoreError(`Compatibility view ${id} destination must be absolute.`, 'compatibility-view');
      }
      const destination = path.resolve(view.destination);
      if (isPathWithin(root, destination)) {
        throw new ArtifactStoreError(`Compatibility view ${id} must not target the artifact store.`, 'compatibility-view');
      }
      for (const other of destinations) {
        if (isPathWithin(other, destination) || isPathWithin(destination, other)) {
          throw new ArtifactStoreError(`Compatibility view destinations overlap: ${other} and ${destination}.`, 'compatibility-view');
        }
      }
      destinations.push(destination);
      return { id, componentId, objectDigest, destination, ...compatibilitySiblingPaths(destination, transactionId) };
    });
    return normalized.sort((left, right) => compareUtf8(left.id, right.id));
  }

  function validateJournal(journal) {
    assertSelfDigest(journal, 'artifact promotion journal');
    if (journal.schema !== ARTIFACT_PROMOTION_JOURNAL_SCHEMA) {
      throw new ArtifactStoreError(`Unsupported promotion journal schema ${journal.schema}.`, 'promotion-journal-schema');
    }
    assertSegment(journal.transactionId, 'promotion journal transactionId');
    if (journal.previousPointer !== null) validatePointer(journal.previousPointer);
    validatePointer(journal.nextPointer);
    if (!Array.isArray(journal.views)) throw new ArtifactStoreError('Promotion journal views must be an array.', 'promotion-journal-shape');
    for (const view of journal.views) {
      assertSegment(view.id, 'promotion journal view id');
      assertSegment(view.componentId, 'promotion journal component id');
      assertDigest(view.objectDigest, 'promotion journal object digest');
      if (view.previousViewDigest !== null) assertDigest(view.previousViewDigest, 'promotion journal previous view digest');
      if (typeof view.destination !== 'string' || !path.isAbsolute(view.destination)) {
        throw new ArtifactStoreError('Promotion journal destination must be absolute.', 'promotion-journal-shape');
      }
      const expected = compatibilitySiblingPaths(view.destination, journal.transactionId);
      if (view.stagedPath !== expected.stagedPath || view.backupPath !== expected.backupPath) {
        throw new ArtifactStoreError('Promotion journal sibling paths are invalid.', 'promotion-journal-path');
      }
      if (isPathWithin(root, view.destination)) {
        throw new ArtifactStoreError('Promotion journal must not target the artifact store.', 'promotion-journal-path');
      }
    }
    return journal;
  }

  async function writeJournal(body) {
    const journal = withSelfDigest(body);
    validateJournal(journal);
    await writeJsonAtomic(paths.journal, journal);
    return journal;
  }

  async function readJournal() {
    const value = await readRegularJson(paths.journal, 'artifact promotion journal');
    return value ? validateJournal(value) : null;
  }

  async function removeCompatibilityScratch(views) {
    for (const view of views) {
      await rm(view.stagedPath, { recursive: true, force: true });
      await rm(view.backupPath, { recursive: true, force: true });
    }
  }

  async function prepareCompatibilityViews(views, checkpoint) {
    const prepared = [];
    try {
      for (const view of views) {
        await mkdir(path.dirname(view.destination), { recursive: true });
        if ((await pathState(view.stagedPath)) || (await pathState(view.backupPath))) {
          throw new ArtifactStoreError(`Compatibility scratch paths already exist for ${view.id}.`, 'compatibility-scratch');
        }
        const destinationState = await pathState(view.destination);
        if (destinationState?.isSymbolicLink()) {
          throw new ArtifactStoreError(`Compatibility destination must not be a symlink: ${view.destination}`, 'compatibility-symlink');
        }
        if (destinationState && !destinationState.isDirectory()) {
          throw new ArtifactStoreError(`Compatibility destination must be a directory: ${view.destination}`, 'compatibility-view');
        }
        const previousSeal = destinationState ? await sealArtifactTree(view.destination) : null;
        const object = await verifyObject(view.objectDigest);
        await cp(object.root, view.stagedPath, { recursive: true, force: false, errorOnExist: true, dereference: false });
        await verifyArtifactTree(view.stagedPath, object.seal);
        const preparedView = {
          ...view,
          hadDestination: Boolean(destinationState),
          previousViewDigest: previousSeal?.digest ?? null,
          state: 'prepared',
        };
        prepared.push(preparedView);
        await invokeCheckpoint(checkpoint, 'compatibility:after-copy', { view: preparedView });
      }
      return prepared;
    } catch (error) {
      await removeCompatibilityScratch([...prepared, ...views.filter((view) => !prepared.some((item) => item.id === view.id))]);
      throw error;
    }
  }

  async function rollbackCompatibilityViews(journal) {
    for (const view of [...journal.views].reverse()) {
      const backupState = await pathState(view.backupPath);
      if (backupState) {
        if (backupState.isSymbolicLink() || !backupState.isDirectory()) {
          throw new ArtifactStoreError(`Compatibility backup is invalid: ${view.backupPath}`, 'compatibility-backup');
        }
        await rm(view.destination, { recursive: true, force: true });
        await rename(view.backupPath, view.destination);
      } else if (!view.hadDestination) {
        await rm(view.destination, { recursive: true, force: true });
      }

      if (view.hadDestination) {
        const destinationState = await pathState(view.destination);
        if (!destinationState) {
          throw new ArtifactStoreError(`Cannot restore previous compatibility view ${view.destination}.`, 'compatibility-rollback');
        }
        const restored = await sealArtifactTree(view.destination);
        if (restored.digest !== view.previousViewDigest) {
          throw new ArtifactStoreError(`Restored compatibility view ${view.destination} does not match its prior tree.`, 'compatibility-rollback');
        }
      }
      await rm(view.stagedPath, { recursive: true, force: true });
      await rm(view.backupPath, { recursive: true, force: true });
    }
  }

  async function finishForwardCompatibilityViews(journal) {
    for (const view of journal.views) {
      const destinationState = await pathState(view.destination);
      let ready = false;
      if (destinationState?.isDirectory() && !destinationState.isSymbolicLink()) {
        ready = (await sealArtifactTree(view.destination)).digest === view.objectDigest;
      }
      if (!ready) {
        await rm(view.destination, { recursive: true, force: true });
        let stagedState = await pathState(view.stagedPath);
        if (stagedState) {
          try {
            const stagedSeal = await sealArtifactTree(view.stagedPath);
            if (stagedSeal.digest !== view.objectDigest) {
              await rm(view.stagedPath, { recursive: true, force: true });
              stagedState = null;
            }
          } catch {
            await rm(view.stagedPath, { recursive: true, force: true });
            stagedState = null;
          }
        }
        if (!stagedState) {
          const object = await verifyObject(view.objectDigest);
          await cp(object.root, view.stagedPath, { recursive: true, force: false, errorOnExist: true, dereference: false });
          await verifyArtifactTree(view.stagedPath, object.seal);
        }
        await rename(view.stagedPath, view.destination);
      }
      const finalSeal = await sealArtifactTree(view.destination);
      if (finalSeal.digest !== view.objectDigest) {
        throw new ArtifactStoreError(`Forward compatibility recovery failed for ${view.destination}.`, 'compatibility-forward');
      }
      await rm(view.backupPath, { recursive: true, force: true });
      await rm(view.stagedPath, { recursive: true, force: true });
    }
  }

  async function recoverPromotionUnderLock(checkpoint) {
    const journal = await readJournal();
    if (!journal) return { recovered: false, disposition: 'none' };
    const current = await readCurrentPointer();
    const currentDigest = pointerDigest(current);
    const previousDigest = pointerDigest(journal.previousPointer);
    if (currentDigest === journal.nextPointer.digest) {
      await finishForwardCompatibilityViews(journal);
      await rm(paths.journal, { force: true });
      await invokeCheckpoint(checkpoint, 'recovery:completed-forward', { transactionId: journal.transactionId });
      return { recovered: true, disposition: 'completed-forward', pointer: current };
    }
    if (currentDigest === previousDigest) {
      await rollbackCompatibilityViews(journal);
      await rm(paths.journal, { force: true });
      await invokeCheckpoint(checkpoint, 'recovery:rolled-back', { transactionId: journal.transactionId });
      return { recovered: true, disposition: 'rolled-back', pointer: current };
    }
    throw new ArtifactStoreError(
      `Promotion journal expects pointer ${previousDigest ?? 'absent'} or ${journal.nextPointer.digest}, found ${currentDigest ?? 'absent'}.`,
      'promotion-recovery-diverged',
    );
  }

  async function withPromotionLock(operation) {
    const release = await acquirePromotionLock();
    let result;
    let operationError = null;
    try {
      result = await operation();
    } catch (error) {
      operationError = error;
    }
    let releaseError = null;
    try {
      await release();
    } catch (error) {
      releaseError = error;
    }
    if (operationError) throw operationError;
    if (releaseError) throw releaseError;
    return result;
  }

  async function recoverPromotion({ checkpoint } = {}) {
    const selectedCheckpoint = checkpoint ?? defaultCheckpoint;
    return withPromotionLock(() => recoverPromotionUnderLock(selectedCheckpoint));
  }

  async function promote({
    components,
    compatibilityViews = [],
    expectedPointerDigest,
    checkpoint,
    recoverOnError = true,
  } = {}) {
    await ensureLayout();
    const selectedCheckpoint = checkpoint ?? defaultCheckpoint;
    const normalizedComponents = normalizeComponents(components);
    const observedBeforeLock = await readCurrentPointer();
    const expected = expectedPointerDigest === undefined ? pointerDigest(observedBeforeLock) : expectedPointerDigest;
    if (expected !== null) assertDigest(expected, 'expectedPointerDigest');

    return withPromotionLock(async () => {
      await invokeCheckpoint(selectedCheckpoint, 'promotion:lock-acquired', { expectedPointerDigest: expected });
      await recoverPromotionUnderLock(selectedCheckpoint);
      const previousPointer = await readCurrentPointer();
      if (pointerDigest(previousPointer) !== expected) {
        throw new ArtifactStoreError(
          `Stale promotion expected pointer ${expected ?? 'absent'}, found ${pointerDigest(previousPointer) ?? 'absent'}.`,
          'stale-promotion',
        );
      }

      for (const component of normalizedComponents) await verifyObject(component.objectDigest);
      const envelope = createEnvelope(normalizedComponents);
      await writeEnvelope(envelope);
      if (previousPointer) await writePointerVersion(previousPointer);
      await invokeCheckpoint(selectedCheckpoint, 'promotion:after-envelope', { envelope });

      const transactionId = randomUUID();
      const views = normalizeCompatibilityViews(compatibilityViews, normalizedComponents, transactionId);
      let preparedViews = [];
      let journalWritten = false;
      try {
        preparedViews = await prepareCompatibilityViews(views, selectedCheckpoint);
        const nextPointer = withSelfDigest({
          schema: ARTIFACT_POINTER_SCHEMA,
          generation: (previousPointer?.generation ?? 0) + 1,
          contentSetDigest: envelope.contentSetDigest,
          envelopeDigest: envelope.digest,
          envelopePath: path.posix.join('envelopes', `${envelope.contentSetDigest}.json`),
          previousPointerDigest: pointerDigest(previousPointer),
        });
        let journalBody = {
          schema: ARTIFACT_PROMOTION_JOURNAL_SCHEMA,
          transactionId,
          state: 'prepared',
          previousPointer: previousPointer
            ? Object.fromEntries(Object.entries(previousPointer).filter(([key]) => key !== 'envelope'))
            : null,
          nextPointer,
          views: preparedViews,
        };
        await writePointerVersion(nextPointer);
        await writeJournal(journalBody);
        journalWritten = true;
        await invokeCheckpoint(selectedCheckpoint, 'promotion:after-journal', { transactionId });

        for (let index = 0; index < preparedViews.length; index += 1) {
          const view = preparedViews[index];
          if (view.hadDestination) await rename(view.destination, view.backupPath);
          const backedUpView = { ...view, state: 'backed-up' };
          await invokeCheckpoint(selectedCheckpoint, 'compatibility:after-backup', { view: backedUpView });
          preparedViews[index] = backedUpView;
          journalBody = { ...journalBody, state: 'switching-views', views: preparedViews };
          await writeJournal(journalBody);

          await rename(view.stagedPath, view.destination);
          const switchedView = { ...preparedViews[index], state: 'switched' };
          await invokeCheckpoint(selectedCheckpoint, 'compatibility:after-switch', { view: switchedView });
          preparedViews[index] = switchedView;
          journalBody = { ...journalBody, views: preparedViews };
          await writeJournal(journalBody);
        }

        for (const view of preparedViews) {
          const finalSeal = await sealArtifactTree(view.destination);
          if (finalSeal.digest !== view.objectDigest) {
            throw new ArtifactStoreError(`Compatibility view ${view.id} changed before pointer promotion.`, 'compatibility-verify');
          }
        }
        await invokeCheckpoint(selectedCheckpoint, 'promotion:before-pointer', { nextPointer });
        await writeJsonAtomic(paths.pointer, nextPointer);
        await invokeCheckpoint(selectedCheckpoint, 'promotion:after-pointer', { nextPointer });
        journalBody = { ...journalBody, state: 'pointer-switched', views: preparedViews };
        await writeJournal(journalBody);
        await finishForwardCompatibilityViews(withSelfDigest(journalBody));
        await rm(paths.journal, { force: true });
        const promoted = await readCurrentPointer();
        await invokeCheckpoint(selectedCheckpoint, 'promotion:complete', { pointer: promoted });
        return { pointer: promoted, envelope, transactionId };
      } catch (error) {
        if (journalWritten && recoverOnError) {
          try {
            await recoverPromotionUnderLock(selectedCheckpoint);
          } catch (recoveryError) {
            throw new AggregateError([error, recoveryError], 'Artifact promotion failed and automatic recovery also failed.');
          }
        } else if (!journalWritten) {
          await removeCompatibilityScratch(preparedViews.length > 0 ? preparedViews : views);
        }
        throw error;
      }
    });
  }

  return Object.freeze({
    root,
    paths,
    createRun,
    discardRun,
    sealTree: sealArtifactTree,
    verifyTree: verifyArtifactTree,
    computeContentSetDigest: computeArtifactContentSetDigest,
    installObject,
    verifyObject,
    readCurrentPointer,
    readPointerVersion,
    promote,
    recoverPromotion,
  });
}
