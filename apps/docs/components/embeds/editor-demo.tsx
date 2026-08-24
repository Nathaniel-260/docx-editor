'use client';

import { Bold, Check, Expand, Italic, Minus, Plus, RotateCcw, Shrink, Underline, Undo2, X } from 'lucide-react';
import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useRef, useState } from 'react';
import type { Config, DocumentMode } from 'superdoc';
import type { CommandState, SuperDocUI, ZoomSlice } from 'superdoc/ui';
import { CollapsibleEditorPreview } from './collapsible-editor-preview';
import { loadRuntime, loadUIModule, type SuperDocInstance } from './superdoc-runtime';

const zoomStep = 10;
const initialZoom = { max: 200, min: 10, mode: 'manual', value: 100 } satisfies ZoomSlice;

type EditorDemoPreset = 'comments' | 'document-modes' | 'proofing' | 'search' | 'tracked-review';

type EditorDemoProps = {
  allowLocalFile?: boolean;
  fixture?: string;
  preset: EditorDemoPreset;
  title: string;
};

type DemoState = 'idle' | 'loading' | 'ready' | 'error';

type MountDocumentOptions = {
  documentMode?: DocumentMode;
  replaceEnabled?: boolean;
};

type RetryMount = {
  getFile: () => Promise<File>;
  options: MountDocumentOptions;
};

const documentModes = [
  { id: 'editing', label: 'Editing', note: 'Typing changes the document directly.' },
  { id: 'suggesting', label: 'Suggesting', note: 'Typing is recorded as a tracked change.' },
  { id: 'viewing', label: 'Viewing', note: 'Read-only — typing is blocked.' },
] as const satisfies ReadonlyArray<{ id: DocumentMode; label: string; note: string }>;

type PageMetricsSnapshot = {
  pages: ReadonlyArray<{
    base: { widthPx: number };
  }>;
};

type PageMetricsHandle = {
  getSnapshot(): PageMetricsSnapshot;
  subscribe(listener: (snapshot: PageMetricsSnapshot) => void): () => void;
};

type ProofingProvider = NonNullable<NonNullable<Config['proofing']>['provider']>;

const proofingReplacements = new Map([
  ['mispelled', 'misspelled'],
  ['teh', 'the'],
  ['workng', 'working'],
]);

const proofingProvider: ProofingProvider = {
  id: 'docs-proofing-demo',
  check: async ({ segments, signal }) => ({
    issues: segments.flatMap((segment) => {
      if (signal?.aborted) return [];

      return [...segment.text.matchAll(/[\p{L}]+/gu)].flatMap((match) => {
        const replacement = proofingReplacements.get(match[0].toLowerCase());
        if (!replacement) return [];

        return [
          {
            segmentId: segment.id,
            start: match.index,
            end: match.index + match[0].length,
            kind: 'spelling',
            replacements: [replacement],
          },
        ];
      });
    }),
  }),
};

function getPageMetrics(instance: SuperDocInstance): PageMetricsHandle | null {
  const editor = instance.activeEditor as { pageMetrics?: unknown } | null;
  const candidate = editor?.pageMetrics;
  if (!candidate || typeof candidate !== 'object') return null;

  const pageMetrics = candidate as Partial<PageMetricsHandle>;
  if (typeof pageMetrics.getSnapshot !== 'function' || typeof pageMetrics.subscribe !== 'function') return null;
  return pageMetrics as PageMetricsHandle;
}

function initialCommandStates() {
  return {
    bold: { active: false, enabled: false, supported: false },
    italic: { active: false, enabled: false, supported: false },
    underline: { active: false, enabled: false, supported: false },
    undo: { active: false, enabled: false, supported: false },
  } satisfies Record<string, CommandState>;
}

