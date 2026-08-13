import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vite-plus/test';

import {
  hashEngineTree,
  observeEngineInputIdentity,
  writeEngineProducerReceipt,
} from '../../../scripts/engine-prepared-input.mjs';
import { createSuperDocArtifactStore } from '../../../scripts/superdoc-artifact-store.mjs';
import {
  hashPublicTree,
  observePublicSourceIdentity,
  publicOutputReceiptPath,
  readPublicOutputSelection,
  verifyPublicOutputReceipt,
  writePublicOutputReceipt,
} from './public-output-receipt.mjs';

const PACKAGE_ENV = { ...process.env, SUPERDOC_V2_RUNTIME_MODE: 'package' };

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

function createFixture() {
  const repoRoot = mkdtempSync(path.join(os.tmpdir(), 'public-receipt-test-'));
  const packageRoot = path.join(repoRoot, 'superdoc', 'public', 'packages', 'superdoc');
  const v2Root = path.join(repoRoot, 'superdoc', 'v2');
  mkdirSync(packageRoot, { recursive: true });
  mkdirSync(path.join(v2Root, 'src', 'superdoc'), { recursive: true });
  writeFileSync(path.join(v2Root, 'src', 'superdoc', 'index.ts'), 'export const engine = true;\n');
  writeJson(path.join(v2Root, 'package.json'), { name: '@superdoc/docx-engine', version: '0.1.0' });
  writeFileSync(path.join(v2Root, '.gitignore'), 'dist/\ndist-cdn/\nbuild-receipts/\n.build-artifacts/\n');
  writeJson(path.join(packageRoot, 'package.json'), {
    name: 'superdoc',
    version: '2.0.0',
    dependencies: { '@superdoc/docx-engine': 'workspace:0.1.0' },
  });
  writeFileSync(path.join(packageRoot, 'source.js'), 'export const publicSource = true;\n');
  writeFileSync(
    path.join(repoRoot, 'superdoc', 'public', '.gitignore'),
    'dist/\ndist-cdn/\nbuild-receipts/\n.build-artifacts/\n',
  );
  git(repoRoot, ['init', '-q']);
  git(repoRoot, ['config', 'user.email', 'test@example.com']);
  git(repoRoot, ['config', 'user.name', 'Receipt Test']);
  git(repoRoot, ['add', '.']);
  git(repoRoot, ['commit', '-qm', 'fixture']);

  const engineDist = path.join(v2Root, 'dist');
  mkdirSync(engineDist);
  const engineSource = 'export const version = "0.1.0";\n';
  writeFileSync(path.join(engineDist, 'docx-engine.es.js'), engineSource);
  writeJson(path.join(engineDist, 'manifest.json'), {
    schemaVersion: 1,
    packageName: '@superdoc/docx-engine',
    protection: { obfuscatedSetSha256: 'protected' },
    files: [{ path: 'docx-engine.es.js', sha256: sha256(engineSource) }],
  });
  const engineTree = hashEngineTree(engineDist);
  writeEngineProducerReceipt({
    v2Root,
    receipt: {
      engineVersion: '0.1.0',
      inputIdentity: observeEngineInputIdentity({ v2Root, repoRoot }),
      protectionCache: { authoritativeForPublication: true },
      surfaces: {
        dist: { digest: engineTree.digest, fileCount: engineTree.files.length, sizeBytes: engineTree.sizeBytes },
      },
    },
  });

  mkdirSync(path.join(packageRoot, 'dist'));
  mkdirSync(path.join(packageRoot, 'dist-cdn'));
  writeFileSync(path.join(packageRoot, 'dist', 'superdoc.es.js'), 'export const npm = true;\n');
  writeFileSync(path.join(packageRoot, 'dist-cdn', 'superdoc.min.js'), 'globalThis.SuperDoc = {};\n');
  const written = writePublicOutputReceipt({
    packageRoot,
    v2Root,
    surfaces: ['npm', 'cdn'],
    env: PACKAGE_ENV,
  });
  return { repoRoot, packageRoot, v2Root, written };
}

