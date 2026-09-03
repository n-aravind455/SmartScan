import './globals.css';

export const metadata = {
  title: 'SmartScan - Compliance Automation',
  description: 'AI-powered compliance scanning and reporting.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <header style={{ padding: '1rem 2rem', borderBottom: '1px solid var(--surface-border)', background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 100 }}>
          <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', letterSpacing: '-0.05em' }}>
              <span className="gradient-text">SmartScan</span>
            </div>
            <div style={{ display: 'flex', gap: '1.5rem' }}>
              <a href="/" style={{ fontWeight: '500', transition: 'color 0.2s' }}>Scanner</a>
              <a href="/admin" style={{ fontWeight: '500', transition: 'color 0.2s' }}>Admin</a>
            </div>
          </nav>
        </header>
        <main style={{ flex: 1 }}>
          {children}
        </main>
        <footer style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem', borderTop: '1px solid var(--surface-border)' }}>
          © {new Date().getFullYear()} SmartScan AI. All rights reserved.
        </footer>
      </body>
    </html>
  );
}
