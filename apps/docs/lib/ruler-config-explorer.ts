import generatedEditorConfig from '@/generated/ruler-editor-config-reference.json';
import generatedUiConfig from '@/generated/ruler-ui-config-reference.json';
import type { ConfigExplorerData, ConfigField, ConfigFieldExample } from './config-explorer';
import type { Config, UIConfig } from 'superdoc';

type RulerField = Extract<keyof UIConfig, 'ruler'> | Extract<keyof Config, 'measurementUnit' | 'onPageMarginsChange'>;
type RulerGroupId = 'ruler' | 'measurements' | 'events';
type RulerPresentation = {
  default?: string;
  example: ConfigFieldExample;
  group: RulerGroupId;
  summary: string;
};

const presentation = {
  ruler: {
    default: 'false',
    example: { value: 'true', code: 'ruler: true' },
    group: 'ruler',
    summary: 'Show the horizontal ruler, or provide a container for an external mount.',
  },
  measurementUnit: {
    default: "'in'",
    example: { value: "'cm'", code: "measurementUnit: 'cm'" },
    group: 'measurements',
    summary: 'Display measurements across this Editor in inches or centimeters.',
  },
  onPageMarginsChange: {
    example: {
      value: '({ side, value }) => console.log(side, value)',
      code: 'onPageMarginsChange: ({ side, value }) => console.log(side, value)',
    },
    group: 'events',
    summary: 'Run application code after a ruler drag changes a section margin.',
  },
} satisfies Record<RulerField, RulerPresentation>;

const generatedUi = generatedUiConfig as ConfigExplorerData;
const generatedEditor = generatedEditorConfig as ConfigExplorerData;
const fieldOrder = ['ruler', 'measurementUnit', 'onPageMarginsChange'] satisfies readonly RulerField[];

export const rulerConfigExplorer: ConfigExplorerData = {
  id: 'ruler-config',
  name: 'Ruler',
  sources: ['UIConfig', 'Config'],
  root: 'config',
  label: 'ruler configuration',
  path: [],
  copyMode: 'selected-field',
  groups: [
    { id: 'ruler', label: 'Ruler', path: ['ui'] },
    { id: 'measurements', label: 'Measurements' },
    { id: 'events', label: 'Events' },
  ],
  fields: [...generatedUi.fields, ...generatedEditor.fields]
    .sort((left, right) => fieldOrder.indexOf(left.name as RulerField) - fieldOrder.indexOf(right.name as RulerField))
    .map(presentField),
};

function presentField(field: ConfigField): ConfigField {
  const fieldPresentation: RulerPresentation | undefined = presentation[field.name as RulerField];
  if (!fieldPresentation) throw new Error(`${field.name} is missing its Ruler reference presentation.`);
  return {
    ...field,
    name: field.name === 'ruler' ? 'ui.ruler' : field.name,
    key: field.name,
    default: fieldPresentation.default,
    example: fieldPresentation.example,
    group: fieldPresentation.group,
    summary: fieldPresentation.summary,
  };
}
