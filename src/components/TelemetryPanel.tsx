import React, { useState, useEffect } from 'react';
import {
  Gauge,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Zap,
  Sliders,
  AlertTriangle,
  Play,
  Square
} from 'lucide-react';
import type { ConnectionState, PicConfig, PicTelemetry } from '../types/pic';
import { serialManager } from '../services/serialManager';

interface TelemetryPanelProps {
  telemetry: PicTelemetry | null;
  config: PicConfig;
  connectionState: ConnectionState;
}

export const TelemetryPanel: React.FC<TelemetryPanelProps> = ({
  telemetry,
  config,
  connectionState
}) => {
  const [autoPoll, setAutoPoll] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isResettingLaps, setIsResettingLaps] = useState(false);

  const isConnected = connectionState === 'connected' || connectionState === 'simulated';

  useEffect(() => {
    if (!isConnected || !autoPoll) return;

    const interval = setInterval(() => {
      serialManager.sendCommand('STATUS');
    }, Math.max(500, config.sampleIntervalMs || 1000));

    return () => clearInterval(interval);
  }, [isConnected, autoPoll, config.sampleIntervalMs]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await serialManager.sendCommand('STATUS');
    setTimeout(() => setIsRefreshing(false), 400);
  };

  const handleZeroLaps = async () => {
    setIsResettingLaps(true);
    await serialManager.sendCommand('ZERO_LAPS');
    setTimeout(() => {
      serialManager.sendCommand('STATUS');
      setIsResettingLaps(false);
    }, 400);
  };

  const handleToggleRun = async () => {
    if (config.opMode === 'STOP') {
      await serialManager.sendCommand('START');
    } else {
      await serialManager.sendCommand('STOP');
    }
  };

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    if (d > 0) {
      return `${d}d ${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m`;
    }
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const rpm1 = telemetry?.rpm1 ?? 0.0;
  const rpm2 = telemetry?.rpm2 ?? 0.0;
  const laps1 = telemetry?.laps1 ?? 0;
  const laps2 = telemetry?.laps2 ?? 0;
  const deltaLaps = telemetry?.deltaLaps ?? (laps1 - laps2);
  const inv1Volt = telemetry?.inv1Volt ?? config.baseVolt1;
  const inv2Volt = telemetry?.inv2Volt ?? config.baseVolt2;
  const syncStatus = telemetry?.syncStatus ?? (config.opMode === 'STOP' ? 'STOPPED' : 'SYNCED');
  const vcc = telemetry?.vccVoltage ?? 5.0;
  const uptime = telemetry?.uptimeSeconds ?? 0;

  // Sync state styling
  const getStatusBadge = () => {
    switch (syncStatus) {
      case 'SYNCED':
        return {
          label: 'SINCRONIZADO',
          color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
          desc: 'Esteiras perfeitamente emparelhadas'
        };
      case 'ADJUSTING':
        return {
          label: 'AJUSTANDO SINCRONISMO',
          color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
          icon: <Sliders className="w-4 h-4 text-amber-400 animate-pulse" />,
          desc: deltaLaps > 0 ? 'Inversor 2 acelerando para compensar atraso' : 'Inversor 2 desacelerando'
        };
      case 'DESYNC_ALARM':
        return {
          label: 'ALARME DE DESALINHAMENTO',
          color: 'text-rose-400 bg-rose-500/20 border-rose-500/40 animate-pulse',
          icon: <AlertTriangle className="w-4 h-4 text-rose-400" />,
          desc: 'Diferença de voltas excedeu o limite seguro!'
        };
      case 'STOPPED':
      default:
        return {
          label: 'PARADO',
          color: 'text-slate-400 bg-slate-800 border-slate-700',
          icon: <Square className="w-4 h-4 text-slate-400" />,
          desc: 'Sistema em espera / desabilitado'
        };
    }
  };

  const statusInfo = getStatusBadge();

  // Alignment gauge: calculate offset percentage for visual bar (-50% to +50%)
  const clampedDelta = Math.max(-5, Math.min(5, deltaLaps));
  const needleOffsetPercent = (clampedDelta / 5) * 50; // -50% to +50%

  return (
    <div className="bg-slate-900/70 rounded-2xl border border-slate-800 p-5 shadow-2xl backdrop-blur-sm">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-5 border-b border-slate-800 gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/20 to-blue-500/20 text-indigo-400 border border-indigo-500/30 shadow-inner">
            <Gauge className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-white tracking-wide">Monitor de Sincronismo de Esteiras</h2>
              <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-800 text-indigo-300 border border-slate-700">
                PIC18F4620 @ 8MHz
              </span>
            </div>
            <p className="text-xs text-slate-400">Leitura de sensores de volta (RB0/RB1) e controle de inversores (0-10V via PWM)</p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          {/* Start/Stop quick toggle */}
          <button
            onClick={handleToggleRun}
            disabled={!isConnected}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all active:scale-95 disabled:opacity-50 ${
              config.opMode === 'STOP'
                ? 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border-emerald-500/30'
                : 'bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border-rose-500/30'
            }`}
          >
            {config.opMode === 'STOP' ? <Play className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
            <span>{config.opMode === 'STOP' ? 'Partir Esteiras' : 'Parar Esteiras'}</span>
          </button>

          {/* Zero Laps Button */}
          <button
            onClick={handleZeroLaps}
            disabled={!isConnected || isResettingLaps}
            title="Zerar contagem de voltas de ambas as esteiras"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-50 transition-all active:scale-95"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isResettingLaps ? 'animate-spin text-amber-400' : ''}`} />
            <span>Zerar Voltas</span>
          </button>

          {/* Auto poll checkbox */}
          <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer select-none px-2 py-1 bg-slate-800/60 rounded-lg border border-slate-700/60">
            <input
              type="checkbox"
              disabled={!isConnected}
              checked={autoPoll}
              onChange={(e) => setAutoPoll(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0 w-3.5 h-3.5"
            />
            <span>Auto ({config.sampleIntervalMs}ms)</span>
          </label>

          {/* Manual Refresh */}
          <button
            onClick={handleManualRefresh}
            disabled={!isConnected || isRefreshing}
            className="p-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-50 transition-all"
            title="Atualizar Leitura Agora"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Synchronism Status Banner & Difference Bar */}
      <div className="mb-5 bg-gradient-to-r from-slate-900 via-slate-800/80 to-slate-900 rounded-xl p-4 border border-slate-800 shadow-inner">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${statusInfo.color}`}>
              {statusInfo.icon}
              <span>{statusInfo.label}</span>
            </div>
            <span className="text-xs text-slate-400 hidden sm:inline">{statusInfo.desc}</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-[11px] text-slate-400 block uppercase font-mono">Diferença de Voltas</span>
              <span className={`text-xl font-mono font-bold ${
                Math.abs(deltaLaps) <= config.syncToleranceLaps
                  ? 'text-emerald-400'
                  : Math.abs(deltaLaps) > 5
                  ? 'text-rose-400'
                  : 'text-amber-400'
              }`}>
                {deltaLaps > 0 ? `+${deltaLaps}` : deltaLaps} <span className="text-xs font-normal text-slate-400">voltas</span>
              </span>
            </div>
          </div>
        </div>

        {/* Dynamic Visual Synchronization Alignment Bar */}
        <div className="relative pt-3 pb-1">
          <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-1">
            <span>Esteira 2 Atrasada (-5 voltas)</span>
            <span className="font-bold text-emerald-400">0 (Alinhadas)</span>
            <span>Esteira 2 Adiantada (+5 voltas)</span>
          </div>
          
          <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden relative border border-slate-700/80">
            {/* Center target line */}
            <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-emerald-500 z-10 -translate-x-1/2 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            
            {/* Safe tolerance zone */}
            <div
              className="absolute top-0 bottom-0 bg-emerald-500/20 z-0 -translate-x-1/2"
              style={{
                left: '50%',
                width: `${Math.min(100, (config.syncToleranceLaps / 5) * 100)}%`
              }}
            />

            {/* Error Needle / Dot */}
            <div
              className={`absolute top-0.5 bottom-0.5 w-3 rounded-full transition-all duration-300 -translate-x-1/2 shadow-lg ${
                Math.abs(deltaLaps) <= config.syncToleranceLaps
                  ? 'bg-emerald-400 shadow-emerald-500/50'
                  : Math.abs(deltaLaps) > 5
                  ? 'bg-rose-500 shadow-rose-500/50'
                  : 'bg-amber-400 shadow-amber-500/50'
              }`}
              style={{
                left: `${50 + needleOffsetPercent}%`
              }}
            />
          </div>
        </div>
      </div>

      {/* Dual Conveyor Belt Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        
        {/* Card: Esteira 1 (Referência / Mestra) */}
        <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/80 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
          
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Esteira 1 (Mestra)</h3>
            </div>
            <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
              Sensor: RB0 (INT0)
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {/* RPM 1 */}
            <div className="bg-slate-900/70 rounded-lg p-2.5 border border-slate-800">
              <span className="text-[10px] font-mono text-slate-400 uppercase block">Velocidade</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-2xl font-bold font-mono text-white tracking-tight">{rpm1.toFixed(1)}</span>
                <span className="text-[10px] font-semibold text-slate-400">RPM</span>
              </div>
            </div>

            {/* Total Laps 1 */}
            <div className="bg-slate-900/70 rounded-lg p-2.5 border border-slate-800">
              <span className="text-[10px] font-mono text-slate-400 uppercase block">Voltas Lidas</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-2xl font-bold font-mono text-blue-400 tracking-tight">{laps1}</span>
                <span className="text-[10px] font-semibold text-slate-400">voltas</span>
              </div>
            </div>

            {/* Inverter 1 Voltage */}
            <div className="bg-slate-900/70 rounded-lg p-2.5 border border-slate-800">
              <span className="text-[10px] font-mono text-slate-400 uppercase block">Tensão Inversor 1</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-2xl font-bold font-mono text-emerald-400 tracking-tight">{inv1Volt.toFixed(2)}</span>
                <span className="text-[10px] font-semibold text-slate-400">V (0-10V)</span>
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/60 pt-2">
            <span>Saída Analógica: PWM1 (CCP1 - RC2)</span>
            <span className="font-mono text-slate-300 font-semibold">{Math.round((inv1Volt / 10) * 100)}% PWM</span>
          </div>
        </div>

        {/* Card: Esteira 2 (Seguidora / Controlada) */}
        <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/80 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
          
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Esteira 2 (Sincronizada)</h3>
            </div>
            <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              Sensor: RB1 (INT1)
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {/* RPM 2 */}
            <div className="bg-slate-900/70 rounded-lg p-2.5 border border-slate-800">
              <span className="text-[10px] font-mono text-slate-400 uppercase block">Velocidade</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-2xl font-bold font-mono text-white tracking-tight">{rpm2.toFixed(1)}</span>
                <span className="text-[10px] font-semibold text-slate-400">RPM</span>
              </div>
            </div>

            {/* Total Laps 2 */}
            <div className="bg-slate-900/70 rounded-lg p-2.5 border border-slate-800">
              <span className="text-[10px] font-mono text-slate-400 uppercase block">Voltas Lidas</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-2xl font-bold font-mono text-emerald-400 tracking-tight">{laps2}</span>
                <span className="text-[10px] font-semibold text-slate-400">voltas</span>
              </div>
            </div>

            {/* Inverter 2 Voltage */}
            <div className="bg-slate-900/70 rounded-lg p-2.5 border border-slate-800">
              <span className="text-[10px] font-mono text-slate-400 uppercase block">Tensão Inversor 2</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-2xl font-bold font-mono text-emerald-400 tracking-tight">{inv2Volt.toFixed(2)}</span>
                <span className="text-[10px] font-semibold text-slate-400">V (0-10V)</span>
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/60 pt-2">
            <span>Saída Analógica: PWM2 (CCP2 - RC1)</span>
            <span className="font-mono text-slate-300 font-semibold">{Math.round((inv2Volt / 10) * 100)}% PWM</span>
          </div>
        </div>

      </div>

      {/* Footer Diagnostic Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-800/80 text-xs">
        <div className="flex items-center gap-2 text-slate-400">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>VCC PIC: <strong className="text-slate-200 font-mono">{vcc.toFixed(2)} V</strong></span>
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <Clock className="w-3.5 h-3.5 text-indigo-400" />
          <span>Uptime: <strong className="text-slate-200 font-mono">{formatUptime(uptime)}</strong></span>
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <Sliders className="w-3.5 h-3.5 text-teal-400" />
          <span>Modo: <strong className="text-slate-200 font-mono">{config.opMode}</strong></span>
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <ShieldAlert className="w-3.5 h-3.5 text-blue-400" />
          <span>Ganhos: <strong className="text-slate-200 font-mono">Kp={config.kp} Ki={config.ki}</strong></span>
        </div>
      </div>
    </div>
  );
};
