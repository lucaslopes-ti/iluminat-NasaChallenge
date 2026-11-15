# Illuminat Horizontes: contexto para agentes de IA

Este arquivo é lido pelo agente do Antigravity (AGENTS.md) e pelo Claude Code (via `CLAUDE.md`, que importa este arquivo). Ele resume as decisões já tomadas no projeto, para que a conversa não precise começar do zero.

## O projeto

- **Nome:** Illuminat Horizontes (nome da equipe e do site). O nome antigo, "AnaloGêmeo" / "gêmeo digital", ainda aparece no `README.md` e no plano em `docs/`, mas não deve ser usado em texto novo.
- **Evento:** NASA Space Apps Challenge 2026, desafio *"Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars"*.
- **Ideia:** comparar **18 locais da Terra** com **16 alvos na Lua e em Marte** em **9 dimensões** (terreno, materiais, temperatura, iluminação, água e gelo, poeira e vento, vida, subsolo, pouso e mobilidade) e dar uma **nota de similaridade**, o IAP (Índice de Analogia Planetária, 0 a 100). Para cada local, mostramos onde a analogia funciona, onde quebra e o que dá para testar ali.
- **Nota:** indicador numérico `S = exp(−(Terra − alvo)² / (2σ²))` (σ em `dados/essenciais/entrada/dimensoes.json`), Jaccard para as tags, média por dimensão e média ponderada pelo **perfil de missão** (geral, rover, astrobiologia, gelo/ISRU, base e construção, energia solar).
- **Diferencial:** locais brasileiros pouco estudados (Vargeão, Vista Alegre, Cangalha, Araguainha, Carajás, Lençóis, Raso da Catarina, Gilbués) ao lado dos análogos clássicos (Atacama, Haughton, Mauna Kea, Río Tinto), que servem de validação do método.
- **O que sempre quebra:** gravidade, atmosfera, radiação e duração do dia. Isso aparece sempre em "breaks".
- **Parte física:** um carrinho com sensores que envia leituras ao vivo para o site e para uma tela em C.

## Regras (seguir sempre)

1. **Responder em português.** O código e os comentários podem ficar em português; o texto do site é em inglês.
2. **Não mexer na pasta `Site/` da `main`.** Outros colaboradores trabalham nela. O nosso site fica em `web/` (prévia na branch `gh-pages`).
3. **Não mencionar SENAI** em nenhum documento, commit ou texto do site.
4. **Commits** com autor `lucaslopes-ti <66391853+lucaslopes-ti@users.noreply.github.com>`, **sem** linha `Co-Authored-By` de IA. Trabalhar em branch e abrir PR para a `main`.
5. **Dados:** só fontes da NASA (Earthdata, AppEEARS, LP DAAC, NASA POWER, PDS, LRO, MRO) e Copernicus. Earth Engine é opcional. Todo valor leva **status** e **fonte** (short name, versão, DOI ou referência, resolução e data de acesso).
6. **Site:** three.js, em inglês, interface limpa com pouca informação na tela; os detalhes aparecem só ao clicar.
7. **Notebooks:** o Lucas cuida dos dados e prefere receber notebooks como arquivo, fora do git. O pipeline é Parquet no Colab, com os dados no Google Drive.
8. **Nunca** colocar tokens, senhas ou o token do Earthdata no repositório. A senha do broker MQTT vai na variável `MQTT_SENHA`; o token do Earthdata, num arquivo apontado por `EARTHDATA_TOKEN_FILE`.

## Mapa das pastas

