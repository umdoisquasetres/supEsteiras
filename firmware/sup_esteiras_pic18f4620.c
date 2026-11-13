/**
 * ==============================================================================
 * PROJETO: supEsteiras - Sistema de Sincronismo de Duas Esteiras (Versao Monolitica)
 * MICROCONTROLADOR: Microchip PIC18F4620
 * OSCILADOR: 8.0 MHz Interno (HFINTOSC)
 * AMBIENTE DE DESENVOLVIMENTO: MPLAB X IDE v6.20
 * COMPILADOR: Microchip MPLAB XC8 (C99)
 * ==============================================================================
 * DESCRICAO DO SISTEMA:
 * - 2 Esteiras acionadas por inversores de frequencia controlados por tensao 0-10V.
 * - Sensor 1 (Esteira Mestra): Pino RB0/INT0 (gera 1 pulso por volta completa).
 * - Sensor 2 (Esteira Sincronizada): Pino RB1/INT1 (gera 1 pulso por volta completa).
 * - Saida PWM 1 (CCP1 - Pino RC2): Tensao Inversor 1 (via filtro RC/OpAmp 0-10V).
 * - Saida PWM 2 (CCP2 - Pino RC1): Tensao Inversor 2 (via filtro RC/OpAmp 0-10V).
 * - UART Serial (TX=RC6, RX=RC7): 9600 bps, 8-N-1 para Web Serial / Supervisorio.
 * - Algoritmo de Controle: Malha fechada PI/PID ajusta a tensao do Inversor 2
 *   para manter a diferenca de voltas (Delta = Voltas1 - Voltas2) em ZERO.
 * - Persistencia: Parametros de sintonia e tensao salvos na EEPROM interna.
 * ==============================================================================
 */

// ------------------------------------------------------------------------------
// BITS DE CONFIGURACAO (CONFIGURATION BITS - PIC18F4620)
// ------------------------------------------------------------------------------
#pragma config OSC = INTIO67    // Oscilador Interno com pinos RA6 e RA7 como I/O digital
#pragma config FCMEN = OFF      // Fail-Safe Clock Monitor desabilitado
#pragma config IESO = OFF       // Internal/External Oscillator Switchover desabilitado
#pragma config PWRT = ON        // Power-up Timer habilitado
#pragma config BOREN = ON       // Brown-out Reset habilitado
#pragma config BORV = 3         // Nivel do Brown-out Reset minimo
#pragma config WDT = OFF        // Watchdog Timer desabilitado
#pragma config PBADEN = OFF     // PORTB<4:0> configurado como I/O DIGITAL no Reset (ESSENCIAL para RB0/RB1)
#pragma config CCP2MX = PORTC   // Pino CCP2 multiplexado em RC1
#pragma config LVP = OFF        // Single-Supply ICSP desabilitado (libera RB5)
#pragma config MCLRE = ON       // Pino MCLR habilitado
#pragma config STVREN = ON      // Stack Overflow/Underflow Reset habilitado
#pragma config XINST = OFF      // Extended Instruction Set desabilitado

#include <xc.h>
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <stdbool.h>

#define _XTAL_FREQ 8000000UL    // 8.0 MHz

// ------------------------------------------------------------------------------
// ESTRUTURAS DE DADOS E PARAMETROS
// ------------------------------------------------------------------------------
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

ConveyorConfig_t activeConfig;

// Variaveis de Estado e Telemetria em Tempo Real
volatile unsigned long lapsConveyor1 = 0;
volatile unsigned long lapsConveyor2 = 0;
volatile unsigned long lastPulseTime1 = 0;
volatile unsigned long lastPulseTime2 = 0;
volatile float currentRpm1 = 0.0f;
volatile float currentRpm2 = 0.0f;
volatile unsigned long systemMillis = 0;
volatile unsigned long uptimeSeconds = 0;

float currentVolt1 = 5.0f;
float currentVolt2 = 5.0f;
float integralError = 0.0f;
long lastDeltaLaps = 0;
char syncStatus[16] = "SYNCED";

// Buffer de Recepcao Serial UART
#define RX_BUFFER_SIZE 96
volatile char rxBuffer[RX_BUFFER_SIZE];
volatile uint8_t rxIndex = 0;
volatile bool commandReady = false;

