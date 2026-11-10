import React, { useState, useMemo } from 'react';
import {
  Users,
  Plus,
  Search,
  Sparkles,
  ShieldCheck,
  Filter,
  Star,
  MessageSquare,
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import type { Persona } from '@local-ai/shared';
import { PersonaCard } from './components/PersonaCard';
import { PersonaEditorModal } from './components/PersonaEditorModal';

export const PersonasView: React.FC = () => {
  const {
    personas,
    activePersonaId,
    defaultPersonaId,
    setActivePersonaId,
    setDefaultPersonaId,
    savePersona,
    duplicatePersona,
    deletePersona,
    setActiveTab,
  } = useAppStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStyleFilter, setSelectedStyleFilter] = useState<string>('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);

  // Active persona resolution
  const activePersona = useMemo(() => {
    return personas.find((p) => p.id === activePersonaId) || personas.find((p) => p.isDefault) || personas[0];
  }, [personas, activePersonaId]);

  // Default persona resolution
  const defaultPersona = useMemo(() => {
    return personas.find((p) => p.id === defaultPersonaId) || personas.find((p) => p.id === 'persona_general') || personas[0];
  }, [personas, defaultPersonaId]);

  // Filter personas
  const filteredPersonas = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return personas.filter((p) => {
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.communicationStyle.toLowerCase().includes(q) ||
        p.personalityTraits.some((t) => t.toLowerCase().includes(q));

      const matchesStyle =
        selectedStyleFilter === 'All' ||
        p.communicationStyle.toLowerCase() === selectedStyleFilter.toLowerCase();

      return matchesSearch && matchesStyle;
    });
  }, [personas, searchQuery, selectedStyleFilter]);

  const builtInPersonas = useMemo(() => {
    return filteredPersonas.filter((p) => p.isBuiltIn);
  }, [filteredPersonas]);

  const customPersonas = useMemo(() => {
    return filteredPersonas.filter((p) => !p.isBuiltIn);
  }, [filteredPersonas]);

  const handleOpenCreateModal = () => {
    setEditingPersona(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (persona: Persona) => {
    setEditingPersona(persona);
    setIsModalOpen(true);
  };

  const handleDuplicate = (id: string, newName?: string) => {
    try {
      const dup = duplicatePersona(id, newName);
      setEditingPersona(dup);
      setIsModalOpen(true);
    } catch (err: any) {
      alert(`Failed to duplicate persona: ${err.message}`);
    }
  };

  const handleDelete = (id: string) => {
    const target = personas.find((p) => p.id === id);
    if (!target) return;
    if (confirm(`Are you sure you want to delete custom persona "${target.name}"?`)) {
      try {
        deletePersona(id);
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  const styleFilters = ['All', 'Professional', 'Technical', 'Academic', 'Creative', 'Concise'];

  return (
    <div className="p-8 space-y-7 max-w-7xl mx-auto overflow-y-auto h-[calc(100vh-4rem)] select-none">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#eaeaea] dark:border-[#262626] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-base font-bold tracking-tight text-[#111111] dark:text-[#F5F5F5] flex items-center gap-2">
              <Users className="w-4 h-4 text-zinc-700 dark:text-[#A1A1AA]" />
              Personas
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-100 dark:bg-[#191919] text-zinc-700 dark:text-[#A1A1AA] border border-zinc-200 dark:border-[#262626]">
              One AI Engine · Multiple Personalities
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-[#A1A1AA] mt-1 max-w-2xl leading-relaxed">
            Configure specialized behavioral and instruction profiles that adapt how your local models respond, reason, and communicate without requiring separate model weights.
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-black dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-black text-xs font-medium transition-all shadow-xs shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Create Persona</span>
        </button>
      </div>

      {/* Active Persona Banner */}
      {activePersona && (
        <div className="p-4 rounded-xl bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-[#191919] border border-zinc-200 dark:border-[#262626] flex items-center justify-center text-xl shrink-0">
              {activePersona.avatar || '🤖'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono text-zinc-500 dark:text-[#737373]">Current Global Active Persona:</span>
                <span className="text-xs font-bold text-[#111111] dark:text-[#F5F5F5]">{activePersona.name}</span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>ACTIVE</span>
                </span>
                {activePersona.id === defaultPersona?.id && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-mono bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                    <Star className="w-2.5 h-2.5 fill-current" />
                    <span>DEFAULT</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-[#A1A1AA] truncate mt-0.5 max-w-xl">
                {activePersona.description || 'Instruction profile applied to new conversations.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setActiveTab('playground')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-xs font-medium text-white dark:text-black transition-colors shadow-xs"
              title="Open Playground with this active persona"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Chat in Playground</span>
            </button>
            <button
              onClick={() => handleOpenEditModal(activePersona)}
              className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#191919] hover:bg-zinc-50 dark:hover:bg-[#202020] border border-[#eaeaea] dark:border-[#262626] text-xs font-medium text-zinc-700 dark:text-[#A1A1AA] transition-colors"
            >
              {activePersona.isBuiltIn ? 'View Directives' : 'Edit Profile'}
            </button>
          </div>
        </div>
      )}

      {/* Search & Style Filter Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search personas by name, purpose, or traits..."
            className="w-full pl-9 pr-4 py-1.5 rounded-lg bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] text-xs text-[#111111] dark:text-[#F5F5F5] placeholder-zinc-400 dark:placeholder-[#737373] focus:outline-none focus:border-black dark:focus:border-white transition-colors"
          />
        </div>

        {/* Style Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1 text-xs">
          <span className="text-[11px] font-mono text-zinc-500 dark:text-[#737373] flex items-center gap-1 mr-1">
            <Filter className="w-3 h-3" />
            <span>Style:</span>
          </span>
          {styleFilters.map((style) => (
            <button
              key={style}
              onClick={() => setSelectedStyleFilter(style)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                selectedStyleFilter === style
                  ? 'bg-black dark:bg-white text-white dark:text-black'
                  : 'bg-zinc-100 dark:bg-[#141414] border border-zinc-200 dark:border-[#262626] text-zinc-600 dark:text-[#A1A1AA] hover:text-black dark:hover:text-white'
              }`}
            >
              {style}
            </button>
          ))}
        </div>
      </div>

      {/* Built-in Presets Section */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
            <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
              Built-in Protected Presets ({builtInPersonas.length})
            </h2>
          </div>
          <span className="text-[11px] text-zinc-500 font-sans">
            Guaranteed default profiles · Duplicate to customize
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {builtInPersonas.map((persona) => (
            <PersonaCard
              key={persona.id}
              persona={persona}
              isActive={persona.id === activePersonaId}
              isDefault={persona.id === defaultPersonaId}
              onActivate={() => setActivePersonaId(persona.id)}
              onSetDefault={() => setDefaultPersonaId(persona.id)}
              onEdit={() => handleOpenEditModal(persona)}
              onDuplicate={() => handleDuplicate(persona.id)}
            />
          ))}
        </div>
      </div>

      {/* Custom Personas Section */}
      <div className="space-y-3.5 pt-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
            <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
              Custom Personas ({customPersonas.length})
            </h2>
          </div>
          <span className="text-[11px] text-zinc-500 font-sans">
            Tailored personalities created by you
          </span>
        </div>

        {customPersonas.length === 0 ? (
          <div className="p-8 rounded-xl border border-dashed border-[#eaeaea] dark:border-[#262626] bg-white dark:bg-[#141414] text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-[#191919] text-zinc-600 dark:text-[#A1A1AA] flex items-center justify-center mx-auto text-lg">
              ✨
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#111111] dark:text-[#F5F5F5]">No custom personas yet</h3>
              <p className="text-xs text-zinc-500 dark:text-[#A1A1AA] mt-1 max-w-sm mx-auto">
                Create tailored AI profiles for specialized workflows, unique domain expertise, or distinct reasoning styles.
              </p>
            </div>
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-black text-xs font-medium transition-colors shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Custom Persona</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {customPersonas.map((persona) => (
              <PersonaCard
                key={persona.id}
                persona={persona}
                isActive={persona.id === activePersonaId}
                isDefault={persona.id === defaultPersonaId}
                onActivate={() => setActivePersonaId(persona.id)}
                onSetDefault={() => setDefaultPersonaId(persona.id)}
                onEdit={() => handleOpenEditModal(persona)}
                onDuplicate={() => handleDuplicate(persona.id)}
                onDelete={() => handleDelete(persona.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Persona Creation / Editing Modal */}
      <PersonaEditorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        persona={editingPersona}
        onSave={savePersona}
        onDuplicate={handleDuplicate}
      />
    </div>
  );
};
