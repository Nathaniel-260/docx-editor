import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGenerator, type DocEntry } from 'fumadocs-typescript';
import type { ConfigExplorerData, ConfigField } from '../lib/config-explorer';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = resolve(appRoot, '../..');
const sourcePath = resolve(publicRoot, 'packages/superdoc/src/core/types/index.ts');
const generator = createGenerator({ tsconfigPath: resolve(appRoot, 'tsconfig.json') });

type ReferenceDefinition = Omit<ConfigExplorerData, 'fields'> & {
  typeName: string;
  outputFile: string;
};

const references: ReferenceDefinition[] = [
  {
    typeName: 'Config',
    outputFile: 'editor-config-reference.json',
    id: 'editor-config',
    name: 'Config',
    root: 'config',
    label: 'editor config',
    syntax: 'typed-variable',
    groups: [
      { id: 'essentials', label: 'Essentials' },
      { id: 'document', label: 'Document' },
      { id: 'interface', label: 'Interface' },
      { id: 'behavior', label: 'Behavior' },
      { id: 'integrations', label: 'Integrations' },
      { id: 'lifecycle', label: 'Lifecycle' },
      { id: 'advanced', label: 'Advanced' },
    ],
  },
  {
    typeName: 'ProofingConfig',
    outputFile: 'proofing-config-reference.json',
    id: 'proofing-config',
    name: 'ProofingConfig',
    root: 'proofing',
    label: 'proofing config',
    groups: [
      { id: 'core', label: 'Setup' },
      { id: 'behavior', label: 'Behavior' },
      { id: 'callbacks', label: 'Events' },
      { id: 'reserved', label: 'Reserved' },
      { id: 'other', label: 'Other options' },
    ],
  },
];

for (const reference of references) await generateReference(reference);

async function generateReference(definition: ReferenceDefinition) {
  const generatedTypes = new Map<string, string>();
  const generatedTypeNames = new Map<string, string>();
  const fieldDefaults = new Map<string, string>();
  const deprecatedFields = new Set<string>();
  const deprecatedReplacements = new Map<string, string>();

  const [document] = await generator.generateDocumentation({ path: sourcePath }, definition.typeName, {
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
        if (!type.isObject() || type.isUnion()) return text(type);
        const properties = type.getProperties();
        if (properties.length === 0 || properties.length > 12) return text(type);
        const rows = properties.map((property) => {
          const nestedType = property.getTypeAtLocation(this.declaration);
          return `  ${property.getName()}${property.isOptional() ? '?' : ''}: ${formatNested(nestedType)};`;
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
      const deprecatedTag = entry.tags.find((tag) => tag.name === 'deprecated');
      if (deprecatedTag) {
        deprecatedFields.add(entry.name);
        const replacement = deprecatedTag.text?.match(/replaceWith=`([^`]+)`/u)?.[1];
        if (replacement) deprecatedReplacements.set(entry.name, replacement);
      }
    },
  });

  if (!document) throw new Error(`${definition.typeName} was not exported by ${sourcePath}`);

  const { outputFile, typeName: _typeName, ...metadata } = definition;
  const data: ConfigExplorerData = {
    ...metadata,
    fields: document.entries.map(toField),
  };
  const outputPath = resolve(appRoot, `generated/${outputFile}`);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log(`Generated ${data.name} reference: ${data.fields.length} fields.`);

  function toField(entry: DocEntry): ConfigField {
    const type = generatedTypes.get(entry.name);
    if (!type) throw new Error(`No generated type for ${definition.typeName}.${entry.name}`);
    return {
      name: entry.name,
      type,
      typeName: generatedTypeNames.get(entry.name),
      required: entry.required,
      description: entry.description.replace(/\s+/gu, ' ').trim(),
      default: fieldDefaults.get(entry.name),
      group: 'other',
      deprecated: deprecatedFields.has(entry.name) || undefined,
      deprecatedReplacement: deprecatedReplacements.get(entry.name),
    };
  }
}
