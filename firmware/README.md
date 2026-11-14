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

1. **USB:** grave `arduino_carrinho` no Arduino, ligue no computador e clique em **USB** no site (Chrome ou Edge, 115200 baud).
2. **Wi-Fi:** grave `arduino_carrinho` no Arduino e `esp32_ponte_mqtt` no ESP32 (preencha a rede Wi-Fi). Clique em **Wi-Fi** no site e em **Connect**. O broker e o tópico precisam ser iguais nos dois lados.

O broker público da HiveMQ é aberto: qualquer um que souber o tópico consegue ler e publicar. Para a apresentação, troque o tópico por um nome só da equipe, ou use um broker HiveMQ Cloud com usuário e senha.

Sem carrinho ligado, o site mostra o modo **Demo**, com leituras simuladas e uma tempestade de poeira a cada minuto.
