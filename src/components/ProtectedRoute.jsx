import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Wraps a route so that only authenticated users with the correct role(s) can access it.
 * - If not authenticated → redirect to /login
 * - If authenticated but wrong role → redirect to their own dashboard
 */
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    // Redirect to the correct dashboard based on role
    const roleMap = { admin: '/admin', doctor: '/doctor', nurse: '/doctor', patient: '/patient' };
    return <Navigate to={roleMap[user?.role] || '/login'} replace />;
  }

  return children;
};

export default ProtectedRoute;
