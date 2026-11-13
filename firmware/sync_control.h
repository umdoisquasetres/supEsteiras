#ifndef SYNC_CONTROL_H
#define SYNC_CONTROL_H

#include <xc.h>
#include <stdint.h>

typedef struct {
    char deviceName[20];
    unsigned long baudRate;
    unsigned int sampleIntervalMs;
    float targetRpm;
    float baseVolt1;            // Tensao base Inversor 1 (0.0 a 10.0 V)
    float baseVolt2;            // Tensao base Inversor 2 (0.0 a 10.0 V)
    float kp;                   // Ganho proporcional
    float ki;                   // Ganho integral
    float kd;                   // Ganho derivativo
    float syncToleranceLaps;    // Tolerancia de sincronismo em voltas (ex: 0.1)
    float maxCorrectionVolt;    // Correcao maxima permitida em Volts (ex: 2.5V)
    char opMode[16];            // "AUTO_SYNC", "MANUAL", "STOP", "CALIBRATION"
    uint8_t inverter1Enabled;
    uint8_t inverter2Enabled;
    uint8_t buzzerAlarmEnabled;
} ConveyorConfig_t;

extern ConveyorConfig_t activeConfig;

extern volatile unsigned long lapsConveyor1;
extern volatile unsigned long lapsConveyor2;
extern volatile unsigned long lastPulseTime1;
extern volatile unsigned long lastPulseTime2;
extern volatile float currentRpm1;
extern volatile float currentRpm2;
extern volatile unsigned long systemMillis;
extern volatile unsigned long uptimeSeconds;

extern float integralError;
extern long lastDeltaLaps;
extern char syncStatus[16];

void SyncControl_ResetDefaults(void);
void SyncControl_LoadFromEEPROM(void);
void SyncControl_SaveToEEPROM(void);
void SyncControl_Update(void);
void SyncControl_Sensor1_Pulse(void);
void SyncControl_Sensor2_Pulse(void);

#endif // SYNC_CONTROL_H
