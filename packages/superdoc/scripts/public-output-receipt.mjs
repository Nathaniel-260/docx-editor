import { createHash, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

import {
  ENGINE_EXPECTED_RECEIPT_DIGEST_ENV,
  canonicalJson,
  hashSourceInputClosure,
  observeEngineInputIdentity,
  readDeclaredEngineVersion,
  resolveEngineInputContract,
  verifyInstalledEngine,
  verifyPreparedEngine,
} from '../../../scripts/engine-prepared-input.mjs';
import {
  ARTIFACT_ENVELOPE_SCHEMA,
  ARTIFACT_POINTER_SCHEMA,
  ARTIFACT_TREE_SCHEMA,
  artifactCanonicalSha256,
  computeArtifactContentSetDigest,
} from '../../../scripts/superdoc-artifact-store.mjs';

export const PUBLIC_OUTPUT_RECEIPT_SCHEMA = 'superdoc-public-producer-receipt.v1';

const SURFACE_DIRECTORIES = Object.freeze({ npm: 'dist', cdn: 'dist-cdn' });
const SURFACE_NAMES = Object.freeze(Object.keys(SURFACE_DIRECTORIES));
const PUBLIC_SOURCE_IDENTITY_SCHEMA = 'superdoc-public-source-identity.v2';
const PUBLIC_BUILD_RECIPE_SCHEMA = 'superdoc-public-build-recipe.v1';
export class PublicOutputReceiptError extends Error {
  constructor(message, code = 'public-output-receipt') {
    super(message);
    this.name = 'PublicOutputReceiptError';
    this.code = code;
  }
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function sha256Canonical(value) {
  return sha256(canonicalJson(value));
}

function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

function runGit(repoRoot, args, { encoding = 'utf8' } = {}) {
  const result = spawnSync('git', ['-C', repoRoot, ...args], {
    encoding,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new PublicOutputReceiptError(
      `cannot establish public source identity: git ${args.join(' ')} failed (${String(result.stderr ?? '').trim()})`,
      'public-output-source-identity',
    );
  }
  return result.stdout;
}

function resolveGitRoot(packageRoot) {
  const result = spawnSync('git', ['-C', packageRoot, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' });
  if (result.error || result.status !== 0) return null;
  return path.resolve(result.stdout.trim());
}

function publicInputPaths(packageRoot, repoRoot) {
  const publicRoot = path.resolve(realpathSync(packageRoot), '../..');
  const publicRelative = path.relative(repoRoot, publicRoot);
  if (publicRelative === '..' || publicRelative.startsWith(`..${path.sep}`) || path.isAbsolute(publicRelative)) {
    throw new PublicOutputReceiptError(
      `public package root is outside its git worktree: ${packageRoot}`,
      'public-output-source-identity',
    );
  }
  const inputs = new Set(['package.json', 'pnpm-lock.yaml', publicRelative || '.']);
  const wrapperRoot = path.dirname(publicRoot);
  const wrapperRelative = path.relative(repoRoot, wrapperRoot);
  if (
    publicRelative &&
    wrapperRelative !== '..' &&
    !wrapperRelative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(wrapperRelative)
  ) {
    inputs.add(path.join(wrapperRelative, 'package.json'));
    inputs.add(path.join(wrapperRelative, 'pnpm-lock.yaml'));
  }
  return [...inputs].map((entry) => entry.split(path.sep).join('/'));
}

/** Bind output to HEAD plus every relevant tracked and untracked public change. */
export function observePublicSourceIdentity({
  packageRoot,
  repoRoot = null,
}) {
  const gitRoot = resolveGitRoot(repoRoot ?? packageRoot);
  if (!gitRoot) {
    const publicRoot = path.resolve(realpathSync(packageRoot), '../..');
    const privateV2Source = path.resolve(publicRoot, '../v2/src/superdoc/index.ts');
    const contentRoot = realpathSync(
      repoRoot ?? (existsSync(privateV2Source) ? path.resolve(publicRoot, '../..') : publicRoot),
    );
    const closure = hashSourceInputClosure({
      root: contentRoot,
      inputPaths: publicInputPaths(packageRoot, contentRoot),
      label: 'public',
    });
    const body = {
      schema: PUBLIC_SOURCE_IDENTITY_SCHEMA,
      mode: 'content',
      contentDigest: closure.digest,
      fileCount: closure.fileCount,
      sizeBytes: closure.sizeBytes,
    };
    return { ...body, digest: sha256Canonical(body) };
  }
  repoRoot = realpathSync(gitRoot);
  const inputPaths = publicInputPaths(packageRoot, repoRoot);
  const headSha = runGit(repoRoot, ['rev-parse', 'HEAD']).trim();
  const trackedDiff = runGit(repoRoot, ['diff', '--binary', 'HEAD', '--', ...inputPaths], {
    encoding: null,
  });
  const untrackedOutput = runGit(
    repoRoot,
    ['ls-files', '--others', '--exclude-standard', '-z', '--', ...inputPaths],
    { encoding: 'utf8' },
  );
  const untracked = untrackedOutput
    .split('\0')
    .filter(Boolean)
    .sort(compareUtf8)
    .map((relative) => {
      const absolute = path.resolve(repoRoot, relative);
      const info = lstatSync(absolute, { throwIfNoEntry: false });
      if (!info?.isFile() || info.isSymbolicLink()) {
        throw new PublicOutputReceiptError(
          `unexpected untracked public input entry: ${relative}`,
          'public-output-source-identity',
        );
      }
      const bytes = readFileSync(absolute);
      return { path: relative.split(path.sep).join('/'), sha256: sha256(bytes), sizeBytes: bytes.byteLength };
    });
  const body = {
    schema: PUBLIC_SOURCE_IDENTITY_SCHEMA,
    mode: 'git',
    headSha,
    trackedDiffSha256: sha256(trackedDiff),
    untracked,
  };
  return { ...body, digest: sha256Canonical(body) };
}

function normalizePublicSourceIdentity(identity) {
  const validGitIdentity =
    identity?.mode === 'git' &&
    /^[a-f0-9]{40,64}$/u.test(identity.headSha ?? '') &&
    /^[a-f0-9]{64}$/u.test(identity.trackedDiffSha256 ?? '') &&
    Array.isArray(identity.untracked);
  const validContentIdentity =
    identity?.mode === 'content' &&
    /^[a-f0-9]{64}$/u.test(identity.contentDigest ?? '') &&
    Number.isSafeInteger(identity.fileCount) &&
    identity.fileCount >= 0 &&
    Number.isSafeInteger(identity.sizeBytes) &&
    identity.sizeBytes >= 0;
  if (identity?.schema !== PUBLIC_SOURCE_IDENTITY_SCHEMA || (!validGitIdentity && !validContentIdentity)) {
    throw new PublicOutputReceiptError('public source identity has an invalid shape', 'public-output-source-identity');
  }
  const { digest, ...body } = identity;
  if (!/^[a-f0-9]{64}$/u.test(digest ?? '') || digest !== sha256Canonical(body)) {
    throw new PublicOutputReceiptError('public source identity failed its self-digest check', 'public-output-source-identity');
  }
  return identity;
}

function publicBuildRecipe(surfaces) {
  const body = {
    schema: PUBLIC_BUILD_RECIPE_SCHEMA,
    surfaces,
    outputIdentity: 'sorted-path-sha256-exact-tree.v1',
    engineInputContract: 'verified-installed-or-prepared.v1',
    toolchain: { node: process.version },
  };
  return { ...body, digest: sha256Canonical(body) };
}

function assertPlainFile(filePath, label) {
  const stat = lstatSync(filePath, { throwIfNoEntry: false });
  if (!stat?.isFile() || stat.isSymbolicLink()) {
    throw new PublicOutputReceiptError(`${label} must be a regular file: ${filePath}`, 'public-output-file');
  }
}

/** Return a sorted, exact content identity for a directory tree. */
export function hashPublicTree(root) {
  const rootStat = lstatSync(root, { throwIfNoEntry: false });
  if (!rootStat?.isDirectory() || rootStat.isSymbolicLink()) {
    throw new PublicOutputReceiptError(
      `public output tree must be a regular directory: ${root}`,
      'public-output-tree',
    );
  }

  const relativeFiles = [];
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new PublicOutputReceiptError(
          `public output tree contains a symlink: ${absolute}`,
          'public-output-symlink',
        );
      }
      if (entry.isDirectory()) walk(absolute);
      else if (entry.isFile()) relativeFiles.push(path.relative(root, absolute).split(path.sep).join('/'));
      else {
        throw new PublicOutputReceiptError(
          `public output tree contains an unsupported filesystem entry: ${absolute}`,
          'public-output-entry',
        );
      }
    }
  };
  walk(root);

  const files = relativeFiles.sort(compareUtf8).map((relative) => {
    const data = readFileSync(path.join(root, ...relative.split('/')));
    return { path: relative, sha256: sha256(data), sizeBytes: data.byteLength };
  });
  return {
    files,
    digest: sha256Canonical(files),
    fileCount: files.length,
    sizeBytes: files.reduce((total, file) => total + file.sizeBytes, 0),
  };
}

/** Synchronous exact-tree seal compatible with the shared artifact store. */
export function sealPublicArtifactObject(root) {
  const rootState = lstatSync(root, { throwIfNoEntry: false });
  if (!rootState?.isDirectory() || rootState.isSymbolicLink()) {
    throw new PublicOutputReceiptError(
      `public artifact object must be a regular directory: ${root}`,
      'public-output-selection',
    );
  }
  const directories = [];
  const files = [];
  const walk = (directory, relativeParent = '') => {
    const entries = readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
      compareUtf8(left.name, right.name),
    );
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      const relative = relativeParent ? path.posix.join(relativeParent, entry.name) : entry.name;
      const state = lstatSync(absolute);
      if (state.isSymbolicLink()) {
        throw new PublicOutputReceiptError(
          `public artifact object contains a symlink: ${absolute}`,
          'public-output-selection',
        );
      }
      if (state.isDirectory()) {
        directories.push(relative);
        walk(absolute, relative);
      } else if (state.isFile()) {
        files.push({ path: relative, sha256: sha256(readFileSync(absolute)), sizeBytes: state.size });
      } else {
        throw new PublicOutputReceiptError(
          `public artifact object contains an unsupported filesystem entry: ${absolute}`,
          'public-output-selection',
        );
      }
    }
  };
  walk(root);
  directories.sort(compareUtf8);
  files.sort((left, right) => compareUtf8(left.path, right.path));
  const body = { schema: ARTIFACT_TREE_SCHEMA, directories, files };
  return {
    ...body,
    digest: artifactCanonicalSha256(body),
    fileCount: files.length,
    sizeBytes: files.reduce((total, file) => total + file.sizeBytes, 0),
  };
}

