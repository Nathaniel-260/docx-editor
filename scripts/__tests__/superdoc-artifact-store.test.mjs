import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { hostname, tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';

import {
  ArtifactStoreError,
  computeArtifactContentSetDigest,
  createSuperDocArtifactStore,
  sealArtifactTree,
  verifyArtifactTree,
} from '../superdoc-artifact-store.mjs';

async function exists(target) {
  return Boolean(
    await lstat(target).catch((error) => {
      if (error?.code === 'ENOENT') return null;
      throw error;
    }),
  );
}

async function createFixture(t, storeOptions = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'superdoc-artifact-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = createSuperDocArtifactStore({
    root: path.join(root, 'store'),
    lockPollMs: 5,
    lockTimeoutMs: 2_000,
    ...storeOptions,
  });
  return {
    root,
    store,
    destinations: {
      engine: path.join(root, 'compatibility', 'engine-dist'),
      public: path.join(root, 'compatibility', 'public-dist'),
    },
  };
}

async function createSource(fixture, label, value) {
  const source = path.join(fixture.root, 'sources', `${label}-${randomUUID()}`);
  await mkdir(path.join(source, 'nested', 'empty'), { recursive: true });
  await writeFile(path.join(source, 'value.txt'), `${value}\n`);
  await writeFile(path.join(source, 'nested', 'identity.txt'), `${label}:${value}\n`);
  return source;
}

async function installComponent(fixture, label, value, options = {}) {
  const sourceRoot = await createSource(fixture, label, value);
  const seal = await sealArtifactTree(sourceRoot);
  const object = await fixture.store.installObject({ sourceRoot, seal, ...options });
  return { ...object, sourceRoot };
}

async function installSet(fixture, version) {
  return {
    engine: await installComponent(fixture, 'engine', version),
    public: await installComponent(fixture, 'public', version),
  };
}

function componentsFor(set) {
  return [
    { id: 'engine', objectDigest: set.engine.digest },
    { id: 'public', objectDigest: set.public.digest },
  ];
}

function compatibilityViewsFor(fixture) {
  return [
    { id: 'engine-dist', componentId: 'engine', destination: fixture.destinations.engine },
    { id: 'public-dist', componentId: 'public', destination: fixture.destinations.public },
  ];
}

async function promoteSet(fixture, set, options = {}) {
  return fixture.store.promote({
    components: componentsFor(set),
    compatibilityViews: compatibilityViewsFor(fixture),
    ...options,
  });
}

async function readCompatibilitySet(fixture) {
  return {
    engine: await readFile(path.join(fixture.destinations.engine, 'value.txt'), 'utf8'),
    public: await readFile(path.join(fixture.destinations.public, 'value.txt'), 'utf8'),
  };
}

async function assertNoTransactionScratch(fixture) {
  const parent = path.dirname(fixture.destinations.engine);
  const entries = (await readdir(parent)).filter((entry) => entry.includes('.superdoc-'));
  assert.deepEqual(entries, []);
  assert.equal(await exists(fixture.store.paths.journal), false);
}

test('creates isolated run-scoped staging roots and rejects duplicate run identities', async (t) => {
  const fixture = await createFixture(t);
  const first = await fixture.store.createRun({ runId: 'run-a', producer: 'engine', metadata: { attempt: 1 } });
  const second = await fixture.store.createRun({ runId: 'run-b', producer: 'engine' });

  assert.notEqual(first.root, second.root);
  assert.equal(first.stagingRoot, path.join(fixture.store.paths.runs, 'run-a', 'staging', 'engine'));
  assert.equal(second.stagingRoot, path.join(fixture.store.paths.runs, 'run-b', 'staging', 'engine'));
  await writeFile(path.join(first.stagingRoot, 'only-first.txt'), 'first');
  assert.equal(await exists(path.join(second.stagingRoot, 'only-first.txt')), false);

  await assert.rejects(
    fixture.store.createRun({ runId: 'run-a', producer: 'engine' }),
    (error) => error instanceof ArtifactStoreError && error.code === 'run-exists',
  );
  await fixture.store.discardRun(first);
  assert.equal(await exists(first.root), false);
  assert.equal(await exists(second.root), true);
});

