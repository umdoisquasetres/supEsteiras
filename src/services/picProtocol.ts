import type { PicConfig, PicTelemetry, OpMode, CustomParam } from '../types/pic';

/**
 * Protocol specification:
 * - Commands end with newline `\n` or `\r\n`.
 * - Human-readable ASCII keys:
 *    NAME, BAUD, INTERVAL, OFFSET, ALARM_HI, ALARM_LO, RELAY1, RELAY2, PWM, MODE, BUZZER
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
        result.baudRate = Number(val) || 115200;
        break;
      case 'INTERVAL':
        result.sampleIntervalMs = Number(val) || 1000;
        break;
      case 'OFFSET':
        result.tempOffset = parseFloat(val) || 0.0;
        break;
      case 'ALARM_HI':
        result.alarmHigh = parseFloat(val) || 75.0;
        break;
      case 'ALARM_LO':
        result.alarmLow = parseFloat(val) || 15.0;
        break;
      case 'RELAY1':
        result.relay1 = val === '1' || val.toLowerCase() === 'true';
        break;
      case 'RELAY2':
        result.relay2 = val === '1' || val.toLowerCase() === 'true';
        break;
      case 'PWM':
        result.pwmDuty = Math.max(0, Math.min(100, parseInt(val, 10) || 0));
        break;
      case 'MODE':
        if (['AUTO', 'MANUAL', 'ECO', 'CALIBRATION'].includes(val.toUpperCase())) {
          result.opMode = val.toUpperCase() as OpMode;
        }
        break;
      case 'BUZZER':
        result.buzzerEnabled = val === '1' || val.toLowerCase() === 'true';
        break;
      case 'EXTRA': {
        // e.g. EXTRA:LOCATION=SALA,FILTER=0.5
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
        // Treat unknown keys as custom parameters
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
  if (!payload.includes('STATUS:') && !payload.includes('TEMP=')) {
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
      case 'TEMP':
        telemetry.currentTemp = parseFloat(val) || 0;
        break;
      case 'VCC':
        telemetry.vccVoltage = parseFloat(val) || 5.0;
        break;
      case 'UPTIME':
        telemetry.uptimeSeconds = parseInt(val, 10) || 0;
        break;
      case 'RELAY1':
        telemetry.relay1 = val === '1' || val.toLowerCase() === 'true';
        break;
      case 'RELAY2':
        telemetry.relay2 = val === '1' || val.toLowerCase() === 'true';
        break;
      case 'PWM':
        telemetry.pwmDuty = parseInt(val, 10) || 0;
        break;
    }
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
    `OFFSET=${config.tempOffset.toFixed(1)}`,
    `ALARM_HI=${config.alarmHigh.toFixed(1)}`,
    `ALARM_LO=${config.alarmLow.toFixed(1)}`,
    `RELAY1=${config.relay1 ? 1 : 0}`,
    `RELAY2=${config.relay2 ? 1 : 0}`,
    `PWM=${Math.round(config.pwmDuty)}`,
    `MODE=${config.opMode}`,
    `BUZZER=${config.buzzerEnabled ? 1 : 0}`
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
  if (current.tempOffset !== original.tempOffset) {
    commands.push(formatSetCommand('OFFSET', current.tempOffset));
  }
  if (current.alarmHigh !== original.alarmHigh) {
    commands.push(formatSetCommand('ALARM_HI', current.alarmHigh));
  }
  if (current.alarmLow !== original.alarmLow) {
    commands.push(formatSetCommand('ALARM_LO', current.alarmLow));
  }
  if (current.relay1 !== original.relay1) {
    commands.push(formatSetCommand('RELAY1', current.relay1));
  }
  if (current.relay2 !== original.relay2) {
    commands.push(formatSetCommand('RELAY2', current.relay2));
  }
  if (current.pwmDuty !== original.pwmDuty) {
    commands.push(formatSetCommand('PWM', Math.round(current.pwmDuty)));
  }
  if (current.opMode !== original.opMode) {
    commands.push(formatSetCommand('MODE', current.opMode));
  }
  if (current.buzzerEnabled !== original.buzzerEnabled) {
    commands.push(formatSetCommand('BUZZER', current.buzzerEnabled));
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