export function publicOutputReceiptPath(packageRoot) {
  return path.join(packageRoot, 'build-receipts', 'public-producer-receipt.json');
}

export function publicArtifactStoreRoot(packageRoot) {
  return path.join(packageRoot, '.build-artifacts', 'public');
}

function readSelfDigestedArtifactJson(filePath, label, schema) {
  const fileState = lstatSync(filePath, { throwIfNoEntry: false });
  if (!fileState?.isFile() || fileState.isSymbolicLink()) {
    throw new PublicOutputReceiptError(`${label} must be a regular file: ${filePath}`, 'public-output-selection');
  }
  let value;
  try {
    value = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new PublicOutputReceiptError(
      `${label} is not valid JSON: ${filePath} (${error.message})`,
      'public-output-selection',
    );
  }
  if (value?.schema !== schema) {
    throw new PublicOutputReceiptError(
      `${label} schema mismatch: expected ${schema}, got ${value?.schema}`,
      'public-output-selection',
    );
  }
  const { digest, ...body } = value;
  if (!/^[a-f0-9]{64}$/u.test(digest ?? '') || digest !== artifactCanonicalSha256(body)) {
    throw new PublicOutputReceiptError(`${label} failed its self-digest check: ${filePath}`, 'public-output-selection');
  }
  return value;
}