test('exact-tree seals reject symlinks and content-set identity excludes run metadata', async (t) => {
  const fixture = await createFixture(t);
  const source = await createSource(fixture, 'sealed', 'one');
  const seal = await sealArtifactTree(source);

  assert.equal(seal.directories.includes('nested/empty'), true);
  assert.equal((await verifyArtifactTree(source, seal)).digest, seal.digest);
  await writeFile(path.join(source, 'nested', 'late.txt'), 'late');
  await assert.rejects(
    verifyArtifactTree(source, seal),
    (error) => error instanceof ArtifactStoreError && error.code === 'tree-mismatch',
  );

  const symlinked = await createSource(fixture, 'symlinked', 'one');
  await symlink('value.txt', path.join(symlinked, 'alias.txt'));
  await assert.rejects(
    sealArtifactTree(symlinked),
    (error) => error instanceof ArtifactStoreError && error.code === 'tree-symlink',
  );

  const engineDigest = 'a'.repeat(64);
  const publicDigest = 'b'.repeat(64);
  const first = computeArtifactContentSetDigest([
    { id: 'public', objectDigest: publicDigest, runId: 'run-one' },
    { id: 'engine', objectDigest: engineDigest, builtAt: 'yesterday' },
  ]);
  const second = computeArtifactContentSetDigest([
    { id: 'engine', objectDigest: engineDigest, builtAt: 'today' },
    { id: 'public', objectDigest: publicDigest, runId: 'run-two' },
  ]);
  assert.equal(first, second);
});

test('installs verified immutable objects through sibling incoming directories', async (t) => {
  const fixture = await createFixture(t);
  const source = await createSource(fixture, 'engine', 'same');
  const seal = await sealArtifactTree(source);
  const checkpoints = [];
  const installed = await fixture.store.installObject({
    sourceRoot: source,
    seal,
    checkpoint(name) {
      checkpoints.push(name);
    },
  });

  assert.equal(installed.root, path.join(fixture.store.paths.objects, seal.digest));
  assert.equal(installed.reused, false);
  assert.deepEqual(checkpoints, [
    'object:after-copy',
    'object:after-verify',
    'object:before-rename',
    'object:after-install',
  ]);
  await writeFile(path.join(source, 'value.txt'), 'source changed\n');
  assert.equal(await readFile(path.join(installed.root, 'value.txt'), 'utf8'), 'same\n');
  assert.equal((await fixture.store.verifyObject(installed.digest)).digest, installed.digest);

  const duplicateSource = await createSource(fixture, 'engine', 'same');
  const duplicate = await fixture.store.installObject({ sourceRoot: duplicateSource });
  assert.equal(duplicate.digest, installed.digest);
  assert.equal(duplicate.reused, true);

  await writeFile(path.join(installed.root, 'unexpected.txt'), 'corruption');
  await assert.rejects(
    fixture.store.verifyObject(installed.digest),
    (error) => error instanceof ArtifactStoreError && error.code === 'object-corrupt',
  );
});

test('failed object installation leaves neither an object nor an incoming directory', async (t) => {
  const fixture = await createFixture(t);
  const source = await createSource(fixture, 'engine', 'failed');
  const seal = await sealArtifactTree(source);

  await assert.rejects(
    fixture.store.installObject({
      sourceRoot: source,
      seal,
      checkpoint(name) {
        if (name === 'object:before-rename') throw new Error('injected object failure');
      },
    }),
    /injected object failure/u,
  );

  assert.equal(await exists(path.join(fixture.store.paths.objects, seal.digest)), false);
  assert.deepEqual(
    (await readdir(fixture.store.paths.objects)).filter((entry) => entry.startsWith('.incoming-')),
    [],
  );

  await assert.rejects(
    fixture.store.installObject({
      sourceRoot: source,
      seal,
      async checkpoint(name, detail) {
        if (name === 'object:before-rename') {
          await writeFile(path.join(detail.incoming, 'injected-corruption.txt'), 'corrupt');
        }
      },
    }),
    (error) => error instanceof ArtifactStoreError && error.code === 'object-corrupt',
  );
  assert.equal(await exists(path.join(fixture.store.paths.objects, seal.digest)), false);
  assert.deepEqual(
    (await readdir(fixture.store.paths.objects)).filter((entry) => entry.startsWith('.incoming-')),
    [],
  );
});

