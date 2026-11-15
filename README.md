# Illuminat Horizontes

Projeto para o NASA Space Apps Challenge 2026, desafio *"Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars"*.

Comparamos **18 locais da Terra** com **16 alvos na Lua e em Marte** (as regiões candidatas do Artemis III, crateras polares, Marius Hills, Jezero, Gale, Meridiani, Arcadia e Oxia) em **9 dimensões**: terreno, materiais, temperatura, iluminação, água e gelo, poeira e vento, vida, subsolo, e pouso e mobilidade. Cada par recebe uma nota de 0 a 100, o **IAP (Índice de Analogia Planetária)**. Para cada local mostramos onde a analogia funciona, onde ela quebra e o que dá para testar ali com um carrinho de sensores.

O diferencial são os locais brasileiros pouco estudados (Lençóis Maranhenses, Raso da Catarina, Gilbués, Cangalha, Araguainha, Vargeão, Vista Alegre e Carajás), avaliados ao lado dos análogos clássicos (Atacama, Haughton, Mauna Kea, Río Tinto e Vales Secos de McMurdo), que servem para validar o método.

## Como funciona

```
dados NASA e Copernicus ──> dados/essenciais/gerar_dados.py ──> notas (IAP) por local x alvo
                                                                 │
                       ┌─────────────────────────────────────────┼──────────────────────┐
                       v                                         v                      v
               site three.js (web/)                    tela em C (Projeto_C)     mensagens MQTT
                       ^                                         ^
                       └──────────── MQTT ───────────────────────┤
                                                                 │
   sensores -> Arduino -> Bluetooth (HC-05) -> ponte_serial_mqtt.py (no computador)
```

- **Nota:** cada indicador numérico vira `S = exp(−(Terra − alvo)² / (2σ²))`; as tags (geologia, gelo, cavernas) usam Jaccard. A nota da dimensão é a média dos indicadores, e o IAP é a média ponderada das dimensões pelo **perfil de missão** (geral, rover, astrobiologia, gelo/ISRU, base e construção, energia solar).
- **O que sempre quebra:** gravidade, atmosfera, radiação e duração do dia. Isso aparece em todos os locais.

## Resultados

| Posição | Local | IAP | Melhor alvo |
|---|---|---|---|
| 1 | Bacia de Qaidam (China) | 68 | Oxia Planum |
| 2 | Deserto de Lut (Irã) | 66 | Oxia Planum |
| 3 | Atacama (Chile) | 66 | Oxia Planum |
| 4 | Vales Secos de McMurdo (Antártida) | 65 | Pico perto de Cabeus B |
| 7 | **Lençóis Maranhenses (Brasil)** | 55 | Meridiani Planum |

**Validação.** Cada análogo clássico deve ficar bem colocado no alvo que a literatura associa a ele. Entre os 18 locais:

| Referência | Alvo da literatura | Posição |
|---|---|---|
| Haughton | Marte e Lua (Haughton-Mars Project) | 2º |
| Atacama | Marte (solos com perclorato) | 3º |
| Mauna Kea | Lua (testes de ISRU PISCES) | 4º |
| Río Tinto | Meridiani (jarosita e hematita) | 6º |
| Vales Secos de McMurdo | Marte (deserto frio, permafrost) | 6º |

Os locais novos que aparecem ao lado deles, como Lençóis, ganham credibilidade.

## Dados

Só fontes da NASA e do Copernicus. Todo valor leva **status** (medido, calculado, referência ou provisório) e **fonte** (produto, versão, DOI, resolução e data de acesso), em `dados/essenciais/entrada/fontes.csv`.

| Dado | Fonte |
|---|---|
| Relevo | NASA SRTMGL30 v002; na Antártida, Copernicus DEM GLO-90 |
| Temperatura da superfície (dia e noite) | NASA MYD11A2 v061 (Aqua, 1 km), pelo ORNL DAAC |
| Temperatura do ar, chuva, poeira (AOD), vento, albedo | NASA POWER (MERRA-2, CERES), 2001–2025 |
| Vegetação (NDVI) | NASA MOD13C2 v061 |
| Iluminação | geometria solar; na Lua, iluminação com relevo do LRO LOLA |
| Lua e Marte | LRO LOLA e Diviner, MGS MOLA e TES, MRO CRISM, Mars 2020 MEDA, MSL REMS |

Limitações que dizemos na apresentação: a temperatura do ar e o albedo vêm de células de ~50 km (o Mauna Kea fica mais quente que o cume); as coordenadas das regiões do Artemis III estão aproximadas (±1°); a pressão de Marte é a mesma nos cinco alvos.

## Partes do projeto

| Pasta | O que tem | Como usar |
|---|---|---|
| `dados/essenciais/` | dados de entrada, `gerar_dados.py` e as saídas (`analogos_completo.json`, CSVs, MQTT) | [dados/essenciais/README.md](dados/essenciais/README.md) |
| `web/` | site three.js em inglês (prévia na branch `gh-pages`) | [web/README.md](web/README.md) |
| `Projeto_C/NasaSpace/` | tela em C: Lua/Marte → alvo → top 3 → tela do local → MQTT → carrinho ao vivo | abrir `NasaSpace.cbp` no Code::Blocks |
| `firmware/` | sketch do Arduino, ponte USB/Bluetooth → MQTT e ESP32 opcional | [firmware/README.md](firmware/README.md) |
| `docs/` | plano completo (escopo, fontes, métrica, cronograma) | [docs/plano-gemeo-digital-analogos.md](docs/plano-gemeo-digital-analogos.md) |

### Tela em C

1. O usuário escolhe Lua ou Marte, depois o alvo, e vê os 3 locais da Terra mais parecidos.
2. A tela do local mostra três tabelas: **Terra x alvo**, as **9 dimensões** e o **carrinho ao vivo** (cada sensor ao lado do valor do local e do alvo, com o jeito certo de comparar).
3. A escolha vai por MQTT para `illuminat-horizontes/selecao`, a ponte do carrinho liga pelo Bluetooth e a tela passa a mostrar as leituras na coluna "Agora".

Precisa do Mosquitto (`mosquitto_pub` e `mosquitto_sub`) no PATH e de `pip install pyserial paho-mqtt` para a ponte. A porta Bluetooth vai como argumento: `NasaSpace COM7` no Windows ou `./NasaSpace /dev/cu.HC-05` no Mac.

### Carrinho

Os sensores ficam num **Arduino Uno/Nano**, que manda uma linha JSON por segundo:

```
{"temp":24.1,"uv":6.2,"pm25":14,"solar":410,"soil":22,"tilt":3.4,"vib":0.08,"slip":5}
```

A linha sai pelo USB e por um **HC-05** (Bluetooth) ao mesmo tempo. No computador, `firmware/ponte_serial_mqtt.py` publica as leituras em `illuminat-horizontes/carrinho`, e o site e a tela em C assinam esse tópico. Sem carrinho, o site tem um modo Demo.

## Regenerar os dados

```
pip3 install numpy
python3 dados/essenciais/gerar_dados.py          # notas a partir de dados/essenciais/entrada/
python3 dados/essenciais/gerar_mqtt.py           # mensagens MQTT por local
python3 web/tools/gerar_dados_site.py            # dados do site, em inglês
```

Os scripts que baixam dados (NASA POWER, MOD13C2, Copernicus DEM, MODIS pelo ORNL e AppEEARS) estão descritos em [dados/essenciais/README.md](dados/essenciais/README.md).
