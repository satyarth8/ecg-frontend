import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axiosInstance';
import DemoControlPanel from '../components/DemoControlPanel';
import './AdminPage.css';

/* ─── Panel constants ─────────────────────────────────── */
const PANELS = [
  { id: 'users',   label: 'Users',    icon: '👥' },
  { id: 'devices', label: 'Devices',  icon: '🖥️' },
  { id: 'patients',label: 'Patients', icon: '🏥' },
  { id: 'demo',    label: 'Demo',     icon: '🎬' },
];

const ROLES = ['admin', 'doctor', 'nurse', 'patient'];

/* ─── Helper: role badge ──────────────────────────────── */
const RoleBadge = ({ role }) => (
  <span className={`badge badge-${role}`}>{role}</span>
);

/* ═══════════════════════════════════════════════════════
   USERS PANEL
═══════════════════════════════════════════════════════ */
const UsersPanel = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ username: '', email: '', password: '', role: 'doctor' });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState(null);

  const fetchUsers = useCallback(async () => {
    try {
      const { data } = await api.get('/api/admin/users');
      setUsers(data.users || []);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);
    try {
      await api.post('/api/admin/users', form);
      setMsg({ type: 'success', text: `User "${form.username}" created successfully.` });
      setForm({ username: '', email: '', password: '', role: 'doctor' });
      fetchUsers();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Failed to create user.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Create user form */}
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">➕ Create New User</h2>
        </div>
        {msg && <div className={msg.type === 'success' ? 'toast-success' : 'toast-error'}>{msg.text}</div>}
        <form onSubmit={handleCreate}>
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="new-username">Username</label>
              <input
                id="new-username"
                type="text"
                placeholder="dr_smith"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="new-email">Email</label>
              <input
                id="new-email"
                type="email"
                placeholder="smith@hospital.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="new-password">Password</label>
              <input
                id="new-password"
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required
              />
            </div>
            <div className="form-field" style={{ maxWidth: 140 }}>
              <label htmlFor="new-role">Role</label>
              <select
                id="new-role"
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
              >
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <button type="submit" id="create-user-btn" className="btn-primary" disabled={submitting}>
            {submitting && <span className="spinner" />}
            {submitting ? 'Creating…' : 'Create User'}
          </button>
        </form>
      </div>

      {/* User list */}
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">👥 All Users</h2>
          <button className="btn-ghost" onClick={fetchUsers}>↻ Refresh</button>
        </div>
        {loading ? (
          <div className="empty-state"><div className="spinner" style={{ width:24,height:24,borderWidth:3 }} /></div>
        ) : users.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👤</div>
            <p className="empty-text">No users found. Create one above.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Email</th>
                <th>Role</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u._id || u.id}>
                  <td>{u.username}</td>
                  <td>{u.email}</td>
                  <td><RoleBadge role={u.role} /></td>
                  <td>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
};

/* ═══════════════════════════════════════════════════════
   DEVICES PANEL
═══════════════════════════════════════════════════════ */
const DevicesPanel = () => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ device_id: '', room_number: '' });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState(null);

  const fetchDevices = useCallback(async () => {
    try {
      const { data } = await api.get('/api/admin/devices');
      setDevices(data.devices || []);
    } catch {
      setDevices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  const handleRegister = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMsg(null);
    try {
      await api.post('/api/admin/assign-device', form);
      setMsg({ type: 'success', text: `Device "${form.device_id}" mapped to Room ${form.room_number}.` });
      setForm({ device_id: '', room_number: '' });
      fetchDevices();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Failed to register device.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">🖥️ Register RPi Device</h2>
        </div>
        {msg && <div className={msg.type === 'success' ? 'toast-success' : 'toast-error'}>{msg.text}</div>}
        <form onSubmit={handleRegister}>
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="device-id">Device ID</label>
              <input
                id="device-id"
                type="text"
                placeholder="rpi-room-101"
                value={form.device_id}
                onChange={e => setForm(f => ({ ...f, device_id: e.target.value }))}
                required
              />
            </div>
            <div className="form-field" style={{ maxWidth: 180 }}>
              <label htmlFor="room-number">Room Number</label>
              <input
                id="room-number"
                type="text"
                placeholder="101"
                value={form.room_number}
                onChange={e => setForm(f => ({ ...f, room_number: e.target.value }))}
                required
              />
            </div>
          </div>
          <button type="submit" id="register-device-btn" className="btn-primary" disabled={submitting}>
            {submitting && <span className="spinner" />}
            {submitting ? 'Registering…' : 'Register Device'}
          </button>
        </form>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">📡 Registered Devices</h2>
          <button className="btn-ghost" onClick={fetchDevices}>↻ Refresh</button>
        </div>
        {loading ? (
          <div className="empty-state"><div className="spinner" style={{ width:24,height:24,borderWidth:3 }} /></div>
        ) : devices.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🖥️</div>
            <p className="empty-text">No devices registered yet.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Device ID</th><th>Room</th><th>Status</th><th>Registered</th></tr>
            </thead>
            <tbody>
              {devices.map(d => (
                <tr key={d._id || d.device_id}>
                  <td><code style={{ fontSize: '0.82rem', color: '#a29bfe' }}>{d.device_id}</code></td>
                  <td>Room {d.room_number}</td>
                  <td>
                    <span style={{
                      color: d.status === 'active' ? 'var(--success)' : 'var(--text-muted)',
                      fontWeight: 600, fontSize: '0.82rem'
                    }}>
                      {d.status === 'active' ? '● Active' : '○ Inactive'}
                    </span>
                  </td>
                  <td>{d.registered_at ? new Date(d.registered_at).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
};

/* ═══════════════════════════════════════════════════════
   PATIENTS PANEL
═══════════════════════════════════════════════════════ */
const PatientsPanel = () => {
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assignRoom, setAssignRoom] = useState({ patient_id: '', room_number: '' });
  const [assignDoctor, setAssignDoctor] = useState({ patient_id: '', doctor_id: '' });
  const [msg, setMsg] = useState(null);
  const [submittingRoom, setSubmittingRoom] = useState(false);
  const [submittingDoc, setSubmittingDoc] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [pRes, uRes] = await Promise.all([
        api.get('/api/admin/patients'),
        api.get('/api/admin/users'),
      ]);
      const allPatients = pRes.data.patients || [];
      const allUsers = uRes.data.users || [];
      setPatients(allPatients);
      setDoctors(allUsers.filter(u => u.role === 'doctor' || u.role === 'nurse'));
      // Extract unique rooms from devices
      const dRes = await api.get('/api/admin/devices');
      setRooms((dRes.data.devices || []).map(d => d.room_number));
    } catch {
      setPatients([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAssignRoom = async (e) => {
    e.preventDefault();
    setSubmittingRoom(true);
    setMsg(null);
    try {
      await api.post('/api/admin/assign-patient', assignRoom);
      setMsg({ type: 'success', text: 'Patient assigned to room successfully.' });
      setAssignRoom({ patient_id: '', room_number: '' });
      fetchData();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Failed to assign room.' });
    } finally {
      setSubmittingRoom(false);
    }
  };

  const handleAssignDoctor = async (e) => {
    e.preventDefault();
    setSubmittingDoc(true);
    setMsg(null);
    try {
      await api.post('/api/admin/assign-doctor', assignDoctor);
      setMsg({ type: 'success', text: 'Doctor/Nurse linked to patient.' });
      setAssignDoctor({ patient_id: '', doctor_id: '' });
      fetchData();
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Failed to assign doctor.' });
    } finally {
      setSubmittingDoc(false);
    }
  };

  return (
    <>
      {msg && <div className={msg.type === 'success' ? 'toast-success' : 'toast-error'}>{msg.text}</div>}

      {/* Assign patient to room */}
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">🏥 Assign Patient to Room</h2>
        </div>
        <form onSubmit={handleAssignRoom}>
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="assign-patient-id">Patient</label>
              <select
                id="assign-patient-id"
                value={assignRoom.patient_id}
                onChange={e => setAssignRoom(f => ({ ...f, patient_id: e.target.value }))}
                required
              >
                <option value="">Select patient…</option>
                {patients.map(p => (
                  <option key={p._id} value={p._id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="form-field" style={{ maxWidth: 180 }}>
              <label htmlFor="assign-room">Room</label>
              <select
                id="assign-room"
                value={assignRoom.room_number}
                onChange={e => setAssignRoom(f => ({ ...f, room_number: e.target.value }))}
                required
              >
                <option value="">Select room…</option>
                {rooms.map(r => <option key={r} value={r}>Room {r}</option>)}
              </select>
            </div>
          </div>
          <button type="submit" id="assign-room-btn" className="btn-primary" disabled={submittingRoom}>
            {submittingRoom && <span className="spinner" />}
            {submittingRoom ? 'Assigning…' : 'Assign Room'}
          </button>
        </form>
      </div>

      {/* Assign doctor/nurse to patient */}
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">👨‍⚕️ Assign Doctor / Nurse to Patient</h2>
        </div>
        <form onSubmit={handleAssignDoctor}>
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="assign-doc-patient">Patient</label>
              <select
                id="assign-doc-patient"
                value={assignDoctor.patient_id}
                onChange={e => setAssignDoctor(f => ({ ...f, patient_id: e.target.value }))}
                required
              >
                <option value="">Select patient…</option>
                {patients.map(p => (
                  <option key={p._id} value={p._id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="assign-doc-doctor">Doctor / Nurse</label>
              <select
                id="assign-doc-doctor"
                value={assignDoctor.doctor_id}
                onChange={e => setAssignDoctor(f => ({ ...f, doctor_id: e.target.value }))}
                required
              >
                <option value="">Select doctor/nurse…</option>
                {doctors.map(d => (
                  <option key={d._id} value={d._id}>{d.username} ({d.role})</option>
                ))}
              </select>
            </div>
          </div>
          <button type="submit" id="assign-doctor-btn" className="btn-primary" disabled={submittingDoc}>
            {submittingDoc && <span className="spinner" />}
            {submittingDoc ? 'Linking…' : 'Assign Doctor / Nurse'}
          </button>
        </form>
      </div>

      {/* Patient list */}
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">🏥 All Patients</h2>
          <button className="btn-ghost" onClick={fetchData}>↻ Refresh</button>
        </div>
        {loading ? (
          <div className="empty-state"><div className="spinner" style={{ width:24,height:24,borderWidth:3 }} /></div>
        ) : patients.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🏥</div>
            <p className="empty-text">No patients found. Create patient accounts in the Users panel.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Name</th><th>Room</th><th>Assigned Doctors</th></tr>
            </thead>
            <tbody>
              {patients.map(p => (
                <tr key={p._id}>
                  <td>{p.name}</td>
                  <td>{p.assigned_room ? `Room ${p.assigned_room}` : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                  <td>{(p.assigned_doctors?.length || 0) > 0 ? `${p.assigned_doctors.length} assigned` : <span style={{ color: 'var(--text-muted)' }}>None</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
};

/* ═══════════════════════════════════════════════════════
   MAIN ADMIN PAGE
═══════════════════════════════════════════════════════ */
const AdminPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activePanel, setActivePanel] = useState('users');

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : 'AD';

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="sidebar-logo">
          <span className="logo-icon">💓</span>
          <span className="logo-name">ECG Monitor</span>
        </div>

        <nav className="sidebar-nav">
          {PANELS.map(p => (
            <button
              key={p.id}
              id={`nav-${p.id}`}
              className={`nav-btn ${activePanel === p.id ? 'active' : ''}`}
              onClick={() => setActivePanel(p.id)}
            >
              <span className="nav-icon">{p.icon}</span>
              {p.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="user-chip">
            <div className="user-avatar">{initials}</div>
            <div className="user-info">
              <div className="user-name">{user?.username || 'Admin'}</div>
              <div className="user-role">{user?.role || 'admin'}</div>
            </div>
          </div>
          <button id="logout-btn" className="logout-btn" onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="admin-main">
        <header className="admin-header">
          <div>
            <h1>{PANELS.find(p => p.id === activePanel)?.icon} {PANELS.find(p => p.id === activePanel)?.label}</h1>
            <p className="header-sub">Admin Dashboard — Manage {PANELS.find(p => p.id === activePanel)?.label.toLowerCase()}</p>
          </div>
        </header>

        <div className="admin-content">
          {activePanel === 'users'   && <UsersPanel />}
          {activePanel === 'devices' && <DevicesPanel />}
          {activePanel === 'patients'&& <PatientsPanel />}
          {activePanel === 'demo'    && <DemoControlPanel />}
        </div>
      </main>
    </div>
  );
};

export default AdminPage;