test('promotes a versioned pointer and matching canonical compatibility views', async (t) => {
  const fixture = await createFixture(t);
  const firstSet = await installSet(fixture, 'v1');
  const first = await promoteSet(fixture, firstSet, { expectedPointerDigest: null });

  assert.equal(first.pointer.generation, 1);
  assert.equal(first.pointer.previousPointerDigest, null);
  assert.equal(first.pointer.contentSetDigest, computeArtifactContentSetDigest(componentsFor(firstSet)));
  assert.deepEqual(await readCompatibilitySet(fixture), { engine: 'v1\n', public: 'v1\n' });

  const secondSet = await installSet(fixture, 'v2');
  const second = await promoteSet(fixture, secondSet, { expectedPointerDigest: first.pointer.digest });
  const current = await fixture.store.readCurrentPointer();

  assert.equal(current.digest, second.pointer.digest);
  assert.equal(current.generation, 2);
  assert.equal(current.previousPointerDigest, first.pointer.digest);
  assert.equal((await fixture.store.readPointerVersion(first.pointer.digest)).digest, first.pointer.digest);
  assert.equal((await fixture.store.readPointerVersion(second.pointer.digest)).digest, second.pointer.digest);
  assert.deepEqual(await readCompatibilitySet(fixture), { engine: 'v2\n', public: 'v2\n' });
  assert.equal(await readFile(path.join(firstSet.engine.root, 'value.txt'), 'utf8'), 'v1\n');
  assert.equal(await readFile(path.join(firstSet.public.root, 'value.txt'), 'utf8'), 'v1\n');
  await assertNoTransactionScratch(fixture);
});

test('one installed component cannot select or disturb a partial candidate', async (t) => {
  const fixture = await createFixture(t);
  const firstSet = await installSet(fixture, 'old');
  const first = await promoteSet(fixture, firstSet, { expectedPointerDigest: null });
  const nextEngine = await installComponent(fixture, 'engine', 'new');

  await assert.rejects(
    fixture.store.promote({
      components: [
        { id: 'engine', objectDigest: nextEngine.digest },
        { id: 'public', objectDigest: 'f'.repeat(64) },
      ],
      compatibilityViews: compatibilityViewsFor(fixture),
      expectedPointerDigest: first.pointer.digest,
    }),
    (error) => error instanceof ArtifactStoreError && error.code === 'missing-directory',
  );

  assert.equal((await fixture.store.readCurrentPointer()).digest, first.pointer.digest);
  assert.deepEqual(await readCompatibilitySet(fixture), { engine: 'old\n', public: 'old\n' });
  assert.equal((await fixture.store.verifyObject(nextEngine.digest)).digest, nextEngine.digest);
  await assertNoTransactionScratch(fixture);
});

for (const checkpointName of [
  'promotion:after-envelope',
  'compatibility:after-copy',
  'promotion:after-journal',
  'compatibility:after-backup',
  'compatibility:after-switch',
  'promotion:before-pointer',
]) {
  test(`a failure at ${checkpointName} preserves the previous pointer and compatibility set`, async (t) => {
    const fixture = await createFixture(t);
    const firstSet = await installSet(fixture, 'old');
    const first = await promoteSet(fixture, firstSet, { expectedPointerDigest: null });
    const nextSet = await installSet(fixture, 'new');
    let injected = false;

    await assert.rejects(
      promoteSet(fixture, nextSet, {
        expectedPointerDigest: first.pointer.digest,
        checkpoint(name) {
          if (!injected && name === checkpointName) {
            injected = true;
            throw new Error(`injected ${checkpointName}`);
          }
        },
      }),
      new RegExp(`injected ${checkpointName}`, 'u'),
    );

    assert.equal(injected, true);
    assert.equal((await fixture.store.readCurrentPointer()).digest, first.pointer.digest);
    assert.deepEqual(await readCompatibilitySet(fixture), { engine: 'old\n', public: 'old\n' });
    assert.equal((await fixture.store.verifyObject(firstSet.engine.digest)).digest, firstSet.engine.digest);
    assert.equal((await fixture.store.verifyObject(firstSet.public.digest)).digest, firstSet.public.digest);
    await assertNoTransactionScratch(fixture);
  });
}

