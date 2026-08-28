# Add content controls to a DOCX template

Create an inline text field and a block clause field from document selections, then export the authored DOCX.

## Run it

Requires Node 22.12 or newer and pnpm 11.

```bash
pnpm install
pnpm dev
```

Select the client name to create an inline field. Place the caret below **Confidentiality** to insert a block field.

## Verify it

```bash
pnpm typecheck
pnpm build
pnpm browsers
pnpm test
```

The browser test creates both fields, exports the DOCX, and reopens it to verify their structure and metadata.

See [Add fields to a DOCX template](https://docs.superdoc.dev/editor/content-controls/add-fields-to-a-docx-template) for the complete walkthrough.
