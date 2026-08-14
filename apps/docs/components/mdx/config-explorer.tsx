'use client';

import { Check, Copy } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import { codeValue, configTemplate, type ConfigExplorerData, type ConfigField } from '@/lib/config-explorer';

type ConfigExplorerProps = {
  data: ConfigExplorerData;
  initialField?: string;
};

export function ConfigExplorer({ data, initialField }: ConfigExplorerProps) {
  const initialSelection = data.fields.find((field) => field.name === initialField) ?? data.fields[0];
  const [activeGroupId, setActiveGroupId] = useState(initialSelection?.group ?? data.groups[0]?.id ?? '');
  const [selectedName, setSelectedName] = useState(initialSelection?.name ?? '');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const resetTimer = useRef<number | null>(null);
  const groups = useMemo(
    () =>
      data.groups
        .map((group) => ({ ...group, fields: data.fields.filter((field) => field.group === group.id) }))
        .filter((group) => group.fields.length > 0),
    [data],
  );
  const activeGroup = groups.find((group) => group.id === activeGroupId) ?? groups[0];
  const selected = activeGroup?.fields.find((field) => field.name === selectedName) ?? activeGroup?.fields[0];

  useEffect(
    () => () => {
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    },
    [],
  );

  async function copyConfig() {
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    try {
      await navigator.clipboard.writeText(configTemplate(data));
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
    resetTimer.current = window.setTimeout(() => {
      setCopyStatus('idle');
      resetTimer.current = null;
    }, 1600);
  }

  function selectGroup(groupId: string) {
    const group = groups.find((candidate) => candidate.id === groupId);
    if (!group) return;
    setActiveGroupId(group.id);
    setSelectedName(group.fields[0]?.name ?? '');
  }

  if (!activeGroup || !selected) return null;

  return (
    <div className='sd-config-explorer' id={data.id} data-config-explorer>
      <div className='sd-config-explorer-groups' role='group' aria-label={`${data.name} option groups`}>
        {groups.map((group) => (
          <button
            key={group.id}
            type='button'
            aria-pressed={group.id === activeGroup.id}
            onClick={() => selectGroup(group.id)}
          >
            {group.label}
          </button>
        ))}
      </div>
      <div className='sd-config-explorer-body'>
        <div className='sd-config-explorer-code'>
          <button
            className='sd-config-explorer-copy'
            type='button'
            onClick={() => void copyConfig()}
            aria-label={`Copy ${data.root} setup`}
            title={copyStatus === 'copied' ? 'Copied' : copyStatus === 'failed' ? 'Copy failed' : 'Copy setup'}
          >
            {copyStatus === 'copied' ? <Check aria-hidden='true' /> : <Copy aria-hidden='true' />}
            <span className='sr-only' aria-live='polite'>
              {copyStatus === 'copied' ? 'Copied' : copyStatus === 'failed' ? 'Copy failed' : 'Copy setup'}
            </span>
          </button>
          <div className='sd-config-explorer-line sd-config-explorer-line-muted'>
            {data.root}: {'{'}
          </div>
          {activeGroup.fields.map((field) => (
            <button
              key={field.name}
              type='button'
              className='sd-config-explorer-field'
              data-selected={field.name === selected.name}
              aria-pressed={field.name === selected.name}
              onClick={() => setSelectedName(field.name)}
            >
              <span>{'  '}</span>
              <span className='sd-config-explorer-field-name'>{field.name}</span>
              <span>: </span>
              <span className='sd-config-explorer-field-value'>{codeValue(field)}</span>
              <span>,</span>
            </button>
          ))}
          <div className='sd-config-explorer-line sd-config-explorer-line-muted'>{'}'}</div>
        </div>
        <ConfigFieldDetail key={selected.name} field={selected} />
      </div>
    </div>
  );
}

function ConfigFieldDetail({ field }: { field: ConfigField }) {
  const [shapeExpanded, setShapeExpanded] = useState(false);
  const hasShape = Boolean(field.typeName && field.typeName !== field.type);
  const note =
    field.kind === 'reserved' ? 'Not read by the runtime yet.' : field.kind === 'required-to-run' ? 'Required.' : null;

  return (
    <section className='sd-config-explorer-detail' aria-live='polite' aria-label={`${field.name} configuration`}>
      <div className='sd-config-explorer-detail-heading'>
        <code>{field.name}</code>
      </div>
      <p>{field.description}</p>
      <dl className='sd-config-explorer-meta'>
        <div className='sd-config-explorer-meta-type'>
          <dt>Type</dt>
          <dd>
            <div className='sd-config-explorer-type-summary'>
              <code>{field.typeName ?? field.type}</code>
              {hasShape ? (
                <button
                  className='sd-config-explorer-shape-toggle'
                  type='button'
                  aria-expanded={shapeExpanded}
                  onClick={() => setShapeExpanded((expanded) => !expanded)}
                >
                  {shapeExpanded ? 'Hide shape' : 'Show shape'}
                </button>
              ) : null}
            </div>
            {hasShape && shapeExpanded ? (
              <DynamicCodeBlock
                lang='ts'
                code={field.type}
                codeblock={{
                  allowCopy: false,
                  className: 'sd-config-explorer-shape',
                  viewportProps: { className: 'sd-config-explorer-shape-viewport' },
                }}
              />
            ) : null}
          </dd>
        </div>
        {field.default ? (
          <div>
            <dt>Default</dt>
            <dd>
              <code>{field.default}</code>
            </dd>
          </div>
        ) : null}
      </dl>
      {note ? (
        <p className='sd-config-explorer-note' data-kind={field.kind}>
          {note}
        </p>
      ) : null}
    </section>
  );
}