test('recovery rolls back an interrupted pre-pointer compatibility switch', async (t) => {
  const fixture = await createFixture(t);
  const firstSet = await installSet(fixture, 'old');
  const first = await promoteSet(fixture, firstSet, { expectedPointerDigest: null });
  const nextSet = await installSet(fixture, 'new');

  await assert.rejects(
    promoteSet(fixture, nextSet, {
      expectedPointerDigest: first.pointer.digest,
      recoverOnError: false,
      checkpoint(name) {
        if (name === 'compatibility:after-switch') throw new Error('simulated crash before pointer');
      },
    }),
    /simulated crash before pointer/u,
  );

  assert.equal((await fixture.store.readCurrentPointer()).digest, first.pointer.digest);
  assert.equal(await exists(fixture.store.paths.journal), true);
  const recovered = await fixture.store.recoverPromotion();
  assert.equal(recovered.disposition, 'rolled-back');
  assert.deepEqual(await readCompatibilitySet(fixture), { engine: 'old\n', public: 'old\n' });
  await assertNoTransactionScratch(fixture);
});

test('recovery completes forward after the pointer was durably switched', async (t) => {
  const fixture = await createFixture(t);
  const firstSet = await installSet(fixture, 'old');
  const first = await promoteSet(fixture, firstSet, { expectedPointerDigest: null });
  const nextSet = await installSet(fixture, 'new');

  await assert.rejects(
    promoteSet(fixture, nextSet, {
      expectedPointerDigest: first.pointer.digest,
      recoverOnError: false,
      checkpoint(name) {
        if (name === 'promotion:after-pointer') throw new Error('simulated crash after pointer');
      },
    }),
    /simulated crash after pointer/u,
  );

  const switched = await fixture.store.readCurrentPointer();
  assert.equal(switched.contentSetDigest, computeArtifactContentSetDigest(componentsFor(nextSet)));
  assert.equal(await exists(fixture.store.paths.journal), true);
  const recovered = await fixture.store.recoverPromotion();
  assert.equal(recovered.disposition, 'completed-forward');
  assert.deepEqual(await readCompatibilitySet(fixture), { engine: 'new\n', public: 'new\n' });
  await assertNoTransactionScratch(fixture);
});

test('an abandoned ownerless promotion lock is recovered before promotion', async (t) => {
  const fixture = await createFixture(t, { orphanedLockMs: 0 });
  const set = await installSet(fixture, 'first');
  await mkdir(fixture.store.paths.lock);

  const promoted = await promoteSet(fixture, set, { expectedPointerDigest: null });

  assert.equal(promoted.pointer.generation, 1);
  assert.deepEqual(await readCompatibilitySet(fixture), { engine: 'first\n', public: 'first\n' });
  assert.equal(await exists(fixture.store.paths.lock), false);
});

