import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import api from '../api/axiosInstance';
import './PatientPage.css';

/* ─── Helpers ─────────────────────────────────────────── */
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
  return d.toLocaleString([], {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const initials = (name = '') =>
  name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '??';

/* ─── Custom Recharts Tooltip ─────────────────────────── */
const BpmTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const pred = payload.find(p => p.dataKey === 'prediction');
  return (
    <div style={{
      background: '#1a1a35', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 8, padding: '0.5rem 0.75rem', fontSize: '0.82rem',
    }}>
      <p style={{ color: '#8888aa', marginBottom: 3 }}>{label}</p>
      <p style={{ color: '#a29bfe', fontWeight: 700 }}>
        {payload[0].value} BPM
      </p>
      {pred && (
        <p style={{
          fontWeight: 600,
          color: pred.value === 'ABNORMAL' ? '#ff5252' : '#00d2a0',
        }}>
          {pred.value}
        </p>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   PATIENT PAGE
═══════════════════════════════════════════════════════ */
const PatientPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  /* state */
  const [patientInfo, setPatientInfo] = useState(null);
  const [history, setHistory]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');

  /* fetch on mount */
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get('/api/patients/me');
        /*
          Expected shape:
          {
            patient: { _id, name, dob, assigned_room, assigned_doctors[] },
            summaries: [ { start_time, heart_rate, prediction, probability, sqi, rr_mean, rmssd, sdnn } ]
          }
        */
        setPatientInfo(data.patient || null);
        const summaries = data.summaries || [];
        setHistory(
          summaries.map(s => {
            const d = toUtcDate(s.start_time);
            return {
              time:       d
                ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                : '—',
              epoch:      d ? d.getTime() : 0,
              timestamp:  s.start_time,
              bpm:        Math.round(s.heart_rate ?? 0),
              sqi:        parseFloat((s.sqi ?? 0).toFixed(2)),
              prediction: s.prediction || 'Normal',
              probability:s.probability ?? 0,
              rr_mean:    s.rr_mean,
              rmssd:      s.rmssd,
              sdnn:       s.sdnn,
            };
          }).sort((a, b) => a.epoch - b.epoch)
        );
      } catch (err) {
        setError(
          err.response?.data?.error ||
          'Failed to load your ECG data. Please try again later.'
        );
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  /* derived */
  const latest      = history[history.length - 1] ?? null;
  const lastBpm     = latest?.bpm     ?? null;
  const lastPred    = latest?.prediction ?? null;
  const lastSqi     = latest?.sqi     ?? null;
  const lastProb    = latest?.probability ?? null;
  const lastTs      = latest?.timestamp ?? null;
  const avgBpm      = history.length
    ? Math.round(history.reduce((s, e) => s + e.bpm, 0) / history.length)
    : null;
  const abnormalCount = history.filter(e => e.prediction === 'ABNORMAL').length;
  const pctNormal     = history.length
    ? Math.round(((history.length - abnormalCount) / history.length) * 100)
    : null;

  const handleLogout = () => { logout(); navigate('/login', { replace: true }); };

  const displayName = patientInfo?.name || user?.username || 'Patient';
  const displayRoom = patientInfo?.assigned_room;
  const displayDob  = patientInfo?.dob
    ? new Date(patientInfo.dob).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  /* ── Render ───────────────────────────────────────────── */
  return (
    <div className="patient-layout">

      {/* Topbar */}
      <header className="patient-topbar">
        <div className="topbar-brand">
          <span className="brand-icon">💓</span>
          <span className="brand-name">ECG Monitor</span>
        </div>
        <div className="topbar-right">
          <div className="patient-chip">
            <div className="p-avatar">{initials(displayName)}</div>
            <div>
              <div className="p-name">{displayName}</div>
              <div className="p-role">Patient</div>
            </div>
          </div>
          <button id="patient-logout-btn" className="logout-btn-top" onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </header>

      {/* Loading / Error */}
      {loading && (
        <div className="empty-state" style={{ flex: 1 }}>
          <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
          <p className="empty-text">Loading your ECG data…</p>
        </div>
      )}

      {!loading && error && (
        <div className="empty-state" style={{ flex: 1 }}>
          <div className="empty-icon">⚠️</div>
          <p className="empty-text" style={{ color: '#ff8080' }}>{error}</p>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Hero banner */}
          <div className="patient-hero">
            <div className="hero-avatar">{initials(displayName)}</div>
            <div className="hero-text">
              <h1>Hello, {displayName.split(' ')[0]} 👋</h1>
              <div className="hero-meta">
                {displayRoom && <span>🏥 Room {displayRoom}</span>}
                {displayDob  && <span>🎂 {displayDob}</span>}
                <span>📊 {history.length} ECG windows on record</span>
              </div>
            </div>
          </div>

          <div className="patient-body">

            {/* ─ Stat Cards ─ */}
            <div className="stats-grid">
              <div className="stat-card card-accent-purple">
                <div className="stat-label">Last BPM</div>
                <div className="stat-value" style={{ color: '#a29bfe' }}>
                  {lastBpm ?? '—'}
                </div>
                <div className="stat-sub">beats per minute</div>
              </div>

              <div className="stat-card card-accent-purple">
                <div className="stat-label">Avg BPM (24h)</div>
                <div className="stat-value" style={{ color: '#a29bfe' }}>
                  {avgBpm ?? '—'}
                </div>
                <div className="stat-sub">over {history.length} windows</div>
              </div>

              <div className="stat-card card-accent-green">
                <div className="stat-label">Normal Rate</div>
                <div className="stat-value" style={{ color: 'var(--success)' }}>
                  {pctNormal != null ? `${pctNormal}%` : '—'}
                </div>
                <div className="stat-sub">of all recordings</div>
              </div>

              <div className={`stat-card ${abnormalCount > 0 ? 'card-accent-red' : 'card-accent-green'}`}>
                <div className="stat-label">ABNORMAL Windows</div>
                <div className="stat-value" style={{ color: abnormalCount > 0 ? 'var(--danger)' : 'var(--success)' }}>
                  {abnormalCount}
                </div>
                <div className="stat-sub">out of {history.length}</div>
              </div>

              <div className="stat-card card-accent-teal">
                <div className="stat-label">Signal Quality</div>
                <div className="stat-value" style={{ color: '#00b8d4', fontSize: '1.3rem' }}>
                  {lastSqi != null ? `${(lastSqi * 100).toFixed(0)}%` : '—'}
                </div>
                <div className="sqi-bar" style={{ marginTop: '0.4rem' }}>
                  <div className="sqi-fill"
                    style={{ width: lastSqi != null ? `${lastSqi * 100}%` : '0%' }} />
                </div>
              </div>
            </div>

            {/* ─ Latest Prediction Card ─ */}
            {latest && (
              <div className="prediction-card">
                <div className="prediction-icon">
                  {lastPred === 'ABNORMAL' ? '⚠️' : '✅'}
                </div>
                <div className="prediction-info">
                  <div className="prediction-label">Latest ML Prediction</div>
                  {lastPred === 'ABNORMAL' ? (
                    <div className="prediction-badge-abnormal">⚠ ABNORMAL</div>
                  ) : (
                    <div className="prediction-badge-normal">✓ Normal</div>
                  )}
                  <div className="prediction-timestamp">
                    Recorded: {fmtDateTime(lastTs)} ·
                    Confidence: {lastProb != null ? ` ${(lastProb * 100).toFixed(0)}%` : ' —'}
                  </div>
                </div>
                <div className="sqi-section">
                  <div className="sqi-label">Signal Quality Index</div>
                  <div className="sqi-value">
                    {lastSqi != null ? `${(lastSqi * 100).toFixed(0)}%` : '—'}
                  </div>
                  <div className="sqi-bar">
                    <div className="sqi-fill"
                      style={{ width: lastSqi != null ? `${lastSqi * 100}%` : '0%' }} />
                  </div>
                </div>
              </div>
            )}

            {/* ─ BPM Trend Chart ─ */}
            <div className="chart-panel">
              <div className="panel-title-row">
                <span className="panel-title">📈 My BPM Trend — Last 24 Hours</span>
                <span className="panel-sub">{history.length} readings</span>
              </div>

              {history.length === 0 ? (
                <div className="empty-state" style={{ padding: '1.5rem' }}>
                  <div className="empty-icon">📉</div>
                  <p className="empty-text">No ECG history available yet.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={230}>
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
                    <ReferenceLine y={100} stroke="rgba(255,165,0,0.3)" strokeDasharray="4 4" label={{ value: '100', fill: '#ffa50055', fontSize: 10 }} />
                    <ReferenceLine y={60}  stroke="rgba(255,165,0,0.3)" strokeDasharray="4 4" label={{ value: '60', fill: '#ffa50055', fontSize: 10 }} />
                    <Line
                      type="monotone"
                      dataKey="bpm"
                      stroke="url(#bpmGrad)"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5, fill: '#a29bfe' }}
                    />
                    {/* define gradient */}
                    <defs>
                      <linearGradient id="bpmGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%"   stopColor="#6c5ce7" />
                        <stop offset="100%" stopColor="#a29bfe" />
                      </linearGradient>
                    </defs>
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* ─ Recent Readings Table ─ */}
            <div className="history-panel">
              <div className="panel-title-row">
                <span className="panel-title">📋 Recent Readings</span>
                <span className="panel-sub">Last 20 windows</span>
              </div>

              {history.length === 0 ? (
                <div className="empty-state" style={{ padding: '1.5rem' }}>
                  <p className="empty-text">No readings available.</p>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>BPM</th>
                      <th>Prediction</th>
                      <th>Confidence</th>
                      <th>SQI</th>
                      <th>RMSSD</th>
                      <th>SDNN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...history].reverse().slice(0, 20).map((row, i) => (
                      <tr key={i}>
                        <td>{fmtDateTime(row.timestamp)}</td>
                        <td style={{ fontWeight: 600, color: '#a29bfe' }}>{row.bpm}</td>
                        <td>
                          {row.prediction === 'ABNORMAL'
                            ? <span className="badge-a">ABNORMAL</span>
                            : <span className="badge-n">Normal</span>}
                        </td>
                        <td>{row.probability != null ? `${(row.probability * 100).toFixed(0)}%` : '—'}</td>
                        <td>{row.sqi != null ? `${(row.sqi * 100).toFixed(0)}%` : '—'}</td>
                        <td>{row.rmssd != null ? row.rmssd.toFixed(1) : '—'}</td>
                        <td>{row.sdnn  != null ? row.sdnn.toFixed(1)  : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

          </div>
        </>
      )}
    </div>
  );
};

export default PatientPage;
