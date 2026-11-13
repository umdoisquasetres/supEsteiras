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
  const [baudRate, setBaudRate] = useState<number>(9600);
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
        customParams: incoming.customParams || prev.customParams
      }));
    });

    const unsubTelemetry = serialManager.onTelemetryReceived((incoming) => {
      setTelemetry((prev) => ({
        rpm1: incoming.rpm1 ?? prev?.rpm1 ?? 0.0,
        rpm2: incoming.rpm2 ?? prev?.rpm2 ?? 0.0,
        laps1: incoming.laps1 ?? prev?.laps1 ?? 0,
        laps2: incoming.laps2 ?? prev?.laps2 ?? 0,
        deltaLaps: incoming.deltaLaps ?? prev?.deltaLaps ?? 0,
        inv1Volt: incoming.inv1Volt ?? prev?.inv1Volt ?? 5.0,
        inv2Volt: incoming.inv2Volt ?? prev?.inv2Volt ?? 5.0,
        inv1Duty: incoming.inv1Duty ?? prev?.inv1Duty ?? 50,
        inv2Duty: incoming.inv2Duty ?? prev?.inv2Duty ?? 50,
        syncStatus: incoming.syncStatus ?? prev?.syncStatus ?? 'SYNCED',
        vccVoltage: incoming.vccVoltage ?? prev?.vccVoltage ?? 5.0,
        uptimeSeconds: incoming.uptimeSeconds ?? prev?.uptimeSeconds ?? 0,
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
    serialManager.startSimulation();
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
            <span>supEsteiras &bull; PIC18F4620 @ 8MHz Interno &bull; MPLAB X 6.20 / XC8</span>
            <span className="text-slate-700">&bull;</span>
            <button
              onClick={() => setIsFirmwareModalOpen(true)}
              className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
            >
              Ver Firmware e Esquema Elétrico
            </button>
          </div>
          <div>
            Controle de Sincronismo em Malha Fechada (Sensores RB0/RB1 &bull; Inversores 0-10V via PWM)
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
