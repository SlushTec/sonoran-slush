import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/Header';
import './globals.css';
export const metadata: Metadata = {
  title: { default: 'Sonoran Slush | Native storefront foundation', template: '%s | Sonoran Slush' },
  description: 'Development foundation for personalized gifts, custom engraving and live events. Not a live store.',
  robots: {index:false,follow:false},
};
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return <html lang="en"><body><a className="skip-link" href="#main">Skip to content</a>
    <div className="build-notice">Development foundation — browsing references only. Orders, payments and uploads are not enabled.</div>
    <Header/><main id="main" tabIndex={-1}>{children}</main>
    <footer><div className="footer-inner"><div><strong>Sonoran Slush Creative Creations</strong><p>Personalized gifts · Custom engraving · Live events</p></div>
    <nav aria-label="Footer"><Link href="/about">About</Link><Link href="/help">Help & contact</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/account">Account</Link></nav></div>
    <p className="footer-note">Native AWS build · Production integrations pending · No customer information collected here</p></footer>
  </body></html>;
}
