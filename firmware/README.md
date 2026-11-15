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

A ponte também entende o texto do sketch de teste da equipe (9600 baud), uma linha por sensor:

```
Umidade: 52.30%  |  Temperatura: 28.40°C
Distancia: 23 cm
Luminosidade (LDR): 548
```

Cada ciclo vira `{"umid":52.3,"temp":28.4,"dist":23,"luz":548}` (umidade do ar em %, distância do obstáculo em cm, LDR de 0 a 1023). Rode com `--baud 9600`.

O ESP32 e o Bluetooth não são usados no projeto: o carrinho fala com o computador **só pelo cabo USB**.

## Carrinho com motores (`carrinho_motores/`)

O sketch principal agora é `carrinho_motores/carrinho_motores.ino` (Arduino Uno): ponte H com dois motores andando juntos e os sensores (DHT no D6, HC-SR04 TRIG D4/ECHO D5, LDR no A0). As ligações estão no topo do arquivo.

- **Comandos** (uma letra pelo cabo): `F` frente, `T` trás, `P` parar, `0`–`9` velocidade, `?` estado, `L`/`R` testam um motor de cada vez. Sem comando por 1,5 s, os motores param.
- **Sensores:** uma linha por segundo, `{"temp":27.2,"umid":52.9,"dist":33,"luz":354}`, que a ponte MQTT e a tela em C entendem.
- **`controle_carrinho.py`:** manda as teclas para o Arduino e repete o comando enquanto o carrinho anda; a tela em C (opção 1 do menu) usa ele e mostra os sensores ao vivo. Ele também publica as linhas de sensores no MQTT (`illuminat-horizontes/carrinho`, com `--local <id>` o perfil retido), para o site mostrar o mesmo; `--sem-mqtt` desliga.
- **Gravar:** nada ligado no D0. `arduino-cli upload -p /dev/cu.usbserial-21130 --fqbn arduino:avr:uno firmware/carrinho_motores`.

**Instalar no Mac (Python do Homebrew):** `pip3 install` dá erro `externally-managed-environment`. Use
`python3 -m pip install --user --break-system-packages pyserial paho-mqtt` (instala só para o seu usuário, sem mexer no Homebrew).

O carrinho usa um **Arduino** (Uno/Nano) para os sensores, e o Arduino manda uma linha por segundo pela USB. No começo do `arduino_carrinho.ino`, escolha os sensores que você ligou (`TEMP_SENSOR` LM35/DHT22/DS18B20, `USAR_PMS5003`, `USAR_PATINAGEM` etc.). Os desligados não entram na linha.

1. **MQTT pelo computador (principal):** grave `arduino_carrinho` no Arduino, ligue na USB e rode `python3 firmware/ponte_serial_mqtt.py --local lencois` (antes, `pip install pyserial paho-mqtt`). A ponte publica cada linha em `illuminat-horizontes/carrinho` e o perfil do local, retido, em `illuminat-horizontes/local`. Clique em **Wi-Fi** no site e em **Connect**. Feche o Monitor Serial da IDE antes, porque só um programa abre a porta.
2. **USB direto no site:** grave `arduino_carrinho` no Arduino, ligue no computador e clique em **USB** no site (Chrome ou Edge, 115200 baud).
3. **Bluetooth pelo computador:** ligue um HC-05/HC-06 na Serial de hardware do Arduino (ligação no topo do `arduino_carrinho.ino`) e mude o módulo para 115200 com `AT+UART=115200,0,0`. Pareie com o computador (PIN `1234` ou `0000`): ele vira uma porta serial (`/dev/cu.HC-05` no Mac; no Windows, a COM de "Saída"). Rode a ponte com essa porta: `python3 firmware/ponte_serial_mqtt.py --porta /dev/cu.HC-05 --local lencois`. A tela em C (`Projeto_C/NasaSpace`) faz isso sozinho depois da escolha.

Para um broker com senha (HiveMQ Cloud), a ponte aceita `--broker`, `--porta-mqtt 8883 --tls` e `--usuario`, e a senha vai na variável `MQTT_SENHA`.

O broker público da HiveMQ é aberto: qualquer um que souber o tópico consegue ler e publicar. Para a apresentação, troque o tópico por um nome só da equipe, ou use um broker HiveMQ Cloud com usuário e senha.

Sem carrinho ligado, o site mostra o modo **Demo**, com leituras simuladas e uma tempestade de poeira a cada minuto.
