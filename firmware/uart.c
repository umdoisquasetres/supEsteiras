#include "uart.h"
#include "config_bits.h"

volatile char rxBuffer[RX_BUFFER_SIZE];
volatile unsigned char rxIndex = 0;
volatile bool commandReady = false;

void UART_Init(unsigned long baud) {
    TRISCbits.TRISC7 = 1;      // RX como entrada
    TRISCbits.TRISC6 = 0;      // TX como saida

    BAUDCONbits.BRG16 = 1;     // 16-bit Baud Rate Generator
    TXSTAbits.BRGH = 1;        // High Speed
    
    // Formula BRG16=1, BRGH=1: SPBRG = (Fosc / (4 * Baud)) - 1
    // Para 9600 bps @ 8MHz: (8000000 / (4 * 9600)) - 1 = 207 (Erro 0.16%)
    unsigned int spbrgVal = (unsigned int)((_XTAL_FREQ / (4UL * baud)) - 1);
    SPBRGH = (unsigned char)(spbrgVal >> 8);
    SPBRG  = (unsigned char)(spbrgVal & 0xFF);

    TXSTAbits.SYNC = 0;        // Modo assincrono
    RCSTAbits.SPEN = 1;        // Habilita porta serial
    RCSTAbits.CREN = 1;        // Recepcao continua
    TXSTAbits.TXEN = 1;        // Habilita transmissor

    PIE1bits.RCIE = 1;         // Habilita interrupcao de RX
    INTCONbits.PEIE = 1;       // Habilita perifericos
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

void UART_ISR_Handler(void) {
    if (PIR1bits.RCIF) {
        if (RCSTAbits.OERR) {   // Overrun error recovery
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
