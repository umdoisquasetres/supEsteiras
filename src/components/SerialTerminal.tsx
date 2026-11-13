import React, { useState, useRef, useEffect } from 'react';
import {
  Terminal as TerminalIcon,
  Send,
  Trash2,
  Copy,
  Download,
  ArrowDown,
  Check,
  CornerDownLeft
} from 'lucide-react';
import type { ConnectionState, LogEntry } from '../types/pic';
import { serialManager } from '../services/serialManager';

interface SerialTerminalProps {
  logs: LogEntry[];
  connectionState: ConnectionState;
  onClearLogs: () => void;
}

export const SerialTerminal: React.FC<SerialTerminalProps> = ({
  logs,
  connectionState,
  onClearLogs
}) => {
  const [inputCmd, setInputCmd] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isConnected = connectionState === 'connected' || connectionState === 'simulated';

  // Autoscroll when new logs arrive
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // Send typed command
  const handleSend = async (cmdToSend?: string) => {
    const text = (cmdToSend !== undefined ? cmdToSend : inputCmd).trim();
    if (!text) return;

    // Add to history
    setHistory((prev) => [text, ...prev.filter((c) => c !== text)].slice(0, 50));
    setHistoryIndex(-1);

    await serialManager.sendCommand(text);
    if (cmdToSend === undefined) {
      setInputCmd('');
    }
  };

  // Keyboard navigation for command history
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0 && historyIndex < history.length - 1) {
        const nextIdx = historyIndex + 1;
        setHistoryIndex(nextIdx);
        setInputCmd(history[nextIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const prevIdx = historyIndex - 1;
        setHistoryIndex(prevIdx);
        setInputCmd(history[prevIdx]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInputCmd('');
      }
    }
  };

  // Copy logs to clipboard
  const handleCopyLogs = () => {
    const logText = logs.map((l) => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.text}`).join('\n');
    navigator.clipboard.writeText(logText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Export logs to .txt file
  const handleExportLogs = () => {
    const logText = logs.map((l) => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.text}`).join('\n');
    const blob = new Blob([logText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pic_serial_log_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const quickCommands = [
    { label: 'PING', cmd: 'PING' },
    { label: 'GET_ALL', cmd: 'GET_ALL' },
    { label: 'STATUS', cmd: 'STATUS' },
    { label: 'SAVE (EEPROM)', cmd: 'SAVE' },
    { label: 'RESET', cmd: 'RESET' },
    { label: 'HELP', cmd: 'HELP' },
    { label: 'RELÉ 1 ON', cmd: 'SET RELAY1=1' },
    { label: 'RELÉ 1 OFF', cmd: 'SET RELAY1=0' },
  ];

  return (
    <div className="bg-slate-950 rounded-2xl border border-slate-800 shadow-2xl flex flex-col h-[650px] overflow-hidden">
      
      {/* Terminal Title Bar */}
      <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <TerminalIcon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Console Serial Interativo
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                8-N-1 ASCII
              </span>
            </h3>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0 w-3.5 h-3.5"
            />
            <span className="flex items-center gap-1">
              <ArrowDown className="w-3 h-3" /> Auto-scroll
            </span>
          </label>

          <button
            onClick={handleCopyLogs}
            title="Copiar histórico de logs"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>

          <button
            onClick={handleExportLogs}
            title="Exportar arquivo .txt"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            onClick={onClearLogs}
            title="Limpar tela do terminal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Terminal Output Area */}
      <div className="flex-1 p-4 font-mono text-xs overflow-y-auto space-y-1.5 bg-slate-950/90 select-text">
        {logs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-2">
            <TerminalIcon className="w-8 h-8 opacity-40" />
            <p>Nenhuma comunicação serial registrada ainda.</p>
            <p className="text-[11px]">Conecte ao PIC ou inicie o Modo Simulado para visualizar os pacotes.</p>
          </div>
        ) : (
          logs.map((log) => {
            let textColor = 'text-slate-300';
            let tagBg = 'bg-slate-800 text-slate-400';

            if (log.type === 'tx') {
              textColor = 'text-cyan-300';
              tagBg = 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30';
            } else if (log.type === 'rx') {
              textColor = 'text-emerald-300';
              tagBg = 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
            } else if (log.type === 'error') {
              textColor = 'text-rose-300 font-semibold';
              tagBg = 'bg-rose-500/20 text-rose-300 border border-rose-500/30';
            } else if (log.type === 'info') {
              textColor = 'text-indigo-300';
              tagBg = 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30';
            } else if (log.type === 'success') {
              textColor = 'text-green-300';
              tagBg = 'bg-green-500/20 text-green-300 border border-green-500/30';
            }

            return (
              <div key={log.id} className="flex items-start gap-2 hover:bg-slate-900/60 py-0.5 px-1 rounded transition-colors">
                <span className="text-slate-500 shrink-0 select-none text-[10px]">
                  [{log.timestamp}]
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded shrink-0 uppercase tracking-wider ${tagBg}`}>
                  {log.type}
                </span>
                <span className={`break-all ${textColor}`}>
                  {log.text}
                </span>
              </div>
            );
          })
        )}
        <div ref={logsEndRef} />
      </div>

      {/* Quick Command Chips */}
      <div className="px-4 py-2 bg-slate-900/90 border-t border-slate-800/80 flex items-center gap-1.5 overflow-x-auto shrink-0">
        <span className="text-[11px] font-medium text-slate-500 mr-1 shrink-0">Atalhos:</span>
        {quickCommands.map((item) => (
          <button
            key={item.label}
            onClick={() => handleSend(item.cmd)}
            disabled={!isConnected}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 hover:border-slate-600 text-[11px] font-mono whitespace-nowrap transition-all active:scale-95 disabled:opacity-40"
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Input Bar */}
      <div className="p-3 bg-slate-900 border-t border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={inputCmd}
              onChange={(e) => setInputCmd(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isConnected
                  ? "Digite um comando (ex: PING, GET_ALL, SET RELAY1=1)..."
                  : "Conecte uma porta serial para enviar comandos"
              }
              disabled={!isConnected}
              className="w-full pl-3 pr-10 py-2.5 bg-slate-950 border border-slate-750 rounded-xl font-mono text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-50"
            />
            <div className="absolute right-3 top-2.5 text-slate-500 pointer-events-none text-[10px] flex items-center gap-1">
              <CornerDownLeft className="w-3 h-3" /> Enter
            </div>
          </div>

          <button
            onClick={() => handleSend()}
            disabled={!isConnected || !inputCmd.trim()}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/30 disabled:opacity-40 transition-all active:scale-95 shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Enviar</span>
          </button>
        </div>
      </div>

    </div>
  );
};
