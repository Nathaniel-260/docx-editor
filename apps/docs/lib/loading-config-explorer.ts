import generatedLoadingConfig from '@/generated/loading-config-reference.json';
import type { ConfigExplorerData, ConfigField, ConfigFieldExample } from './config-explorer';
import type { UIConfig } from 'superdoc';

type LoadingField = Extract<keyof UIConfig, 'loading'>;
type LoadingPresentation = {
  default: string;
  example: ConfigFieldExample;
  group: 'overlay';
  summary: string;
};

const presentation = {
  loading: {
    default: 'true',
    example: { value: 'false', code: 'loading: false' },
    group: 'overlay',
    summary: 'Choose whether SuperDoc renders the document loading overlay.',
  },
} satisfies Record<LoadingField, LoadingPresentation>;

const generated = generatedLoadingConfig as ConfigExplorerData;

export const loadingConfigExplorer: ConfigExplorerData = {
  id: 'loading-config',
  name: 'UIConfig',
  root: 'ui',
  label: 'loading UI configuration',
  path: ['ui'],
  copyMode: 'selected-field',
  groups: [{ id: 'overlay', label: 'Overlay' }],
  fields: generated.fields.map(presentField),
};

function presentField(field: ConfigField): ConfigField {
  const fieldPresentation = presentation[field.name as LoadingField];
  if (!fieldPresentation) throw new Error(`${field.name} is missing its Loading reference presentation.`);
  return { ...field, ...fieldPresentation };
}