test('a delayed stale-lock reclaimer cannot remove a replacement live lock', async (t) => {
  const fixture = await createFixture(t, { orphanedLockMs: 0 });
  const winnerSet = await installSet(fixture, 'winner');
  const staleSet = await installSet(fixture, 'stale');
  await mkdir(fixture.store.paths.lock);

  let staleObserved;
  const observed = new Promise((resolve) => {
    staleObserved = resolve;
  });
  let resumeStale;
  const staleGate = new Promise((resolve) => {
    resumeStale = resolve;
  });
  const staleStore = createSuperDocArtifactStore({
    root: fixture.store.root,
    lockPollMs: 5,
    lockTimeoutMs: 2_000,
    orphanedLockMs: 0,
    async lockCheckpoint(name) {
      if (name === 'lock:stale-observed') {
        staleObserved();
        await staleGate;
      }
    },
  });

  let winnerLocked;
  const locked = new Promise((resolve) => {
    winnerLocked = resolve;
  });
  let releaseWinner;
  const winnerGate = new Promise((resolve) => {
    releaseWinner = resolve;
  });
  const winnerStore = createSuperDocArtifactStore({
    root: fixture.store.root,
    lockPollMs: 5,
    lockTimeoutMs: 2_000,
    orphanedLockMs: 0,
  });

  const stalePromotion = staleStore.promote({
    components: componentsFor(staleSet),
    compatibilityViews: compatibilityViewsFor(fixture),
    expectedPointerDigest: null,
  }).then(
    (value) => ({ value }),
    (error) => ({ error }),
  );
  await observed;

  const winnerPromotion = winnerStore.promote({
    components: componentsFor(winnerSet),
    compatibilityViews: compatibilityViewsFor(fixture),
    expectedPointerDigest: null,
    async checkpoint(name) {
      if (name === 'promotion:lock-acquired') {
        winnerLocked();
        await winnerGate;
      }
    },
  });
  await locked;
  const ownerBefore = JSON.parse(await readFile(path.join(fixture.store.paths.lock, 'owner.json'), 'utf8'));

  resumeStale();
  assert.equal(await Promise.race([stalePromotion.then(() => 'settled'), delay(50, 'waiting')]), 'waiting');
  const ownerAfter = JSON.parse(await readFile(path.join(fixture.store.paths.lock, 'owner.json'), 'utf8'));
  assert.equal(ownerAfter.token, ownerBefore.token);

  releaseWinner();
  const winner = await winnerPromotion;
  const stale = await stalePromotion;
  assert.equal(stale.error instanceof ArtifactStoreError, true);
  assert.equal(stale.error.code, 'stale-promotion');
  assert.equal((await fixture.store.readCurrentPointer()).digest, winner.pointer.digest);
  assert.deepEqual(await readCompatibilitySet(fixture), { engine: 'winner\n', public: 'winner\n' });
  assert.equal(await exists(fixture.store.paths.lock), false);
});

test('a crashed lock reclaimer claim is retired before promotion resumes', async (t) => {
  const fixture = await createFixture(t, { orphanedLockMs: 0 });
  const set = await installSet(fixture, 'recovered');
  await mkdir(fixture.store.paths.lock);

  let abandonedClaimPath;
  const crashingStore = createSuperDocArtifactStore({
    root: fixture.store.root,
    lockPollMs: 5,
    lockTimeoutMs: 2_000,
    orphanedLockMs: 0,
    lockCheckpoint(name, detail) {
      if (name === 'lock:reclaim-claimed') {
        abandonedClaimPath = detail.claimPath;
        throw new Error('simulated reclaimer crash');
      }
    },
  });
  await assert.rejects(
    crashingStore.promote({
      components: componentsFor(set),
      compatibilityViews: compatibilityViewsFor(fixture),
      expectedPointerDigest: null,
    }),
    /simulated reclaimer crash/u,
  );

  const abandonedClaim = JSON.parse(await readFile(abandonedClaimPath, 'utf8'));
  await writeFile(
    abandonedClaimPath,
    `${JSON.stringify({ ...abandonedClaim, hostname: hostname(), pid: 2_000_000_000 }, null, 2)}\n`,
  );
  const recoveryStore = createSuperDocArtifactStore({
    root: fixture.store.root,
    lockPollMs: 5,
    lockTimeoutMs: 2_000,
    orphanedLockMs: 0,
  });
  const promoted = await recoveryStore.promote({
    components: componentsFor(set),
    compatibilityViews: compatibilityViewsFor(fixture),
    expectedPointerDigest: null,
  });

  assert.equal(promoted.pointer.generation, 1);
  assert.deepEqual(await readCompatibilitySet(fixture), { engine: 'recovered\n', public: 'recovered\n' });
  assert.equal(await exists(fixture.store.paths.lock), false);
});

