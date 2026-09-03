'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import axios from 'axios';
import { ShieldCheck, ShieldAlert, AlertTriangle, Clock, Download, FileWarning, ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ResultsPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '6rem 0' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>}>
      <ResultsContent />
    </Suspense>
  );
}

function ResultsContent() {
  const searchParams = useSearchParams();
  const taskId = searchParams.get('task_id');

  const [status, setStatus] = useState('LOADING'); // LOADING, POLLING, DONE, ERROR
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [complaintLocation, setComplaintLocation] = useState('');
  const [complaintSubmitted, setComplaintSubmitted] = useState(false);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

  useEffect(() => {
    if (!taskId) {
      setError('No task ID provided.');
      setStatus('ERROR');
      return;
    }
    pollStatus(taskId);
  }, [taskId]);

  const pollStatus = async (id) => {
    setStatus('POLLING');
    try {
      const res = await axios.get(`${backendUrl}/api/status/${id}`);
      const data = res.data;

      if (data.status === 'SUCCESS' || data.status === 'COMPLETED') {
        fetchReport(id);
      } else if (data.status === 'FAILURE' || data.status === 'ERROR') {
        setError(data.error || 'Processing failed.');
        setStatus('ERROR');
      } else {
        setTimeout(() => pollStatus(id), 3000);
      }
    } catch (err) {
      setError('Failed to connect to the server.');
      setStatus('ERROR');
    }
  };

  const fetchReport = async (id) => {
    try {
      const res = await axios.get(`${backendUrl}/api/report/${id}`);
      setReport(res.data);
      setStatus('DONE');
    } catch (err) {
      setError('Failed to fetch the report.');
      setStatus('ERROR');
    }
  };

  const submitComplaint = async () => {
    if (!complaintLocation.trim()) return;
    try {
      await axios.post(`${backendUrl}/api/complaints`, {
        task_id: taskId,
        location: complaintLocation,
      });
      setComplaintSubmitted(true);
    } catch (err) {
      alert('Failed to file complaint.');
    }
  };

  const compliance = report?.compliance;
  const verdict = compliance?.verdict;
  const isPass = verdict === 'PASS';
  const isWarning = verdict === 'WARNING';
  const isFail = verdict === 'FAIL';

  return (
    <div className="container" style={{ maxWidth: '800px', marginTop: '2rem' }}>
      <AnimatePresence mode="wait">
        {/* ── LOADING / POLLING ── */}
        {(status === 'LOADING' || status === 'POLLING') && (
          <motion.div
            key="polling"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ textAlign: 'center', padding: '6rem 0' }}
          >
            <div className="spinner" style={{ margin: '0 auto 2rem' }} />
            <h2 style={{ fontSize: '1.75rem', marginBottom: '0.75rem' }}>
              Analyzing Compliance...
            </h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto' }}>
              Gemini Flash is extracting label data and the Rule Engine is cross-referencing against Legal Metrology Rules, 2011.
            </p>
          </motion.div>
        )}

        {/* ── ERROR ── */}
        {status === 'ERROR' && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{ textAlign: 'center', padding: '6rem 0' }}
          >
            <FileWarning size={64} style={{ color: 'var(--error-color)', margin: '0 auto 1.5rem' }} />
            <h2 style={{ color: 'var(--error-color)', marginBottom: '1rem' }}>Analysis Failed</h2>
            <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
            <a href="/" className="btn-primary" style={{ marginTop: '2rem', display: 'inline-flex' }}>
              Back to Home
            </a>
          </motion.div>
        )}

        {/* ── RESULTS ── */}
        {status === 'DONE' && report && (
          <motion.div
            key="results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* ──────── THE FLASHING VERDICT BADGE ──────── */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              style={{ textAlign: 'center', marginBottom: '3rem' }}
            >
              <div
                className={`verdict-badge ${isPass ? 'verdict-pass' : isFail ? 'verdict-fail' : 'verdict-warning'}`}
              >
                <div className="verdict-icon">
                  {isPass && <ShieldCheck size={72} />}
                  {isFail && <ShieldAlert size={72} />}
                  {isWarning && <AlertTriangle size={72} />}
                </div>
                <h1 className="verdict-text">
                  {isPass && 'Compliant'}
                  {isFail && 'Violation Detected'}
                  {isWarning && 'Warning'}
                </h1>
              </div>

              <p style={{ color: 'var(--text-secondary)', marginTop: '1.5rem', fontSize: '1rem' }}>
                Checked against Legal Metrology (Packaged Commodities) Rules, 2011
              </p>
            </motion.div>

            {/* ──────── GEMINI AI REASONING ──────── */}
            {compliance?.gemini_reasoning && (
              <motion.div
                className="glass-panel"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                style={{ marginBottom: '1.5rem' }}
              >
                <h3 style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.25rem' }}>🤖</span> Gemini AI Analysis
                </h3>
                <p style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
                  {compliance.gemini_reasoning}
                </p>
              </motion.div>
            )}

            {/* ──────── SCORE SUMMARY ──────── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              style={{
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '1rem', marginBottom: '1.5rem',
              }}
            >
              <div className="glass-panel" style={{ textAlign: 'center', padding: '1.25rem' }}>
                <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--success-color)' }}>
                  {compliance?.passed || 0}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Passed</div>
              </div>
              <div className="glass-panel" style={{ textAlign: 'center', padding: '1.25rem' }}>
                <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--error-color)' }}>
                  {compliance?.failed || 0}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Failed</div>
              </div>
              <div className="glass-panel" style={{ textAlign: 'center', padding: '1.25rem' }}>
                <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--primary-color)' }}>
                  {compliance?.total_checks || 0}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Total Checks</div>
              </div>
            </motion.div>

            {/* ──────── VIOLATIONS LIST ──────── */}
            {compliance?.violations && compliance.violations.length > 0 && (
              <motion.div
                className="glass-panel"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                style={{ marginBottom: '1.5rem', borderColor: 'rgba(239, 68, 68, 0.3)' }}
              >
                <h3 style={{ marginBottom: '1rem', color: 'var(--error-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldAlert size={20} /> Violations Found
                </h3>
                <ul style={{ paddingLeft: '1.5rem', color: 'var(--text-secondary)', lineHeight: '2' }}>
                  {compliance.violations.map((v, i) => (
                    <li key={i}>{v}</li>
                  ))}
                </ul>
              </motion.div>
            )}

            {/* ──────── WARNINGS ──────── */}
            {compliance?.warnings && compliance.warnings.length > 0 && (
              <motion.div
                className="glass-panel"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
                style={{ marginBottom: '1.5rem', borderColor: 'rgba(245, 158, 11, 0.3)' }}
              >
                <h3 style={{ marginBottom: '1rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={20} /> Warnings
                </h3>
                <ul style={{ paddingLeft: '1.5rem', color: 'var(--text-secondary)', lineHeight: '2' }}>
                  {compliance.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </motion.div>
            )}

            {/* ──────── DETAILED CHECKS (collapsible) ──────── */}
            <motion.div
              className="glass-panel"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              style={{ marginBottom: '1.5rem' }}
            >
              <button
                onClick={() => setShowDetails(!showDetails)}
                style={{
                  background: 'none', border: 'none', color: 'var(--text-primary)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                  width: '100%', justifyContent: 'space-between', fontSize: '1rem', fontWeight: '600',
                }}
              >
                <span>Detailed Check Results</span>
                {showDetails ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>

              <AnimatePresence>
                {showDetails && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    style={{ overflow: 'hidden', marginTop: '1rem' }}
                  >
                    {compliance?.checks?.map((check, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
                        }}
                      >
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', flex: 1 }}>
                          {check.description}
                        </span>
                        <span className={`badge ${check.status === 'PASS' ? 'success' : check.status === 'FAIL' ? 'error' : 'pending'}`}>
                          {check.status}
                        </span>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* ──────── PDF DOWNLOAD ──────── */}
            {report?.report_url && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 }}
                style={{ marginBottom: '1.5rem' }}
              >
                <a
                  href={`${backendUrl}${report.report_url}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary"
                  style={{ width: '100%', display: 'flex', justifyContent: 'center', padding: '14px' }}
                >
                  <Download size={18} /> Download Legal PDF Report
                </a>
              </motion.div>
            )}

            {/* ──────── FILE COMPLAINT (for violations) ──────── */}
            {isFail && !complaintSubmitted && (
              <motion.div
                className="glass-panel"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                style={{ borderColor: 'rgba(239, 68, 68, 0.2)' }}
              >
                <h3 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MapPin size={18} /> File a Complaint
                </h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  Report this violation to the Department of Consumer Affairs.
                </p>
                <input
                  type="text"
                  placeholder="Describe the issue or location (e.g., 'MRP missing at XYZ Store, Chennai')"
                  value={complaintLocation}
                  onChange={(e) => setComplaintLocation(e.target.value)}
                  style={{ marginBottom: '1rem' }}
                />
                <button onClick={submitComplaint} className="btn-primary" style={{ width: '100%' }}>
                  Submit Complaint
                </button>
              </motion.div>
            )}

            {complaintSubmitted && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass-panel"
                style={{ textAlign: 'center', borderColor: 'rgba(16, 185, 129, 0.3)' }}
              >
                <ShieldCheck size={32} style={{ color: 'var(--success-color)', margin: '0 auto 0.5rem' }} />
                <p style={{ color: 'var(--success-color)', fontWeight: '600' }}>Complaint filed successfully!</p>
              </motion.div>
            )}

            {/* ──────── NEW SCAN BUTTON ──────── */}
            <div style={{ textAlign: 'center', marginTop: '2rem', marginBottom: '2rem' }}>
              <a href="/" className="btn-primary" style={{ padding: '14px 40px' }}>
                New Scan
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .spinner {
          width: 60px; height: 60px;
          border: 4px solid var(--surface-border);
          border-top-color: var(--primary-color);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── Flashing Verdict Badges ── */
        .verdict-badge {
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          padding: 3rem 4rem;
          border-radius: 24px;
          gap: 1rem;
        }
        .verdict-text {
          font-size: 2.5rem;
          font-weight: 800;
          letter-spacing: -0.03em;
        }

        /* ── GREEN: Compliant ── */
        .verdict-pass {
          background: rgba(16, 185, 129, 0.1);
          border: 2px solid rgba(16, 185, 129, 0.4);
          animation: flashGreen 1.5s ease-in-out 3;
        }
        .verdict-pass .verdict-icon { color: #10b981; }
        .verdict-pass .verdict-text { color: #10b981; }

        @keyframes flashGreen {
          0%, 100% { box-shadow: 0 0 0px rgba(16, 185, 129, 0.2); }
          50% { box-shadow: 0 0 60px rgba(16, 185, 129, 0.5), 0 0 120px rgba(16, 185, 129, 0.2); }
        }

        /* ── RED: Violation Detected ── */
        .verdict-fail {
          background: rgba(239, 68, 68, 0.1);
          border: 2px solid rgba(239, 68, 68, 0.4);
          animation: flashRed 1s ease-in-out infinite;
        }
        .verdict-fail .verdict-icon { color: #ef4444; }
        .verdict-fail .verdict-text { color: #ef4444; }

        @keyframes flashRed {
          0%, 100% { box-shadow: 0 0 0px rgba(239, 68, 68, 0.2); }
          50% { box-shadow: 0 0 60px rgba(239, 68, 68, 0.6), 0 0 120px rgba(239, 68, 68, 0.3); }
        }

        /* ── AMBER: Warning ── */
        .verdict-warning {
          background: rgba(245, 158, 11, 0.1);
          border: 2px solid rgba(245, 158, 11, 0.4);
          animation: flashAmber 1.5s ease-in-out 5;
        }
        .verdict-warning .verdict-icon { color: #f59e0b; }
        .verdict-warning .verdict-text { color: #f59e0b; }

        @keyframes flashAmber {
          0%, 100% { box-shadow: 0 0 0px rgba(245, 158, 11, 0.2); }
          50% { box-shadow: 0 0 60px rgba(245, 158, 11, 0.5), 0 0 120px rgba(245, 158, 11, 0.2); }
        }
      `}</style>
    </div>
  );
}
