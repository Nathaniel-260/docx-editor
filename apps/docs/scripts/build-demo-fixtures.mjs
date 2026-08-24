/**
 * Builds the short fixtures used by focused Editor demos:
 *
 * - `public/fixtures/formatting-sample.docx`
 * - `public/fixtures/document-modes.docx`
 * - `public/fixtures/comments-sample.docx`
 * - `public/fixtures/search-sample.docx`
 *
 * The other two fixtures are full synthetic NDAs, sized for guides that need a
 * realistic contract. These demos need the opposite: each reader has one job,
 * so every extra paragraph is something to scroll past first. The documents
 * are authored here rather than trimmed from `nda.docx` so only the relevant
 * content remains.
 *
 * The formatting and document-mode fixtures are deliberately plain. The
 * comments fixture has one short thread because that thread is the behavior the
 * page asks the reader to inspect. The search fixture is the deliberate
 * exception to the short-fixture rule: its ten pages and repeated terms let the
 * real search surface prove navigation across a document window.
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

const SEARCH_STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:color w:val="212121"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="120" w:line="300" w:lineRule="auto"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:color w:val="212121"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="0" w:after="200"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:color w:val="1F4D78"/><w:sz w:val="52"/><w:szCs w:val="52"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="360" w:after="200"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:color w:val="2E74B5"/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="280" w:after="140"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:color w:val="2E74B5"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:style>
</w:styles>`;

const escapeXml = (text) =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

const paragraph = (text) => `<w:p><w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;

const searchParagraph = (text, style = 'Normal') =>
  `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr><w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;

const pageBreak = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';

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

const SEARCH_PAGES = [
  {
    title: 'Phase 01 - Project brief',
    focus: 'Define the outcome',
    paragraphs: [
      'The Client is preparing a document workspace for its regional teams.',
      'The Client sponsor will confirm the launch outcome, audience, and operating constraints.',
      'A short client brief keeps every later decision tied to the same measurable result.',
      'The Client team will approve the brief before discovery begins.',
    ],
  },
  {
    title: 'Phase 02 - Discovery',
    focus: 'Map the current workflow',
    paragraphs: [
      'The Client will walk through how documents are created, reviewed, and approved today.',
      'The Client product lead will identify the handoffs that create the most delay.',
      'Each client interview will use the same questions so findings can be compared.',
      'The Client team will review the discovery summary before requirements are finalized.',
    ],
  },
  {
    title: 'Phase 03 - Content readiness',
    focus: 'Prepare representative files',
    paragraphs: [
      'The Client will provide representative DOCX files with tables, comments, and tracked changes.',
      'The Client engineering team will flag documents that depend on templates or custom fonts.',
      'A client-owned test set will remain the source of truth throughout implementation.',
      'The Client team will confirm which files must pass before launch.',
    ],
  },
  {
    title: 'Phase 04 - Workspace design',
    focus: 'Choose the editing experience',
    paragraphs: [
      'The Client will choose which controls SuperDoc renders and which controls the application owns.',
      'The Client design team will validate editing, suggesting, and viewing flows.',
      'Each client role will see only the controls required for its task.',
      'The Client team will approve the responsive layout before integration begins.',
    ],
  },
  {
    title: 'Phase 05 - Storage integration',
    focus: 'Connect load and save',
    paragraphs: [
      'The Client application will load DOCX bytes from its existing storage layer.',
      'The Client backend will save exported bytes and return a confirmed version identifier.',
      'The client owns authorization, storage credentials, and retention policy.',
      'The Client team will test both successful saves and recoverable failures.',
    ],
  },
  {
    title: 'Phase 06 - Review workflow',
    focus: 'Configure collaboration decisions',
    paragraphs: [
      'The Client will decide when contributors edit directly and when they suggest changes.',
      'The Client review lead will define who may resolve comments and decide tracked changes.',
      'A client review scenario will cover concurrent feedback on the same document.',
      'The Client team will confirm that exported review data carries the correct author.',
    ],
  },
  {
    title: 'Phase 07 - Acceptance testing',
    focus: 'Verify real documents',
    paragraphs: [
      'The Client will run its representative files through open, edit, save, and reopen checks.',
      'The Client quality lead will record any rendering or editing difference with the source file.',
      'Every client test will name the document, action, and expected result.',
      'The Client team will sign off only after the release criteria are met.',
    ],
  },
  {
    title: 'Phase 08 - Training',
    focus: 'Prepare people for launch',
    paragraphs: [
      'The Client will train authors, reviewers, and support staff on their specific workflows.',
      'The Client enablement lead will provide one task-based guide for each audience.',
      'Each client session will use the same files people will encounter after launch.',
      'The Client team will capture unresolved questions in the operating guide.',
    ],
  },
  {
    title: 'Phase 09 - Launch',
    focus: 'Release with observable checks',
    paragraphs: [
      'The Client will release the Editor to a small group before broader rollout.',
      'The Client operations team will watch load failures, save failures, and completion time.',
      'A client support route will collect document examples without exposing them publicly.',
      'The Client sponsor will decide when the rollout can expand.',
    ],
  },
  {
    title: 'Phase 10 - Continuous improvement',
    focus: 'Learn from production use',
    paragraphs: [
      'The Client will review usage, support themes, and document compatibility after launch.',
      'The Client product team will prioritize improvements using evidence from real workflows.',
      'Each client request will link to the document and task that produced it.',
      'The Client sponsor will review the next milestone with the implementation team.',
    ],
  },
];

const SEARCH_DOCUMENT = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
${searchParagraph('Client launch playbook', 'Title')}
${searchParagraph('A ten-phase implementation plan for a document workspace.')}
${SEARCH_PAGES.map(
  (page, index) =>
    `${index === 0 ? '' : pageBreak}${searchParagraph(page.title, 'Heading1')}${searchParagraph(page.focus, 'Heading2')}${page.paragraphs
      .map((text) => searchParagraph(text))
      .join('')}`,
).join('')}
<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`;

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

await writeDocx('search-sample.docx', [
  ['[Content_Types].xml', CONTENT_TYPES],
  ['_rels/.rels', ROOT_RELS],
  ['word/document.xml', SEARCH_DOCUMENT],
  ['word/_rels/document.xml.rels', DOCUMENT_RELS],
  ['word/styles.xml', SEARCH_STYLES],
  ['docProps/core.xml', CORE_PROPERTIES],
  ['docProps/app.xml', appProperties(SEARCH_PAGES.length * 6 + 2)],
]);
