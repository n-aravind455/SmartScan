'use client';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { ShieldAlert, CheckCircle, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AdminDashboard() {
  const [stats, setStats] = useState({ lifetime: 0, today: 0, this_week: 0 });
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);

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
      fetchData(); // refresh list
    } catch (err) {
      alert("Failed to solve complaint");
    }
  };

  return (
    <div className="container" style={{ marginTop: '2rem' }}>
      <div style={{ marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '2.5rem' }}>Admin <span className="gradient-text">Dashboard</span></h1>
        <p style={{ color: 'var(--text-secondary)' }}>Review and manage compliance reports and field complaints.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        <motion.div className="glass-panel" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', textTransform: 'uppercase' }}>Lifetime Complaints</h3>
          <div style={{ fontSize: '2.5rem', fontWeight: '700', marginTop: '0.5rem' }}>{stats.lifetime}</div>
        </motion.div>
        
        <motion.div className="glass-panel" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', textTransform: 'uppercase' }}>This Week</h3>
          <div style={{ fontSize: '2.5rem', fontWeight: '700', marginTop: '0.5rem' }}>{stats.this_week}</div>
        </motion.div>
        
        <motion.div className="glass-panel" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', textTransform: 'uppercase' }}>Today</h3>
          <div style={{ fontSize: '2.5rem', fontWeight: '700', marginTop: '0.5rem', color: 'var(--primary-color)' }}>{stats.today}</div>
        </motion.div>
      </div>

      <motion.div className="glass-panel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
        <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldAlert /> Active Complaints
        </h2>
        
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <Clock size={32} style={{ animation: 'spin 2s linear infinite', margin: '0 auto 1rem', color: 'var(--primary-color)' }} />
            <p>Loading records...</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--surface-border)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '1rem 0' }}>ID</th>
                  <th style={{ padding: '1rem 0' }}>Date</th>
                  <th style={{ padding: '1rem 0' }}>Location / Issue</th>
                  <th style={{ padding: '1rem 0' }}>Status</th>
                  <th style={{ padding: '1rem 0' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {complaints.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-secondary)' }}>
                      No complaints found. All clear!
                    </td>
                  </tr>
                ) : (
                  complaints.map((c) => (
                    <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '1rem 0', fontFamily: 'monospace' }}>#{c.id}</td>
                      <td style={{ padding: '1rem 0' }}>{new Date(c.created_at).toLocaleDateString()}</td>
                      <td style={{ padding: '1rem 0' }}>{c.location}</td>
                      <td style={{ padding: '1rem 0' }}>
                        <span className={`badge ${c.status === 'SOLVED' ? 'success' : 'pending'}`}>
                          {c.status}
                        </span>
                      </td>
                      <td style={{ padding: '1rem 0' }}>
                        {c.status !== 'SOLVED' && (
                          <button 
                            className="btn-secondary" 
                            style={{ padding: '6px 12px', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                            onClick={() => solveComplaint(c.id)}
                          >
                            <CheckCircle size={16} /> Mark Solved
                          </button>
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
    </div>
  );
}
