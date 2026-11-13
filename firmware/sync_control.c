#include "sync_control.h"
#include "eeprom.h"
#include "pwm.h"
#include <string.h>
#include <stdlib.h>

ConveyorConfig_t activeConfig;

volatile unsigned long lapsConveyor1 = 0;
volatile unsigned long lapsConveyor2 = 0;
volatile unsigned long lastPulseTime1 = 0;
volatile unsigned long lastPulseTime2 = 0;
volatile float currentRpm1 = 0.0f;
volatile float currentRpm2 = 0.0f;
volatile unsigned long systemMillis = 0;
volatile unsigned long uptimeSeconds = 0;

float integralError = 0.0f;
long lastDeltaLaps = 0;
char syncStatus[16] = "SYNCED";

void SyncControl_ResetDefaults(void) {
    strcpy(activeConfig.deviceName, "SUP_ESTEIRAS_PIC18");
    activeConfig.baudRate = 9600;
    activeConfig.sampleIntervalMs = 1000;
    activeConfig.targetRpm = 45.0f;
    activeConfig.baseVolt1 = 5.00f;
    activeConfig.baseVolt2 = 5.00f;
    activeConfig.kp = 0.85f;
    activeConfig.ki = 0.12f;
    activeConfig.kd = 0.04f;
    activeConfig.syncToleranceLaps = 0.10f;
    activeConfig.maxCorrectionVolt = 2.50f;
    strcpy(activeConfig.opMode, "AUTO_SYNC");
    activeConfig.inverter1Enabled = 1;
    activeConfig.inverter2Enabled = 1;
    activeConfig.buzzerAlarmEnabled = 1;
}

void SyncControl_LoadFromEEPROM(void) {
    unsigned int magic = ((unsigned int)EEPROM_ReadByte(EEPROM_ADDR_MAGIC) << 8) |
                          (unsigned int)EEPROM_ReadByte(EEPROM_ADDR_MAGIC + 1);

    if (magic == EEPROM_MAGIC_KEY) {
        unsigned char *ptr = (unsigned char *)&activeConfig;
        for (unsigned int i = 0; i < sizeof(ConveyorConfig_t); i++) {
            ptr[i] = EEPROM_ReadByte(EEPROM_ADDR_DATA + i);
        }
    } else {
        SyncControl_ResetDefaults();
        SyncControl_SaveToEEPROM();
    }
}

void SyncControl_SaveToEEPROM(void) {
    EEPROM_WriteByte(EEPROM_ADDR_MAGIC, (unsigned char)(EEPROM_MAGIC_KEY >> 8));
    EEPROM_WriteByte(EEPROM_ADDR_MAGIC + 1, (unsigned char)(EEPROM_MAGIC_KEY & 0xFF));

    unsigned char *ptr = (unsigned char *)&activeConfig;
    for (unsigned int i = 0; i < sizeof(ConveyorConfig_t); i++) {
        EEPROM_WriteByte(EEPROM_ADDR_DATA + i, ptr[i]);
    }
}

void SyncControl_Sensor1_Pulse(void) {
    lapsConveyor1++;
    unsigned long dt = systemMillis - lastPulseTime1;
    if (dt > 50) { // Filtro antirruido
        lastPulseTime1 = systemMillis;
        currentRpm1 = 60000.0f / (float)dt;
    }
}

void SyncControl_Sensor2_Pulse(void) {
    lapsConveyor2++;
    unsigned long dt = systemMillis - lastPulseTime2;
    if (dt > 50) { // Filtro antirruido
        lastPulseTime2 = systemMillis;
        currentRpm2 = 60000.0f / (float)dt;
    }
}

void SyncControl_Update(void) {
    if (strcmp(activeConfig.opMode, "STOP") == 0) {
        PWM1_SetVoltage(0.0f);
        PWM2_SetVoltage(0.0f);
        strcpy(syncStatus, "STOPPED");
        LATBbits.LATB2 = 0;
        return;
    }

    if (strcmp(activeConfig.opMode, "MANUAL") == 0) {
        PWM1_SetVoltage(activeConfig.inverter1Enabled ? activeConfig.baseVolt1 : 0.0f);
        PWM2_SetVoltage(activeConfig.inverter2Enabled ? activeConfig.baseVolt2 : 0.0f);
        strcpy(syncStatus, "SYNCED");
        LATBbits.LATB2 = 0;
        return;
    }

    // AUTO_SYNC:
    // Diferenca de voltas: delta = laps1 - laps2
    long delta = (long)lapsConveyor1 - (long)lapsConveyor2;

    // Integral com anti-windup
    integralError += (float)delta * 0.1f;
    if (integralError > 5.0f) integralError = 5.0f;
    if (integralError < -5.0f) integralError = -5.0f;

    // Derivativo
    float dError = (float)(delta - lastDeltaLaps) / 0.1f;
    lastDeltaLaps = delta;

    // Correcao PI/PID para Inversor 2
    float correction = (activeConfig.kp * (float)delta) +
                       (activeConfig.ki * integralError) +
                       (activeConfig.kd * dError);

    // Limite maximo de correcao
    if (correction > activeConfig.maxCorrectionVolt) {
        correction = activeConfig.maxCorrectionVolt;
    } else if (correction < -activeConfig.maxCorrectionVolt) {
        correction = -activeConfig.maxCorrectionVolt;
    }

    float v1 = activeConfig.inverter1Enabled ? activeConfig.baseVolt1 : 0.0f;
    float v2 = activeConfig.inverter2Enabled ? (activeConfig.baseVolt2 + correction) : 0.0f;

    PWM1_SetVoltage(v1);
    PWM2_SetVoltage(v2);

    long absDelta = labs(delta);
    if (absDelta <= (long)activeConfig.syncToleranceLaps) {
        strcpy(syncStatus, "SYNCED");
        LATBbits.LATB2 = 0;
    } else if (absDelta > 5) {
        strcpy(syncStatus, "DESYNC_ALARM");
        if (activeConfig.buzzerAlarmEnabled) {
            LATBbits.LATB2 = 1;
        }
    } else {
        strcpy(syncStatus, "ADJUSTING");
        LATBbits.LATB2 = 0;
    }
}
