# Firmware do carrinho

Dois caminhos levam os dados do carrinho até a seção "Field rover" do site. Os dois usam a mesma mensagem: uma linha JSON por leitura.

```
{"temp":24.1,"uv":6.2,"pm25":14,"solar":410,"soil":22,"tilt":3.4,"vib":0.08,"slip":5}
```

| Chave | Medida | Unidade |
|---|---|---|
| temp | temperatura do ar | °C |
| uv | índice UV | – |
| pm25 | poeira PM2.5 | µg/m³ |
| solar | potência do painel solar | mW |
| soil | umidade do solo | % |
| tilt | inclinação do carrinho | ° |
| vib | vibração | g |
| slip | patinagem das rodas | % |

Pode mandar só as chaves que tiver; as outras aparecem como "–".

O carrinho usa um **Arduino** (Uno/Nano) para os sensores, e o Arduino manda uma linha por segundo pela USB. No começo do `arduino_carrinho.ino`, escolha os sensores que você ligou (`TEMP_SENSOR` LM35/DHT22/DS18B20, `USAR_PMS5003`, `USAR_PATINAGEM` etc.). Os desligados não entram na linha.

1. **MQTT pelo computador (principal):** grave `arduino_carrinho` no Arduino, ligue na USB e rode `python3 firmware/ponte_serial_mqtt.py --local lencois` (antes, `pip install pyserial paho-mqtt`). A ponte publica cada linha em `illuminat-horizontes/carrinho` e o perfil do local, retido, em `illuminat-horizontes/local`. Clique em **Wi-Fi** no site e em **Connect**. Feche o Monitor Serial da IDE antes, porque só um programa abre a porta.
2. **USB direto no site:** grave `arduino_carrinho` no Arduino, ligue no computador e clique em **USB** no site (Chrome ou Edge, 115200 baud).
3. **Bluetooth pelo computador:** ligue um HC-05/HC-06 na Serial de hardware do Arduino (ligação no topo do `arduino_carrinho.ino`) e mude o módulo para 115200 com `AT+UART=115200,0,0`. Pareie com o computador (PIN `1234` ou `0000`): ele vira uma porta serial (`/dev/cu.HC-05` no Mac; no Windows, a COM de "Saída"). Rode a ponte com essa porta: `python3 firmware/ponte_serial_mqtt.py --porta /dev/cu.HC-05 --local lencois`. O seletor em C (`Projeto_C/Seletor`) faz isso sozinho depois da escolha.
4. **Wi-Fi sem computador:** grave `arduino_carrinho` no Arduino e `esp32_ponte_mqtt` no ESP32, que só faz a ponte (preencha a rede Wi-Fi). Clique em **Wi-Fi** no site e em **Connect**. O broker e o tópico precisam ser iguais nos dois lados.

Para um broker com senha (HiveMQ Cloud), a ponte aceita `--broker`, `--porta-mqtt 8883 --tls` e `--usuario`, e a senha vai na variável `MQTT_SENHA`.

O broker público da HiveMQ é aberto: qualquer um que souber o tópico consegue ler e publicar. Para a apresentação, troque o tópico por um nome só da equipe, ou use um broker HiveMQ Cloud com usuário e senha.

Sem carrinho ligado, o site mostra o modo **Demo**, com leituras simuladas e uma tempestade de poeira a cada minuto.
