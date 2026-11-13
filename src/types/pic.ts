export type OpMode = 'AUTO' | 'MANUAL' | 'ECO' | 'CALIBRATION';

export interface CustomParam {
  id: string;
  key: string;
  value: string;
}

export interface PicConfig {
  deviceName: string;
  baudRate: number;
  sampleIntervalMs: number;
  tempOffset: number;
  alarmHigh: number;
  alarmLow: number;
  relay1: boolean;
  relay2: boolean;
  pwmDuty: number; // 0 - 100%
  opMode: OpMode;
  buzzerEnabled: boolean;
  customParams: CustomParam[];
}

export interface PicTelemetry {
  currentTemp: number;
  vccVoltage: number;
  uptimeSeconds: number;
  relay1: boolean;
  relay2: boolean;
  pwmDuty: number;
  lastUpdate: number;
}

export type LogType = 'tx' | 'rx' | 'info' | 'error' | 'success';

export interface LogEntry {
  id: string;
  timestamp: string;
  type: LogType;
  text: string;
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'simulated';

export const DEFAULT_PIC_CONFIG: PicConfig = {
  deviceName: 'PIC18F_CTRL_01',
  baudRate: 115200,
  sampleIntervalMs: 1000,
  tempOffset: 0.0,
  alarmHigh: 75.0,
  alarmLow: 15.0,
  relay1: false,
  relay2: true,
  pwmDuty: 50,
  opMode: 'AUTO',
  buzzerEnabled: true,
  customParams: [
    { id: '1', key: 'LOCATION', value: 'SALA_TECNICA' },
    { id: '2', key: 'FILTER_ALPHA', value: '0.85' }
  ]
};

export const SUPPORTED_BAUD_RATES = [
  2400,
  4800,
  9600,
  19200,
  38400,
  57600,
  115200
] as const;
