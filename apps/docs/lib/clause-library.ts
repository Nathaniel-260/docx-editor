export const clauseLibraryTag = 'agreement.confidentiality';

export const clauseLibraryOptions = [
  {
    id: 'mutual',
    label: 'Mutual',
    content:
      "Each party must protect the other party's confidential information and use it only to perform this agreement.",
  },
  {
    id: 'recipient-only',
    label: 'Recipient only',
    content:
      "The receiving party must protect the disclosing party's confidential information and use it only to perform this agreement.",
  },
  {
    id: 'limited-use',
    label: 'Limited use',
    content:
      'The recipient may use confidential information only to evaluate and perform the services described in this agreement.',
  },
] as const;

export type ClauseLibraryOptionId = (typeof clauseLibraryOptions)[number]['id'];

export function renderClauseLibraryMarkdown() {
  return [
    '> **Interactive editor: Choose a confidentiality clause**',
    '>',
    `> The DOCX contains one block-level content control tagged \`${clauseLibraryTag}\`.`,
    '>',
    ...clauseLibraryOptions.map(({ content, label }) => `> - **${label}:** ${content}`),
    '>',
    '> Choosing an option replaces the paragraph inside the control. Reset restores the original clause.',
    '',
  ].join('\n');
}
