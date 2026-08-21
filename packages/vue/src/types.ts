import type { SuperDoc } from 'superdoc';

type SuperDocConstructorConfig = ConstructorParameters<typeof SuperDoc>[0];

export type SuperDocInstance = InstanceType<typeof SuperDoc>;
export type DocumentMode = NonNullable<SuperDocConstructorConfig['documentMode']>;
export type UserRole = NonNullable<SuperDocConstructorConfig['role']>;
export type SuperDocUser = NonNullable<SuperDocConstructorConfig['user']>;
export type SuperDocModules = NonNullable<SuperDocConstructorConfig['modules']>;
export type SuperDocUIConfig = SuperDocConstructorConfig['ui'];
export type SuperDocConfig = SuperDocConstructorConfig;

export type SuperDocReadyEvent = Parameters<NonNullable<SuperDocConfig['onReady']>>[0];
export type SuperDocEditorCreateEvent = Parameters<NonNullable<SuperDocConfig['onEditorCreate']>>[0];
export type SuperDocEditorUpdateEvent = Parameters<NonNullable<SuperDocConfig['onEditorUpdate']>>[0];
export type SuperDocTransactionEvent = Parameters<NonNullable<SuperDocConfig['onTransaction']>>[0];
export type SuperDocContentErrorEvent = Parameters<NonNullable<SuperDocConfig['onContentError']>>[0];

/** Narrow the core exception union with `'stage' in event` or `'code' in event`. */
export type SuperDocExceptionEvent = import('superdoc').SuperDocExceptionPayload;
export type SuperDocZoomChangeEvent = Parameters<NonNullable<SuperDocConfig['onZoomChange']>>[0];
export type SuperDocViewportChangeEvent = Parameters<NonNullable<SuperDocConfig['onViewportChange']>>[0];

/**
 * Keys handled by reactive props, component-owned mount elements, or Vue
 * events. All other core options go through the startup-only `config` prop.
 */
type ManagedConfigKeys =
  | 'selector'
  | 'toolbar'
  | 'document'
  | 'documentMode'
  | 'role'
  | 'user'
  | 'users'
  | 'modules'
  | 'ui'
  | 'contained'
  | 'onReady'
  | 'onEditorCreate'
  | 'onEditorDestroy'
  | 'onEditorUpdate'
  | 'onTransaction'
  | 'onContentError'
  | 'onException'
  | 'onZoomChange'
  | 'onViewportChange';

/**
 * Core options accepted by the `config` prop. They apply only when the editor
 * starts; use managed props or `getInstance()` for later changes.
 */
export type SuperDocEditorConfig = Omit<SuperDocConfig, ManagedConfigKeys>;

/** Methods exposed through a template ref. */
export interface SuperDocEditorExpose {
  /** Returns the core instance after the editor is ready. */
  getInstance(): SuperDocInstance | null;
}
