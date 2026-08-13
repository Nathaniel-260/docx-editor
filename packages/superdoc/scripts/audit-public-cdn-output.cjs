#!/usr/bin/env node

'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { cdnDistRoot } = require('./build-output-paths.cjs');

const packageRoot = path.resolve(__dirname, '..');
const script = path.resolve(packageRoot, '../../scripts/audit-publish-artifact.mjs');
const result = spawnSync(process.execPath, [script, cdnDistRoot, '--label', 'superdoc-cdn'], {
  cwd: packageRoot,
  stdio: 'inherit',
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
