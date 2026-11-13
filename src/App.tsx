import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { TelemetryPanel } from './components/TelemetryPanel';
import { ConfigEditor } from './components/ConfigEditor';
import { SerialTerminal } from './components/SerialTerminal';
import { FirmwareModal } from './components/FirmwareModal';
import { DEFAULT_PIC_CONFIG } from './types/pic';
import type {
  ConnectionState,
  LogEntry,
  PicConfig,
  PicTelemetry
} from './types/pic';
import { serialManager } from './services/serialManager';

export function App() {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [baudRate, setBaudRate] = useState<number>(115200);
  const [config, setConfig] = useState<PicConfig>(DEFAULT_PIC_CONFIG);
  const [telemetry, setTelemetry] = useState<PicTelemetry | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'config' | 'terminal' | 'docs'>('config');
  const [isFirmwareModalOpen, setIsFirmwareModalOpen] = useState(false);

  // Subscribe to serialManager events
  useEffect(() => {
    const unsubState = serialManager.onStateChange((newState) => {
      setConnectionState(newState);
    });

    const unsubLog = serialManager.onLog((entry) => {
      setLogs((prev) => [...prev.slice(-300), entry]); // Keep last 300 logs
    });

    const unsubConfig = serialManager.onConfigReceived((incoming) => {
      setConfig((prev) => ({
        ...prev,
        ...incoming,
        // merge customParams if present
        customParams: incoming.customParams || prev.customParams
      }));
    });

    const unsubTelemetry = serialManager.onTelemetryReceived((incoming) => {
      setTelemetry((prev) => ({
        currentTemp: incoming.currentTemp ?? prev?.currentTemp ?? 25.0,
        vccVoltage: incoming.vccVoltage ?? prev?.vccVoltage ?? 5.0,
        uptimeSeconds: incoming.uptimeSeconds ?? prev?.uptimeSeconds ?? 0,
        relay1: incoming.relay1 ?? prev?.relay1 ?? false,
        relay2: incoming.relay2 ?? prev?.relay2 ?? true,
        pwmDuty: incoming.pwmDuty ?? prev?.pwmDuty ?? 50,
        lastUpdate: incoming.lastUpdate ?? Date.now()
      }));
    });

    return () => {
      unsubState();
      unsubLog();
      unsubConfig();
      unsubTelemetry();
    };
  }, []);

  const handleConnectPhysical = async () => {
    await serialManager.connectPhysical(baudRate);
  };

  const handleConnectSimulation = () => {
    serialManager.connectSimulation(baudRate);
  };

  const handleDisconnect = async () => {
    await serialManager.disconnect();
  };

  const handleClearLogs = () => {
    setLogs([]);
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30">
      
      {/* Navigation Header */}
      <Header
        connectionState={connectionState}
        baudRate={baudRate}
        onBaudRateChange={(rate) => setBaudRate(rate)}
        onConnectPhysical={handleConnectPhysical}
        onConnectSimulation={handleConnectSimulation}
        onDisconnect={handleDisconnect}
        onOpenFirmwareModal={() => setIsFirmwareModalOpen(true)}
        activeTab={activeTab}
        setActiveTab={(tab) => {
          if (tab === 'docs') {
            setIsFirmwareModalOpen(true);
          } else {
            setActiveTab(tab);
          }
        }}
        isWebSerialSupported={serialManager.isWebSerialSupported()}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Real-time Telemetry Bar */}
        <TelemetryPanel
          telemetry={telemetry}
          config={config}
          connectionState={connectionState}
        />

        {/* Tab 1: Config Editor */}
        {activeTab === 'config' && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 space-y-6">
              <ConfigEditor
                config={config}
                connectionState={connectionState}
                onConfigChange={(newCfg) => setConfig(newCfg)}
              />
            </div>
            
            {/* Side-by-side terminal preview on larger screens */}
            <div className="hidden xl:block">
              <div className="sticky top-20">
                <SerialTerminal
                  logs={logs}
                  connectionState={connectionState}
                  onClearLogs={handleClearLogs}
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Full Terminal */}
        {activeTab === 'terminal' && (
          <div className="max-w-5xl mx-auto">
            <SerialTerminal
              logs={logs}
              connectionState={connectionState}
              onClearLogs={handleClearLogs}
            />
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/60 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>PIC Serial Configurator &bull; Web Serial API</span>
            <span className="text-slate-700">&bull;</span>
            <button
              onClick={() => setIsFirmwareModalOpen(true)}
              className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
            >
              Ver Firmware XC8
            </button>
          </div>
          <div>
            Pronto para microcontroladores Microchip PIC (PIC16F / PIC18F / PIC24 / dsPIC)
          </div>
        </div>
      </footer>

      {/* Firmware XC8 & Hardware Documentation Modal */}
      <FirmwareModal
        isOpen={isFirmwareModalOpen}
        onClose={() => setIsFirmwareModalOpen(false)}
      />

    </div>
  );
}

export default App;
