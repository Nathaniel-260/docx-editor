export type ConfigFieldGroup = {
  id: string;
  label: string;
};

export type ConfigFieldExample = {
  value: string;
  code: string;
};

export type ConfigFieldGuide = {
  label: string;
  href: string;
};

export type ConfigField = {
  name: string;
  type: string;
  typeName?: string;
  required: boolean;
  summary?: string;
  description: string;
  default?: string;
  group: string;
  kind?: 'required-to-run' | 'starter' | 'callback' | 'reserved';
  example?: ConfigFieldExample;
  guide?: ConfigFieldGuide;
  deprecated?: boolean;
  deprecatedReplacement?: string;
  status?: string;
};

export type ConfigExplorerData = {
  id: string;
  name: string;
  root: string;
  label: string;
  groups: ConfigFieldGroup[];
  fields: ConfigField[];
  syntax?: 'nested-property' | 'typed-variable';
};

export function configTemplate(data: ConfigExplorerData) {
  const setupFields = data.fields.filter(
    (field) => field.required || field.kind === 'required-to-run' || field.kind === 'starter',
  );
  const copyableFields =
    setupFields.length > 0 ? setupFields : data.fields.filter((field) => field.kind !== 'reserved');
  const fields = copyableFields
    .map((field) => {
      const line = field.example?.code ?? `${field.name}: ${codeValue(field)}`;
      return `${indent(line, 2)},`;
    })
    .join('\n');
  return `${configOpening(data)}\n${fields}\n${configClosing(data)}`;
}

export function configOpening(data: ConfigExplorerData) {
  return data.syntax === 'typed-variable' ? `const ${data.root} = {` : `${data.root}: {`;
}

export function configClosing(data: ConfigExplorerData) {
  return data.syntax === 'typed-variable' ? `} satisfies ${data.name};` : '}';
}

export function renderConfigReferenceMarkdown(data: ConfigExplorerData) {
  const table = (fields: ConfigField[]) => {
    const rows = fields.map((field) => {
      const type = markdownCell(field.type);
      const summary = markdownCell(field.summary ?? field.description);
      const description = markdownCell(field.description);
      const status = markdownCell(configFieldStatus(field));
      const guide = field.guide ? `[${markdownCell(field.guide.label)}](${field.guide.href})` : '—';
      return `| \`${field.name}\` | \`${type}\` | ${field.default ? `\`${markdownCell(field.default)}\`` : '—'} | ${status} | ${summary} | ${description} | ${guide} |`;
    });
    return [
      '| Field | Type | Default | Status | Summary | API details | Guide |',
      '| --- | --- | --- | --- | --- | --- | --- |',
      ...rows,
    ].join('\n');
  };

  return data.groups
    .map((group) => ({ ...group, fields: data.fields.filter((field) => field.group === group.id) }))
    .filter((group) => group.fields.length > 0)
    .map((group) => `### ${group.label}\n\n${table(group.fields)}`)
    .join('\n\n')
    .concat('\n');
}

function configFieldStatus(field: ConfigField) {
  return (
    [
      field.required ? 'Required' : undefined,
      field.deprecated
        ? `Deprecated${field.deprecatedReplacement ? `. Use \`${field.deprecatedReplacement}\` instead` : ''}`
        : undefined,
      field.status,
    ]
      .filter((value): value is string => Boolean(value))
      .join('. ') || 'Optional'
  );
}

function markdownCell(value: string) {
  return value.replace(/\s+/gu, ' ').trim().replaceAll('|', '\\|');
}

export function codeValue(field: ConfigField) {
  if (field.kind === 'reserved') return '/* reserved */';
  return field.example?.value ?? `/* ${field.type} */`;
}

function indent(value: string, spaces: number) {
  const prefix = ' '.repeat(spaces);
  return value
    .split('\n')
    .map((line) => `${prefix}${line}`)
    .join('\n');
}
