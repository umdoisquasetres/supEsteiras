import { DEFAULT_PIC_CONFIG } from '../types/pic';
import type {
  ConnectionState,
  LogEntry,
  LogType,
  PicConfig,
  PicTelemetry
} from '../types/pic';
import {
  buildConfigString,
  parseConfigString,
  parseTelemetryString
} from './picProtocol';

// Web Serial types
interface SerialPort {
  open(options: { baudRate: number; dataBits?: number; stopBits?: number; parity?: string }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
}

type StateListener = (state: ConnectionState) => void;
type LogListener = (entry: LogEntry) => void;
type ConfigListener = (config: Partial<PicConfig>) => void;
type TelemetryListener = (telemetry: Partial<PicTelemetry>) => void;

class SerialManager {
  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private isReading = false;
  private state: ConnectionState = 'disconnected';
  private currentBaudRate = 115200;

  // Simulation state
  private isSimulated = false;
  private simulatedConfig: PicConfig = { ...DEFAULT_PIC_CONFIG };
  private simulatedTelemetry: PicTelemetry = {
    currentTemp: 24.6,
    vccVoltage: 5.02,
    uptimeSeconds: 84,
    relay1: false,
    relay2: true,
    pwmDuty: 50,
    lastUpdate: Date.now()
  };
  private simulationInterval: number | null = null;

  // Event listeners
  private stateListeners: Set<StateListener> = new Set();
  private logListeners: Set<LogListener> = new Set();
  private configListeners: Set<ConfigListener> = new Set();
  private telemetryListeners: Set<TelemetryListener> = new Set();

  public isWebSerialSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  public getState(): ConnectionState {
    return this.state;
  }

  public getBaudRate(): number {
    return this.currentBaudRate;
  }

  public onStateChange(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.state);
    return () => this.stateListeners.delete(listener);
  }

  public onLog(listener: LogListener): () => void {
    this.logListeners.add(listener);
    return () => this.logListeners.delete(listener);
  }

  public onConfigReceived(listener: ConfigListener): () => void {
    this.configListeners.add(listener);
    return () => this.configListeners.delete(listener);
  }

  public onTelemetryReceived(listener: TelemetryListener): () => void {
    this.telemetryListeners.add(listener);
    return () => this.telemetryListeners.delete(listener);
  }

  private setState(newState: ConnectionState) {
    this.state = newState;
    this.stateListeners.forEach((l) => l(newState));
  }

