'use client';
import { useState, useRef } from 'react';
import axios from 'axios';
import { UploadCloud, CheckCircle, Clock, AlertTriangle, FileText, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Home() {
  const [files, setFiles] = useState([]);
  const [taskId, setTaskId] = useState(null);
  const [status, setStatus] = useState('IDLE'); // IDLE, UPLOADING, PROCESSING, COMPLETED, ERROR
  const [result, setResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [complaintLocation, setComplaintLocation] = useState('');
  const fileInputRef = useRef(null);

  // Read backend URL from environment or fallback
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

  const handleFileChange = (e) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      setFiles(Array.from(e.dataTransfer.files));
    }
  };

  const submitScan = async () => {
    if (files.length === 0) return;
    setStatus('UPLOADING');
    setErrorMessage('');

    const formData = new FormData();
    files.forEach(file => formData.append('files', file));

    try {
      const res = await axios.post(`${backendUrl}/api/scan`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const id = res.data.task_id;
      setTaskId(id);
      setStatus('PROCESSING');
      pollStatus(id);
    } catch (err) {
      setStatus('ERROR');
      setErrorMessage(err.response?.data?.detail || 'Failed to upload images.');
    }
  };

  const pollStatus = async (id) => {
    try {
      const res = await axios.get(`${backendUrl}/api/status/${id}`);
      const data = res.data;
      if (data.status === 'SUCCESS' || data.status === 'COMPLETED') {
        setStatus('COMPLETED');
        fetchReport(id);
      } else if (data.status === 'FAILURE' || data.status === 'ERROR') {
        setStatus('ERROR');
        setErrorMessage(data.error || 'Processing failed.');
      } else {
        setTimeout(() => pollStatus(id), 3000);
      }
    } catch (err) {
      setStatus('ERROR');
      setErrorMessage('Failed to poll status.');
    }
  };

  const fetchReport = async (id) => {
    try {
      const res = await axios.get(`${backendUrl}/api/report/${id}`);
      setResult(res.data);
    } catch (err) {
      setErrorMessage('Report generated, but failed to fetch details.');
    }
  };

  const submitComplaint = async () => {
    if (!complaintLocation) return;
    try {
      await axios.post(`${backendUrl}/api/complaints`, { task_id: taskId, location: complaintLocation });
      alert("Complaint filed successfully!");
      setComplaintLocation('');
    } catch (err) {
      alert("Failed to file complaint.");
    }
  };

  return (
    <div className="container" style={{ marginTop: '2rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
        <motion.h1 
          initial={{ opacity: 0, y: -20 }} 
          animate={{ opacity: 1, y: 0 }}
          style={{ fontSize: '3rem', marginBottom: '1rem' }}>
          Intelligent <span className="gradient-text">Compliance Scanning</span>
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          transition={{ delay: 0.2 }}
          style={{ color: 'var(--text-secondary)', fontSize: '1.125rem', maxWidth: '600px', margin: '0 auto' }}>
          Upload images of your site. Our AI will automatically detect compliance issues and generate a detailed report.
        </motion.p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
        {/* Left Column: Upload */}
        <motion.div className="glass-panel" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UploadCloud /> Upload Images
          </h2>
          
          <div 
            className={`drop-zone ${files.length > 0 ? 'active' : ''}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current.click()}
          >
            <UploadCloud size={48} className="icon" />
            <h3>Drag & Drop your images here</h3>
            <p style={{ color: 'var(--text-secondary)' }}>or click to browse</p>
            <input 
              type="file" 
              multiple 
              accept="image/*" 
              hidden 
              ref={fileInputRef} 
              onChange={handleFileChange} 
            />
          </div>

          {files.length > 0 && (
            <div className="mt-4">
              <p style={{ marginBottom: '1rem', fontWeight: '600' }}>{files.length} file(s) selected:</p>
              <ul style={{ listStyle: 'none', padding: 0, maxHeight: '150px', overflowY: 'auto' }}>
                {files.map((file, i) => (
                  <li key={i} style={{ padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', marginBottom: '4px', fontSize: '0.875rem' }}>
                    {file.name}
                  </li>
                ))}
              </ul>
              
              <button 
                className="btn-primary mt-4" 
                style={{ width: '100%' }}
                onClick={submitScan}
                disabled={status === 'UPLOADING' || status === 'PROCESSING'}
              >
                {status === 'IDLE' || status === 'ERROR' ? 'Start Analysis' : 'Processing...'}
              </button>
            </div>
          )}
        </motion.div>

        {/* Right Column: Status & Results */}
        <motion.div className="glass-panel" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText /> Results
          </h2>

          <AnimatePresence mode="wait">
            {status === 'IDLE' && (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem 0' }}>
                Upload images to see the AI compliance report here.
              </motion.div>
            )}

            {(status === 'UPLOADING' || status === 'PROCESSING') && (
              <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ textAlign: 'center', padding: '2rem 0' }}>
                <Clock size={48} style={{ color: 'var(--primary-color)', margin: '0 auto 1rem', animation: 'spin 2s linear infinite' }} />
                <h3>{status === 'UPLOADING' ? 'Uploading Images...' : 'AI is Analyzing Images...'}</h3>
                <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>This might take a moment. Task ID: {taskId}</p>
              </motion.div>
            )}

            {status === 'ERROR' && (
              <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ textAlign: 'center', padding: '2rem 0' }}>
                <AlertTriangle size={48} style={{ color: 'var(--error-color)', margin: '0 auto 1rem' }} />
                <h3 style={{ color: 'var(--error-color)' }}>Analysis Failed</h3>
                <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>{errorMessage}</p>
              </motion.div>
            )}

            {status === 'COMPLETED' && result && (
              <motion.div key="completed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                  <CheckCircle size={48} style={{ color: 'var(--success-color)', margin: '0 auto 1rem' }} />
                  <h3 style={{ color: 'var(--success-color)' }}>Analysis Complete</h3>
                  <div style={{ marginTop: '1rem' }}>
                    <span className={`badge ${result.compliance?.overall_status === 'PASS' ? 'success' : 'error'}`}>
                      Overall Status: {result.compliance?.overall_status || 'UNKNOWN'}
                    </span>
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', marginBottom: '2rem' }}>
                  <h4 style={{ marginBottom: '1rem' }}>Identified Issues:</h4>
                  {result.compliance?.issues && result.compliance.issues.length > 0 ? (
                    <ul style={{ paddingLeft: '1.5rem', color: 'var(--text-secondary)' }}>
                      {result.compliance.issues.map((issue, idx) => (
                        <li key={idx} style={{ marginBottom: '0.5rem' }}>{issue}</li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ color: 'var(--text-secondary)' }}>No critical issues found.</p>
                  )}
                  
                  {result.report_url && (
                    <a href={`${backendUrl}${result.report_url}`} target="_blank" rel="noreferrer" className="btn-secondary mt-4" style={{ display: 'inline-flex', width: '100%', justifyContent: 'center' }}>
                      Download Full Report <ChevronRight size={20} />
                    </a>
                  )}
                </div>

                <div style={{ borderTop: '1px solid var(--surface-border)', paddingTop: '1.5rem' }}>
                  <h4>File a Complaint</h4>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>If there are physical hazards, log them below.</p>
                  <input 
                    type="text" 
                    placeholder="E.g., Missing railing on 2nd floor" 
                    value={complaintLocation}
                    onChange={(e) => setComplaintLocation(e.target.value)}
                    style={{ marginBottom: '1rem' }}
                  />
                  <button onClick={submitComplaint} className="btn-primary" style={{ width: '100%' }}>Submit Complaint</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      <style jsx global>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