function assertPathWithin(root, candidate, label) {
  const relative = path.relative(root, candidate);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new PublicOutputReceiptError(`${label} escapes the public artifact store`, 'public-output-selection');
  }
}

/**
 * Resolve the immutable public component selected by the promoted pointer.
 * Canonical dist paths are used only when no local store pointer exists, as
 * happens after a sealed candidate is restored onto another runner.
 */
export function readPublicOutputSelection({ packageRoot }) {
  const storeRoot = publicArtifactStoreRoot(packageRoot);
  const pointerPath = path.join(storeRoot, 'pointers', 'current.json');
  if (!existsSync(pointerPath)) {
    const receiptPath = publicOutputReceiptPath(packageRoot);
    return {
      receipt: readPublicOutputReceipt({ packageRoot, receiptPath }),
      receiptPath,
      surfaceRoots: {
        npm: path.join(packageRoot, SURFACE_DIRECTORIES.npm),
        cdn: path.join(packageRoot, SURFACE_DIRECTORIES.cdn),
      },
      pointer: null,
    };
  }

  const pointer = readSelfDigestedArtifactJson(
    pointerPath,
    'public artifact pointer',
    ARTIFACT_POINTER_SCHEMA,
  );
  if (
    !Number.isSafeInteger(pointer.generation) ||
    pointer.generation < 1 ||
    !/^[a-f0-9]{64}$/u.test(pointer.contentSetDigest ?? '') ||
    !/^[a-f0-9]{64}$/u.test(pointer.envelopeDigest ?? '') ||
    (pointer.previousPointerDigest !== null && !/^[a-f0-9]{64}$/u.test(pointer.previousPointerDigest ?? ''))
  ) {
    throw new PublicOutputReceiptError('public artifact pointer has an invalid shape', 'public-output-selection');
  }
  const expectedEnvelopePath = path.posix.join('envelopes', `${pointer.contentSetDigest}.json`);
  if (pointer.envelopePath !== expectedEnvelopePath) {
    throw new PublicOutputReceiptError(
      'public artifact pointer selects a non-content-addressed envelope path',
      'public-output-selection',
    );
  }
  const envelopePath = path.join(storeRoot, ...pointer.envelopePath.split('/'));
  assertPathWithin(storeRoot, envelopePath, 'public artifact envelope');
  const envelope = readSelfDigestedArtifactJson(
    envelopePath,
    'public artifact envelope',
    ARTIFACT_ENVELOPE_SCHEMA,
  );
  if (envelope.digest !== pointer.envelopeDigest || envelope.contentSetDigest !== pointer.contentSetDigest) {
    throw new PublicOutputReceiptError(
      'public artifact pointer does not match its envelope',
      'public-output-selection',
    );
  }
  if (!Array.isArray(envelope.components) || envelope.components.length === 0) {
    throw new PublicOutputReceiptError('public artifact envelope has no components', 'public-output-selection');
  }
  let computedContentSetDigest;
  try {
    computedContentSetDigest = computeArtifactContentSetDigest(envelope.components);
  } catch (error) {
    throw new PublicOutputReceiptError(
      `public artifact envelope has invalid components (${error.message})`,
      'public-output-selection',
    );
  }
  if (computedContentSetDigest !== envelope.contentSetDigest) {
    throw new PublicOutputReceiptError(
      'public artifact envelope failed its content-set digest check',
      'public-output-selection',
    );
  }
  const components = new Map();
  for (const component of envelope.components) {
    if (!['npm', 'cdn', 'receipt'].includes(component.id)) {
      throw new PublicOutputReceiptError(
        `public artifact envelope contains unsupported component ${component.id}`,
        'public-output-selection',
      );
    }
    if (components.has(component.id)) {
      throw new PublicOutputReceiptError(
        `public artifact envelope repeats component ${component.id}`,
        'public-output-selection',
      );
    }
    components.set(component.id, component);
  }
  const objectRoot = (component, label) => {
    if (
      !component ||
      !/^[a-f0-9]{64}$/u.test(component.objectDigest ?? '') ||
      component.objectPath !== path.posix.join('objects', component.objectDigest)
    ) {
      throw new PublicOutputReceiptError(
        `public artifact envelope has an invalid ${label} component path`,
        'public-output-selection',
      );
    }
    const root = path.join(storeRoot, 'objects', component.objectDigest);
    assertPathWithin(storeRoot, root, `public ${label} object`);
    const rootState = lstatSync(root, { throwIfNoEntry: false });
    if (!rootState?.isDirectory() || rootState.isSymbolicLink()) {
      throw new PublicOutputReceiptError(
        `public ${label} object must be an immutable directory: ${root}`,
        'public-output-selection',
      );
    }
    const objectSeal = sealPublicArtifactObject(root);
    if (objectSeal.digest !== component.objectDigest) {
      throw new PublicOutputReceiptError(
        `public ${label} object tree digest ${objectSeal.digest} does not match component ${component.objectDigest}`,
        'public-output-selection',
      );
    }
    return root;
  };

  const componentRoots = new Map();
  for (const [id, component] of components) componentRoots.set(id, objectRoot(component, id));
  const receiptRoot = componentRoots.get('receipt');
  if (!receiptRoot) {
    throw new PublicOutputReceiptError(
      'public artifact envelope has no receipt component',
      'public-output-selection',
    );
  }
  const receiptPath = path.join(receiptRoot, 'public-producer-receipt.json');
  const receipt = readPublicOutputReceipt({ packageRoot, receiptPath });
  const surfaceRoots = {};
  for (const surface of Object.keys(receipt.surfaces ?? {})) {
    if (!SURFACE_NAMES.includes(surface)) {
      throw new PublicOutputReceiptError(
        `public producer receipt contains unsupported surface ${surface}`,
        'public-output-selection',
      );
    }
    const root = componentRoots.get(surface);
    if (!root) {
      throw new PublicOutputReceiptError(
        `public artifact envelope has no ${surface} component sealed by its receipt`,
        'public-output-selection',
      );
    }
    surfaceRoots[surface] = root;
  }
  return { receipt, receiptPath, surfaceRoots, pointer: { ...pointer, envelope } };
}

