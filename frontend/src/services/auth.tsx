import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, unwrap } from './api';
import type { User } from '../types/api';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

let lastToastTime = 0;
function showSessionExpiredToast(message?: string) {
  const now = Date.now();
  if (now - lastToastTime > 3000) {
    lastToastTime = now;
    toast.error(message || 'Tài khoản không còn hiệu lực hoặc phiên đăng nhập đã hết hạn. Hệ thống tự động đăng xuất.');
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!localStorage.getItem('ioffice.token')) {
      setLoading(false);
      return;
    }
    api.get('/auth/me')
      .then((response) => setUser(unwrap<User>(response)))
      .catch(() => {
        localStorage.removeItem('ioffice.token');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  // Listen for unauthorized (401) events and cross-tab storage changes
  useEffect(() => {
    const handleUnauthorized = (event: Event) => {
      const customEvent = event as CustomEvent<{ message?: string }>;
      localStorage.removeItem('ioffice.token');
      queryClient.clear();
      setUser(null);
      showSessionExpiredToast(customEvent.detail?.message);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'ioffice.token' && !event.newValue) {
        queryClient.clear();
        setUser(null);
      }
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
      window.removeEventListener('storage', handleStorage);
    };
  }, [queryClient]);

  // Periodic heartbeat session verification while user is logged in
  useEffect(() => {
    if (!user) return;

    let isMounted = true;
    let checking = false;

    const checkSession = async () => {
      if (checking || !isMounted) return;
      if (!localStorage.getItem('ioffice.token')) {
        queryClient.clear();
        setUser(null);
        return;
      }

      checking = true;
      try {
        const response = await api.get('/auth/me');
        if (!isMounted) return;
        const latestUser = unwrap<User>(response);
        setUser((prev) => {
          if (!prev) return latestUser;
          if (prev.id !== latestUser.id || prev.role !== latestUser.role || prev.displayName !== latestUser.displayName) {
            return latestUser;
          }
          return prev;
        });
      } catch {
        // 401 is handled by api response interceptor which dispatches 'auth:unauthorized'
      } finally {
        checking = false;
      }
    };

    const intervalId = window.setInterval(checkSession, 2500);

    const onFocus = () => { checkSession(); };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkSession();
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [user, queryClient]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    login: async (username, password) => {
      const data = unwrap<{ token: string; user: User }>(await api.post('/auth/login', { username, password }));
      localStorage.setItem('ioffice.token', data.token);
      queryClient.clear();
      setUser(data.user);
    },
    logout: () => {
      localStorage.removeItem('ioffice.token');
      queryClient.clear();
      setUser(null);
    }
  }), [user, loading, queryClient]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
