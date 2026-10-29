import './globals.css';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Next.js Content Console',
  description: 'App Router Caching, Streaming, and Partial Failure Resilient Console',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="container">
          <header className="header-nav">
            <div className="logo-area">
              <span className="logo-badge">Next 16 App Router</span>
              <Link href="/articles" style={{ fontWeight: 700, fontSize: '18px', color: 'inherit' }}>
                Content Console
              </Link>
            </div>
            <nav className="nav-links">
              <Link href="/articles" className="btn btn-secondary">
                Articles
              </Link>
              <Link href="/articles/new" className="btn btn-primary">
                + Publish Article
              </Link>
            </nav>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