| Pasta | O que tem |
|---|---|
| `docs/` | `plano-gemeo-digital-analogos.md`: plano completo (escopo, fontes, métrica, cronograma). |
| `web/` | **Nosso site** (three.js r170 local, sem CDN). `Main.js`, `Scripts/Javascript/Globe.js`, `Scoring.js`, `Station.js` (carrinho por MQTT, USB ou Demo), `data/alvos.json` e `data/locais.json` (gerados), `tools/gerar_dados_site.py` + `tools/traducao_en.json`. Ver `web/README.md`. |
| `Site/` | Site de outros colaboradores. **Não editar.** |
| `dados/essenciais/` | Dados de analogia prontos. `tela_carrinho.json` (~70 KB, para a tela em C; o centro são as listas `alvos` e `locais`), `analogos_completo.json` (tudo), CSVs (`ranking.csv`, `notas_dimensoes.csv`, `criterios_terra.csv`, `medidas_*.csv`), `entrada/` (dados de partida editáveis), `gerar_dados.py`, `gerar_mqtt.py`, `ndvi_mod13c2.py`. Ver `dados/essenciais/README.md`. |
| `dados/essenciais/mqtt/` | Mensagens pequenas por local (`locais/<id>.json`), `indice.json` e `sensores.json` (qual sensor do carrinho se compara com qual dado). |
| `dados/srtm30/` | 27 blocos NASA SRTMGL30 v002 (`.zip`) e `altitude.py`. |
| `dados/copernicus_dem/` | Blocos do Copernicus DEM GLO-90 para a Antártida (Dry Valleys), baixados por `dados/essenciais/relevo_copernicus.py`. |
| `firmware/` | `arduino_carrinho/` (sketch dos sensores), `ponte_serial_mqtt.py` (ponte USB → MQTT no computador), `esp32_ponte_mqtt/` (ESP32 opcional, só como ponte Wi-Fi). Ver `firmware/README.md`. |
| `Projeto_C/NasaSpace/` | Tela em C (Code::Blocks): `main.c` (seletor Lua/Marte → alvo → top 3 → MQTT → ponte Bluetooth) e `tela_local.c` (tela do local escolhido). Lê um JSON só, `dados/essenciais/analogos_completo.json`, com cJSON (`Bibliotecas/cJSON.h`). |
| Notebooks | `01_dados_terra.ipynb` fica fora do git (Colab/Drive). |

### `tela_carrinho.json`, em resumo

Chaves de topo: `projeto`, `versao_dados`, `gerado_em`, `legenda_status`, `destaque` (melhor candidato brasileiro), `destaque_geral`, `destaque_descoberta`, `destaque_por_perfil`, `destaque_lua`, `destaque_marte`, `melhor_analogo_por_alvo`, `perfis`, `rotulos_dimensoes`, `sempre_quebra`, `alvos`, `locais`.

Cada item de `locais`: `id`, `posicao`, `nome`, `regiao`, `pais`, `papel`, `lat`, `lon`, `feicao`, `dados_completos`, `alvo`, `alvo_nome`, `corpo`, `nota_pct`, `notas_perfil_pct`, `dimensoes_pct`, `funciona`, `quebra`, `teste` e `dados` (lista com `rotulo`, `valor`, `unidade`, `status`; `valor` nulo quer dizer sem dado). Cada item de `alvos`: `id`, `nome`, `corpo`, `papel`, `lat`, `lon`, `resumo`.

## Estado dos dados

| Dado | Fonte | Situação |
|---|---|---|
| Relevo (elevação, desnível, declividade, rugosidade, áreas < 8° e < 15°) | NASA SRTMGL30 v002; na Antártida, Copernicus DEM GLO-90 agregado para 30" (`relevo_copernicus.py` → `entrada/relevo_copernicus.csv`) | **medido** |
| Temperatura da superfície de dia e de noite | NASA MYD11A2 v061 (Aqua, 1 km, ~13:30 e ~01:30), 2024, pixels de terra na caixa, via ORNL DAAC (`modis_ornl.py` → `entrada/modis_ornl.csv`, sem login) | **medido** |
| Temperatura média da superfície (TS) e do ar a 2 m (T2M, T2M_RANGE), albedo, poeira (AOD 550 nm), vento, chuva | NASA POWER (MERRA-2, CERES), médias 2001–2025 | **medido**; respostas salvas em `entrada/nasa_power/` |
| Vegetação (NDVI) | NASA MOD13C2 v061, 0,05°, 72 meses (2020–2025), LP DAAC | **medido** |
| Iluminação | geometria solar pela latitude | **calculado** |
| Geologia, gelo, subsolo, vida | tags com referência bibliográfica | **tags** |
| Lua e Marte | LRO LOLA/Diviner, MGS MOLA/TES, CRISM, SWIM, rovers | **referência** |

Pontos em aberto, que precisam ser ditos com honestidade na apresentação:

