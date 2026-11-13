#ifndef EEPROM_H
#define EEPROM_H

#include <xc.h>

#define EEPROM_MAGIC_KEY 0x5A42
#define EEPROM_ADDR_MAGIC 0x00
#define EEPROM_ADDR_DATA  0x04

void EEPROM_WriteByte(unsigned int addr, unsigned char data);
unsigned char EEPROM_ReadByte(unsigned int addr);

#endif // EEPROM_H
