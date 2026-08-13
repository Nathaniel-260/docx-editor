import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { gunzipSync, gzipSync } from 'node:zlib';

import {
  hashEngineTree,
  observeEngineInputIdentity,
  verifyPreparedEngine,
  writeEngineProducerReceipt,
} from '../engine-prepared-input.mjs';
import {
  materializeCiSuperdocBuildArtifact,
  packCiSuperdocBuildArtifact,
  runWithCiSuperdocMaterialization,
  verifyCiSuperdocMaterialization,
} from '../ci-superdoc-build-artifact.mjs';
import { writeEngineConsumerArtifactReceipt } from '../ci-docx-engine-artifact.mjs';
import { artifactCanonicalSha256, createSuperDocArtifactStore } from '../superdoc-artifact-store.mjs';
import { writePublicOutputReceipt } from '../../packages/superdoc/scripts/public-output-receipt.mjs';

const packageEnvironment = { ...process.env, SUPERDOC_ENGINE_INPUT: 'prepared', SUPERDOC_V2_RUNTIME_MODE: 'package' };
const fixtureRuntimeOutputSources = Object.freeze({
  'leaf-document-compare': {
    destination: 'document-compare/dist',
    source: 'export const runtime = "document-compare";\n',
  },
  'leaf-editor-core': {
    destination: 'editor-core/dist',
    source: 'export const runtime = "editor-core";\n',
  },
  'leaf-collaboration-v2': {
    destination: 'collaboration-v2/dist',
    source: 'export const runtime = "collaboration-v2";\n',
  },
  'leaf-document-api-v2-adapter': {
    destination: 'document-api-v2-adapter/dist',
    source: 'export const runtime = "document-api-v2-adapter";\n',
  },
  'leaf-headless': {
    destination: 'headless/dist',
    source: 'export const runtime = "headless";\n',
  },
  'leaf-collaboration-upgrade': {
    destination: 'collaboration-upgrade/dist',
    source: 'export const runtime = "collaboration-upgrade";\n',
  },
});

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function git(repoRoot, args) {
  return execFileSync('git', ['-C', repoRoot, ...args], { encoding: 'utf8' }).trim();
}

function writeEngineSurface(root, source) {
  mkdirSync(root, { recursive: true });
  writeFileSync(path.join(root, 'docx-engine.es.js'), source);
  writeJson(path.join(root, 'manifest.json'), {
    schemaVersion: 1,
    packageName: '@superdoc/docx-engine',
    protection: { obfuscatedSetSha256: 'protected' },
    files: [{ path: 'docx-engine.es.js', sha256: sha256(source) }],
  });
}

