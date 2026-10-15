import { beforeEach, describe, expect, it } from 'vitest';
import { api } from './api';

describe('api 401 interceptor', () => {
  const store: Record<string, string> = {};
  const eventTarget = new EventTarget();

  beforeEach(() => {
    for (const key of Object.keys(store)) delete store[key];
    globalThis.localStorage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, val: string) => { store[key] = String(val); },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { for (const key of Object.keys(store)) delete store[key]; },
      key: () => null,
      length: 0
    };
    (globalThis as any).window = {
      dispatchEvent: (event: Event) => eventTarget.dispatchEvent(event),
      addEventListener: (type: string, listener: any) => eventTarget.addEventListener(type, listener),
      removeEventListener: (type: string, listener: any) => eventTarget.removeEventListener(type, listener)
    };
  });

  it('removes token and dispatches auth:unauthorized event on 401 response', async () => {
    localStorage.setItem('ioffice.token', 'test-token');
    expect(localStorage.getItem('ioffice.token')).toBe('test-token');

    let eventFired = false;
    let eventDetail: any = null;
    const listener = (event: Event) => {
      eventFired = true;
      eventDetail = (event as CustomEvent).detail;
    };

    window.addEventListener('auth:unauthorized', listener);

    // Call interceptor directly with simulated 401 error
    const responseInterceptor: any = (api.interceptors.response as any).handlers[0];
    const simulatedError = {
      config: { url: '/documents' },
      response: {
        status: 401,
        data: { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid authentication token' } }
      }
    };

    await expect(responseInterceptor.rejected(simulatedError)).rejects.toThrow('Invalid authentication token');
    expect(localStorage.getItem('ioffice.token')).toBeNull();
    expect(eventFired).toBe(true);
    expect(eventDetail?.message).toContain('Tài khoản không còn hiệu lực');

    window.removeEventListener('auth:unauthorized', listener);
  });

  it('does NOT trigger auth:unauthorized event on /auth/login 401 error', async () => {
    let eventFired = false;
    const listener = () => { eventFired = true; };
    window.addEventListener('auth:unauthorized', listener);

    const responseInterceptor: any = (api.interceptors.response as any).handlers[0];
    const simulatedError = {
      config: { url: '/auth/login' },
      response: {
        status: 401,
        data: { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password' } }
      }
    };

    await expect(responseInterceptor.rejected(simulatedError)).rejects.toThrow('Invalid username or password');
    expect(eventFired).toBe(false);

    window.removeEventListener('auth:unauthorized', listener);
  });
});
