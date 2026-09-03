import './globals.css';

export const metadata = {
  title: 'SmartScan - Intelligent Compliance Scanner',
  description: 'AI-powered compliance scanning for packaged commodities under Legal Metrology Rules, 2011. Built for Smart India Hackathon 2026.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <header style={{ padding: '1rem 2rem', borderBottom: '1px solid var(--surface-border)', background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 100 }}>
          <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '1200px', margin: '0 auto' }}>
            <a href="/" style={{ fontSize: '1.5rem', fontWeight: '700', letterSpacing: '-0.05em', textDecoration: 'none' }}>
              <span className="gradient-text">SmartScan</span>
            </a>
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
              <a href="/scan" style={{ fontWeight: '500', transition: 'color 0.2s', color: 'var(--text-secondary)' }}>Scanner</a>
              <a href="/admin" style={{ fontWeight: '500', transition: 'color 0.2s', color: 'var(--text-secondary)' }}>Admin</a>
            </div>
          </nav>
        </header>
        <main style={{ flex: 1 }}>
          {children}
        </main>
        <footer style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem', borderTop: '1px solid var(--surface-border)' }}>
          SmartScan by Cult Coders | Smart India Hackathon 2026
        </footer>
      </body>
    </html>
  );
}
