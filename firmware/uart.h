#ifndef UART_H
#define UART_H

#include <xc.h>
#include <stdbool.h>

#define RX_BUFFER_SIZE 96

extern volatile char rxBuffer[RX_BUFFER_SIZE];
extern volatile unsigned char rxIndex;
extern volatile bool commandReady;

void UART_Init(unsigned long baud);
void UART_Write(char data);
void UART_WriteString(const char *text);
void UART_ISR_Handler(void);

#endif // UART_H
