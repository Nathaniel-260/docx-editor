'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

type SidebarSectionLinkProps = {
  activePrefix: string;
  children: ReactNode;
  excludeActivePrefix?: string;
  href: string;
};

function matchesPath(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function SidebarSectionLink({ activePrefix, children, excludeActivePrefix, href }: SidebarSectionLinkProps) {
  const pathname = usePathname();
  const isActive =
    matchesPath(pathname, activePrefix) && (excludeActivePrefix == null || !matchesPath(pathname, excludeActivePrefix));

  return (
    <Link
      className='relative flex w-full flex-row items-center gap-2 rounded-lg p-2 text-start text-fd-muted-foreground wrap-anywhere transition-colors hover:bg-fd-accent/50 hover:text-fd-accent-foreground/80 hover:transition-none data-[active=true]:bg-fd-primary/10 data-[active=true]:text-fd-primary data-[active=true]:hover:transition-colors [&_svg]:size-4 [&_svg]:shrink-0'
      data-active={isActive}
      href={href}
      style={{ paddingInlineStart: 'calc(2 * var(--spacing))' }}
    >
      {children}
    </Link>
  );
}
