import React, { useState, useEffect } from 'react';
import {
  Thermometer,
  Zap,
  Clock,
  Gauge,
  RefreshCw,
  Power,
  ShieldAlert,
  CheckCircle2
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

  const isConnected = connectionState === 'connected' || connectionState === 'simulated';

  // Periodic polling when connected
  useEffect(() => {
    if (!isConnected || !autoPoll) return;

    const interval = setInterval(() => {
      serialManager.sendCommand('STATUS');
    }, Math.max(1500, config.sampleIntervalMs || 2000));

    return () => clearInterval(interval);
  }, [isConnected, autoPoll, config.sampleIntervalMs]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await serialManager.sendCommand('STATUS');
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Format uptime in HH:MM:SS or DD:HH:MM
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

  const currentTemp = telemetry?.currentTemp ?? 25.0;
  const vcc = telemetry?.vccVoltage ?? 5.0;
  const uptime = telemetry?.uptimeSeconds ?? 0;
  const relay1 = telemetry?.relay1 ?? config.relay1;
  const relay2 = telemetry?.relay2 ?? config.relay2;
  const pwm = telemetry?.pwmDuty ?? config.pwmDuty;

  // Temperature alarm evaluation
  const isHighAlarm = currentTemp >= config.alarmHigh;
  const isLowAlarm = currentTemp <= config.alarmLow;

  return (
    <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5 shadow-xl backdrop-blur-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-slate-800/80 gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Gauge className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Telemetria & Monitoramento em Tempo Real</h2>
            <p className="text-xs text-slate-400">Leituras transmitidas pelo PIC via UART</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Auto poll switch */}
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              disabled={!isConnected}
              checked={autoPoll}
              onChange={(e) => setAutoPoll(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0 focus:ring-offset-0 w-4 h-4"
            />
            <span>Auto-atualizar ({config.sampleIntervalMs}ms)</span>
          </label>

          {/* Refresh button */}
          <button
            onClick={handleManualRefresh}
            disabled={!isConnected || isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-50 transition-all active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Temperatura */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/60 relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Temperatura</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-bold text-white tracking-tight">
                  {currentTemp.toFixed(1)}
                </span>
                <span className="text-sm font-medium text-slate-400">°C</span>
              </div>
            </div>
            <div
              className={`p-2.5 rounded-xl border ${
                isHighAlarm
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                  : isLowAlarm
                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              }`}
            >
              <Thermometer className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="text-slate-400">Faixa Segura:</span>
            <span className="font-mono text-slate-300">
              {config.alarmLow}°C — {config.alarmHigh}°C
            </span>
          </div>

          {/* Status badge */}
          <div className="mt-2">
            {isHighAlarm ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                <ShieldAlert className="w-3 h-3" /> Alarme Alta Temp!
              </span>
            ) : isLowAlarm ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                <ShieldAlert className="w-3 h-3" /> Alarme Baixa Temp!
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                <CheckCircle2 className="w-3 h-3" /> Faixa Normal
              </span>
            )}
          </div>
        </div>

        {/* Card 2: Tensão VCC */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/60">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Tensão VCC</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-bold text-white tracking-tight">
                  {vcc.toFixed(2)}
                </span>
                <span className="text-sm font-medium text-slate-400">V</span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
              <Zap className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="text-slate-400">Alimentação:</span>
            <span className="font-mono text-emerald-400 font-medium">Estável (+5V Nom.)</span>
          </div>
          <div className="mt-2">
            <div className="w-full bg-slate-700 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-amber-400 h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, (vcc / 5.5) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 3: Saídas Digitais (Relés) */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/60">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Saídas Digitais</span>
              <div className="flex items-center gap-3 mt-1.5">
                {/* Relé 1 */}
                <div className="flex items-center gap-1.5">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      relay1 ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-slate-600'
                    }`}
                  />
                  <span className="text-xs font-semibold text-slate-300">Relé 1: {relay1 ? 'ON' : 'OFF'}</span>
                </div>
                {/* Relé 2 */}
                <div className="flex items-center gap-1.5">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      relay2 ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-slate-600'
                    }`}
                  />
                  <span className="text-xs font-semibold text-slate-300">Relé 2: {relay2 ? 'ON' : 'OFF'}</span>
                </div>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/30">
              <Power className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="text-slate-400">PWM Output:</span>
            <span className="font-mono text-cyan-400 font-bold">{pwm}%</span>
          </div>
          <div className="mt-2">
            <div className="w-full bg-slate-700 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-cyan-400 h-full rounded-full transition-all"
                style={{ width: `${pwm}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 4: Uptime / Tempo Ativo */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/60">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Tempo Ativo (PIC)</span>
              <div className="text-xl font-bold font-mono text-white tracking-tight mt-1">
                {formatUptime(uptime)}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/30">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="text-slate-400">Último pacote:</span>
            <span className="font-mono text-slate-300">
              {telemetry?.lastUpdate ? new Date(telemetry.lastUpdate).toLocaleTimeString() : 'Aguardando...'}
            </span>
          </div>

          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>PIC em loop ativo de execução</span>
          </div>
        </div>

      </div>
    </div>
  );
};
