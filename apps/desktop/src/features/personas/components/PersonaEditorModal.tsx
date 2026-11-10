import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  Copy,
  ShieldCheck,
  Eye,
  Sliders,
  AlertCircle,
} from 'lucide-react';
import type { Persona, PersonaCommunicationStyle } from '@local-ai/shared';
import { PersonaPromptAdapter } from '@local-ai/inference';

interface PersonaEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  persona: Persona | null;
  onSave: (data: {
    id?: string;
    name: string;
    description: string;
    avatar?: string;
    systemInstructions: string;
    personalityTraits?: string[];
    communicationStyle?: PersonaCommunicationStyle;
    responsePreferences?: Persona['responsePreferences'];
    behavioralRules?: string[];
    responseStructure?: string;
    greetingMessage?: string;
  }) => void;
  onDuplicate?: (id: string, newName?: string) => void;
}

const POPULAR_AVATARS = ['🤖', '💻', '🔬', '✍️', '📊', '🛡️', '🧠', '⚡', '🎨', '🚀', '📚', '💡', '⚖️', '🧭'];

const COMMUNICATION_STYLES: PersonaCommunicationStyle[] = [
  'Professional',
  'Casual',
  'Technical',
  'Concise',
  'Detailed',
  'Friendly',
  'Academic',
  'Creative',
];

