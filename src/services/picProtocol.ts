import type { PicConfig, PicTelemetry, SyncOpMode, CustomParam, SyncStatus } from '../types/pic';

/**
 * Protocol specification for supEsteiras (PIC18F4620 @ 8MHz):
 * - ASCII strings ending in '\n' or '\r\n'.
 * - Keys:
 *    NAME, BAUD, INTERVAL, RPM_TARGET, BASE_V1, BASE_V2, KP, KI, KD,
 *    SYNC_TOL, MAX_CORR, MODE, INV1_EN, INV2_EN, BUZZER
 * - Telemetry STATUS format:
 *    STATUS:RPM1=45.2;RPM2=45.1;LAPS1=120;LAPS2=120;DELTA=0;V1=5.00;V2=5.05;SYNC=SYNCED;VCC=5.02;UPTIME=320
 */

export function parseConfigString(payload: string): Partial<PicConfig> {
  const result: Partial<PicConfig> = {};
  
  // Clean prefix if present (e.g. "CFG:...")
  const cleanPayload = payload.startsWith('CFG:') ? payload.slice(4) : payload;
  const parts = cleanPayload.split(';');
  const customParams: CustomParam[] = [];

  for (const part of parts) {
    if (!part || !part.includes('=')) continue;
    const [rawKey, ...valParts] = part.split('=');
    const key = rawKey.trim().toUpperCase();
    const val = valParts.join('=').trim();

    switch (key) {
      case 'NAME':
        result.deviceName = val;
        break;
      case 'BAUD':
        result.baudRate = Number(val) || 9600;
        break;
      case 'INTERVAL':
        result.sampleIntervalMs = Number(val) || 1000;
        break;
      case 'RPM_TARGET':
      case 'TARGET_RPM':
        result.targetRpm = parseFloat(val) || 0.0;
        break;
      case 'BASE_V1':
      case 'VOLT1':
        result.baseVolt1 = Math.max(0, Math.min(10, parseFloat(val) || 0.0));
        break;
      case 'BASE_V2':
      case 'VOLT2':
        result.baseVolt2 = Math.max(0, Math.min(10, parseFloat(val) || 0.0));
        break;
      case 'KP':
        result.kp = parseFloat(val) || 0.0;
        break;
      case 'KI':
        result.ki = parseFloat(val) || 0.0;
        break;
      case 'KD':
        result.kd = parseFloat(val) || 0.0;
        break;
      case 'SYNC_TOL':
      case 'TOL':
        result.syncToleranceLaps = parseFloat(val) || 0.1;
        break;
      case 'MAX_CORR':
        result.maxCorrectionVolt = Math.max(0, Math.min(10, parseFloat(val) || 2.5));
        break;
      case 'MODE': {
        const upper = val.toUpperCase();
        if (['AUTO_SYNC', 'MANUAL', 'CALIBRATION', 'STOP'].includes(upper)) {
          result.opMode = upper as SyncOpMode;
        }
        break;
      }
      case 'INV1_EN':
        result.inverter1Enabled = val === '1' || val.toLowerCase() === 'true';
        break;
      case 'INV2_EN':
        result.inverter2Enabled = val === '1' || val.toLowerCase() === 'true';
        break;
      case 'BUZZER':
        result.buzzerAlarmEnabled = val === '1' || val.toLowerCase() === 'true';
        break;
      case 'EXTRA': {
        const pairs = val.split(',');
        for (let i = 0; i < pairs.length; i++) {
          const [k, v] = pairs[i].split('=');
          if (k && v !== undefined) {
            customParams.push({
              id: `param-${Date.now()}-${i}`,
              key: k.trim(),
              value: v.trim()
            });
          }
        }
        break;
      }
      default:
        customParams.push({
          id: `param-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          key,
          value: val
        });
        break;
    }
  }

  if (customParams.length > 0) {
    result.customParams = customParams;
  }

  return result;
}

export function parseTelemetryString(payload: string): Partial<PicTelemetry> | null {
  if (!payload.includes('STATUS:') && !payload.includes('RPM1=') && !payload.includes('LAPS1=')) {
    return null;
  }

  const cleanPayload = payload.startsWith('STATUS:') ? payload.slice(7) : payload;
  const parts = cleanPayload.split(';');
  const telemetry: Partial<PicTelemetry> = {
    lastUpdate: Date.now()
  };

  for (const part of parts) {
    if (!part || !part.includes('=')) continue;
    const [rawKey, ...valParts] = part.split('=');
    const key = rawKey.trim().toUpperCase();
    const val = valParts.join('=').trim();

    switch (key) {
      case 'RPM1':
        telemetry.rpm1 = parseFloat(val) || 0.0;
        break;
      case 'RPM2':
        telemetry.rpm2 = parseFloat(val) || 0.0;
        break;
      case 'LAPS1':
        telemetry.laps1 = parseInt(val, 10) || 0;
        break;
      case 'LAPS2':
        telemetry.laps2 = parseInt(val, 10) || 0;
        break;
      case 'DELTA':
      case 'DIFF':
        telemetry.deltaLaps = parseFloat(val) || 0;
        break;
      case 'V1':
      case 'VOLT1': {
        const v1 = parseFloat(val) || 0.0;
        telemetry.inv1Volt = v1;
        telemetry.inv1Duty = Math.round((v1 / 10.0) * 100);
        break;
      }
      case 'V2':
      case 'VOLT2': {
        const v2 = parseFloat(val) || 0.0;
        telemetry.inv2Volt = v2;
        telemetry.inv2Duty = Math.round((v2 / 10.0) * 100);
        break;
      }
      case 'SYNC':
      case 'STATE': {
        const upper = val.toUpperCase();
        if (['SYNCED', 'ADJUSTING', 'DESYNC_ALARM', 'STOPPED'].includes(upper)) {
          telemetry.syncStatus = upper as SyncStatus;
        }
        break;
      }
      case 'VCC':
        telemetry.vccVoltage = parseFloat(val) || 5.0;
        break;
      case 'UPTIME':
        telemetry.uptimeSeconds = parseInt(val, 10) || 0;
        break;
    }
  }

  // Derive deltaLaps if not provided
  if (telemetry.deltaLaps === undefined && telemetry.laps1 !== undefined && telemetry.laps2 !== undefined) {
    telemetry.deltaLaps = telemetry.laps1 - telemetry.laps2;
  }

  return telemetry;
}

export function formatSetCommand(key: string, value: string | number | boolean): string {
  let formattedVal = String(value);
  if (typeof value === 'boolean') {
    formattedVal = value ? '1' : '0';
  }
  return `SET ${key.toUpperCase()}=${formattedVal}\n`;
}

export function buildConfigString(config: PicConfig): string {
  const customStr = config.customParams
    .filter(p => p.key.trim().length > 0)
    .map(p => `${p.key.trim().toUpperCase()}=${p.value.trim()}`)
    .join(',');

  const parts = [
    `NAME=${config.deviceName}`,
    `BAUD=${config.baudRate}`,
    `INTERVAL=${config.sampleIntervalMs}`,
    `RPM_TARGET=${config.targetRpm.toFixed(1)}`,
    `BASE_V1=${config.baseVolt1.toFixed(2)}`,
    `BASE_V2=${config.baseVolt2.toFixed(2)}`,
    `KP=${config.kp.toFixed(2)}`,
    `KI=${config.ki.toFixed(2)}`,
    `KD=${config.kd.toFixed(2)}`,
    `SYNC_TOL=${config.syncToleranceLaps.toFixed(2)}`,
    `MAX_CORR=${config.maxCorrectionVolt.toFixed(2)}`,
    `MODE=${config.opMode}`,
    `INV1_EN=${config.inverter1Enabled ? 1 : 0}`,
    `INV2_EN=${config.inverter2Enabled ? 1 : 0}`,
    `BUZZER=${config.buzzerAlarmEnabled ? 1 : 0}`
  ];

  if (customStr.length > 0) {
    parts.push(`EXTRA=${customStr}`);
  }

  return `CFG:${parts.join(';')}`;
}

export function getChangedCommands(current: PicConfig, original: PicConfig): string[] {
  const commands: string[] = [];

  if (current.deviceName !== original.deviceName) {
    commands.push(formatSetCommand('NAME', current.deviceName));
  }
  if (current.baudRate !== original.baudRate) {
    commands.push(formatSetCommand('BAUD', current.baudRate));
  }
  if (current.sampleIntervalMs !== original.sampleIntervalMs) {
    commands.push(formatSetCommand('INTERVAL', current.sampleIntervalMs));
  }
  if (current.targetRpm !== original.targetRpm) {
    commands.push(formatSetCommand('RPM_TARGET', current.targetRpm.toFixed(1)));
  }
  if (current.baseVolt1 !== original.baseVolt1) {
    commands.push(formatSetCommand('BASE_V1', current.baseVolt1.toFixed(2)));
  }
  if (current.baseVolt2 !== original.baseVolt2) {
    commands.push(formatSetCommand('BASE_V2', current.baseVolt2.toFixed(2)));
  }
  if (current.kp !== original.kp) {
    commands.push(formatSetCommand('KP', current.kp.toFixed(2)));
  }
  if (current.ki !== original.ki) {
    commands.push(formatSetCommand('KI', current.ki.toFixed(2)));
  }
  if (current.kd !== original.kd) {
    commands.push(formatSetCommand('KD', current.kd.toFixed(2)));
  }
  if (current.syncToleranceLaps !== original.syncToleranceLaps) {
    commands.push(formatSetCommand('SYNC_TOL', current.syncToleranceLaps.toFixed(2)));
  }
  if (current.maxCorrectionVolt !== original.maxCorrectionVolt) {
    commands.push(formatSetCommand('MAX_CORR', current.maxCorrectionVolt.toFixed(2)));
  }
  if (current.opMode !== original.opMode) {
    commands.push(formatSetCommand('MODE', current.opMode));
  }
  if (current.inverter1Enabled !== original.inverter1Enabled) {
    commands.push(formatSetCommand('INV1_EN', current.inverter1Enabled));
  }
  if (current.inverter2Enabled !== original.inverter2Enabled) {
    commands.push(formatSetCommand('INV2_EN', current.inverter2Enabled));
  }
  if (current.buzzerAlarmEnabled !== original.buzzerAlarmEnabled) {
    commands.push(formatSetCommand('BUZZER', current.buzzerAlarmEnabled));
  }

  // Check custom params
  for (const param of current.customParams) {
    const orig = original.customParams.find(p => p.key === param.key);
    if (!orig || orig.value !== param.value) {
      commands.push(formatSetCommand(param.key, param.value));
    }
  }

  return commands;
}
