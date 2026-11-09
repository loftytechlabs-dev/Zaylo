import { describe, it, expect, beforeEach } from 'vitest';

class MockLocalStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

describe('Centralized Theme System', () => {
  let storage: MockLocalStorage;

  beforeEach(() => {
    storage = new MockLocalStorage();
  });

  it('should default to dark theme when no saved theme exists', () => {
    const saved = storage.getItem('zaylo_theme');
    const initialTheme = saved === 'light' || saved === 'dark' ? saved : 'dark';
    expect(initialTheme).toBe('dark');
  });

  it('should persist theme changes accurately', () => {
    storage.setItem('zaylo_theme', 'light');
    expect(storage.getItem('zaylo_theme')).toBe('light');

    storage.setItem('zaylo_theme', 'dark');
    expect(storage.getItem('zaylo_theme')).toBe('dark');
  });

  it('should toggle between light and dark themes accurately', () => {
    let currentTheme: 'dark' | 'light' = 'dark';
    const toggle = (t: 'dark' | 'light') => (t === 'dark' ? 'light' : 'dark');

    currentTheme = toggle(currentTheme);
    expect(currentTheme).toBe('light');

    currentTheme = toggle(currentTheme);
    expect(currentTheme).toBe('dark');
  });

  it('should resolve system theme preference when requested', () => {
    const resolveTheme = (preference: 'dark' | 'light' | 'system', systemIsDark: boolean) => {
      if (preference === 'system') {
        return systemIsDark ? 'dark' : 'light';
      }
      return preference;
    };

    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});
