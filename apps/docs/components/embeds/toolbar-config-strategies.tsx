'use client';

import { Fragment } from 'react';
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import { Tabs, TabsContent, TabsList, TabsTrigger } from 'fumadocs-ui/components/ui/tabs';
import {
  toolbarConfigStrategies,
  type ToolbarConfigStrategy,
  type ToolbarDiagramItem,
  type ToolbarDiagramPart,
  type ToolbarStrategyInlinePart,
} from '@/lib/toolbar-config-strategies';

function InlineCopy({ parts }: { parts: readonly ToolbarStrategyInlinePart[] }) {
  return parts.map((part, index) => (
    <Fragment key={`${part.value}-${index}`}>{part.kind === 'code' ? <code>{part.value}</code> : part.value}</Fragment>
  ));
}

function DiagramItem({ item }: { item: ToolbarDiagramItem }) {
  return (
    <span aria-hidden='true' className='sd-toolbar-strategy-item' data-item={item.id}>
      {item.label}
    </span>
  );
}

function DiagramPart({ part, index }: { part: ToolbarDiagramPart; index: number }) {
  if (part.kind === 'item') return <DiagramItem item={part} />;
  if (part.kind === 'separator') return <span aria-hidden='true' className='sd-toolbar-strategy-separator' />;
  if (part.kind === 'spacer') return <span aria-hidden='true' className='sd-toolbar-strategy-spacer' />;

  return (
    <span aria-hidden='true' className='sd-toolbar-strategy-removed' key={`removed-${index}`}>
      {part.items.map((item) => (
        <DiagramItem item={item} key={item.id} />
      ))}
      <span>removed</span>
    </span>
  );
}

function ToolbarDiagram({ strategy }: { strategy: ToolbarConfigStrategy }) {
  if (strategy.diagram.kind === 'groups') {
    return (
      <div aria-label={strategy.visualDescription} className='sd-toolbar-strategy-groups' role='img'>
        {strategy.diagram.groups.map((group) => (
          <div className='sd-toolbar-strategy-group' data-region={group.id} key={group.id}>
            <span aria-hidden='true' className='sd-toolbar-strategy-group-items'>
              {group.items.map((item) => (
                <DiagramItem item={item} key={item.id} />
              ))}
            </span>
            <span aria-hidden='true' className='sd-toolbar-strategy-region'>
              {group.id}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div aria-label={strategy.visualDescription} className='sd-toolbar-strategy-strip' role='img'>
      {strategy.diagram.parts.map((part, index) => (
        <DiagramPart index={index} key={`${part.kind}-${index}`} part={part} />
      ))}
    </div>
  );
}

export function ToolbarConfigStrategies() {
  return (
    <figure
      aria-label='Toolbar configuration strategy comparison'
      className='sd-toolbar-strategies'
      data-toolbar-config-strategies='true'
    >
      <Tabs className='sd-toolbar-strategy-tabs' defaultValue='default'>
        <TabsList aria-label='Toolbar strategy' className='sd-toolbar-strategy-list'>
          {toolbarConfigStrategies.map((strategy) => (
            <TabsTrigger className='sd-toolbar-strategy-trigger' key={strategy.id} value={strategy.id}>
              {strategy.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {toolbarConfigStrategies.map((strategy) => (
          <TabsContent
            className='sd-toolbar-strategy-panel'
            data-strategy={strategy.id}
            key={strategy.id}
            value={strategy.id}
          >
            <div className='sd-toolbar-strategy-preview'>
              <ToolbarDiagram strategy={strategy} />
            </div>

            <DynamicCodeBlock
              code={strategy.code}
              codeblock={{ className: 'sd-toolbar-strategy-code', title: 'ui.toolbar' }}
              lang='ts'
            />

            <p className='sd-toolbar-strategy-caption'>
              <strong>{strategy.summary}</strong> <InlineCopy parts={strategy.description} />
            </p>
          </TabsContent>
        ))}
      </Tabs>
    </figure>
  );
}
