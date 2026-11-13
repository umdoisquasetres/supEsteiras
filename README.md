# PIC Serial Configurator Pro ⚡

Aplicação web moderna para configuração, parametrização e monitoramento em tempo real de microcontroladores **Microchip PIC** (PIC16F, PIC18F, PIC24, dsPIC) através da **Web Serial API** do navegador.

---

## 🚀 Funcionalidades

1. **Comunicação Serial Direta no Navegador (Web Serial API)**:
   - Conexão nativa com chips conversores USB-Serial (FT232, CH340, CP2102, PL2303) e portas COM virtuais CDC.
   - Suporte a diversas taxas de transmissão: 2400, 9600, 19200, 38400, 57600 e 115200 bps.
   - Detecção automática de compatibilidade do navegador (Google Chrome, Microsoft Edge, Opera).

2. **Modo Simulação Integrado**:
   - Permite testar toda a interface, envio/recebimento de comandos, alteração de parâmetros e gravação na EEPROM mesmo sem o PIC físico conectado no momento.

3. **Editor de Parâmetros Completo**:
   - **Identificação & Operação**: Nome do Dispositivo, Modo Operacional (`AUTO`, `MANUAL`, `ECO`, `CALIBRATION`) e Taxa de Amostragem.
   - **Comunicação**: Seleção da taxa de transmissão UART.
   - **Sensores & Alarmes**: Offset de calibração térmica, limites de alarme mínimo/máximo e controle de buzzer.
   - **Controle de Saídas**: Acionamento direto de Relé 1 e Relé 2, e ajuste de duty cycle PWM (0 a 100%).
   - **Campos Customizados**: Criação e envio dinâmico de novas variáveis chave=valor para o firmware.
   - **Dirty Tracking**: Destaca valores modificados pendentes de envio.
   - **Ações Rápidas**:
     - `Ler do PIC (GET_ALL)`
     - `Aplicar na RAM (SET)`
     - `Gravar na EEPROM (SAVE)`
     - `Restaurar Padrão de Fábrica (RESET)`

4. **Telemetria & Diagnóstico em Tempo Real**:
   - Monitor de Temperatura com indicação de faixa segura e alertas visuais.
   - Monitor de Tensão de Alimentação (VCC).
   - Tempo de atividade ininterrupta (*Uptime*) do microcontrolador.
   - Polling automático e manual sob demanda.

5. **Terminal Serial Interativo**:
   - Visualizador de pacotes com timestamps e tags coloridas (`TX`, `RX`, `INFO`, `ERROR`, `SUCCESS`).
   - Linha de comando com histórico navegável pelas teclas **Seta para Cima / Seta para Baixo**.
   - Botões de atalho para comandos frequentes (`PING`, `GET_ALL`, `STATUS`, `SAVE`, `RESET`, `HELP`).
   - Opções para pausar auto-scroll, copiar logs ou exportar para arquivo `.txt`.

6. **Firmware C Pronto para Compilar (MPLAB XC8)**:
   - Código-fonte em C completo para microcontroladores PIC (PIC16F877A, PIC18F4550, PIC18F25K22, etc.).
   - Rotina de interrupção de recepção serial com buffer circular/linha.
   - Parser dos comandos ASCII e gravação na memória EEPROM interna do microcontrolador.
   - Guia de ligação de pinos (TX -> RX, RX -> TX, GND compartilhado, níveis 5V/3.3V).

---

## 🛠️ Como Executar

### Pré-requisitos
- Node.js (versão 18 ou superior)
- Navegador compatível com Web Serial (Google Chrome, Microsoft Edge, Opera, Brave)

### Passos
```bash
# 1. Instalar dependências (já instaladas)
npm install

# 2. Iniciar o servidor de desenvolvimento local
npm run dev

# 3. Gerar build de produção
npm run build
```

Abra a URL exibida no terminal (normalmente `http://localhost:5173`).

---

## 🔌 Esquema de Ligação de Hardware

```text
[ COMPUTADOR ] <====== USB ======> [ CONVERSOR USB-SERIAL ]
                                      Pino TXD --------> Pino RX do PIC (RC7 no PIC16F/18F)
                                      Pino RXD <-------- Pino TX do PIC (RC6 no PIC16F/18F)
                                      Pino GND --------- Pino GND (VSS) do PIC
                                      Pino 5V  --------- Pino VDD (opcional)
```

> **Atenção aos Níveis de Tensão:** Verifique a tensão de operação do seu PIC. Se for 5V, certifique-se de que o jumper do conversor USB-Serial está em 5V. Para PICs de 3.3V, use nível lógico de 3.3V.

---

## 📑 Protocolo de Comandos Serial (ASCII)

Todos os comandos são transmitidos em texto ASCII finalizados por `\n`:

| Comando | Resposta do PIC | Descrição |
| :--- | :--- | :--- |
| `PING\n` | `PONG\n` | Testa se o PIC está respondendo na porta serial. |
| `GET_ALL\n` | `CFG:NAME=...;BAUD=...;...\n` | Solicita todas as configurações ativas do PIC. |
| `SET <CHAVE>=<VALOR>\n` | `OK SET <CHAVE>=<VALOR>\n` | Atualiza uma variável na RAM do PIC (ex: `SET RELAY1=1`). |
| `SAVE\n` | `OK SAVED\n` | Grava as configurações da RAM na EEPROM interna não-volátil. |
| `RESET\n` | `OK RESET\n` | Restaura os parâmetros de fábrica no firmware. |
| `STATUS\n` | `STATUS:TEMP=24.5;VCC=5.01;...\n` | Retorna leituras analógicas e telemetria atual. |