function createFixture() {
  const repoRoot = mkdtempSync(path.join(tmpdir(), 'ci-superdoc-artifact-'));
  const workspaceRoot = path.join(repoRoot, 'superdoc', 'public');
  const packageRoot = path.join(workspaceRoot, 'packages', 'superdoc');
  const documentApiRoot = path.join(workspaceRoot, 'packages', 'document-api', 'dist');
  const engineArtifactRoot = path.join(workspaceRoot, '.ci-docx-engine');
  const v2Root = path.join(repoRoot, 'superdoc', 'v2');
  const archivePath = path.join(workspaceRoot, 'superdoc-build-artifact.json.gz');

  mkdirSync(path.join(v2Root, 'src'), { recursive: true });
  mkdirSync(packageRoot, { recursive: true });
  writeJson(path.join(v2Root, 'package.json'), { name: '@superdoc/docx-engine', version: '1.2.3' });
  writeFileSync(path.join(v2Root, 'src', 'index.ts'), 'export const engineSource = true;\n');
  writeJson(path.join(packageRoot, 'package.json'), {
    name: 'superdoc',
    version: '2.0.0',
    dependencies: { '@superdoc/docx-engine': 'workspace:1.2.3' },
  });
  writeFileSync(path.join(packageRoot, 'source.js'), 'export const publicSource = true;\n');
  writeFileSync(
    path.join(workspaceRoot, '.gitignore'),
    [
      'packages/**/dist/',
      'packages/**/dist-cdn/',
      'packages/**/build-receipts/',
      '.ci-docx-engine/',
      '.ci-superdoc-artifact/',
      '.tmp/',
      '*.json.gz',
    ].join('\n'),
  );
  writeFileSync(path.join(v2Root, '.gitignore'), 'dist/\ndist-cdn/\nbuild-receipts/\n.build-artifacts/\n');
  git(repoRoot, ['init', '-q']);
  git(repoRoot, ['config', 'user.email', 'test@example.com']);
  git(repoRoot, ['config', 'user.name', 'CI Artifact Test']);
  git(repoRoot, ['add', '.']);
  git(repoRoot, ['commit', '-qm', 'fixture']);

  writeEngineSurface(path.join(v2Root, 'dist'), 'export const engine = "npm";\n');
  writeEngineSurface(path.join(v2Root, 'dist-cdn'), 'export const engine = "cdn";\n');
  const inputIdentity = observeEngineInputIdentity({ v2Root, repoRoot });
  const runtimeRoots = {};
  const runtimeOutputs = {};
  for (const [id, { destination, source }] of Object.entries(fixtureRuntimeOutputSources)) {
    const root = path.join(v2Root, ...destination.split('/'));
    mkdirSync(root, { recursive: true });
    writeFileSync(path.join(root, 'index.js'), source);
    const tree = hashEngineTree(root);
    runtimeRoots[id] = root;
    runtimeOutputs[id] = {
      digest: tree.digest,
      fileCount: tree.files.length,
      sizeBytes: tree.sizeBytes,
      destination,
    };
  }
  const engineSurfaces = Object.fromEntries(
    ['dist', 'dist-cdn'].map((surface) => {
      const tree = hashEngineTree(path.join(v2Root, surface));
      return [surface, { digest: tree.digest, fileCount: tree.files.length, sizeBytes: tree.sizeBytes }];
    }),
  );
  const engineReceipt = writeEngineProducerReceipt({
    v2Root,
    receipt: {
      engineVersion: '1.2.3',
      inputIdentity,
      protectionCache: { authoritativeForPublication: true },
      surfaces: engineSurfaces,
      runtimeOutputs,
    },
  }).receipt;

  mkdirSync(path.join(packageRoot, 'dist'));
  mkdirSync(path.join(packageRoot, 'dist-cdn'));
  writeFileSync(path.join(packageRoot, 'dist', 'superdoc.es.js'), 'export const publicNpm = true;\n');
  writeFileSync(path.join(packageRoot, 'dist-cdn', 'superdoc.js'), 'globalThis.SuperDoc = {};\n');
  const publicReceipt = writePublicOutputReceipt({
    packageRoot,
    v2Root,
    surfaces: ['npm', 'cdn'],
    env: packageEnvironment,
  }).receipt;

  for (const relative of ['index.js', 'index.d.ts', 'types/index.js', 'types/index.d.ts']) {
    mkdirSync(path.dirname(path.join(documentApiRoot, relative)), { recursive: true });
    writeFileSync(path.join(documentApiRoot, relative), `// ${relative}\n`);
  }
  mkdirSync(engineArtifactRoot);
  const engineArchive = path.join(engineArtifactRoot, 'superdoc-docx-engine-1.2.3.tgz');
  writeFileSync(engineArchive, 'audited engine consumer tarball\n');
  const verifiedEngine = verifyPreparedEngine({
    v2Root,
    expectedVersion: '1.2.3',
    surfaces: ['dist', 'dist-cdn'],
    currentInputIdentity: inputIdentity,
  });
  writeEngineConsumerArtifactReceipt({ root: engineArtifactRoot, engineArchive, verifiedEngine });

  return {
    archivePath,
    documentApiRoot,
    engineArtifactRoot,
    engineReceipt,
    packageRoot,
    publicReceipt,
    repoRoot,
    runtimeRoots,
    v2Root,
    workspaceRoot,
  };
}

function packFixture(fixture, options = {}) {
  return packCiSuperdocBuildArtifact({
    workspaceRoot: fixture.workspaceRoot,
    packageRoot: fixture.packageRoot,
    v2Root: fixture.v2Root,
    documentApiRoot: fixture.documentApiRoot,
    engineArtifactRoot: fixture.engineArtifactRoot,
    archivePath: fixture.archivePath,
    env: packageEnvironment,
    ...options,
  });
}

