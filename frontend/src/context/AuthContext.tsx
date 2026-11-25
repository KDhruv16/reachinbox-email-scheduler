import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { API_BASE, authApi } from '../api/client';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  loginWithGoogle: () => void;
  loginWithDev: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    // Safety timer to prevent remaining stuck on loading spinner if network hangs
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 6000);

    try {
      const data = await authApi.me();
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      clearTimeout(safetyTimer);
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const loginWithGoogle = () => {
    window.location.href = `${API_BASE}/api/auth/google`;
  };

  const loginWithDev = async () => {
    setLoading(true);
    try {
      const data = await authApi.devLogin();
      setUser(data.user);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        loginWithGoogle,
        loginWithDev,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
