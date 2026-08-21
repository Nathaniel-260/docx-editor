# React quickstart

Mount SuperDoc with the React wrapper, wait for the document to open, and export through its instance ref.

## Run it

Requires Node 22.12 or newer and pnpm 10.

```bash
pnpm install
pnpm dev
```

Open the printed URL. When the document is ready, edit its text and choose **Export DOCX**.

## Verify it

```bash
pnpm typecheck
pnpm build
pnpm browsers
pnpm test
```

The component tests verify readiness and instance-ref export. The browser test edits a real DOCX, exports it, and verifies the edit in `word/document.xml`.

Inside this monorepo the example is tested against the current workspace build. A standalone copy installs the versions declared in `package.json`.

See [Mount SuperDoc in React](https://docs.superdoc.dev/editor/frameworks/react) for the guided explanation.
