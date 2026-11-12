import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WorkspacePreferences {
  builderMode: boolean;
  setBuilderMode: (value: boolean) => void;
}

/** Device-local controls for advanced persona editing. */
export const useWorkspacePreferences = create<WorkspacePreferences>()(persist((set) => ({
  builderMode: false,
  setBuilderMode: (builderMode) => set({ builderMode }),
}), { name: 'zaylo-workspace-preferences', version: 1 }));
