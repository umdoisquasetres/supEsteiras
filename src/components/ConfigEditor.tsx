import React, { useState } from 'react';
import {
  Save,
  Download,
  UploadCloud,
  RotateCcw,
  Sliders,
  Settings2,
  Cpu,
  Radio,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import type { ConnectionState, CustomParam, PicConfig, SyncOpMode } from '../types/pic';
import { SUPPORTED_BAUD_RATES } from '../types/pic';
import { getChangedCommands } from '../services/picProtocol';
import { serialManager } from '../services/serialManager';

interface ConfigEditorProps {
  config: PicConfig;
  connectionState: ConnectionState;
}

export const ConfigEditor: React.FC<ConfigEditorProps> = ({
  config: syncedConfig,
  connectionState
}) => {
  const [formData, setFormData] = useState<PicConfig>(syncedConfig);
  const [isApplying, setIsApplying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);

  const isConnected = connectionState === 'connected' || connectionState === 'simulated';

  const [prevSynced, setPrevSynced] = useState(syncedConfig);
  if (prevSynced !== syncedConfig) {
    setPrevSynced(syncedConfig);
    setFormData(syncedConfig);
  }

  const changedCommands = getChangedCommands(formData, syncedConfig);
  const hasChanges = changedCommands.length > 0;

  const showFeedback = (type: 'success' | 'info' | 'error', text: string) => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const handleChange = <K extends keyof PicConfig>(key: K, value: PicConfig[K]) => {
    setFormData((prev) => ({
      ...prev,
      [key]: value
    }));
  };

  const handleCustomParamChange = (id: string, field: 'key' | 'value', value: string) => {
    setFormData((prev) => ({
      ...prev,
      customParams: prev.customParams.map((p) =>
        p.id === id ? { ...p, [field]: value } : p
      )
    }));
  };

  const handleAddCustomParam = () => {
    const newParam: CustomParam = {
      id: `param-${Date.now()}`,
      key: 'PARAM_NOVO',
      value: '0'
    };
    setFormData((prev) => ({
      ...prev,
      customParams: [...prev.customParams, newParam]
    }));
  };

  const handleRemoveCustomParam = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      customParams: prev.customParams.filter((p) => p.id !== id)
    }));
  };

  const handleReadAll = async () => {
    setIsReading(true);
    await serialManager.sendCommand('GET_ALL');
    showFeedback('info', 'Solicitado GET_ALL para o PIC18F4620.');
    setTimeout(() => setIsReading(false), 600);
  };

  const handleApplyToRam = async () => {
    if (!hasChanges) {
      showFeedback('info', 'Nenhuma alteração pendente para enviar.');
      return;
    }

    setIsApplying(true);
    for (const cmd of changedCommands) {
      await serialManager.sendCommand(cmd.trim());
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
    showFeedback('success', `${changedCommands.length} parâmetro(s) enviado(s) para a RAM do PIC!`);
    setIsApplying(false);
  };

  const handleSaveToEeprom = async () => {
    setIsSaving(true);
    if (hasChanges) {
      for (const cmd of changedCommands) {
        await serialManager.sendCommand(cmd.trim());
        await new Promise((resolve) => setTimeout(resolve, 80));
      }
    }
    await serialManager.sendCommand('SAVE');
    showFeedback('success', 'Comando SAVE enviado: Gravado permanentemente na EEPROM do PIC18F4620!');
    setIsSaving(false);
  };

  const handleResetDefaults = async () => {
    if (confirm('Deseja restaurar todos os parâmetros de sincronismo padrão do PIC?')) {
      await serialManager.sendCommand('RESET');
      showFeedback('info', 'Comando RESET enviado. Padrões de fábrica restaurados.');
    }
  };

  return (
    <div className="bg-slate-900/70 rounded-2xl border border-slate-800 p-5 shadow-2xl backdrop-blur-sm">
      {/* Header & Main Action Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-4 mb-5 border-b border-slate-800 gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-teal-500/20 to-emerald-500/20 text-teal-400 border border-teal-500/30">
            <Settings2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white tracking-wide">Configuração do Sistema de Sincronismo</h2>
            <p className="text-xs text-slate-400">Edição e calibração de parâmetros armazenados na EEPROM do PIC18F4620</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Read from PIC */}
          <button
            onClick={handleReadAll}
            disabled={!isConnected || isReading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-50 transition-all active:scale-95"
            title="Lê os parâmetros atuais da memória do PIC"
          >
            <Download className={`w-3.5 h-3.5 ${isReading ? 'animate-bounce text-blue-400' : ''}`} />
            <span>Ler do PIC</span>
          </button>

          {/* Apply to RAM */}
          <button
            onClick={handleApplyToRam}
            disabled={!isConnected || !hasChanges || isApplying}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all active:scale-95 ${
              hasChanges
                ? 'bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border-amber-500/40 animate-pulse'
                : 'bg-slate-800 text-slate-400 border-slate-700 opacity-60'
            }`}
            title="Aplica na memória volátil (RAM) sem gravar na EEPROM"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Aplicar na RAM {hasChanges && `(${changedCommands.length})`}</span>
          </button>

          {/* Save to EEPROM */}
          <button
            onClick={handleSaveToEeprom}
            disabled={!isConnected || isSaving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30 border border-emerald-500/50 transition-all active:scale-95 disabled:opacity-50"
            title="Grava os parâmetros na EEPROM interna do PIC18F4620"
          >
            <Save className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`} />
            <span>Gravar na EEPROM</span>
          </button>

          {/* Reset Defaults */}
          <button
            onClick={handleResetDefaults}
            disabled={!isConnected}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-800/80 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-800/50 transition-all active:scale-95 disabled:opacity-50"
            title="Restaurar valores de fábrica"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Feedback banner */}
      {feedbackMsg && (
        <div
          className={`mb-4 p-3 rounded-xl border text-xs flex items-center gap-2 transition-all ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
              : feedbackMsg.type === 'error'
              ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
              : 'bg-blue-500/10 text-blue-300 border-blue-500/30'
          }`}
        >
          {feedbackMsg.type === 'success' ? (
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-blue-400" />
          )}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Main Form Sections */}
      <div className="space-y-6">

        {/* SECTION 1: Controle dos Inversores & Velocidade */}
        <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/60">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-700/50">
            <Sliders className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Controle dos Inversores & Velocidade Base (0 a 10V)
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* RPM Target */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Velocidade Alvo (RPM)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="200"
                  value={formData.targetRpm}
                  onChange={(e) => handleChange('targetRpm', parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-indigo-500"
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">RPM</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Velocidade nominal esperada das esteiras</p>
            </div>

            {/* Base Voltage Inverter 1 */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Tensão Base Inversor 1 (RC2 / PWM1)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0.0"
                  max="10.0"
                  value={formData.baseVolt1}
                  onChange={(e) => handleChange('baseVolt1', parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-emerald-400 font-semibold focus:outline-none focus:border-indigo-500"
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">V (0-10V)</span>
              </div>
              <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
                <span>Duty: {Math.round((formData.baseVolt1 / 10) * 100)}%</span>
                <label className="flex items-center gap-1 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={formData.inverter1Enabled}
                    onChange={(e) => handleChange('inverter1Enabled', e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0 w-3 h-3"
                  />
                  <span>Habilitado</span>
                </label>
              </div>
            </div>

            {/* Base Voltage Inverter 2 */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Tensão Base Inversor 2 (RC1 / PWM2)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0.0"
                  max="10.0"
                  value={formData.baseVolt2}
                  onChange={(e) => handleChange('baseVolt2', parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-emerald-400 font-semibold focus:outline-none focus:border-indigo-500"
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">V (0-10V)</span>
              </div>
              <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
                <span>Duty: {Math.round((formData.baseVolt2 / 10) * 100)}%</span>
                <label className="flex items-center gap-1 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={formData.inverter2Enabled}
                    onChange={(e) => handleChange('inverter2Enabled', e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0 w-3 h-3"
                  />
                  <span>Habilitado</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: Parâmetros do Algoritmo de Sincronismo (PI/PID) */}
        <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/60">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-700/50">
            <Cpu className="w-4 h-4 text-indigo-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Sintonia do Controlador de Sincronismo (PI/PID)
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* KP */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Ganho Proporcional (Kp)
              </label>
              <input
                type="number"
                step="0.05"
                min="0.0"
                max="10.0"
                value={formData.kp}
                onChange={(e) => handleChange('kp', parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-indigo-500"
              />
              <p className="text-[10px] text-slate-400 mt-1">Correção direta por erro de volta</p>
            </div>

            {/* KI */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Ganho Integral (Ki)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.0"
                max="5.0"
                value={formData.ki}
                onChange={(e) => handleChange('ki', parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-indigo-500"
              />
              <p className="text-[10px] text-slate-400 mt-1">Elimina erro permanente em regime</p>
            </div>

            {/* KD */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Ganho Derivativo (Kd)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.0"
                max="2.0"
                value={formData.kd}
                onChange={(e) => handleChange('kd', parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-indigo-500"
              />
              <p className="text-[10px] text-slate-400 mt-1">Amortece oscilações bruscas</p>
            </div>

            {/* Tolerância de Sincronismo */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Tolerância (Voltas)
              </label>
              <input
                type="number"
                step="0.05"
                min="0.0"
                max="5.0"
                value={formData.syncToleranceLaps}
                onChange={(e) => handleChange('syncToleranceLaps', parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-indigo-500"
              />
              <p className="text-[10px] text-slate-400 mt-1">Janela segura de sincronismo</p>
            </div>

            {/* Limite de Correção */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Correção Máx. (± Volts)
              </label>
              <input
                type="number"
                step="0.1"
                min="0.5"
                max="5.0"
                value={formData.maxCorrectionVolt}
                onChange={(e) => handleChange('maxCorrectionVolt', parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-indigo-500"
              />
              <p className="text-[10px] text-slate-400 mt-1">Saturação máxima aplicada ao Inv 2</p>
            </div>
          </div>
        </div>

        {/* SECTION 3: Identificação, Modo Operacional e UART */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Identificação */}
          <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/60">
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Nome do Dispositivo / Tag
            </label>
            <input
              type="text"
              maxLength={20}
              value={formData.deviceName}
              onChange={(e) => handleChange('deviceName', e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
            <p className="text-[10px] text-slate-400 mt-1">Identificador salvo no PIC18F4620</p>
          </div>

          {/* Modo de Operação */}
          <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/60">
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Modo Operacional
            </label>
            <select
              value={formData.opMode}
              onChange={(e) => handleChange('opMode', e.target.value as SyncOpMode)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-medium text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="AUTO_SYNC">AUTO_SYNC (Sincronismo Ativo)</option>
              <option value="MANUAL">MANUAL (Tensão Fixa nos Inversores)</option>
              <option value="CALIBRATION">CALIBRATION (Teste de Sensores)</option>
              <option value="STOP">STOP (Parada Geral)</option>
            </select>
            <p className="text-[10px] text-slate-400 mt-1">Estratégia de controle no firmware</p>
          </div>

          {/* Comunicação Serial UART */}
          <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/60">
            <div className="flex items-center gap-2 mb-1">
              <Radio className="w-3.5 h-3.5 text-blue-400" />
              <label className="text-xs font-medium text-slate-300">
                Baud Rate UART (PIC18F 8MHz)
              </label>
            </div>
            <select
              value={formData.baudRate}
              onChange={(e) => handleChange('baudRate', Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-indigo-500"
            >
              {SUPPORTED_BAUD_RATES.map((rate) => (
                <option key={rate} value={rate}>
                  {rate} bps {rate === 9600 && '(Recomendado 8MHz)'}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-400 mt-1">Pinos RC6 (TX) e RC7 (RX)</p>
          </div>
        </div>

        {/* SECTION 4: Parâmetros Customizados */}
        <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/60">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-700/50">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Parâmetros Adicionais do Firmware (Chave = Valor)
            </h3>
            <button
              onClick={handleAddCustomParam}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Adicionar Chave</span>
            </button>
          </div>

          <div className="space-y-2">
            {formData.customParams.map((param) => (
              <div key={param.id} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="CHAVE"
                  value={param.key}
                  onChange={(e) => handleCustomParamChange(param.id, 'key', e.target.value.toUpperCase())}
                  className="w-1/3 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                />
                <input
                  type="text"
                  placeholder="VALOR"
                  value={param.value}
                  onChange={(e) => handleCustomParamChange(param.id, 'value', e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={() => handleRemoveCustomParam(param.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-all"
                  title="Remover parâmetro"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};
