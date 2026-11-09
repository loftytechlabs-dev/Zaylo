import type { Persona } from '@local-ai/shared';
import { PersonaStore } from './PersonaStore.js';
import { PersonaResolver } from './PersonaResolver.js';

export class PersonaManager {
  private store: PersonaStore;
  private personas: Persona[] = [];

  constructor(store?: PersonaStore) {
    this.store = store || new PersonaStore();
    this.reload();
  }

  public reload(): Persona[] {
    this.personas = this.store.loadPersonas();
    return this.personas;
  }

  public getAllPersonas(): Persona[] {
    if (this.personas.length === 0) {
      this.reload();
    }
    return [...this.personas];
  }

  public getBuiltInPersonas(): Persona[] {
    return this.getAllPersonas().filter((p) => p.isBuiltIn);
  }

  public getCustomPersonas(): Persona[] {
    return this.getAllPersonas().filter((p) => !p.isBuiltIn);
  }

  public getPersona(id: string): Persona | undefined {
    return this.getAllPersonas().find((p) => p.id === id);
  }

  public getDefaultPersona(): Persona {
    const defaultId = this.store.getDefaultPersonaId();
    return PersonaResolver.resolve(defaultId, this.getAllPersonas());
  }

  public setDefaultPersona(id: string): void {
    const target = this.getPersona(id);
    if (!target) {
      throw new Error(`Cannot set default: persona '${id}' not found`);
    }
    this.store.setDefaultPersonaId(id);
    this.personas = this.personas.map((p) => ({
      ...p,
      isDefault: p.id === id,
    }));
    this.store.savePersonas(this.personas);
  }

  public getActivePersona(): Persona {
    const activeId = this.store.getActivePersonaId();
    return PersonaResolver.resolve(activeId, this.getAllPersonas());
  }

  public setActivePersona(id: string): void {
    const target = this.getPersona(id);
    if (!target) {
      throw new Error(`Cannot set active: persona '${id}' not found`);
    }
    this.store.setActivePersonaId(id);
  }

  public createPersona(data: {
    name: string;
    description: string;
    avatar?: string;
    systemInstructions: string;
    personalityTraits?: string[];
    communicationStyle?: Persona['communicationStyle'];
    responsePreferences?: Persona['responsePreferences'];
    behavioralRules?: string[];
    responseStructure?: string;
    greetingMessage?: string;
  }): Persona {
    if (!data.name || !data.name.trim()) {
      throw new Error('Persona name is required');
    }
    if (!data.systemInstructions || !data.systemInstructions.trim()) {
      throw new Error('System instructions are required');
    }

    const id = `persona_custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newPersona: Persona = {
      id,
      name: data.name.trim(),
      description: data.description ? data.description.trim() : '',
      avatar: data.avatar?.trim() || '✨',
      systemInstructions: data.systemInstructions.trim(),
      personalityTraits: data.personalityTraits || ['Custom'],
      communicationStyle: data.communicationStyle || 'Professional',
      responsePreferences: data.responsePreferences || {
        reasoningStyle: 'Clear and structured',
        codeFormatting: 'Clean Markdown',
        formatPreference: 'Standard',
      },
      behavioralRules: data.behavioralRules || [],
      responseStructure: data.responseStructure?.trim() || 'Structured response with clear sections.',
      greetingMessage: data.greetingMessage?.trim() || undefined,
      isBuiltIn: false,
      isDefault: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.personas = [...this.getAllPersonas(), newPersona];
    this.store.savePersonas(this.personas);
    return newPersona;
  }

  public updatePersona(id: string, updates: Partial<Persona>): Persona {
    const existing = this.getPersona(id);
    if (!existing) {
      throw new Error(`Persona '${id}' not found`);
    }

    if (existing.isBuiltIn) {
      throw new Error(
        `Built-in persona '${existing.name}' is protected and cannot be directly modified. Use duplicate instead.`
      );
    }

    const updated: Persona = {
      ...existing,
      ...updates,
      id: existing.id, // ID cannot be altered
      isBuiltIn: false, // Custom personas cannot become built-in
      updatedAt: Date.now(),
    };

    this.personas = this.getAllPersonas().map((p) => (p.id === id ? updated : p));
    this.store.savePersonas(this.personas);
    return updated;
  }

  public duplicatePersona(id: string, newName?: string): Persona {
    const source = this.getPersona(id);
    if (!source) {
      throw new Error(`Persona '${id}' not found`);
    }

    const title = newName?.trim() || `Copy of ${source.name}`;
    return this.createPersona({
      name: title,
      description: source.description,
      avatar: source.avatar,
      systemInstructions: source.systemInstructions,
      personalityTraits: [...source.personalityTraits],
      communicationStyle: source.communicationStyle,
      responsePreferences: source.responsePreferences ? { ...source.responsePreferences } : undefined,
      behavioralRules: [...source.behavioralRules],
      responseStructure: source.responseStructure,
      greetingMessage: source.greetingMessage,
    });
  }

  public deletePersona(id: string): boolean {
    const existing = this.getPersona(id);
    if (!existing) {
      return false;
    }

    if (existing.isBuiltIn) {
      throw new Error(`Cannot delete built-in persona '${existing.name}'. Built-in presets are protected.`);
    }

    const remaining = this.getAllPersonas().filter((p) => p.id !== id);
    this.personas = remaining;
    this.store.savePersonas(remaining);

    // If deleted persona was default or active, reset to general assistant
    if (this.store.getDefaultPersonaId() === id) {
      this.store.setDefaultPersonaId('persona_general');
    }
    if (this.store.getActivePersonaId() === id) {
      this.store.setActivePersonaId('persona_general');
    }

    return true;
  }

  public searchPersonas(query: string): Persona[] {
    const q = query.toLowerCase().trim();
    if (!q) return this.getAllPersonas();

    return this.getAllPersonas().filter((p) => {
      return (
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.communicationStyle.toLowerCase().includes(q) ||
        p.personalityTraits.some((t) => t.toLowerCase().includes(q))
      );
    });
  }
}