function normalizeSurfaces(surfaces, label) {
  if (!Array.isArray(surfaces) || surfaces.length === 0) {
    throw new PublicOutputReceiptError(`${label} must name at least one surface`, 'public-output-surface');
  }
  const unique = [...new Set(surfaces)];
  for (const surface of unique) {
    if (!SURFACE_NAMES.includes(surface)) {
      throw new PublicOutputReceiptError(
        `${label} contains unsupported surface ${JSON.stringify(surface)}; expected npm or cdn`,
        'public-output-surface',
      );
    }
  }
  return SURFACE_NAMES.filter((surface) => unique.includes(surface));
}

function resolveSurfaceRoots({ packageRoot, surfaceRoot = packageRoot, surfaceRoots = null, env = process.env }) {
  const configured = {
    npm: env.SUPERDOC_PUBLIC_NPM_OUT_DIR,
    cdn: env.SUPERDOC_PUBLIC_CDN_OUT_DIR,
  };
  return Object.fromEntries(
    SURFACE_NAMES.map((surface) => {
      const explicit = surfaceRoots?.[surface];
      const root = explicit ?? configured[surface] ?? path.join(surfaceRoot, SURFACE_DIRECTORIES[surface]);
      return [surface, path.resolve(root)];
    }),
  );
}

