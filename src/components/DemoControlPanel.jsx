import { useState, useEffect, useCallback } from 'react';
import './DemoControlPanel.css';

const EDGE_URL = import.meta.env.VITE_EDGE_URL || 'http://PI.local:5000';

const MODEL_STATS = {
  accuracy: '81.6%',
  f1:       '76.8%',
  cv_f1:    '77.6% ± 0.9%',
  samples:  '8,372 train / 2,093 test',
  model:    'Random Forest (100 trees)',
  dataset:  'MIT-BIH Arrhythmia Database',
};

const BEAT_DESCRIPTIONS = {
  N: { label: 'Normal beat',                      color: '#00d2a0' },
  V: { label: 'Premature Ventricular Contraction', color: '#ff5252' },
  A: { label: 'Atrial Premature Contraction',      color: '#fbbf24' },
  L: { label: 'Left Bundle Branch Block',          color: '#ff5252' },
  R: { label: 'Right Bundle Branch Block',         color: '#ff5252' },
  '/': { label: 'Paced beat',                      color: '#a29bfe' },
};

/* ════════════════════════════════════════════════════════
   DEMO CONTROL PANEL
   Calls the RPi edge server (VITE_EDGE_URL / PI.local:5000)
   NOT the Render cloud API.
════════════════════════════════════════════════════════ */
const DemoControlPanel = () => {
  const [records, setRecords]           = useState([]);
  const [selectedRecord, setSelected]   = useState('100');
  const [running, setRunning]           = useState(false);
  const [currentRecord, setCurrentRec]  = useState(null);
  const [groundTruth, setGroundTruth]   = useState(null);
  const [gtError, setGtError]           = useState('');
  const [msg, setMsg]                   = useState(null);
  const [loading, setLoading]           = useState(false);
  const [switching, setSwitching]       = useState(false);
  const [open, setOpen]                 = useState(false);

  /* ── Load available demo records from RPi ────────────── */
  useEffect(() => {
    if (!open) return;
    fetch(`${EDGE_URL}/api/demo/records`)
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) ? data : [];
        setRecords(list);
        if (list.length > 0 && !selectedRecord) setSelected(list[0].record);
      })
      .catch(() => {
        // RPi offline — use static fallback
        setRecords([
          { record: '100', name: 'Normal Sinus Rhythm',        arrhythmia: 'None',                  description: 'Healthy baseline, regular beats ~75 BPM',          expected_model_response: 'Normal consistently' },
          { record: '119', name: 'PVCs',                       arrhythmia: 'Premature Ventricular',  description: 'Normal with frequent early beats',                 expected_model_response: 'Oscillates Normal/ABNORMAL' },
          { record: '200', name: 'Ventricular Bigeminy',       arrhythmia: 'Bigeminy (PVC every other beat)', description: 'Every other beat is abnormal',            expected_model_response: 'ABNORMAL within 15s' },
          { record: '201', name: 'AFib + PVCs',                arrhythmia: 'Atrial Fibrillation',    description: 'Highly irregular, varying HR',                     expected_model_response: 'Strong ABNORMAL' },
        ]);
      });
  }, [open]);

  /* ── Poll ground truth while running ─────────────────── */
  const fetchGroundTruth = useCallback(() => {
    if (!running) return;
    fetch(`${EDGE_URL}/api/demo/ground-truth`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setGtError(d.error); setGroundTruth(null); }
        else { setGroundTruth(d); setGtError(''); }
      })
      .catch(() => setGtError('RPi unreachable'));
  }, [running]);

  useEffect(() => {
    if (!running) return;
    fetchGroundTruth();
    const id = setInterval(fetchGroundTruth, 2000);
    return () => clearInterval(id);
  }, [running, fetchGroundTruth]);

  /* ── Start demo ───────────────────────────────────────── */
  const handleStart = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const r = await fetch(`${EDGE_URL}/api/demo/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ record: selectedRecord, mode: 'mitbih' }),
      });
      const d = await r.json();
      if (d.ok) {
        setRunning(true);
        setCurrentRec(d);
        setMsg({ type: 'success', text: `Started: ${d.name} — ${d.description}` });
      } else {
        setMsg({ type: 'error', text: d.error || 'Failed to start demo.' });
      }
    } catch {
      setMsg({ type: 'error', text: `Cannot reach RPi at ${EDGE_URL}. Is the edge server running?` });
    } finally {
      setLoading(false);
    }
  };

  /* ── Switch to arrhythmia ─────────────────────────────── */
  const handleSwitchArrhythmia = async () => {
    setSwitching(true);
    setMsg(null);
    try {
      const r = await fetch(`${EDGE_URL}/api/demo/switch-to-arrhythmia`, {
        method: 'POST',
      });
      const d = await r.json();
      if (d.ok) {
        setCurrentRec(d);
        setSelected('200');
        setMsg({ type: 'arrhythmia', text: `Switched to ${d.name} — ABNORMAL alert expected in ~15 seconds` });
      } else {
        setMsg({ type: 'error', text: d.error || 'Switch failed.' });
      }
    } catch {
      setMsg({ type: 'error', text: `Cannot reach RPi at ${EDGE_URL}.` });
    } finally {
      setSwitching(false);
    }
  };

  /* ── Stop demo ────────────────────────────────────────── */
  const handleStop = async () => {
    try {
      await fetch(`${EDGE_URL}/api/stop`, { method: 'POST' });
    } catch { /* silent */ }
    setRunning(false);
    setCurrentRec(null);
    setGroundTruth(null);
    setMsg({ type: 'success', text: 'Demo stopped.' });
  };

  const selectedInfo = records.find(r => r.record === selectedRecord);
  const gtBeat = groundTruth?.beat_label;
  const gtDesc = BEAT_DESCRIPTIONS[gtBeat] || null;
  const modelPred = groundTruth?.model_latest?.label;

  return (
    <div className="demo-panel-wrapper">
      {/* ── Collapsible header ── */}
      <button className="demo-panel-toggle" onClick={() => setOpen(o => !o)}>
        <span className="demo-toggle-icon">🎬</span>
        <span className="demo-toggle-title">Demo Controls</span>
        <span className="demo-toggle-badge">Presentation Mode</span>
        <span className="demo-toggle-chevron">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="demo-panel-body">

          {/* ── Model accuracy badge ── */}
          <div className="demo-model-badge">
            <div className="badge-row">
              <span className="badge-item">
                <span className="badge-label">Accuracy</span>
                <span className="badge-value accent-green">{MODEL_STATS.accuracy}</span>
              </span>
              <span className="badge-divider" />
              <span className="badge-item">
                <span className="badge-label">F1 Score</span>
                <span className="badge-value accent-purple">{MODEL_STATS.f1}</span>
              </span>
              <span className="badge-divider" />
              <span className="badge-item">
                <span className="badge-label">CV F1</span>
                <span className="badge-value accent-teal">{MODEL_STATS.cv_f1}</span>
              </span>
              <span className="badge-divider" />
              <span className="badge-item">
                <span className="badge-label">Model</span>
                <span className="badge-value">{MODEL_STATS.model}</span>
              </span>
            </div>
            <div className="badge-sub">
              Trained on {MODEL_STATS.dataset} · {MODEL_STATS.samples}
            </div>
          </div>

          {/* ── Record selector ── */}
          <div className="demo-section">
            <label className="demo-label">Select Demo Patient Record</label>
            <div className="record-grid">
              {records.map(rec => (
                <button
                  key={rec.record}
                  className={`record-card ${selectedRecord === rec.record ? 'selected' : ''} ${rec.record === '200' || rec.record === '201' ? 'record-danger' : 'record-safe'}`}
                  onClick={() => !running && setSelected(rec.record)}
                  disabled={running}
                  title={rec.description}
                >
                  <div className="record-id">MIT-BIH {rec.record}</div>
                  <div className="record-name">{rec.name}</div>
                  <div className="record-arrhythmia">{rec.arrhythmia}</div>
                  <div className="record-expected">{rec.expected_model_response}</div>
                </button>
              ))}
            </div>

            {selectedInfo && !running && (
              <div className="record-hint">
                {selectedInfo.description}
              </div>
            )}
          </div>

          {/* ── Message toast ── */}
          {msg && (
            <div className={`demo-toast demo-toast-${msg.type}`}>
              {msg.type === 'arrhythmia' ? '🚨' : msg.type === 'success' ? '✅' : '⚠️'} {msg.text}
            </div>
          )}

          {/* ── Control buttons ── */}
          <div className="demo-controls-row">
            {!running ? (
              <button
                className="demo-btn demo-btn-start"
                onClick={handleStart}
                disabled={loading || !selectedRecord}
              >
                {loading ? <span className="demo-spinner" /> : '▶'}
                {loading ? 'Starting…' : 'Start Demo Patient'}
              </button>
            ) : (
              <button className="demo-btn demo-btn-stop" onClick={handleStop}>
                ■ Stop Demo
              </button>
            )}

            <button
              className="demo-btn demo-btn-arrhythmia"
              onClick={handleSwitchArrhythmia}
              disabled={switching || !running}
              title="Mid-demo: instantly switches to Ventricular Bigeminy (record 200). ABNORMAL alert fires in ~15s."
            >
              {switching ? <span className="demo-spinner" /> : '⚡'}
              {switching ? 'Switching…' : 'Switch to Arrhythmia NOW'}
            </button>
          </div>

          {/* ── Running state + ground truth ── */}
          {running && currentRec && (
            <div className="demo-running-state">
              <div className="running-header">
                <div className="running-dot" />
                <span className="running-label">
                  Demo Running — MIT-BIH {currentRec.record}: {currentRec.name}
                </span>
              </div>

              <div className="ground-truth-row">
                <div className="gt-card">
                  <div className="gt-title">MIT-BIH Expert Annotation</div>
                  {gtError ? (
                    <div className="gt-error">{gtError}</div>
                  ) : groundTruth ? (
                    <>
                      <div className="gt-beat" style={{ color: gtDesc?.color || 'var(--text)' }}>
                        {gtBeat || '—'}
                      </div>
                      <div className="gt-desc">{gtDesc?.label || gtBeat}</div>
                    </>
                  ) : (
                    <div className="gt-loading"><span className="demo-spinner" /></div>
                  )}
                </div>

                <div className="gt-arrow">→</div>

                <div className="gt-card">
                  <div className="gt-title">Our Model Says</div>
                  {modelPred ? (
                    <>
                      <div className="gt-beat" style={{
                        color: modelPred === 'ABNORMAL' ? '#ff5252' : '#00d2a0'
                      }}>
                        {modelPred === 'ABNORMAL' ? '⚠' : '✓'}
                      </div>
                      <div className="gt-desc">{modelPred}</div>
                    </>
                  ) : (
                    <div className="gt-loading"><span className="demo-spinner" /></div>
                  )}
                </div>
              </div>

              <div className="gt-legend">
                <span style={{ color: '#00d2a0' }}>N = Normal</span>
                <span style={{ color: '#ff5252' }}>V = PVC (Ventricular)</span>
                <span style={{ color: '#fbbf24' }}>A = Atrial</span>
                <span style={{ color: '#ff5252' }}>L/R = Bundle Branch Block</span>
              </div>

              <div className="demo-hint">
                Open <strong>http://PI.local:5000</strong> to see the live ECG waveform
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
};

export default DemoControlPanel;
