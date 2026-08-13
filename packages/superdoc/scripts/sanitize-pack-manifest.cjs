#!/usr/bin/env node

'use strict';

const ENGINE_PACKAGE_NAME = '@superdoc/docx-engine';
const PUBLISH_DEPENDENCY_FIELDS = Object.freeze(['dependencies', 'optionalDependencies', 'peerDependencies']);
const LOCAL_DEPENDENCY_PROTOCOL = /^(?:catalog|file|link|portal|workspace):/u;

function stripSourceConditions(value) {
  if (Array.isArray(value)) return value.map(stripSourceConditions);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== 'source')
      .map(([key, child]) => [key, stripSourceConditions(child)]),
  );
}

function resolveEngineVersion(sourceVersion, hasInternalWorkspace) {
  const pattern = hasInternalWorkspace
    ? /^workspace:(0\.\d+\.\d+(?:-next\.\d+)?)$/
    : /^(0\.\d+\.\d+(?:-next\.\d+)?)$/;
  const match = typeof sourceVersion === 'string' ? sourceVersion.match(pattern) : null;
  if (!match) {
    const requiredSpec = hasInternalWorkspace ? 'workspace:0.x in Orbit' : 'exact 0.x in an exported checkout';
    throw new Error(`${ENGINE_PACKAGE_NAME} must use ${requiredSpec} before packing`);
  }
  return match[1];
}

function resolvePublishDependencyProtocols(manifest, catalog) {
  for (const field of PUBLISH_DEPENDENCY_FIELDS) {
    const dependencies = manifest[field];
    if (dependencies === undefined) continue;
    if (!dependencies || typeof dependencies !== 'object' || Array.isArray(dependencies)) {
      throw new Error(`source package manifest ${field} must be an object`);
    }

    for (const [name, sourceSpec] of Object.entries(dependencies)) {
      let resolvedSpec = sourceSpec;
      if (sourceSpec === 'catalog:') {
        resolvedSpec = catalog?.[name];
        if (typeof resolvedSpec !== 'string' || resolvedSpec.length === 0) {
          throw new Error(`${field}.${name} uses catalog: but the default catalog has no string entry for ${name}`);
        }
        dependencies[name] = resolvedSpec;
      }
      if (typeof resolvedSpec === 'string' && LOCAL_DEPENDENCY_PROTOCOL.test(resolvedSpec)) {
        throw new Error(`${field}.${name} must not use local dependency protocol ${resolvedSpec} in a packed manifest`);
      }
    }
  }
}

/**
 * Build the publish manifest without changing the source manifest on disk or
 * mutating the caller's object. Packing writes this value only into an
 * ephemeral, allowlisted package root.
 */
function buildSanitizedPackManifest(sourceManifest, { hasInternalWorkspace, files, catalog } = {}) {
  if (!sourceManifest || typeof sourceManifest !== 'object' || Array.isArray(sourceManifest)) {
    throw new Error('source package manifest must be an object');
  }
  const packed = JSON.parse(JSON.stringify(sourceManifest));
  const sourceEngineVersion = packed.dependencies?.[ENGINE_PACKAGE_NAME];
  if (!packed.dependencies || typeof packed.dependencies !== 'object') {
    throw new Error(`source package manifest has no dependencies.${ENGINE_PACKAGE_NAME}`);
  }

  packed.exports = stripSourceConditions(packed.exports);
  packed.dependencies[ENGINE_PACKAGE_NAME] = resolveEngineVersion(sourceEngineVersion, hasInternalWorkspace);
  delete packed.devDependencies;
  resolvePublishDependencyProtocols(packed, catalog);
  delete packed.unpkg;
  delete packed.jsdelivr;

  if (packed.scripts && typeof packed.scripts === 'object') {
    delete packed.scripts.prepack;
    delete packed.scripts.prepare;
    delete packed.scripts.postpack;
  }
  if (files) packed.files = [...files];
  return packed;
}

if (require.main === module) {
  console.error(
    '[sanitize-pack-manifest] This module is a pure manifest builder. Run `pnpm run pack:sealed`; source package.json is never rewritten.',
  );
  process.exit(1);
}

module.exports = {
  buildSanitizedPackManifest,
  resolveEngineVersion,
  resolvePublishDependencyProtocols,
  stripSourceConditions,
};
