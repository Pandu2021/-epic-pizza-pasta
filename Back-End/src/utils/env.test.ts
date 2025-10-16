import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { getApiBaseUrl, buildApiUrl } from './env';

const ORIGINAL_ENV = { ...process.env } as Record<string, string | undefined>;

const restoreEnv = () => {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key];
    }
  }
  for (const key of Object.keys(ORIGINAL_ENV)) {
    const value = ORIGINAL_ENV[key];
    if (typeof value === 'undefined') {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
};

beforeEach(restoreEnv);
afterEach(restoreEnv);
afterAll(restoreEnv);

describe('env utils', () => {
  it('uses the explicit API_BASE_URL when provided', () => {
    delete process.env.PUBLIC_API_URL;
    delete process.env.BACKEND_PUBLIC_URL;
    delete process.env.APP_ORIGIN;
    delete process.env.DOMAIN;
    process.env.API_BASE_URL = ' https://api.example.com/v1/ ';

    expect(getApiBaseUrl()).toBe('https://api.example.com/v1');
  });

  it('falls back to APP_ORIGIN when explicit URLs are missing', () => {
    delete process.env.API_BASE_URL;
    delete process.env.PUBLIC_API_URL;
    delete process.env.BACKEND_PUBLIC_URL;
    delete process.env.DOMAIN;
    process.env.APP_ORIGIN = 'https://pizza.example';

    expect(getApiBaseUrl()).toBe('https://pizza.example/api');
  });

  it('falls back to PORT when no base or origin is provided', () => {
    delete process.env.API_BASE_URL;
    delete process.env.PUBLIC_API_URL;
    delete process.env.BACKEND_PUBLIC_URL;
    delete process.env.APP_ORIGIN;
    delete process.env.DOMAIN;
    process.env.PORT = '5050';

    expect(getApiBaseUrl()).toBe('http://localhost:5050/api');
  });

  it('uses the default development port when no env vars are set', () => {
    delete process.env.API_BASE_URL;
    delete process.env.PUBLIC_API_URL;
    delete process.env.BACKEND_PUBLIC_URL;
    delete process.env.APP_ORIGIN;
    delete process.env.DOMAIN;
    delete process.env.PORT;

    expect(getApiBaseUrl()).toBe('http://localhost:4000/api');
  });

  it('normalizes paths when building API URLs', () => {
    process.env.API_BASE_URL = 'https://api.example.com';

    expect(buildApiUrl('orders/123')).toBe('https://api.example.com/orders/123');
    expect(buildApiUrl('/orders/456')).toBe('https://api.example.com/orders/456');
  });
});
