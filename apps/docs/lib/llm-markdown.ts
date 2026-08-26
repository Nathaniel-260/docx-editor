import { renderPlaceholder } from 'fumadocs-core/mdx-plugins/remark-llms.runtime';
import {
  renderReferenceLandingMarkdown,
  renderReferenceNamespaceMarkdown,
  renderReferenceOperationMarkdown,
} from './document-api-reference/markdown';
import { renderConfigReferenceMarkdown } from './config-explorer';
import { renderBuiltInUiMapMarkdown } from './built-in-ui-map';
import { renderBuiltInEditorDemoMarkdown } from './built-in-editor-demos';
import { renderLifecycleJourneyMarkdown } from './lifecycle-journey';
import { editorConfigExplorer } from './editor-config-explorer';
import { proofingConfigExplorer } from './proofing-config-explorer';
import { searchConfigExplorer } from './search-config-explorer';

export const llmPlaceholderComponents = [
  'Callout',
  'BuiltInUiMap',
  'Card',
  'Cards',
  'CommandStateDemo',
  'ConfigReference',
  'CustomBoldDemo',
  'CustomUiArchitecture',
  'DocumentPreview',
  'DocumentApiNamespace',
  'DocumentApiOperation',
  'DocumentApiReferenceLanding',
  'EditorDemo',
  'FileDownload',
  'FrameworkExample',
  'FrameworkExampleTabs',
  'InterfaceOwnership',
  'LifecycleJourney',
  'MigrationAgentPrompt',
  'MigrationExplorer',
  'ProofingConfigReference',
  'ReceiptBar',
  'RuntimeExample',
  'RuntimeExampleTabs',
  'SearchConfigReference',
  'MigrationExample',
  'MigrationExampleTabs',
  'img',
] as const;

type PlaceholderAttributes = Record<string, unknown>;

function textAttribute(attributes: PlaceholderAttributes, name: string) {
  const value = attributes[name];
  return typeof value === 'string' ? value : undefined;
}

function booleanAttribute(attributes: PlaceholderAttributes, name: string) {
  if (!(name in attributes)) return false;
  const value = attributes[name];
  return value === null || value === true || value === 'true';
}

function quoteMarkdown(content: string) {
  return content
    .trim()
    .split('\n')
    .map((line) => (line ? `> ${line}` : '>'))
    .join('\n');
}

/**
 * Strips MDX comments from agent-facing Markdown.
 *
 * AIDEV-NOTE: `{/* ... *\/}` is a note to whoever edits the page — a "generated,
 * do not hand-edit" banner, a recorded media decision. It is meaningless to an
 * agent reading `/md/...` or `llms-full.txt`, and it leaks MDX syntax into a
 * surface that should be plain Markdown. Stripped here rather than at each
 * call site so every page benefits, including generated ones.
 */
function stripMdxComments(markdown: string) {
  return markdown.replace(/^[ \t]*\{\/\*[\s\S]*?\*\/\}[ \t]*\r?\n/gm, '');
}

