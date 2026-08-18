import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { SidebarSectionLink } from '@/components/SidebarSectionLink';

export function baseOptions(): BaseLayoutProps {
  return {
    links: [
      {
        type: 'custom',
        children: (
          <SidebarSectionLink activePrefix='/editor' excludeActivePrefix='/editor/migrate-from-v1' href='/editor'>
            Editor
          </SidebarSectionLink>
        ),
      },
      {
        text: 'Agents & automation',
        url: '/agents/overview',
        active: 'nested-url',
      },
      {
        text: 'Document API',
        url: '/document-api/mental-model',
        active: 'nested-url',
      },
      {
        type: 'custom',
        children: (
          <SidebarSectionLink activePrefix='/resources' href='/resources/how-superdoc-works'>
            Resources
          </SidebarSectionLink>
        ),
      },
      {
        type: 'custom',
        children: (
          <SidebarSectionLink activePrefix='/editor/migrate-from-v1' href='/editor/migrate-from-v1/overview'>
            Migrate from v1
          </SidebarSectionLink>
        ),
      },
    ],
    nav: {
      title: <span className='sd-sidebar-title'>Documentation</span>,
      url: '/',
      transparentMode: 'none',
    },
  };
}
