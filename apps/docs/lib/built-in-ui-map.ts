export type BuiltInUiSurfaceId =
  | 'toolbar'
  | 'comments'
  | 'search'
  | 'hyperlinks'
  | 'context-menu'
  | 'structured'
  | 'layout';

export type BuiltInUiInlinePart = { kind: 'text'; value: string } | { kind: 'code'; value: string };

export type BuiltInUiSurface = {
  id: BuiltInUiSurfaceId;
  slug: string;
  label: string;
  href: string;
  initialBehavior: readonly BuiltInUiInlinePart[];
  description: string;
};

export const builtInUiSurfaces = [
  {
    id: 'toolbar',
    slug: 'configure-the-toolbar',
    label: 'Toolbar',
    href: '/editor/built-in-ui/configure-the-toolbar',
    initialBehavior: [
      { kind: 'text', value: "React's " },
      { kind: 'code', value: 'SuperDocEditor' },
      { kind: 'text', value: ' creates a toolbar container. A Vanilla integration provides one.' },
    ],
    description: 'Formatting commands reflect the document, selection, and mode. Controls adapt when space is tight.',
  },
  {
    id: 'comments',
    slug: 'comments',
    label: 'Comments',
    href: '/editor/built-in-ui/comments',
    initialBehavior: [
      { kind: 'text', value: 'The comments UI is enabled by default. In viewing mode, show comments with ' },
      { kind: 'code', value: 'viewing.comments: true' },
      { kind: 'text', value: '.' },
    ],
    description: 'Word comment threads import with the DOCX. People can create, reply to, and resolve them.',
  },
  {
    id: 'search',
    slug: 'search-and-replace',
    label: 'Search',
    href: '/editor/built-in-ui/search-and-replace',
    initialBehavior: [
      { kind: 'text', value: 'Off until ' },
      { kind: 'code', value: 'ui: { search: true }' },
      { kind: 'text', value: '. Without it, the browser keeps its native find shortcut.' },
    ],
    description: 'Find and replace document text, then move between matches across paginated pages.',
  },
  {
    id: 'hyperlinks',
    slug: 'hyperlinks',
    label: 'Hyperlinks',
    href: '/editor/built-in-ui/hyperlinks',
    initialBehavior: [{ kind: 'text', value: 'Edit in Editing or Suggesting mode. Navigate in Viewing mode.' }],
    description: 'Keep the mode-aware behavior, suppress activation, or render a custom action.',
  },
  {
    id: 'context-menu',
    slug: 'context-menus',
    label: 'Context menu',
    href: '/editor/built-in-ui/context-menus',
    initialBehavior: [{ kind: 'text', value: 'SuperDoc shows document-aware actions on right-click.' }],
    description: 'Keep the built-in menu, add application actions, or render the complete menu yourself.',
  },
  {
    id: 'structured',
    slug: 'structured-content',
    label: 'Structured content',
    href: '/editor/built-in-ui/structured-content',
    initialBehavior: [
      {
        kind: 'text',
        value: 'Content-control chrome is enabled by default. Toolbar actions depend on your toolbar configuration.',
      },
    ],
    description: 'Work with tables, images, links, and content controls through document-aware controls.',
  },
  {
    id: 'layout',
    slug: 'responsive-layout',
    label: 'Layout',
    href: '/editor/built-in-ui/responsive-layout',
    initialBehavior: [
      { kind: 'text', value: 'The toolbar responds to viewport width by default. Use ' },
      { kind: 'code', value: 'responsiveToContainer: true' },
      { kind: 'text', value: ' to measure its mount instead.' },
    ],
    description: 'Fit the document to its container, adapt built-in chrome, and refit after fullscreen changes.',
  },
] as const satisfies readonly BuiltInUiSurface[];

export function isBuiltInUiSurfaceId(value: string): value is BuiltInUiSurfaceId {
  return builtInUiSurfaces.some((surface) => surface.id === value);
}

function renderInlineMarkdown(parts: readonly BuiltInUiInlinePart[]) {
  return parts.map((part) => (part.kind === 'code' ? `\`${part.value}\`` : part.value)).join('');
}

export function renderBuiltInUiMapMarkdown() {
  const surfaces = builtInUiSurfaces.map(
    (surface) =>
      `- **[${surface.label}](${surface.href})** — ${surface.description} Initial behavior: ${renderInlineMarkdown(surface.initialBehavior)}`,
  );

  return [
    '> **Interactive map: built-in Editor surfaces**',
    '>',
    ...surfaces.map((surface) => `> ${surface}`),
    '>',
    '> Tracked changes appear as marks in the document. See [Track changes](/editor/track-changes) to review them.',
    '',
  ].join('\n');
}
