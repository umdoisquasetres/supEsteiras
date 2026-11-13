import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  Code2,
  Cpu,
  Layers,
  BookOpen,
  FileCode2
} from 'lucide-react';
import { PIC_XC8_CODE, MPLAB_INSTRUCTIONS, WIRING_DIAGRAM } from '../data/firmwareExample';

interface FirmwareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FirmwareModal: React.FC<FirmwareModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'code' | 'wiring' | 'mplab' | 'protocol'>('code');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(PIC_XC8_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/20 to-teal-500/20 text-indigo-400 border border-indigo-500/30">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Firmware PIC18F4620 (XC8) & Guia MPLAB X 6.20</h2>
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-mono border border-emerald-500/20">
                  8 MHz Interno
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Código C completo com controle de sincronismo por voltas, PWM 0-10V e persistência EEPROM
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
        <div className="px-6 py-2.5 border-b border-slate-800 bg-slate-950/40 flex items-center gap-2 shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('code')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'code'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Código C (PIC18F4620)</span>
          </button>

          <button
            onClick={() => setActiveTab('wiring')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'wiring'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Esquema Elétrico & Pinos</span>
          </button>

          <button
            onClick={() => setActiveTab('mplab')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'mplab'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <FileCode2 className="w-3.5 h-3.5" />
            <span>Passo a Passo MPLAB X 6.20</span>
          </button>

          <button
            onClick={() => setActiveTab('protocol')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'protocol'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Tabela de Comandos Serial</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          
          {/* TAB 1: CODE */}
          {activeTab === 'code' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-300">
                  Compilador: <strong>Microchip XC8 (C99)</strong> &bull; Dispositivo: <strong>PIC18F4620</strong> &bull; Clock: <strong>8 MHz Interno (INTIO67)</strong>.
                </div>
                <button
                  onClick={handleCopyCode}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition-all active:scale-95"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-300" />
                      <span>Copiado com Sucesso!</span>
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
            <div className="space-y-4">
              <div className="text-xs text-slate-300 leading-relaxed">
                Esquema de pinos do <strong>PIC18F4620</strong> com os sensores de volta em interrupção externa (RB0/RB1) e saídas PWM para controle de 0-10V dos inversores de frequência.
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 font-mono text-xs text-emerald-300 overflow-x-auto">
                <pre>{WIRING_DIAGRAM}</pre>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-2">
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-blue-500/20 text-blue-400 flex items-center justify-center text-[10px]">1</span>
                    Circuito de Condicionamento PWM para 0-10V
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    A saída PWM do PIC gera uma onda quadrada de 0V a 5V a 4kHz. Passando por um filtro RC passivo (resistor de 10kΩ e capacitor cerâmico/eletrolítico de 10µF para o GND), o sinal se torna uma tensão contínua linear de 0 a 5V DC. Para atingir 0 a 10V para o inversor, utilize um amplificador operacional LM358 alimentado com 12V/24V com ganho 2x (resistores de 10kΩ no feedback).
                  </p>
                </div>

                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-2">
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-teal-500/20 text-teal-400 flex items-center justify-center text-[10px]">2</span>
                    Sensores de Volta (Indutivo / PNP / NPN)
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    O firmware utiliza interrupções externas por borda de descida nos pinos <strong>RB0 (INT0)</strong> e <strong>RB1 (INT1)</strong>. Se utilizar sensores industriais alimentados em 24V DC, <strong>nunca conecte os 24V diretamente no PIC</strong>: utilize um optoacoplador (ex: PC817) ou divisor de tensão resistivo para rebaixar o pulso para 5V TTL.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: MPLAB X 6.20 */}
          {activeTab === 'mplab' && (
            <div className="space-y-4">
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 text-xs text-slate-300 leading-relaxed">
                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-indigo-400" />
                  Instruções de Criação do Projeto no MPLAB X IDE v6.20
                </h3>
                
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold shrink-0 text-xs">1</div>
                    <div>
                      <strong className="text-white block">Criar Novo Projeto Standalone:</strong>
                      Abra o MPLAB X IDE v6.20. Clique em <code>File &gt; New Project...</code>. Selecione <em>Microchip Embedded &gt; Standalone Project</em> e clique em <em>Next</em>.
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold shrink-0 text-xs">2</div>
                    <div>
                      <strong className="text-white block">Selecionar o Dispositivo PIC18F4620:</strong>
                      Em <em>Device</em>, digite <code>PIC18F4620</code>. Selecione a ferramenta de gravação (ex: <em>PICkit 4, PICkit 3, Snap ou Simulator</em>).
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold shrink-0 text-xs">3</div>
                    <div>
                      <strong className="text-white block">Selecionar o Compilador XC8:</strong>
                      Selecione <strong>XC8 (v2.4x ou v3.x)</strong>. Dê o nome ao projeto (ex: <code>supEsteiras_PIC18</code>) e finalize.
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold shrink-0 text-xs">4</div>
                    <div>
                      <strong className="text-white block">Adicionar Arquivos C:</strong>
                      Adicione os arquivos disponíveis na pasta <code>firmware/</code> deste repositório ou crie um arquivo <code>main.c</code> na pasta <em>Source Files</em> e cole o código da aba &quot;Código C (PIC18F4620)&quot;.
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0 text-xs">5</div>
                    <div>
                      <strong className="text-white block">Compilar e Gravar:</strong>
                      Pressione <code>F11</code> (Clean and Build). O código compila com zero erros e gera o arquivo <code>.hex</code> pronto para gravação no chip!
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-800">
                  <span className="text-[11px] text-slate-400 block mb-2 font-semibold uppercase">Documentação do Projeto:</span>
                  <div className="p-3 bg-slate-900 rounded-xl font-mono text-[11px] text-slate-300 whitespace-pre-wrap">
                    {MPLAB_INSTRUCTIONS}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PROTOCOL */}
          {activeTab === 'protocol' && (
            <div className="space-y-4">
              <div className="text-xs text-slate-300">
                Protocolo serial em texto ASCII finalizado por <code>\n</code>. Permite leitura e alteração instantânea sem interromper o controle de sincronismo:
              </div>

              <div className="border border-slate-800 rounded-2xl overflow-hidden">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="bg-slate-800/80 text-slate-300 uppercase text-[10px]">
                    <tr>
                      <th className="p-3">Comando</th>
                      <th className="p-3">Resposta do PIC</th>
                      <th className="p-3">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    <tr>
                      <td className="p-3 text-cyan-400 font-bold">PING\n</td>
                      <td className="p-3 text-emerald-400 font-bold">PONG (PIC18F4620 ONLINE)\n</td>
                      <td className="p-3 font-sans text-xs">Testa se o PIC está respondendo na porta serial.</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-cyan-400 font-bold">STATUS\n</td>
                      <td className="p-3 text-emerald-400 font-bold">STATUS:RPM1=...;LAPS1=...;V1=...;SYNC=...\n</td>
                      <td className="p-3 font-sans text-xs">Retorna RPMs, voltas totais, diferença de voltas e tensões dos inversores.</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-cyan-400 font-bold">ZERO_LAPS\n</td>
                      <td className="p-3 text-emerald-400 font-bold">OK ZERO_LAPS\n</td>
                      <td className="p-3 font-sans text-xs">Zera os contadores de voltas de ambas as esteiras e reseta o erro acumulado.</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-cyan-400 font-bold">START\n</td>
                      <td className="p-3 text-emerald-400 font-bold">OK START\n</td>
                      <td className="p-3 font-sans text-xs">Coloca as esteiras em modo <code>AUTO_SYNC</code> e aplica as tensões.</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-cyan-400 font-bold">STOP\n</td>
                      <td className="p-3 text-emerald-400 font-bold">OK STOP\n</td>
                      <td className="p-3 font-sans text-xs">Zera as saídas de tensão para os inversores e para as esteiras com segurança.</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-cyan-400 font-bold">GET_ALL\n</td>
                      <td className="p-3 text-emerald-400 font-bold">CFG:NAME=...;KP=...;KI=...;BASE_V1=...\n</td>
                      <td className="p-3 font-sans text-xs">Lê todos os parâmetros de sincronismo ativos da memória.</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-cyan-400 font-bold">SET &lt;CHAVE&gt;=&lt;VALOR&gt;\n</td>
                      <td className="p-3 text-emerald-400 font-bold">OK SET &lt;CHAVE&gt;=&lt;VALOR&gt;\n</td>
                      <td className="p-3 font-sans text-xs">Altera um parâmetro na RAM (ex: <code>SET KP=1.20</code> ou <code>SET BASE_V1=6.0</code>).</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-cyan-400 font-bold">SAVE\n</td>
                      <td className="p-3 text-emerald-400 font-bold">OK SAVED\n</td>
                      <td className="p-3 font-sans text-xs">Grava os parâmetros da RAM na memória EEPROM interna do PIC18F4620.</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-cyan-400 font-bold">RESET\n</td>
                      <td className="p-3 text-emerald-400 font-bold">OK RESET\n</td>
                      <td className="p-3 font-sans text-xs">Restaura os valores de fábrica no firmware e na EEPROM.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
