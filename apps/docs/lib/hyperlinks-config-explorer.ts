import generatedHyperlinksConfig from '@/generated/hyperlinks-config-reference.json';
import type { ConfigExplorerData, ConfigField } from './config-explorer';
import type { HyperlinksConfig } from 'superdoc';

type HyperlinksPresentation = {
  default: string;
  example: { value: string; code: string };
  group: 'behavior';
  summary: string;
};

const presentation = {
  onActivate: {
    default: 'undefined',
    example: {
      value: "({ href }) => (href.startsWith('https://app.example.com/') ? { type: 'suppress' } : { type: 'default' })",
      code: "onActivate: ({ href }) =>\n  href.startsWith('https://app.example.com/')\n    ? { type: 'suppress' }\n    : { type: 'default' }",
    },
    group: 'behavior',
    summary: 'Choose what happens when a user activates a hyperlink.',
  },
} satisfies Record<keyof HyperlinksConfig, HyperlinksPresentation>;

const generated = generatedHyperlinksConfig as ConfigExplorerData;

export const hyperlinksConfigExplorer: ConfigExplorerData = {
  id: 'hyperlinks-config',
  name: 'HyperlinksConfig',
  root: 'hyperlinks',
  label: 'hyperlink configuration',
  path: ['hyperlinks'],
  copyMode: 'selected-field',
  groups: [{ id: 'behavior', label: 'Behavior' }],
  fields: generated.fields.map(presentField),
};

function presentField(field: ConfigField): ConfigField {
  const fieldPresentation = presentation[field.name as keyof HyperlinksConfig];
  if (!fieldPresentation) throw new Error(`${field.name} is missing its Hyperlinks reference presentation.`);
  return { ...field, ...fieldPresentation };
}
