const { spawnSync } = require('node:child_process');
const path = require('node:path');

const packageRoot = path.resolve(__dirname, '..');
const typescriptEntry = require.resolve('typescript/bin/tsc', { paths: [packageRoot] });

function runTypeScript(args, options = {}, spawn = spawnSync) {
  return spawn(process.execPath, [typescriptEntry, ...args], options);
}

function formatTypeScriptLaunchError(result, context) {
  if (!result.error) return null;
  return `failed to invoke TypeScript for ${context}: ${result.error.message}`;
}

module.exports = {
  formatTypeScriptLaunchError,
  runTypeScript,
  typescriptEntry,
};
