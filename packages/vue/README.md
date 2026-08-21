# @superdoc/vue

Official Vue 3 wrapper for the [SuperDoc](https://superdoc.dev) document editor.

> Not published to npm yet. It builds against `superdoc@2` inside this workspace; the npm release is a
> separate, deliberate step, and until it is approved this package carries no release impact.

The component owns the editor instance: it creates it, rebuilds it when the document changes, and destroys it
on unmount. You get reactive props and Vue events, plus the full `SuperDoc` instance through a template ref.

## Quick start

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { SuperDocEditor } from '@superdoc/vue';
import type { DocumentMode } from '@superdoc/vue';
import '@superdoc/vue/style.css';

const file = ref<File | null>(null);
const mode = ref<DocumentMode>('editing');
</script>

<template>
  <SuperDocEditor v-model:document-mode="mode" :document="file">
    <template #loading>Opening document...</template>
    <template #error>Could not open this document.</template>
  </SuperDocEditor>
</template>
```

## Props

| Prop            | Change applies    | Notes                                                                       |
| --------------- | ----------------- | --------------------------------------------------------------------------- |
| `document`      | rebuild           | URL string, `File`, `Blob`, or `null`                                        |
| `document-mode` | in place          | two-way bindable as `v-model:document-mode`                                  |
| `role`          | rebuild           |                                                                              |
| `user`, `users` | rebuild on change | compared by value, so an inline literal with equal content does not rebuild  |
| `modules`       | rebuild on change | compared by reference; may hold functions, DOM nodes, or collaboration providers, so it is never serialized or cloned |
| `ui`            | rebuild on change | compared by reference. `{ toolbar: false }` hides the built-in toolbar       |
| `contained`     | rebuild           | fit and scroll inside a fixed-height parent                                  |
| `config`        | never             | everything else the core accepts (fonts, zoom, rulers, ...). Read once at initialization; a later change warns and is ignored |

`modules` and `ui` are compared by reference, so define them in `<script setup>` rather than inline in the
template. An object literal in the template is a new reference on every parent render, which rebuilds the
editor and discards unsaved edits.

For anything the props do not cover, reach the instance:

```vue
<script setup lang="ts">
import { useTemplateRef } from 'vue';
import type { SuperDocEditorExpose } from '@superdoc/vue';

const editor = useTemplateRef<SuperDocEditorExpose>('editor');

async function exportDocx() {
  // `getInstance()` returns null until initialization finishes.
  await editor.value?.getInstance()?.export({ triggerDownload: true });
}
</script>

<template>
  <SuperDocEditor ref="editor" :document="file" />
</template>
```

## Events

`@ready`, `@editor-create`, `@editor-destroy`, `@editor-update`, `@transaction`, `@content-error`,
`@exception`, `@zoom-change`, `@viewport-change`, and `@update:document-mode` for `v-model`. Payload types are
derived from the core config callbacks, so they match `superdoc@2` exactly.

`@transaction` is the exception: `superdoc@2` declares and defaults `onTransaction` but never calls it, so
nothing emits this event today. It is here because `@superdoc/react` exposes the same callback and this
package tracks that surface; it starts working the moment core emits. Use `@editor-update` for document
changes in the meantime.

Handle document failures through events, not the `#error` slot. That slot renders only when the instance could
not be created at all. A document that fails to parse or import arrives as `@content-error`, and a runtime
failure as `@exception`; neither blanks the editor.

## Custom UI

To replace the built-in toolbar, hide it with `ui` and drive your own controls with the Vue composables from
[`superdoc/ui/vue`](https://docs.superdoc.dev).

Put `provideSuperDocUI()` in an ancestor and the composables in a descendant. Vue resolves an injection from
ancestors only, so a component cannot consume what it provides itself: calling `useSuperDocCommand()` beside
`provideSuperDocUI()` throws the "must be used under" error.

```vue
<!-- Editor.vue - provides the binding and owns the editor -->
<script setup lang="ts">
import { SuperDocEditor } from '@superdoc/vue';
import type { SuperDocReadyEvent } from '@superdoc/vue';
import { provideSuperDocUI } from 'superdoc/ui/vue';
import type { SuperDocHost } from 'superdoc/ui/vue';
import BoldButton from './BoldButton.vue';

const { setSuperDoc, clearSuperDoc } = provideSuperDocUI();
let boundHost: SuperDocHost | null = null;

function handleReady({ superdoc }: SuperDocReadyEvent) {
  boundHost = superdoc;
  setSuperDoc(superdoc);
}

// Pass the instance being torn down. Teardown races with rebuilding, and an
// unconditional clear would unbind a replacement that has already bound.
function handleDestroy() {
  if (boundHost) clearSuperDoc(boundHost);
  boundHost = null;
}

const ui = { toolbar: false };
</script>

<template>
  <BoldButton />
  <SuperDocEditor :document="file" :ui="ui" @ready="handleReady" @editor-destroy="handleDestroy" />
</template>
```

```vue
<!-- BoldButton.vue - a descendant, so the injection resolves -->
<script setup lang="ts">
import { useSuperDocCommand, useSuperDocUI } from 'superdoc/ui/vue';

const ui = useSuperDocUI();
const bold = useSuperDocCommand('bold');

// `useSuperDocCommand` reports state; it does not run anything. Execution goes
// through the controller, so the button needs both. Inspect the result when the
// next step depends on the command having applied: it can be refused without
// throwing.
async function toggleBold() {
  await ui.value?.commands.executeAsync('bold');
}
</script>

<template>
  <button :disabled="!bold.enabled" :aria-pressed="bold.active" @click="toggleBold">Bold</button>
</template>
```

The providing component does not have to inject to read the controller: `provideSuperDocUI()` returns the same
binding it publishes.

## Server-side rendering

The component renders its containers on the server and loads SuperDoc from a mounted effect, so no browser
global is touched during server rendering. Nuxt hydration and navigation teardown still need a dedicated
acceptance test before this package can promise every SSR configuration without `ssr: false`.

## Requirements

- Vue `^3.5.11`
- `superdoc` `>=2.0.0-0 <3` (peer dependency)
