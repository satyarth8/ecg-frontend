import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('ecg_token'));
  const [user, setUser] = useState(() => {
    const u = localStorage.getItem('ecg_user');
    return u ? JSON.parse(u) : null;
  });

  const login = (jwtToken, userData) => {
    localStorage.setItem('ecg_token', jwtToken);
    localStorage.setItem('ecg_user', JSON.stringify(userData));
    setToken(jwtToken);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('ecg_token');
    localStorage.removeItem('ecg_user');
    setToken(null);
    setUser(null);
  };

  const isAuthenticated = !!token;

  return (
    <AuthContext.Provider value={{ token, user, login, logout, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};

export default AuthContext;
