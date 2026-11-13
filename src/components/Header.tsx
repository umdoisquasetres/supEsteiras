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
            <div className="p-2.5 bg-gradient-to-br from-indigo-600 via-blue-600 to-teal-500 rounded-xl shadow-lg shadow-indigo-500/20 text-white flex items-center justify-center">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
                  supEsteiras
                </h1>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  PIC18F4620 @ 8MHz
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-slate-800 text-slate-400 border border-slate-700">
                  MPLAB X 6.20 / XC8
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Supervisório e Sincronismo de Esteiras Industriais via Web Serial
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
              <span>Controle & Sincronismo</span>
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
              <span>Firmware XC8 (PIC18F)</span>
            </button>
          </div>

          {/* Connection Controls */}
          <div className="flex flex-wrap items-center gap-2.5 self-stretch sm:self-auto justify-end">
            
            {/* Baud selector */}
            <div className="flex items-center bg-slate-800/80 rounded-lg px-2.5 py-1.5 border border-slate-700/60 text-xs">
              <Radio className="w-3.5 h-3.5 text-slate-400 mr-1.5" />
              <select
                value={baudRate}
                disabled={connectionState === 'connected'}
                onChange={(e) => onBaudRateChange(Number(e.target.value))}
                className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer disabled:cursor-not-allowed font-mono"
              >
                {SUPPORTED_BAUD_RATES.map((rate) => (
                  <option key={rate} value={rate} className="bg-slate-900 text-white">
                    {rate} bps {rate === 9600 && '(Padrão)'}
                  </option>
                ))}
              </select>
            </div>

            {/* Connection Actions */}
            {connectionState === 'disconnected' ? (
              <>
                <button
                  onClick={onConnectPhysical}
                  disabled={!isWebSerialSupported}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition-all active:scale-95 disabled:opacity-50"
                  title={!isWebSerialSupported ? 'Navegador incompatível com Web Serial' : 'Conectar via porta USB-Serial COM'}
                >
                  <Usb className="w-4 h-4" />
                  <span>Conectar PIC</span>
                </button>

                <button
                  onClick={onConnectSimulation}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all active:scale-95"
                  title="Simular microcontrolador PIC18F4620 virtual com esteiras ativas"
                >
                  <Cpu className="w-4 h-4 text-emerald-400" />
                  <span>Modo Simulação</span>
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                    connectionState === 'connected'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-current animate-ping" />
                  <span>{connectionState === 'connected' ? 'PIC Conectado' : 'Simulador PIC18F'}</span>
                </span>

                <button
                  onClick={onDisconnect}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 transition-all active:scale-95"
                  title="Desconectar porta serial"
                >
                  <Unplug className="w-3.5 h-3.5" />
                  <span>Desconectar</span>
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Warning if Web Serial not supported */}
        {!isWebSerialSupported && (
          <div className="mt-3 py-1.5 px-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              A <strong>Web Serial API</strong> não está disponível neste navegador. Use o Google Chrome, Microsoft Edge ou Opera para conectar portas seriais físicas, ou clique em <strong>Modo Simulação</strong>.
            </span>
          </div>
        )}
      </div>
    </header>
  );
};
