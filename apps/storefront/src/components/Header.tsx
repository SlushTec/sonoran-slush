'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
const items = [['/shop','Shop gifts'],['/custom-orders','Custom & bulk'],['/events','Live events'],['/our-work','Our work'],['/help','Help']];
export default function Header() {
  const [open,setOpen] = useState(false);
  const pathname = usePathname();
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && open) { setOpen(false); button.current?.focus(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  return <header className="site-header"><div className="header-inner">
    <Link className="brand" href="/" aria-label="Sonoran Slush home"><strong>Sonoran Slush</strong><span>Creative Creations</span></Link>
    <button ref={button} type="button" className="menu-toggle" aria-expanded={open} aria-controls="primary-navigation" onClick={() => setOpen(!open)}>Menu</button>
    <nav id="primary-navigation" aria-label="Primary" className={open ? 'primary-nav open' : 'primary-nav'}>
      {items.map(([href,label]) => <Link key={href} href={href} aria-current={pathname === href || pathname.startsWith(href+'/') ? 'page' : undefined}>{label}</Link>)}
      <Link href="/cart">Cart</Link>
    </nav>
  </div></header>;
}
