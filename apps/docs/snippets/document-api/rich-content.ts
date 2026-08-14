import { SuperDoc } from 'superdoc';
import 'superdoc/style.css';

const superdoc = new SuperDoc({
  selector: '#editor',
  document: '/contract.docx',
  onReady: async ({ superdoc }) => {
    const doc = superdoc.activeEditor?.doc;
    if (!doc) throw new Error('The active document is unavailable.');

    const converted = await doc.htmlToFragment({
      html: '<h2>Scope</h2><p><strong>Review</strong> this clause.</p>',
    });
    const fatal = converted.diagnostics.find((diagnostic) => diagnostic.severity === 'error');
    if (fatal) throw new Error(`HTML conversion failed: ${fatal.message}`);

    const dryRun = await doc.insert({ content: converted.fragment }, { dryRun: true });
    if (!dryRun.success) throw new Error(`Preflight failed: ${dryRun.failure?.message ?? 'unknown failure'}`);

    const insertReceipt = await doc.insert(
      {
        type: 'html',
        value: '<h2>Scope</h2><p><strong>Review</strong> this clause.</p>',
      },
      { changeMode: 'tracked' },
    );
    if (!insertReceipt.success) {
      throw new Error(`Rich insert failed: ${insertReceipt.failure?.message ?? 'unknown failure'}`);
    }

    const match = await doc.query.match({
      select: { type: 'text', pattern: 'Existing clause' },
      require: 'exactlyOne',
    });
    const clause = match.items[0];
    if (!clause || clause.matchKind !== 'text') throw new Error('The clause was not found.');

    const replaceReceipt = await doc.replace(
      {
        target: clause.target,
        type: 'markdown',
        value: '**Replacement clause** with a [reference](https://example.com/policy).',
      },
      {
        changeMode: 'tracked',
        expectedRevision: match.evaluatedRevision,
      },
    );
    if (!replaceReceipt.success) {
      throw new Error(`Rich replace failed: ${replaceReceipt.failure?.message ?? 'unknown failure'}`);
    }

    console.log(insertReceipt.conversion, replaceReceipt.conversion);
  },
});

window.addEventListener('beforeunload', () => {
  superdoc.destroy();
});