export const PersonaEditorModal: React.FC<PersonaEditorModalProps> = ({
  isOpen,
  onClose,
  persona,
  onSave,
  onDuplicate,
}) => {
  const isEditing = !!persona;
  const isBuiltIn = persona?.isBuiltIn ?? false;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatar, setAvatar] = useState('🤖');
  const [communicationStyle, setCommunicationStyle] = useState<PersonaCommunicationStyle>('Professional');
  const [personalityTraitsText, setPersonalityTraitsText] = useState('');
  const [behavioralRulesText, setBehavioralRulesText] = useState('');
  const [responseStructure, setResponseStructure] = useState('');
  const [greetingMessage, setGreetingMessage] = useState('');
  const [reasoningStyle, setReasoningStyle] = useState('');
  const [codeFormatting, setCodeFormatting] = useState('');
  const [formatPreference, setFormatPreference] = useState('');
  const [systemInstructions, setSystemInstructions] = useState('');

  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (persona) {
      setName(isBuiltIn ? `Custom ${persona.name}` : persona.name);
      setDescription(persona.description || '');
      setAvatar(persona.avatar || '🤖');
      setCommunicationStyle(persona.communicationStyle || 'Professional');
      setPersonalityTraitsText(persona.personalityTraits ? persona.personalityTraits.join(', ') : '');
      setBehavioralRulesText(persona.behavioralRules ? persona.behavioralRules.join('\n') : '');
      setResponseStructure(persona.responseStructure || '');
      setGreetingMessage(persona.greetingMessage || '');
      setReasoningStyle(persona.responsePreferences?.reasoningStyle || '');
      setCodeFormatting(persona.responsePreferences?.codeFormatting || '');
      setFormatPreference(persona.responsePreferences?.formatPreference || '');
      setSystemInstructions(persona.systemInstructions || '');
    } else {
      setName('');
      setDescription('');
      setAvatar('✨');
      setCommunicationStyle('Professional');
      setPersonalityTraitsText('Helpful, Clear');
      setBehavioralRulesText('Be direct and accurate.\nAdapt tone to user needs.');
      setResponseStructure('Direct answer followed by detailed explanation.');
      setGreetingMessage('');
      setReasoningStyle('Direct and structured');
      setCodeFormatting('Clean Markdown');
      setFormatPreference('Standard Markdown');
      setSystemInstructions('You are an expert AI assistant specialized in solving problems efficiently.');
    }
    setErrorMessage(null);
    setActiveTab('editor');
  }, [persona, isOpen, isBuiltIn]);

  if (!isOpen) return null;

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage('Please enter a name for the persona.');
      return;
    }

    if (!systemInstructions.trim()) {
      setErrorMessage('Please provide core system instructions.');
      return;
    }

    const traits = personalityTraitsText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const rules = behavioralRulesText
      .split('\n')
      .map((r) => r.trim().replace(/^[-*•]\s*/, ''))
      .filter(Boolean);

    onSave({
      id: isBuiltIn ? undefined : persona?.id,
      name: name.trim(),
      description: description.trim(),
      avatar: avatar.trim() || '🤖',
      communicationStyle,
      personalityTraits: traits.length > 0 ? traits : ['Adaptive'],
      behavioralRules: rules,
      responseStructure: responseStructure.trim() || 'Clear and structured response.',
      greetingMessage: greetingMessage.trim() || undefined,
      responsePreferences: {
        reasoningStyle: reasoningStyle.trim() || undefined,
        codeFormatting: codeFormatting.trim() || undefined,
        formatPreference: formatPreference.trim() || undefined,
      },
      systemInstructions: systemInstructions.trim(),
    });

    onClose();
  };

  const dummyPersonaForPreview: Persona = {
    id: persona?.id || 'preview',
    name: name || 'Untitled Persona',
    description,
    avatar,
    communicationStyle,
    personalityTraits: personalityTraitsText.split(',').map((t) => t.trim()).filter(Boolean),
    behavioralRules: behavioralRulesText.split('\n').map((r) => r.trim()).filter(Boolean),
    responseStructure,
    greetingMessage,
    responsePreferences: {
      reasoningStyle,
      codeFormatting,
      formatPreference,
    },
    systemInstructions,
    isBuiltIn: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const previewComposedPrompt = PersonaPromptAdapter.composeSystemPrompt(
    'You are a private local AI assistant running on this server.',
    dummyPersonaForPreview
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm select-none">
      <div className="w-full max-w-2xl bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#eaeaea] dark:border-[#222222] flex items-center justify-between bg-zinc-50 dark:bg-[#191919]">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">{avatar}</span>
            <div>
              <h2 className="text-sm font-bold text-[#111111] dark:text-[#F5F5F5] flex items-center gap-2">
                <span>{isEditing ? (isBuiltIn ? `Inspect Preset: ${persona.name}` : `Edit Persona: ${persona.name}`) : 'Create New Persona'}</span>
                {isBuiltIn && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700/50">
                    <ShieldCheck className="w-2.5 h-2.5" />
                    <span>BUILT-IN PRESET</span>
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-zinc-500 dark:text-[#A1A1AA] mt-0.5">
                {isBuiltIn
                  ? 'Built-in presets are protected. Modifications will be saved as a new custom persona.'
                  : 'Customize how your local AI reasons, communicates, and structures responses.'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-[#F5F5F5] hover:bg-zinc-100 dark:hover:bg-[#202020] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Controls: Editor vs Prompt Preview */}
        <div className="px-6 pt-3 border-b border-[#eaeaea] dark:border-[#222222] flex items-center gap-2 bg-zinc-50 dark:bg-[#191919]">
          <button
            type="button"
            onClick={() => setActiveTab('editor')}
            className={`flex items-center gap-1.5 px-3 py-1.5 border-b-2 text-xs font-medium transition-colors ${
              activeTab === 'editor'
                ? 'border-black dark:border-white text-black dark:text-white'
                : 'border-transparent text-zinc-500 hover:text-black dark:hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Profile Configuration</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`flex items-center gap-1.5 px-3 py-1.5 border-b-2 text-xs font-medium transition-colors ${
              activeTab === 'preview'
                ? 'border-black dark:border-white text-black dark:text-white'
                : 'border-transparent text-zinc-500 hover:text-black dark:hover:text-white'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Composed Prompt Preview</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {activeTab === 'preview' ? (
            <div className="space-y-3">
              <div className="text-xs text-zinc-500 dark:text-[#A1A1AA]">
                This preview illustrates how this persona's directives will be layered onto the model's runtime prompt alongside base system instructions:
              </div>
              <pre className="p-4 rounded-xl bg-zinc-50 dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] text-[11px] font-mono text-zinc-800 dark:text-[#F5F5F5] whitespace-pre-wrap overflow-x-auto leading-relaxed max-h-96">
                {previewComposedPrompt}
              </pre>
            </div>
          ) : (
            <form id="persona-form" onSubmit={handleFormSubmit} className="space-y-4">
              {/* Name & Avatar */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-3 space-y-1">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-[#A1A1AA] block">
                    Persona Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Senior Backend Architect"
                    required
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] text-xs text-[#111111] dark:text-[#F5F5F5] placeholder-zinc-400 dark:placeholder-[#737373] focus:outline-none focus:border-black dark:focus:border-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-[#A1A1AA] block">
                    Avatar
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={avatar}
                      onChange={(e) => setAvatar(e.target.value)}
                      maxLength={4}
                      className="w-14 px-2 py-2 text-center rounded-lg bg-white dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] text-sm text-[#111111] dark:text-[#F5F5F5] focus:outline-none focus:border-black dark:focus:border-white"
                    />
                    <div className="flex gap-1 overflow-x-auto py-1">
                      {POPULAR_AVATARS.slice(0, 4).map((em) => (
                        <button
                          key={em}
                          type="button"
                          onClick={() => setAvatar(em)}
                          className="px-1.5 py-1 rounded bg-zinc-100 dark:bg-[#191919] hover:bg-zinc-200 dark:hover:bg-[#202020] text-xs transition-colors"
                        >
                          {em}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700 dark:text-[#A1A1AA] block">
                  Short Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Specialized in system design, distributed consensus, and concurrency."
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] text-xs text-[#111111] dark:text-[#F5F5F5] placeholder-zinc-400 dark:placeholder-[#737373] focus:outline-none focus:border-black dark:focus:border-white"
                />
              </div>

              {/* Communication Style & Response Structure */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-[#A1A1AA] block">
                    Communication Style
                  </label>
                  <select
                    value={communicationStyle}
                    onChange={(e) => setCommunicationStyle(e.target.value as PersonaCommunicationStyle)}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] text-xs text-[#111111] dark:text-[#F5F5F5] focus:outline-none focus:border-black dark:focus:border-white"
                  >
                    {COMMUNICATION_STYLES.map((style) => (
                      <option key={style} value={style}>
                        {style}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-[#A1A1AA] block">
                    Preferred Response Structure
                  </label>
                  <input
                    type="text"
                    value={responseStructure}
                    onChange={(e) => setResponseStructure(e.target.value)}
                    placeholder="e.g. Direct solution first, then rationale and edge cases."
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] text-xs text-[#111111] dark:text-[#F5F5F5] placeholder-zinc-400 dark:placeholder-[#737373] focus:outline-none focus:border-black dark:focus:border-white"
                  />
                </div>
              </div>

              {/* Personality Traits */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700 dark:text-[#A1A1AA] block">
                  Personality Traits (comma-separated)
                </label>
                <input
                  type="text"
                  value={personalityTraitsText}
                  onChange={(e) => setPersonalityTraitsText(e.target.value)}
                  placeholder="e.g. Technical, Rigorous, Solution-Oriented"
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] text-xs text-[#111111] dark:text-[#F5F5F5] placeholder-zinc-400 dark:placeholder-[#737373] focus:outline-none focus:border-black dark:focus:border-white"
                />
              </div>

              {/* Behavioral Directives */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700 dark:text-[#A1A1AA] block">
                  Behavioral Directives & Rules (one per line)
                </label>
                <textarea
                  value={behavioralRulesText}
                  onChange={(e) => setBehavioralRulesText(e.target.value)}
                  rows={3}
                  placeholder={`- Always provide production-ready code with error checks\n- Cite assumptions explicitly\n- Avoid unnecessary conversational filler`}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] text-xs text-[#111111] dark:text-[#F5F5F5] placeholder-zinc-400 dark:placeholder-[#737373] focus:outline-none focus:border-black dark:focus:border-white font-mono"
                />
              </div>

              {/* Response Preferences */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-zinc-500 dark:text-[#737373] block">
                    Reasoning Style
                  </label>
                  <input
                    type="text"
                    value={reasoningStyle}
                    onChange={(e) => setReasoningStyle(e.target.value)}
                    placeholder="e.g. First-principles"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] text-xs text-[#111111] dark:text-[#F5F5F5] placeholder-zinc-400 dark:placeholder-[#737373] focus:outline-none focus:border-black dark:focus:border-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-zinc-500 dark:text-[#737373] block">
                    Code Formatting
                  </label>
                  <input
                    type="text"
                    value={codeFormatting}
                    onChange={(e) => setCodeFormatting(e.target.value)}
                    placeholder="e.g. Typed snippets"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] text-xs text-[#111111] dark:text-[#F5F5F5] placeholder-zinc-400 dark:placeholder-[#737373] focus:outline-none focus:border-black dark:focus:border-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-zinc-500 dark:text-[#737373] block">
                    Output Format
                  </label>
                  <input
                    type="text"
                    value={formatPreference}
                    onChange={(e) => setFormatPreference(e.target.value)}
                    placeholder="e.g. Markdown tables"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] text-xs text-[#111111] dark:text-[#F5F5F5] placeholder-zinc-400 dark:placeholder-[#737373] focus:outline-none focus:border-black dark:focus:border-white"
                  />
                </div>
              </div>

              {/* Optional Greeting Message */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700 dark:text-[#A1A1AA] block">
                  Optional Greeting Message
                </label>
                <input
                  type="text"
                  value={greetingMessage}
                  onChange={(e) => setGreetingMessage(e.target.value)}
                  placeholder="e.g. Ready to architect your distributed system. Where shall we start?"
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] text-xs text-[#111111] dark:text-[#F5F5F5] placeholder-zinc-400 dark:placeholder-[#737373] focus:outline-none focus:border-black dark:focus:border-white"
                />
              </div>

              {/* Core System Instructions */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-700 dark:text-[#A1A1AA]">
                    Core System Instructions <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-zinc-400 dark:text-[#737373] font-mono">
                    Advanced Instruction Engine
                  </span>
                </div>
                <textarea
                  value={systemInstructions}
                  onChange={(e) => setSystemInstructions(e.target.value)}
                  rows={5}
                  required
                  placeholder="Define the primary personality, depth, analytical rigor, and core behavior of this persona..."
                  className="w-full px-3 py-2.5 rounded-lg bg-white dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] text-xs text-[#111111] dark:text-[#F5F5F5] placeholder-zinc-400 dark:placeholder-[#737373] focus:outline-none focus:border-black dark:focus:border-white font-mono leading-relaxed"
                />
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 border-t border-[#eaeaea] dark:border-[#222222] flex items-center justify-between bg-zinc-50 dark:bg-[#191919]">
          <div>
            {persona && onDuplicate && (
              <button
                type="button"
                onClick={() => {
                  onDuplicate(persona.id, `Copy of ${persona.name}`);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-[#141414] hover:bg-zinc-100 dark:hover:bg-[#202020] border border-[#eaeaea] dark:border-[#262626] text-xs font-medium text-zinc-700 dark:text-[#A1A1AA] transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Duplicate as Custom</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg border border-[#eaeaea] dark:border-[#262626] hover:bg-zinc-100 dark:hover:bg-[#202020] text-xs font-medium text-zinc-600 dark:text-[#A1A1AA] hover:text-[#111111] dark:hover:text-[#F5F5F5] transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              form="persona-form"
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-black dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-black text-xs font-medium transition-colors shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isBuiltIn ? 'Save as Custom Persona' : isEditing ? 'Save Changes' : 'Create Persona'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