export function renderLLMMarkdown(markdown: string) {
  return renderPlaceholder(stripMdxComments(markdown), {
    Callout({ attributes, children }) {
      const title = textAttribute(attributes, 'title');
      const variant = textAttribute(attributes, 'variant') ?? 'note';
      const heading = title ? `**${title} (${variant})**` : `**${variant}**`;
      return `${quoteMarkdown(`${heading}\n\n${children}`)}\n`;
    },
    BuiltInUiMap() {
      return renderBuiltInUiMapMarkdown();
    },
    Card({ attributes }) {
      const title = textAttribute(attributes, 'title') ?? 'Related guide';
      const description = textAttribute(attributes, 'description');
      const href = textAttribute(attributes, 'href');
      const label = href ? `[${title}](${href})` : `**${title}**`;
      return `- ${label}${description ? `: ${description}` : ''}\n`;
    },
    Cards({ children }) {
      return `${children.trim()}\n`;
    },
    CommandStateDemo() {
      return [
        '> **Interactive model: selection drives command state**',
        '>',
        '> The sample selection is simulated. Normal text reports `enabled: true` and `active: false`. Bold text reports `enabled: true` and `active: true`. A locked heading reports `enabled: false`, `active: false`, and a disabled reason. In an application, the real `superdoc/ui` controller derives these values from the active Editor selection.',
        '',
      ].join('\n');
    },
    ConfigReference() {
      return renderConfigReferenceMarkdown(editorConfigExplorer);
    },
    CustomBoldDemo() {
      return [
        '> **Live example: one custom control on a real document**',
        '>',
        '> A Bold button rendered by the application, running against a real Editor. It reads `enabled` and `active` from the `bold` command handle, sets `disabled` and `aria-pressed` from those values rather than inspecting the selection, and reports the outcome from what `executeAsync()` resolves with. `CommandExecutionResult` is `boolean | receipt`, so both shapes are handled.',
        '',
      ].join('\n');
    },
    CustomUiArchitecture() {
      return [
        '> **Diagram: the custom UI ownership boundary**',
        '>',
        '> SuperDoc renders the document, layout, selection, and editing behavior. The application renders the controls around it — a toolbar above, panels beside. Reactive state (selection, command state, comments) flows out of the editor to those controls, and commands and document operations flow back in.',
        '',
      ].join('\n');
    },
    InterfaceOwnership() {
      return [
        '> **Interactive comparison: who renders the interface**',
        '>',
        '> SuperDoc renders the DOCX canvas in every approach. The configuration changes who renders the controls around it.',
        '',
        '| Approach | Configuration | Who renders the controls |',
        '| --- | --- | --- |',
        "| Built-in | `ui: { toolbar: { container: '#toolbar' } }` | SuperDoc |",
        "| Hybrid | `ui: { toolbar: { container: '#toolbar' }, comments: false }` | SuperDoc renders the toolbar; your application renders comments through `superdoc.ui.comments` |",
        '| Fully custom | `ui: false` | Your application, through `superdoc.ui` |',
        '',
      ].join('\n');
    },
    DocumentPreview({ attributes }) {
      const label = textAttribute(attributes, 'label') ?? 'Document preview';
      const selection = booleanAttribute(attributes, 'selection');
      const trackedChanges = booleanAttribute(attributes, 'trackedChanges');
      return [
        `> **Preview:** ${label}`,
        '>',
        `> Selection highlight: ${selection ? 'enabled' : 'disabled'}.`,
        `> Tracked changes: ${trackedChanges ? 'shown' : 'hidden'}.`,
        '',
      ].join('\n');
    },
    DocumentApiReferenceLanding() {
      return renderReferenceLandingMarkdown();
    },
    DocumentApiNamespace({ attributes }) {
      const namespace = textAttribute(attributes, 'namespace');
      return namespace ? renderReferenceNamespaceMarkdown(namespace) : 'Unknown Document API namespace.\n';
    },
    DocumentApiOperation({ attributes }) {
      const operationId = textAttribute(attributes, 'operationId');
      return operationId ? renderReferenceOperationMarkdown(operationId) : 'Unknown Document API operation.\n';
    },
    EditorDemo({ attributes }) {
      const title = textAttribute(attributes, 'title') ?? 'Interactive editor demo';
      const fixture = textAttribute(attributes, 'fixture');
      const preset = textAttribute(attributes, 'preset');
      const localFile = booleanAttribute(attributes, 'allowLocalFile');
      const builtInDemo =
        preset === 'comments' ||
        preset === 'context-menu' ||
        preset === 'hyperlinks' ||
        preset === 'search' ||
        preset === 'toolbar'
          ? preset
          : null;
      const details = [
        fixture ? `Sample: [open the fixture](${fixture}).` : undefined,
        preset ? `Preset: \`${preset}\`.` : undefined,
        preset === 'document-modes'
          ? 'Try the same edit in each mode. Editing changes the document directly and is the default. Suggesting records a tracked change. After making a suggestion, switch to Viewing and use Changes to choose Original, Markup, or Final for the same proposal.'
          : undefined,
        preset === 'proofing'
          ? 'Proofing: type `mispelled`, `workng`, or `teh`, then right-click the underline.'
          : undefined,
        builtInDemo ? renderBuiltInEditorDemoMarkdown(builtInDemo) : undefined,
        preset === 'tracked-review' ? 'Tracked-change review: accept or reject the sample change.' : undefined,
        localFile ? 'Local DOCX selection: enabled. Files remain in the browser.' : 'Local DOCX selection: disabled.',
      ].filter((value): value is string => Boolean(value));

      return `${quoteMarkdown(`**Interactive editor: ${title}**\n\n${details.join('\n\n')}`)}\n`;
    },
    FileDownload({ attributes }) {
      const label = textAttribute(attributes, 'label') ?? 'Download file';
      const href = textAttribute(attributes, 'href');
      const description = textAttribute(attributes, 'description');
      const fileType = textAttribute(attributes, 'fileType');
      const link = href ? `[${label}](${href})` : label;
      const details = [description, fileType].filter((value): value is string => Boolean(value));
      return `${link}${details.length > 0 ? `: ${details.join(' · ')}` : ''}\n`;
    },
    FrameworkExample({ attributes, children }) {
      const framework = textAttribute(attributes, 'framework') ?? 'Framework';
      const filename = textAttribute(attributes, 'filename');
      const label = filename ? `**${framework} — \`${filename}\`**` : `**${framework}**`;
      return `${label}\n\n${children.trim()}\n\n`;
    },
    FrameworkExampleTabs({ children }) {
      return `${children.trim()}\n`;
    },
    LifecycleJourney() {
      return renderLifecycleJourneyMarkdown();
    },
    MigrationAgentPrompt() {
      // AIDEV-NOTE: The prompt itself, not a description of it. An agent
      // reading this export IS the audience the card exists for, so rendering
      // "copy the prompt to have your agent inspect the project" and omitting
      // the prompt would be the one failure that matters here.
      //
      // Relative URLs: this corpus is served from the same origin as the pages,
      // and unlike a clipboard paste the reader already has that context.
      return [
        '**Migrating with an AI coding agent?** Use this prompt:',
        '',
        '```text',
        'Help me migrate this project from SuperDoc v1 to v2.',
        '',
        'First, read these sources of truth:',
        '/md/editor/migrate-from-v1/overview.md',
        '/migration/v1-to-v2.json',
        '',
        'Inspect the project and report:',
        '1. Removed imports and package subpaths',
        '2. Any direct editor.* access, including commands, state, view, chain(), helpers, comments, presentationEditor, and on()',
        '3. Legacy configuration and collaboration usage',
        '4. Custom UI, extensions, and DOM selectors that require redesign',
        '5. Synchronous Document API reads such as doc.extract(), doc.getMarkdown(), and doc.selection.current(), which the browser resolves as Promises',
        '',
        'Do not change code yet. Classify each finding using the migration catalog,',
        'then propose the smallest safe migration sequence and a verification plan.',
        '```',
        '',
      ].join('\n');
    },
    MigrationExplorer() {
      // The explorer is a filter over the table that follows it on the page.
      // Restating every row here would duplicate that table in every machine-
      // readable projection, so this points at the data instead.
      return [
        '> **Searchable migration reference.**',
        '>',
        '> The interactive explorer filters the same entries listed in the tables below,',
        '> by symbol name, by when the failure surfaces, and by how much work the migration is.',
        '> A machine-readable version of every entry is published at `/migration/v1-to-v2.json`.',
        '',
      ].join('\n');
    },
    ProofingConfigReference() {
      return renderConfigReferenceMarkdown(proofingConfigExplorer);
    },
    SearchConfigReference() {
      return renderConfigReferenceMarkdown(searchConfigExplorer);
    },
    ReceiptBar({ attributes }) {
      const operation = textAttribute(attributes, 'operation') ?? 'operation';
      const detail = textAttribute(attributes, 'detail');
      return `**Receipt \`${operation}\`**${detail ? `: ${detail}` : ''}\n`;
    },
    RuntimeExample({ attributes, children }) {
      const runtime = textAttribute(attributes, 'runtime') ?? 'Runtime';
      return `### ${runtime}\n\n${children.trim()}\n\n`;
    },
    RuntimeExampleTabs({ children }) {
      return `${children.trim()}\n`;
    },
    MigrationExample({ attributes, children }) {
      // AIDEV-NOTE: A bold label, not a heading. Every migration operation is a
      // `####` on the page, so emitting `###` here closed the operation section
      // before its own examples: all 44 V1/V2 snippets became peers of the API
      // categories instead of children of the operation they demonstrate.
      // `RuntimeExample` keeps `###` because its operations are `##`.
      const version = textAttribute(attributes, 'version') ?? 'Version';
      return `**${version}**\n\n${children.trim()}\n\n`;
    },
    MigrationExampleTabs({ children }) {
      return `${children.trim()}\n`;
    },
    img({ attributes }) {
      const alt = textAttribute(attributes, 'alt') ?? 'Documentation diagram';
      const title = textAttribute(attributes, 'title');
      const label = title ? `Diagram: ${title}` : 'Diagram';
      return `> **${label}:** ${alt}\n`;
    },
  });
}
