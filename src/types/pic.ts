export type SyncOpMode = 'AUTO_SYNC' | 'MANUAL' | 'CALIBRATION' | 'STOP';

export type SyncStatus = 'SYNCED' | 'ADJUSTING' | 'DESYNC_ALARM' | 'STOPPED';

export interface CustomParam {
  id: string;
  key: string;
  value: string;
}

export interface PicConfig {
  deviceName: string;
  baudRate: number;
  sampleIntervalMs: number;
  
  // Controle de Velocidade e Inversores
  targetRpm: number;          // RPM desejado (ex: 45.0)
  baseVolt1: number;          // Tensão base Inversor 1 (0.0 a 10.0 V)
  baseVolt2: number;          // Tensão base Inversor 2 (0.0 a 10.0 V)
  
  // Parametros do Controlador de Sincronismo (PI/PID)
  kp: number;                 // Ganho proporcional de correcao
  ki: number;                 // Ganho integral de correcao
  kd: number;                 // Ganho derivativo de correcao
  syncToleranceLaps: number;   // Tolerancia de sincronismo (ex: 0.1 voltas)
  maxCorrectionVolt: number;   // Limite maximo de correcao de tensao (ex: 2.5 V)
  
  // Operacao
  opMode: SyncOpMode;
  inverter1Enabled: boolean;
  inverter2Enabled: boolean;
  buzzerAlarmEnabled: boolean;

  customParams: CustomParam[];
}

export interface PicTelemetry {
  rpm1: number;               // RPM atual Esteira 1
  rpm2: number;               // RPM atual Esteira 2
  laps1: number;              // Total de voltas Esteira 1
  laps2: number;              // Total de voltas Esteira 2
  deltaLaps: number;          // Diferenca de voltas (Laps1 - Laps2)
  inv1Volt: number;           // Tensao enviada ao Inversor 1 (0 a 10V)
  inv2Volt: number;           // Tensao enviada ao Inversor 2 (0 a 10V)
  inv1Duty: number;           // PWM1 Duty Cycle (0 a 100%)
  inv2Duty: number;           // PWM2 Duty Cycle (0 a 100%)
  syncStatus: SyncStatus;     // Status de sincronizacao
  vccVoltage: number;         // Tensao de alimentacao PIC (V)
  uptimeSeconds: number;      // Tempo de atividade em segundos
  lastUpdate: number;         // Timestamp local
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
  deviceName: 'SUP_ESTEIRAS_PIC18',
  baudRate: 9600,
  sampleIntervalMs: 1000,
  targetRpm: 45.0,
  baseVolt1: 5.0,
  baseVolt2: 5.0,
  kp: 0.85,
  ki: 0.12,
  kd: 0.04,
  syncToleranceLaps: 0.1,
  maxCorrectionVolt: 2.5,
  opMode: 'AUTO_SYNC',
  inverter1Enabled: true,
  inverter2Enabled: true,
  buzzerAlarmEnabled: true,
  customParams: [
    { id: '1', key: 'GEAR_RATIO', value: '1.0' },
    { id: '2', key: 'MAX_RPM', value: '120.0' }
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
