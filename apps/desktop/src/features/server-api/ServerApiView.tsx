import React, { useState, useEffect } from 'react';
import {
  Server,
  Key,
  Copy,
  Check,
  Plus,
  Trash2,
  Code2,
  Wifi,
  Smartphone,
  QrCode,
  ExternalLink,
  Play,
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { api } from '../../api/client';

export const ServerApiView: React.FC = () => {
  const {
    serverState,
    serverConfig,
    lanAddress,
    apiKeys,
    installedModels,
    createKey,
    revokeKey,
    deleteKey,
    updateServerConfig,
    startServer,
  } = useAppStore();

  const [activeCodeLang, setActiveCodeLang] = useState<'curl' | 'python' | 'node'>('curl');
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [copiedMobileUrl, setCopiedMobileUrl] = useState(false);
  const [copiedRowKeyId, setCopiedRowKeyId] = useState<string | null>(null);

  // Editable snippet parameters
  const [selectedKeyText, setSelectedKeyText] = useState('');
  const [selectedModelText, setSelectedModelText] = useState('');
  const [customPrompt, setCustomPrompt] = useState('Explain quantum computing in one sentence.');
  const [apiTaskTab, setApiTaskTab] = useState<'chat' | 'vision' | 'image'>('chat');

  // QR Code State
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [includeKeyInQr, setIncludeKeyInQr] = useState(true);

  // Load and preserve persistent default raw key
  useEffect(() => {
    const savedDefaultKey = localStorage.getItem('default_raw_api_key');
    if (savedDefaultKey && !savedDefaultKey.includes('...')) {
      setSelectedKeyText(savedDefaultKey);
      setGeneratedKey(savedDefaultKey);
    } else if (apiKeys && apiKeys.length > 0) {
      const active = apiKeys.find((k) => !k.isRevoked && k.rawKey && !k.rawKey.includes('...'));
      if (active?.rawKey) {
        setSelectedKeyText(active.rawKey);
        setGeneratedKey(active.rawKey);
        localStorage.setItem('default_raw_api_key', active.rawKey);
      }
    }
  }, [apiKeys]);

  const hostIp = serverConfig?.lanEnabled && lanAddress ? lanAddress : '127.0.0.1';
  const port = serverConfig?.port || 8080;
  const webChatUrl = `http://${hostIp}:${port}`;
  const apiEndpointUrl = `http://${hostIp}:${port}/v1`;

  // Initialize selected model from loaded or first installed model
  useEffect(() => {
    if (!selectedModelText) {
      const loaded = installedModels.find((m) => m.isLoaded);
      if (loaded) {
        setSelectedModelText(loaded.name);
      } else if (installedModels.length > 0) {
        setSelectedModelText(installedModels[0].name);
      } else {
        setSelectedModelText('default');
      }
    }
  }, [installedModels, selectedModelText]);

  // Load QR code when requested
  useEffect(() => {
    const generateQr = async () => {
      // Use full raw generated key if available, otherwise just web URL
      const keyToUse = generatedKey || selectedKeyText;
      const isValidRawKey = keyToUse && !keyToUse.includes('...');
      const urlToEncode = includeKeyInQr && isValidRawKey
        ? `${webChatUrl}/?key=${keyToUse}`
        : webChatUrl;

      try {
        const res = await api.invoke('network:get-qr-code', { text: urlToEncode });
        setQrDataUrl(res?.qrDataUrl || null);
      } catch (err) {
        console.error('Failed to generate QR code:', err);
      }
    };

    if (showQrModal) {
      generateQr();
    }
  }, [showQrModal, includeKeyInQr, webChatUrl, generatedKey, selectedKeyText]);

  const handleCreateKey = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const name = newKeyName.trim() || `Client Key (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
    try {
      const res = await createKey(name);
      setGeneratedKey(res.rawKey);
      setSelectedKeyText(res.rawKey);
      localStorage.setItem('default_raw_api_key', res.rawKey);
      setNewKeyName('');
      setIsCreatingKey(false);
    } catch (err: any) {
      alert(`Key creation failed: ${err.message}`);
    }
  };

  const handleDeleteKey = async (keyId: string, prefix: string) => {
    try {
      await deleteKey(keyId);
      const saved = localStorage.getItem('default_raw_api_key');
      if (saved && (saved.startsWith(prefix.replace('...', '')) || selectedKeyText === saved)) {
        localStorage.removeItem('default_raw_api_key');
        setSelectedKeyText('');
        setGeneratedKey(null);
      }
    } catch (err: any) {
      alert(`Failed to delete key: ${err.message}`);
    }
  };

  const handleCopyRowKey = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedRowKeyId(id);
    setTimeout(() => setCopiedRowKeyId(null), 2000);
  };

  const handleToggleLan = async (enabled: boolean) => {
    try {
      await updateServerConfig({ lanEnabled: enabled });
    } catch (err: any) {
      alert(`Failed to update LAN configuration: ${err.message}`);
    }
  };

  // If no unmasked key is typed yet, show helper text or the generated key
  const effectiveKey = selectedKeyText.trim() || (generatedKey || 'lcl_click_quick_gen_to_create_key');
  const effectiveModel = selectedModelText || 'default';

  const codeSnippets = React.useMemo(() => {
    if (apiTaskTab === 'image') {
      return {
        curl: `curl ${apiEndpointUrl}/images/generations \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${effectiveKey}" \\
  -d '{
    "model": "${effectiveModel}",
    "prompt": "${customPrompt.replace(/"/g, '\\"')}",
    "size": "512x512",
    "n": 1,
    "response_format": "url"
  }'`,
        python: `from openai import OpenAI

client = OpenAI(
    base_url="${apiEndpointUrl}",
    api_key="${effectiveKey}"
)

# Generate image locally using Zaylo Diffusion Engine
response = client.images.generate(
    model="${effectiveModel}",
    prompt="${customPrompt.replace(/"/g, '\\"')}",
    size="512x512",
    n=1
)

image_url = response.data[0].url
print(f"Generated Image URL: {image_url}")`,
        node: `import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: '${apiEndpointUrl}',
  apiKey: '${effectiveKey}',
});

// Generate image locally using Zaylo Diffusion Engine
const response = await client.images.generate({
  model: '${effectiveModel}',
  prompt: '${customPrompt.replace(/'/g, "\\'")}',
  size: '512x512',
  n: 1,
});

console.log('Generated Image URL:', response.data[0].url);
`,
      };
    }

    if (apiTaskTab === 'vision') {
      return {
        curl: `curl ${apiEndpointUrl}/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${effectiveKey}" \\
  -d '{
    "model": "${effectiveModel}",
    "messages": [
      {
        "role": "user",
        "content": [
          { "type": "text", "text": "${customPrompt.replace(/"/g, '\\"')}" },
          { "type": "image_url", "image_url": { "url": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/2560px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg" } }
        ]
      }
    ],
    "temperature": 0.7,
    "stream": true
  }'`,
        python: `from openai import OpenAI

client = OpenAI(
    base_url="${apiEndpointUrl}",
    api_key="${effectiveKey}"
)

# Multimodal Visual Understanding (supports base64 and URLs)
response = client.chat.completions.create(
    model="${effectiveModel}",
    messages=[
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "${customPrompt.replace(/"/g, '\\"')}"},
                {"type": "image_url", "image_url": {"url": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/2560px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg"}}
            ]
        }
    ],
    stream=True
)

for chunk in response:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="", flush=True)
print()`,
        node: `import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: '${apiEndpointUrl}',
  apiKey: '${effectiveKey}',
});

// Multimodal Visual Understanding
const stream = await client.chat.completions.create({
  model: '${effectiveModel}',
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: '${customPrompt.replace(/'/g, "\\'")}' },
        { type: 'image_url', image_url: { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/2560px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg' } }
      ]
    }
  ],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || '');
}
`,
      };
    }

    return {
      curl: `curl ${apiEndpointUrl}/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${effectiveKey}" \\
  -d '{
    "model": "${effectiveModel}",
    "messages": [
      { "role": "user", "content": "${customPrompt.replace(/"/g, '\\"')}" }
    ],
    "temperature": 0.7,
    "stream": true
  }'`,
      python: `from openai import OpenAI

client = OpenAI(
    base_url="${apiEndpointUrl}",
    api_key="${effectiveKey}"
)

response = client.chat.completions.create(
    model="${effectiveModel}",
    messages=[
        {"role": "user", "content": "${customPrompt.replace(/"/g, '\\"')}"}
    ],
    stream=True
)

for chunk in response:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="", flush=True)
print()`,
      node: `import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: '${apiEndpointUrl}',
  apiKey: '${effectiveKey}',
});

const stream = await client.chat.completions.create({
  model: '${effectiveModel}',
  messages: [{ role: 'user', content: '${customPrompt.replace(/'/g, "\\'")}' }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || '');
}
`,
    };
  }, [apiTaskTab, apiEndpointUrl, effectiveKey, effectiveModel, customPrompt]);

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto overflow-y-auto h-[calc(100vh-4rem)]">
      {/* 1. Mobile & Web Chat Access Banner */}
      <div className="p-6 rounded-xl bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-[#111111] dark:text-[#f5f5f5]" />
              <h2 className="text-base font-bold text-[#111111] dark:text-[#f5f5f5]">Mobile & LAN Web Chat Interface</h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
                PHONE & TABLET
              </span>
            </div>
            <p className="text-xs text-[#666666] dark:text-[#a1a1aa] max-w-2xl">
              Open this link in Safari on your iPhone, Chrome on Android, iPad, or any laptop connected to your Wi-Fi to chat with your local AI models with live token streaming.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowQrModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white dark:bg-[#191919] hover:bg-[#f5f5f5] dark:hover:bg-[#202020] border border-[#eaeaea] dark:border-[#262626] text-[#111111] dark:text-[#f5f5f5] text-xs font-semibold transition-colors shadow-xs"
            >
              <QrCode className="w-4 h-4" />
              <span>Scan Phone QR</span>
            </button>

            <button
              onClick={() => {
                const target = (generatedKey || selectedKeyText) && !selectedKeyText.includes('...')
                  ? `${webChatUrl}/?key=${generatedKey || selectedKeyText}`
                  : webChatUrl;
                window.open(target, '_blank');
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-black dark:bg-white hover:bg-[#222222] dark:hover:bg-[#f0f0f0] text-white dark:text-black text-xs font-semibold transition-colors shadow-xs"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Open Web Chat</span>
            </button>
          </div>
        </div>

        {/* Server Stopped Warning */}
        {serverState !== 'RUNNING' && (
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-center justify-between text-xs text-amber-700 dark:text-amber-200">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400 animate-pulse"></span>
              <span>Server is currently <strong>STOPPED</strong>. Click Start Server to enable this URL on your phone and browser.</span>
            </div>
            <button
              onClick={() => startServer()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-sm transition-colors"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Start Server</span>
            </button>
          </div>
        )}

        {/* Copyable Phone URL Bar */}
        <div className="p-3 rounded-lg bg-[#fafafa] dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] flex items-center justify-between font-mono text-xs text-[#111111] dark:text-[#f5f5f5]">
          <div className="flex items-center gap-2 truncate">
            <span className="text-[#888888] dark:text-[#737373] select-none text-[11px]">URL:</span>
            <span className="text-[#111111] dark:text-[#f5f5f5] select-all font-semibold">{webChatUrl}</span>
          </div>

          <button
            onClick={() => {
              navigator.clipboard.writeText(webChatUrl);
              setCopiedMobileUrl(true);
              setTimeout(() => setCopiedMobileUrl(false), 2000);
            }}
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-white dark:bg-[#141414] hover:bg-[#f5f5f5] dark:hover:bg-[#202020] border border-[#eaeaea] dark:border-[#262626] text-xs text-[#111111] dark:text-[#f5f5f5] transition-colors"
          >
            {copiedMobileUrl ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                <span className="text-emerald-600 dark:text-emerald-400 font-sans font-medium">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span className="font-sans">Copy Phone URL</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Endpoint & LAN Configuration Card */}
      <div className="p-6 rounded-lg bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] space-y-6">
        <div className="flex items-center justify-between border-b border-[#eaeaea] dark:border-[#222222] pb-4">
          <div>
            <h2 className="text-sm font-semibold text-[#111111] dark:text-[#f5f5f5] flex items-center gap-2">
              <Server className="w-4 h-4 text-[#666666] dark:text-[#a1a1aa]" />
              OpenAI-Compatible API Endpoint
            </h2>
            <p className="text-xs text-[#666666] dark:text-[#a1a1aa] mt-0.5">
              Connect external apps, LangChain, Cursor, Open WebUI, and Python scripts using standard OpenAI SDK clients.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {serverConfig?.lowMemoryMode && (
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
                LOW-RAM STREAMING
              </span>
            )}
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium ${
                serverState === 'RUNNING' ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50' : 'bg-[#f5f5f5] dark:bg-zinc-800 text-[#666666] dark:text-zinc-400'
              }`}
            >
              {serverState}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Base URL Box */}
          <div className="p-4 rounded-md bg-[#fafafa] dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] space-y-2">
            <span className="text-[11px] font-mono text-[#888888] dark:text-[#737373] block">BASE API URL</span>
            <div className="flex items-center justify-between font-mono text-xs text-[#111111] dark:text-[#f5f5f5]">
              <span className="select-all">{apiEndpointUrl}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(apiEndpointUrl);
                  setCopiedSnippet(true);
                  setTimeout(() => setCopiedSnippet(false), 2000);
                }}
                className="p-1 rounded hover:bg-[#eaeaea] dark:hover:bg-[#202020] text-[#666666] dark:text-[#a1a1aa]"
              >
                {copiedSnippet ? <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* LAN Access Toggle */}
          <div className="p-4 rounded-md bg-[#fafafa] dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#111111] dark:text-[#f5f5f5]">
                <Wifi className="w-3.5 h-3.5 text-[#666666] dark:text-[#a1a1aa]" />
                LAN Network Access
              </div>
              <p className="text-[11px] text-[#666666] dark:text-[#a1a1aa]">
                {serverConfig?.lanEnabled
                  ? `Exposed on ${lanAddress || '0.0.0.0'}. Local API authentication required.`
                  : 'Bound strictly to localhost (127.0.0.1).'}
              </p>
            </div>

            <button
              onClick={() => handleToggleLan(!serverConfig?.lanEnabled)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                serverConfig?.lanEnabled
                  ? 'bg-black dark:bg-white text-white dark:text-black border border-black dark:border-white'
                  : 'bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] text-[#666666] dark:text-[#a1a1aa] hover:text-[#111111] dark:hover:text-white'
              }`}
            >
              {serverConfig?.lanEnabled ? 'Enabled ✓' : 'Disabled'}
            </button>
          </div>
        </div>
      </div>

      {/* 3. Interactive Code Examples with Live API Key Editing & Model Dropdown */}
      <div className="p-6 rounded-lg bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#eaeaea] dark:border-[#222222] pb-4">
          <div>
            <h2 className="text-sm font-semibold text-[#111111] dark:text-[#f5f5f5] flex items-center gap-2">
              <Code2 className="w-4 h-4 text-[#666666] dark:text-[#a1a1aa]" />
              Live Interactive Client Snippets
            </h2>
            <p className="text-xs text-[#666666] dark:text-[#a1a1aa] mt-0.5">
              Select a model from your installed models list, click <strong>+ Quick Gen</strong> to get a working key, and copy the ready-to-run snippet.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-[#fafafa] dark:bg-[#191919] p-1 rounded-md border border-[#eaeaea] dark:border-[#262626]">
              <button
                onClick={() => {
                  setApiTaskTab('chat');
                  setCustomPrompt('Explain quantum computing in one sentence.');
                }}
                className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                  apiTaskTab === 'chat' ? 'bg-black dark:bg-white text-white dark:text-black font-semibold' : 'text-[#666666] dark:text-[#a1a1aa] hover:text-[#111111] dark:hover:text-white'
                }`}
              >
                💬 Chat
              </button>
              <button
                onClick={() => {
                  setApiTaskTab('vision');
                  setCustomPrompt('What is visible in this landscape photograph?');
                }}
                className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                  apiTaskTab === 'vision' ? 'bg-black dark:bg-white text-white dark:text-black font-semibold' : 'text-[#666666] dark:text-[#a1a1aa] hover:text-[#111111] dark:hover:text-white'
                }`}
              >
                👁️ Vision
              </button>
              <button
                onClick={() => {
                  setApiTaskTab('image');
                  setCustomPrompt('A cozy cabin in a snowy pine forest at twilight, 8k, photorealistic');
                }}
                className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                  apiTaskTab === 'image' ? 'bg-black dark:bg-white text-white dark:text-black font-semibold' : 'text-[#666666] dark:text-[#a1a1aa] hover:text-[#111111] dark:hover:text-white'
                }`}
              >
                🎨 Image Gen
              </button>
            </div>

            <div className="flex items-center gap-1 bg-[#fafafa] dark:bg-[#191919] p-1 rounded-md border border-[#eaeaea] dark:border-[#262626]">
              {(['curl', 'python', 'node'] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setActiveCodeLang(lang)}
                  className={`px-3 py-1 rounded text-xs font-mono capitalize transition-colors ${
                    activeCodeLang === lang ? 'bg-black dark:bg-white text-white dark:text-black font-semibold' : 'text-[#666666] dark:text-[#a1a1aa] hover:text-[#111111] dark:hover:text-white'
                  }`}
                >
                  {lang === 'node' ? 'Node.js' : lang}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Live Snippet Parameter Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-lg bg-[#fafafa] dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626]">
          {/* API Key Selector / Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="text-[#666666] dark:text-[#a1a1aa] font-medium">API Key in Snippet:</label>
              <button
                type="button"
                onClick={() => handleCreateKey()}
                className="text-[11px] text-[#111111] dark:text-[#f5f5f5] hover:opacity-80 font-medium flex items-center gap-1 bg-white dark:bg-[#141414] px-2 py-0.5 rounded border border-[#eaeaea] dark:border-[#262626]"
              >
                <Plus className="w-3 h-3" />
                + Quick Gen
              </button>
            </div>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={selectedKeyText}
                onChange={(e) => {
                  setSelectedKeyText(e.target.value);
                  if (e.target.value.startsWith('lcl_')) {
                    localStorage.setItem('default_raw_api_key', e.target.value);
                  }
                }}
                placeholder="Click + Quick Gen or paste full lcl_... key"
                className="flex-1 bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] rounded px-3 py-1.5 text-xs font-mono text-emerald-600 dark:text-emerald-400 placeholder-[#888888] dark:placeholder-[#737373] focus:outline-none focus:border-black dark:focus:border-white"
              />
              {selectedKeyText && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(selectedKeyText);
                    setCopiedKey(true);
                    setTimeout(() => setCopiedKey(false), 2000);
                  }}
                  className="px-2.5 py-1.5 rounded bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] text-[#111111] dark:text-[#f5f5f5] hover:bg-[#f5f5f5] dark:hover:bg-[#202020] flex items-center gap-1 text-xs shrink-0"
                  title="Copy active API Key"
                >
                  {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-[#666666] dark:text-[#a1a1aa]" />}
                </button>
              )}
            </div>
          </div>

          {/* Model Name Dropdown */}
          <div className="space-y-1.5">
            <label className="text-xs text-[#666666] dark:text-[#a1a1aa] font-medium block">Select Model:</label>
            <select
              value={selectedModelText}
              onChange={(e) => setSelectedModelText(e.target.value)}
              className="w-full bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] rounded px-3 py-1.5 text-xs font-mono text-[#111111] dark:text-[#f5f5f5] focus:outline-none focus:border-black dark:focus:border-white"
            >
              {installedModels.length === 0 ? (
                <option value="default">default (No models installed yet)</option>
              ) : (
                installedModels.map((m) => (
                  <option key={m.id} value={m.name}>
                    {m.name} {m.isLoaded ? '★ (Loaded)' : ''}
                  </option>
                ))
              )}
              <option value="default">default (Current Server Active)</option>
            </select>
          </div>

          {/* Prompt */}
          <div className="space-y-1.5">
            <label className="text-xs text-[#666666] dark:text-[#a1a1aa] font-medium block">Test Prompt:</label>
            <input
              type="text"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Type test prompt..."
              className="w-full bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] rounded px-3 py-1.5 text-xs font-mono text-[#111111] dark:text-[#f5f5f5] placeholder-[#888888] dark:placeholder-[#737373] focus:outline-none focus:border-black dark:focus:border-white"
            />
          </div>
        </div>

        {/* Code Box */}
        <div className="relative rounded-md bg-[#fafafa] dark:bg-[#101010] border border-[#eaeaea] dark:border-[#262626] p-4 font-mono text-xs text-[#111111] dark:text-[#f5f5f5] overflow-x-auto">
          <pre>{codeSnippets[activeCodeLang]}</pre>
          <button
            onClick={() => {
              navigator.clipboard.writeText(codeSnippets[activeCodeLang]);
              setCopiedSnippet(true);
              setTimeout(() => setCopiedSnippet(false), 2000);
            }}
            className="absolute top-3 right-3 p-1.5 rounded bg-white dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] text-[#666666] dark:text-[#a1a1aa] hover:text-[#111111] dark:hover:text-[#f5f5f5] flex items-center gap-1.5 shadow-xs"
            title="Copy code snippet"
          >
            {copiedSnippet ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                <span className="text-emerald-600 dark:text-emerald-400 text-[11px] font-sans font-semibold">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span className="text-[11px] font-sans">Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 4. API Key Management Table */}
      <div className="p-6 rounded-lg bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] space-y-5">
        <div className="flex items-center justify-between border-b border-[#eaeaea] dark:border-[#222222] pb-4">
          <div>
            <h2 className="text-sm font-semibold text-[#111111] dark:text-[#f5f5f5] flex items-center gap-2">
              <Key className="w-4 h-4 text-amber-500 dark:text-amber-400" />
              API Keys Management
            </h2>
            <p className="text-xs text-[#666666] dark:text-[#a1a1aa] mt-0.5">
              Keys are secret tokens. For security, full keys are displayed once when generated.
            </p>
          </div>

          <button
            onClick={() => setIsCreatingKey(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black dark:bg-white hover:bg-[#222222] dark:hover:bg-[#f0f0f0] text-white dark:text-black text-xs font-medium transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Generate Key</span>
          </button>
        </div>

        {/* Inline Create Key Form */}
        {isCreatingKey && (
          <form onSubmit={handleCreateKey} className="p-4 rounded-md bg-[#fafafa] dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] flex gap-3">
            <input
              type="text"
              placeholder="Key Name (e.g. My Phone, Python Script, Open WebUI)"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              className="flex-1 bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] rounded px-3 py-1.5 text-xs text-[#111111] dark:text-[#f5f5f5] placeholder-[#888888] dark:placeholder-[#737373] focus:outline-none focus:border-black dark:focus:border-white"
              autoFocus
            />
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-black dark:bg-white text-white dark:text-black text-xs font-medium hover:bg-[#222222] dark:hover:bg-[#f0f0f0] shadow-xs"
            >
              Save Key
            </button>
            <button
              type="button"
              onClick={() => setIsCreatingKey(false)}
              className="px-3 py-1.5 rounded bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] text-[#666666] dark:text-[#a1a1aa] text-xs hover:bg-[#f5f5f5] dark:hover:bg-[#202020]"
            >
              Cancel
            </button>
          </form>
        )}

        {/* Show newly generated raw key once */}
        {generatedKey && (
          <div className="p-4 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <Check className="w-4 h-4" />
              API Key Generated Successfully & Injected Into Snippets
            </div>
            <p className="text-[11px] text-[#666666] dark:text-zinc-400">
              This complete unmasked key is now active in your code snippets above. Copy and save it now:
            </p>
            <div className="flex items-center justify-between p-2 rounded bg-white dark:bg-[#0b0c0e] border border-emerald-200 dark:border-emerald-850 font-mono text-xs text-emerald-700 dark:text-emerald-300">
              <span className="select-all">{generatedKey}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(generatedKey);
                  setCopiedKey(true);
                  setTimeout(() => setCopiedKey(false), 2000);
                }}
                className="p-1 rounded hover:bg-emerald-100 dark:hover:bg-zinc-800 text-emerald-700 dark:text-zinc-400"
              >
                {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <button
              onClick={() => setGeneratedKey(null)}
              className="text-[11px] text-[#666666] dark:text-zinc-400 hover:text-black dark:hover:text-zinc-200 underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Keys Table */}
        <div className="border border-[#eaeaea] dark:border-[#262626] rounded-md overflow-hidden font-mono text-xs">
          <table className="w-full text-left">
            <thead className="bg-[#fafafa] dark:bg-[#191919] text-[#666666] dark:text-[#a1a1aa] text-[11px] border-b border-[#eaeaea] dark:border-[#222222]">
              <tr>
                <th className="py-2.5 px-4">NAME</th>
                <th className="py-2.5 px-4">PREFIX</th>
                <th className="py-2.5 px-4">CREATED</th>
                <th className="py-2.5 px-4">STATUS</th>
                <th className="py-2.5 px-4 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eaeaea] dark:divide-[#222222] text-[#111111] dark:text-[#f5f5f5]">
              {apiKeys.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-[#888888] dark:text-[#737373] font-sans">
                    No API keys created yet. Click <strong>+ Quick Gen</strong> above to generate a working key instantly.
                  </td>
                </tr>
              ) : (
                apiKeys.map((k) => {
                  const isActive = (generatedKey && generatedKey.startsWith(k.prefix.replace('...', ''))) ||
                    (selectedKeyText && selectedKeyText.startsWith(k.prefix.replace('...', '')));
                  return (
                    <tr key={k.id} className="hover:bg-[#fafafa] dark:hover:bg-[#191919]">
                      <td className="py-3 px-4 font-sans font-medium text-[#111111] dark:text-[#f5f5f5] flex items-center gap-2">
                        <span>{k.name}</span>
                        {isActive && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-black text-white dark:bg-white dark:text-black font-mono">
                            DEFAULT
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => {
                            const rawToCopy = (k.rawKey && !k.rawKey.includes('...'))
                              ? k.rawKey
                              : ((generatedKey && !generatedKey.includes('...')) ? generatedKey : (selectedKeyText || k.prefix));
                            handleCopyRowKey(rawToCopy, k.id);
                          }}
                          className="flex items-center gap-2 hover:text-black dark:hover:text-white font-mono transition-colors text-left group"
                          title="Click to copy full key"
                        >
                          <span className="underline decoration-dotted decoration-zinc-400 group-hover:decoration-black dark:group-hover:decoration-white">
                            {k.prefix}
                          </span>
                          {copiedRowKeyId === k.id ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-sans font-semibold">
                              <Check className="w-3 h-3" />
                              Copied!
                            </span>
                          ) : (
                            <Copy className="w-3 h-3 text-[#888888] dark:text-[#737373] group-hover:text-black dark:group-hover:text-white transition-colors" />
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-[#888888] dark:text-[#737373]">{new Date(k.createdAt).toLocaleDateString()}</td>
                      <td className="py-3 px-4">
                        {k.isRevoked ? (
                          <span className="text-rose-500 text-[11px] font-medium">Revoked</span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400"></span>
                            Active
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!k.isRevoked && (
                            <button
                              onClick={() => revokeKey(k.id)}
                              className="text-[11px] text-amber-600 dark:text-amber-500 hover:text-amber-700 px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40"
                              title="Revoke key authorization"
                            >
                              Revoke
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteKey(k.id, k.prefix)}
                            className="text-[#888888] dark:text-[#737373] hover:text-rose-500 transition-colors p-1"
                            title="Delete API key permanently"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Mobile QR Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] rounded-2xl p-6 max-w-sm w-full space-y-5 shadow-2xl text-center">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-[#111111] dark:text-[#f5f5f5] flex items-center justify-center gap-2">
                <Smartphone className="w-5 h-5 text-[#666666] dark:text-[#a1a1aa]" />
                Scan to Open on Mobile
              </h3>
              <p className="text-xs text-[#666666] dark:text-[#a1a1aa]">
                Point your iPhone or Android camera at this QR code to start chatting immediately.
              </p>
            </div>

            {/* QR Image Box */}
            <div className="p-4 bg-white rounded-xl mx-auto w-fit shadow-xs border border-[#eaeaea] dark:border-transparent">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="Mobile QR Code" className="w-56 h-56 block mx-auto" />
              ) : (
                <div className="w-56 h-56 flex items-center justify-center text-[#888888] dark:text-[#737373] text-xs font-mono">
                  Generating QR...
                </div>
              )}
            </div>

            <div className="text-xs font-mono text-[#666666] dark:text-[#a1a1aa] select-all p-2 rounded bg-[#fafafa] dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] break-all">
              {includeKeyInQr && (generatedKey || selectedKeyText) && !selectedKeyText.includes('...')
                ? `${webChatUrl}/?key=${generatedKey || selectedKeyText}`
                : webChatUrl}
            </div>

            <label className="flex items-center justify-center gap-2 text-xs text-[#666666] dark:text-[#a1a1aa] cursor-pointer">
              <input
                type="checkbox"
                checked={includeKeyInQr}
                onChange={(e) => setIncludeKeyInQr(e.target.checked)}
                className="rounded border-[#eaeaea] dark:border-[#262626] bg-white dark:bg-[#191919] text-black dark:text-white accent-black dark:accent-white"
              />
              <span>Include API Key in QR Link</span>
            </label>

            <button
              onClick={() => setShowQrModal(false)}
              className="w-full py-2 bg-[#f5f5f5] dark:bg-[#191919] hover:bg-[#eaeaea] dark:hover:bg-[#202020] border border-[#eaeaea] dark:border-[#262626] text-[#111111] dark:text-[#f5f5f5] text-xs font-medium rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
