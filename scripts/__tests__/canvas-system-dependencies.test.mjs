import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import {
  access,
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const execFileAsync = promisify(execFile);

async function readRepoFile(relativePath) {
  return readFile(path.join(REPO_ROOT, relativePath), 'utf8');
}

test('canvas system dependency installer guards apt commands with timeout and diagnostics', async () => {
  const content = await readRepoFile('scripts/install-canvas-system-dependencies.sh');

  assert.ok(content.includes("dpkg-query --show --showformat='${db:Status-Status}'"));
  assert.ok(content.includes('Canvas system dependencies are already installed.'));
  assert.ok(content.includes('APT_COMMAND_TIMEOUT:-10m'));
  assert.ok(content.includes('timeout "${apt_timeout}" sudo apt-get'));
  assert.ok(content.includes('Acquire::Retries=3'));
  assert.ok(content.includes('Dpkg::Use-Pty=0'));
  assert.ok(content.includes('timed out after ${apt_timeout}'));
  assert.ok(content.includes('fuser -v /var/lib/dpkg/lock'));
});

test('canvas system dependency installer bypasses the unhealthy Azure mirror', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'canvas-apt-'));
  t.after(() => rm(root, { recursive: true, force: true }));

  const bin = path.join(root, 'bin');
  const mirrorFile = path.join(root, 'apt-mirrors.txt');
  const aptLog = path.join(root, 'apt.log');
  await mkdir(bin);
  await writeFile(
    mirrorFile,
    [
      'http://azure.archive.ubuntu.com/ubuntu/\tpriority:1',
      'https://archive.ubuntu.com/ubuntu/\tpriority:2',
      'https://security.ubuntu.com/ubuntu/\tpriority:3',
      '',
    ].join('\n'),
  );
  await writeFile(path.join(bin, 'dpkg-query'), '#!/usr/bin/env bash\nexit 1\n');
  await writeFile(path.join(bin, 'sudo'), '#!/usr/bin/env bash\nexec "$@"\n');
  await writeFile(path.join(bin, 'timeout'), '#!/usr/bin/env bash\nshift\nexec "$@"\n');
  await writeFile(
    path.join(bin, 'apt-get'),
    '#!/usr/bin/env bash\nprintf "%s\\n" "$*" >> "$APT_TEST_LOG"\n',
  );
  await Promise.all(
    ['dpkg-query', 'sudo', 'timeout', 'apt-get'].map((name) => chmod(path.join(bin, name), 0o755)),
  );

  await execFileAsync(
    'bash',
    [path.join(REPO_ROOT, 'scripts/install-canvas-system-dependencies.sh')],
    {
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        APT_MIRROR_FILE: mirrorFile,
        APT_TEST_LOG: aptLog,
        GITHUB_ACTIONS: 'true',
      },
    },
  );

  const mirrors = await readFile(mirrorFile, 'utf8');
  assert.equal(mirrors.includes('azure.archive.ubuntu.com'), false);
  assert.match(mirrors, /archive\.ubuntu\.com/);
  assert.match(mirrors, /security\.ubuntu\.com/);

  const aptCommands = await readFile(aptLog, 'utf8');
  assert.match(aptCommands, /update/);
  assert.match(aptCommands, /install .*build-essential/);
});

test('workflows use the guarded canvas dependency installer instead of raw apt commands', async () => {
  const workflowCandidates = [
    { path: '.github/workflows/ci-superdoc.yml', requiresInstaller: true },
    { path: '.github/workflows/validate.yml', requiresInstaller: false },
  ];
  const workflowFiles = [];
  for (const candidate of workflowCandidates) {
    try {
      await access(path.join(REPO_ROOT, candidate.path));
      workflowFiles.push(candidate);
    } catch {
      // The export seam intentionally replaces ci-superdoc with
      // v2-public-validation, so exactly one candidate may be absent.
    }
  }
  assert.ok(workflowFiles.length > 0, 'expected an active SuperDoc validation workflow to scan');

  for (const { path: file, requiresInstaller } of workflowFiles) {
    const content = await readRepoFile(file);
    if (requiresInstaller) {
      assert.ok(
        content.includes('scripts/install-canvas-system-dependencies.sh'),
        `${file}: must call scripts/install-canvas-system-dependencies.sh`,
      );
    }
    assert.equal(content.includes('sudo apt-get update'), false, `${file}: must not run raw apt-get update`);
    assert.equal(content.includes('sudo apt-get install'), false, `${file}: must not run raw apt-get install`);
  }
});
