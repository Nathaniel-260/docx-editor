import generatedToolbarConfig from '@/generated/toolbar-config-reference.json';
import type { ConfigExplorerData, ConfigField, ConfigFieldExample } from './config-explorer';
import type { ToolbarConfig } from 'superdoc';

type DeprecatedToolbarField =
  | 'groups'
  | 'texts'
  | 'hideButtons'
  | 'responsiveToContainer'
  | 'fonts'
  | 'customButtons'
  | 'showFormattingMarksButton'
  | 'showTableOfContentsButton';
type ToolbarField = Exclude<keyof ToolbarConfig, DeprecatedToolbarField>;
type ToolbarGroupId = 'controls' | 'layout' | 'appearance';
type ToolbarPresentation = {
  group: ToolbarGroupId;
  summary: string;
  default?: string;
  example: ConfigFieldExample;
};

const presentation = {
  items: option(
    'controls',
    'Show only these built-in controls, grouped by toolbar region.',
    "{ left: ['undo', 'redo'], center: ['bold', 'italic'], right: ['document-mode'] }",
  ),
  excludeItems: option('controls', 'Remove built-in or custom controls from the toolbar.', "['bold', 'italic']"),
  includeItems: option('controls', 'Add optional built-in controls to the toolbar.', "['formatting-marks']"),
  customItems: option(
    'controls',
    'Add application buttons, dropdowns, or separators.',
    "[{ id: 'strong', type: 'button', label: 'Strong', command: 'bold' }]",
  ),
  container: option(
    'layout',
    "Choose an app-owned element that receives the toolbar. Leave this unset to let React's SuperDocEditor create its internal mount.",
    "'#toolbar'",
  ),
  overflow: option('layout', 'Move controls that do not fit into a menu, or keep them visible.', "'visible'", "'menu'"),
  responsiveTo: option(
    'layout',
    'Measure available width from the toolbar container or the viewport.',
    "'container'",
    "'viewport'",
  ),
  fontOptions: option(
    'appearance',
    'Choose the font families listed in the toolbar dropdown.',
    "[{ value: 'Arial', label: 'Arial' }, { value: 'Georgia', label: 'Georgia' }]",
  ),
  icons: option(
    'appearance',
    'Replace built-in toolbar icons with trusted inline SVG markup.',
    `{ bold: '<svg viewBox="0 0 24 24"><path d="M7 5h6v14H7z"/></svg>' }`,
  ),
  strings: option('appearance', 'Replace built-in toolbar labels and tooltips.', "{ bold: 'Strong' }"),
} satisfies Record<ToolbarField, ToolbarPresentation>;

const generated = generatedToolbarConfig as ConfigExplorerData;

export const toolbarConfigExplorer: ConfigExplorerData = {
  id: 'toolbar-config',
  name: 'ToolbarConfig',
  root: 'toolbar',
  label: 'toolbar configuration',
  path: ['ui', 'toolbar'],
  copyMode: 'selected-field',
  groups: [
    { id: 'controls', label: 'Controls' },
    { id: 'layout', label: 'Layout' },
    { id: 'appearance', label: 'Appearance' },
  ],
  fields: generated.fields.map(presentField),
};

function option(group: ToolbarGroupId, summary: string, value: string, defaultValue?: string): ToolbarPresentation {
  return {
    group,
    summary,
    default: defaultValue,
    example: { value, code: '' },
  };
}

function presentField(field: ConfigField): ConfigField {
  const fieldPresentation = presentation[field.name as ToolbarField];
  if (!fieldPresentation) throw new Error(`${field.name} is missing its Toolbar reference presentation.`);
  return {
    ...field,
    group: fieldPresentation.group,
    summary: fieldPresentation.summary,
    default: fieldPresentation.default,
    example: {
      ...fieldPresentation.example,
      code: `${field.name}: ${fieldPresentation.example.value}`,
    },
  };
}
