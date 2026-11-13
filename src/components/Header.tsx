import React from 'react';
import {
  Usb,
  Cpu,
  Unplug,
  Code2,
  Activity,
  TerminalSquare,
  AlertCircle,
  Radio
} from 'lucide-react';
import { SUPPORTED_BAUD_RATES } from '../types/pic';
import type { ConnectionState } from '../types/pic';

interface HeaderProps {
  connectionState: ConnectionState;
  baudRate: number;
  onBaudRateChange: (baud: number) => void;
  onConnectPhysical: () => void;
  onConnectSimulation: () => void;
  onDisconnect: () => void;
  onOpenFirmwareModal: () => void;
  activeTab: 'config' | 'terminal' | 'docs';
  setActiveTab: (tab: 'config' | 'terminal' | 'docs') => void;
  isWebSerialSupported: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  connectionState,
  baudRate,
  onBaudRateChange,
  onConnectPhysical,
  onConnectSimulation,
  onDisconnect,
  onOpenFirmwareModal,
  activeTab,
  setActiveTab,
  isWebSerialSupported
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          
          {/* Logo & Title */}
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-gradient-to-br from-indigo-600 to-blue-500 rounded-xl shadow-lg shadow-indigo-500/20 text-white flex items-center justify-center">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
                  PIC Serial Configurator
                </h1>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Microchip PIC
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Gerenciador e Editor de Parâmetros de Firmware via Web Serial
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 self-stretch sm:self-auto">
            <button
              onClick={() => setActiveTab('config')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'config'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Configurações</span>
            </button>

            <button
              onClick={() => setActiveTab('terminal')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'terminal'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
              }`}
            >
              <TerminalSquare className="w-4 h-4" />
              <span>Terminal Serial</span>
            </button>

            <button
              onClick={onOpenFirmwareModal}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'docs'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
              }`}
            >
              <Code2 className="w-4 h-4" />
              <span>Código C (PIC)</span>
            </button>
          </div>

          {/* Connection Controls & Status */}
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            
            {/* Baud Rate selector */}
            <div className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700 rounded-lg px-2.5 py-1.5">
              <span className="text-xs text-slate-400 font-medium">Baud:</span>
              <select
                disabled={connectionState !== 'disconnected'}
                value={baudRate}
                onChange={(e) => onBaudRateChange(Number(e.target.value))}
                className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer disabled:opacity-60"
              >
                {SUPPORTED_BAUD_RATES.map((rate) => (
                  <option key={rate} value={rate} className="bg-slate-800 text-white">
                    {rate} bps
                  </option>
                ))}
              </select>
            </div>

            {/* Connection Actions */}
            {connectionState === 'disconnected' ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={onConnectPhysical}
                  title={
                    isWebSerialSupported
                      ? 'Conectar via porta serial USB'
                      : 'Web Serial requer Chrome, Edge ou Opera'
                  }
                  className={`flex items-center gap-2 px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-lg shadow-sm transition-all text-white ${
                    isWebSerialSupported
                      ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-700/30 active:scale-95'
                      : 'bg-slate-700 opacity-60 cursor-not-allowed'
                  }`}
                >
                  <Usb className="w-4 h-4" />
                  <span>Conectar PIC</span>
                </button>

                <button
                  onClick={onConnectSimulation}
                  title="Testar com um microcontrolador PIC virtual simulado"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg bg-blue-600/20 text-blue-300 border border-blue-500/30 hover:bg-blue-600/30 transition-all active:scale-95"
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>Simular</span>
                </button>
              </div>
            ) : (
              <button
                onClick={onDisconnect}
                className="flex items-center gap-2 px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-lg bg-rose-600/20 border border-rose-500/40 text-rose-300 hover:bg-rose-600/30 transition-all active:scale-95"
              >
                <Unplug className="w-4 h-4" />
                <span>Desconectar</span>
              </button>
            )}

            {/* Status Indicator Badge */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium ${
                connectionState === 'connected'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : connectionState === 'simulated'
                  ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 animate-pulse'
                  : connectionState === 'connecting'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  connectionState === 'connected'
                    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                    : connectionState === 'simulated'
                    ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]'
                    : connectionState === 'connecting'
                    ? 'bg-amber-400'
                    : 'bg-slate-500'
                }`}
              />
              <span className="capitalize">
                {connectionState === 'connected' && 'Online (COM)'}
                {connectionState === 'simulated' && 'Modo Simulado'}
                {connectionState === 'connecting' && 'Conectando...'}
                {connectionState === 'disconnected' && 'Desconectado'}
              </span>
            </div>

          </div>

        </div>

        {/* Warning if browser lacks Web Serial API */}
        {!isWebSerialSupported && (
          <div className="mt-3 bg-amber-950/40 border border-amber-600/30 rounded-lg p-2.5 flex items-center justify-between text-xs text-amber-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Seu navegador não suporta <strong>Web Serial API</strong>. Para conectar a um PIC físico via USB, use o <strong>Google Chrome, Microsoft Edge ou Opera</strong>. Você ainda pode usar o <strong>Modo Simulado</strong> para testar todas as funções!
              </span>
            </div>
            <button
              onClick={onConnectSimulation}
              className="ml-3 px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 rounded text-amber-300 font-semibold shrink-0"
            >
              Iniciar Simulação
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
