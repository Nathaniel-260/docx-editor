import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const {
  assertPublicPublisherVersionAllowed,
  buildPublishArgs,
  publishFromSemanticRelease,
} = require('../publish-superdoc.cjs');

test('public publisher remains a 1.x-only release lane', () => {
  assert.doesNotThrow(() => assertPublicPublisherVersionAllowed('1.44.2'));
  assert.throws(
    () => assertPublicPublisherVersionAllowed('2.3.0-next.1'),
    /public publisher is restricted to 1\.x releases/u,
  );
});

test('publisher targets audited tarballs rather than mutable package directories', () => {
  assert.deepEqual(
    buildPublishArgs('/tmp/superdoc.tgz', {
      distTag: 'next',
      registry: 'https://registry.example.test',
    }),
    [
      'publish',
      '/tmp/superdoc.tgz',
      '--access',
      'public',
      '--tag',
      'next',
      '--no-git-checks',
      '--registry',
      'https://registry.example.test',
    ],
  );
  assert.throws(
    () => buildPublishArgs('/workspace/packages/superdoc', { distTag: 'next', registry: 'registry' }),
    /publish target must be an audited tarball/u,
  );
});

test('semantic-release builds the sealed package after version stamping', () => {
  const calls = [];
  const logger = { log() {} };
  publishFromSemanticRelease(
    { nextRelease: { channel: 'next' }, logger },
    (options) => calls.push(options),
  );
  assert.deepEqual(calls, [
    {
      distTag: 'next',
      publishUnscoped: true,
      build: true,
      logger,
    },
  ]);
});