describe('public output producer receipt', () => {
  it('observes source identity in a standalone public checkout', () => {
    const repoRoot = mkdtempSync(path.join(os.tmpdir(), 'public-standalone-receipt-test-'));
    try {
      const packageRoot = path.join(repoRoot, 'packages', 'superdoc');
      mkdirSync(packageRoot, { recursive: true });
      writeJson(path.join(repoRoot, 'package.json'), { private: true });
      writeJson(path.join(packageRoot, 'package.json'), { name: 'superdoc', version: '2.0.0' });
      writeFileSync(path.join(packageRoot, 'source.js'), 'export const publicSource = true;\n');
      git(repoRoot, ['init', '-q']);
      git(repoRoot, ['config', 'user.email', 'test@example.com']);
      git(repoRoot, ['config', 'user.name', 'Receipt Test']);
      git(repoRoot, ['add', '.']);
      git(repoRoot, ['commit', '-qm', 'fixture']);

      const clean = observePublicSourceIdentity({ packageRoot });
      expect(clean.headSha).toMatch(/^[a-f0-9]{40}$/u);
      writeFileSync(path.join(packageRoot, 'source.js'), 'export const publicSource = false;\n');
      expect(observePublicSourceIdentity({ packageRoot }).digest).not.toBe(clean.digest);
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('uses a stable content identity in a standalone source copy without Git', () => {
    const repoRoot = mkdtempSync(path.join(os.tmpdir(), 'public-no-git-receipt-test-'));
    try {
      const packageRoot = path.join(repoRoot, 'packages', 'superdoc');
      mkdirSync(packageRoot, { recursive: true });
      writeJson(path.join(repoRoot, 'package.json'), { private: true });
      writeJson(path.join(packageRoot, 'package.json'), { name: 'superdoc', version: '2.0.0' });
      const sourcePath = path.join(packageRoot, 'source.js');
      writeFileSync(sourcePath, 'export const publicSource = true;\n');

      const clean = observePublicSourceIdentity({ packageRoot });
      expect(clean.mode).toBe('content');
      mkdirSync(path.join(packageRoot, 'dist'));
      writeFileSync(path.join(packageRoot, 'dist', 'generated.js'), 'generated\n');
      mkdirSync(path.join(packageRoot, 'build-receipts'));
      writeFileSync(path.join(packageRoot, 'build-receipts', 'receipt.json'), '{}\n');
      expect(observePublicSourceIdentity({ packageRoot }).digest).toBe(clean.digest);

      writeFileSync(sourcePath, 'export const publicSource = false;\n');
      expect(observePublicSourceIdentity({ packageRoot }).digest).not.toBe(clean.digest);
      writeFileSync(sourcePath, 'export const publicSource = true;\n');
      symlinkSync('source.js', path.join(packageRoot, 'linked-source.js'));
      const linked = observePublicSourceIdentity({ packageRoot });
      expect(linked.digest).not.toBe(clean.digest);
      expect(observePublicSourceIdentity({ packageRoot }).digest).toBe(linked.digest);
      symlinkSync(os.tmpdir(), path.join(packageRoot, 'outside'));
      expect(() => observePublicSourceIdentity({ packageRoot })).toThrow(/symlink escapes/u);
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('verifies both exact output trees and the prepared engine identity', () => {
    const fixture = createFixture();
    try {
      const receipt = verifyPublicOutputReceipt({
        packageRoot: fixture.packageRoot,
        v2Root: fixture.v2Root,
        requiredSurfaces: ['npm', 'cdn'],
        env: PACKAGE_ENV,
      });
      expect(receipt.digest).toBe(fixture.written.receipt.digest);

      writeFileSync(path.join(fixture.packageRoot, 'dist', 'superdoc.es.js'), 'tampered\n');
      expect(() =>
        verifyPublicOutputReceipt({
          packageRoot: fixture.packageRoot,
          v2Root: fixture.v2Root,
          requiredSurfaces: ['npm', 'cdn'],
          env: PACKAGE_ENV,
        }),
      ).toThrow(/tree changed after it was sealed/u);
    } finally {
      rmSync(fixture.repoRoot, { recursive: true, force: true });
    }
  });

  it('rejects stale public source and engine source independently of output bytes', () => {
    const fixture = createFixture();
    try {
      writeFileSync(path.join(fixture.packageRoot, 'source.js'), 'export const publicSource = false;\n');
      expect(() =>
        verifyPublicOutputReceipt({
          packageRoot: fixture.packageRoot,
          v2Root: fixture.v2Root,
          requiredSurfaces: ['npm', 'cdn'],
          env: PACKAGE_ENV,
        }),
      ).toThrow(/current public source inputs/u);

      writeFileSync(path.join(fixture.packageRoot, 'source.js'), 'export const publicSource = true;\n');
      writeFileSync(path.join(fixture.v2Root, 'src', 'superdoc', 'index.ts'), 'export const engine = false;\n');
      expect(() =>
        verifyPublicOutputReceipt({
          packageRoot: fixture.packageRoot,
          v2Root: fixture.v2Root,
          requiredSurfaces: ['npm', 'cdn'],
          env: PACKAGE_ENV,
        }),
      ).toThrow(/engine input identity/u);
    } finally {
      rmSync(fixture.repoRoot, { recursive: true, force: true });
    }
  });

  it('refuses to seal output if public source changed during the build', () => {
    const fixture = createFixture();
    try {
      const initialIdentity = observePublicSourceIdentity({ packageRoot: fixture.packageRoot });
      writeFileSync(path.join(fixture.packageRoot, 'source.js'), 'export const publicSource = false;\n');
      expect(() =>
        writePublicOutputReceipt({
          packageRoot: fixture.packageRoot,
          v2Root: fixture.v2Root,
          surfaces: ['npm', 'cdn'],
          env: PACKAGE_ENV,
          sourceIdentity: initialIdentity,
        }),
      ).toThrow(/changed while the public outputs were being built/u);
    } finally {
      rmSync(fixture.repoRoot, { recursive: true, force: true });
    }
  });

  it('is portable across staging roots and rejects a modified self-digest', () => {
    const fixture = createFixture();
    try {
      const stagingRoot = path.join(fixture.repoRoot, 'staging');
      const restoredRoot = path.join(fixture.repoRoot, 'restored');
      mkdirSync(stagingRoot);
      cpSync(path.join(fixture.packageRoot, 'dist'), path.join(stagingRoot, 'npm'), { recursive: true });
      cpSync(path.join(fixture.packageRoot, 'dist-cdn'), path.join(stagingRoot, 'cdn'), { recursive: true });
      const portableReceipt = path.join(fixture.repoRoot, 'portable-receipt.json');
      const written = writePublicOutputReceipt({
        packageRoot: fixture.packageRoot,
        v2Root: fixture.v2Root,
        surfaces: ['npm', 'cdn'],
        surfaceRoots: { npm: path.join(stagingRoot, 'npm'), cdn: path.join(stagingRoot, 'cdn') },
        receiptPath: portableReceipt,
        env: PACKAGE_ENV,
      });
      mkdirSync(restoredRoot);
      cpSync(path.join(stagingRoot, 'npm'), path.join(restoredRoot, 'one'), { recursive: true });
      cpSync(path.join(stagingRoot, 'cdn'), path.join(restoredRoot, 'two'), { recursive: true });
      expect(
        verifyPublicOutputReceipt({
          packageRoot: fixture.packageRoot,
          v2Root: fixture.v2Root,
          requiredSurfaces: ['npm', 'cdn'],
          surfaceRoots: { npm: path.join(restoredRoot, 'one'), cdn: path.join(restoredRoot, 'two') },
          receiptPath: portableReceipt,
          env: PACKAGE_ENV,
        }).digest,
      ).toBe(written.receipt.digest);

      const corrupt = JSON.parse(readFileSync(portableReceipt, 'utf8'));
      corrupt.target = 'npm';
      writeJson(portableReceipt, corrupt);
      expect(() =>
        verifyPublicOutputReceipt({
          packageRoot: fixture.packageRoot,
          v2Root: fixture.v2Root,
          requiredSurfaces: ['npm', 'cdn'],
          surfaceRoots: { npm: path.join(restoredRoot, 'one'), cdn: path.join(restoredRoot, 'two') },
          receiptPath: portableReceipt,
          env: PACKAGE_ENV,
        }),
      ).toThrow(/self-digest/u);
    } finally {
      rmSync(fixture.repoRoot, { recursive: true, force: true });
    }
  });

  it('selects promoted immutable objects and rejects pointer tampering', async () => {
    const fixture = createFixture();
    try {
      const store = createSuperDocArtifactStore({
        root: path.join(fixture.packageRoot, '.build-artifacts', 'public'),
      });
      const npmObject = await store.installObject({ sourceRoot: path.join(fixture.packageRoot, 'dist') });
      const cdnObject = await store.installObject({ sourceRoot: path.join(fixture.packageRoot, 'dist-cdn') });
      const receiptObject = await store.installObject({
        sourceRoot: path.dirname(publicOutputReceiptPath(fixture.packageRoot)),
      });
      await store.promote({
        components: [
          { id: 'npm', objectDigest: npmObject.digest },
          { id: 'cdn', objectDigest: cdnObject.digest },
          { id: 'receipt', objectDigest: receiptObject.digest },
        ],
      });

      const selected = readPublicOutputSelection({ packageRoot: fixture.packageRoot });
      expect(selected.pointer).not.toBeNull();
      expect(selected.surfaceRoots.npm).toContain(`${path.sep}objects${path.sep}`);
      expect(hashPublicTree(selected.surfaceRoots.npm).digest).toBe(fixture.written.receipt.surfaces.npm.digest);

      writeFileSync(path.join(fixture.packageRoot, 'dist', 'superdoc.es.js'), 'canonical view changed\n');
      expect(
        verifyPublicOutputReceipt({
          packageRoot: fixture.packageRoot,
          v2Root: fixture.v2Root,
          requiredSurfaces: ['npm', 'cdn'],
          surfaceRoots: selected.surfaceRoots,
          receiptPath: selected.receiptPath,
          env: PACKAGE_ENV,
        }).digest,
      ).toBe(fixture.written.receipt.digest);

      const strayReceiptFile = path.join(path.dirname(selected.receiptPath), 'stray.json');
      writeFileSync(strayReceiptFile, '{}\n');
      expect(() => readPublicOutputSelection({ packageRoot: fixture.packageRoot })).toThrow(/object tree digest/u);
      rmSync(strayReceiptFile);

      const pointerPath = path.join(store.paths.pointers, 'current.json');
      const pointer = JSON.parse(readFileSync(pointerPath, 'utf8'));
      pointer.generation += 1;
      writeJson(pointerPath, pointer);
      expect(() => readPublicOutputSelection({ packageRoot: fixture.packageRoot })).toThrow(/self-digest/u);
    } finally {
      rmSync(fixture.repoRoot, { recursive: true, force: true });
    }
  });
});