function readPackageIdentity(packageRoot) {
  const manifestPath = path.join(packageRoot, 'package.json');
  assertPlainFile(manifestPath, 'SuperDoc source manifest');
  const bytes = readFileSync(manifestPath);
  let manifest;
  try {
    manifest = JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    throw new PublicOutputReceiptError(
      `SuperDoc source manifest is not valid JSON: ${manifestPath} (${error.message})`,
      'public-output-package-manifest',
    );
  }
  if (manifest.name !== 'superdoc' || typeof manifest.version !== 'string') {
    throw new PublicOutputReceiptError(
      `SuperDoc source manifest has an unsupported name or version: ${manifestPath}`,
      'public-output-package-manifest',
    );
  }
  return { name: manifest.name, version: manifest.version, manifestSha256: sha256(bytes) };
}

function normalizeEngineInput(value) {
  if (!value || typeof value !== 'object') {
    throw new PublicOutputReceiptError('engine input identity is missing', 'public-output-engine-input');
  }
  if (value.mode === 'prepared') {
    if (
      typeof value.engineVersion !== 'string' ||
      !/^[a-f0-9]{64}$/u.test(value.producerReceiptDigest ?? '') ||
      !/^[a-f0-9]{64}$/u.test(value.distDigest ?? '')
    ) {
      throw new PublicOutputReceiptError(
        'prepared engine input identity is incomplete',
        'public-output-engine-input',
      );
    }
    return {
      mode: 'prepared',
      engineVersion: value.engineVersion,
      producerReceiptDigest: value.producerReceiptDigest,
      distDigest: value.distDigest,
    };
  }
  if (value.mode === 'installed') {
    if (
      typeof value.engineVersion !== 'string' ||
      !/^[a-f0-9]{64}$/u.test(value.packageManifestSha256 ?? '') ||
      !/^[a-f0-9]{64}$/u.test(value.distDigest ?? '')
    ) {
      throw new PublicOutputReceiptError(
        'installed engine input identity is incomplete',
        'public-output-engine-input',
      );
    }
    return {
      mode: 'installed',
      engineVersion: value.engineVersion,
      packageManifestSha256: value.packageManifestSha256,
      distDigest: value.distDigest,
    };
  }
  throw new PublicOutputReceiptError(
    `unsupported engine input mode ${JSON.stringify(value.mode)}`,
    'public-output-engine-input',
  );
}

