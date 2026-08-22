export type ToolbarStrategyId = 'default' | 'groups' | 'excludeItems';

export type ToolbarStrategyInlinePart = { kind: 'text'; value: string } | { kind: 'code'; value: string };

type ToolbarDiagramItemId =
  | 'undo'
  | 'redo'
  | 'fontFamily'
  | 'fontSize'
  | 'bold'
  | 'italic'
  | 'underline'
  | 'link'
  | 'image'
  | 'table'
  | 'zoom'
  | 'documentMode'
  | 'overflow';

export type ToolbarDiagramItem = {
  kind: 'item';
  id: ToolbarDiagramItemId;
  label: string;
};

export type ToolbarDiagramPart =
  | ToolbarDiagramItem
  | { kind: 'separator' }
  | { kind: 'spacer' }
  | { kind: 'removed'; items: readonly ToolbarDiagramItem[] };

export type ToolbarDiagramGroup = {
  id: 'left' | 'center' | 'right';
  items: readonly ToolbarDiagramItem[];
};

export type ToolbarConfigStrategy = {
  id: ToolbarStrategyId;
  label: string;
  markdownTitle: string;
  code: string;
  summary: string;
  description: readonly ToolbarStrategyInlinePart[];
  visualDescription: string;
  diagram:
    | { kind: 'strip'; parts: readonly ToolbarDiagramPart[] }
    | { kind: 'groups'; groups: readonly ToolbarDiagramGroup[] };
};

const labels = {
  undo: '↶',
  redo: '↷',
  fontFamily: 'Arial ▾',
  fontSize: '12 ▾',
  bold: 'B',
  italic: 'I',
  underline: 'U',
  link: 'link',
  image: 'image',
  table: 'table',
  zoom: '100% ▾',
  documentMode: 'Mode ▾',
  overflow: '…',
} as const satisfies Record<ToolbarDiagramItemId, string>;

function item(id: ToolbarDiagramItemId): ToolbarDiagramItem {
  return { kind: 'item', id, label: labels[id] };
}

const separator = { kind: 'separator' } as const;
const spacer = { kind: 'spacer' } as const;

const defaultStart = [
  item('undo'),
  item('redo'),
  separator,
  item('zoom'),
  item('fontFamily'),
  item('fontSize'),
  separator,
  item('bold'),
  item('italic'),
  item('underline'),
  separator,
  item('link'),
] as const;

const defaultEnd = [spacer, item('overflow'), item('documentMode')] as const;

const focusedGroups = {
  left: ['undo', 'redo'],
  center: ['bold', 'italic', 'underline', 'link'],
  right: ['documentMode', 'zoom', 'overflow'],
} as const;

const excludedItems = ['image', 'table'] as const;

function quoteList(values: readonly string[]) {
  return values.map((value) => `'${value}'`).join(', ');
}

const groupedCode = `ui: {
  toolbar: {
    groups: {
      left: [${quoteList(focusedGroups.left)}],
      center: [${quoteList(focusedGroups.center)}],
      right: [${quoteList(focusedGroups.right)}],
    },
  },
}`;

const excludedCode = `ui: {
  toolbar: {
    excludeItems: [${quoteList(excludedItems)}],
  },
}`;

export const toolbarConfigStrategies = [
  {
    id: 'default',
    label: 'default',
    markdownTitle: 'Default',
    code: 'ui: { toolbar: {} }',
    summary: 'The default toolbar.',
    description: [
      {
        kind: 'text',
        value:
          'Visible controls depend on width, role, file type, and enabled features. Lower-priority controls collect in the overflow menu.',
      },
    ],
    visualDescription:
      'Schematic default toolbar with history, zoom, font, formatting, insert, overflow, and document mode controls.',
    diagram: {
      kind: 'strip',
      parts: [...defaultStart, item('image'), item('table'), ...defaultEnd],
    },
  },
  {
    id: 'groups',
    label: 'groups',
    markdownTitle: 'Grouped allowlist',
    code: groupedCode,
    summary: 'A grouped allowlist.',
    description: [
      { kind: 'text', value: 'Only named built-in items render. The keys ' },
      { kind: 'code', value: 'left' },
      { kind: 'text', value: ', ' },
      { kind: 'code', value: 'center' },
      { kind: 'text', value: ', and ' },
      { kind: 'code', value: 'right' },
      {
        kind: 'text',
        value:
          ' choose their regions. Items keep the built-in order; array order does not reorder them. Custom buttons still render when their configured or default group is present.',
      },
    ],
    visualDescription:
      'Schematic focused toolbar with Undo and Redo on the left; Bold, Italic, Underline, and Link in the center; and Zoom, overflow, then Document mode on the right.',
    diagram: {
      kind: 'groups',
      groups: [
        { id: 'left', items: [item('undo'), item('redo')] },
        { id: 'center', items: [item('bold'), item('italic'), item('underline'), item('link')] },
        // `groups` chooses membership and region, not item order. The runtime
        // keeps the built-in order, where zoom and overflow precede document mode.
        { id: 'right', items: [item('zoom'), item('overflow'), item('documentMode')] },
      ],
    },
  },
  {
    id: 'excludeItems',
    label: 'excludeItems',
    markdownTitle: 'Subtract from the default',
    code: excludedCode,
    summary: 'The full-width default row, minus what you name.',
    description: [
      {
        kind: 'text',
        value:
          'Use it when the default toolbar already fits and one or two controls do not belong in the full-width row. The current runtime does not apply exclusions after matching controls move into overflow, so use groups when a control must stay hidden at every width.',
      },
    ],
    visualDescription:
      'Schematic full-width default toolbar with Image and Table crossed out to show that excludeItems removes them from the row.',
    diagram: {
      kind: 'strip',
      parts: [...defaultStart, { kind: 'removed', items: excludedItems.map(item) }, ...defaultEnd],
    },
  },
] as const satisfies readonly ToolbarConfigStrategy[];

function renderInlineMarkdown(parts: readonly ToolbarStrategyInlinePart[]) {
  return parts.map((part) => (part.kind === 'code' ? `\`${part.value}\`` : part.value)).join('');
}

export function renderToolbarConfigStrategiesMarkdown() {
  return [
    '**Toolbar configuration strategies**',
    '',
    ...toolbarConfigStrategies.flatMap((strategy) => [
      `### ${strategy.markdownTitle}`,
      '',
      '```ts',
      strategy.code,
      '```',
      '',
      `**${strategy.summary}** ${renderInlineMarkdown(strategy.description)}`,
      '',
    ]),
  ].join('\n');
}