function replaceWithPreviousTrees(fixture) {
  for (const destination of [
    path.join(fixture.packageRoot, 'dist'),
    path.join(fixture.packageRoot, 'dist-cdn'),
    path.join(fixture.packageRoot, 'build-receipts'),
    fixture.documentApiRoot,
    fixture.engineArtifactRoot,
    ...Object.values(fixture.runtimeRoots),
    path.join(fixture.workspaceRoot, '.ci-superdoc-artifact'),
  ]) {
    rmSync(destination, { recursive: true, force: true });
    mkdirSync(destination, { recursive: true });
    writeFileSync(path.join(destination, 'previous.txt'), `previous ${path.basename(destination)}\n`);
  }
}

test('packs and transactionally materializes the complete receipt-bound build set', () => {
  const fixture = createFixture();
  try {
    const packed = packFixture(fixture);
    replaceWithPreviousTrees(fixture);
    const restored = materializeCiSuperdocBuildArtifact({
      workspaceRoot: fixture.workspaceRoot,
      v2Root: fixture.v2Root,
      archivePath: fixture.archivePath,
    });

    assert.equal(restored.manifest.digest, packed.manifest.digest);
    assert.deepEqual(
      packed.manifest.components.map(({ id }) => id),
      [
        'public-npm',
        'public-cdn',
        'public-receipt',
        'document-api',
        'engine-consumer',
        ...Object.keys(fixtureRuntimeOutputSources).sort(),
      ],
    );
    assert.equal(readFileSync(path.join(fixture.packageRoot, 'dist', 'superdoc.es.js'), 'utf8'), 'export const publicNpm = true;\n');
    for (const [id, { source }] of Object.entries(fixtureRuntimeOutputSources)) {
      assert.equal(readFileSync(path.join(fixture.runtimeRoots[id], 'index.js'), 'utf8'), source);
    }
    assert.equal(
      verifyCiSuperdocMaterialization({
        workspaceRoot: fixture.workspaceRoot,
        v2Root: fixture.v2Root,
        expectedDigest: packed.manifest.digest,
      }).artifactDigest,
      packed.manifest.digest,
    );
    assert.throws(
      () =>
        verifyCiSuperdocMaterialization({
          workspaceRoot: fixture.workspaceRoot,
          v2Root: fixture.v2Root,
          expectedDigest: 'f'.repeat(64),
        }),
      /does not match the required digest/u,
    );
    let childEnvironment;
    assert.equal(
      runWithCiSuperdocMaterialization({
        workspaceRoot: fixture.workspaceRoot,
        v2Root: fixture.v2Root,
        command: ['pnpm', 'run', 'test:cli'],
        run(_executable, _args, options) {
          childEnvironment = options.env;
          return { status: 0 };
        },
      }),
      0,
    );
    assert.equal(childEnvironment.SUPERDOC_CLI_REQUIRE_PREBUILT_INPUTS, 'restored');
    assert.equal(childEnvironment.SUPERDOC_CLI_RESTORED_ARTIFACT_DIGEST, packed.manifest.digest);
  } finally {
    rmSync(fixture.repoRoot, { recursive: true, force: true });
  }
});

test('rejects a modified archive before touching any destination', () => {
  const fixture = createFixture();
  try {
    packFixture(fixture);
    const archive = JSON.parse(gunzipSync(readFileSync(fixture.archivePath)).toString('utf8'));
    archive.entries[0].content = Buffer.from('tampered\n').toString('base64');
    writeFileSync(fixture.archivePath, gzipSync(Buffer.from(JSON.stringify(archive))));
    replaceWithPreviousTrees(fixture);

    assert.throws(
      () =>
        materializeCiSuperdocBuildArtifact({
          workspaceRoot: fixture.workspaceRoot,
          v2Root: fixture.v2Root,
          archivePath: fixture.archivePath,
        }),
      /content hash/u,
    );
    assert.equal(readFileSync(path.join(fixture.packageRoot, 'dist', 'previous.txt'), 'utf8'), 'previous dist\n');
    assert.equal(readFileSync(path.join(fixture.engineArtifactRoot, 'previous.txt'), 'utf8'), 'previous .ci-docx-engine\n');
  } finally {
    rmSync(fixture.repoRoot, { recursive: true, force: true });
  }
});

