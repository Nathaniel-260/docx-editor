export const templateFields = [
  {
    key: 'clientLegalName',
    label: 'Client legal name',
    tag: 'client.legalName',
    type: 'text',
  },
  {
    key: 'clientAddress',
    label: 'Client address',
    tag: 'client.address',
    type: 'text',
  },
  {
    key: 'effectiveDate',
    label: 'Effective date',
    tag: 'agreement.effectiveDate',
    type: 'text',
  },
  {
    key: 'autoRenew',
    label: 'Auto-renew',
    tag: 'agreement.autoRenew',
    type: 'checkbox',
  },
] as const;

export type TemplateField = (typeof templateFields)[number];
export type TemplateFieldKey = TemplateField['key'];

type TaggedContentControl = {
  readonly controlType: string;
  readonly properties: { readonly tag?: string };
};

export function hasCompatibleTemplateFields(items: readonly TaggedContentControl[]) {
  return templateFields.every((field) =>
    items.some((item) => item.properties.tag === field.tag && item.controlType === field.type),
  );
}
