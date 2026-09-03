'use client';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { ShieldAlert, CheckCircle, Clock, MapPin, Download, FileText, BarChart3, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AdminDashboard() {
  const [stats, setStats] = useState({ lifetime: 0, today: 0, this_week: 0 });
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('ALL');

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, compRes] = await Promise.all([
        axios.get(`${backendUrl}/api/admin/complaints/stats`),
        axios.get(`${backendUrl}/api/admin/complaints`)
      ]);
      setStats(statsRes.data);
      setComplaints(compRes.data);
    } catch (err) {
      console.error("Failed to fetch admin data", err);
    } finally {
      setLoading(false);
    }
  };

  const solveComplaint = async (id) => {
    try {
      await axios.put(`${backendUrl}/api/admin/complaints/${id}/solve`);
      fetchData();
    } catch (err) {
      alert("Failed to solve complaint");
    }
  };

  const filteredComplaints = filterStatus === 'ALL'
    ? complaints
    : complaints.filter(c => c.status === filterStatus);

  return (
    <div className="container" style={{ marginTop: '2rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem' }}>
            <div style={{
              padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700',
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(139, 92, 246, 0.2))',
              border: '1px solid rgba(59, 130, 246, 0.3)', color: 'var(--primary-color)',
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              DoCA Dashboard
            </div>
          </div>
          <h1 style={{ fontSize: '2.25rem' }}>Admin <span className="gradient-text">Dashboard</span></h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Department of Consumer Affairs — Violation Monitoring & Reporting
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2.5rem' }}>
        <motion.div className="glass-panel" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}
        >
          <div style={{
            width: '48px', height: '48px', borderRadius: '12px',
            background: 'rgba(139, 92, 246, 0.15)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <BarChart3 size={24} style={{ color: '#8b5cf6' }} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lifetime</div>
            <div style={{ fontSize: '2rem', fontWeight: '700' }}>{stats.lifetime}</div>
          </div>
        </motion.div>

        <motion.div className="glass-panel" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}
        >
          <div style={{
            width: '48px', height: '48px', borderRadius: '12px',
            background: 'rgba(245, 158, 11, 0.15)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <AlertTriangle size={24} style={{ color: '#f59e0b' }} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>This Week</div>
            <div style={{ fontSize: '2rem', fontWeight: '700' }}>{stats.this_week}</div>
          </div>
        </motion.div>

        <motion.div className="glass-panel" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}
        >
          <div style={{
            width: '48px', height: '48px', borderRadius: '12px',
            background: 'rgba(239, 68, 68, 0.15)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <ShieldAlert size={24} style={{ color: '#ef4444' }} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Today</div>
            <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--primary-color)' }}>{stats.today}</div>
          </div>
        </motion.div>
      </div>

      {/* Complaints Table */}
      <motion.div className="glass-panel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={22} /> Geo-Tagged Violations
          </h2>

          {/* Filter Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {['ALL', 'OPEN', 'SOLVED'].map((f) => (
              <button
                key={f}
                onClick={() => setFilterStatus(f)}
                style={{
                  padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--surface-border)',
                  background: filterStatus === f ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                  color: filterStatus === f ? 'var(--primary-color)' : 'var(--text-secondary)',
                  cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600',
                  transition: 'all 0.2s',
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <Clock size={32} style={{ animation: 'spin 2s linear infinite', margin: '0 auto 1rem', color: 'var(--primary-color)' }} />
            <p>Loading violation records...</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--surface-border)', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '1rem 0.5rem' }}>ID</th>
                  <th style={{ padding: '1rem 0.5rem' }}>Date</th>
                  <th style={{ padding: '1rem 0.5rem' }}>Location / Issue</th>
                  <th style={{ padding: '1rem 0.5rem' }}>Status</th>
                  <th style={{ padding: '1rem 0.5rem' }}>Report</th>
                  <th style={{ padding: '1rem 0.5rem' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredComplaints.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-secondary)' }}>
                      {filterStatus === 'ALL' ? 'No violations logged yet.' : `No ${filterStatus.toLowerCase()} violations.`}
                    </td>
                  </tr>
                ) : (
                  filteredComplaints.map((c) => (
                    <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }}>
                      <td style={{ padding: '1rem 0.5rem', fontFamily: 'monospace', fontSize: '0.875rem', color: 'var(--primary-color)' }}>
                        #{c.id}
                      </td>
                      <td style={{ padding: '1rem 0.5rem', fontSize: '0.875rem' }}>
                        {new Date(c.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td style={{ padding: '1rem 0.5rem', maxWidth: '300px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                          <MapPin size={14} style={{ color: 'var(--text-secondary)', marginTop: '3px', flexShrink: 0 }} />
                          <span style={{ fontSize: '0.875rem' }}>{c.location}</span>
                        </div>
                      </td>
                      <td style={{ padding: '1rem 0.5rem' }}>
                        <span className={`badge ${c.status === 'SOLVED' ? 'success' : 'error'}`}>
                          {c.status}
                        </span>
                      </td>
                      <td style={{ padding: '1rem 0.5rem' }}>
                        {c.report_url && (
                          <a
                            href={`${backendUrl}${c.report_url}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '4px',
                              color: 'var(--primary-color)', fontSize: '0.8rem', fontWeight: '500',
                            }}
                          >
                            <Download size={14} /> PDF
                          </a>
                        )}
                      </td>
                      <td style={{ padding: '1rem 0.5rem' }}>
                        {c.status !== 'SOLVED' ? (
                          <button
                            className="btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                            onClick={() => solveComplaint(c.id)}
                          >
                            <CheckCircle size={14} /> Resolve
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: 'var(--success-color)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle size={14} /> Resolved
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
