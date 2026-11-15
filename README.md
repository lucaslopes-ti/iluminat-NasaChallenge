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

## Dados usados (para os slides)

Só fontes da NASA e do Copernicus; os valores de Lua e Marte vêm de missões da NASA, com dois casos da ESA e da JAXA citados como referência. Todo valor leva **status** e **fonte** (produto, versão, DOI, resolução e data de acesso), em `dados/essenciais/entrada/fontes.csv`.

**Em números:** 18 locais × 16 alvos = **288 comparações**. São 800 valores: 468 da Terra (305 medidos por satélite ou modelo, 126 calculados por física, 36 de referência, 1 provisório) e 332 da Lua e de Marte (247 publicados por missões, 85 calculados). Além disso, 167 tags de geologia, gelo, subsolo e vida, com 25 referências bibliográficas.

### Terra: medido por satélite e modelo

| Dado | Produto (versão) | Missão / fonte | Resolução | Período | DOI ou referência |
|---|---|---|---|---|---|
| Relevo: altitude, desnível, declividade, rugosidade, área plana | SRTMGL30 v002 | NASA SRTM (LP DAAC) | 30" (~1 km) | 2000 | doi:10.5067/MEaSUREs/SRTM/SRTMGL30.002 |
| Relevo da Antártida (Dry Valleys) | Copernicus DEM GLO-90 | ESA / Copernicus (TanDEM-X) | 90 m, agregado para ~1 km | 2011–2015 | doi:10.5270/ESA-c5d3d65 |
| Temperatura da superfície de dia (~13:30) e de noite (~01:30) | MYD11A2 v061 | NASA Aqua MODIS (recorte do ORNL DAAC) | 1 km, 8 dias | 2024 (46 compostos) | doi:10.5067/MODIS/MYD11A2.061 |
| Vegetação (NDVI) | MOD13C2 v061 | NASA Terra MODIS (LP DAAC) | 0,05° (~5 km), mensal | 2020–2025 (72 meses) | doi:10.5067/MODIS/MOD13C2.061 |
| Temperatura do ar a 2 m, chuva, poeira (AOD 550 nm), vento, albedo, temperatura média da superfície | NASA POWER v2.10.1 (T2M, T2M_RANGE, PRECTOTCORR, AOD_55, WS10M, ALLSKY_SRF_ALB, TS) | NASA Langley (MERRA-2 e CERES) | 0,5° × 0,625° | médias 2001–2025 | power.larc.nasa.gov |

### Lua e Marte: valores publicados por missões

| Missão / instrumento | O que entrou | Referência |
|---|---|---|
| LRO LOLA (laser altímetro) | relevo, declividade e **iluminação com relevo** dos alvos polares | Zuber et al. 2012, *Nature*; Mazarico et al. 2011, *Icarus* |
| LRO Diviner (radiômetro) | temperatura da superfície da Lua | Paige et al. 2010, *Science* |
| MGS MOLA (laser altímetro) | relevo e declividade de Marte; altitude de cada alvo para a pressão (MEGDR, 4 pixels/grau) | Smith et al. 2001, *JGR* |
| MGS TES | albedo de Marte | Christensen et al. 2001, *JGR* |
| Mars 2020 MEDA e câmeras | temperatura em Jezero; pressão de 625 a 761 Pa (média diária) em Jezero, base da pressão dos alvos de Marte; opacidade da poeira | Rodríguez-Manfredi et al. 2023, *Nat. Geosci.*; Sánchez-Lavega et al. 2023, *JGR Planets*; Lemmon et al. 2022, *GRL* |
| MSL REMS | temperatura e poeira em Gale | Gómez-Elvira et al. 2012, *Space Sci. Rev.* |
| MER Mini-TES | temperatura em Meridiani | Smith et al. 2006, *JGR* |
| MRO MCS | temperatura em Arcadia e Oxia | Kleinböhl et al. 2009, *JGR* |
| SELENE/Kaguya TC (JAXA) | profundidade do fosso de Marius Hills | Haruyama et al. 2009, *GRL* |

### Contexto e tags (geologia, gelo, subsolo)

| Fonte | Para quê |
|---|---|
| NASA, regiões candidatas do Artemis III (out/2024); Gazetteer of Planetary Nomenclature (USGS/IAU); LPSC 2025 (Mahanti et al., Sánchez-Lozano et al., Samaddar et al.); mosaicos NAC da LROC | os 9 alvos lunares de pouso e as coordenadas deles |
| LRO LAMP e LEND; LCROSS | gelo nas crateras em sombra permanente (Cabeus) |
| LRO LROC | imagens e geologia lunar |
| MRO CRISM | minerais hidratados em Marte (Jezero, Meridiani, Oxia) |
| NASA SWIM v2 e MRO SHARAD | gelo raso em Arcadia Planitia |
| ESA ExoMars | escolha de Oxia Planum |
| Artigos de campo dos análogos (Haughton-Mars Project, PISCES, Navarro-González et al. 2003, Fernández-Remolar et al. 2005, Doran et al.) | tags dos locais da Terra e o alvo da literatura usado na validação |

### Calculado por física

- **Geometria solar:** altura máxima do Sol, Sol baixo, dias com Sol 24 h, noite polar, Sol no topo da atmosfera e tempo com Sol, pela latitude e pela obliquidade (Terra 23,44°, Marte 25,19°, Lua 1,54°).
- **Pressão do ar na Terra:** pela altitude (atmosfera padrão).
- **Gravidade e duração do dia:** NASA Planetary Fact Sheets.

### Imagens do site

NASA Blue Marble (Terra), NASA SVS CGI Moon Kit (mosaico de cor do LRO LROC, com relevo do LOLA), NASA 3D Resources (Marte, Viking/MGS) e relevo da Terra do SRTM30. Créditos completos em [web/README.md](web/README.md).

### Limitações que dizemos na apresentação

- A temperatura do ar, o albedo, a chuva e a poeira vêm de células de ~50 km da NASA POWER. No Mauna Kea, o ar fica uns 20 °C acima do cume.
- As regiões do Artemis III foram conferidas com o Gazetteer de nomenclatura planetária (USGS/IAU) e com resumos do LPSC 2025. Duas usam locais de pouso publicados e Peak near Cabeus B usa o mosaico da LROC feito para a região; as outras ficam na borda ou no planalto da feição que dá nome à região (±0,5°).
- A pressão de Marte vem de uma medida só (MEDA, em Jezero), ajustada pela altitude MOLA de cada alvo, sem a variação das estações (~25%).
- O NDVI da Dry Valleys é provisório (0), porque o MOD13C2 não cobre a Antártida.
- Os valores de Lua e Marte são números publicados e aproximados, não recortes processados por nós.

## Partes do projeto

| Pasta | O que tem | Como usar |
|---|---|---|
| `dados/essenciais/` | dados de entrada, `gerar_dados.py` e as saídas (`analogos_completo.json`, CSVs, MQTT) | [dados/essenciais/README.md](dados/essenciais/README.md) |
| `web/` | site three.js em inglês (prévia na branch `gh-pages`) | [web/README.md](web/README.md) |
| `Projeto_C/NasaSpace/` | tela em C: Lua/Marte → alvo → top 3 → tela do local → MQTT → carrinho ao vivo | abrir `NasaSpace.cbp` no Code::Blocks |
| `firmware/` | sketch do Arduino e ponte USB/Bluetooth → MQTT (sem ESP32) | [firmware/README.md](firmware/README.md) |
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