- **Único valor provisório:** o NDVI da McMurdo Dry Valleys (o MOD13C2 não cobre a Antártida; ficou 0, deserto polar). O relevo da Dry Valleys vem do Copernicus DEM GLO-90 (o SRTM30 não cobre a Antártida).
- **AppEEARS:** a task `a92258f5…` (MOD13A2 e MODIS de 1 km) ainda está pendente. Enquanto isso, a temperatura da superfície vem do MYD11A2 pelo ORNL DAAC. Quando chegar, rodar `python3 dados/essenciais/gerar_dados.py --appeears PASTA`; ela substitui NDVI, temperatura e albedo (prioridade: AppEEARS/notebook > ORNL MODIS > NASA POWER e MOD13C2 > provisório). O albedo continua o da POWER (o MCD43 não está no ORNL e o carrinho não tem sensor de albedo).
- **Coordenadas do Artemis III:** conferidas com o Gazetteer of Planetary Nomenclature (USGS/IAU) e com resumos do LPSC 2025; cada uma tem `coord_fonte`. Corrigidas: Slater Plain (a longitude estava com o sinal trocado: −115 → 111,3°E, ao norte da cratera Slater) e Maciço de Malapert (→ centro do Mons Malapert, −85,98, −1,67). Mons Mouton e Nobile Rim 2 usam locais de pouso publicados dentro da região, e Peak near Cabeus B usa o centro do mosaico NAC da LROC feito para a região (antes estava a ~60 km); as três ficaram sem `coord_aprox`. As outras seguem com `coord_aprox` (a região fica na borda ou no planalto da feição, não no centro dela). A NASA não publicou o centro das regiões em texto, só o mapa.
- **Albedo regional:** a célula da POWER mistura o local com o entorno (Lençóis 0,10 por causa do mar; Mauna Kea 0,08; Dry Valleys 0,56 por causa do gelo). Melhora com o AppEEARS (MCD43A3, 1 km).
- **Pressão em Marte:** por local. Jezero usa o meio da faixa medida pelo MEDA (625–761 Pa, médias diárias dos sóis 15–460; Sánchez-Lavega et al. 2023, doi:10.1029/2022JE007480): 0,69 kPa. Os outros alvos ajustam esse valor pela altitude MOLA (`dados/mola/`, MEGDR de 4 pixels/grau) com escala de altura de 11,1 km: Gale 0,82 (no pouso do Curiosity, `ponto_pressao`), Arcadia 0,78, Oxia 0,72, Meridiani 0,62 kPa. A variação das estações (~25%) não entra.
- **Luz na Lua:** a dimensão luz usa `sol_max_graus`, `frac_sol_baixo` e `frac_tempo_sol` ("Tempo com Sol": geometria solar na Terra; `iluminacao_frac` do LOLA, com relevo, na Lua). O `frac_ano_sol_continuo` ("Ano com Sol 24 h") saiu da nota, porque com horizonte plano dava 0% nas bordas lunares reais.
- **Validação:** cada análogo clássico tem `alvos_literatura` em `entrada/locais_terra.json`; o teste é a posição dele no ranking desse alvo (`validacao_referencias.alvo_da_literatura`). Hoje os cinco ficam entre os 6 primeiros de 18.
- **Shackleton:** a mínima é a da borda (−200 °C); o fundo em sombra permanente (−230 °C) fica só na nota. A amplitude é sempre a máxima menos a mínima.
- **Mauna Kea:** a temperatura da superfície já é a do MODIS (pixels de terra; noite ~4 °C). Mas a temperatura do **ar** (`temp_ar_c`, comparada com o sensor do carrinho) continua a da célula da POWER, que mistura o cume com as encostas e o mar (~21 °C, contra ~0 °C no cume). Locais pequenos (Lonar, Dallol) têm o mesmo problema no ar.
- **Temperatura: POWER x MODIS:** na POWER, máxima e mínima são os extremos de cada mês; no MODIS, um dia típico (13:30) e uma noite típica (01:30), só com céu limpo, como a máxima e a mínima de um dia na Lua e em Marte. Nos locais polares a amplitude fica em 2–3 °C, porque na noite polar não há dia. Trocar uma fonte pela outra mudou as notas em no máximo 1 ponto, sem mudar rankings.

Regenerar tudo:

