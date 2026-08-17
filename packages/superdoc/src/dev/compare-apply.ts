export interface CompareApplyResult {
  readonly appliedOperations?: number;
  readonly diagnostics?: readonly string[];
}

export interface CompareApplyDebugSnapshot {
  readonly textLength: number | null;
  readonly hostFacadeTextLength: number | null;
  readonly projectionBlockCount: number | null;
  readonly projectionTableCount: number | null;
  readonly renderStage: string | null;
  readonly hostFacadeMatchesEditorDoc: boolean | null;
}

export interface CompareApplyDocApi {
  readonly diff: {
    apply(
      input: { diff: unknown },
      options: { changeMode: 'tracked' | 'direct' },
    ): CompareApplyResult | Promise<CompareApplyResult>;
  };
  getText?(input: Record<string, never>): string;
  readonly doc?: {
    getText?(input: Record<string, never>): string;
  } | null;
  readonly documentMutationReadiness?: {
    whenPainted?(input?: { txId?: string }): Promise<unknown> | unknown;
  } | null;
  readonly host?: {
    readMountedProjectionBlocks?(): Array<{ kind?: string }> | null;
    getRenderReadinessSnapshot?(): { renderStage?: string | null } | null;
    getDocumentFacade?():
      | {
          available: true;
          doc: {
            getText?(input: Record<string, never>): string;
          };
        }
      | {
          available: false;
        };
  } | null;
}

export interface CompareApplyOutcome {
  readonly applyResult: CompareApplyResult;
  readonly changeMode: 'tracked' | 'direct';
  readonly fallbackFromTracked: boolean;
}

export function isWs09TrackedCompareDeferred(error: unknown): boolean {
  const code =
    typeof error === 'object' && error !== null && 'code' in error ? (error as { code?: unknown }).code : null;
  const message = error instanceof Error ? error.message : String(error ?? '');
  return code === 'CAPABILITY_UNSUPPORTED' && /compare-apply-deferred \(ws09\)/i.test(message);
}

export function compareApplyDeferredMessage(error: unknown): string | null {
  if (!isWs09TrackedCompareDeferred(error)) return null;
  return (
    'Tracked compare apply is deferred for ws09 table topology in this build. ' +
    'SuperDoc Dev retried the same diff in direct mode.'
  );
}

function prefersDirectWs09TableTopologyApply(diff: unknown): boolean {
  if (!diff || typeof diff !== 'object') return false;
  const payload = 'payload' in diff ? (diff as { payload?: unknown }).payload : null;
  if (!payload || typeof payload !== 'object') return false;
  const familyPolicy =
    'familyPolicy' in payload && Array.isArray((payload as { familyPolicy?: unknown }).familyPolicy)
      ? (
          payload as {
            familyPolicy: Array<{
              family?: unknown;
              disposition?: unknown;
              changed?: unknown;
              applyRequired?: unknown;
            }>;
          }
        ).familyPolicy
      : [];
  const tablesPolicy = familyPolicy.find((entry) => entry?.family === 'tables') ?? null;
  if (!tablesPolicy) return false;
  const mainDocument = 'mainDocument' in payload ? (payload as { mainDocument?: unknown }).mainDocument : null;
  const targetMainDocument =
    mainDocument && typeof mainDocument === 'object' ? (mainDocument as { target?: unknown }).target : null;
  const hasTargetMainDocumentXml = Boolean(
    targetMainDocument &&
    typeof targetMainDocument === 'object' &&
    typeof (targetMainDocument as { xml?: unknown }).xml === 'string',
  );
  return (
    tablesPolicy.changed === true &&
    tablesPolicy.applyRequired === true &&
    tablesPolicy.disposition === 'deferred' &&
    hasTargetMainDocumentXml
  );
}

export async function applyCompareWithWs09Fallback(
  docApi: CompareApplyDocApi,
  diff: unknown,
): Promise<CompareApplyOutcome> {
  if (prefersDirectWs09TableTopologyApply(diff)) {
    return {
      applyResult: await docApi.diff.apply({ diff }, { changeMode: 'direct' }),
      changeMode: 'direct',
      fallbackFromTracked: true,
    };
  }
  try {
    return {
      applyResult: await docApi.diff.apply({ diff }, { changeMode: 'tracked' }),
      changeMode: 'tracked',
      fallbackFromTracked: false,
    };
  } catch (error) {
    if (!isWs09TrackedCompareDeferred(error)) throw error;
    return {
      applyResult: await docApi.diff.apply({ diff }, { changeMode: 'direct' }),
      changeMode: 'direct',
      fallbackFromTracked: true,
    };
  }
}

export async function settleCompareApplyPaint(docApi: CompareApplyDocApi): Promise<void> {
  const readiness = docApi.documentMutationReadiness;
  const whenPainted = readiness?.whenPainted;
  if (typeof whenPainted !== 'function') return;
  await whenPainted.call(readiness);
}

export function captureCompareApplyDebugSnapshot(docApi: CompareApplyDocApi): CompareApplyDebugSnapshot {
  let textLength: number | null = null;
  try {
    const directTextReader = docApi.getText ?? docApi.doc?.getText;
    const text = directTextReader?.({});
    if (typeof text === 'string') textLength = text.length;
  } catch {
    textLength = null;
  }

  let hostFacadeTextLength: number | null = null;
  let hostFacadeMatchesEditorDoc: boolean | null = null;
  try {
    const facade = docApi.host?.getDocumentFacade?.();
    if (facade?.available === true) {
      const hostText = facade.doc.getText?.({});
      if (typeof hostText === 'string') hostFacadeTextLength = hostText.length;
      const editorDoc = docApi.doc ?? null;
      hostFacadeMatchesEditorDoc = editorDoc ? facade.doc === editorDoc : null;
    }
  } catch {
    hostFacadeTextLength = null;
    hostFacadeMatchesEditorDoc = null;
  }

  let projectionBlockCount: number | null = null;
  let projectionTableCount: number | null = null;
  try {
    const blocks = docApi.host?.readMountedProjectionBlocks?.() ?? null;
    if (Array.isArray(blocks)) {
      projectionBlockCount = blocks.length;
      projectionTableCount = blocks.filter((block) => block?.kind === 'table').length;
    }
  } catch {
    projectionBlockCount = null;
    projectionTableCount = null;
  }

  let renderStage: string | null = null;
  try {
    const snapshot = docApi.host?.getRenderReadinessSnapshot?.() ?? null;
    renderStage = typeof snapshot?.renderStage === 'string' ? snapshot.renderStage : null;
  } catch {
    renderStage = null;
  }

  return {
    textLength,
    hostFacadeTextLength,
    projectionBlockCount,
    projectionTableCount,
    renderStage,
    hostFacadeMatchesEditorDoc,
  };
}
