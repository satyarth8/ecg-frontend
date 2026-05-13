import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import api from '../api/axiosInstance';
import './DoctorPage.css';

/* ─── Constants ───────────────────────────────────────── */
const POLL_INTERVAL_MS = 30_000; // poll alerts every 30s

/* ─── Helpers ─────────────────────────────────────────── */
const initials = (name = '') =>
  name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '??';

// Append 'Z' if the ISO string lacks a timezone suffix so the browser
// always interprets it as UTC rather than ambiguous local time.
const toUtcDate = (iso) => {
  if (!iso) return null;
  return new Date(/[Z+]/.test(iso) ? iso : iso + 'Z');
};

const fmtTime = (iso) => {
  const d = toUtcDate(iso);
  if (!d) return '—';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const fmtDateTime = (iso) => {
  const d = toUtcDate(iso);
  if (!d) return '—';
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/* ─── Custom Tooltip for Recharts ─────────────────────── */
const BpmTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#1a1a35', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 8, padding: '0.5rem 0.75rem', fontSize: '0.82rem',
    }}>
      <p style={{ color: '#8888aa', marginBottom: 2 }}>{label}</p>
      <p style={{ color: '#a29bfe', fontWeight: 700 }}>{payload[0].value} BPM</p>
      {payload[1] && (
        <p style={{ color: payload[1].value === 'ABNORMAL' ? '#ff5252' : '#00d2a0', fontWeight: 600 }}>
          {payload[1].value}
        </p>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   DOCTOR PAGE
═══════════════════════════════════════════════════════ */
const DoctorPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  /* patients list */
  const [patients, setPatients] = useState([]);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState(null);

  /* ECG history for selected patient */
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  /* alerts */
  const [alerts, setAlerts] = useState([]);
  const [hasUnacked, setHasUnacked] = useState(false);
  const [ackingId, setAckingId] = useState(null);

  /* map patient_id → has active alert (for sidebar dot) */
  const [alertMap, setAlertMap] = useState({});

  const pollRef = useRef(null);
  const audioCtxRef = useRef(null);

  /* ── Fetch patient list ───────────────────────────── */
  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get('/api/doctor/patients');
        const list = data.patients || [];
        setPatients(list);
        if (list.length > 0) setSelectedPatient(list[0]);
      } catch {
        setPatients([]);
      } finally {
        setPatientsLoading(false);
      }
    };
    load();
  }, []);

  /* ── Fetch ECG history when patient changes ────────── */
  useEffect(() => {
    if (!selectedPatient) return;
    setHistoryLoading(true);
    setHistory([]);

    const load = async () => {
      try {
        const { data } = await api.get(
          `/api/patients/${selectedPatient._id}/ecg-history?limit=288`
          // 288 × 5s windows ≈ 24 hours
        );
        const summaries = data.summaries || [];
        // Shape for Recharts — keep epoch for ordering, formatted label for display
        const shaped = summaries.map(s => {
          const d = toUtcDate(s.start_time);
          return {
            time: d
              ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
              : '—',
            epoch: d ? d.getTime() : 0,
            bpm: Math.round(s.heart_rate ?? 0),
            sqi: parseFloat((s.sqi ?? 0).toFixed(2)),
            prediction: s.prediction || 'Normal',
          };
        }).sort((a, b) => a.epoch - b.epoch);
        setHistory(shaped);
      } catch {
        setHistory([]);
      } finally {
        setHistoryLoading(false);
      }
    };
    load();
  }, [selectedPatient]);

  /* ── Play audio ping for unacknowledged alert ──────── */
  const playPing = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.6);
    } catch { /* audio blocked — browser interaction required */ }
  }, []);

  /* ── Poll alerts ────────────────────────────────────── */
  const pollAlerts = useCallback(async () => {
    if (!selectedPatient) return;
    try {
      const { data } = await api.get(
        `/api/alerts?patient_id=${selectedPatient._id}`
      );
      const unacked = (data.alerts || []).filter(a => !a.acknowledged);
      setAlerts(data.alerts || []);

      // Build sidebar alert map across all patients
      const map = {};
      (data.all_alerts || unacked).forEach(a => {
        if (a.patient_id) map[a.patient_id] = true;
      });
      setAlertMap(map);

      const nowHasUnacked = unacked.length > 0;
      if (nowHasUnacked && !hasUnacked) {
        playPing(); // new alert arrived — play ping
      }
      setHasUnacked(nowHasUnacked);
    } catch {
      /* network down — silent */
    }
  }, [selectedPatient, hasUnacked, playPing]);

  /* start / restart polling when patient changes */
  useEffect(() => {
    pollAlerts(); // immediate first poll
    pollRef.current = setInterval(pollAlerts, POLL_INTERVAL_MS);
    return () => clearInterval(pollRef.current);
  }, [pollAlerts]);

  /* ── Acknowledge alert ──────────────────────────────── */
  const acknowledgeAlert = async (alertId) => {
    setAckingId(alertId);
    try {
      await api.post(`/api/alerts/${alertId}/acknowledge`);
      setAlerts(prev => prev.map(a => a._id === alertId ? { ...a, acknowledged: true } : a));
      const stillUnacked = alerts.some(a => a._id !== alertId && !a.acknowledged);
      setHasUnacked(stillUnacked);
    } catch { /* silent */ }
    finally { setAckingId(null); }
  };

  /* ── Derived stats from history ─────────────────────── */
  const latestEntry = history[history.length - 1] ?? null;
  const lastBpm = latestEntry?.bpm ?? null;
  const lastPrediction = latestEntry?.prediction ?? null;
  const lastSqi = latestEntry?.sqi ?? null;
  const avgBpm = history.length
    ? Math.round(history.reduce((s, e) => s + e.bpm, 0) / history.length)
    : null;

  const unackedAlerts = alerts.filter(a => !a.acknowledged);

  const handleLogout = () => { logout(); navigate('/login', { replace: true }); };

  const userInitials = user?.username
    ? user.username.slice(0, 2).toUpperCase() : 'DR';

  /* ══════════════════════════════════════════════════════
     RENDER
  ═════════════════════════════════════════════════════ */
  return (
    <div className="doctor-layout">

      {/* ── Patient Sidebar ── */}
      <aside className="patient-sidebar">
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <span className="brand-icon">💓</span>
            <span className="brand-name">ECG Monitor</span>
          </div>
          <div className="sidebar-user-chip">
            <div className="user-avatar-sm">{userInitials}</div>
            <div className="user-label">
              <div className="uname">{user?.username || 'Doctor'}</div>
              <div className="urole">{user?.role || 'doctor'}</div>
            </div>
          </div>
        </div>

        <p className="sidebar-section-title">My Patients</p>

        <div className="patient-list">
          {patientsLoading ? (
            <div style={{ display:'flex', justifyContent:'center', padding:'2rem' }}>
              <div className="spinner" />
            </div>
          ) : patients.length === 0 ? (
            <div style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
              No patients assigned yet.
            </div>
          ) : patients.map(p => (
            <div
              key={p._id}
              id={`patient-item-${p._id}`}
              className={`patient-item ${selectedPatient?._id === p._id ? 'active' : ''}`}
              onClick={() => setSelectedPatient(p)}
            >
              <div className="patient-avatar">{initials(p.name)}</div>
              <div className="patient-meta">
                <div className="patient-name">{p.name}</div>
                <div className="patient-room">
                  {p.assigned_room ? `Room ${p.assigned_room}` : 'No room assigned'}
                </div>
              </div>
              {(alertMap[p._id] || (selectedPatient?._id === p._id && hasUnacked)) && (
                <div className="alert-dot" title="Active alert" />
              )}
            </div>
          ))}
        </div>

        <button id="doctor-logout-btn" className="sidebar-logout-btn" onClick={handleLogout}>
          Sign Out
        </button>
      </aside>

      {/* ── Main ── */}
      <main className="doctor-main">

        {/* Header */}
        <header className="doctor-header">
          {selectedPatient ? (
            <div className="header-patient-info">
              <div className="header-patient-avatar">{initials(selectedPatient.name)}</div>
              <div>
                <div className="header-patient-name">{selectedPatient.name}</div>
                <div className="header-patient-sub">
                  {selectedPatient.assigned_room
                    ? `Room ${selectedPatient.assigned_room}`
                    : 'No room'} · ID: {selectedPatient._id?.slice(-6)}
                </div>
              </div>
            </div>
          ) : (
            <div className="header-patient-name">Select a patient</div>
          )}

          <div className="header-right">
            <div className="poll-indicator">
              <div className="poll-dot" />
              Polling every 30s
            </div>
            {lastPrediction && (
              lastPrediction === 'ABNORMAL'
                ? <span className="badge-abnormal">⚠ ABNORMAL</span>
                : <span className="badge-normal">✓ Normal</span>
            )}
          </div>
        </header>

        {/* Alert Banner — shown when unacknowledged ABNORMAL alerts exist */}
        {hasUnacked && unackedAlerts.length > 0 && (
          <div className="alert-banner" role="alert" aria-live="assertive">
            <span className="alert-banner-icon">🚨</span>
            <div className="alert-banner-text">
              <div className="alert-banner-title">
                ABNORMAL ECG DETECTED — {unackedAlerts.length} unacknowledged alert{unackedAlerts.length > 1 ? 's' : ''}
              </div>
              <div className="alert-banner-sub">
                Last: {fmtDateTime(unackedAlerts[0]?.timestamp)} ·
                Consecutive windows: {unackedAlerts[0]?.consecutive_count ?? '?'} ·
                Confidence: {unackedAlerts[0]?.probability != null
                  ? `${(unackedAlerts[0].probability * 100).toFixed(0)}%` : '?'}
              </div>
            </div>
            <button
              id={`ack-btn-${unackedAlerts[0]?._id}`}
              className="ack-btn"
              disabled={ackingId === unackedAlerts[0]?._id}
              onClick={() => acknowledgeAlert(unackedAlerts[0]._id)}
            >
              {ackingId === unackedAlerts[0]?._id ? 'Acknowledging…' : 'Acknowledge'}
            </button>
          </div>
        )}

        {/* Body */}
        {!selectedPatient ? (
          <div className="empty-state">
            <div className="empty-icon">🩺</div>
            <p className="empty-text">Select a patient from the sidebar to view their ECG dashboard.</p>
          </div>
        ) : (
          <div className="doctor-body">

            {/* ─ Stat Cards ─ */}
            <div className="stats-row">
              <div className={`stat-card stat-bpm`}>
                <span className="stat-label">Last BPM</span>
                <span className="stat-value" style={{ color: '#a29bfe' }}>
                  {lastBpm ?? '—'}
                </span>
                <span className="stat-sub">beats / min</span>
              </div>

              <div className="stat-card stat-bpm">
                <span className="stat-label">Avg BPM (24h)</span>
                <span className="stat-value" style={{ color: '#a29bfe' }}>
                  {avgBpm ?? '—'}
                </span>
                <span className="stat-sub">last {history.length} windows</span>
              </div>

              <div className={`stat-card ${lastPrediction === 'ABNORMAL' ? 'stat-abnormal' : 'stat-normal'}`}>
                <span className="stat-label">Last Prediction</span>
                <span className="stat-value" style={{ fontSize: '1.1rem', paddingTop: '0.3rem',
                  color: lastPrediction === 'ABNORMAL' ? 'var(--danger)' : 'var(--success)' }}>
                  {lastPrediction ?? '—'}
                </span>
                <span className="stat-sub">{latestEntry?.time ?? 'no data'}</span>
              </div>

              <div className="stat-card stat-sqi">
                <span className="stat-label">Signal Quality (SQI)</span>
                <span className="stat-value" style={{ color: '#00b8d4', fontSize: '1.3rem' }}>
                  {lastSqi != null ? `${(lastSqi * 100).toFixed(0)}%` : '—'}
                </span>
                <div className="sqi-bar">
                  <div className="sqi-fill" style={{ width: lastSqi != null ? `${lastSqi * 100}%` : '0%' }} />
                </div>
              </div>

              <div className={`stat-card ${hasUnacked ? 'stat-abnormal' : 'stat-normal'}`}>
                <span className="stat-label">Active Alerts</span>
                <span className="stat-value" style={{ color: hasUnacked ? 'var(--danger)' : 'var(--success)' }}>
                  {unackedAlerts.length}
                </span>
                <span className="stat-sub">{hasUnacked ? 'requires attention' : 'all clear'}</span>
              </div>
            </div>

            {/* ─ BPM Trend Chart ─ */}
            <div className="chart-panel">
              <div className="panel-title-row">
                <span className="panel-title">📈 BPM Trend — Last 24 Hours</span>
                {historyLoading && <div className="spinner" />}
                {!historyLoading && (
                  <span className="panel-sub">{history.length} data points</span>
                )}
              </div>

              {history.length === 0 && !historyLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  No ECG history available for this patient yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={history} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis
                      dataKey="time"
                      tick={{ fill: '#8888aa', fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                      interval={Math.max(0, Math.floor(history.length / 8) - 1)}
                      minTickGap={60}
                    />
                    <YAxis
                      tick={{ fill: '#8888aa', fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      domain={['auto', 'auto']}
                    />
                    <Tooltip content={<BpmTooltip />} />
                    <ReferenceLine y={100} stroke="rgba(255,165,0,0.3)" strokeDasharray="4 4" />
                    <ReferenceLine y={60}  stroke="rgba(255,165,0,0.3)" strokeDasharray="4 4" />
                    <Line
                      type="monotone"
                      dataKey="bpm"
                      stroke="#a29bfe"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: '#a29bfe' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* ─ Alert History ─ */}
            <div className="alerts-panel">
              <div className="panel-title-row">
                <span className="panel-title">🚨 Alert History</span>
                <span className="panel-sub">
                  {unackedAlerts.length > 0
                    ? `${unackedAlerts.length} unacknowledged`
                    : 'All clear'}
                </span>
              </div>

              {alerts.length === 0 ? (
                <div style={{ textAlign:'center', padding:'1.5rem', color:'var(--text-muted)', fontSize:'0.875rem' }}>
                  No alerts for this patient.
                </div>
              ) : alerts.slice(0, 10).map(alert => (
                <div key={alert._id} className="alert-row">
                  <span className="alert-row-icon">
                    {alert.acknowledged ? '✅' : '⚠️'}
                  </span>
                  <div className="alert-row-text">
                    <div className="alert-row-title">
                      {alert.severity || 'HIGH'} — {alert.consecutive_count ?? '?'} consecutive windows ·{' '}
                      Confidence: {alert.probability != null
                        ? `${(alert.probability * 100).toFixed(0)}%` : '?'}
                    </div>
                    <div className="alert-row-sub">
                      {fmtDateTime(alert.timestamp)}
                      {alert.acknowledged && alert.acknowledged_by
                        ? ` · Acknowledged by ${alert.acknowledged_by}` : ''}
                    </div>
                  </div>
                  {!alert.acknowledged && (
                    <button
                      id={`ack-row-btn-${alert._id}`}
                      className="ack-btn"
                      disabled={ackingId === alert._id}
                      onClick={() => acknowledgeAlert(alert._id)}
                    >
                      {ackingId === alert._id ? '…' : 'Ack'}
                    </button>
                  )}
                </div>
              ))}
            </div>

          </div>
        )}
      </main>
    </div>
  );
};

export default DoctorPage;
