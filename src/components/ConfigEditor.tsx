import React, { useState, useEffect, useRef } from 'react';
import {
  Save,
  RotateCcw,
  Download,
  Send,
  Plus,
  Trash2,
  Sliders,
  Bell,
  Cpu,
  SlidersHorizontal,
  Flame,
  Radio,
  CheckCircle,
  AlertTriangle,
  Info
} from 'lucide-react';
import { SUPPORTED_BAUD_RATES } from '../types/pic';
import type { ConnectionState, OpMode, PicConfig } from '../types/pic';
import { getChangedCommands } from '../services/picProtocol';
import { serialManager } from '../services/serialManager';

interface ConfigEditorProps {
  config: PicConfig;
  connectionState: ConnectionState;
  onConfigChange: (newConfig: PicConfig) => void;
}

export const ConfigEditor: React.FC<ConfigEditorProps> = ({
  config,
  connectionState,
  onConfigChange
}) => {
  // Local form state
  const [form, setForm] = useState<PicConfig>({ ...config });
  const [syncedConfig, setSyncedConfig] = useState<PicConfig>({ ...config });
  const [isApplying, setIsApplying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  const prevConfigRef = useRef(config);

  // Sync local form when device broadcasts new config from hardware/sim
  useEffect(() => {
    if (prevConfigRef.current !== config) {
      prevConfigRef.current = config;
      setForm({ ...config });
      setSyncedConfig({ ...config });
    }
  }, [config]);

  const isConnected = connectionState === 'connected' || connectionState === 'simulated';

  // Compute pending changed commands
  const pendingCommands = getChangedCommands(form, syncedConfig);
  const hasChanges = pendingCommands.length > 0;

  // Handle single field change
  const handleChange = <K extends keyof PicConfig>(key: K, value: PicConfig[K]) => {
    setForm((prev) => ({
      ...prev,
      [key]: value
    }));
  };

  // Add custom parameter
  const handleAddCustomParam = () => {
    setForm((prev) => ({
      ...prev,
      customParams: [
        ...prev.customParams,
        {
          id: `param-${Date.now()}`,
          key: `PARAM_${prev.customParams.length + 1}`,
          value: '0'
        }
      ]
    }));
  };

  // Edit custom parameter
  const handleCustomParamChange = (id: string, keyOrVal: 'key' | 'value', value: string) => {
    setForm((prev) => ({
      ...prev,
      customParams: prev.customParams.map((p) =>
        p.id === id ? { ...p, [keyOrVal]: value } : p
      )
    }));
  };

  // Remove custom parameter
  const handleRemoveCustomParam = (id: string) => {
    setForm((prev) => ({
      ...prev,
      customParams: prev.customParams.filter((p) => p.id !== id)
    }));
  };

  // Revert changes
  const handleRevert = () => {
    setForm({ ...syncedConfig });
  };

  // Request fresh config from PIC
  const handleReadFromPic = async () => {
    await serialManager.sendCommand('GET_ALL');
  };

  // Apply changes via SET commands
  const handleApplyChanges = async () => {
    if (!isConnected) {
      alert('Conecte a porta serial primeiro para enviar comandos.');
      return;
    }

    setIsApplying(true);
    for (const cmd of pendingCommands) {
      await serialManager.sendCommand(cmd.trim());
      // small delay to let microcontroller parse UART
      await new Promise((r) => setTimeout(r, 60));
    }
    setSyncedConfig({ ...form });
    onConfigChange(form);
    setIsApplying(false);

    setSaveSuccessMessage('Parâmetros enviados para a RAM do PIC!');
    setTimeout(() => setSaveSuccessMessage(null), 3000);
  };

  // Save to EEPROM
  const handleSaveToEEPROM = async () => {
    if (!isConnected) {
      alert('Conecte a porta serial primeiro para salvar na EEPROM.');
      return;
    }

    setIsSaving(true);
    // If there are unsaved changes, apply them first
    if (hasChanges) {
      for (const cmd of pendingCommands) {
        await serialManager.sendCommand(cmd.trim());
        await new Promise((r) => setTimeout(r, 60));
      }
      setSyncedConfig({ ...form });
      onConfigChange(form);
    }

    // Now issue SAVE command to write into internal EEPROM
    await serialManager.sendCommand('SAVE');
    setIsSaving(false);

    setSaveSuccessMessage('Gravado com sucesso na memória EEPROM permanente do PIC!');
    setTimeout(() => setSaveSuccessMessage(null), 4000);
  };

  // Factory reset
  const handleResetToDefaults = async () => {
    if (window.confirm('Tem certeza de que deseja restaurar as configurações padrão de fábrica do PIC?')) {
      await serialManager.sendCommand('RESET');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Action Bar Header */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <SlidersHorizontal className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">Editor de Parâmetros</h3>
              {hasChanges ? (
                <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30">
                  <AlertTriangle className="w-3 h-3" />
                  {pendingCommands.length} alteração(ões) pendente(s)
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                  <CheckCircle className="w-3 h-3" />
                  Sincronizado com o PIC
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Altere os valores abaixo e clique em &quot;Gravar na EEPROM&quot; para persistir no PIC
            </p>
          </div>
        </div>

        {/* Buttons Toolbar */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Read from PIC */}
          <button
            onClick={handleReadFromPic}
            disabled={!isConnected}
            title="Lê os dados da memória do PIC (GET_ALL)"
            className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-50 transition-all active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ler do PIC</span>
          </button>

          {/* Revert if changes exist */}
          {hasChanges && (
            <button
              onClick={handleRevert}
              title="Desfazer alterações locais"
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 transition-all active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Descartar</span>
            </button>
          )}

          {/* Apply Changes (RAM only) */}
          <button
            onClick={handleApplyChanges}
            disabled={!isConnected || !hasChanges || isApplying}
            title="Envia as alterações para o PIC via comandos SET (apenas RAM)"
            className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-blue-600/30 hover:bg-blue-600/40 text-blue-200 border border-blue-500/40 disabled:opacity-40 transition-all active:scale-95"
          >
            <Send className={`w-3.5 h-3.5 ${isApplying ? 'animate-pulse' : ''}`} />
            <span>Aplicar (RAM)</span>
          </button>

          {/* Save to EEPROM (Permanent) */}
          <button
            onClick={handleSaveToEEPROM}
            disabled={!isConnected || isSaving}
            title="Grava todas as configurações na memória permanente EEPROM do microcontrolador"
            className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 disabled:opacity-50 transition-all active:scale-95"
          >
            <Save className={`w-4 h-4 ${isSaving ? 'animate-bounce' : ''}`} />
            <span>Gravar na EEPROM</span>
          </button>

          {/* Factory Reset */}
          <button
            onClick={handleResetToDefaults}
            disabled={!isConnected}
            title="Restaura os padrões de fábrica no firmware do PIC"
            className="flex items-center justify-center p-2 text-xs font-medium rounded-xl bg-rose-600/10 hover:bg-rose-600/20 text-rose-300 border border-rose-500/30 disabled:opacity-40 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Success Notification Bar */}
      {saveSuccessMessage && (
        <div className="bg-emerald-950/50 border border-emerald-500/40 rounded-xl p-3 flex items-center gap-2.5 text-xs text-emerald-200 animate-fadeIn">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-medium">{saveSuccessMessage}</span>
        </div>
      )}

      {/* Main Form Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Card 1: Identificação & Sistema */}
        <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800 text-slate-200 font-semibold text-sm">
            <Cpu className="w-4 h-4 text-indigo-400" />
            <span>Identificação & Operação do Dispositivo</span>
          </div>

          <div className="space-y-4">
            {/* Device Name */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Nome / Tag do Dispositivo (NAME)
              </label>
              <input
                type="text"
                value={form.deviceName}
                onChange={(e) => handleChange('deviceName', e.target.value)}
                maxLength={20}
                placeholder="Ex: PIC18F_ESTACAO_1"
                className={`w-full px-3 py-2 bg-slate-800/80 border rounded-xl text-sm font-mono text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all ${
                  form.deviceName !== syncedConfig.deviceName
                    ? 'border-amber-500/60 bg-amber-500/5'
                    : 'border-slate-700/80'
                }`}
              />
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                Identificador ASCII gravado na EEPROM (máx. 20 caracteres)
              </span>
            </div>

            {/* Operating Mode */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Modo de Operação (MODE)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(['AUTO', 'MANUAL', 'ECO', 'CALIBRATION'] as OpMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => handleChange('opMode', mode)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition-all text-center ${
                      form.opMode === mode
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                        : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-750'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Sample Interval */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-medium text-slate-300">
                  Intervalo de Leitura / Amostragem (INTERVAL)
                </label>
                <span className="text-xs font-mono font-semibold text-indigo-400">
                  {form.sampleIntervalMs} ms ({((form.sampleIntervalMs || 1000) / 1000).toFixed(1)} s)
                </span>
              </div>
              <input
                type="range"
                min="100"
                max="10000"
                step="100"
                value={form.sampleIntervalMs}
                onChange={(e) => handleChange('sampleIntervalMs', Number(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
              />
              <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                <span>100ms (Rápido)</span>
                <span>1000ms (Padrão)</span>
                <span>10000ms (Longo)</span>
              </div>
            </div>

            {/* Communication Baud Rate */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Baud Rate Serial do PIC (BAUD)
              </label>
              <select
                value={form.baudRate}
                onChange={(e) => handleChange('baudRate', Number(e.target.value))}
                className={`w-full px-3 py-2 bg-slate-800/80 border rounded-xl text-sm font-mono text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all ${
                  form.baudRate !== syncedConfig.baudRate
                    ? 'border-amber-500/60 bg-amber-500/5'
                    : 'border-slate-700/80'
                }`}
              >
                {SUPPORTED_BAUD_RATES.map((rate) => (
                  <option key={rate} value={rate}>
                    {rate} bps {rate === 115200 ? '(Recomendado)' : ''}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-slate-400 mt-1 block">
                Atenção: Ao alterar a velocidade do PIC, reconecte o site na mesma taxa para manter a comunicação.
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Sensores, Calibração & Alarmes */}
        <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800 text-slate-200 font-semibold text-sm">
            <Flame className="w-4 h-4 text-rose-400" />
            <span>Calibração de Sensores & Alarmes</span>
          </div>

          <div className="space-y-4">
            {/* Temp Offset */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-medium text-slate-300">
                  Offset de Calibração Térmica (OFFSET)
                </label>
                <span className="text-xs font-mono font-semibold text-cyan-400">
                  {form.tempOffset >= 0 ? `+${form.tempOffset.toFixed(1)}` : form.tempOffset.toFixed(1)} °C
                </span>
              </div>
              <input
                type="number"
                step="0.1"
                min="-20"
                max="20"
                value={form.tempOffset}
                onChange={(e) => handleChange('tempOffset', parseFloat(e.target.value) || 0)}
                className={`w-full px-3 py-2 bg-slate-800/80 border rounded-xl text-sm font-mono text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${
                  form.tempOffset !== syncedConfig.tempOffset
                    ? 'border-amber-500/60 bg-amber-500/5'
                    : 'border-slate-700/80'
                }`}
              />
              <span className="text-[11px] text-slate-400 mt-0.5 block">
                Ajuste somado à leitura analógica bruta do sensor ADC (ex: LM35, MCP9700)
              </span>
            </div>

            {/* Alarm Limits (Low / High) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Alarme Temp. Mínima (ALARM_LO)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    value={form.alarmLow}
                    onChange={(e) => handleChange('alarmLow', parseFloat(e.target.value) || 0)}
                    className={`w-full px-3 py-2 bg-slate-800/80 border rounded-xl text-sm font-mono text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${
                      form.alarmLow !== syncedConfig.alarmLow
                        ? 'border-amber-500/60 bg-amber-500/5'
                        : 'border-slate-700/80'
                    }`}
                  />
                  <span className="absolute right-3 top-2 text-xs font-medium text-slate-400">°C</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Alarme Temp. Máxima (ALARM_HI)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    value={form.alarmHigh}
                    onChange={(e) => handleChange('alarmHigh', parseFloat(e.target.value) || 0)}
                    className={`w-full px-3 py-2 bg-slate-800/80 border rounded-xl text-sm font-mono text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${
                      form.alarmHigh !== syncedConfig.alarmHigh
                        ? 'border-amber-500/60 bg-amber-500/5'
                        : 'border-slate-700/80'
                    }`}
                  />
                  <span className="absolute right-3 top-2 text-xs font-medium text-slate-400">°C</span>
                </div>
              </div>
            </div>

            {/* Buzzer Switch */}
            <div className="flex items-center justify-between p-3.5 bg-slate-800/60 rounded-xl border border-slate-700/60">
              <div className="flex items-center gap-2.5">
                <Bell className={`w-4 h-4 ${form.buzzerEnabled ? 'text-amber-400' : 'text-slate-500'}`} />
                <div>
                  <span className="text-xs font-semibold text-white block">Alerta Sonoro (BUZZER)</span>
                  <span className="text-[11px] text-slate-400">Dispara buzzer integrado quando alarme for acionado</span>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.buzzerEnabled}
                  onChange={(e) => handleChange('buzzerEnabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Card 3: Controle de Saídas (Relés & PWM) */}
        <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800 text-slate-200 font-semibold text-sm">
            <Sliders className="w-4 h-4 text-emerald-400" />
            <span>Controle de Atuadores (Relés & PWM)</span>
          </div>

          <div className="space-y-4">
            {/* Relé 1 & Relé 2 Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              
              {/* Relé 1 */}
              <div
                onClick={() => handleChange('relay1', !form.relay1)}
                className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                  form.relay1
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 shadow-sm'
                    : 'bg-slate-800/60 border-slate-700/70 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        form.relay1 ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-slate-600'
                      }`}
                    />
                    <span className="text-xs font-bold text-white">Relé 1 (RB0)</span>
                  </div>
                  <span className="text-[11px] block mt-1">
                    Status: <strong className="font-semibold">{form.relay1 ? 'ATIVADO (LIGADO)' : 'DESATIVADO'}</strong>
                  </span>
                </div>
                <div
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                    form.relay1 ? 'bg-emerald-500 text-slate-950' : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {form.relay1 ? 'LIGADO' : 'DESL.'}
                </div>
              </div>

              {/* Relé 2 */}
              <div
                onClick={() => handleChange('relay2', !form.relay2)}
                className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                  form.relay2
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 shadow-sm'
                    : 'bg-slate-800/60 border-slate-700/70 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        form.relay2 ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-slate-600'
                      }`}
                    />
                    <span className="text-xs font-bold text-white">Relé 2 (RB1)</span>
                  </div>
                  <span className="text-[11px] block mt-1">
                    Status: <strong className="font-semibold">{form.relay2 ? 'ATIVADO (LIGADO)' : 'DESATIVADO'}</strong>
                  </span>
                </div>
                <div
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                    form.relay2 ? 'bg-emerald-500 text-slate-950' : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {form.relay2 ? 'LIGADO' : 'DESL.'}
                </div>
              </div>

            </div>

            {/* PWM Duty Cycle */}
            <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/60">
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-semibold text-slate-300">
                  Potência / Duty Cycle PWM (CCP1)
                </label>
                <span className="text-sm font-mono font-bold text-cyan-400">
                  {Math.round(form.pwmDuty)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={form.pwmDuty}
                onChange={(e) => handleChange('pwmDuty', Number(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer h-2 bg-slate-700 rounded-lg"
              />
              <div className="flex justify-between text-[11px] text-slate-400 mt-1.5">
                <span>0% (Desligado)</span>
                <span>50% (Meia potência)</span>
                <span>100% (Potência Máx)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: Parâmetros Dinâmicos Customizados */}
        <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
              <Radio className="w-4 h-4 text-purple-400" />
              <span>Parâmetros Personalizados (Chave/Valor)</span>
            </div>
            <button
              onClick={handleAddCustomParam}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Adicionar Campo</span>
            </button>
          </div>

          <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
            {form.customParams.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-xs">
                Nenhum parâmetro adicional cadastrado. Clique em &quot;Adicionar Campo&quot; para criar novas variáveis.
              </div>
            ) : (
              form.customParams.map((param) => (
                <div
                  key={param.id}
                  className="flex items-center gap-2 bg-slate-800/60 p-2 rounded-xl border border-slate-700/60"
                >
                  <input
                    type="text"
                    value={param.key}
                    placeholder="CHAVE"
                    onChange={(e) => handleCustomParamChange(param.id, 'key', e.target.value.toUpperCase())}
                    className="w-1/3 px-2.5 py-1.5 bg-slate-900/80 border border-slate-750 rounded-lg text-xs font-mono font-semibold text-white focus:outline-none focus:border-indigo-500"
                  />
                  <span className="text-slate-500 font-mono text-xs">=</span>
                  <input
                    type="text"
                    value={param.value}
                    placeholder="VALOR"
                    onChange={(e) => handleCustomParamChange(param.id, 'value', e.target.value)}
                    className="flex-1 px-2.5 py-1.5 bg-slate-900/80 border border-slate-750 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={() => handleRemoveCustomParam(param.id)}
                    title="Excluir parâmetro"
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 bg-slate-800/40 p-2.5 rounded-xl border border-slate-750">
            <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>
              Campos personalizados são transmitidos ao PIC como <code>SET CHAVE=VALOR</code> e podem ser lidos livremente pelo seu firmware.
            </span>
          </div>
        </div>

      </div>
    </div>
  );
};
