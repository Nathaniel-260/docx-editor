# @superdoc/vue

Vue 3 wrapper for the [SuperDoc](https://superdoc.dev) browser editor.

> This package is not published to npm yet. For now, it only builds inside this workspace with `superdoc@2`.

`SuperDocEditor` creates the editor, rebuilds it when needed, and destroys it on unmount. Use props and events
for common tasks or a template ref for the core `SuperDoc` instance.

## Quick start

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { SuperDocEditor, type DocumentMode } from '@superdoc/vue';
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

| Prop            | When changed | Notes                                                                  |
| --------------- | ------------ | ---------------------------------------------------------------------- |
| `document`      | Rebuilds     | Accepts a URL, `File`, `Blob`, or `null`                               |
| `document-mode` | Updates      | Supports `v-model:document-mode`                                       |
| `role`          | Rebuilds     |                                                                        |
| `user`, `users` | Rebuilds     | Compared by value                                                      |
| `modules`       | Rebuilds     | Compared by reference because it can contain live objects              |
| `ui`            | Rebuilds     | Compared by reference; `{ toolbar: false }` hides the built-in toolbar |
| `ui-binding`    | Updates      | Connects custom UI to the editor lifecycle                             |
| `contained`     | Rebuilds     | Fits and scrolls inside a fixed-height parent                          |
| `config`        | Ignored      | Read at startup; later changes log a warning                           |

Define `modules` and `ui` in `<script setup>` instead of writing object literals in the template. A new object
reference rebuilds the editor and can discard unsaved edits.

Need the core instance? Use a template ref. `getInstance()` returns `null` until the editor is ready.

```vue
<script setup lang="ts">
import { ref, useTemplateRef } from 'vue';
import { SuperDocEditor, type SuperDocEditorExpose } from '@superdoc/vue';
import '@superdoc/vue/style.css';

const file = ref<File | null>(null);
const editor = useTemplateRef<SuperDocEditorExpose>('editor');

async function exportDocx() {
  await editor.value?.getInstance()?.export({ triggerDownload: true });
}
</script>

<template>
  <SuperDocEditor ref="editor" :document="file" />
</template>
```

## Events and errors

The component emits `@ready`, `@editor-create`, `@editor-destroy`, `@editor-update`, `@transaction`,
`@content-error`, `@exception`, `@zoom-change`, `@viewport-change`, and `@update:document-mode`. Event payload
types come from the core API.

Core does not emit `@transaction` yet. Use `@editor-update` for document changes.

The `#error` slot only handles startup failures. Use `@content-error` for document import errors and
`@exception` for runtime errors.

## Custom UI

To build your own toolbar, set `ui.toolbar` to `false` and use the composables from `superdoc/ui/vue`. Call
`provideSuperDocUI()` in an ancestor of the components that use `useSuperDoc*`, then pass its binding to
`ui-binding`. The editor binds and clears each instance for you.

```vue
<script setup lang="ts">
import { SuperDocEditor } from '@superdoc/vue';
import { provideSuperDocUI } from 'superdoc/ui/vue';
import CustomToolbar from './CustomToolbar.vue';

const uiBinding = provideSuperDocUI();
const ui = { toolbar: false };
</script>

<template>
  <SuperDocEditor :ui="ui" :ui-binding="uiBinding" />
  <CustomToolbar />
</template>
```

```vue
<script setup lang="ts">
import { useSuperDocCommand } from 'superdoc/ui/vue';

const { enabled, active, executeAsync } = useSuperDocCommand('bold');
</script>

<template>
  <button :disabled="!enabled" :aria-pressed="active" @click="executeAsync()">Bold</button>
</template>
```

See the [custom UI guide](https://docs.superdoc.dev/editor/custom-ui/overview) for the controller and command APIs.

## Server-side rendering

The component renders its containers on the server and loads SuperDoc after mounting in the browser. Nuxt
hydration and navigation teardown have not been tested yet, so some apps may still need `ssr: false`.

## Requirements

- Vue `^3.5.11`
- `superdoc` `>=2.0.0-0 <3`
