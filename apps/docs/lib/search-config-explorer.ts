import generatedSearchConfig from '@/generated/search-config-reference.json';
import generatedSearchFloatingConfig from '@/generated/search-floating-config-reference.json';
import generatedSearchStrings from '@/generated/search-strings-reference.json';
import type { ConfigExplorerData, ConfigField, ConfigFieldExample } from './config-explorer';
import type { SearchConfig, SearchFloatingConfig, SearchStrings } from 'superdoc';

type SearchGroupId = 'behavior' | 'position' | 'focus' | 'text' | 'accessibility';
type SearchPresentation = {
  group: SearchGroupId;
  default?: string;
  example: ConfigFieldExample;
};

const behaviorPresentation = {
  replaceControls: option('behavior', 'true', 'false'),
  includeTrackedDeletions: option('behavior', 'false', 'true'),
} satisfies Record<'replaceControls' | 'includeTrackedDeletions', SearchPresentation> &
  Partial<Record<keyof SearchConfig, SearchPresentation>>;

const floatingPresentation = {
  placement: option('position', "'top-right'", "'bottom-right'"),
  top: option('position', undefined, "'1rem'"),
  right: option('position', undefined, '24'),
  bottom: option('position', undefined, "'1rem'"),
  left: option('position', undefined, '24'),
  width: option('position', '420', '480'),
  maxWidth: option('position', undefined, "'calc(100vw - 2rem)'"),
  maxHeight: option('position', undefined, "'60vh'"),
  autoFocus: option('focus', 'true', 'false'),
  closeOnOutsidePointerDown: option('focus', 'false', 'true'),
} satisfies Record<keyof SearchFloatingConfig, SearchPresentation>;

const stringsPresentation = {
  findPlaceholder: textOption('text', 'Find'),
  findAriaLabel: textOption('accessibility', 'Find text'),
  replacePlaceholder: textOption('text', 'Replace'),
  replaceAriaLabel: textOption('accessibility', 'Replace text'),
  noResults: textOption('text', 'No results', 'No matches'),
  previousMatchTitle: textOption('text', 'Previous match (Shift+Enter)'),
  previousMatchAriaLabel: textOption('accessibility', 'Previous match'),
  nextMatchTitle: textOption('text', 'Next match (Enter)'),
  nextMatchAriaLabel: textOption('accessibility', 'Next match'),
  closeTitle: textOption('text', 'Close (Escape)'),
  closeAriaLabel: textOption('accessibility', 'Close find and replace'),
  replace: textOption('text', 'Replace'),
  replaceAll: textOption('text', 'All'),
  toggleReplaceTitle: textOption('text', 'Toggle replace'),
  toggleReplaceAriaLabel: textOption('accessibility', 'Toggle replace'),
  matchCase: textOption('text', 'Aa'),
  matchCaseAriaLabel: textOption('accessibility', 'Match case'),
  ignoreDiacritics: textOption('text', 'ä≡a'),
  ignoreDiacriticsAriaLabel: textOption('accessibility', 'Ignore diacritics'),
  regex: textOption('text', '.*'),
  regexAriaLabel: textOption('accessibility', 'Use regular expression'),
  invalidPattern: textOption('text', 'Invalid pattern'),
} satisfies Record<keyof SearchStrings, SearchPresentation>;

const generated = generatedSearchConfig as ConfigExplorerData;
const generatedFloating = generatedSearchFloatingConfig as ConfigExplorerData;
const generatedStrings = generatedSearchStrings as ConfigExplorerData;

const behaviorFields = Object.entries(behaviorPresentation).map(([name, presentation]) =>
  presentField(findField(generated, name), presentation),
);
const floatingFields = generatedFloating.fields.map((field) =>
  presentField(field, floatingPresentation[field.name as keyof SearchFloatingConfig], 'floating'),
);
const stringFields = generatedStrings.fields.map((field) =>
  presentField(field, stringsPresentation[field.name as keyof SearchStrings], 'strings'),
);

export const searchConfigExplorer: ConfigExplorerData = {
  id: 'search-config',
  name: 'SearchConfig',
  root: 'search',
  label: 'search configuration',
  path: ['ui', 'search'],
  copyMode: 'selected-field',
  groups: [
    { id: 'behavior', label: 'Behavior' },
    { id: 'position', label: 'Position & size', path: ['floating'] },
    { id: 'focus', label: 'Focus', path: ['floating'] },
    { id: 'text', label: 'Text', path: ['strings'] },
    { id: 'accessibility', label: 'Accessibility', path: ['strings'] },
  ],
  fields: [...behaviorFields, ...floatingFields, ...stringFields],
};

function option(group: SearchGroupId, defaultValue: string | undefined, value: string): SearchPresentation {
  return {
    group,
    default: defaultValue,
    example: { value, code: '' },
  };
}

function textOption(group: SearchGroupId, defaultValue: string, exampleValue = defaultValue): SearchPresentation {
  return option(group, quote(defaultValue), quote(exampleValue));
}

function quote(value: string) {
  return `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
}

function findField(data: ConfigExplorerData, name: string) {
  const field = data.fields.find((candidate) => candidate.name === name);
  if (!field) throw new Error(`${data.name}.${name} is missing from the generated Search reference.`);
  return field;
}

function presentField(
  field: ConfigField,
  presentation: SearchPresentation,
  prefix?: 'floating' | 'strings',
): ConfigField {
  if (!presentation) throw new Error(`${field.name} is missing its Search reference presentation.`);
  const key = field.name;
  return {
    ...field,
    name: prefix ? `${prefix}.${key}` : key,
    key,
    group: presentation.group,
    default: presentation.default,
    example: {
      ...presentation.example,
      code: `${key}: ${presentation.example.value}`,
    },
    summary: field.description,
  };
}
