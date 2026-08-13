import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, unwrap } from './api';
import type { User } from '../types/api';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  useLocalMode: () => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (localStorage.getItem('ioffice.localMode')) {
      setUser({ id: 'local', username: 'local', displayName: 'Local Mode', role: 'ADMIN' });
      setLoading(false);
      return;
    }
    if (!localStorage.getItem('ioffice.token')) {
      setLoading(false);
      return;
    }
    api.get('/auth/me')
      .then((response) => setUser(unwrap<User>(response)))
      .catch(() => localStorage.removeItem('ioffice.token'))
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    login: async (username, password) => {
      const data = unwrap<{ token: string; user: User }>(await api.post('/auth/login', { username, password }));
      localStorage.setItem('ioffice.token', data.token);
      setUser(data.user);
    },
    useLocalMode: () => {
      localStorage.removeItem('ioffice.token');
      localStorage.setItem('ioffice.localMode', '1');
      setUser({ id: 'local', username: 'local', displayName: 'Local Mode', role: 'ADMIN' });
    },
    logout: () => {
      localStorage.removeItem('ioffice.token');
      localStorage.removeItem('ioffice.localMode');
      setUser(null);
    }
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
