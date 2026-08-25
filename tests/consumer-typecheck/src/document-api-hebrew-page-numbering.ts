import type { DocumentApi } from 'superdoc/ui';

declare const doc: DocumentApi;

// Both Hebrew formats have to be assignable from outside the package.
const hebrewNumeral: Parameters<DocumentApi['sections']['setPageNumbering']>[0] = {
  target: { kind: 'section', sectionId: 'section-1' },
  format: 'hebrew1',
  start: 1,
};

const hebrewAlphabetic: Parameters<DocumentApi['sections']['setPageNumbering']>[0] = {
  target: { kind: 'section', sectionId: 'section-1' },
  format: 'hebrew2',
};

const applied: ReturnType<DocumentApi['sections']['setPageNumbering']> = doc.sections.setPageNumbering(hebrewNumeral);
const appliedAlphabetic: ReturnType<DocumentApi['sections']['setPageNumbering']> =
  doc.sections.setPageNumbering(hebrewAlphabetic);

type ListedSection = Awaited<ReturnType<DocumentApi['sections']['list']>>['items'][number];
type ReadPageNumberingFormat = NonNullable<NonNullable<ListedSection['pageNumbering']>['format']>;
type WritePageNumberingFormat = NonNullable<Parameters<DocumentApi['sections']['setPageNumbering']>[0]['format']>;

// The read side reports whatever w:pgNumType/@w:fmt the document carries, so a
// consumer that reads a section and writes it back needs the write union to
// accept every value the read union can produce. This assignment is what fails
// if the two drift apart again.
declare const readFormat: ReadPageNumberingFormat;
const roundTripped: WritePageNumberingFormat = readFormat;

// And the read side has to name the Hebrew formats, not just tolerate them.
const readHebrewNumeral: ReadPageNumberingFormat = 'hebrew1';
const readHebrewAlphabetic: ReadPageNumberingFormat = 'hebrew2';

void applied;
void appliedAlphabetic;
void roundTripped;
void readHebrewNumeral;
void readHebrewAlphabetic;
