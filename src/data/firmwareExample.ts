export const PIC_XC8_CODE = `/**
 * ==============================================================================
 * SISTEMA DE CONFIGURACAO SERIAL PARA MICROCONTROLADORES PIC (MPLAB XC8)
 * Compativel com: PIC16F877A, PIC18F4550, PIC18F25K22, etc.
 * 
 * Comunicacao: UART 8-N-1 (Padrao 115200 bps ou 9600 bps)
 * Protocolo: Comandos ASCII terminados em '\\n'
 * ==============================================================================
 */

#include <xc.h>
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <stdbool.h>

// Definicoes de Frequencia do Oscilador
#define _XTAL_FREQ 20000000  // Exemplo: Cristal de 20MHz

// Estrutura de dados para armazenar a configuracao na memoria e EEPROM
typedef struct {
    char deviceName[20];
    unsigned long baudRate;
    unsigned int sampleIntervalMs;
    float tempOffset;
    float alarmHigh;
    float alarmLow;
    uint8_t relay1;
    uint8_t relay2;
    uint8_t pwmDuty;      // 0 a 100%
    char opMode[12];      // "AUTO", "MANUAL", "ECO", "CALIBRATION"
    uint8_t buzzerEnabled;
} DeviceConfig_t;

// Variavel global contendo a configuracao ativa
DeviceConfig_t activeConfig;

// Buffer de recepcao UART
#define RX_BUFFER_SIZE 96
volatile char rxBuffer[RX_BUFFER_SIZE];
volatile uint8_t rxIndex = 0;
volatile bool commandReady = false;

// Prototipos de funcoes
void UART_Init(unsigned long baud);
void UART_Write(char data);
void UART_WriteString(const char *text);
void EEPROM_SaveConfig(void);
void EEPROM_LoadConfig(void);
void ProcessCommand(char *cmd);
void ResetToDefaults(void);

// ==============================================================================
// ROTINA DE INTERRUPCAO (RECEPCAO SERIAL UART)
// ==============================================================================
void __interrupt() ISR(void) {
    if (PIR1bits.RCIF) {
        // Verifica erro de overrun
        if (RCSTAbits.OERR) {
            RCSTAbits.CREN = 0;
            RCSTAbits.CREN = 1;
        }

        char c = RCREG;

        if (c == '\\r' || c == '\\n') {
            if (rxIndex > 0) {
                rxBuffer[rxIndex] = '\\0';
                commandReady = true;
            }
        } else if (rxIndex < (RX_BUFFER_SIZE - 1)) {
            rxBuffer[rxIndex++] = c;
        }
    }
}

// ==============================================================================
// INICIALIZACAO UART (XC8)
// ==============================================================================
void UART_Init(unsigned long baud) {
    TRISCbits.TRISC7 = 1; // RX como entrada
    TRISCbits.TRISC6 = 0; // TX como saida

    // Configuracao do Baud Rate Generator (BRGH=1, 16-bit ou 8-bit conforme modelo)
    TXSTAbits.BRGH = 1;
    SPBRG = (unsigned char)((_XTAL_FREQ / (16UL * baud)) - 1);

    TXSTAbits.SYNC = 0;   // Modo assincrono
    RCSTAbits.SPEN = 1;   // Habilita porta serial
    RCSTAbits.CREN = 1;   // Recepcao continua
    TXSTAbits.TXEN = 1;   // Habilita transmissao

    // Habilita interrupcao de RX
    PIE1bits.RCIE = 1;
    INTCONbits.PEIE = 1;
    INTCONbits.GIE = 1;
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

// ==============================================================================
// LEITURA E GRAVACAO NA EEPROM INTERNA
// ==============================================================================
#define EEPROM_SIGNATURE_ADDR 0x00
#define EEPROM_DATA_ADDR      0x02
#define EEPROM_MAGIC          0xA5

void EEPROM_SaveConfig(void) {
    uint8_t *ptr = (uint8_t *)&activeConfig;
    eeprom_write(EEPROM_SIGNATURE_ADDR, EEPROM_MAGIC);
    for (uint8_t i = 0; i < sizeof(DeviceConfig_t); i++) {
        eeprom_write(EEPROM_DATA_ADDR + i, *(ptr + i));
    }
}

void EEPROM_LoadConfig(void) {
    if (eeprom_read(EEPROM_SIGNATURE_ADDR) == EEPROM_MAGIC) {
        uint8_t *ptr = (uint8_t *)&activeConfig;
        for (uint8_t i = 0; i < sizeof(DeviceConfig_t); i++) {
            *(ptr + i) = eeprom_read(EEPROM_DATA_ADDR + i);
        }
    } else {
        ResetToDefaults();
        EEPROM_SaveConfig();
    }
}

void ResetToDefaults(void) {
    strncpy(activeConfig.deviceName, "PIC18F_CTRL_01", sizeof(activeConfig.deviceName));
    activeConfig.baudRate = 115200;
    activeConfig.sampleIntervalMs = 1000;
    activeConfig.tempOffset = 0.0f;
    activeConfig.alarmHigh = 75.0f;
    activeConfig.alarmLow = 15.0f;
    activeConfig.relay1 = 0;
    activeConfig.relay2 = 1;
    activeConfig.pwmDuty = 50;
    strncpy(activeConfig.opMode, "AUTO", sizeof(activeConfig.opMode));
    activeConfig.buzzerEnabled = 1;
}

// ==============================================================================
// PROCESSADOR DE COMANDOS ASCII (WEB PROTOCOL)
// ==============================================================================
void ProcessCommand(char *cmd) {
    char outBuffer[128];

    if (strcmp(cmd, "PING") == 0) {
        UART_WriteString("PONG\\n");
        return;
    }

    if (strcmp(cmd, "GET_ALL") == 0 || strcmp(cmd, "GET_CONFIG") == 0) {
        sprintf(outBuffer,
            "CFG:NAME=%s;BAUD=%lu;INTERVAL=%u;OFFSET=%.1f;ALARM_HI=%.1f;ALARM_LO=%.1f;RELAY1=%u;RELAY2=%u;PWM=%u;MODE=%s;BUZZER=%u\\n",
            activeConfig.deviceName,
            activeConfig.baudRate,
            activeConfig.sampleIntervalMs,
            (double)activeConfig.tempOffset,
            (double)activeConfig.alarmHigh,
            (double)activeConfig.alarmLow,
            activeConfig.relay1,
            activeConfig.relay2,
            activeConfig.pwmDuty,
            activeConfig.opMode,
            activeConfig.buzzerEnabled
        );
        UART_WriteString(outBuffer);
        return;
    }

    if (strcmp(cmd, "STATUS") == 0) {
        // Exemplo: Leitura de temperatura simulada (ADC) e tensao
        float currentTemp = 24.5f + activeConfig.tempOffset;
        float vcc = 5.01f;
        unsigned long uptime = 120; // calcular com timer

        sprintf(outBuffer, "STATUS:TEMP=%.1f;VCC=%.2f;UPTIME=%lu;RELAY1=%u;RELAY2=%u;PWM=%u\\n",
            (double)currentTemp, (double)vcc, uptime, activeConfig.relay1, activeConfig.relay2, activeConfig.pwmDuty);
        UART_WriteString(outBuffer);
        return;
    }

    if (strcmp(cmd, "SAVE") == 0) {
        EEPROM_SaveConfig();
        UART_WriteString("OK SAVED\\n");
        return;
    }

    if (strcmp(cmd, "RESET") == 0) {
        ResetToDefaults();
        EEPROM_SaveConfig();
        UART_WriteString("OK RESET\\n");
        return;
    }

    // Comandos de alteracao: SET <CHAVE>=<VALOR>
    if (strncmp(cmd, "SET ", 4) == 0) {
        char *assignment = cmd + 4;
        char *eq = strchr(assignment, '=');
        if (eq) {
            *eq = '\\0';
            char *key = assignment;
            char *val = eq + 1;

            if (strcmp(key, "NAME") == 0) {
                strncpy(activeConfig.deviceName, val, sizeof(activeConfig.deviceName)-1);
            } else if (strcmp(key, "BAUD") == 0) {
                activeConfig.baudRate = atol(val);
            } else if (strcmp(key, "INTERVAL") == 0) {
                activeConfig.sampleIntervalMs = (unsigned int)atoi(val);
            } else if (strcmp(key, "OFFSET") == 0) {
                activeConfig.tempOffset = (float)atof(val);
            } else if (strcmp(key, "ALARM_HI") == 0) {
                activeConfig.alarmHigh = (float)atof(val);
            } else if (strcmp(key, "ALARM_LO") == 0) {
                activeConfig.alarmLow = (float)atof(val);
            } else if (strcmp(key, "RELAY1") == 0) {
                activeConfig.relay1 = (uint8_t)atoi(val);
                // Atualizar pino fisico do rele 1 (ex: PORTBbits.RB0 = activeConfig.relay1;)
            } else if (strcmp(key, "RELAY2") == 0) {
                activeConfig.relay2 = (uint8_t)atoi(val);
                // Atualizar pino fisico do rele 2 (ex: PORTBbits.RB1 = activeConfig.relay2;)
            } else if (strcmp(key, "PWM") == 0) {
                activeConfig.pwmDuty = (uint8_t)atoi(val);
                // Atualizar registrador CCPR1L conforme duty cycle
            } else if (strcmp(key, "MODE") == 0) {
                strncpy(activeConfig.opMode, val, sizeof(activeConfig.opMode)-1);
            } else if (strcmp(key, "BUZZER") == 0) {
                activeConfig.buzzerEnabled = (uint8_t)atoi(val);
            }

            sprintf(outBuffer, "OK SET %s=%s\\n", key, val);
            UART_WriteString(outBuffer);
            return;
        }
    }

    UART_WriteString("ERR UNKNOWN_COMMAND\\n");
}

// ==============================================================================
// FUNCAO PRINCIPAL MAIN
// ==============================================================================
void main(void) {
    // Carrega configuracoes salvas na EEPROM
    EEPROM_LoadConfig();

    // Inicia a comunicacao serial na taxa configurada
    UART_Init(activeConfig.baudRate);

    UART_WriteString("\\r\\n=== PIC PRONTO PARA CONFIGURACAO ===\\r\\n");

    while (1) {
        if (commandReady) {
            commandReady = false;
            ProcessCommand((char *)rxBuffer);
            rxIndex = 0;
        }

        // Outras tarefas da aplicacao...
    }
}
`;

export const HARDWARE_WIRING_TIPS = [
  {
    title: 'Conexão USB-Serial (FT232, CH340, CP2102)',
    description: 'Conecte o pino TX do módulo USB-Serial ao RX do PIC (pino RC7 no PIC16F877A/18F4550) e o pino RX do módulo ao TX do PIC (pino RC6). Conecte sempre o GND em comum.'
  },
  {
    title: 'Nível Lógico 5V vs 3.3V',
    description: 'Se o seu PIC opera em 5V (como os clássicos PIC16F877A / PIC18F4550), configure o jumper do seu conversor USB-Serial para 5V. Para PICs de 3.3V (PIC24F ou dsPIC), use 3.3V para evitar danificar os pinos.'
  },
  {
    title: 'Navegadores Suportados',
    description: 'A Web Serial API funciona nativamente em Google Chrome, Microsoft Edge e Opera (desktop). No Firefox ou Safari, a API não é suportada por restrições dos próprios navegadores.'
  },
  {
    title: 'Permissão de Acesso',
    description: 'Ao clicar em "Conectar PIC", o navegador abrirá uma janela do sistema listando as portas COM detectadas. Escolha a porta correspondente ao seu conversor USB.'
  }
];
