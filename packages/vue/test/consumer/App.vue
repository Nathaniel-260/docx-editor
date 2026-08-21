<script setup lang="ts">
import { ref } from 'vue';

import { SuperDocEditor } from '@superdoc/vue';
import { provideSuperDocUI } from 'superdoc/ui/vue';
import type {
  DocumentMode,
  SuperDocContentErrorEvent,
  SuperDocEditorCreateEvent,
  SuperDocEditorUpdateEvent,
  SuperDocExceptionEvent,
  SuperDocReadyEvent,
  SuperDocTransactionEvent,
  SuperDocViewportChangeEvent,
  SuperDocZoomChangeEvent,
} from '@superdoc/vue';

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2 ? true : false;
type Expect<Value extends true> = Value;
type EditorProps = InstanceType<typeof SuperDocEditor>['$props'];
type ReadyPayload = Parameters<NonNullable<EditorProps['onReady']>>[0];
type ModePayload = Parameters<NonNullable<EditorProps['onUpdate:documentMode']>>[0];
type _ReadyPayloadMatchesCore = Expect<Equal<ReadyPayload, SuperDocReadyEvent>>;
type _ModePayloadMatchesModel = Expect<Equal<ModePayload, DocumentMode>>;

// @ts-expect-error A ready listener cannot replace the core-derived payload with an unrelated type.
const invalidReadyListener: NonNullable<EditorProps['onReady']> = (_event: number) => {};
void invalidReadyListener;

const editor = ref<InstanceType<typeof SuperDocEditor> | null>(null);
const document = ref<File | null>(null);
const mode = ref<DocumentMode>('editing');
const ui = { toolbar: false } as const;
const uiBinding = provideSuperDocUI();

const onReady = (_event: SuperDocReadyEvent): void => {};
const onEditorCreate = (_event: SuperDocEditorCreateEvent): void => {};
const onEditorUpdate = (_event: SuperDocEditorUpdateEvent): void => {};
const onTransaction = (_event: SuperDocTransactionEvent): void => {};
const onContentError = (_event: SuperDocContentErrorEvent): void => {};
const onException = (_event: SuperDocExceptionEvent): void => {};
const onZoomChange = (_event: SuperDocZoomChangeEvent): void => {};
const onViewportChange = (_event: SuperDocViewportChangeEvent): void => {};

function getInstance() {
  return editor.value?.getInstance() ?? null;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
</script>

<template>
  <SuperDocEditor
    ref="editor"
    v-model:document-mode="mode"
    :document="document"
    :ui="ui"
    :ui-binding="uiBinding"
    contained
    @ready="onReady"
    @editor-create="onEditorCreate"
    @editor-update="onEditorUpdate"
    @transaction="onTransaction"
    @content-error="onContentError"
    @exception="onException"
    @zoom-change="onZoomChange"
    @viewport-change="onViewportChange"
  >
    <template #loading>Opening document</template>
    <template #error="{ error }">{{ formatError(error) }}</template>
  </SuperDocEditor>

  <button type="button" :disabled="getInstance() === null">Export</button>
</template>
