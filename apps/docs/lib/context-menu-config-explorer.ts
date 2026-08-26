import generatedContextMenuConfig from '@/generated/context-menu-config-reference.json';
import type { ConfigExplorerData, ConfigField, ConfigFieldExample } from './config-explorer';
import type { ContextMenuConfig } from 'superdoc';

type CanonicalContextMenuField = Exclude<keyof ContextMenuConfig, 'customItems' | 'includeDefaultItems'>;
type ContextMenuGroupId = 'opening' | 'items' | 'advanced';
type ContextMenuPresentation = {
  default: string;
  example: ConfigFieldExample;
  group: ContextMenuGroupId;
  summary: string;
};

const presentation = {
  openOnSlash: option(
    'opening',
    'true',
    'false',
    'Choose whether typing `/` after whitespace opens the built-in menu.',
  ),
  sections: option(
    'items',
    'undefined',
    "[{ id: 'application-actions', items: [{ id: 'archive', label: 'Archive', onSelect: () => console.log('Archive') }] }]",
    'Append application actions or merge them into a section with the same ID.',
    "sections: [\n  {\n    id: 'application-actions',\n    items: [\n      {\n        id: 'archive',\n        label: 'Archive',\n        onSelect: () => console.log('Archive'),\n      },\n    ],\n  },\n]",
  ),
  defaultItems: option(
    'items',
    'true',
    'false',
    "Choose whether SuperDoc's built-in actions appear with your sections.",
  ),
  menuProvider: option(
    'advanced',
    'undefined',
    '(_context, sections) => sections.map((section) => ({ ...section, items: section.items.filter((item) => !item.disabled) }))',
    'Filter or reorder the resolved sections before the menu renders.',
    'menuProvider: (_context, sections) =>\n  sections.map((section) => ({\n    ...section,\n    items: section.items.filter((item) => !item.disabled),\n  }))',
  ),
} satisfies Record<CanonicalContextMenuField, ContextMenuPresentation>;

const generated = generatedContextMenuConfig as ConfigExplorerData;

export const contextMenuConfigExplorer: ConfigExplorerData = {
  id: 'context-menu-config',
  name: 'ContextMenuConfig',
  root: 'contextMenu',
  label: 'context menu configuration',
  path: ['ui', 'contextMenu'],
  copyMode: 'selected-field',
  groups: [
    { id: 'opening', label: 'Opening' },
    { id: 'items', label: 'Items' },
    { id: 'advanced', label: 'Advanced' },
  ],
  fields: generated.fields.map(presentField),
};

function option(
  group: ContextMenuGroupId,
  defaultValue: string,
  value: string,
  summary: string,
  code?: string,
): ContextMenuPresentation {
  return {
    group,
    default: defaultValue,
    example: { value, code: code ?? '' },
    summary,
  };
}

function presentField(field: ConfigField): ConfigField {
  const fieldPresentation = presentation[field.name as CanonicalContextMenuField];
  if (!fieldPresentation) throw new Error(`${field.name} is missing its Context menu reference presentation.`);
  return {
    ...field,
    ...fieldPresentation,
    example: {
      ...fieldPresentation.example,
      code: fieldPresentation.example.code || `${field.name}: ${fieldPresentation.example.value}`,
    },
  };
}
