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
  private currentBaudRate = 9600;

  // Simulation state
  private isSimulated = false;
  private simulatedConfig: PicConfig = { ...DEFAULT_PIC_CONFIG };
  private simulatedTelemetry: PicTelemetry = {
    rpm1: 45.0,
    rpm2: 44.8,
    laps1: 142,
    laps2: 142,
    deltaLaps: 0,
    inv1Volt: 5.0,
    inv2Volt: 5.04,
    inv1Duty: 50,
    inv2Duty: 50,
    syncStatus: 'SYNCED',
    vccVoltage: 5.01,
    uptimeSeconds: 120,
    lastUpdate: Date.now()
  };
  private simulationInterval: number | null = null;
  private simIntegralError = 0;
  private simFractionalLaps1 = 142.0;
  private simFractionalLaps2 = 142.0;

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
  public async connectPhysical(baudRate: number = 9600): Promise<boolean> {
    if (!this.isWebSerialSupported()) {
      this.addLog('error', 'Web Serial API não é suportada neste navegador. Use Chrome, Edge ou Opera.');
      return false;
    }

    try {
      this.setState('connecting');
      this.currentBaudRate = baudRate;
      this.addLog('info', `Solicitando porta serial para PIC18F4620 (Baud: ${baudRate})...`);

      const nav = navigator as unknown as { serial: { requestPort: () => Promise<SerialPort> } };
      this.port = await nav.serial.requestPort();

      await this.port.open({
        baudRate: this.currentBaudRate,
        dataBits: 8,
        stopBits: 1,
        parity: 'none'
      });

      this.setState('connected');
      this.addLog('success', `Conectado com sucesso ao PIC18F4620 na taxa de ${this.currentBaudRate} bps!`);

      // Read loop in background
      this.startReading();

      // Solicit current status and settings
      setTimeout(() => this.sendCommand('PING'), 200);
      setTimeout(() => this.sendCommand('GET_ALL'), 600);

      return true;
    } catch (err: unknown) {
      this.setState('disconnected');
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('No port selected') || msg.includes('canceled')) {
        this.addLog('info', 'Seleção de porta serial cancelada pelo usuário.');
      } else {
        this.addLog('error', `Falha ao conectar na porta serial: ${msg}`);
      }
      return false;
    }
  }

  /**
   * Start simulation mode
   */
  public startSimulation() {
    this.disconnect();
    this.isSimulated = true;
    this.setState('simulated');
    this.addLog('info', 'Modo de Simulação Ativado (PIC18F4620 Virtual @ 8MHz).');

    // Emit initial config
    setTimeout(() => {
      this.configListeners.forEach((l) => l(this.simulatedConfig));
      this.addLog('info', 'Parâmetros iniciais carregados da EEPROM simulada.');
    }, 150);

    // Dynamic conveyor physics simulation loop (500ms)
    this.simulationInterval = window.setInterval(() => {
      if (!this.isSimulated) return;

      const cfg = this.simulatedConfig;
      this.simulatedTelemetry.uptimeSeconds += 1;
      this.simulatedTelemetry.lastUpdate = Date.now();

      if (cfg.opMode === 'STOP' || (!cfg.inverter1Enabled && !cfg.inverter2Enabled)) {
        this.simulatedTelemetry.rpm1 = 0;
        this.simulatedTelemetry.rpm2 = 0;
        this.simulatedTelemetry.inv1Volt = 0;
        this.simulatedTelemetry.inv2Volt = 0;
        this.simulatedTelemetry.syncStatus = 'STOPPED';
        this.telemetryListeners.forEach((l) => l({ ...this.simulatedTelemetry }));
        return;
      }

      // Base RPM proportional to Inverter 1 Voltage (e.g. 10V = 90 RPM, 5V = 45 RPM)
      let v1 = cfg.inverter1Enabled ? cfg.baseVolt1 : 0.0;
      let targetRpm1 = (v1 / 10.0) * 90.0;
      let actualRpm1 = Math.max(0, targetRpm1 + (Math.random() * 0.4 - 0.2));

      // Synchronization algorithm for Conveyor 2:
      // Error in laps: delta = laps1 - laps2
      const deltaLaps = this.simulatedTelemetry.laps1 - this.simulatedTelemetry.laps2;
      this.simulatedTelemetry.deltaLaps = deltaLaps;

      let v2 = cfg.inverter2Enabled ? cfg.baseVolt2 : 0.0;

      if (cfg.opMode === 'AUTO_SYNC' && cfg.inverter1Enabled && cfg.inverter2Enabled) {
        // PI synchronization controller
        this.simIntegralError += deltaLaps * 0.1;
        this.simIntegralError = Math.max(-2.0, Math.min(2.0, this.simIntegralError));

        let correction = (cfg.kp * deltaLaps) + (cfg.ki * this.simIntegralError);
        correction = Math.max(-cfg.maxCorrectionVolt, Math.min(cfg.maxCorrectionVolt, correction));

        v2 = Math.max(0.0, Math.min(10.0, cfg.baseVolt2 + correction));

        if (Math.abs(deltaLaps) <= cfg.syncToleranceLaps) {
          this.simulatedTelemetry.syncStatus = 'SYNCED';
        } else if (Math.abs(deltaLaps) > 5) {
          this.simulatedTelemetry.syncStatus = 'DESYNC_ALARM';
        } else {
          this.simulatedTelemetry.syncStatus = 'ADJUSTING';
        }
      } else {
        this.simulatedTelemetry.syncStatus = 'SYNCED';
      }

      let targetRpm2 = (v2 / 10.0) * 90.0;
      let actualRpm2 = Math.max(0, targetRpm2 + (Math.random() * 0.4 - 0.2));

      // Update fractional laps (dt = 0.5s = 0.5/60 min)
      if (cfg.inverter1Enabled) {
        this.simFractionalLaps1 += (actualRpm1 * 0.5) / 60.0;
        this.simulatedTelemetry.laps1 = Math.floor(this.simFractionalLaps1);
      }
      if (cfg.inverter2Enabled) {
        this.simFractionalLaps2 += (actualRpm2 * 0.5) / 60.0;
        this.simulatedTelemetry.laps2 = Math.floor(this.simFractionalLaps2);
      }

      this.simulatedTelemetry.rpm1 = parseFloat(actualRpm1.toFixed(1));
      this.simulatedTelemetry.rpm2 = parseFloat(actualRpm2.toFixed(1));
      this.simulatedTelemetry.inv1Volt = parseFloat(v1.toFixed(2));
      this.simulatedTelemetry.inv2Volt = parseFloat(v2.toFixed(2));
      this.simulatedTelemetry.inv1Duty = Math.round((v1 / 10.0) * 100);
      this.simulatedTelemetry.inv2Duty = Math.round((v2 / 10.0) * 100);
      this.simulatedTelemetry.vccVoltage = +(5.0 + Math.random() * 0.04 - 0.02).toFixed(2);

      this.telemetryListeners.forEach((l) => l({ ...this.simulatedTelemetry }));
    }, 500);
  }

  /**
   * Stop simulation or disconnect physical
   */
  public async disconnect(): Promise<void> {
    if (this.isSimulated) {
      if (this.simulationInterval !== null) {
        clearInterval(this.simulationInterval);
        this.simulationInterval = null;
      }
      this.isSimulated = false;
      this.setState('disconnected');
      this.addLog('info', 'Simulação finalizada.');
      return;
    }

    this.isReading = false;
    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch {
        // ignore
      }
      this.reader = null;
    }

    if (this.port) {
      try {
        await this.port.close();
      } catch {
        // ignore
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
    if (line.startsWith('CFG:') || (line.includes('NAME=') && line.includes('KP='))) {
      const parsedConfig = parseConfigString(line);
      this.configListeners.forEach((l) => l(parsedConfig));
      this.addLog('info', 'Configurações de sincronismo do PIC sincronizadas.');
      return;
    }

    // Check if telemetry line
    if (line.startsWith('STATUS:') || (line.includes('RPM1=') && line.includes('LAPS1='))) {
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
      this.handleIncomingLine('PONG (PIC18F4620 ONLINE)');
      return;
    }

    if (upperCmd === 'GET_ALL' || upperCmd === 'GET_CONFIG') {
      const configStr = buildConfigString(this.simulatedConfig);
      this.handleIncomingLine(configStr);
      return;
    }

    if (upperCmd === 'STATUS') {
      const { rpm1, rpm2, laps1, laps2, deltaLaps, inv1Volt, inv2Volt, syncStatus, vccVoltage, uptimeSeconds } = this.simulatedTelemetry;
      this.handleIncomingLine(
        `STATUS:RPM1=${rpm1};RPM2=${rpm2};LAPS1=${laps1};LAPS2=${laps2};DELTA=${deltaLaps};V1=${inv1Volt};V2=${inv2Volt};SYNC=${syncStatus};VCC=${vccVoltage};UPTIME=${uptimeSeconds}`
      );
      return;
    }

    if (upperCmd === 'ZERO_LAPS' || upperCmd === 'RESET_LAPS') {
      this.simFractionalLaps1 = 0;
      this.simFractionalLaps2 = 0;
      this.simulatedTelemetry.laps1 = 0;
      this.simulatedTelemetry.laps2 = 0;
      this.simulatedTelemetry.deltaLaps = 0;
      this.simIntegralError = 0;
      this.handleIncomingLine('OK ZERO_LAPS (CONTADORES DE VOLTAS ZERADOS)');
      return;
    }

    if (upperCmd === 'START') {
      this.simulatedConfig.opMode = 'AUTO_SYNC';
      this.handleIncomingLine('OK START (ESTEIRAS INICIADAS EM SINCRONISMO)');
      return;
    }

    if (upperCmd === 'STOP') {
      this.simulatedConfig.opMode = 'STOP';
      this.handleIncomingLine('OK STOP (ESTEIRAS PARADAS)');
      return;
    }

    if (upperCmd === 'SAVE') {
      this.handleIncomingLine('OK SAVED (EEPROM INTERNA DO PIC18F GRAVADA)');
      return;
    }

    if (upperCmd === 'RESET') {
      this.simulatedConfig = { ...DEFAULT_PIC_CONFIG };
      this.simFractionalLaps1 = 0;
      this.simFractionalLaps2 = 0;
      this.handleIncomingLine('OK RESET (PARAMETROS DE FABRICA RESTAURADOS)');
      this.handleIncomingLine(buildConfigString(this.simulatedConfig));
      return;
    }

    if (upperCmd.startsWith('SET ')) {
      const assignment = cmd.slice(4).trim();
      if (assignment.includes('=')) {
        const parsed = parseConfigString(assignment);
        this.simulatedConfig = {
          ...this.simulatedConfig,
          ...parsed
        };
        this.handleIncomingLine(`OK SET ${assignment}`);
      } else {
        this.handleIncomingLine('ERR: FORMATO INVALIDO. USE SET CHAVE=VALOR');
      }
      return;
    }

    // Default unknown command
    this.handleIncomingLine(`ERR: COMANDO DESCONHECIDO "${cmd}". ENVIE HELP`);
  }
}

export const serialManager = new SerialManager();
