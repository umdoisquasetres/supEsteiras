# supEsteiras ⚡ Supervisório & Sincronismo de Esteiras (PIC18F4620)

Aplicação web moderna para parametrização, sintonia em tempo real e supervisão de sincronismo entre duas esteiras industriais utilizando o microcontrolador **Microchip PIC18F4620** a **8.0 MHz (Oscilador Interno)** com **MPLAB X IDE v6.20** e compilador **MPLAB XC8**.

---

## 🚀 Arquitetura do Sistema

1. **Microcontrolador**:
   - **PIC18F4620** operando a **8.0 MHz** através do oscilador interno (HFINTOSC, `#pragma config OSC = INTIO67`), dispensando cristal externo e liberando os pinos RA6/RA7.
2. **Sensores de Volta (1 pulso por volta completa)**:
   - **Sensor Esteira 1 (Mestra)**: Conectado ao pino **RB0 (INT0)** por interrupção externa por borda de descida.
   - **Sensor Esteira 2 (Sincronizada)**: Conectado ao pino **RB1 (INT1)** por interrupção externa por borda de descida.
   - O firmware contabiliza as voltas totais de cada esteira e calcula o RPM instantâneo medindo o tempo decorrido entre os pulsos de volta.
3. **Controle de Tensão dos Inversores (0 a 10V DC via PWM)**:
   - Dois canais PWM a 4.0 kHz gerados pelos módulos CCP1 e CCP2 via Timer 2:
     - **Canal PWM 1 (Pino RC2 / CCP1)**: Tensão de referência analógica para o Inversor 1.
     - **Canal PWM 2 (Pino RC1 / CCP2)**: Tensão de referência analógica para o Inversor 2.
   - Um filtro passa-baixa RC (10kΩ + 10µF) seguido de um amplificador operacional LM358 com ganho de 2x converte a onda PWM de 0-5V em uma tensão analógica contínua limpa de 0.0V a 10.0V DC.
4. **Algoritmo de Sincronismo em Malha Fechada (PI / PID)**:
   - A Esteira 1 opera na velocidade base selecionada.
   - O controlador calcula o erro de fase `Delta = Voltas1 - Voltas2`.
   - Se a Esteira 2 atrasar (`Delta > 0`), o controlador aplica um incremento de tensão proporcional e integral para acelerá-la temporariamente até o alinhamento perfeito.
   - Se a Esteira 2 adiantar (`Delta < 0`), a tensão é reduzida proporcionalmente.
   - Constantes de sintonia (Kp, Ki, Kd, tolerância e saturação máxima) podem ser ajustadas em tempo real via serial e gravadas permanentemente na **EEPROM interna**.

---

## 💻 Interface Web (Web Serial API)

- **Conexão Direta via USB-Serial**: Comunica-se diretamente com o conversor USB-Serial (FT232, CH340, CP2102) através do navegador (Chrome, Edge, Opera) a 9600 bps.
- **Modo Simulação em Tempo Real**: Permite testar o comportamento da física das esteiras, rotações, contagem de voltas e resposta do algoritmo PI sem necessidade de hardware físico conectado.
- **Painel de Telemetria Dinâmico**:
  - Velocidade em RPM e voltas acumuladas de ambas as esteiras.
  - Tensão enviada a cada inversor (0-10V) e Duty Cycle correspondente.
  - Indicador visual e barra de alinhamento com tolerância segura e alarme de desalinhamento.
  - Botão de ação rápida para **Zerar Contagem de Voltas (ZERO_LAPS)**.
  - Botão de partida/parada segura (**START / STOP**).
- **Editor de Parâmetros**:
  - Ajuste de RPM alvo e tensões nominais dos inversores.
  - Ganhos do controlador: **Kp** (Proporcional), **Ki** (Integral), **Kd** (Derivativo).
  - Janela de tolerância de sincronismo (voltas) e saturação de correção (± Volts).
  - Ações para **Ler do PIC**, **Aplicar na RAM**, **Gravar na EEPROM** e **Restaurar Padrões**.
- **Terminal Serial Integrado**:
  - Histórico de comandos com suporte às setas Cima/Baixo.
  - Comandos rápidos e logs coloridos com exportação para `.txt`.
- **Código C e Esquema Elétrico Integrados**:
  - Modal com o código C completo pronto para compilar no MPLAB X 6.20, esquemático de ligação e instruções detalhadas.

---

## 🔌 Esquema de Ligações no PIC18F4620

```text
               +-----------------------------------------+
               |          PIC18F4620 (8MHz Interno)      |
               +-----------------------------------------+

 [ ALIMENTAÇÃO ]
   Pinos 11 e 32 (VDD) ------------> +5V DC
   Pinos 12 e 31 (VSS) ------------> GND Geral
   Pino 1 (MCLR) ------------------> Resistor pull-up 10kΩ ao +5V

 [ SENSORES DE VOLTA ]
   Sensor Esteira 1 (Mestra) ------> Pino 33 (RB0 / INT0)  [Interrupção Externa 0]
   Sensor Esteira 2 (Seguidora) ---> Pino 34 (RB1 / INT1)  [Interrupção Externa 1]
   *(Usar optoacoplador se o sensor industrial for 24V)*

 [ SAÍDAS ANALÓGICAS PARA INVERSORES (0 a 10V) ]
   Pino 17 (RC2 / CCP1) ---> [ Filtro RC 10k/10uF ] ---> [ LM358 Ganho 2x ] ---> Entrada AI1 Inversor 1 (0-10V)
   Pino 16 (RC1 / CCP2) ---> [ Filtro RC 10k/10uF ] ---> [ LM358 Ganho 2x ] ---> Entrada AI1 Inversor 2 (0-10V)

 [ COMUNICAÇÃO SERIAL UART ]
   Pino 25 (RC6 / TX) -------------> RX do Conversor USB-Serial
   Pino 26 (RC7 / RX) <------------- TX do Conversor USB-Serial
   GND ----------------------------> GND do Conversor USB-Serial

 [ SINALIZAÇÃO DE ALARME ]
   Pino 35 (RB2) ------------------> Transistor BC548 / Buzzer 5V ou Relé de Alarme
```

---

## 📁 Estrutura do Firmware (`firmware/`)

A pasta `firmware/` contém o projeto completo para **MPLAB X IDE v6.20**:
- `config_bits.h`: Bits de configuração para o PIC18F4620 com oscilador interno 8MHz (`INTIO67`) e `PBADEN = OFF`.
- `uart.h` / `uart.c`: Driver UART a 9600 bps com buffer circular por interrupção.
- `pwm.h` / `pwm.c`: Controle PWM de 4kHz nos módulos CCP1 (RC2) e CCP2 (RC1) mapeados em 0-10V.
- `sync_control.h` / `sync_control.c`: Algoritmo de malha fechada PI/PID, cálculo de RPM e medição de voltas.
- `eeprom.h` / `eeprom.c`: Leitura e gravação não-volátil dos parâmetros de calibração.
- `main.c`: Ponto de entrada e rotina de interrupção unificada.
- `sup_esteiras_pic18f4620.c`: Versão completa monolítica em arquivo único para compilação imediata.

---

## 🛠️ Como Executar a Aplicação Web

```bash
# Instalar dependências
npm install

# Iniciar servidor local
npm run dev

# Gerar build de produção
npm run build
```
