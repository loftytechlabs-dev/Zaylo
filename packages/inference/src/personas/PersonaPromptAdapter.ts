import type { ChatMessage, Persona } from '@local-ai/shared';

export class PersonaPromptAdapter {
  /**
   * Safely layers persona instructions on top of existing base system instructions.
   * Never overwrites or replaces existing application-level or system instructions.
   */
  public static composeSystemPrompt(baseSystemPrompt: string | undefined | null, persona: Persona): string {
    const sections: string[] = [];

    // 1. Preserve existing base system instructions if present
    if (baseSystemPrompt && baseSystemPrompt.trim()) {
      sections.push(baseSystemPrompt.trim());
    }

    // 2. Build structured persona instruction layer
    const personaLines: string[] = [];
    personaLines.push(`[Active Persona: ${persona.name}]`);

    if (persona.description && persona.description.trim()) {
      personaLines.push(`Role & Purpose: ${persona.description.trim()}`);
    }

    if (persona.communicationStyle) {
      personaLines.push(`Communication Style: ${persona.communicationStyle}`);
    }

    if (persona.personalityTraits && persona.personalityTraits.length > 0) {
      personaLines.push(`Personality Traits: ${persona.personalityTraits.join(', ')}`);
    }

    if (persona.responseStructure && persona.responseStructure.trim()) {
      personaLines.push(`Preferred Response Structure: ${persona.responseStructure.trim()}`);
    }

    if (persona.behavioralRules && persona.behavioralRules.length > 0) {
      personaLines.push(`Behavioral Rules:\n${persona.behavioralRules.map((r) => `- ${r}`).join('\n')}`);
    }

    if (persona.responsePreferences) {
      const prefs: string[] = [];
      if (persona.responsePreferences.reasoningStyle) {
        prefs.push(`Reasoning: ${persona.responsePreferences.reasoningStyle}`);
      }
      if (persona.responsePreferences.codeFormatting) {
        prefs.push(`Code Formatting: ${persona.responsePreferences.codeFormatting}`);
      }
      if (persona.responsePreferences.formatPreference) {
        prefs.push(`Format Preference: ${persona.responsePreferences.formatPreference}`);
      }
      if (prefs.length > 0) {
        personaLines.push(`Response Preferences: ${prefs.join(' | ')}`);
      }
    }

    if (persona.systemInstructions && persona.systemInstructions.trim()) {
      personaLines.push(`Instructions:\n${persona.systemInstructions.trim()}`);
    }

    sections.push(personaLines.join('\n\n'));

    return sections.join('\n\n---\n\n');
  }

  /**
   * Safely augments a chat message list with active persona instructions.
   * If a system message already exists, its content is augmented with the persona instructions.
   * If no system message exists, a new system message is prepended.
   * If persona is null/undefined, messages are returned unmodified (with baseSystemPrompt prepended if given).
   */
  public static augmentMessages(
    messages: ChatMessage[],
    persona?: Persona | null,
    baseSystemPrompt?: string | null
  ): ChatMessage[] {
    if (!persona) {
      if (baseSystemPrompt && baseSystemPrompt.trim() && !messages.some((m) => m.role === 'system')) {
        return [{ role: 'system', content: baseSystemPrompt.trim() }, ...messages];
      }
      return messages;
    }

    const hasSystemMsg = messages.some((m) => m.role === 'system');

    if (!hasSystemMsg) {
      const composed = PersonaPromptAdapter.composeSystemPrompt(baseSystemPrompt, persona);
      return [{ role: 'system', content: composed }, ...messages];
    }

    return messages.map((m) => {
      if (m.role === 'system') {
        const existingContent =
          typeof m.content === 'string'
            ? m.content
            : Array.isArray(m.content)
            ? m.content.map((p) => (p.type === 'text' ? p.text || '' : '')).join(' ')
            : '';
        const augmented = PersonaPromptAdapter.composeSystemPrompt(existingContent || baseSystemPrompt, persona);
        return { ...m, content: augmented };
      }
      return m;
    });
  }
}
