'use client';

import { type KeyboardEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import { Check, CircleX, Clipboard } from 'lucide-react';
import {
  codeValue,
  configClosingLines,
  configFieldIndent,
  configFieldTemplate,
  configOpeningLines,
  configSourceNames,
  configTemplate,
  type ConfigExplorerData,
  type ConfigField,
  type ConfigFieldGroup,
} from '@/lib/config-explorer';

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
  const groupListRef = useRef<HTMLDivElement>(null);
  const groupButtonRefs = useRef(new Map<string, HTMLButtonElement>());
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

  useEffect(() => {
    const groupList = groupListRef.current;
    if (!groupList) return;

    const markOverflow = () => {
      const atStart = groupList.scrollLeft <= 1;
      const atEnd = groupList.scrollLeft + groupList.clientWidth >= groupList.scrollWidth - 1;
      groupList.dataset.overflow = atStart ? (atEnd ? 'none' : 'end') : atEnd ? 'start' : 'both';
    };
    const resizeObserver = new ResizeObserver(markOverflow);
    resizeObserver.observe(groupList);
    groupList.addEventListener('scroll', markOverflow, { passive: true });
    markOverflow();

    return () => {
      resizeObserver.disconnect();
      groupList.removeEventListener('scroll', markOverflow);
    };
  }, [groups.length]);

  useEffect(() => {
    const groupList = groupListRef.current;
    const activeButton = groupButtonRefs.current.get(activeGroupId);
    if (!groupList || !activeButton) return;

    const groupListRect = groupList.getBoundingClientRect();
    const activeButtonRect = activeButton.getBoundingClientRect();
    if (activeButtonRect.left < groupListRect.left) {
      groupList.scrollLeft += activeButtonRect.left - groupListRect.left;
    }
    if (activeButtonRect.right > groupListRect.right) {
      groupList.scrollLeft += activeButtonRect.right - groupListRect.right;
    }
  }, [activeGroupId]);

  async function copyConfig() {
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    try {
      const code =
        data.copyMode === 'selected-field' ? configFieldTemplate(data, activeGroup, selected) : configTemplate(data);
      await navigator.clipboard.writeText(code);
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

  function moveBetweenGroups(event: KeyboardEvent<HTMLButtonElement>, currentGroupId: string) {
    const currentIndex = groups.findIndex((group) => group.id === currentGroupId);
    if (currentIndex < 0) return;

    let nextIndex: number | undefined;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % groups.length;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + groups.length) % groups.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = groups.length - 1;
    if (nextIndex === undefined) return;

    event.preventDefault();
    const nextGroup = groups[nextIndex];
    selectGroup(nextGroup.id);
    groupButtonRefs.current.get(nextGroup.id)?.focus();
  }

  if (!activeGroup || !selected) return null;
  const copyTarget = data.copyMode === 'selected-field' ? `${selected.name} example` : `${data.root} setup`;
  const sourceNames = configSourceNames(data);
  const onlySource = sourceNames[0];
  const fieldCount = `${data.fields.length} ${data.fields.length === 1 ? 'field' : 'fields'}`;

  return (
    <div className='sd-config-explorer-wrap'>
      <div className='sd-config-explorer' id={data.id} data-config-explorer>
        <div className='sd-config-explorer-bar'>
          <div
            className='sd-config-explorer-groups'
            role='tablist'
            aria-label={`${data.name} option groups`}
            ref={groupListRef}
          >
            {groups.map((group) => {
              const isActive = group.id === activeGroup.id;
              return (
                <button
                  key={group.id}
                  type='button'
                  id={`${data.id}-${group.id}-tab`}
                  role='tab'
                  aria-controls={`${data.id}-panel`}
                  aria-selected={isActive}
                  tabIndex={isActive ? 0 : -1}
                  ref={(button) => {
                    if (button) groupButtonRefs.current.set(group.id, button);
                    else groupButtonRefs.current.delete(group.id);
                  }}
                  onClick={() => selectGroup(group.id)}
                  onKeyDown={(event) => moveBetweenGroups(event, group.id)}
                >
                  {group.label}
                </button>
              );
            })}
          </div>
          <span className='sd-config-explorer-source'>{data.name}</span>
          <button
            className='sd-config-explorer-copy'
            data-status={copyStatus}
            type='button'
            onClick={() => void copyConfig()}
            aria-label={
              copyStatus === 'copied' ? 'Copied' : copyStatus === 'failed' ? 'Copy failed' : `Copy ${copyTarget}`
            }
            aria-live='polite'
            title={copyStatus === 'copied' ? 'Copied' : copyStatus === 'failed' ? 'Copy failed' : `Copy ${copyTarget}`}
          >
            {copyStatus === 'copied' ? (
              <Check aria-hidden='true' />
            ) : copyStatus === 'failed' ? (
              <CircleX aria-hidden='true' />
            ) : (
              <Clipboard aria-hidden='true' />
            )}
          </button>
        </div>
        <div
          className='sd-config-explorer-body'
          id={`${data.id}-panel`}
          role='tabpanel'
          aria-labelledby={`${data.id}-${activeGroup.id}-tab`}
        >
          <div className='sd-config-explorer-code'>
            <ConfigOpeningLine data={data} group={activeGroup} />
            {activeGroup.fields.map((field) => (
              <button
                key={field.name}
                type='button'
                className='sd-config-explorer-field'
                data-selected={field.name === selected.name}
                aria-pressed={field.name === selected.name}
                onClick={() => setSelectedName(field.name)}
              >
                <span>{configFieldIndent(data, activeGroup)}</span>
                <span className='sd-config-explorer-field-name'>{field.key ?? field.name}</span>
                <span>: </span>
                <ConfigValue value={codeValue(field)} />
                <span>,</span>
              </button>
            ))}
            <ConfigClosingLine data={data} group={activeGroup} />
          </div>
          <ConfigFieldDetail key={selected.name} field={selected} />
        </div>
      </div>
      {sourceNames.length === 1 ? (
        <p className='sd-config-explorer-caption'>
          {fieldCount} · generated from <code>{onlySource}</code>
        </p>
      ) : (
        <p className='sd-config-explorer-caption'>
          {fieldCount} · generated from{' '}
          {sourceNames.map((source, index) => (
            <span key={source}>
              {index > 0 ? ' + ' : null}
              <code>{source}</code>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

function ConfigOpeningLine({ data, group }: { data: ConfigExplorerData; group: ConfigFieldGroup }) {
  return configOpeningLines(data, group).map((line, index) => (
    <div className='sd-config-explorer-line' key={`${group.id}-opening-${index}`}>
      <ConfigLine line={line} typedVariable={data.syntax === 'typed-variable'} />
    </div>
  ));
}

function ConfigClosingLine({ data, group }: { data: ConfigExplorerData; group: ConfigFieldGroup }) {
  return configClosingLines(data, group).map((line, index) => (
    <div className='sd-config-explorer-line' key={`${group.id}-closing-${index}`}>
      <ConfigLine line={line} typedVariable={data.syntax === 'typed-variable'} />
    </div>
  ));
}

function ConfigLine({ line, typedVariable }: { line: string; typedVariable: boolean }) {
  const property = line.match(/^(\s*)(\w+): \{$/u);
  if (property) {
    return (
      <>
        {property[1]}
        <span className='sd-config-explorer-field-name'>{property[2]}</span>: {'{'}
      </>
    );
  }
  if (!typedVariable) return line;
  const opening = line.match(/^const (\w+) = \{$/u);
  if (opening) {
    return (
      <>
        <span className='sd-config-explorer-token-keyword'>const</span>{' '}
        <span className='sd-config-explorer-token-type'>{opening[1]}</span> = {'{'}
      </>
    );
  }
  const closing = line.match(/^\} satisfies (\w+);$/u);
  if (closing) {
    return (
      <>
        {'}'} <span className='sd-config-explorer-token-keyword'>satisfies</span>{' '}
        <span className='sd-config-explorer-token-type'>{closing[1]}</span>;
      </>
    );
  }
  return line;
}

const configValueToken = /\/\*[\s\S]*?\*\/|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|[A-Za-z_$][\w$]*(?=\s*:)|=>/gu;

function ConfigValue({ value }: { value: string }) {
  const content: ReactNode[] = [];
  let position = 0;

  for (const match of value.matchAll(configValueToken)) {
    const start = match.index ?? 0;
    if (start > position) content.push(value.slice(position, start));

    const token = match[0];
    const className = token.startsWith('/*')
      ? 'sd-config-explorer-token-comment'
      : token.startsWith("'") || token.startsWith('"')
        ? 'sd-config-explorer-token-string'
        : token === '=>'
          ? 'sd-config-explorer-token-keyword'
          : 'sd-config-explorer-field-name';
    content.push(
      <span className={className} key={`${start}-${token}`}>
        {token}
      </span>,
    );
    position = start + token.length;
  }

  if (position < value.length) content.push(value.slice(position));
  return <span className='sd-config-explorer-field-value'>{content}</span>;
}

function ConfigFieldDetail({ field }: { field: ConfigField }) {
  const [shapeExpanded, setShapeExpanded] = useState(false);
  const hasShape = Boolean(field.typeName && field.typeName !== field.type);
  const note = field.kind === 'reserved' ? 'Not read by the runtime yet.' : null;
  const requirement = field.required ? 'required' : field.kind === 'required-to-run' ? 'required for feature' : null;

  return (
    <section className='sd-config-explorer-detail' aria-live='polite' aria-label={`${field.name} configuration`}>
      {requirement || field.deprecated ? (
        <div className='sd-config-explorer-badges'>
          {requirement ? <span data-kind='required'>{requirement}</span> : null}
          {field.deprecated ? <span data-kind='deprecated'>deprecated</span> : null}
        </div>
      ) : null}
      <div className='sd-config-explorer-detail-heading'>
        <code>{field.name}</code>
      </div>
      <p>{field.summary ?? field.description}</p>
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
                  {shapeExpanded ? 'Hide full type' : 'Show full type'}
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
      {field.summary && field.summary !== field.description ? (
        <details className='sd-config-explorer-api-details'>
          <summary>API details</summary>
          <p>{field.description}</p>
        </details>
      ) : null}
      {field.deprecated ? (
        <p className='sd-config-explorer-note' data-kind='deprecated'>
          Deprecated.
          {field.deprecatedReplacement ? (
            <>
              {' '}
              Use <code>{field.deprecatedReplacement}</code> instead.
            </>
          ) : null}
        </p>
      ) : null}
      {field.status ? <p className='sd-config-explorer-note'>{field.status}</p> : null}
      {note ? (
        <p className='sd-config-explorer-note' data-kind={field.kind}>
          {note}
        </p>
      ) : null}
      {field.guide ? (
        <a className='sd-config-explorer-guide' href={field.guide.href}>
          Full guide: {field.guide.label} →
        </a>
      ) : null}
    </section>
  );
}
