import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { installPackedSuperdocFixture } from './packed-fixture.mjs';

const PUBLIC_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

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

async function waitForFile(path) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (existsSync(path)) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for ${path}`);
}

function startRejectingRegistry(root) {
  const readyPath = join(root, 'registry-port');
  const requestPath = join(root, 'registry-requests');
  const serverPath = join(root, 'registry-server.mjs');
  writeFileSync(
    serverPath,
    [
      "import { appendFileSync, writeFileSync } from 'node:fs';",
      "import { createServer } from 'node:http';",
      'const [readyPath, requestPath] = process.argv.slice(2);',
      'const server = createServer((request, response) => {',
      "  appendFileSync(requestPath, `${request.method} ${request.url}\\n`);",
      '  response.writeHead(404);',
      '  response.end();',
      '});',
      "server.listen(0, '127.0.0.1', () => writeFileSync(readyPath, String(server.address().port)));",
    ].join('\n'),
  );
  const child = spawn(process.execPath, [serverPath, readyPath, requestPath], { stdio: 'inherit' });
  return {
    child,
    closed: new Promise((resolve) => child.once('close', resolve)),
    port: () => readFileSync(readyPath, 'utf8'),
    ready: waitForFile(readyPath),
    requests: () => (existsSync(requestPath) ? readFileSync(requestPath, 'utf8') : ''),
  };
}

test('installs an unpublished transitive engine from the sealed local tarball', async () => {
  const root = mkdtempSync(join(tmpdir(), 'superdoc-packed-fixture-'));
  let registry;
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
    const { packageManager } = JSON.parse(readFileSync(join(PUBLIC_ROOT, 'package.json'), 'utf8'));
    const originalManifest = `${JSON.stringify({ name: 'consumer', private: true, packageManager }, null, 2)}\n`;
    writeFileSync(join(fixtureRoot, 'package.json'), originalManifest);
    registry = startRejectingRegistry(root);
    await registry.ready;
    writeFileSync(join(fixtureRoot, '.npmrc'), `registry=http://127.0.0.1:${registry.port()}/\n`);

    installPackedSuperdocFixture({
      fixtureRoot,
      superdocTarball: pack(superdocRoot, tarballRoot),
      engineTarball: pack(engineRoot, tarballRoot),
    });

    const installedEngine = JSON.parse(
      readFileSync(join(fixtureRoot, 'node_modules', '@superdoc', 'docx-engine', 'package.json'), 'utf8'),
    );
    assert.equal(installedEngine.version, '999.0.0-ci-local');
    assert.equal(registry.requests(), '', 'the packed fixture requested its engine from the registry');
    assert.equal(readFileSync(join(fixtureRoot, 'package.json'), 'utf8'), originalManifest);
    assert.equal(existsSync(join(fixtureRoot, 'pnpm-workspace.yaml')), false);
  } finally {
    if (registry) {
      registry.child.kill();
      await registry.closed;
    }
    rmSync(root, { recursive: true, force: true });
  }
});