```
pip3 install numpy                                         # o gerar_dados.py precisa do numpy
python3 dados/essenciais/gerar_dados.py                    # refaz com o que está em entrada/ (só numpy)
python3 dados/essenciais/relevo_copernicus.py              # relevo da Antártida (pip3 install tifffile imagecodecs)
python3 dados/essenciais/modis_ornl.py                     # temperatura MODIS 1 km pelo ORNL DAAC (~20 min, com cache)
python3 dados/essenciais/gerar_dados.py --baixar-power     # baixa de novo a NASA POWER
python3 dados/essenciais/gerar_dados.py --appeears PASTA   # CSVs de Point Sample do AppEEARS
EARTHDATA_TOKEN_FILE=token.txt python3 dados/essenciais/ndvi_mod13c2.py 2020 2025
python3 dados/essenciais/gerar_mqtt.py                     # mensagens MQTT por local
python3 web/tools/gerar_dados_site.py                      # atualiza web/data/ em inglês
```

## Hardware e fluxo dos dados ao vivo

```
Sensores → Arduino Uno/Nano (sem Wi-Fi) → Bluetooth HC-05 (ou USB), 1 linha JSON/s
        → ponte_serial_mqtt.py --porta <porta BT> (pyserial + paho-mqtt, no computador)
        → MQTT  illuminat-horizontes/carrinho   (leituras)
                illuminat-horizontes/local      (perfil do local, retido, com --local <id>)
                illuminat-horizontes/selecao    (escolha do seletor em C, retida)
        → site web/ (botão Wi-Fi → Connect)  e  tela em C (cJSON, Projeto_C)
```

- **Decisão:** a comunicação com o carrinho é por **Bluetooth** (HC-05/HC-06 na Serial de hardware, D0/D1, 115200). No computador o módulo vira uma porta serial, então a ponte é a mesma do USB, só com `--porta`.
- **Tela em C** (`Projeto_C/NasaSpace`, um programa só): Lua/Marte → alvo → top 3 análogos (`ranking_por_alvo` e `locais[].comparacoes.<alvo>.iap.geral`) → tela do local (`tela_local.c`, enxuta de propósito: Terra x alvo, 9 dimensões para aquele alvo e carrinho ao vivo, com os sensores de `mqtt/sensores.json`) → publica em `illuminat-horizontes/selecao` com `mosquitto_pub` → abre a ponte com `--porta <BT> --local <id>`. Lê só o `analogos_completo.json` (direto de `dados/essenciais/`, sem cópia em `bin/Debug`). Acha os arquivos pela pasta do executável (Mac e Windows); a porta BT vai como argumento (`NasaSpace COM7`).
- **Decisão:** os sensores ficam no **Arduino**. O ESP32 não serviu para os sensores; ele é **opcional, só como ponte Wi-Fi** (`firmware/esp32_ponte_mqtt`, buffer 2048). Não propor ler sensores no ESP32.
- **Mensagem:** `{"temp":24.1,"uv":6.2,"pm25":14,"solar":410,"soil":22,"tilt":3.4,"vib":0.08,"slip":5}`. Manter estas chaves. Chaves ausentes aparecem como "–".
- O sensor `temp` mede o **ar** e é comparado com `temp_ar_c` (NASA POWER T2M).
- Broker padrão: `broker.hivemq.com` (público, aberto). Para a apresentação, usar um tópico só da equipe ou HiveMQ Cloud com `--tls`, `--usuario` e `MQTT_SENHA`.
- Outros caminhos: USB direto no site (Web Serial, Chrome/Edge, 115200 baud) e modo **Demo** (leituras simuladas, tempestade de poeira a cada minuto).
- Rodar a ponte: `pip install pyserial paho-mqtt` e `python3 firmware/ponte_serial_mqtt.py --local lencois` (fechar o Monitor Serial antes).

## Próximos passos

1. Se quiser mais precisão, conferir as regiões que ainda têm `coord_aprox` com os mosaicos NAC da LROC de cada região (como foi feito com Peak near Cabeus B).
2. Quando a task do AppEEARS terminar, rodar `--appeears`, depois `gerar_mqtt.py` e `web/tools/gerar_dados_site.py`.
3. Tela em C (`Projeto_C/NasaSpace`): testar no Windows (Code::Blocks + Mosquitto no PATH) e com o HC-05 pareado. O modo ao vivo (`mosquitto_sub` em `illuminat-horizontes/carrinho`, coluna "Agora") já funciona; `MQTT_BROKER=localhost` testa com um Mosquitto local.
4. Montar o carrinho com os sensores escolhidos no topo de `arduino_carrinho.ino` e testar o fluxo completo até o site.
5. Atualizar o `README.md` com o nome Illuminat Horizontes e o fluxo com Arduino.
6. Preparar a apresentação e o vídeo seguindo a história em 3 atos do plano (`docs/`).
