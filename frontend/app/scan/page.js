'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import axios from 'axios';
import { Camera, X, RotateCcw, Send, ImagePlus, Zap, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ScanPage() {
  const [phase, setPhase] = useState('PERMISSION'); // PERMISSION, CAMERA, REVIEW, UPLOADING, PROCESSING
  const [captures, setCaptures] = useState([]);
  const [stream, setStream] = useState(null);
  const [error, setError] = useState('');
  const [taskId, setTaskId] = useState(null);
  const [burstActive, setBurstActive] = useState(false);
  const [geoLocation, setGeoLocation] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

  // Request camera permission
  const requestCamera = useCallback(async () => {
    try {
      setError('');
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      setStream(mediaStream);
      setPhase('CAMERA');

      // Also request GPS location (non-blocking)
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => setGeoLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => {}, // silently ignore geo errors
          { enableHighAccuracy: true, timeout: 10000 }
        );
      }
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setError('Camera permission denied. Please allow camera access in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        setError('No camera found on this device.');
      } else {
        setError('Failed to access camera: ' + err.message);
      }
    }
  }, []);

  // Callback ref: attach stream immediately when the <video> mounts
  const attachVideoRef = useCallback((node) => {
    videoRef.current = node;
    if (node && stream) {
      node.srcObject = stream;
    }
  }, [stream]);

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [stream]);

  // Capture a single frame
  const captureFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCaptures(prev => [...prev, dataUrl]);
  }, []);

  // Burst capture: take 5 photos in quick succession
  const burstCapture = useCallback(async () => {
    setBurstActive(true);
    for (let i = 0; i < 5; i++) {
      captureFrame();
      await new Promise(resolve => setTimeout(resolve, 400));
    }
    setBurstActive(false);
  }, [captureFrame]);

  // Remove a capture
  const removeCapture = (index) => {
    setCaptures(prev => prev.filter((_, i) => i !== index));
  };

  // Submit captures to backend
  const submitScan = async () => {
    if (captures.length === 0) return;

    // Stop camera
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }

    setPhase('UPLOADING');
    setError('');

    try {
      // Convert data URLs to blobs
      const formData = new FormData();
      for (let i = 0; i < captures.length; i++) {
        const res = await fetch(captures[i]);
        const blob = await res.blob();
        formData.append('files', blob, `capture_${i + 1}.jpg`);
      }

      const response = await axios.post(`${backendUrl}/api/scan`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const id = response.data.task_id;
      setTaskId(id);
      setPhase('PROCESSING');
      pollStatus(id);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to upload images.');
      setPhase('REVIEW');
    }
  };

  // Poll status
  const pollStatus = async (id) => {
    try {
      const res = await axios.get(`${backendUrl}/api/status/${id}`);
      const data = res.data;

      if (data.status === 'SUCCESS' || data.status === 'COMPLETED') {
        // Navigate to results page with geo info
        const geoParams = geoLocation ? `&lat=${geoLocation.lat}&lng=${geoLocation.lng}` : '';
        window.location.href = `/results?task_id=${id}${geoParams}`;
      } else if (data.status === 'FAILURE' || data.status === 'ERROR') {
        setError(data.error || 'Processing failed.');
        setPhase('REVIEW');
      } else {
        setTimeout(() => pollStatus(id), 3000);
      }
    } catch (err) {
      setError('Lost connection while polling. Task ID: ' + id);
      setPhase('REVIEW');
    }
  };

  return (
    <div className="container" style={{ maxWidth: '800px', marginTop: '1.5rem' }}>
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <AnimatePresence mode="wait">
        {/* ── PERMISSION PHASE ── */}
        {phase === 'PERMISSION' && (
          <motion.div
            key="permission"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{ textAlign: 'center', padding: '4rem 0' }}
          >
            <div style={{
              width: '100px', height: '100px', borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(139, 92, 246, 0.15))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 2rem', border: '2px solid rgba(59, 130, 246, 0.3)',
            }}>
              <Camera size={48} style={{ color: 'var(--primary-color)' }} />
            </div>

            <h2 style={{ fontSize: '1.75rem', marginBottom: '1rem' }}>Camera Access Required</h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto 2rem', lineHeight: '1.6' }}>
              We need your camera to capture burst photos of all sides of the packaged commodity for compliance analysis.
            </p>

            <button onClick={requestCamera} className="btn-primary" style={{ padding: '16px 40px', fontSize: '1.1rem' }}>
              <Camera size={20} /> Allow Camera Access
            </button>

            {error && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{
                marginTop: '2rem', padding: '1rem', borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
                color: 'var(--error-color)', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center'
              }}>
                <AlertCircle size={18} /> {error}
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ── CAMERA PHASE ── */}
        {phase === 'CAMERA' && (
          <motion.div
            key="camera"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.5rem' }}>
                Capture Product <span className="gradient-text">({captures.length} shots)</span>
              </h2>
              {captures.length > 0 && (
                <button onClick={() => setPhase('REVIEW')} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.875rem' }}>
                  Review & Submit
                </button>
              )}
            </div>

            {/* Video Preview */}
            <div style={{
              borderRadius: '16px', overflow: 'hidden', position: 'relative',
              border: '2px solid var(--surface-border)', marginBottom: '1rem',
              background: '#000',
            }}>
              <video
                ref={attachVideoRef}
                autoPlay
                playsInline
                muted
                style={{ width: '100%', display: 'block', minHeight: '300px', maxHeight: '500px', objectFit: 'cover' }}
              />

              {/* Burst indicator */}
              {burstActive && (
                <div style={{
                  position: 'absolute', top: '16px', right: '16px',
                  padding: '6px 14px', borderRadius: '999px',
                  background: 'rgba(239, 68, 68, 0.9)', color: '#fff',
                  fontSize: '0.875rem', fontWeight: '600',
                  animation: 'pulse 0.5s infinite',
                }}>
                  BURST
                </div>
              )}

              {/* Capture count overlay */}
              <div style={{
                position: 'absolute', bottom: '16px', left: '16px',
                padding: '6px 14px', borderRadius: '999px',
                background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: '0.875rem',
              }}>
                {captures.length} / 10 captures
              </div>
            </div>

            {/* Camera Controls */}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', alignItems: 'center' }}>
              <button
                onClick={captureFrame}
                className="btn-secondary"
                style={{ padding: '14px 24px', fontSize: '1rem' }}
              >
                <ImagePlus size={20} /> Single Shot
              </button>

              <button
                onClick={burstCapture}
                disabled={burstActive}
                className="btn-primary"
                style={{ padding: '14px 32px', fontSize: '1rem' }}
              >
                <Zap size={20} /> Burst Capture (5x)
              </button>
            </div>

            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '1rem' }}>
              Rotate the product slowly and use <strong>Burst Capture</strong> to cover all sides.
            </p>

            {/* Thumbnail Strip */}
            {captures.length > 0 && (
              <div style={{
                display: 'flex', gap: '8px', marginTop: '1.5rem',
                overflowX: 'auto', padding: '8px 0',
              }}>
                {captures.map((src, i) => (
                  <div key={i} style={{ position: 'relative', flexShrink: 0 }}>
                    <img
                      src={src}
                      alt={`Capture ${i + 1}`}
                      style={{
                        width: '80px', height: '60px', objectFit: 'cover',
                        borderRadius: '8px', border: '1px solid var(--surface-border)',
                      }}
                    />
                    <button
                      onClick={() => removeCapture(i)}
                      style={{
                        position: 'absolute', top: '-6px', right: '-6px',
                        width: '20px', height: '20px', borderRadius: '50%',
                        background: 'var(--error-color)', border: 'none',
                        color: '#fff', cursor: 'pointer', fontSize: '10px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ── REVIEW PHASE ── */}
        {phase === 'REVIEW' && (
          <motion.div
            key="review"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>
              Review Captures <span className="gradient-text">({captures.length} images)</span>
            </h2>

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: '12px', marginBottom: '2rem',
            }}>
              {captures.map((src, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <img
                    src={src}
                    alt={`Capture ${i + 1}`}
                    style={{
                      width: '100%', height: '120px', objectFit: 'cover',
                      borderRadius: '12px', border: '1px solid var(--surface-border)',
                    }}
                  />
                  <button
                    onClick={() => removeCapture(i)}
                    style={{
                      position: 'absolute', top: '6px', right: '6px',
                      width: '24px', height: '24px', borderRadius: '50%',
                      background: 'var(--error-color)', border: 'none',
                      color: '#fff', cursor: 'pointer', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>

            {error && (
              <div style={{
                marginBottom: '1.5rem', padding: '1rem', borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
                color: 'var(--error-color)', display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                <AlertCircle size={18} /> {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => { requestCamera(); }}
                className="btn-secondary"
                style={{ flex: 1, padding: '14px' }}
              >
                <RotateCcw size={18} /> Retake
              </button>
              <button
                onClick={submitScan}
                disabled={captures.length === 0}
                className="btn-primary"
                style={{ flex: 2, padding: '14px', fontSize: '1.05rem' }}
              >
                <Send size={18} /> Analyze ({captures.length} images)
              </button>
            </div>
          </motion.div>
        )}

        {/* ── UPLOADING / PROCESSING PHASE ── */}
        {(phase === 'UPLOADING' || phase === 'PROCESSING') && (
          <motion.div
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ textAlign: 'center', padding: '4rem 0' }}
          >
            <div className="spinner" style={{ margin: '0 auto 2rem' }} />
            <h2 style={{ fontSize: '1.75rem', marginBottom: '0.75rem' }}>
              {phase === 'UPLOADING' ? 'Uploading Images...' : 'AI is Analyzing...'}
            </h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto' }}>
              {phase === 'UPLOADING'
                ? `Sending ${captures.length} images to the server.`
                : 'Gemini Flash is checking compliance against Legal Metrology Rules, 2011. This may take a moment.'}
            </p>
            {taskId && (
              <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                Task ID: <code style={{ color: 'var(--primary-color)' }}>{taskId}</code>
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .spinner {
          width: 60px;
          height: 60px;
          border: 4px solid var(--surface-border);
          border-top-color: var(--primary-color);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
