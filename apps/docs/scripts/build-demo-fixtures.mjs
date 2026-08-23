/**
 * Builds the short fixtures used by focused Editor demos:
 *
 * - `public/fixtures/formatting-sample.docx`
 * - `public/fixtures/document-modes.docx`
 * - `public/fixtures/comments-sample.docx`
 *
 * The other two fixtures are full synthetic NDAs, sized for guides that need a
 * realistic contract. These demos need the opposite: each reader has one job,
 * so every extra paragraph is something to scroll past first. The documents
 * are authored here rather than trimmed from `nda.docx` so only the relevant
 * content remains.
 *
 * The formatting and document-mode fixtures are deliberately plain. The
 * comments fixture has one short thread because that thread is the behavior the
 * page asks the reader to inspect.
 *
 * Written as a minimal OOXML package rather than through a library so the bytes
 * are stable: no timestamps, no generated ids, no zip metadata that changes
 * between runs. Regenerating produces no git diff.
 *
 * Run: node scripts/build-demo-fixtures.mjs
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(HERE, '../public/fixtures');

const PLAIN_FIXTURES = [
  {
    fileName: 'formatting-sample.docx',
    paragraphs: [
      'Select this sentence and press the Bold button above.',
      'The button is part of this documentation page, not part of SuperDoc. It reads whether it can run from the editor, and runs through it.',
      'Everything else here — the page, the text, the selection you just made — is SuperDoc rendering a real DOCX file.',
    ],
  },
  {
    fileName: 'document-modes.docx',
    paragraphs: ['Notice period', 'Either party may end this agreement by giving 30 days’ written notice.'],
  },
];

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;

const COMMENT_CONTENT_TYPES = CONTENT_TYPES.replace(
  '</Types>',
  '<Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/></Types>',
);

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;

const DOCUMENT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;

const COMMENT_DOCUMENT_RELS = DOCUMENT_RELS.replace(
  '</Relationships>',
  '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/></Relationships>',
);

/**
 * Word's defaults only, at 16pt rather than the usual 11pt.
 *
 * The embed scales the page to fit its container width, so a normal body size
 * renders small and reads as a zoomed-out document. Authoring larger means the
 * fitted result looks like text someone would actually work with.
 */
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="259" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style></w:styles>`;

const paragraph = (text) => `<w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;

/**
 * A short page, not US Letter.
 *
 * Three paragraphs on an 11in page is mostly blank paper, and the embed would
 * either scroll through it or shrink the text to fit its height. At 4.5in the
 * whole document is visible at once, so the frame needs no scrollbars and the
 * reader sees the sentence they are asked to select without moving anything.
 *
 * The width stays 8.5in so the fitted zoom is computed from a familiar page
 * width; margins are tightened to give the text more of it.
 */
const documentXml = (paragraphs) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs
  .map(paragraph)
  .join('')}<w:sectPr><w:pgSz w:w="12240" w:h="6480"/><w:pgMar w:top="720" w:right="1080" w:bottom="720" w:left="1080" w:header="360" w:footer="360" w:gutter="0"/></w:sectPr></w:body></w:document>`;

const COMMENTS_DOCUMENT = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Project schedule</w:t></w:r></w:p><w:p><w:r><w:t xml:space="preserve">The final delivery date is </w:t></w:r><w:commentRangeStart w:id="0"/><w:r><w:t>September 30, 2026</w:t></w:r><w:commentRangeEnd w:id="0"/><w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr><w:commentReference w:id="0"/></w:r><w:r><w:t>.</w:t></w:r></w:p><w:p><w:r><w:t>Select another phrase to start a new thread.</w:t></w:r></w:p><w:sectPr><w:pgSz w:w="12240" w:h="6480"/><w:pgMar w:top="720" w:right="1080" w:bottom="720" w:left="1080" w:header="360" w:footer="360" w:gutter="0"/></w:sectPr></w:body></w:document>`;

const COMMENTS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:comment w:id="0" w:author="SuperDoc Test User" w:initials="ST" w:date="2025-01-15T00:00:00Z"><w:p><w:r><w:t>Does this match the signed schedule?</w:t></w:r></w:p></w:comment></w:comments>`;

/**
 * Every core property stays empty, including title and description.
 *
 * `scripts/check-docx-privacy.mjs` scans every tracked DOCX in the repo and
 * treats any populated core property as metadata to review, not just author
 * fields — a title travels with the file if someone downloads it. The other
 * docs fixtures are sanitized the same way; what the document is for belongs in
 * `public/fixtures/README.md`, which is not shipped inside the DOCX.
 */
const CORE_PROPERTIES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title></dc:title><dc:subject></dc:subject><dc:creator></dc:creator><cp:keywords></cp:keywords><dc:description></dc:description><cp:lastModifiedBy></cp:lastModifiedBy><cp:revision>1</cp:revision><dcterms:created xsi:type="dcterms:W3CDTF">2025-01-15T00:00:00Z</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">2025-01-15T00:00:00Z</dcterms:modified><cp:category></cp:category></cp:coreProperties>`;

const appProperties = (paragraphCount) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>SuperDoc</Application><Company></Company><Manager></Manager><Template></Template><Paragraphs>${paragraphCount}</Paragraphs></Properties>`;

async function writeDocx(fileName, parts) {
  const zip = new JSZip();
  for (const [name, content] of parts) {
    // A fixed date keeps the archive byte-stable across runs.
    zip.file(name, content, { createFolders: false, date: new Date('2025-01-15T00:00:00Z') });
  }

  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });

  const out = path.join(FIXTURES_DIR, fileName);
  await writeFile(out, buffer);
  console.log(`Wrote ${path.relative(process.cwd(), out)} (${buffer.length} bytes).`);
}

for (const fixture of PLAIN_FIXTURES) {
  await writeDocx(fixture.fileName, [
    ['[Content_Types].xml', CONTENT_TYPES],
    ['_rels/.rels', ROOT_RELS],
    ['word/document.xml', documentXml(fixture.paragraphs)],
    ['word/_rels/document.xml.rels', DOCUMENT_RELS],
    ['word/styles.xml', STYLES],
    ['docProps/core.xml', CORE_PROPERTIES],
    ['docProps/app.xml', appProperties(fixture.paragraphs.length)],
  ]);
}

await writeDocx('comments-sample.docx', [
  ['[Content_Types].xml', COMMENT_CONTENT_TYPES],
  ['_rels/.rels', ROOT_RELS],
  ['word/document.xml', COMMENTS_DOCUMENT],
  ['word/_rels/document.xml.rels', COMMENT_DOCUMENT_RELS],
  ['word/styles.xml', STYLES],
  ['word/comments.xml', COMMENTS_XML],
  ['docProps/core.xml', CORE_PROPERTIES],
  ['docProps/app.xml', appProperties(3)],
]);
