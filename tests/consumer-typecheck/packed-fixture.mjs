import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function installPackedSuperdocFixture({ fixtureRoot, superdocTarball, engineTarball }) {
  const manifestPath = join(fixtureRoot, 'package.json');
  const workspacePath = join(fixtureRoot, 'pnpm-workspace.yaml');
  const originalManifest = readFileSync(manifestPath, 'utf8');
  let workspaceCreated = false;

  try {
    const manifest = JSON.parse(originalManifest);
    manifest.dependencies = {
      ...manifest.dependencies,
      superdoc: `file:${superdocTarball}`,
      ...(engineTarball ? { '@superdoc/docx-engine': `file:${engineTarball}` } : {}),
    };
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    if (engineTarball) {
      if (existsSync(workspacePath)) {
        throw new Error(`Packed fixture workspace already exists: ${workspacePath}`);
      }
      // pnpm 11 reads overrides only from pnpm-workspace.yaml. A local
      // workspace keeps the sealed engine override isolated from the repo.
      writeFileSync(
        workspacePath,
        `packages:\n  - "."\noverrides:\n  "@superdoc/docx-engine": ${JSON.stringify(`file:${engineTarball}`)}\n`,
      );
      workspaceCreated = true;
    }

    execFileSync(
      'pnpm',
      [
        'install',
        ...(engineTarball ? [] : ['--ignore-workspace']),
        '--ignore-scripts',
        '--no-frozen-lockfile',
        '--no-lockfile',
        '--prefer-offline',
      ],
      { cwd: fixtureRoot, stdio: 'inherit' },
    );
  } finally {
    writeFileSync(manifestPath, originalManifest);
    if (workspaceCreated) rmSync(workspacePath, { force: true });
  }
}