test('rejects an archive that omits a producer-sealed runtime leaf before touching any destination', () => {
  const fixture = createFixture();
  try {
    packFixture(fixture);
    const archive = JSON.parse(gunzipSync(readFileSync(fixture.archivePath)).toString('utf8'));
    const omitted = archive.manifest.components.find(({ id }) => id === 'leaf-editor-core');
    archive.manifest.components = archive.manifest.components.filter(({ id }) => id !== omitted.id);
    archive.manifest.recipe.components = archive.manifest.recipe.components.filter((id) => id !== omitted.id);
    archive.entries = archive.entries.filter(({ path: entryPath }) => !entryPath.startsWith(`${omitted.payloadPath}/`));
    const { digest: _ignored, ...unsignedManifest } = archive.manifest;
    archive.manifest.digest = artifactCanonicalSha256(unsignedManifest);
    writeFileSync(fixture.archivePath, gzipSync(Buffer.from(JSON.stringify(archive))));
    replaceWithPreviousTrees(fixture);

    assert.throws(
      () =>
        materializeCiSuperdocBuildArtifact({
          workspaceRoot: fixture.workspaceRoot,
          v2Root: fixture.v2Root,
          archivePath: fixture.archivePath,
        }),
      /unsupported recipe|incomplete component set/u,
    );
    assert.equal(
      readFileSync(path.join(fixture.runtimeRoots['leaf-editor-core'], 'previous.txt'), 'utf8'),
      'previous dist\n',
    );
  } finally {
    rmSync(fixture.repoRoot, { recursive: true, force: true });
  }
});

test('rejects archive path traversal before touching any destination', () => {
  const fixture = createFixture();
  try {
    packFixture(fixture);
    const archive = JSON.parse(gunzipSync(readFileSync(fixture.archivePath)).toString('utf8'));
    archive.entries[0].path = '../escape';
    writeFileSync(fixture.archivePath, gzipSync(Buffer.from(JSON.stringify(archive))));
    replaceWithPreviousTrees(fixture);

    assert.throws(
      () =>
        materializeCiSuperdocBuildArtifact({
          workspaceRoot: fixture.workspaceRoot,
          v2Root: fixture.v2Root,
          archivePath: fixture.archivePath,
        }),
      /portable relative path/u,
    );
    assert.equal(readFileSync(path.join(fixture.packageRoot, 'dist', 'previous.txt'), 'utf8'), 'previous dist\n');
  } finally {
    rmSync(fixture.repoRoot, { recursive: true, force: true });
  }
});

test('rejects an artifact from stale public source before promotion', () => {
  const fixture = createFixture();
  try {
    packFixture(fixture);
    writeFileSync(path.join(fixture.packageRoot, 'source.js'), 'export const publicSource = false;\n');
    replaceWithPreviousTrees(fixture);

    assert.throws(
      () =>
        materializeCiSuperdocBuildArtifact({
          workspaceRoot: fixture.workspaceRoot,
          v2Root: fixture.v2Root,
          archivePath: fixture.archivePath,
        }),
      /current public source inputs/u,
    );
    assert.equal(readFileSync(path.join(fixture.packageRoot, 'dist', 'previous.txt'), 'utf8'), 'previous dist\n');
  } finally {
    rmSync(fixture.repoRoot, { recursive: true, force: true });
  }
});

test('rolls every component back when promotion fails during or after the complete switch', () => {
  const fixture = createFixture();
  try {
    packFixture(fixture);
    replaceWithPreviousTrees(fixture);
    for (const failurePoint of ['after-promote:leaf-editor-core', 'after-post-verify']) {
      assert.throws(
        () =>
          materializeCiSuperdocBuildArtifact({
            workspaceRoot: fixture.workspaceRoot,
            v2Root: fixture.v2Root,
            archivePath: fixture.archivePath,
            checkpoint(name) {
              if (name === failurePoint) throw new Error(`injected materialization failure at ${failurePoint}`);
            },
          }),
        /injected materialization failure/u,
      );
      for (const destination of [
        path.join(fixture.packageRoot, 'dist'),
        path.join(fixture.packageRoot, 'dist-cdn'),
        path.join(fixture.packageRoot, 'build-receipts'),
        fixture.documentApiRoot,
        fixture.engineArtifactRoot,
        ...Object.values(fixture.runtimeRoots),
        path.join(fixture.workspaceRoot, '.ci-superdoc-artifact'),
      ]) {
        assert.match(readFileSync(path.join(destination, 'previous.txt'), 'utf8'), /^previous /u);
      }
    }
  } finally {
    rmSync(fixture.repoRoot, { recursive: true, force: true });
  }
});

