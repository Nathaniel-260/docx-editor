import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { nextLocalVersion, parseArgs, publishLocalSuperDoc } from '../local-publish.mjs';

test('local versions advance without changing the source prerelease identity', () => {
  assert.equal(nextLocalVersion('2.6.0-next.5', []), '2.6.0-next.5.local.0');
  assert.equal(
    nextLocalVersion('2.6.0-next.5', ['2.6.0-next.5.local.0', '2.6.0-next.5.local.1']),
    '2.6.0-next.5.local.2',
  );
  assert.equal(nextLocalVersion('2.6.0', ['2.6.0-local.0']), '2.6.0-local.1');
});

test('local publish accepts the standard pnpm argument separator', () => {
  assert.deepEqual(parseArgs(['--', '--registry', 'http://127.0.0.1:4879']), {
    registry: 'http://127.0.0.1:4879',
  });
});

test('two local publishes choose distinct staged versions and publish explicit tarballs', async () => {
  const publicRoot = mkdtempSync(path.join(os.tmpdir(), 'superdoc-local-publish-'));
  const packageRoot = path.join(publicRoot, 'packages', 'superdoc');
  mkdirSync(packageRoot, { recursive: true });
  const sourceManifest = `${JSON.stringify({ name: 'superdoc', version: '2.6.0-next.5' }, null, 2)}\n`;
  writeFileSync(path.join(packageRoot, 'package.json'), sourceManifest);
  const published = new Set();
  const calls = [];
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ versions: Object.fromEntries([...published].map((version) => [version, {}])) }),
  });
  const spawn = (command, args, options) => {
    calls.push({ command, args, cwd: options.cwd, version: options.env.SUPERDOC_PACK_VERSION_OVERRIDE ?? null });
    if (args.join(' ') === 'run pack:es') {
      writeFileSync(path.join(packageRoot, 'superdoc.tgz'), 'sealed tarball\n');
    } else if (args[0] === 'publish') {
      const packCall = calls.at(-2);
      published.add(packCall.version);
    }
    return { status: 0 };
  };

  try {
    const first = await publishLocalSuperDoc({ publicRoot, fetchImpl, spawn });
    const second = await publishLocalSuperDoc({ publicRoot, fetchImpl, spawn });
    assert.equal(first.version, '2.6.0-next.5.local.0');
    assert.equal(second.version, '2.6.0-next.5.local.1');
    assert.equal(calls.filter((call) => call.args[0] === 'publish').length, 2);
    for (const call of calls.filter((entry) => entry.args[0] === 'publish')) {
      assert.equal(call.args[1], path.join(packageRoot, 'superdoc.tgz'));
      assert.ok(call.args.includes('--tag'));
    }
    assert.equal(readFileSync(path.join(packageRoot, 'package.json'), 'utf8'), sourceManifest);
  } finally {
    rmSync(publicRoot, { recursive: true, force: true });
  }
});
