import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const PUBLIC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function writeFixtureFile(repoDir, relativePath, content) {
  const absolutePath = path.join(repoDir, relativePath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content);
}

function runTestEntrypoint({ privateWorkspaces }) {
  const repoDir = mkdtempSync(path.join(os.tmpdir(), 'superdoc-test-entrypoint-'));
  const fakeBin = path.join(repoDir, 'fake-bin');
  const invocationLog = path.join(repoDir, 'pnpm-invocations.txt');
  mkdirSync(path.join(repoDir, 'scripts'), { recursive: true });
  mkdirSync(fakeBin, { recursive: true });
  copyFileSync(path.join(PUBLIC_ROOT, 'scripts/test.mjs'), path.join(repoDir, 'scripts/test.mjs'));
  writeFixtureFile(
    repoDir,
    'package.json',
    `${JSON.stringify({ name: 'test-entrypoint-fixture', private: true, type: 'module' })}\n`,
  );
  if (privateWorkspaces) {
    writeFixtureFile(repoDir, 'apps/cli/package.json', '{}\n');
    writeFixtureFile(repoDir, 'packages/sdk/package.json', '{}\n');
  }
  writeFixtureFile(
    repoDir,
    'fake-bin/pnpm',
    `#!/bin/sh\nprintf '%s\\n' "$*" >> ${JSON.stringify(invocationLog)}\nexit 0\n`,
  );
  chmodSync(path.join(fakeBin, 'pnpm'), 0o755);

  const result = spawnSync(process.execPath, ['scripts/test.mjs'], {
    cwd: repoDir,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${fakeBin}${path.delimiter}${process.env.PATH}`,
    },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return readFileSync(invocationLog, 'utf8').trim().split('\n');
}

function planLocalCi({ privateWorkspaces, docsV1RouteScripts = privateWorkspaces }) {
  const repoDir = mkdtempSync(path.join(os.tmpdir(), 'superdoc-local-ci-plan-'));
  mkdirSync(path.join(repoDir, 'scripts'), { recursive: true });
  copyFileSync(path.join(PUBLIC_ROOT, 'scripts/oss-local-ci.mjs'), path.join(repoDir, 'scripts/oss-local-ci.mjs'));
  writeFixtureFile(repoDir, '.nvmrc', '22.21.1\n');
  writeFixtureFile(
    repoDir,
    'package.json',
    `${JSON.stringify({ name: 'local-ci-plan-fixture', packageManager: 'pnpm@10.25.0', private: true })}\n`,
  );
  writeFixtureFile(repoDir, '.github/workflows/validate.yml', 'name: Validate\n');
  for (const workflowPath of [
    '.github/workflows/declarations.yml',
    '.github/workflows/document-api.yml',
    '.github/workflows/examples.yml',
    '.github/workflows/react.yml',
    '.github/workflows/vscode.yml',
  ]) {
    writeFixtureFile(repoDir, workflowPath, `name: ${workflowPath}\n`);
  }
  writeFixtureFile(
    repoDir,
    'apps/docs/package.json',
    `${JSON.stringify({
      name: '@superdoc/docs',
      scripts: docsV1RouteScripts
        ? {
            'check:v1-routes': 'node scripts/v1-routes.mjs check',
            'test:v1-routes': 'node --test tests/v1-routes.test.mjs',
          }
        : {},
    })}\n`,
  );
  if (privateWorkspaces) {
    writeFixtureFile(repoDir, 'apps/cli/package.json', '{}\n');
    writeFixtureFile(repoDir, 'apps/mcp/package.json', '{}\n');
    writeFixtureFile(repoDir, 'packages/sdk/package.json', '{}\n');
    for (const workflowPath of [
      '.github/workflows/ci-docs.yml',
      '.github/workflows/ci-mcp.yml',
      '.github/workflows/ci-sdk.yml',
      '.github/workflows/ci-superdoc.yml',
    ]) {
      writeFixtureFile(repoDir, workflowPath, `name: ${workflowPath}\n`);
    }
  }

  const result = spawnSync(process.execPath, ['scripts/oss-local-ci.mjs', '--plan'], {
    cwd: repoDir,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout;
}

test('the root test entrypoint skips only commands owned by omitted private workspaces', () => {
  const projectedInvocations = runTestEntrypoint({ privateWorkspaces: false });
  assert.equal(projectedInvocations.length, 2);
  assert.ok(projectedInvocations.every((invocation) => !invocation.includes('packages/sdk')));
  assert.ok(projectedInvocations.every((invocation) => !invocation.includes('document-api-smoke')));

  const orbitInvocations = runTestEntrypoint({ privateWorkspaces: true });
  assert.equal(orbitInvocations.length, 4);
  assert.ok(orbitInvocations.some((invocation) => invocation.includes('--prefix packages/sdk run test:scripts')));
  assert.ok(orbitInvocations.some((invocation) => invocation.includes('@superdoc-testing/document-api-smoke')));
});

test('the local CI plan skips only stages owned by omitted private workspaces', () => {
  const privateStageIds = [
    'sdk-scripts',
    'docs-content',
    'docs-document-api-smoke',
    'docs-v1-routes',
    'docs-v1-routes-test',
  ];
  const projectedPlan = planLocalCi({ privateWorkspaces: false });
  assert.doesNotMatch(projectedPlan, /docs-collections/u);
  for (const stageId of privateStageIds) {
    assert.doesNotMatch(projectedPlan, new RegExp(`\\b${stageId}\\b`, 'u'));
  }
  assert.doesNotMatch(projectedPlan, /lane ci-sdk-mcp/u);
  assert.match(projectedPlan, /lane ci-superdoc: CI V2 Public validation/u);
  assert.match(projectedPlan, /workflow: \.github\/workflows\/validate\.yml/u);
  assert.match(projectedPlan, /\bpublic-ci\b/u);
  for (const stageId of ['release-scripts', 'workflow-paths', 'consumer-install', 'public-boundary', 'slow-tests']) {
    assert.match(projectedPlan, new RegExp(`\\b${stageId}\\b`, 'u'));
  }
  assert.doesNotMatch(projectedPlan, /workflow: \.github\/workflows\/ci-superdoc\.yml/u);
  for (const publicWorkflow of ['declarations', 'document-api', 'examples', 'react', 'vscode']) {
    assert.match(projectedPlan, new RegExp(`\\.github/workflows/${publicWorkflow}\\.yml`, 'u'));
  }
  assert.doesNotMatch(projectedPlan, /workflow: \.github\/workflows\/ci-docs\.yml/u);

  const orbitPlan = planLocalCi({ privateWorkspaces: true });
  assert.doesNotMatch(orbitPlan, /docs-collections/u);
  for (const stageId of privateStageIds) {
    assert.match(orbitPlan, new RegExp(`\\b${stageId}\\b`, 'u'));
  }
  assert.match(orbitPlan, /lane ci-sdk-mcp/u);
  assert.match(orbitPlan, /lane ci-superdoc: CI SuperDoc/u);
  assert.match(orbitPlan, /workflow: \.github\/workflows\/ci-superdoc\.yml/u);
  for (const orbitWorkflow of ['declarations', 'document-api', 'examples', 'react', 'vscode', 'ci-docs']) {
    assert.match(orbitPlan, new RegExp(`\\.github/workflows/${orbitWorkflow}\\.yml`, 'u'));
  }

  const mixedPlan = planLocalCi({ privateWorkspaces: true, docsV1RouteScripts: false });
  assert.match(mixedPlan, /lane ci-sdk-mcp/u);
  for (const stageId of ['docs-v1-routes', 'docs-v1-routes-test']) {
    assert.doesNotMatch(mixedPlan, new RegExp(`\\b${stageId}\\b`, 'u'));
  }
});
