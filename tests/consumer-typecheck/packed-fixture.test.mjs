import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { installPackedSuperdocFixture } from './packed-fixture.mjs';

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function pack(packageRoot, destination) {
  const filename = execFileSync(
    'npm',
    ['pack', '--silent', '--pack-destination', destination],
    { cwd: packageRoot, encoding: 'utf8' },
  ).trim();
  return join(destination, filename);
}

test('installs an unpublished transitive engine from the sealed local tarball', () => {
  const root = mkdtempSync(join(tmpdir(), 'superdoc-packed-fixture-'));
  try {
    const engineRoot = join(root, 'engine');
    const superdocRoot = join(root, 'superdoc');
    const fixtureRoot = join(root, 'fixture');
    const tarballRoot = join(root, 'tarballs');
    for (const directory of [engineRoot, superdocRoot, fixtureRoot, tarballRoot]) mkdirSync(directory);

    writeJson(join(engineRoot, 'package.json'), {
      name: '@superdoc/docx-engine',
      version: '999.0.0-ci-local',
    });
    writeJson(join(superdocRoot, 'package.json'), {
      name: 'superdoc',
      version: '999.0.0-ci-local',
      dependencies: {
        '@superdoc/docx-engine': '999.0.0-ci-local',
      },
    });
    const originalManifest = `${JSON.stringify({
      name: 'consumer',
      private: true,
      packageManager: 'pnpm@11.24.0',
    }, null, 2)}\n`;
    writeFileSync(join(fixtureRoot, 'package.json'), originalManifest);

    installPackedSuperdocFixture({
      fixtureRoot,
      superdocTarball: pack(superdocRoot, tarballRoot),
      engineTarball: pack(engineRoot, tarballRoot),
    });

    const installedEngine = JSON.parse(
      readFileSync(join(fixtureRoot, 'node_modules', '@superdoc', 'docx-engine', 'package.json'), 'utf8'),
    );
    assert.equal(installedEngine.version, '999.0.0-ci-local');
    assert.equal(readFileSync(join(fixtureRoot, 'package.json'), 'utf8'), originalManifest);
    assert.equal(existsSync(join(fixtureRoot, 'pnpm-workspace.yaml')), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