/** Observe the exact engine input that the public build is allowed to consume. */
export function observePublicEngineInput({ packageRoot, v2Root, env = process.env, expectedIdentity = null }) {
  if (env.SUPERDOC_V2_RUNTIME_MODE === 'source') {
    throw new PublicOutputReceiptError(
      'source-mode public output is a development surface and cannot be sealed for packing',
      'public-output-source-mode',
    );
  }
  const expectedVersion = readDeclaredEngineVersion(packageRoot);
  const contract = resolveEngineInputContract({ env, v2Root });
  let identity;
  if (contract.mode === 'prepared') {
    const expectedReceiptDigest =
      expectedIdentity?.mode === 'prepared'
        ? expectedIdentity.producerReceiptDigest
        : (env[ENGINE_EXPECTED_RECEIPT_DIGEST_ENV] ?? null);
    const verified = verifyPreparedEngine({
      v2Root,
      expectedVersion,
      surfaces: ['dist'],
      expectedReceiptDigest,
      currentInputIdentity: observeEngineInputIdentity({ v2Root }),
    });
    identity = {
      mode: 'prepared',
      engineVersion: verified.engineVersion,
      producerReceiptDigest: verified.receipt.digest,
      distDigest: verified.surfaces.dist.digest,
    };
  } else {
    const verified = verifyInstalledEngine({ packageRoot, expectedVersion });
    const manifestPath = path.join(verified.engineRoot, 'package.json');
    assertPlainFile(manifestPath, 'installed engine manifest');
    identity = {
      mode: 'installed',
      engineVersion: verified.engineVersion,
      packageManifestSha256: sha256(readFileSync(manifestPath)),
      distDigest: hashPublicTree(path.join(verified.engineRoot, 'dist')).digest,
    };
  }
  const normalized = normalizeEngineInput(identity);
  if (expectedIdentity && canonicalJson(normalized) !== canonicalJson(normalizeEngineInput(expectedIdentity))) {
    throw new PublicOutputReceiptError(
      'the current engine input does not match the engine identity sealed by the public producer receipt',
      'public-output-engine-binding',
    );
  }
  return normalized;
}

