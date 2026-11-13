#ifndef CONFIG_BITS_H
#define CONFIG_BITS_H

/**
 * ==============================================================================
 * BITS DE CONFIGURACAO - PIC18F4620
 * Frequencia: 8.0 MHz Interno
 * Compilador: MPLAB XC8 v2.4x / v3.x
 * ==============================================================================
 */

// CONFIG1H
#pragma config OSC = INTIO67    // Oscilador Interno, pinos RA6 e RA7 como portas digitais
#pragma config FCMEN = OFF      // Fail-Safe Clock Monitor desabilitado
#pragma config IESO = OFF       // Two-Speed Start-up / Internal-External Switchover desabilitado

// CONFIG2L
#pragma config PWRT = ON        // Power-up Timer habilitado
#pragma config BOREN = ON       // Brown-out Reset habilitado
#pragma config BORV = 3         // Tensão mínima do Brown-out Reset

// CONFIG2H
#pragma config WDT = OFF        // Watchdog Timer desabilitado
#pragma config WDTPS = 32768    // Watchdog Timer Postscale

// CONFIG3H
#pragma config CCP2MX = PORTC   // CCP2 multiplexado no pino RC1
#pragma config PBADEN = OFF     // PORTB<4:0> como I/O DIGITAL no Reset (Libera RB0/RB1)
#pragma config LPT1OSC = OFF    // Timer1 Low-Power Oscillator desabilitado
#pragma config MCLRE = ON       // Pino MCLR habilitado

// CONFIG4L
#pragma config STVREN = ON      // Stack Overflow/Underflow Reset habilitado
#pragma config LVP = OFF        // Low-Voltage ICSP desabilitado (Libera pino RB5)
#pragma config XINST = OFF      // Extended Instruction Set desabilitado

#define _XTAL_FREQ 8000000UL    // 8.0 MHz para macros __delay_ms e baud calculations

#endif // CONFIG_BITS_H