// ------------------------------------------------------------------------------
// ROTINA DE INTERRUPCAO (ISR UNICA NO XC8)
// ------------------------------------------------------------------------------
void __interrupt() HighLow_ISR(void) {
    // 1. Interrupcao do Timer0 (Tick de 1 milissegundo)
    if (INTCONbits.TMR0IF) {
        INTCONbits.TMR0IF = 0;
        TMR0H = 0xFE;           // Recarrega Timer0 para 1ms a 8MHz (Prescaler 1:4)
        TMR0L = 0x0C;
        systemMillis++;
        if ((systemMillis % 1000) == 0) {
            uptimeSeconds++;
        }
    }

    // 2. Interrupcao do Sensor 1 - Esteira Mestra (Pino RB0 / INT0)
    if (INTCONbits.INT0IF) {
        INTCONbits.INT0IF = 0;
        lapsConveyor1++;
        unsigned long dt = systemMillis - lastPulseTime1;
        if (dt > 50) {          // Debounce / Filtro de ruido (minimo 50ms por volta)
            lastPulseTime1 = systemMillis;
            currentRpm1 = 60000.0f / (float)dt;
        }
    }

    // 3. Interrupcao do Sensor 2 - Esteira Sincronizada (Pino RB1 / INT1)
    if (INTCON3bits.INT1IF) {
        INTCON3bits.INT1IF = 0;
        lapsConveyor2++;
        unsigned long dt = systemMillis - lastPulseTime2;
        if (dt > 50) {          // Debounce / Filtro de ruido
            lastPulseTime2 = systemMillis;
            currentRpm2 = 60000.0f / (float)dt;
        }
    }

    // 4. Interrupcao de Recepcao Serial UART (RCIF)
    if (PIR1bits.RCIF) {
        if (RCSTAbits.OERR) {   // Tratamento de Overrun
            RCSTAbits.CREN = 0;
            RCSTAbits.CREN = 1;
        }
        char c = RCREG;
        if (c == '\r' || c == '\n') {
            if (rxIndex > 0) {
                rxBuffer[rxIndex] = '\0';
                commandReady = true;
            }
        } else if (rxIndex < (RX_BUFFER_SIZE - 1)) {
            rxBuffer[rxIndex++] = c;
        }
    }
}

// ------------------------------------------------------------------------------
// INICIALIZACAO DO OSCILADOR INTERNO EM 8.0 MHz
// ------------------------------------------------------------------------------
void Oscillator_Init_8MHz(void) {
    OSCCONbits.IRCF = 0b111;    // Seleciona 8 MHz HFINTOSC
    OSCCONbits.SCS = 0b00;     // Fonte primária selecionada pelos config bits
    while (!OSCCONbits.IOFS);   // Aguarda estabilizacao da frequencia
}

// ------------------------------------------------------------------------------
// INICIALIZACAO DOS PINOS DIGITAIS
// ------------------------------------------------------------------------------
void GPIO_Init(void) {
    ADCON1 = 0x0F;             // Todos os canais AN como I/O digital
    CMCON = 0x07;              // Comparadores desabilitados

    // Sensores nas entradas RB0 e RB1
    TRISBbits.TRISB0 = 1;      // RB0 / INT0 = Entrada Sensor 1
    TRISBbits.TRISB1 = 1;      // RB1 / INT1 = Entrada Sensor 2
    
    // Saidas PWM nos pinos RC1 e RC2
    TRISCbits.TRISC2 = 0;      // RC2 / CCP1 = Saida PWM Inversor 1
    TRISCbits.TRISC1 = 0;      // RC1 / CCP2 = Saida PWM Inversor 2

    // Buzzer de Alarme
    TRISBbits.TRISB2 = 0;      // RB2 = Saida Buzzer
    LATBbits.LATB2 = 0;
}

// ------------------------------------------------------------------------------
// INICIALIZACAO TIMER0 (BASE DE TEMPO 1 ms)
// ------------------------------------------------------------------------------
void Timer0_Init_1ms(void) {
    T0CONbits.T08BIT = 0;      // Modo 16-bit
    T0CONbits.T0CS = 0;        // Clock interno
    T0CONbits.PSA = 0;         // Prescaler atribuido
    T0CONbits.T0PS = 0b001;    // Prescaler 1:4
    TMR0H = 0xFE;
    TMR0L = 0x0C;
    INTCONbits.TMR0IF = 0;
    INTCONbits.TMR0IE = 1;     // Habilita interrupcao Timer0
    T0CONbits.TMR0ON = 1;      // Liga Timer0
}

