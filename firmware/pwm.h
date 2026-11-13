#ifndef PWM_H
#define PWM_H

#include <xc.h>

void PWM_Init_4kHz(void);
void PWM1_SetVoltage(float volts);
void PWM2_SetVoltage(float volts);

extern float currentVolt1;
extern float currentVolt2;

#endif // PWM_H
