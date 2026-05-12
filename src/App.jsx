import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage   from './pages/LoginPage';
import AdminPage   from './pages/AdminPage';
import DoctorPage  from './pages/DoctorPage';
import PatientPage from './pages/PatientPage';

function App() {
  const { isAuthenticated, user } = useAuth();

  // Role-based root redirect
  const getRootRedirect = () => {
    if (!isAuthenticated) return '/login';
    const map = { admin: '/admin', doctor: '/doctor', nurse: '/doctor', patient: '/patient' };
    return map[user?.role] || '/login';
  };

  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={
          isAuthenticated
            ? <Navigate to={getRootRedirect()} replace />
            : <LoginPage />
        } />

        {/* Admin only */}
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminPage />
          </ProtectedRoute>
        } />

        {/* Doctor + Nurse */}
        <Route path="/doctor" element={
          <ProtectedRoute allowedRoles={['doctor', 'nurse']}>
            <DoctorPage />
          </ProtectedRoute>
        } />

        {/* Patient */}
        <Route path="/patient" element={
          <ProtectedRoute allowedRoles={['patient']}>
            <PatientPage />
          </ProtectedRoute>
        } />

        {/* Catch-all → smart redirect */}
        <Route path="*" element={<Navigate to={getRootRedirect()} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
