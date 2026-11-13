#include "eeprom.h"

void EEPROM_WriteByte(unsigned int addr, unsigned char data) {
    EEADRH = (unsigned char)(addr >> 8);
    EEADR  = (unsigned char)(addr & 0xFF);
    EEDATA = data;
    EECON1bits.EEPGD = 0;      // Seleciona EEPROM de dados
    EECON1bits.CFGS = 0;
    EECON1bits.WREN = 1;       // Habilita escrita
    
    // Sequencia critica Microchip
    INTCONbits.GIE = 0;
    EECON2 = 0x55;
    EECON2 = 0xAA;
    EECON1bits.WR = 1;
    INTCONbits.GIE = 1;
    
    while (EECON1bits.WR);     // Espera gravacao concluir
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
