import type {
  Config,
  ContentControlActiveChangePayload,
  ContentControlClickPayload,
  ContentControlRef,
  SdtRef,
} from 'superdoc';

const canonical: Pick<Config, 'ui'> = {
  ui: { contentControls: false },
};

const canonicalEnabled: Pick<Config, 'ui'> = {
  ui: { contentControls: true },
};

const compatibleObject: Pick<Config, 'ui'> = {
  ui: { contentControls: { chrome: 'none' } },
};

const compatibleModule: Pick<Config, 'modules'> = {
  modules: { contentControls: { chrome: 'default' } },
};

const callbacks: Pick<Config, 'onContentControlActiveChange' | 'onContentControlClick'> = {
  onContentControlActiveChange(payload: ContentControlActiveChangePayload) {
    const active: ContentControlRef | null = payload.active;
    const previous: ContentControlRef | null = payload.previous;
    const path: ContentControlRef[] = payload.activePath;
    const source: 'keyboard' | 'pointer' = payload.source;
    void [active, previous, path, source];
  },
  onContentControlClick(payload: ContentControlClickPayload) {
    const target: ContentControlRef = payload.target;
    const source: 'pointer' = payload.source;
    void [target, source];
  },
};

const compatibleRef: SdtRef = {
  id: 'control-1',
  controlType: 'tenant-defined-control' as string,
  scope: 'inline',
};

const controlType: ContentControlRef['controlType'] = 'checkbox';

// @ts-expect-error ContentControlRef uses the Document API's content-control type union.
const invalidControlType: ContentControlRef['controlType'] = 'custom';

void [
  canonical,
  canonicalEnabled,
  compatibleObject,
  compatibleModule,
  callbacks,
  compatibleRef,
  controlType,
  invalidControlType,
];
