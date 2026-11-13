/**
 * ==============================================================================
 * PROJETO: supEsteiras - Sistema de Sincronismo de Duas Esteiras
 * MICROCONTROLADOR: Microchip PIC18F4620
 * CLOCK: 8.0 MHz Interno (HFINTOSC)
 * AMBIENTE: MPLAB X IDE v6.20 com XC8
 * ==============================================================================
 */

#include "config_bits.h"
#include "uart.h"
#include "pwm.h"
#include "sync_control.h"
#include "eeprom.h"
#include <stdio.h>
#include <string.h>
#include <stdlib.h>

// ------------------------------------------------------------------------------
// ROTINA DE INTERRUPCAO UNIFICADA
// ------------------------------------------------------------------------------
void __interrupt() HighLow_ISR(void) {
    // 1. Tick Timer0 (1 milissegundo)
    if (INTCONbits.TMR0IF) {
        INTCONbits.TMR0IF = 0;
        TMR0H = 0xFE;           // Recarrega Timer0 para 1ms @ 8MHz
        TMR0L = 0x0C;
        systemMillis++;
        if ((systemMillis % 1000) == 0) {
            uptimeSeconds++;
        }
    }

    // 2. Sensor 1 - Esteira Mestra (Pino RB0 / INT0)
    if (INTCONbits.INT0IF) {
        INTCONbits.INT0IF = 0;
        SyncControl_Sensor1_Pulse();
    }

    // 3. Sensor 2 - Esteira Sincronizada (Pino RB1 / INT1)
    if (INTCON3bits.INT1IF) {
        INTCON3bits.INT1IF = 0;
        SyncControl_Sensor2_Pulse();
    }

    // 4. Recepcao Serial UART (Pino RC7 / RX)
    if (PIR1bits.RCIF) {
        UART_ISR_Handler();
    }
}

// ------------------------------------------------------------------------------
// INICIALIZACAO DE PERIFERICOS E HARDWARE
// ------------------------------------------------------------------------------
static void Hardware_Init(void) {
    // 1. Oscilador Interno 8.0 MHz
    OSCCONbits.IRCF = 0b111;    // 8 MHz HFINTOSC
    OSCCONbits.SCS = 0b00;
    while (!OSCCONbits.IOFS);   // Aguarda estabilizar clock

    // 2. Portas Digitais
    ADCON1 = 0x0F;             // Todos pinos analógicos em digital I/O
    CMCON = 0x07;              // Comparadores desligados

    // Sensores de volta
    TRISBbits.TRISB0 = 1;      // RB0 / INT0 = Entrada Sensor 1
    TRISBbits.TRISB1 = 1;      // RB1 / INT1 = Entrada Sensor 2

    // Alarme / Buzzer
    TRISBbits.TRISB2 = 0;      // RB2 = Saida Buzzer
    LATBbits.LATB2 = 0;

    // Saidas PWM
    TRISCbits.TRISC2 = 0;      // RC2 / CCP1 = Inversor 1 (0-10V)
    TRISCbits.TRISC1 = 0;      // RC1 / CCP2 = Inversor 2 (0-10V)

    // 3. Timer0 para base de tempo 1ms
    T0CONbits.T08BIT = 0;      // 16-bit
    T0CONbits.T0CS = 0;        // Clock interno
    T0CONbits.PSA = 0;         // Prescaler ativo
    T0CONbits.T0PS = 0b001;    // Prescaler 1:4
    TMR0H = 0xFE;
    TMR0L = 0x0C;
    INTCONbits.TMR0IF = 0;
    INTCONbits.TMR0IE = 1;
    T0CONbits.TMR0ON = 1;

    // 4. Interrupcoes Externas dos Sensores (Borda de Descida)
    INTCON2bits.INTEDG0 = 0;
    INTCON2bits.INTEDG1 = 0;
    INTCONbits.INT0IF = 0;
    INTCONbits.INT0IE = 1;
    INTCON3bits.INT1IF = 0;
    INTCON3bits.INT1IE = 1;

    // 5. PWM 4kHz nos canais CCP1 e CCP2
    PWM_Init_4kHz();
}

static void SendTelemetryStatus(void) {
    char buf[128];
    long delta = (long)lapsConveyor1 - (long)lapsConveyor2;
    sprintf(buf, "STATUS:RPM1=%.1f;RPM2=%.1f;LAPS1=%lu;LAPS2=%lu;DELTA=%ld;V1=%.2f;V2=%.2f;SYNC=%s;VCC=5.01;UPTIME=%lu\n",
            currentRpm1, currentRpm2, lapsConveyor1, lapsConveyor2, delta,
            currentVolt1, currentVolt2, syncStatus, uptimeSeconds);
    UART_WriteString(buf);
}

