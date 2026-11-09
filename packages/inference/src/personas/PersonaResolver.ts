import type { Persona } from '@local-ai/shared';
import { BUILTIN_PERSONAS } from './builtinPersonas.js';

export class PersonaResolver {
  /**
   * Resolves the active persona for a conversation safely.
   * If personaId is invalid, missing, or belongs to a deleted persona,
   * falls back to the configured default persona or General Assistant.
   */
  public static resolve(
    personaId: string | undefined | null,
    personas: Persona[],
    defaultPersonaId: string = 'persona_general'
  ): Persona {
    const list = personas && personas.length > 0 ? personas : BUILTIN_PERSONAS;

    // 1. Try to find persona by requested ID
    if (personaId) {
      const match = list.find((p) => p.id === personaId);
      if (match) return match;
    }

    // 2. Fall back to designated default ID
    if (defaultPersonaId) {
      const defMatch = list.find((p) => p.id === defaultPersonaId);
      if (defMatch) return defMatch;
    }

    // 3. Fall back to any persona marked isDefault
    const markedDefault = list.find((p) => p.isDefault);
    if (markedDefault) return markedDefault;

    // 4. Fall back to General Assistant preset or first available
    const generalAssistant = list.find((p) => p.id === 'persona_general');
    if (generalAssistant) return generalAssistant;

    return list[0] || BUILTIN_PERSONAS[0];
  }
}