  public addLog(type: LogType, text: string) {
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toLocaleTimeString(),
      type,
      text
    };
    this.logListeners.forEach((l) => l(entry));
  }

  /**
   * Connect to a physical serial port via Web Serial API
   */
  public async connectPhysical(baudRate: number = 115200): Promise<boolean> {
    if (!this.isWebSerialSupported()) {
      this.addLog('error', 'Web Serial API não é suportada neste navegador. Use Chrome, Edge ou Opera.');
      return false;
    }

    try {
      this.setState('connecting');
      this.currentBaudRate = baudRate;
      this.addLog('info', `Solicitando porta serial do sistema (Baud: ${baudRate})...`);

      const nav = navigator as unknown as { serial: { requestPort: () => Promise<SerialPort> } };
      this.port = await nav.serial.requestPort();

      await this.port.open({
        baudRate,
        dataBits: 8,
        stopBits: 1,
        parity: 'none'
      });

      this.isSimulated = false;
      this.setState('connected');
      this.addLog('success', `Conectado com sucesso à porta serial a ${baudRate} bps!`);

      // Start reading stream
      this.startReading();

      // Automatically request initial status and config
      setTimeout(() => {
        this.sendCommand('PING');
      }, 300);
      setTimeout(() => {
        this.sendCommand('GET_ALL');
      }, 600);

      return true;
    } catch (err: unknown) {
      this.port = null;
      this.setState('disconnected');
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('No port selected') || msg.includes('cancelled')) {
        this.addLog('info', 'Seleção de porta cancelada pelo usuário.');
      } else {
        this.addLog('error', `Falha ao conectar: ${msg}`);
      }
      return false;
    }
  }

  /**
   * Connect to the virtual/simulated PIC for offline testing and preview
   */
  public connectSimulation(baudRate: number = 115200): void {
    this.isSimulated = true;
    this.currentBaudRate = baudRate;
    this.setState('simulated');
    this.addLog('info', `[SIMULAÇÃO] PIC18F virtual iniciado a ${baudRate} bps.`);
    this.addLog('success', '[SIMULAÇÃO] Dispositivo virtual pronto! Responde a comandos PING, GET_ALL, SET, SAVE, etc.');

    // Start background simulation ticker (telemetry)
    if (this.simulationInterval) clearInterval(this.simulationInterval);
    this.simulationInterval = window.setInterval(() => {
      if (this.state !== 'simulated') return;
      this.simulatedTelemetry.uptimeSeconds += 2;
      // Slight temperature wiggle
      const delta = (Math.random() - 0.5) * 0.4;
      this.simulatedTelemetry.currentTemp = parseFloat(
        (this.simulatedTelemetry.currentTemp + delta).toFixed(1)
      );
      this.simulatedTelemetry.lastUpdate = Date.now();
      this.telemetryListeners.forEach((l) => l(this.simulatedTelemetry));
    }, 2000);

    // Initial ping & get_all in simulation
    setTimeout(() => {
      this.processSimulatedCommand('PING');
    }, 200);
    setTimeout(() => {
      this.processSimulatedCommand('GET_ALL');
    }, 400);
  }

  /**
   * Disconnect from either physical or virtual device
   */
  public async disconnect(): Promise<void> {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }

    if (this.isSimulated) {
      this.isSimulated = false;
      this.setState('disconnected');
      this.addLog('info', '[SIMULAÇÃO] PIC virtual desconectado.');
      return;
    }

    this.isReading = false;
    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch (e) {
        console.warn('Reader cancel error:', e);
      }
      this.reader = null;
    }

    if (this.port) {
      try {
        await this.port.close();
      } catch (e) {
        console.warn('Port close error:', e);
      }
      this.port = null;
    }

    this.setState('disconnected');
    this.addLog('info', 'Porta serial desconectada.');
  }

  /**
   * Send a command string (adds newline if missing)
   */
  public async sendCommand(cmd: string): Promise<void> {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    const formatted = trimmed.endsWith('\n') ? trimmed : `${trimmed}\n`;
    this.addLog('tx', `TX: ${trimmed}`);

    if (this.state === 'simulated') {
      setTimeout(() => {
        this.processSimulatedCommand(trimmed);
      }, 50 + Math.random() * 50);
      return;
    }

    if (this.state !== 'connected' || !this.port || !this.port.writable) {
      this.addLog('error', 'Não há porta serial conectada.');
      return;
    }

    try {
      const encoder = new TextEncoder();
      const writer = this.port.writable.getWriter();
      await writer.write(encoder.encode(formatted));
      writer.releaseLock();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.addLog('error', `Erro ao enviar dados: ${msg}`);
    }
  }

  /**
   * Internal read loop for Web Serial API
   */
  private async startReading() {
    if (!this.port || !this.port.readable) return;
    this.isReading = true;

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      this.reader = this.port.readable.getReader();
      while (this.isReading) {
        const { value, done } = await this.reader.read();
        if (done) {
          break;
        }
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.length > 0) {
              this.handleIncomingLine(trimmedLine);
            }
          }
        }
      }
    } catch (err: unknown) {
      if (this.isReading) {
        const msg = err instanceof Error ? err.message : String(err);
        this.addLog('error', `Erro de leitura serial: ${msg}`);
        this.disconnect();
      }
    } finally {
      if (this.reader) {
        try {
          this.reader.releaseLock();
        } catch {
          // ignore
        }
        this.reader = null;
      }
    }
  }

  /**
   * Parse incoming serial line from physical or virtual device
   */
  private handleIncomingLine(line: string) {
    this.addLog('rx', `RX: ${line}`);

    // Check if configuration line
    if (line.startsWith('CFG:') || (line.includes('NAME=') && line.includes('BAUD='))) {
      const parsedConfig = parseConfigString(line);
      this.configListeners.forEach((l) => l(parsedConfig));
      this.addLog('info', 'Configurações do PIC sincronizadas.');
      return;
    }

    // Check if telemetry line
    if (line.startsWith('STATUS:') || (line.includes('TEMP=') && line.includes('VCC='))) {
      const parsedTelemetry = parseTelemetryString(line);
      if (parsedTelemetry) {
        this.telemetryListeners.forEach((l) => l(parsedTelemetry));
      }
      return;
    }

    // Check for single SET responses
    if (line.startsWith('OK SET')) {
      const setContent = line.replace('OK SET', '').trim();
      const parsedPartial = parseConfigString(setContent);
      this.configListeners.forEach((l) => l(parsedPartial));
    }
  }

  /**
   * Handle simulated PIC logic
   */
  private processSimulatedCommand(rawCmd: string) {
    const cmd = rawCmd.trim();
    const upperCmd = cmd.toUpperCase();

    if (upperCmd === 'PING') {
      this.handleIncomingLine('PONG');
      return;
    }

    if (upperCmd === 'GET_ALL' || upperCmd === 'GET_CONFIG') {
      const configStr = buildConfigString(this.simulatedConfig);
      this.handleIncomingLine(configStr);
      return;
    }

    if (upperCmd === 'STATUS') {
      const { currentTemp, vccVoltage, uptimeSeconds, relay1, relay2, pwmDuty } = this.simulatedTelemetry;
      this.handleIncomingLine(
        `STATUS:TEMP=${currentTemp.toFixed(1)};VCC=${vccVoltage.toFixed(2)};UPTIME=${uptimeSeconds};RELAY1=${relay1 ? 1 : 0};RELAY2=${relay2 ? 1 : 0};PWM=${pwmDuty}`
      );
      return;
    }

    if (upperCmd === 'SAVE') {
      this.handleIncomingLine('OK SAVED (EEPROM ATUALIZADA)');
      return;
    }

    if (upperCmd === 'RESET') {
      this.simulatedConfig = { ...DEFAULT_PIC_CONFIG };
      this.handleIncomingLine('OK RESET (VALORES PADRAO RESTAURADOS)');
      this.handleIncomingLine(buildConfigString(this.simulatedConfig));
      return;
    }

    if (upperCmd.startsWith('SET ')) {
      const assignment = cmd.slice(4).trim();
      const [key, ...valParts] = assignment.split('=');
      const cleanKey = key.trim().toUpperCase();
      const cleanVal = valParts.join('=').trim();

      switch (cleanKey) {
        case 'NAME':
          this.simulatedConfig.deviceName = cleanVal;
          break;
        case 'BAUD':
          this.simulatedConfig.baudRate = Number(cleanVal) || 115200;
          break;
        case 'INTERVAL':
          this.simulatedConfig.sampleIntervalMs = Number(cleanVal) || 1000;
          break;
        case 'OFFSET':
          this.simulatedConfig.tempOffset = parseFloat(cleanVal) || 0;
          break;
        case 'ALARM_HI':
          this.simulatedConfig.alarmHigh = parseFloat(cleanVal) || 75;
          break;
        case 'ALARM_LO':
          this.simulatedConfig.alarmLow = parseFloat(cleanVal) || 15;
          break;
        case 'RELAY1':
          this.simulatedConfig.relay1 = cleanVal === '1' || cleanVal.toLowerCase() === 'true';
          this.simulatedTelemetry.relay1 = this.simulatedConfig.relay1;
          break;
        case 'RELAY2':
          this.simulatedConfig.relay2 = cleanVal === '1' || cleanVal.toLowerCase() === 'true';
          this.simulatedTelemetry.relay2 = this.simulatedConfig.relay2;
          break;
        case 'PWM':
          this.simulatedConfig.pwmDuty = Math.max(0, Math.min(100, parseInt(cleanVal, 10) || 0));
          this.simulatedTelemetry.pwmDuty = this.simulatedConfig.pwmDuty;
          break;
        case 'MODE':
          this.simulatedConfig.opMode = cleanVal.toUpperCase() as any;
          break;
        case 'BUZZER':
          this.simulatedConfig.buzzerEnabled = cleanVal === '1' || cleanVal.toLowerCase() === 'true';
          break;
        default: {
          const idx = this.simulatedConfig.customParams.findIndex((p) => p.key === cleanKey);
          if (idx >= 0) {
            this.simulatedConfig.customParams[idx].value = cleanVal;
          } else {
            this.simulatedConfig.customParams.push({
              id: `p-${Date.now()}`,
              key: cleanKey,
              value: cleanVal
            });
          }
          break;
        }
      }

      this.handleIncomingLine(`OK SET ${cleanKey}=${cleanVal}`);
      return;
    }

    if (upperCmd === 'HELP') {
      this.handleIncomingLine('COMANDOS DISPONIVEIS: PING, GET_ALL, SET <CHAVE>=<VALOR>, SAVE, RESET, STATUS, HELP');
      return;
    }

    this.handleIncomingLine(`ERR COMANDO DESCONHECIDO: ${cmd}`);
  }
}

export const serialManager = new SerialManager();