test('a crash after stale-lock quarantine cannot strand the promotion lock', async (t) => {
  const fixture = await createFixture(t, { orphanedLockMs: 0 });
  const set = await installSet(fixture, 'after-quarantine');
  await mkdir(fixture.store.paths.lock);

  let quarantinePath;
  const crashingStore = createSuperDocArtifactStore({
    root: fixture.store.root,
    lockPollMs: 5,
    lockTimeoutMs: 2_000,
    orphanedLockMs: 0,
    lockCheckpoint(name, detail) {
      if (name === 'lock:stale-quarantined') {
        quarantinePath = detail.quarantinePath;
        throw new Error('simulated crash after quarantine');
      }
    },
  });
  await assert.rejects(
    crashingStore.promote({
      components: componentsFor(set),
      compatibilityViews: compatibilityViewsFor(fixture),
      expectedPointerDigest: null,
    }),
    /simulated crash after quarantine/u,
  );
  assert.equal(await exists(fixture.store.paths.lock), false);
  assert.equal(await exists(quarantinePath), true);

  const recoveryStore = createSuperDocArtifactStore({
    root: fixture.store.root,
    lockPollMs: 5,
    lockTimeoutMs: 2_000,
    orphanedLockMs: 0,
  });
  const promoted = await recoveryStore.promote({
    components: componentsFor(set),
    compatibilityViews: compatibilityViewsFor(fixture),
    expectedPointerDigest: null,
  });
  assert.equal(promoted.pointer.generation, 1);
  assert.deepEqual(await readCompatibilitySet(fixture), {
    engine: 'after-quarantine\n',
    public: 'after-quarantine\n',
  });
});

test('a live foreign promotion lock is never reclaimed by orphan aging', async (t) => {
  const fixture = await createFixture(t, {
    lockPollMs: 5,
    lockTimeoutMs: 40,
    orphanedLockMs: 0,
  });
  const set = await installSet(fixture, 'blocked');
  const foreignOwner = {
    schema: 'superdoc-artifact-promotion-lock.v1',
    token: randomUUID(),
    pid: 2_000_000_000,
    hostname: `foreign-${hostname()}`,
    acquiredAt: new Date(0).toISOString(),
  };
  await mkdir(fixture.store.paths.lock);
  await writeFile(path.join(fixture.store.paths.lock, 'owner.json'), `${JSON.stringify(foreignOwner)}\n`);

  await assert.rejects(
    promoteSet(fixture, set, { expectedPointerDigest: null }),
    (error) => error instanceof ArtifactStoreError && error.code === 'promotion-lock-timeout',
  );
  assert.deepEqual(
    JSON.parse(await readFile(path.join(fixture.store.paths.lock, 'owner.json'), 'utf8')),
    foreignOwner,
  );
});

test('serialized promotion rejects concurrent and sequential stale promoters without mixing sets', async (t) => {
  const fixture = await createFixture(t);
  const baseSet = await installSet(fixture, 'base');
  const base = await promoteSet(fixture, baseSet, { expectedPointerDigest: null });
  const firstSet = await installSet(fixture, 'winner');
  const staleSet = await installSet(fixture, 'stale');

  let signalLocked;
  const locked = new Promise((resolve) => {
    signalLocked = resolve;
  });
  let releaseGate;
  const gate = new Promise((resolve) => {
    releaseGate = resolve;
  });
  const winnerPromise = promoteSet(fixture, firstSet, {
    expectedPointerDigest: base.pointer.digest,
    async checkpoint(name) {
      if (name === 'promotion:lock-acquired') {
        signalLocked();
        await gate;
      }
    },
  });
  await locked;

  const concurrentResult = promoteSet(fixture, staleSet, {
    expectedPointerDigest: base.pointer.digest,
  }).then(
    (value) => ({ value }),
    (error) => ({ error }),
  );
  assert.equal(await Promise.race([concurrentResult.then(() => 'settled'), delay(50, 'waiting')]), 'waiting');
  releaseGate();

  const winner = await winnerPromise;
  const concurrent = await concurrentResult;
  assert.equal(concurrent.error instanceof ArtifactStoreError, true);
  assert.equal(concurrent.error.code, 'stale-promotion');
  assert.equal((await fixture.store.readCurrentPointer()).digest, winner.pointer.digest);
  assert.deepEqual(await readCompatibilitySet(fixture), { engine: 'winner\n', public: 'winner\n' });

  await assert.rejects(
    promoteSet(fixture, staleSet, { expectedPointerDigest: base.pointer.digest }),
    (error) => error instanceof ArtifactStoreError && error.code === 'stale-promotion',
  );
  assert.equal((await fixture.store.readCurrentPointer()).digest, winner.pointer.digest);
  assert.deepEqual(await readCompatibilitySet(fixture), { engine: 'winner\n', public: 'winner\n' });
  await assertNoTransactionScratch(fixture);
});
