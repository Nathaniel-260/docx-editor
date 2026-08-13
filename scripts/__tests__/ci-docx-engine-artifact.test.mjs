import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  createEnginePackArguments,
  linkEngineIntoConsumerRoots,
  materializeEngine,
  verifyEngineConsumerArtifact,
  writeEngineConsumerArtifactReceipt,
} from '../ci-docx-engine-artifact.mjs';

test('reuses both the existing engine and Document API builds', () => {
  const args = createEnginePackArguments();

  assert.equal(args.includes('--no-build'), true);
  assert.equal(args.includes('--no-document-api-build'), true);
});

function fakeVerifiedEngine() {
  return {
    engineVersion: '1.2.3',
    receipt: {
      digest: 'a'.repeat(64),
      inputIdentity: { digest: 'b'.repeat(64) },
    },
    surfaces: {
      dist: { digest: 'c'.repeat(64) },
      'dist-cdn': { digest: 'd'.repeat(64) },
    },
  };
}

test('binds the exact engine tarball to the engine producer receipt', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'superdoc-engine-artifact-'));
  try {
    const engineArchive = path.join(root, 'superdoc-docx-engine-1.2.3.tgz');
    writeFileSync(engineArchive, 'engine tarball\n');
    const written = writeEngineConsumerArtifactReceipt({
      root,
      engineArchive,
      verifiedEngine: fakeVerifiedEngine(),
    });

    assert.equal(
      verifyEngineConsumerArtifact({ root, expectedProducerReceiptDigest: 'a'.repeat(64) }).receipt.digest,
      written.receipt.digest,
    );
    writeFileSync(engineArchive, 'changed engine tarball\n');
    assert.throws(() => verifyEngineConsumerArtifact({ root }), /does not match its receipt/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('engine materialization verifies in staging and restores the previous package on promotion failure', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'superdoc-engine-materialize-'));
  try {
    const archiveRoot = path.join(root, 'artifact');
    const packageRoot = path.join(root, 'stage', 'package');
    const destination = path.join(root, 'installed', 'docx-engine');
    mkdirSync(path.join(packageRoot, 'build'), { recursive: true });
    mkdirSync(path.join(packageRoot, 'dist'), { recursive: true });
    mkdirSync(path.join(packageRoot, 'dist-cdn'), { recursive: true });
    mkdirSync(destination, { recursive: true });
    writeFileSync(path.join(destination, 'previous.txt'), 'previous package\n');
    writeFileSync(path.join(packageRoot, 'package.json'), JSON.stringify({ name: '@superdoc/docx-engine', version: '1.2.3' }));
    writeFileSync(path.join(packageRoot, 'DOCX-ENGINE-LICENSE.md'), 'license\n');
    writeFileSync(path.join(packageRoot, 'build', 'license-banner.txt'), 'banner\n');
    writeFileSync(path.join(packageRoot, 'dist', 'docx-engine.es.js'), 'export {};\n');
    writeFileSync(path.join(packageRoot, 'dist-cdn', 'docx-engine.es.js'), 'export {};\n');
    mkdirSync(archiveRoot);
    const engineArchive = path.join(archiveRoot, 'superdoc-docx-engine-1.2.3.tgz');
    execFileSync('tar', ['-czf', engineArchive, '-C', path.join(root, 'stage'), 'package']);
    writeEngineConsumerArtifactReceipt({ root: archiveRoot, engineArchive, verifiedEngine: fakeVerifiedEngine() });

    assert.throws(
      () =>
        materializeEngine({
          publicWorkspaceRoot: root,
          root: archiveRoot,
          destination,
          consumerRoots: [],
          checkpoint(name) {
            if (name === 'after-backup') throw new Error('injected promotion failure');
          },
        }),
      /injected promotion failure/u,
    );
    assert.equal(readFileSync(path.join(destination, 'previous.txt'), 'utf8'), 'previous package\n');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('links the engine where a Vite app resolves its absolute worker URL', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'superdoc-engine-consumer-'));
  try {
    const engineRoot = path.join(root, 'engine');
    const worker = path.join(engineRoot, 'dist/assets/browser-worker-entry-test.js');
    const appRoot = path.join(root, 'app');
    mkdirSync(path.dirname(worker), { recursive: true });
    mkdirSync(path.join(appRoot, 'node_modules'), { recursive: true });
    writeFileSync(worker, 'self.onmessage = () => {};\n');

    assert.deepEqual(linkEngineIntoConsumerRoots(engineRoot, [appRoot]), [appRoot]);

    const appWorker = path.join(appRoot, 'node_modules/@superdoc/docx-engine/dist/assets/browser-worker-entry-test.js');
    assert.equal(existsSync(appWorker), true);
    assert.equal(realpathSync(appWorker), realpathSync(worker));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
