export const contentControlPatterns = [
  {
    id: 'inline',
    label: 'Inline',
    wraps: 'Part of a paragraph',
    use: 'Repeated values and typed inputs',
  },
  {
    id: 'block',
    label: 'Block-level',
    wraps: 'Paragraphs or tables',
    use: 'Clause slots and document sections',
  },
  {
    id: 'repeating',
    label: 'Repeating section',
    wraps: 'A collection of items',
    use: 'Line items and repeated records',
  },
] as const;

export function renderContentControlPatternsMarkdown() {
  const rows = contentControlPatterns.map(({ label, use, wraps }) => `| ${label} | ${wraps} | ${use} |`);

  return ['**Content-control shapes**', '', '| Shape | Wraps | Common use |', '| --- | --- | --- |', ...rows, ''].join(
    '\n',
  );
}
