#include "pwm.h"
#include "config_bits.h"

float currentVolt1 = 5.0f;
float currentVolt2 = 5.0f;

void PWM_Init_4kHz(void) {
    // Frequencia PWM = 4.0 kHz a Fosc = 8 MHz (Timer2 Prescaler = 4)
    // PR2 = [Fosc / (4 * Fpwm * Prescaler)] - 1 = [8000000 / (4 * 4000 * 4)] - 1 = 124
    PR2 = 124;
    
    // Resolucao Maxima = 10-bit (0 a 500 counts)
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

    // Converte 0.0V - 10.0V para Duty Cycle de 0 a 500 counts
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
