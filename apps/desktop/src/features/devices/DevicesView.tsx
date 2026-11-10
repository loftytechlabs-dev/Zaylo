import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Tablet,
  QrCode,
  Laptop,
  Trash2,
  AlertCircle,
  X,
  RefreshCw,
} from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { api } from '../../api/client';
import type { PairingTokenInfo } from '@local-ai/shared';

export const DevicesView: React.FC = () => {
  const { devices, serverConfig, fetchDevicesAndKeys, revokeDevice, deleteDevice } = useAppStore();
  const [pairingModalOpen, setPairingModalOpen] = useState(false);
  const [pairingInfo, setPairingInfo] = useState<PairingTokenInfo | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);

  // Auto-refresh devices list while view is active
  useEffect(() => {
    fetchDevicesAndKeys();
    const interval = setInterval(() => {
      fetchDevicesAndKeys();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleOpenPairing = async () => {
    setLoadingQr(true);
    setPairingModalOpen(true);
    try {
      const info = await api.invoke('devices:create-pairing-token', undefined);
      setPairingInfo(info);
    } catch (err: any) {
      alert(`Failed to create pairing token: ${err.message}`);
    } finally {
      setLoadingQr(false);
    }
  };

  const getDeviceIcon = (name: string, ua?: string) => {
    const text = ((name || '') + ' ' + (ua || '')).toLowerCase();
    if (text.includes('iphone') || text.includes('android') || text.includes('phone') || text.includes('mobile')) {
      return <Smartphone className="w-4 h-4 text-zinc-600 dark:text-zinc-400 shrink-0" />;
    }
    if (text.includes('ipad') || text.includes('tablet')) {
      return <Tablet className="w-4 h-4 text-zinc-600 dark:text-zinc-400 shrink-0" />;
    }
    return <Laptop className="w-4 h-4 text-zinc-600 dark:text-zinc-400 shrink-0" />;
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto overflow-y-auto h-[calc(100vh-4rem)]">
      {/* Header & Action */}
      <div className="flex items-center justify-between border-b border-[#eaeaea] dark:border-[#222222] pb-4">
        <div>
          <h2 className="text-sm font-semibold text-[#111111] dark:text-[#f5f5f5] flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-[#666666] dark:text-[#a1a1aa]" />
            Connected & Paired Devices
          </h2>
          <p className="text-xs text-[#666666] dark:text-[#a1a1aa] mt-0.5">
            Manage physical computers, phones, and tablets that have accessed or paired with this inference server.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchDevicesAndKeys()}
            className="p-1.5 rounded-lg bg-white dark:bg-[#141414] hover:bg-[#f5f5f5] dark:hover:bg-[#202020] text-[#666666] dark:text-[#a1a1aa] hover:text-[#111111] dark:hover:text-[#f5f5f5] border border-[#eaeaea] dark:border-[#262626] transition-colors"
            title="Refresh devices"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleOpenPairing}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-black dark:bg-white hover:bg-[#222222] dark:hover:bg-[#f0f0f0] text-white dark:text-black text-xs font-medium transition-colors shadow-xs"
          >
            <QrCode className="w-4 h-4" />
            <span>Pair New Device</span>
          </button>
        </div>
      </div>

      {/* LAN Warning if not enabled */}
      {!serverConfig?.lanEnabled && (
        <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 flex items-center gap-3 text-xs text-amber-700 dark:text-amber-300">
          <AlertCircle className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0" />
          <div>
            <span className="font-semibold">LAN Access is currently disabled.</span> Enable LAN Access in Server & API settings to allow phones and laptops on your Wi-Fi network to connect.
          </div>
        </div>
      )}

      {/* Devices List Table */}
      <div className="border border-[#eaeaea] dark:border-[#262626] rounded-lg overflow-hidden font-mono text-xs bg-white dark:bg-[#141414]">
        <table className="w-full text-left">
          <thead className="bg-[#fafafa] dark:bg-[#191919] text-[#666666] dark:text-[#a1a1aa] text-[11px] border-b border-[#eaeaea] dark:border-[#222222]">
            <tr>
              <th className="py-3 px-4">DEVICE NAME</th>
              <th className="py-3 px-4">IP ADDRESS</th>
              <th className="py-3 px-4">LAST ACTIVITY</th>
              <th className="py-3 px-4">REQUESTS</th>
              <th className="py-3 px-4">STATUS</th>
              <th className="py-3 px-4 text-right">ACTION</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eaeaea] dark:divide-[#222222] text-[#111111] dark:text-[#f5f5f5]">
            {devices.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-[#888888] dark:text-[#737373] font-sans">
                  No devices connected yet. Open the Web Chat or scan the QR code from another device on this Wi-Fi network.
                </td>
              </tr>
            ) : (
              devices.map((d) => {
                const isOnline = !d.isRevoked && Date.now() - d.lastRequestAt < 45000;
                return (
                  <tr key={d.id} className="hover:bg-[#fafafa] dark:hover:bg-[#191919]">
                    <td className="py-3.5 px-4 font-sans font-medium text-[#111111] dark:text-[#f5f5f5]">
                      <div className="flex items-center gap-2.5">
                        {getDeviceIcon(d.deviceName, d.userAgent)}
                        <div>
                          <div className="text-[#111111] dark:text-[#f5f5f5] font-semibold">{d.deviceName}</div>
                          {d.userAgent && (
                            <div className="text-[10px] text-[#888888] dark:text-[#737373] font-mono truncate max-w-xs">
                              {d.userAgent}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[#666666] dark:text-[#a1a1aa] font-mono">{d.ipAddress}</td>
                    <td className="py-3.5 px-4 text-[#888888] dark:text-[#737373]">{new Date(d.lastRequestAt).toLocaleTimeString()}</td>
                    <td className="py-3.5 px-4 text-[#666666] dark:text-[#a1a1aa] font-mono">{d.requestCount}</td>
                    <td className="py-3.5 px-4">
                      {d.isRevoked ? (
                        <span className="text-rose-500 text-[11px] font-medium">Revoked</span>
                      ) : isOnline ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse"></span>
                          Online
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] bg-[#f5f5f5] dark:bg-zinc-800/80 text-[#888888] dark:text-zinc-400 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span>
                          Offline
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!d.isRevoked && (
                          <button
                            onClick={() => revokeDevice(d.id)}
                            className="text-xs text-amber-600 dark:text-amber-500 hover:text-amber-700 px-2 py-1 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40"
                            title="Revoke device authentication"
                          >
                            Revoke
                          </button>
                        )}
                        <button
                          onClick={() => deleteDevice(d.id)}
                          className="text-[#888888] dark:text-[#737373] hover:text-rose-500 transition-colors p-1"
                          title="Remove device record"
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

      {/* QR Pairing Modal */}
      {pairingModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-white dark:bg-[#141414] border border-[#eaeaea] dark:border-[#262626] rounded-xl p-6 space-y-5 shadow-2xl relative">
            <button
              onClick={() => setPairingModalOpen(false)}
              className="absolute top-4 right-4 text-[#888888] dark:text-[#737373] hover:text-black dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <h3 className="text-sm font-semibold text-[#111111] dark:text-[#f5f5f5] flex items-center gap-2">
                <QrCode className="w-4 h-4 text-[#666666] dark:text-[#a1a1aa]" />
                Pair Mobile Device or Tablet
              </h3>
              <p className="text-xs text-[#666666] dark:text-[#a1a1aa] mt-1">
                Scan this QR code with your mobile device on the same Wi-Fi network.
              </p>
            </div>

            {loadingQr ? (
              <div className="h-64 flex items-center justify-center text-xs text-[#888888] dark:text-[#737373]">Generating secure token...</div>
            ) : pairingInfo ? (
              <div className="space-y-4 text-center">
                <div className="bg-white p-3 rounded-lg inline-block mx-auto shadow border border-[#eaeaea] dark:border-transparent">
                  <img src={pairingInfo.qrDataUrl} alt="Pairing QR Code" className="w-56 h-56" />
                </div>

                <div className="space-y-1 font-mono text-[11px]">
                  <div className="text-[#111111] dark:text-[#f5f5f5] font-semibold">{pairingInfo.serverUrl}</div>
                  <div className="text-[#888888] dark:text-[#737373]">
                    Pairing token expires in 5 minutes
                  </div>
                </div>

                <div className="p-3 rounded bg-[#fafafa] dark:bg-[#191919] border border-[#eaeaea] dark:border-[#262626] text-[11px] text-[#666666] dark:text-[#a1a1aa] text-left">
                  <span className="font-semibold text-[#111111] dark:text-[#f5f5f5] block mb-0.5">How it works:</span>
                  The mobile device scans the configuration payload and receives a local API key automatically.
                </div>
              </div>
            ) : null}

            <div className="flex justify-end">
              <button
                onClick={() => setPairingModalOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-black dark:bg-white text-white dark:text-black hover:bg-[#222222] dark:hover:bg-[#f0f0f0] text-xs font-medium"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