function withReceiptDigest(unsigned) {
  return { ...unsigned, digest: sha256Canonical(unsigned) };
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

export function invalidatePublicOutputReceipt({ packageRoot, receiptPath = publicOutputReceiptPath(packageRoot) }) {
  rmSync(receiptPath, { force: true });
  return receiptPath;
}

export function writePublicOutputReceipt({
  packageRoot,
  v2Root = path.resolve(packageRoot, '../../../v2'),
  surfaces,
  env = process.env,
  engineInput = null,
  sourceIdentity = null,
  surfaceRoot = packageRoot,
  surfaceRoots = null,
  receiptPath = publicOutputReceiptPath(packageRoot),
}) {
  const selectedSurfaces = normalizeSurfaces(surfaces, 'surfaces');
  const roots = resolveSurfaceRoots({ packageRoot, surfaceRoot, surfaceRoots, env });
  const packageIdentity = readPackageIdentity(packageRoot);
  const currentSourceIdentity = observePublicSourceIdentity({ packageRoot });
  const sealedSourceIdentity = sourceIdentity ? normalizePublicSourceIdentity(sourceIdentity) : currentSourceIdentity;
  if (canonicalJson(sealedSourceIdentity) !== canonicalJson(currentSourceIdentity)) {
    throw new PublicOutputReceiptError(
      'public source inputs changed while the public outputs were being built',
      'public-output-source-race',
    );
  }
  const observedEngineInput = engineInput
    ? normalizeEngineInput(engineInput)
    : observePublicEngineInput({ packageRoot, v2Root, env });
  const sealedSurfaces = {};
  for (const surface of selectedSurfaces) {
    const tree = hashPublicTree(roots[surface]);
    sealedSurfaces[surface] = {
      directory: SURFACE_DIRECTORIES[surface],
      digest: tree.digest,
      fileCount: tree.fileCount,
      sizeBytes: tree.sizeBytes,
    };
  }
  const receipt = withReceiptDigest({
    schema: PUBLIC_OUTPUT_RECEIPT_SCHEMA,
    package: packageIdentity,
    sourceIdentity: sealedSourceIdentity,
    recipe: publicBuildRecipe(selectedSurfaces),
    target: selectedSurfaces.length === SURFACE_NAMES.length ? 'all' : selectedSurfaces[0],
    engineInput: observedEngineInput,
    surfaces: sealedSurfaces,
    toolchain: { node: process.version },
    createdAtIso: new Date().toISOString(),
  });
  writeJsonAtomic(receiptPath, receipt);
  return { filePath: receiptPath, receipt };
}

export function readPublicOutputReceipt({ packageRoot, receiptPath = publicOutputReceiptPath(packageRoot) }) {
  if (!existsSync(receiptPath)) {
    throw new PublicOutputReceiptError(
      `no public producer receipt at ${receiptPath}; run the complete public build before packing`,
      'public-output-receipt-missing',
    );
  }
  let receipt;
  try {
    receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
  } catch (error) {
    throw new PublicOutputReceiptError(
      `public producer receipt is unreadable: ${receiptPath} (${error.message})`,
      'public-output-receipt-corrupt',
    );
  }
  if (receipt?.schema !== PUBLIC_OUTPUT_RECEIPT_SCHEMA) {
    throw new PublicOutputReceiptError(
      `public producer receipt schema mismatch: expected ${PUBLIC_OUTPUT_RECEIPT_SCHEMA}, got ${receipt?.schema}`,
      'public-output-receipt-schema',
    );
  }
  const { digest, ...unsigned } = receipt;
  if (digest !== sha256Canonical(unsigned)) {
    throw new PublicOutputReceiptError(
      `public producer receipt failed its self-digest check: ${receiptPath}`,
      'public-output-receipt-digest',
    );
  }
  return receipt;
}

export function verifyPublicOutputReceipt({
  packageRoot,
  v2Root = path.resolve(packageRoot, '../../../v2'),
  requiredSurfaces,
  env = process.env,
  surfaceRoot = packageRoot,
  surfaceRoots = null,
  receiptPath = publicOutputReceiptPath(packageRoot),
  verifyEngineInput = true,
}) {
  const selectedSurfaces = normalizeSurfaces(requiredSurfaces, 'requiredSurfaces');
  const receipt = readPublicOutputReceipt({ packageRoot, receiptPath });
  const currentPackage = readPackageIdentity(packageRoot);
  if (canonicalJson(receipt.package) !== canonicalJson(currentPackage)) {
    throw new PublicOutputReceiptError(
      'the public producer receipt does not match the current SuperDoc package manifest',
      'public-output-package-binding',
    );
  }
  const currentSourceIdentity = observePublicSourceIdentity({ packageRoot });
  if (canonicalJson(receipt.sourceIdentity) !== canonicalJson(currentSourceIdentity)) {
    throw new PublicOutputReceiptError(
      'the public producer receipt does not match the current public source inputs',
      'public-output-source-binding',
    );
  }
  const expectedRecipe = publicBuildRecipe(Object.keys(receipt.surfaces ?? {}).filter((surface) => SURFACE_NAMES.includes(surface)));
  if (canonicalJson(receipt.recipe) !== canonicalJson(expectedRecipe)) {
    throw new PublicOutputReceiptError(
      'the public producer receipt uses a different build recipe',
      'public-output-recipe-binding',
    );
  }
  const roots = resolveSurfaceRoots({ packageRoot, surfaceRoot, surfaceRoots, env });
  for (const surface of selectedSurfaces) {
    const sealed = receipt.surfaces?.[surface];
    if (!sealed || sealed.directory !== SURFACE_DIRECTORIES[surface] || !/^[a-f0-9]{64}$/u.test(sealed.digest ?? '')) {
      throw new PublicOutputReceiptError(
        `public producer receipt does not seal required surface ${surface}`,
        'public-output-receipt-surface',
      );
    }
    const tree = hashPublicTree(roots[surface]);
    if (
      tree.digest !== sealed.digest ||
      tree.fileCount !== sealed.fileCount ||
      tree.sizeBytes !== sealed.sizeBytes
    ) {
      throw new PublicOutputReceiptError(
        `public ${surface} output does not match its producer receipt; the tree changed after it was sealed`,
        'public-output-seal-mismatch',
      );
    }
  }
  if (verifyEngineInput) {
    observePublicEngineInput({ packageRoot, v2Root, env, expectedIdentity: receipt.engineInput });
  } else {
    normalizeEngineInput(receipt.engineInput);
  }
  return receipt;
}