// ------------------------------------------------------------------------------
// INICIALIZACAO DAS INTERRUPCOES EXTERNAS (RB0 e RB1)
// ------------------------------------------------------------------------------
void ExternalInterrupts_Init(void) {
    INTCON2bits.INTEDG0 = 0;   // INT0 borda de descida
    INTCON2bits.INTEDG1 = 0;   // INT1 borda de descida

    INTCONbits.INT0IF = 0;
    INTCONbits.INT0IE = 1;     // Habilita interrupcao INT0 (RB0)

    INTCON3bits.INT1IF = 0;
    INTCON3bits.INT1IE = 1;    // Habilita interrupcao INT1 (RB1)
}

// ------------------------------------------------------------------------------
// INICIALIZACAO PWM PARA CONTROLE DE TENSAO 0-10V DOS INVERSORES
// ------------------------------------------------------------------------------
void PWM_Init_4kHz(void) {
    PR2 = 124;                 // 4 kHz a 8 MHz com Prescaler 1:4
    CCP1CON = 0x0C;            // Modo PWM canal 1 (RC2)
    CCP2CON = 0x0C;            // Modo PWM canal 2 (RC1)
    CCPR1L = 0;
    CCPR2L = 0;
    T2CONbits.T2CKPS = 0b01;   // Timer2 Prescaler 1:4
    T2CONbits.TMR2ON = 1;      // Liga Timer2
}

void PWM1_SetVoltage(float volts) {
    if (volts < 0.0f) volts = 0.0f;
    if (volts > 10.0f) volts = 10.0f;
    currentVolt1 = volts;

    unsigned int duty = (unsigned int)((volts / 10.0f) * 500.0f);
    if (duty > 500) duty = 500;

    CCPR1L = (unsigned char)(duty >> 2);
    CCP1CONbits.DC1B = (unsigned char)(duty & 0x03);
}

void PWM2_SetVoltage(float volts) {
    if (volts < 0.0f) volts = 0.0f;
    if (volts > 10.0f) volts = 10.0f;
    currentVolt2 = volts;

    unsigned int duty = (unsigned int)((volts / 10.0f) * 500.0f);
    if (duty > 500) duty = 500;

    CCPR2L = (unsigned char)(duty >> 2);
    CCP2CONbits.DC2B = (unsigned char)(duty & 0x03);
}

// ------------------------------------------------------------------------------
// INICIALIZACAO UART SERIAL (9600 bps a 8 MHz)
// ------------------------------------------------------------------------------
void UART_Init(unsigned long baud) {
    TRISCbits.TRISC7 = 1;      // RX como entrada
    TRISCbits.TRISC6 = 0;      // TX como saida

    BAUDCONbits.BRG16 = 1;     // Gerador de Baud Rate em 16 bits
    TXSTAbits.BRGH = 1;        // High Speed
    
    unsigned int spbrgVal = (unsigned int)((_XTAL_FREQ / (4UL * baud)) - 1);
    SPBRGH = (unsigned char)(spbrgVal >> 8);
    SPBRG  = (unsigned char)(spbrgVal & 0xFF);

    TXSTAbits.SYNC = 0;        // Modo assincrono
    RCSTAbits.SPEN = 1;        // Habilita porta serial
    RCSTAbits.CREN = 1;        // Recepcao continua
    TXSTAbits.TXEN = 1;        // Habilita transmissor

    PIE1bits.RCIE = 1;         // Habilita interrupcao de RX
    INTCONbits.PEIE = 1;       // Habilita interrupcoes de perifericos
    INTCONbits.GIE = 1;        // Habilita interrupcoes globais
}

void UART_Write(char data) {
    while (!TXSTAbits.TRMT);
    TXREG = data;
}

void UART_WriteString(const char *text) {
    while (*text) {
        UART_Write(*text++);
    }
}

// ------------------------------------------------------------------------------
// EEPROM INTERNA DO PIC18F4620
// ------------------------------------------------------------------------------
#define EEPROM_MAGIC_KEY 0x5A42
#define EEPROM_ADDR_MAGIC 0x00
#define EEPROM_ADDR_DATA  0x04

void EEPROM_WriteByte(unsigned int addr, unsigned char data) {
    EEADRH = (unsigned char)(addr >> 8);
    EEADR  = (unsigned char)(addr & 0xFF);
    EEDATA = data;
    EECON1bits.EEPGD = 0;
    EECON1bits.CFGS = 0;
    EECON1bits.WREN = 1;
    
    INTCONbits.GIE = 0;
    EECON2 = 0x55;
    EECON2 = 0xAA;
    EECON1bits.WR = 1;
    INTCONbits.GIE = 1;
    
    while (EECON1bits.WR);
    EECON1bits.WREN = 0;
}

