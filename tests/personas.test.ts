import { describe, it, expect, beforeEach } from 'vitest';
import {
  BUILTIN_PERSONAS,
  PersonaStore,
  PersonaManager,
  PersonaResolver,
  PersonaPromptAdapter,
  type StorageAdapter,
} from '@local-ai/inference';
import type { ChatMessage, Persona } from '@local-ai/shared';

class MockStorage implements StorageAdapter {
  private data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
}

describe('Personas System', () => {
  let mockStorage: MockStorage;
  let personaStore: PersonaStore;
  let personaManager: PersonaManager;

  beforeEach(() => {
    mockStorage = new MockStorage();
    personaStore = new PersonaStore(mockStorage);
    personaManager = new PersonaManager(personaStore);
  });

  describe('Built-in Presets', () => {
    it('should have all 6 protected presets defined', () => {
      const presets = BUILTIN_PERSONAS;
      expect(presets).toHaveLength(6);

      const ids = presets.map((p) => p.id);
      expect(ids).toContain('persona_general');
      expect(ids).toContain('persona_developer');
      expect(ids).toContain('persona_researcher');
      expect(ids).toContain('persona_writer');
      expect(ids).toContain('persona_analyst');
      expect(ids).toContain('persona_code_reviewer');

      for (const p of presets) {
        expect(p.isBuiltIn).toBe(true);
        expect(p.name).toBeTruthy();
        expect(p.systemInstructions).toBeTruthy();
        expect(p.communicationStyle).toBeTruthy();
        expect(p.behavioralRules.length).toBeGreaterThan(0);
        expect(p.responseStructure).toBeTruthy();
      }
    });

    it('should designate General Assistant as default', () => {
      const general = BUILTIN_PERSONAS.find((p) => p.id === 'persona_general');
      expect(general).toBeDefined();
      expect(general?.isDefault).toBe(true);
    });
  });

  describe('PersonaStore', () => {
    it('should initialize with built-in presets on clean storage', () => {
      const loaded = personaStore.loadPersonas();
      expect(loaded.length).toBe(6);
      expect(loaded[0].id).toBe('persona_general');
    });

    it('should persist and reload custom personas while protecting built-ins', () => {
      const custom: Persona = {
        id: 'persona_custom_1',
        name: 'Math Tutor',
        description: 'Teaches calculus and linear algebra step-by-step',
        avatar: '📐',
        systemInstructions: 'Guide the user through derivations.',
        personalityTraits: ['Patient', 'Pedagogical'],
        communicationStyle: 'Academic',
        behavioralRules: ['Show intermediate steps'],
        responseStructure: 'Step-by-step solution',
        isBuiltIn: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      personaStore.savePersonas([...BUILTIN_PERSONAS, custom]);
      const reloaded = personaStore.loadPersonas();
      expect(reloaded).toHaveLength(7);
      expect(reloaded.find((p) => p.id === 'persona_custom_1')?.name).toBe('Math Tutor');
    });

    it('should persist and retrieve default persona ID', () => {
      expect(personaStore.getDefaultPersonaId()).toBe('persona_general');
      personaStore.setDefaultPersonaId('persona_developer');
      expect(personaStore.getDefaultPersonaId()).toBe('persona_developer');
    });

    it('should persist and retrieve active persona ID', () => {
      expect(personaStore.getActivePersonaId()).toBe('persona_general');
      personaStore.setActivePersonaId('persona_researcher');
      expect(personaStore.getActivePersonaId()).toBe('persona_researcher');
    });
  });

  describe('PersonaManager', () => {
    it('should create a custom persona with validation', () => {
      const created = personaManager.createPersona({
        name: 'DevOps Guru',
        description: 'Docker, Kubernetes, and CI/CD pipelines',
        avatar: '🚢',
        systemInstructions: 'Focus on infrastructure-as-code and reliability.',
        communicationStyle: 'Technical',
        personalityTraits: ['Automation-first', 'Reliable'],
        behavioralRules: ['Prefer declarative YAML', 'Always include health checks'],
      });

      expect(created.id).toContain('persona_custom_');
      expect(created.isBuiltIn).toBe(false);
      expect(created.name).toBe('DevOps Guru');

      const all = personaManager.getAllPersonas();
      expect(all).toHaveLength(7);
      expect(personaManager.getCustomPersonas()).toHaveLength(1);
    });

    it('should reject creating a persona without required name or instructions', () => {
      expect(() => {
        personaManager.createPersona({
          name: '',
          description: 'No name',
          systemInstructions: 'Valid instructions',
        });
      }).toThrow('Persona name is required');

      expect(() => {
        personaManager.createPersona({
          name: 'Valid Name',
          description: 'Valid description',
          systemInstructions: '',
        });
      }).toThrow('System instructions are required');
    });

    it('should duplicate a built-in persona into an editable custom persona', () => {
      const dup = personaManager.duplicatePersona('persona_developer', 'My Custom Developer');
      expect(dup.id).not.toBe('persona_developer');
      expect(dup.isBuiltIn).toBe(false);
      expect(dup.name).toBe('My Custom Developer');
      expect(dup.communicationStyle).toBe('Technical');
      expect(dup.behavioralRules).toEqual(
        BUILTIN_PERSONAS.find((p) => p.id === 'persona_developer')?.behavioralRules
      );

      // Original built-in remains unchanged
      const orig = personaManager.getPersona('persona_developer');
      expect(orig?.isBuiltIn).toBe(true);
      expect(orig?.name).toBe('Developer');
    });

    it('should prevent mutating built-in presets directly', () => {
      expect(() => {
        personaManager.updatePersona('persona_general', { name: 'Hacked General' });
      }).toThrow(/protected/);
    });

    it('should update custom persona fields', () => {
      const created = personaManager.createPersona({
        name: 'Draft Assistant',
        description: 'Initial draft',
        systemInstructions: 'Drafting instructions',
      });

      const updated = personaManager.updatePersona(created.id, {
        description: 'Polished draft description',
        communicationStyle: 'Creative',
      });

      expect(updated.description).toBe('Polished draft description');
      expect(updated.communicationStyle).toBe('Creative');
      expect(personaManager.getPersona(created.id)?.description).toBe('Polished draft description');
    });

    it('should prevent deleting built-in presets', () => {
      expect(() => {
        personaManager.deletePersona('persona_general');
      }).toThrow(/Cannot delete built-in/);

      expect(() => {
        personaManager.deletePersona('persona_code_reviewer');
      }).toThrow(/Cannot delete built-in/);
    });

    it('should delete custom personas', () => {
      const created = personaManager.createPersona({
        name: 'Temporary Persona',
        description: 'Will be deleted',
        systemInstructions: 'Temp',
      });

      expect(personaManager.getCustomPersonas()).toHaveLength(1);
      const deleted = personaManager.deletePersona(created.id);
      expect(deleted).toBe(true);
      expect(personaManager.getCustomPersonas()).toHaveLength(0);
    });

    it('should search personas by name, description, and traits', () => {
      const results1 = personaManager.searchPersonas('debugging');
      expect(results1.some((p) => p.id === 'persona_developer')).toBe(true);

      const results2 = personaManager.searchPersonas('academic');
      expect(results2.some((p) => p.id === 'persona_researcher')).toBe(true);
    });
  });

  describe('PersonaResolver', () => {
    it('should resolve an existing persona by id', () => {
      const resolved = PersonaResolver.resolve('persona_writer', BUILTIN_PERSONAS);
      expect(resolved.id).toBe('persona_writer');
      expect(resolved.name).toBe('Writer');
    });

    it('should gracefully fall back to default when persona id is null or undefined', () => {
      const resolved = PersonaResolver.resolve(undefined, BUILTIN_PERSONAS, 'persona_developer');
      expect(resolved.id).toBe('persona_developer');
    });

    it('should fall back to General Assistant when requested id is not found and default is missing', () => {
      const resolved = PersonaResolver.resolve('non_existent_id_123', BUILTIN_PERSONAS, 'missing_default');
      expect(resolved.id).toBe('persona_general');
    });
  });

  describe('PersonaPromptAdapter', () => {
    it('should layer persona instructions on top of existing system prompt', () => {
      const baseSystemPrompt = 'You are a private local AI assistant.';
      const developer = BUILTIN_PERSONAS.find((p) => p.id === 'persona_developer')!;

      const composed = PersonaPromptAdapter.composeSystemPrompt(baseSystemPrompt, developer);

      // Base system prompt preserved at the top
      expect(composed.startsWith(baseSystemPrompt)).toBe(true);

      // Persona metadata present
      expect(composed).toContain('[Active Persona: Developer]');
      expect(composed).toContain('Communication Style: Technical');
      expect(composed).toContain('Behavioral Rules:');
      expect(composed).toContain('Preferred Response Structure:');
      expect(composed).toContain(developer.systemInstructions);
    });

    it('should handle empty or undefined base system prompt gracefully', () => {
      const writer = BUILTIN_PERSONAS.find((p) => p.id === 'persona_writer')!;
      const composed = PersonaPromptAdapter.composeSystemPrompt(undefined, writer);

      expect(composed).toContain('[Active Persona: Writer]');
      expect(composed).toContain(writer.systemInstructions);
    });

    it('should augment messages without an existing system message', () => {
      const analyst = BUILTIN_PERSONAS.find((p) => p.id === 'persona_analyst')!;
      const messages: ChatMessage[] = [{ role: 'user', content: 'What is our Q3 churn rate?' }];

      const augmented = PersonaPromptAdapter.augmentMessages(messages, analyst, 'Base assistant rules');

      expect(augmented).toHaveLength(2);
      expect(augmented[0].role).toBe('system');
      expect(augmented[0].content).toContain('Base assistant rules');
      expect(augmented[0].content).toContain('[Active Persona: Analyst]');
      expect(augmented[1].role).toBe('user');
    });

    it('should augment existing system message without replacing it', () => {
      const researcher = BUILTIN_PERSONAS.find((p) => p.id === 'persona_researcher')!;
      const messages: ChatMessage[] = [
        { role: 'system', content: 'Existing system prompt configured in settings.' },
        { role: 'user', content: 'Analyze the solar cycle data.' },
      ];

      const augmented = PersonaPromptAdapter.augmentMessages(messages, researcher);

      expect(augmented).toHaveLength(2);
      expect(augmented[0].role).toBe('system');
      expect(augmented[0].content).toContain('Existing system prompt configured in settings.');
      expect(augmented[0].content).toContain('[Active Persona: Researcher]');
      expect(augmented[1].role).toBe('user');
    });

    it('should leave messages unaltered if no persona is provided', () => {
      const messages: ChatMessage[] = [{ role: 'user', content: 'Hello' }];
      const result = PersonaPromptAdapter.augmentMessages(messages, null, null);
      expect(result).toEqual(messages);
    });
  });
});
