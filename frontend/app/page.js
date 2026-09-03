'use client';
import { motion } from 'framer-motion';
import { ScanLine } from 'lucide-react';

export default function Home() {
  return (
    <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 160px)', textAlign: 'center' }}>
      {/* Animated Scan Icon */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        style={{ marginBottom: '2rem' }}
      >
        <div style={{
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(139, 92, 246, 0.15))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto',
          border: '2px solid rgba(59, 130, 246, 0.3)',
          boxShadow: '0 0 60px rgba(59, 130, 246, 0.2)',
        }}>
          <ScanLine size={56} style={{ color: 'var(--primary-color)' }} />
        </div>
      </motion.div>

      {/* Heading */}
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        style={{ fontSize: '3.2rem', fontWeight: '700', lineHeight: '1.15', marginBottom: '1rem' }}
      >
        Intelligent <br />
        <span className="gradient-text">Compliance Scanner</span>
      </motion.h1>

      {/* Subtitle */}
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        style={{ color: 'var(--text-secondary)', fontSize: '1.125rem', maxWidth: '520px', marginBottom: '3rem', lineHeight: '1.6' }}
      >
        Verify packaged commodity labels against the Legal Metrology (Packaged Commodities) Rules, 2011 using AI-powered analysis.
      </motion.p>

      {/* New Scan Button */}
      <motion.a
        href="/scan"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        className="btn-primary"
        style={{
          padding: '18px 48px',
          fontSize: '1.25rem',
          borderRadius: '12px',
          textDecoration: 'none',
          boxShadow: '0 6px 30px rgba(59, 130, 246, 0.4)',
        }}
      >
        <ScanLine size={24} />
        New Scan
      </motion.a>

      {/* Feature Pills */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9, duration: 0.5 }}
        style={{ display: 'flex', gap: '1rem', marginTop: '3rem', flexWrap: 'wrap', justifyContent: 'center' }}
      >
        {['Gemini AI Powered', 'Legal Metrology 2011', 'Burst Camera Capture'].map((text) => (
          <span key={text} style={{
            padding: '8px 16px',
            borderRadius: '999px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            fontSize: '0.875rem',
            color: 'var(--text-secondary)',
          }}>
            {text}
          </span>
        ))}
      </motion.div>
    </div>
  );
}