export function EditorDemo({ allowLocalFile = false, fixture, preset, title }: EditorDemoProps) {
  const demoRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadIdRef = useRef(0);
  const mountRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<SuperDocInstance | null>(null);
  const mountedRef = useRef(true);
  const retryMountRef = useRef<RetryMount | null>(null);
  const fitActiveRef = useRef(true);
  const fitCleanupRef = useRef<(() => void) | null>(null);
  const fitToWidthRef = useRef<(() => void) | null>(null);
  const uiCleanupRef = useRef<(() => void) | null>(null);
  const uiRef = useRef<SuperDocUI | null>(null);
  const zoomRef = useRef<ZoomSlice>(initialZoom);
  const [activeChangeId, setActiveChangeId] = useState<string | null>(null);
  const [commandStates, setCommandStates] = useState(initialCommandStates);
  const [documentMode, setDocumentMode] = useState<DocumentMode>(
    preset === 'tracked-review' ? 'suggesting' : 'editing',
  );
  const [fitActive, setFitActive] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [modeResetBusy, setModeResetBusy] = useState(false);
  const [replaceEnabled, setReplaceEnabled] = useState(true);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [searchConfigBusy, setSearchConfigBusy] = useState(false);
  const [searchConfigError, setSearchConfigError] = useState<string | null>(null);
  const [state, setState] = useState<DemoState>('idle');
  const [trackedChangeCount, setTrackedChangeCount] = useState(0);
  const [zoom, setZoom] = useState<ZoomSlice>(initialZoom);

  function destroyEditor() {
    fitCleanupRef.current?.();
    fitCleanupRef.current = null;
    fitToWidthRef.current = null;
    uiCleanupRef.current?.();
    uiCleanupRef.current = null;
    uiRef.current?.destroy();
    uiRef.current = null;
    instanceRef.current?.destroy();
    instanceRef.current = null;
  }

  function setDemoInteractionBlocked(blocked: boolean) {
    const surfaces = [toolbarRef.current, mountRef.current].filter(
      (surface): surface is HTMLDivElement => surface !== null,
    );
    if (blocked && surfaces.some((surface) => surface.contains(document.activeElement))) {
      (document.activeElement as HTMLElement | null)?.blur();
    }
    surfaces.forEach((surface) => {
      surface.inert = blocked;
    });
  }

  function connectFitToWidth(instance: SuperDocInstance) {
    if (fitCleanupRef.current) return;
    const mount = mountRef.current;
    const pageMetrics = getPageMetrics(instance);
    if (!mount || !pageMetrics) return;

    const applyFit = () => {
      if (!fitActiveRef.current) return;

      const widestPage = pageMetrics.getSnapshot().pages.reduce((width, page) => Math.max(width, page.base.widthPx), 0);
      const availableWidth = mount.clientWidth - 32;
      if (!(widestPage > 0) || !(availableWidth > 0)) return;

      const { min, max } = zoomRef.current;
      const nextZoom = Math.max(min, Math.min(max, Math.round((availableWidth / widestPage) * 100)));
      if (nextZoom === Math.round(zoomRef.current.value)) return;
      instance.setZoom(nextZoom);
    };

    const resizeObserver = new ResizeObserver(applyFit);
    resizeObserver.observe(mount);
    const unsubscribe = pageMetrics.subscribe(applyFit);

    fitToWidthRef.current = applyFit;
    fitCleanupRef.current = () => {
      resizeObserver.disconnect();
      unsubscribe();
    };
    applyFit();
  }

  useEffect(() => {
    mountedRef.current = true;

    const handleFullscreenChange = () => {
      const active =
        document.fullscreenElement === document.documentElement && demoRef.current?.dataset.fullscreen === 'true';
      if (!active && demoRef.current) delete demoRef.current.dataset.fullscreen;
      setIsFullscreen(active);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      mountedRef.current = false;
      loadIdRef.current += 1;
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      destroyEditor();
    };
  }, []);

  function connectToolbar(ui: SuperDocUI) {
    const cleanup = Object.entries(initialCommandStates()).map(([id]) =>
      ui.commands.get(id).observe((commandState) => {
        if (!mountedRef.current) return;
        setCommandStates((current) => ({ ...current, [id]: commandState }));
      }),
    );

    cleanup.push(
      ui.trackChanges.observe((snapshot) => {
        if (!mountedRef.current) return;
        setTrackedChangeCount(snapshot.total);

        const nextActiveId = snapshot.activeId ?? snapshot.items[0]?.id ?? null;
        if (!snapshot.activeId && nextActiveId) ui.trackChanges.setActive(nextActiveId);
        setActiveChangeId(nextActiveId);
      }),
      ui.zoom.observe((snapshot) => {
        zoomRef.current = snapshot;
        if (mountedRef.current) setZoom(snapshot);
      }),
    );

    uiCleanupRef.current = () => cleanup.forEach((unsubscribe) => unsubscribe());
  }

  async function mountDocument(getFile?: () => Promise<File>, options: MountDocumentOptions = {}) {
    if (!mountRef.current || state === 'loading') return false;

    const loadId = ++loadIdRef.current;
    const hadMountedEditor = instanceRef.current !== null;
    const initialDocumentMode = options.documentMode ?? (preset === 'tracked-review' ? 'suggesting' : 'editing');
    const initialReplaceEnabled = options.replaceEnabled ?? true;
    setDemoInteractionBlocked(true);
    setSearchConfigError(null);
    setState('loading');
    let replacedEditor = false;

    const markError = () => {
      if (!mountedRef.current || loadId !== loadIdRef.current) return;
      setState('error');
      window.setTimeout(() => {
        if (loadId !== loadIdRef.current) return;
        destroyEditor();
      });
    };

    try {
      const [file, SuperDoc, uiModule] = await Promise.all([getFile?.(), loadRuntime(), loadUIModule()]);
      if (!mountedRef.current || !mountRef.current || loadId !== loadIdRef.current) return false;
      const searchToolbar = toolbarRef.current;
      if (preset === 'search' && !searchToolbar) throw new Error('The search toolbar mount is unavailable.');

      destroyEditor();
      replacedEditor = true;
      setActiveChangeId(null);
      setCommandStates(initialCommandStates());
      setDocumentMode(initialDocumentMode);
      fitActiveRef.current = true;
      setFitActive(true);
      setModeResetBusy(false);
      setReplaceEnabled(initialReplaceEnabled);
      setReviewBusy(false);
      setTrackedChangeCount(0);
      zoomRef.current = initialZoom;
      setZoom(initialZoom);

      let instance: SuperDocInstance | null = null;
      instance = new SuperDoc({
        selector: mountRef.current,
        document: file ?? SuperDoc.BlankDOCX,
        documentMode: initialDocumentMode,
        proofing: preset === 'proofing' ? { enabled: true, provider: proofingProvider } : undefined,
        ui: {
          comments: { displayMode: preset === 'comments' ? 'auto' : 'inline' },
          loading: false,
          ...(preset === 'search'
            ? {
                search: { replaceEnabled: initialReplaceEnabled },
                toolbar: {
                  container: searchToolbar!,
                  groups: { left: ['search'] },
                  responsiveToContainer: true,
                },
              }
            : {}),
        },
        zoom: {
          mode: 'manual',
          fitWidth: { min: initialZoom.min, max: initialZoom.max },
        },
        user: {
          name: 'Docs visitor',
          email: 'docs@example.com',
        },
        onReady: ({ superdoc: readySuperDoc }) => {
          if (!mountedRef.current || loadId !== loadIdRef.current) return;
          if (preset === 'proofing') {
            void readySuperDoc.activeEditor?.doc?.insert({ value: 'Proofing finds mispelled words as you type.' });
          }
          retryMountRef.current = null;
          setState('ready');
          if (instance) connectFitToWidth(instance);
        },
        onContentError: markError,
        onException: markError,
      });
      instanceRef.current = instance;
      connectFitToWidth(instance);

      const ui = uiModule.createSuperDocUI({ superdoc: instance });
      uiRef.current = ui;
      connectToolbar(ui);
      return true;
    } catch {
      if (loadId !== loadIdRef.current) return false;
      if (replacedEditor) destroyEditor();
      if (mountedRef.current) setState(replacedEditor || !hadMountedEditor ? 'error' : 'ready');
      return false;
    } finally {
      if (mountedRef.current && loadId === loadIdRef.current) setDemoInteractionBlocked(false);
    }
  }

  async function getFixtureFile() {
    if (!fixture) throw new Error('This editor demo does not have a fixture.');
    const response = await fetch(fixture);
    if (!response.ok) throw new Error(`Fixture request failed with ${response.status}.`);

    const blob = await response.blob();
    const fileName = fixture.split('/').at(-1) ?? 'document.docx';
    return new File([blob], fileName, {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
  }

  function loadDemo() {
    const retry = retryMountRef.current;
    void mountDocument(retry?.getFile ?? (fixture ? getFixtureFile : undefined), retry?.options);
  }

  useEffect(() => {
    const demo = demoRef.current;
    if (!demo || state !== 'idle') return;

    if (typeof IntersectionObserver === 'undefined') {
      loadDemo();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        loadDemo();
      },
      { rootMargin: '240px 0px' },
    );
    observer.observe(demo);

    return () => observer.disconnect();
  }, [fixture, state]);

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function loadLocalFile(file: File | undefined) {
    if (!file) return;
    void mountDocument(async () => file);
  }

  function runCommand(id: keyof ReturnType<typeof initialCommandStates>) {
    void uiRef.current?.commands.get(id).executeAsync();
  }

  function changeDocumentMode(mode: DocumentMode) {
    if (state !== 'ready') return;
    const instance = instanceRef.current;
    instance?.setDocumentMode(mode);
    setDocumentMode(mode);
  }

  async function toggleSearchReplacement() {
    const instance = instanceRef.current;
    if (!instance || preset !== 'search' || state !== 'ready' || searchConfigBusy) return;

    setDemoInteractionBlocked(true);
    setSearchConfigBusy(true);
    setSearchConfigError(null);
    try {
      const currentDocumentMode = instance.config.documentMode;
      const exported = await instance.export({ exportType: ['docx'], triggerDownload: false });
      if (!(exported instanceof Blob)) throw new Error('SuperDoc did not return the current DOCX.');

      const fileName = fixture?.split('/').at(-1) ?? 'document.docx';
      const currentFile = new File([exported], fileName, {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const retry = {
        getFile: async () => currentFile,
        options: {
          documentMode: currentDocumentMode,
          replaceEnabled: !replaceEnabled,
        },
      } satisfies RetryMount;
      retryMountRef.current = retry;
      const mounted = await mountDocument(retry.getFile, retry.options);
      if (!mounted) throw new Error('SuperDoc could not update the search configuration.');
    } catch {
      if (mountedRef.current) {
        setSearchConfigError('Replacement could not be updated. Try again.');
      }
    } finally {
      setDemoInteractionBlocked(false);
      if (mountedRef.current) setSearchConfigBusy(false);
    }
  }

  async function resetModesDemo() {
    const instance = instanceRef.current;
    if (!instance || !fixture || modeResetBusy) return;

    setModeResetBusy(true);
    try {
      const result = await instance.replaceFile(await getFixtureFile());
      const replacement = result && typeof result === 'object' ? (result as { state?: unknown }) : null;
      const replacementState = replacement?.state ?? null;
      const replacementSucceeded =
        replacementState === null || replacementState === 'review-ready' || replacementState === 'editing-ready';
      if (!replacementSucceeded) throw new Error('SuperDoc could not reset the sample document.');

      instance.setDocumentMode(documentMode);
    } catch {
      setState('error');
    } finally {
      if (mountedRef.current) setModeResetBusy(false);
    }
  }

  function handleViewingKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (documentMode !== 'viewing') return;

    const isTextInput = event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey;
    const isEditingKey = isTextInput || ['Backspace', 'Delete', 'Enter'].includes(event.key);
    if (!isEditingKey) return;

    event.preventDefault();
    const surface = event.currentTarget;
    surface.classList.remove('sd-editor-demo-surface-blocked');
    void surface.offsetWidth;
    surface.classList.add('sd-editor-demo-surface-blocked');
  }

  async function decideChange(decision: 'accept' | 'reject') {
    const ui = uiRef.current;
    if (!ui || !activeChangeId || reviewBusy) return;

    setReviewBusy(true);
    try {
      await Promise.resolve(ui.trackChanges[decision](activeChangeId));
    } finally {
      if (mountedRef.current) setReviewBusy(false);
    }
  }

  function changeZoom(direction: -1 | 1) {
    const nextZoom = Math.min(zoom.max, Math.max(zoom.min, zoom.value + direction * zoomStep));
    fitActiveRef.current = false;
    setFitActive(false);
    uiRef.current?.zoom.set(nextZoom);
  }

  function fitToWidth() {
    fitActiveRef.current = true;
    setFitActive(true);
    fitToWidthRef.current?.();
  }

  async function toggleFullscreen() {
    const demo = demoRef.current;
    if (!demo) return;
    if (document.fullscreenElement === document.documentElement && demo.dataset.fullscreen === 'true') {
      await document.exitFullscreen();
      return;
    }

    demo.dataset.fullscreen = 'true';
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      delete demo.dataset.fullscreen;
    }
  }

  const hasActiveChange = Boolean(activeChangeId) && !reviewBusy;
  const countLabel = `${trackedChangeCount} ${trackedChangeCount === 1 ? 'change' : 'changes'}`;
  const activeDocumentMode = documentModes.find((mode) => mode.id === documentMode) ?? documentModes[0];

  return (
    <section
      ref={demoRef}
      className='sd-editor-demo'
      aria-label={title}
      data-document-mode={preset === 'document-modes' || preset === 'search' ? documentMode : undefined}
      data-preset={preset}
      data-state={state}
    >
      <div className='sd-editor-demo-header'>
        <div className='sd-editor-demo-copy'>
          <strong>{title}</strong>
          {preset !== 'document-modes' ? (
            <span>
              {allowLocalFile
                ? 'Loads the sample automatically. Files stay in this browser.'
                : preset === 'proofing'
                  ? 'Type “mispelled”, “workng”, or “teh”, then right-click its underline.'
                  : preset === 'comments'
                    ? 'Open the existing thread, or select text to start another.'
                    : preset === 'search'
                      ? 'Search for “Client”, then replace one result with “Customer”.'
                      : 'Loads the sample DOCX in suggesting mode.'}
            </span>
          ) : null}
        </div>
        {preset === 'document-modes' || preset === 'search' ? (
          <div className='sd-editor-demo-mode-header-actions'>
            {state === 'error' ? (
              <button type='button' onClick={loadDemo}>
                Try sample again
              </button>
            ) : (
              <>
                <div className='sd-editor-demo-mode-switcher' role='group' aria-label='Document mode'>
                  {documentModes
                    .filter((mode) => preset === 'document-modes' || mode.id !== 'suggesting')
                    .map((mode) => (
                      <button
                        key={mode.id}
                        type='button'
                        aria-pressed={documentMode === mode.id}
                        disabled={state !== 'ready' || modeResetBusy || searchConfigBusy}
                        onClick={() => changeDocumentMode(mode.id)}
                      >
                        {mode.label}
                      </button>
                    ))}
                </div>
                {preset === 'search' ? (
                  <button
                    className='sd-editor-demo-search-toggle'
                    type='button'
                    aria-label={`${replaceEnabled ? 'Disable' : 'Enable'} replacement`}
                    aria-pressed={replaceEnabled}
                    disabled={state !== 'ready' || searchConfigBusy}
                    onClick={() => void toggleSearchReplacement()}
                  >
                    {searchConfigBusy ? 'Updating…' : `Replacement: ${replaceEnabled ? 'On' : 'Off'}`}
                  </button>
                ) : (
                  <button
                    className='sd-editor-demo-mode-reset'
                    type='button'
                    aria-label='Reset the sample document'
                    title='Reset the sample document'
                    disabled={state !== 'ready' || modeResetBusy}
                    onClick={() => void resetModesDemo()}
                  >
                    <RotateCcw aria-hidden='true' />
                  </button>
                )}
              </>
            )}
          </div>
        ) : (
          <div className='sd-editor-demo-actions'>
            {state === 'error' ? (
              <button type='button' onClick={loadDemo}>
                Try sample again
              </button>
            ) : (
              <span className='sd-editor-demo-status'>{state === 'ready' ? 'Ready' : 'Loading…'}</span>
            )}
            {allowLocalFile ? (
              <>
                <button
                  className='sd-editor-demo-file-button'
                  type='button'
                  onClick={openFilePicker}
                  disabled={state === 'loading'}
                >
                  Open your DOCX
                </button>
                <input
                  ref={fileInputRef}
                  className='sd-editor-demo-file-input'
                  hidden
                  type='file'
                  accept='.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                  onChange={(event) => {
                    loadLocalFile(event.currentTarget.files?.[0]);
                    event.currentTarget.value = '';
                  }}
                />
              </>
            ) : null}
          </div>
        )}
      </div>
      <CollapsibleEditorPreview
        className='sd-editor-demo-preview'
        onCollapse={() => mountRef.current?.scrollTo({ top: 0 })}
      >
        {state === 'error' ? (
          <p className='sd-editor-demo-error' role='alert'>
            {allowLocalFile
              ? 'The editor could not load. Try the sample again or choose a local DOCX to continue.'
              : preset === 'proofing'
                ? 'The proofing editor could not load. Try again.'
                : preset === 'comments'
                  ? 'The comments editor could not load. Try again.'
                  : preset === 'search'
                    ? 'The search editor could not load. Try again.'
                    : 'The editor could not load. Download the fixture and continue with the local quickstart below.'}
          </p>
        ) : null}
        {searchConfigError ? (
          <p className='sd-editor-demo-error' role='alert'>
            {searchConfigError}
          </p>
        ) : null}
        {preset === 'search' ? (
          <div
            ref={toolbarRef}
            className='sd-editor-demo-built-in-toolbar'
            hidden={state === 'idle'}
            aria-label='Built-in Editor toolbar'
            aria-busy={searchConfigBusy}
            inert={searchConfigBusy}
          />
        ) : null}
        <div
          className='sd-editor-demo-toolbar'
          hidden={state === 'idle' || preset === 'search'}
          aria-label='Editor controls'
        >
          <div className='sd-editor-demo-toolbar-group sd-editor-demo-edit-controls' role='group' aria-label='Edit'>
            <button
              type='button'
              aria-label='Undo'
              disabled={!commandStates.undo.enabled}
              onClick={() => runCommand('undo')}
            >
              <Undo2 aria-hidden='true' />
            </button>
            <span className='sd-editor-demo-toolbar-separator' aria-hidden='true' />
            <button
              type='button'
              aria-label='Bold'
              aria-pressed={commandStates.bold.active}
              disabled={!commandStates.bold.enabled}
              onClick={() => runCommand('bold')}
            >
              <Bold aria-hidden='true' />
            </button>
            <button
              type='button'
              aria-label='Italic'
              aria-pressed={commandStates.italic.active}
              disabled={!commandStates.italic.enabled}
              onClick={() => runCommand('italic')}
            >
              <Italic aria-hidden='true' />
            </button>
            <button
              type='button'
              aria-label='Underline'
              aria-pressed={commandStates.underline.active}
              disabled={!commandStates.underline.enabled}
              onClick={() => runCommand('underline')}
            >
              <Underline aria-hidden='true' />
            </button>
          </div>
          {preset === 'tracked-review' ? (
            <div
              className='sd-editor-demo-toolbar-group sd-editor-demo-review-controls'
              role='group'
              aria-label='Review'
            >
              <button
                className='sd-editor-demo-accept-button'
                type='button'
                disabled={!hasActiveChange}
                onClick={() => void decideChange('accept')}
              >
                <Check aria-hidden='true' />
                Accept
              </button>
              <button type='button' disabled={!hasActiveChange} onClick={() => void decideChange('reject')}>
                <X aria-hidden='true' />
                Reject
              </button>
              <span className='sd-editor-demo-change-count' aria-live='polite'>
                {countLabel}
              </span>
            </div>
          ) : null}
          <div className='sd-editor-demo-toolbar-group sd-editor-demo-view-controls' role='group' aria-label='View'>
            <div className='sd-editor-demo-zoom-control'>
              <button
                type='button'
                aria-label='Zoom out'
                disabled={zoom.value <= zoom.min}
                onClick={() => changeZoom(-1)}
              >
                <Minus aria-hidden='true' />
              </button>
              <button
                className='sd-editor-demo-fit-button'
                type='button'
                aria-label='Fit document to width'
                aria-pressed={fitActive}
                onClick={fitToWidth}
              >
                {fitActive ? 'Fit' : `${Math.round(zoom.value)}%`}
              </button>
              <button
                type='button'
                aria-label='Zoom in'
                disabled={zoom.value >= zoom.max}
                onClick={() => changeZoom(1)}
              >
                <Plus aria-hidden='true' />
              </button>
            </div>
            <button
              type='button'
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              onClick={() => void toggleFullscreen()}
            >
              {isFullscreen ? <Shrink aria-hidden='true' /> : <Expand aria-hidden='true' />}
            </button>
          </div>
        </div>
        <div
          ref={mountRef}
          className='sd-editor-demo-surface'
          hidden={state === 'idle'}
          aria-busy={searchConfigBusy}
          inert={searchConfigBusy}
          tabIndex={preset === 'document-modes' && documentMode === 'viewing' ? -1 : undefined}
          onPointerDownCapture={() => {
            if (preset === 'document-modes' && documentMode === 'viewing') {
              mountRef.current?.focus({ preventScroll: true });
            }
          }}
          onKeyDownCapture={preset === 'document-modes' ? handleViewingKeyDown : undefined}
          onAnimationEnd={(event) => event.currentTarget.classList.remove('sd-editor-demo-surface-blocked')}
        />
        {state === 'idle' ? (
          <div className='sd-editor-demo-poster'>
            <span aria-hidden='true'>DOCX</span>
            <p>
              {allowLocalFile
                ? 'The sample editor loads as this demo enters view. You can also open your own DOCX.'
                : preset === 'proofing'
                  ? 'The proofing editor is loading.'
                  : preset === 'comments'
                    ? 'The comments editor is loading.'
                    : preset === 'search'
                      ? 'The search editor is loading.'
                      : 'The sample editor loads as this demo enters view. The rest of the article stays lightweight.'}
            </p>
          </div>
        ) : null}
      </CollapsibleEditorPreview>
      {preset === 'document-modes' ? (
        <div className='sd-editor-demo-mode-footer' data-mode={documentMode} aria-label='Document mode status'>
          <span aria-hidden='true' />
          <p aria-live='polite'>{activeDocumentMode.note}</p>
          <code>{`documentMode: '${documentMode}'`}</code>
        </div>
      ) : null}
    </section>
  );
}
