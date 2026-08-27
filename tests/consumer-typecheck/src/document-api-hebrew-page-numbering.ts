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

// Keep the public read and write unions aligned so a consumer can pass a listed
// format back to setPageNumbering. Runtime adapters separately decide which
// OOXML formats sections.list exposes.
declare const readFormat: ReadPageNumberingFormat;
const roundTripped: WritePageNumberingFormat = readFormat;

// The listed-section type must also name both Hebrew formats.
const readHebrewNumeral: ReadPageNumberingFormat = 'hebrew1';
const readHebrewAlphabetic: ReadPageNumberingFormat = 'hebrew2';

void applied;
void appliedAlphabetic;
void roundTripped;
void readHebrewNumeral;
void readHebrewAlphabetic;
