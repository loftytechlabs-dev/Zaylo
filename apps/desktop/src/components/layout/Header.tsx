import React, { useState } from 'react';
import { Play, Square, RefreshCw, Copy, Check, Sun, Moon } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';

export const Header: React.FC = () => {
  const {
    activeTab,
    selectedModel,
    theme,
    toggleTheme,
    serverState,
    serverInstance,
    serverConfig,
    lanAddress,
    startServer,
    stopServer,
    restartServer,
  } = useAppStore();

  const [copied, setCopied] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);

  const endpointUrl = `http://${serverConfig?.lanEnabled && lanAddress ? lanAddress : '127.0.0.1'}:${serverConfig?.port || 8080}/v1`;

  const handleCopyEndpoint = () => {
    navigator.clipboard.writeText(endpointUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleServer = async () => {
    setLoadingAction(true);
    try {
      if (serverState === 'RUNNING') {
        await stopServer();
      } else {
        await startServer();
      }
    } catch (err: any) {
      alert(`Server action failed: ${err.message}`);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleRestart = async () => {
    setLoadingAction(true);
    try {
      await restartServer();
    } catch (err: any) {
      alert(`Restart failed: ${err.message}`);
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <header className="h-16 border-b border-[#202227] bg-[#0c0d0f] px-8 flex items-center justify-between select-none">
      {/* Title & Active Model */}
      <div className="flex items-center gap-4">
        {activeTab === 'overview' ? (
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-sm font-semibold tracking-tight text-zinc-100">Overview</h1>
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono border ${
                  serverState === 'RUNNING'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : serverState === 'STARTING'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    : 'bg-zinc-800/50 text-zinc-400 border-zinc-700/50'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    serverState === 'RUNNING'
                      ? 'bg-emerald-400'
                      : serverState === 'STARTING'
                      ? 'bg-amber-400 animate-pulse'
                      : 'bg-zinc-500'
                  }`}
                />
                {serverState === 'RUNNING' ? 'Running' : serverState === 'STARTING' ? 'Starting' : 'Stopped'}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 font-normal leading-none mt-1">
              Your local AI environment at a glance.
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-sm font-semibold capitalize tracking-wide text-zinc-100">{activeTab}</h1>
            {activeTab === 'playground' && selectedModel ? (
              <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-[#17191e] border border-[#262930] text-xs font-mono text-zinc-300">
                <span className="text-zinc-500">Active:</span>
                <span className="text-blue-400 font-medium">{selectedModel}</span>
              </div>
            ) : serverInstance?.modelName ? (
              <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-[#17191e] border border-[#262930] text-xs font-mono text-zinc-300">
                <span className="text-zinc-500">Loaded:</span>
                <span className="text-blue-400 font-medium">{serverInstance.modelName}</span>
              </div>
            ) : null}
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {/* Copy endpoint button */}
        {serverState === 'RUNNING' && (
          <button
            onClick={handleCopyEndpoint}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#16181d] hover:bg-[#1f2229] border border-[#272a32] text-xs font-mono text-zinc-300 transition-colors"
            title="Copy OpenAI Base URL"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
            <span>{endpointUrl}</span>
          </button>
        )}

        {/* Server Start / Stop */}
        <button
          onClick={handleToggleServer}
          disabled={loadingAction || serverState === 'STARTING' || serverState === 'STOPPING'}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${
            serverState === 'RUNNING'
              ? 'bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50'
              : 'bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/50'
          } disabled:opacity-50`}
        >
          {serverState === 'RUNNING' ? (
            <>
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop Server</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Start Server</span>
            </>
          )}
        </button>

        {/* Restart Button */}
        {serverState === 'RUNNING' && (
          <button
            onClick={handleRestart}
            disabled={loadingAction}
            className="p-1.5 rounded-md bg-[#16181d] hover:bg-[#1f2229] border border-[#272a32] text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Restart Inference Engine"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingAction ? 'animate-spin' : ''}`} />
          </button>
        )}

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded-md bg-[#16181d] hover:bg-[#1f2229] border border-[#272a32] text-zinc-400 hover:text-zinc-200 transition-colors flex items-center justify-center"
          title={theme === 'dark' ? 'Switch to White Theme' : 'Switch to Dark Theme'}
          aria-label="Toggle Theme"
        >
          {theme === 'dark' ? (
            <Sun className="w-3.5 h-3.5 text-amber-400" />
          ) : (
            <Moon className="w-3.5 h-3.5 text-blue-600" />
          )}
        </button>
      </div>
    </header>
  );
};