test('rejects a transitive runtime leaf changed after materialization', () => {
  const fixture = createFixture();
  try {
    const packed = packFixture(fixture);
    materializeCiSuperdocBuildArtifact({
      workspaceRoot: fixture.workspaceRoot,
      v2Root: fixture.v2Root,
      archivePath: fixture.archivePath,
    });
    writeFileSync(path.join(fixture.runtimeRoots['leaf-editor-core'], 'index.js'), 'tampered runtime\n');
    assert.throws(
      () =>
        verifyCiSuperdocMaterialization({
          workspaceRoot: fixture.workspaceRoot,
          v2Root: fixture.v2Root,
          expectedDigest: packed.manifest.digest,
        }),
      /leaf-editor-core/u,
    );
  } finally {
    rmSync(fixture.repoRoot, { recursive: true, force: true });
  }
});

test('packs runtime leaves from the immutable producer pointer instead of mutable compatibility views', async () => {
  const fixture = createFixture();
  try {
    const store = createSuperDocArtifactStore({ root: path.join(fixture.v2Root, '.build-artifacts', 'engine') });
    const componentSources = [
      ['dist', path.join(fixture.v2Root, 'dist')],
      ['dist-cdn', path.join(fixture.v2Root, 'dist-cdn')],
      ...Object.entries(fixture.runtimeRoots),
      ['receipt', path.join(fixture.v2Root, 'build-receipts')],
    ];
    const components = [];
    const compatibilityViews = [];
    for (const [id, sourceRoot] of componentSources) {
      const object = await store.installObject({ sourceRoot });
      components.push({ id, objectDigest: object.digest });
      compatibilityViews.push({ id, componentId: id, destination: sourceRoot });
    }
    await store.promote({ components, compatibilityViews });

    writeFileSync(path.join(fixture.runtimeRoots['leaf-editor-core'], 'index.js'), 'mutated compatibility view\n');
    const packed = packFixture(fixture);
    replaceWithPreviousTrees(fixture);
    materializeCiSuperdocBuildArtifact({
      workspaceRoot: fixture.workspaceRoot,
      v2Root: fixture.v2Root,
      archivePath: fixture.archivePath,
    });

    assert.match(packed.manifest.digest, /^[0-9a-f]{64}$/u);
    assert.equal(
      readFileSync(path.join(fixture.runtimeRoots['leaf-editor-core'], 'index.js'), 'utf8'),
      fixtureRuntimeOutputSources['leaf-editor-core'].source,
    );
  } finally {
    rmSync(fixture.repoRoot, { recursive: true, force: true });
  }
});

test('rejects symlinked component input and preserves an existing archive on pack failure', () => {
  const fixture = createFixture();
  try {
    writeFileSync(fixture.archivePath, 'previous archive\n');
    const target = path.join(fixture.repoRoot, 'outside.js');
    writeFileSync(target, 'outside\n');
    symlinkSync(target, path.join(fixture.documentApiRoot, 'linked.js'));
    assert.throws(() => packFixture(fixture), /contains a symlink/u);
    assert.equal(readFileSync(fixture.archivePath, 'utf8'), 'previous archive\n');
  } finally {
    rmSync(fixture.repoRoot, { recursive: true, force: true });
  }
});

test('rejects an engine consumer tarball bound to a different producer receipt', () => {
  const fixture = createFixture();
  try {
    const engineArchive = path.join(fixture.engineArtifactRoot, 'superdoc-docx-engine-1.2.3.tgz');
    rmSync(path.join(fixture.engineArtifactRoot, 'engine-consumer-receipt.json'));
    writeEngineConsumerArtifactReceipt({
      root: fixture.engineArtifactRoot,
      engineArchive,
      verifiedEngine: {
        engineVersion: '1.2.3',
        receipt: { digest: 'e'.repeat(64), inputIdentity: { digest: 'b'.repeat(64) } },
        surfaces: { dist: { digest: 'c'.repeat(64) }, 'dist-cdn': { digest: 'd'.repeat(64) } },
      },
    });
    assert.throws(() => packFixture(fixture), /does not match the public producer receipt/u);
  } finally {
    rmSync(fixture.repoRoot, { recursive: true, force: true });
  }
});
