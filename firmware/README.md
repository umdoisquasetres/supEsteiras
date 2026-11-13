# Firmware supEsteiras - PIC18F4620 @ 8MHz Interno (MPLAB X 6.20 / XC8)

Controle de malha fechada (PI/PID) para sincronismo de duas esteiras industriais utilizando microcontrolador **Microchip PIC18F4620**.

## 1. Características Técnicas
- **Microcontrolador**: PIC18F4620 (DIP-40 ou TQFP-44)
- **Frequência de Clock**: 8.0 MHz utilizando o oscilador interno (HFINTOSC, sem necessidade de cristal externo)
- **Compilador**: Microchip MPLAB XC8 (v2.40 ou superior, padrão C99)
- **IDE**: MPLAB X IDE v6.20
- **Comunicação Serial**: UART 9600 bps, 8 bits de dados, 1 stop bit, sem paridade (Pinos RC6/TX e RC7/RX)
- **Saídas de Controle para Inversores**: PWM 4 kHz nos canais CCP1 (RC2) e CCP2 (RC1), convertidos para 0-10V DC por filtro RC e AmpOp LM358
- **Entradas dos Sensores de Volta**:
  - Sensor Esteira 1: Pino RB0 / INT0 (Interrupção Externa 0)
  - Sensor Esteira 2: Pino RB1 / INT1 (Interrupção Externa 1)
- **Persistência**: Memória EEPROM interna (armazena Kp, Ki, Kd, tensões base, tolerância e nome do dispositivo)

---

## 2. Pinagem no PIC18F4620 (DIP-40)

| Pino | Nome | Função | Conexão Externa |
|---|---|---|---|
| **1** | MCLR/VPP | Master Clear / Reset | Resistor pull-up 10kΩ ao +5V (com botão para GND) |
| **11** | VDD | Alimentação positiva (+5V) | Fonte estabilizada 5V DC |
| **12** | VSS | Terra (GND) | GND geral da fonte e dos inversores |
| **31** | VSS | Terra (GND) | GND |
| **32** | VDD | Alimentação (+5V) | +5V DC |
| **33** | RB0 / INT0 | Sensor Esteira 1 | Pulso de 1 volta da Esteira Mestra (5V TTL) |
| **34** | RB1 / INT1 | Sensor Esteira 2 | Pulso de 1 volta da Esteira Seguidora (5V TTL) |
| **35** | RB2 | Alarme Sonoro | Buzzer ou relé de sinalização de desalinhamento |
| **17** | RC2 / CCP1 | Saída Analógica Inversor 1 | Filtro RC -> AmpOp LM358 -> Entrada 0-10V Inversor 1 |
| **16** | RC1 / CCP2 | Saída Analógica Inversor 2 | Filtro RC -> AmpOp LM358 -> Entrada 0-10V Inversor 2 |
| **25** | RC6 / TX | Transmissão UART | RX do conversor USB-Serial (FT232 / CH340 / CP2102) |
| **26** | RC7 / RX | Recepção UART | TX do conversor USB-Serial |

---

## 3. Circuito Conversor PWM para 0-10V (Referência do Inversor)
Cada pino PWM (RC1 e RC2) fornece uma onda quadrada de 0 a 5V a 4kHz.
Para converter em sinal analógico contínuo de 0 a 10V para o inversor de frequência:
1. **Filtro Passa-Baixa RC**:
   - Resistor de 10 kΩ em série com o pino CCP.
   - Capacitor eletrolítico ou cerâmico de 10 µF entre o nó do resistor e o GND.
   - *Tensão no capacitor: 0.0V a 5.0V DC proporcionais ao Duty Cycle.*
2. **Amplificador Não-Inversor (Ganho = 2x)**:
   - Amplificador operacional LM358 (alimentado com 12V ou 24V da fonte do painel).
   - Entrada não-inversora (+) conectada ao capacitor do filtro RC.
   - Resistor de realimentação de 10 kΩ entre a saída e a entrada inversora (-).
   - Resistor de 10 kΩ entre a entrada inversora (-) e o GND.
   - *Saída: 0.0V a 10.0V DC limpa e de baixa impedância conectada ao borne de entrada analógica (AI1) do inversor de frequência.*

---

## 4. Como Abrir e Compilar no MPLAB X IDE v6.20

### Opção A: Versão Modular
Adicione ao seu projeto os arquivos:
- `config_bits.h`
- `uart.h` e `uart.c`
- `pwm.h` e `pwm.c`
- `sync_control.h` e `sync_control.c`
- `eeprom.h` e `eeprom.c`
- `main.c`

### Opção B: Versão em Arquivo Único (Monolítica)
Crie um novo projeto para **PIC18F4620** com compilador **XC8**, crie um arquivo `main.c` e copie o conteúdo de `sup_esteiras_pic18f4620.c`.

Pressione **Clean and Build** (`F11`) para compilar. O arquivo `.hex` será gerado em `dist/default/production/`.

---

## 5. Tabela de Comandos Serial (9600 bps)

| Comando | Resposta | Ação |
|---|---|---|
| `PING\n` | `PONG (PIC18F4620 ONLINE)\n` | Verifica comunicação serial |
| `STATUS\n` | `STATUS:RPM1=...;LAPS1=...;DELTA=...` | Retorna telemetria completa em tempo real |
| `ZERO_LAPS\n` | `OK ZERO_LAPS\n` | Zera os contadores de voltas e reinicia erro integral |
| `START\n` | `OK START\n` | Inicia operação em malha fechada `AUTO_SYNC` |
| `STOP\n` | `OK STOP\n` | Para as esteiras (tensão dos inversores em 0V) |
| `GET_ALL\n` | `CFG:NAME=...;KP=...;KI=...` | Retorna todas as variáveis salvas na memória |
| `SET KP=1.20\n` | `OK SET KP=1.20\n` | Ajusta o ganho proporcional na RAM |
| `SET BASE_V1=6.0\n`| `OK SET BASE_V1=6.0\n` | Altera a velocidade base da Esteira 1 |
| `SAVE\n` | `OK SAVED\n` | Grava os valores atuais na memória EEPROM interna |
| `RESET\n` | `OK RESET\n` | Restaura parâmetros de calibração padrão de fábrica |