unsigned char EEPROM_ReadByte(unsigned int addr) {
    EEADRH = (unsigned char)(addr >> 8);
    EEADR  = (unsigned char)(addr & 0xFF);
    EECON1bits.EEPGD = 0;
    EECON1bits.CFGS = 0;
    EECON1bits.RD = 1;
    return EEDATA;
}

void ResetToDefaults(void);

void EEPROM_SaveConfig(void) {
    EEPROM_WriteByte(EEPROM_ADDR_MAGIC, (unsigned char)(EEPROM_MAGIC_KEY >> 8));
    EEPROM_WriteByte(EEPROM_ADDR_MAGIC + 1, (unsigned char)(EEPROM_MAGIC_KEY & 0xFF));

    unsigned char *ptr = (unsigned char *)&activeConfig;
    for (unsigned int i = 0; i < sizeof(ConveyorConfig_t); i++) {
        EEPROM_WriteByte(EEPROM_ADDR_DATA + i, ptr[i]);
    }
}

void EEPROM_LoadConfig(void) {
    unsigned int magic = ((unsigned int)EEPROM_ReadByte(EEPROM_ADDR_MAGIC) << 8) |
                          (unsigned int)EEPROM_ReadByte(EEPROM_ADDR_MAGIC + 1);

    if (magic == EEPROM_MAGIC_KEY) {
        unsigned char *ptr = (unsigned char *)&activeConfig;
        for (unsigned int i = 0; i < sizeof(ConveyorConfig_t); i++) {
            ptr[i] = EEPROM_ReadByte(EEPROM_ADDR_DATA + i);
        }
    } else {
        ResetToDefaults();
        EEPROM_SaveConfig();
    }
}

void ResetToDefaults(void) {
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

// ------------------------------------------------------------------------------
// ALGORITMO DE CONTROLE DE SINCRONISMO (PI / PID)
// ------------------------------------------------------------------------------
void UpdateSynchronizationControl(void) {
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
    long delta = (long)lapsConveyor1 - (long)lapsConveyor2;

    integralError += (float)delta * 0.1f;
    if (integralError > 5.0f) integralError = 5.0f;
    if (integralError < -5.0f) integralError = -5.0f;

    float dError = (float)(delta - lastDeltaLaps) / 0.1f;
    lastDeltaLaps = delta;

    float correction = (activeConfig.kp * (float)delta) +
                       (activeConfig.ki * integralError) +
                       (activeConfig.kd * dError);

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

void SendTelemetryStatus(void) {
    char buf[128];
    long delta = (long)lapsConveyor1 - (long)lapsConveyor2;
    sprintf(buf, "STATUS:RPM1=%.1f;RPM2=%.1f;LAPS1=%lu;LAPS2=%lu;DELTA=%ld;V1=%.2f;V2=%.2f;SYNC=%s;VCC=5.01;UPTIME=%lu\n",
            currentRpm1, currentRpm2, lapsConveyor1, lapsConveyor2, delta,
            currentVolt1, currentVolt2, syncStatus, uptimeSeconds);
    UART_WriteString(buf);
}

void ProcessCommand(char *cmd) {
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
        EEPROM_SaveConfig();
        UART_WriteString("OK SAVED (PARAMETROS GRAVADOS NA EEPROM INTERNA)\n");
        return;
    }

    if (strcmp(cmd, "RESET") == 0) {
        ResetToDefaults();
        EEPROM_SaveConfig();
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
    Oscillator_Init_8MHz();
    GPIO_Init();
    Timer0_Init_1ms();
    ExternalInterrupts_Init();
    PWM_Init_4kHz();
    
    EEPROM_LoadConfig();
    UART_Init(activeConfig.baudRate);

    UART_WriteString("\n=== supEsteiras PIC18F4620 INICIADO ===\n");

    unsigned long lastControlTime = 0;
    unsigned long lastTelemetryTime = 0;

    while (1) {
        if (commandReady) {
            commandReady = false;
            ProcessCommand((char *)rxBuffer);
            rxIndex = 0;
        }

        if ((systemMillis - lastControlTime) >= 100) {
            lastControlTime = systemMillis;
            UpdateSynchronizationControl();
        }

        if ((systemMillis - lastTelemetryTime) >= activeConfig.sampleIntervalMs) {
            lastTelemetryTime = systemMillis;
            SendTelemetryStatus();
        }
    }
}
