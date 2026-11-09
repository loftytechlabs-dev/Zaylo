import type { Persona } from '@local-ai/shared';
import { BUILTIN_PERSONAS } from './builtinPersonas.js';

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

class MemoryStorageAdapter implements StorageAdapter {
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
}

export interface PersonaStoreData {
  version: number;
  personas: Persona[];
  defaultPersonaId: string;
  activePersonaId: string;
  updatedAt: number;
}

export class PersonaStore {
  public static readonly CURRENT_VERSION = 1;
  public static readonly STORAGE_KEY = 'zaylo_personas_v1';
  public static readonly DEFAULT_KEY = 'zaylo_default_persona_id';
  public static readonly ACTIVE_KEY = 'zaylo_active_persona_id';

  private storage: StorageAdapter;

  constructor(storage?: StorageAdapter) {
    if (storage) {
      this.storage = storage;
    } else if (typeof window !== 'undefined' && window.localStorage) {
      this.storage = window.localStorage;
    } else {
      this.storage = new MemoryStorageAdapter();
    }
  }

  /**
   * Initializes or loads persisted personas safely with schema migration and validation.
   */
  public loadPersonas(): Persona[] {
    try {
      const raw = this.storage.getItem(PersonaStore.STORAGE_KEY);
      if (!raw) {
        // First run: initialize with built-in presets
        this.savePersonas(BUILTIN_PERSONAS);
        return [...BUILTIN_PERSONAS];
      }

      const parsed = JSON.parse(raw);
      let list: Persona[] = [];

      // Versioned envelope format
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.personas)) {
        list = parsed.personas;
      } else if (Array.isArray(parsed)) {
        list = parsed;
      }

      // Validate records and sanitize
      const validCustomPersonas = list.filter((p) => {
        return (
          p &&
          typeof p.id === 'string' &&
          typeof p.name === 'string' &&
          !p.isBuiltIn
        );
      });

      // Built-in presets are always kept up-to-date and protected
      const merged: Persona[] = [...BUILTIN_PERSONAS];
      for (const custom of validCustomPersonas) {
        // Prevent ID collision with built-in presets
        if (!merged.some((m) => m.id === custom.id)) {
          merged.push({
            ...custom,
            isBuiltIn: false,
          });
        }
      }

      return merged;
    } catch (err) {
      console.warn('Failed to load personas from storage, using built-ins:', err);
      return [...BUILTIN_PERSONAS];
    }
  }

  /**
   * Persists personas safely. Built-in presets are protected.
   */
  public savePersonas(personas: Persona[]): void {
    try {
      const payload: PersonaStoreData = {
        version: PersonaStore.CURRENT_VERSION,
        personas,
        defaultPersonaId: this.getDefaultPersonaId(),
        activePersonaId: this.getActivePersonaId(),
        updatedAt: Date.now(),
      };
      this.storage.setItem(PersonaStore.STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      console.error('Failed to save personas to storage:', err);
    }
  }

  public getDefaultPersonaId(): string {
    try {
      const def = this.storage.getItem(PersonaStore.DEFAULT_KEY);
      if (def) return def;
    } catch {
      // Ignored
    }
    return 'persona_general';
  }

  public setDefaultPersonaId(id: string): void {
    try {
      this.storage.setItem(PersonaStore.DEFAULT_KEY, id);
    } catch {
      // Ignored
    }
  }

  public getActivePersonaId(): string {
    try {
      const act = this.storage.getItem(PersonaStore.ACTIVE_KEY);
      if (act) return act;
    } catch {
      // Ignored
    }
    return this.getDefaultPersonaId();
  }

  public setActivePersonaId(id: string): void {
    try {
      this.storage.setItem(PersonaStore.ACTIVE_KEY, id);
    } catch {
      // Ignored
    }
  }
}
