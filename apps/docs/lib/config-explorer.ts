export type ConfigFieldGroup = {
  id: string;
  label: string;
};

export type ConfigFieldExample = {
  value: string;
  code: string;
};

export type ConfigField = {
  name: string;
  type: string;
  typeName?: string;
  required: boolean;
  description: string;
  default?: string;
  group: string;
  kind?: 'required-to-run' | 'callback' | 'reserved';
  example?: ConfigFieldExample;
};

export type ConfigExplorerData = {
  id: string;
  name: string;
  root: string;
  label: string;
  groups: ConfigFieldGroup[];
  fields: ConfigField[];
};

export function configTemplate(data: ConfigExplorerData) {
  const setupFields = data.fields.filter((field) => field.required || field.kind === 'required-to-run');
  const copyableFields =
    setupFields.length > 0 ? setupFields : data.fields.filter((field) => field.kind !== 'reserved');
  const fields = copyableFields
    .map((field) => {
      const line = field.example?.code ?? `${field.name}: ${codeValue(field)}`;
      return `${indent(line, 2)},`;
    })
    .join('\n');
  return `${data.root}: {\n${fields}\n}`;
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
