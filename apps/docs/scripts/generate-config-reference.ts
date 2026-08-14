import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGenerator, type DocEntry } from 'fumadocs-typescript';
import type { ConfigExplorerData, ConfigField } from '../lib/config-explorer';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = resolve(appRoot, '../..');
const outputPath = resolve(appRoot, 'generated/proofing-config-reference.json');
const sourcePath = resolve(publicRoot, 'packages/superdoc/src/core/types/index.ts');
const generator = createGenerator({ tsconfigPath: resolve(appRoot, 'tsconfig.json') });
const generatedTypes = new Map<string, string>();
const generatedTypeNames = new Map<string, string>();
const fieldDefaults = new Map<string, string>();

const [document] = await generator.generateDocumentation({ path: sourcePath }, 'ProofingConfig', {
  transform(entry, propertyType) {
    const members = propertyType.isUnion()
      ? propertyType.getUnionTypes().filter((member) => !member.isUndefined())
      : [propertyType];
    type TypeLike = (typeof members)[number];
    const text = (type: TypeLike) => type.getText(this.declaration);
    const typeName = members
      .sort((left, right) => Number(left.isNull()) - Number(right.isNull()))
      .map(text)
      .join(' | ')
      .replace(/^false \| true$/u, 'boolean');
    const withoutUndefined = (type: TypeLike) =>
      type.isUnion() ? type.getUnionTypes().filter((member) => !member.isUndefined()) : [type];
    const formatNested = (type: TypeLike) =>
      withoutUndefined(type)
        .map((member) => {
          const signature = member.getCallSignatures()[0];
          if (!signature) return text(member);
          const params = signature
            .getParameters()
            .map(
              (parameter) =>
                `${parameter.getName()}: ${parameter.getTypeAtLocation(this.declaration).getText(this.declaration)}`,
            );
          return `(${params.join(', ')}) => ${signature.getReturnType().getText(this.declaration)}`;
        })
        .join(' | ')
        .replace(/^false \| true$/u, 'boolean');
    const formatObject = (type: TypeLike) => {
      const properties = type.getProperties();
      if (properties.length === 0 || properties.length > 12) return text(type);
      const rows = properties.map((property) => {
        const propertyType = property.getTypeAtLocation(this.declaration);
        return `  ${property.getName()}${property.isOptional() ? '?' : ''}: ${formatNested(propertyType)};`;
      });
      return `{\n${rows.join('\n')}\n}`;
    };
    const formatRoot = (type: TypeLike) => {
      const signature = type.getCallSignatures()[0];
      if (signature) {
        const params = signature.getParameters().map((parameter) => {
          const parameterType = parameter.getTypeAtLocation(this.declaration);
          return `${parameter.getName()}: ${formatObject(parameterType)}`;
        });
        return `(${params.join(', ')}) => ${signature.getReturnType().getText(this.declaration)}`;
      }
      if (!type.isNull() && !type.isString() && !type.isNumber() && !type.isBooleanLiteral() && !type.isArray()) {
        return formatObject(type);
      }
      return text(type);
    };
    const type = members
      .sort((left, right) => Number(left.isNull()) - Number(right.isNull()))
      .map(formatRoot)
      .join(' | ')
      .replace(/^false \| true$/u, 'boolean');
    generatedTypes.set(entry.name, type);
    if (type.includes('\n') && typeName !== type) generatedTypeNames.set(entry.name, typeName);
    const defaultTag = entry.tags.find((tag) => tag.name === 'default' || tag.name === 'defaultValue');
    if (defaultTag?.text) fieldDefaults.set(entry.name, defaultTag.text);
  },
});

if (!document) throw new Error(`ProofingConfig was not exported by ${sourcePath}`);

const data: ConfigExplorerData = {
  id: 'proofing-config',
  name: document.name,
  root: 'proofing',
  label: 'proofing config',
  groups: [
    { id: 'core', label: 'Setup' },
    { id: 'behavior', label: 'Behavior' },
    { id: 'callbacks', label: 'Events' },
    { id: 'reserved', label: 'Reserved' },
    { id: 'other', label: 'Other options' },
  ],
  fields: document.entries.map(toField),
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
console.log(`Generated ${data.name} reference: ${data.fields.length} fields.`);

function toField(entry: DocEntry): ConfigField {
  const type = generatedTypes.get(entry.name);
  if (!type) throw new Error(`No generated type for ${entry.name}`);
  return {
    name: entry.name,
    type,
    typeName: generatedTypeNames.get(entry.name),
    required: entry.required,
    description: entry.description.replace(/\s+/gu, ' ').trim(),
    default: fieldDefaults.get(entry.name),
    group: 'other',
  };
}
