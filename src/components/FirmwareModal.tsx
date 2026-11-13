import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  Code2,
  Cpu,
  Layers,
  BookOpen
} from 'lucide-react';
import { PIC_XC8_CODE, HARDWARE_WIRING_TIPS } from '../data/firmwareExample';

interface FirmwareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FirmwareModal: React.FC<FirmwareModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'code' | 'wiring' | 'protocol'>('code');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(PIC_XC8_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Firmware PIC (XC8) & Guia de Hardware</h2>
              <p className="text-xs text-slate-400">
                Código em C completo pronto para compilar no MPLAB X IDE
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="px-6 py-2.5 border-b border-slate-800 bg-slate-950/40 flex items-center gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('code')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'code'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Código C (MPLAB XC8)</span>
          </button>

          <button
            onClick={() => setActiveTab('wiring')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'wiring'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Ligações & Hardware</span>
          </button>

          <button
            onClick={() => setActiveTab('protocol')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'protocol'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Tabela do Protocolo</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          
          {/* TAB 1: CODE */}
          {activeTab === 'code' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-300">
                  Compatível com <strong>MPLAB XC8</strong> para PIC16F e PIC18F (ex: PIC18F4550, PIC16F877A, PIC18F25K22).
                </div>
                <button
                  onClick={handleCopyCode}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition-all active:scale-95"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-300" />
                      <span>Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copiar Código Completo</span>
                    </>
                  )}
                </button>
              </div>

              <div className="relative rounded-2xl bg-slate-950 border border-slate-800 p-4 font-mono text-xs text-slate-200 overflow-x-auto">
                <pre>{PIC_XC8_CODE}</pre>
              </div>
            </div>
          )}

          {/* TAB 2: WIRING */}
          {activeTab === 'wiring' && (
            <div className="space-y-6">
              
              {/* Hardware Diagram Box */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5">
                <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-indigo-400" />
                  Diagrama de Conexão Física (USB-UART & PIC)
                </h4>

                <div className="p-4 bg-slate-900/80 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 space-y-2">
                  <div className="text-cyan-400 font-bold">[ COMPUTADOR ] &lt;=== USB ===&gt; [ MÓDULO USB-SERIAL (CH340 / CP2102 / FTDI) ]</div>
                  <div className="pl-6 border-l-2 border-slate-700 py-1 space-y-1">
                    <div>Pino TXD  ---------------------&gt;  Pino RX (RC7 no PIC16F/18F)</div>
                    <div>Pino RXD  &lt;---------------------  Pino TX (RC6 no PIC16F/18F)</div>
                    <div>Pino GND  ---------------------   Pino GND (VSS do PIC)</div>
                    <div>Pino 5V   ---------------------   Pino VDD (Opcional se alimentar via USB)</div>
                  </div>
                  <div className="text-emerald-400 font-bold">[ MICROCONTROLADOR PIC ] (PIC18F4550 / PIC16F877A / etc.)</div>
                </div>
              </div>

              {/* Cards with tips */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {HARDWARE_WIRING_TIPS.map((tip, idx) => (
                  <div key={idx} className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-4 space-y-2">
                    <h5 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px]">
                        {idx + 1}
                      </span>
                      {tip.title}
                    </h5>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {tip.description}
                    </p>
                  </div>
                ))}
              </div>

            </div>
          )}

          {/* TAB 3: PROTOCOL */}
          {activeTab === 'protocol' && (
            <div className="space-y-4">
              <div className="text-xs text-slate-300">
                O protocolo foi projetado para ser leve, legível e robusto. Todos os comandos terminam com caractere de nova linha (<code>\n</code>).
              </div>

              <div className="border border-slate-800 rounded-2xl overflow-hidden">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="bg-slate-800/80 text-slate-300 uppercase text-[10px]">
                    <tr>
                      <th className="p-3">Comando</th>
                      <th className="p-3">Resposta do PIC</th>
                      <th className="p-3">Descrição</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    <tr>
                      <td className="p-3 text-cyan-400 font-bold">PING\n</td>
                      <td className="p-3 text-emerald-400 font-bold">PONG\n</td>
                      <td className="p-3 font-sans text-xs">Testa a conexão serial ativa com o microcontrolador.</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-cyan-400 font-bold">GET_ALL\n</td>
                      <td className="p-3 text-emerald-400 font-bold">CFG:NAME=...;BAUD=...\n</td>
                      <td className="p-3 font-sans text-xs">Solicita todas as variáveis de configuração salvas.</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-cyan-400 font-bold">SET &lt;KEY&gt;=&lt;VAL&gt;\n</td>
                      <td className="p-3 text-emerald-400 font-bold">OK SET &lt;KEY&gt;=&lt;VAL&gt;\n</td>
                      <td className="p-3 font-sans text-xs">Altera um parâmetro na memória RAM (ex: <code>SET RELAY1=1</code>).</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-cyan-400 font-bold">SAVE\n</td>
                      <td className="p-3 text-emerald-400 font-bold">OK SAVED\n</td>
                      <td className="p-3 font-sans text-xs">Grava todos os parâmetros da RAM na EEPROM interna do PIC.</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-cyan-400 font-bold">RESET\n</td>
                      <td className="p-3 text-emerald-400 font-bold">OK RESET\n</td>
                      <td className="p-3 font-sans text-xs">Restaura valores padrão de fábrica e regrava a EEPROM.</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-cyan-400 font-bold">STATUS\n</td>
                      <td className="p-3 text-emerald-400 font-bold">STATUS:TEMP=24.5;VCC=5.01;...\n</td>
                      <td className="p-3 font-sans text-xs">Retorna leituras analógicas, relés e tempo de uptime.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/90 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors"
          >
            Fechar Janela
          </button>
        </div>

      </div>
    </div>
  );
};
