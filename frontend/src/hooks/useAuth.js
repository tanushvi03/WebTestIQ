import React, { createContext, useContext, useState, useCallback } from 'react';

const AuthContext = createContext(null);

// Demo credentials — replace with real auth when backend auth is wired up
const DEMO_USER = { username: 'admin', password: 'admin123' };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('wt_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const login = useCallback((username, password) => {
    if (username === DEMO_USER.username && password === DEMO_USER.password) {
      const u = { username, role: 'tester' };
      localStorage.setItem('wt_user', JSON.stringify(u));
      setUser(u);
      return { success: true };
    }
    return { success: false, message: 'Invalid username or password.' };
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('wt_user');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