static void ProcessCommand(char *cmd) {
    if (strcmp(cmd, "PING") == 0) {
        UART_WriteString("PONG (PIC18F4620 ONLINE)\n");
        return;
    }

    if (strcmp(cmd, "STATUS") == 0) {
        SendTelemetryStatus();
        return;
    }

    if (strcmp(cmd, "ZERO_LAPS") == 0 || strcmp(cmd, "RESET_LAPS") == 0) {
        lapsConveyor1 = 0;
        lapsConveyor2 = 0;
        integralError = 0.0f;
        UART_WriteString("OK ZERO_LAPS (CONTADORES DE VOLTAS ZERADOS)\n");
        return;
    }

    if (strcmp(cmd, "START") == 0) {
        strcpy(activeConfig.opMode, "AUTO_SYNC");
        UART_WriteString("OK START (ESTEIRAS INICIADAS EM MODO AUTO_SYNC)\n");
        return;
    }

    if (strcmp(cmd, "STOP") == 0) {
        strcpy(activeConfig.opMode, "STOP");
        UART_WriteString("OK STOP (ESTEIRAS PARADAS)\n");
        return;
    }

    if (strcmp(cmd, "GET_ALL") == 0) {
        char buf[256];
        sprintf(buf, "CFG:NAME=%s;BAUD=%lu;INTERVAL=%u;RPM_TARGET=%.1f;BASE_V1=%.2f;BASE_V2=%.2f;KP=%.2f;KI=%.2f;KD=%.2f;SYNC_TOL=%.2f;MAX_CORR=%.2f;MODE=%s;INV1_EN=%d;INV2_EN=%d;BUZZER=%d\n",
                activeConfig.deviceName, activeConfig.baudRate, activeConfig.sampleIntervalMs,
                activeConfig.targetRpm, activeConfig.baseVolt1, activeConfig.baseVolt2,
                activeConfig.kp, activeConfig.ki, activeConfig.kd,
                activeConfig.syncToleranceLaps, activeConfig.maxCorrectionVolt,
                activeConfig.opMode, activeConfig.inverter1Enabled, activeConfig.inverter2Enabled,
                activeConfig.buzzerAlarmEnabled);
        UART_WriteString(buf);
        return;
    }

    if (strcmp(cmd, "SAVE") == 0) {
        SyncControl_SaveToEEPROM();
        UART_WriteString("OK SAVED (PARAMETROS GRAVADOS NA EEPROM INTERNA)\n");
        return;
    }

    if (strcmp(cmd, "RESET") == 0) {
        SyncControl_ResetDefaults();
        SyncControl_SaveToEEPROM();
        UART_WriteString("OK RESET (PADROES DE FABRICA RESTAURADOS)\n");
        return;
    }

    if (strncmp(cmd, "SET ", 4) == 0) {
        char *assign = cmd + 4;
        char *eq = strchr(assign, '=');
        if (eq) {
            *eq = '\0';
            char *key = assign;
            char *val = eq + 1;

            if (strcmp(key, "NAME") == 0) strncpy(activeConfig.deviceName, val, 19);
            else if (strcmp(key, "RPM_TARGET") == 0) activeConfig.targetRpm = atof(val);
            else if (strcmp(key, "BASE_V1") == 0) activeConfig.baseVolt1 = atof(val);
            else if (strcmp(key, "BASE_V2") == 0) activeConfig.baseVolt2 = atof(val);
            else if (strcmp(key, "KP") == 0) activeConfig.kp = atof(val);
            else if (strcmp(key, "KI") == 0) activeConfig.ki = atof(val);
            else if (strcmp(key, "KD") == 0) activeConfig.kd = atof(val);
            else if (strcmp(key, "SYNC_TOL") == 0) activeConfig.syncToleranceLaps = atof(val);
            else if (strcmp(key, "MAX_CORR") == 0) activeConfig.maxCorrectionVolt = atof(val);
            else if (strcmp(key, "MODE") == 0) strncpy(activeConfig.opMode, val, 15);
            else if (strcmp(key, "INV1_EN") == 0) activeConfig.inverter1Enabled = (atoi(val) != 0);
            else if (strcmp(key, "INV2_EN") == 0) activeConfig.inverter2Enabled = (atoi(val) != 0);
            else if (strcmp(key, "BUZZER") == 0) activeConfig.buzzerAlarmEnabled = (atoi(val) != 0);

            UART_WriteString("OK SET ");
            UART_WriteString(key);
            UART_WriteString("=");
            UART_WriteString(val);
            UART_WriteString("\n");
        }
        return;
    }

    UART_WriteString("ERR: COMANDO DESCONHECIDO\n");
}

void main(void) {
    Hardware_Init();
    SyncControl_LoadFromEEPROM();
    UART_Init(activeConfig.baudRate);

    UART_WriteString("\n=== supEsteiras PIC18F4620 INICIADO ===\n");

    unsigned long lastControlTime = 0;
    unsigned long lastTelemetryTime = 0;

    while (1) {
        // Trata comando serial
        if (commandReady) {
            commandReady = false;
            ProcessCommand((char *)rxBuffer);
            rxIndex = 0;
        }

        // Loop de sincronismo a cada 100 ms
        if ((systemMillis - lastControlTime) >= 100) {
            lastControlTime = systemMillis;
            SyncControl_Update();
        }

        // Envio de telemetria periódico
        if ((systemMillis - lastTelemetryTime) >= activeConfig.sampleIntervalMs) {
            lastTelemetryTime = systemMillis;
            SendTelemetryStatus();
        }
    }
}
