# Dados de analogia do Illuminat Horizontes

Esta pasta guarda os dados do projeto já prontos para uso. Ela compara **18 locais da Terra** com **16 alvos na Lua e em Marte** em **9 dimensões de analogia**, seguindo os critérios que a NASA usa para escolher onde pousar e onde montar uma base. Para cada local, diz o que funciona, onde a analogia quebra e o que dá para testar ali.

Os dados servem para três coisas:

- **Tela do carrinho ESP32:** a tela lê `tela_carrinho.json` quando o servidor web liga.
- **Site:** usa `analogos_completo.json`.
- **Relatório e apresentação:** os CSVs.

Todo valor vem com **status** e **fonte**, ou seja, short name, versão, DOI ou referência, resolução e data de acesso. Assim os jurados conseguem rastrear de onde saiu cada número.

## O que já é dado real

| Dimensão | Terra | Lua / Marte |
|---|---|---|
| Relevo (elevação, desnível, declividade, rugosidade, áreas < 8° e < 15°) | **medido**: NASA SRTMGL30 v002, 27 blocos em `dados/srtm30/` | **referência**: LRO LOLA, MGS MOLA |
| Temperatura da superfície (máx., mín., ΔT, média) e do ar a 2 m (média e variação diária) | **medido**: NASA POWER (MERRA-2: TS, TS_MAX, TS_MIN, T2M, T2M_RANGE), médias de 2001–2025 | **referência**: LRO Diviner, Perseverance MEDA, Curiosity REMS |
| Albedo | **medido**: NASA POWER (CERES SYN1deg) | **referência**: LOLA, MGS TES |
| Poeira (AOD 550 nm) e vento | **medido**: NASA POWER (MERRA-2) | **referência**: Perseverance (opacidade da poeira) |
| Chuva | **medido**: NASA POWER (PRECTOTCORR) | 0 (valor físico) |
| Iluminação (altura do Sol, sol 24 h, noite polar) | **calculado**: geometria solar pela latitude | **calculado** com a obliquidade da Lua e de Marte; iluminação com relevo vem do LOLA |
| Vegetação (NDVI) | **medido**: NASA MOD13C2 v061 (NDVI mensal, 0,05°), média de 72 meses, 2020–2025, baixado do LP DAAC | 0 |
| Geologia, água/gelo, subsolo, vida | **tags** com referência bibliográfica (Earth Impact Database, artigos de campo) | **tags** a partir de CRISM, SWIM, LAMP/LEND, missões de superfície |

As respostas da NASA POWER estão salvas em `entrada/nasa_power/`, uma por local, com cabeçalho, versão da API e período. Quem quiser pode conferir ou baixar de novo.

Hoje, de 450 valores da Terra, só 1 continua provisório: o NDVI da McMurdo Dry Valleys, porque o MOD13C2 não cobre a Antártida (ficou 0, deserto polar sem vegetação). Ela também fica sem relevo, porque o SRTM30 não cobre a Antártida. O NDVI de cada ano (2020 a 2025) está em `entrada/ndvi_mod13c2.csv`, o que permite ver se algum ano foi anômalo.

## Status

| Status | Significado |
|---|---|
| `medido` | Dado de satélite ou modelo da NASA, processado neste repositório |
| `calculado` | Física: geometria solar, pressão pela altitude |
| `referencia` | Valor publicado por missão da NASA, ESA ou JAXA (aproximado, com a referência) |
| `provisorio` | Estimativa temporária, sem produto da NASA que cubra o local |
| `sem_dado` | O produto usado não cobre o local |

## Alvos (Lua e Marte)

**Lua.** As **9 regiões candidatas ao pouso do Artemis III** divulgadas pela NASA em outubro de 2024: Peak near Cabeus B, Haworth, Malapert Massif, Mons Mouton Plateau, Mons Mouton, Nobile Rim 1, Nobile Rim 2, de Gerlache Rim 2 e Slater Plain. Também entram a borda de **Shackleton** (a região histórica das propostas de base) e o fosso das **Colinas de Marius**, um provável tubo de lava que serviria de abrigo.

**Marte.** **Jezero** (Perseverance), **Gale** (Curiosity), **Meridiani** (Opportunity, hematita e jarosita), **Arcadia Planitia** (gelo raso, candidata a pouso humano pelo mapa SWIM) e **Oxia Planum** (rover Rosalind Franklin, da ESA).

As coordenadas das regiões do Artemis III são **aproximadas** (±1°, campo `coord_aprox`) e precisam ser conferidas no mapa oficial da NASA antes de ir para o site.

## Como as bases são escolhidas

O arquivo `entrada/criterios_base.json` resume os critérios e diz como testar cada um na Terra. O `criterios_terra.csv` mostra quais locais permitem testar cada critério.

- **Lua (Artemis):** até 6° do polo sul, sol para energia por vários dias seguidos, declividade abaixo de 8° no pouso, visada para a Terra (comunicação), gelo perto, nas crateras em sombra permanente, e frio extremo.
- **Marte (pouso humano, NASA 2015):** latitude entre ~50°S e ~50°N, altitude baixa para a descida, terreno de pouso seguro, água acessível (gelo raso ou minerais hidratados) até ~100 km, ciência de alto valor perto e cuidado com a poeira.

## Dimensões e nota

São 9 dimensões, as 7 do plano mais **iluminação** e **subsolo**:

terreno · materiais · temperatura · iluminação · água e gelo · poeira e vento · vida · subsolo · pouso e mobilidade

- **Indicador numérico:** `S = exp(−(Terra − alvo)² / (2σ²))`. Os σ estão em `entrada/dimensoes.json`.
- **Indicador de tags** (geologia, gelo, cavernas e assim por diante): Jaccard, que é a razão entre as tags em comum e o total de tags.
- **Nota da dimensão:** média dos indicadores disponíveis.
- **IAP (Índice de Analogia Planetária, 0–100):** média ponderada das dimensões pelo **perfil de missão**. São seis perfis: geral, rover, astrobiologia, gelo/ISRU, base e construção, e energia solar.

**Validação.** Cada análogo clássico tem, em `entrada/locais_terra.json`, o alvo que a literatura associa a ele (`alvos_literatura`, com a referência em `porque_literatura`). O teste é a posição dele, entre os 18 locais, no ranking desse alvo. Hoje os cinco ficam entre os 6 primeiros:

| Referência | Alvo da literatura | Melhor alvo | Posição |
|---|---|---|---|
| Atacama | Marte | Oxia Planum | 3º |
| Haughton | Marte e Lua | Planície de Slater | 2º |
| Mauna Kea | Lua e Marte | Pico perto de Cabeus B | 4º |
| Río Tinto | Meridiani | Meridiani Planum | 6º |
| Dry Valleys | Marte | Arcadia Planitia | 6º |

Os novos locais que aparecem ao lado deles ganham credibilidade. Os resultados ficam em `validacao_referencias.alvo_da_literatura`; a posição no ranking geral, que mistura todos os alvos, continua em `validacao_referencias.ranking_geral`.

**O que sempre quebra:** gravidade, atmosfera, radiação e duração do dia (`sempre_quebra`).

## Arquivos

| Arquivo | Conteúdo |
|---|---|
| `tela_carrinho.json` (~70 KB) | Versão para a tela: destaques, ranking, nota por dimensão e por perfil, 17 valores principais com o valor do alvo, uma linha de "funciona", "quebra" e "teste" |
| `analogos_completo.json` | Tudo: alvos com valores e fontes, locais com valores, tags, processos, referências, critérios de base e a comparação com cada um dos 16 alvos |
| `ranking.csv` | Uma linha por local: melhor alvo, IAP de cada perfil e nota de cada dimensão |
| `notas_dimensoes.csv` | Local × alvo × dimensão, com os indicadores |
| `criterios_terra.csv` | Que critérios de base cada local permite testar |
| `medidas_terra.csv` / `medidas_alvos.csv` | Um valor por linha, com status, fonte e DOI |
| `entrada/` | Os dados de partida, que dá para editar |
| `gerar_dados.py` | Gera tudo de novo (só precisa do numpy) |

Destaques na tela: `destaque` (melhor candidato brasileiro), `destaque_geral`, `destaque_descoberta`, `destaque_lua`, `destaque_marte`, `destaque_por_perfil` e `melhor_analogo_por_alvo`.

## Atualizar

```
python3 dados/essenciais/gerar_dados.py                    # refaz tudo com o que está em entrada/
python3 dados/essenciais/gerar_dados.py --baixar-power     # baixa de novo a NASA POWER
python3 dados/essenciais/gerar_dados.py --appeears PASTA   # usa os CSVs de Point Sample do AppEEARS
EARTHDATA_TOKEN_FILE=token.txt python3 dados/essenciais/ndvi_mod13c2.py 2020 2025   # NDVI do LP DAAC (pip install pyhdf)
python3 dados/essenciais/gerar_dados.py --notebook terra_locais.parquet
```

Ordem de prioridade dos valores da Terra: **AppEEARS/notebook > NASA POWER e MOD13C2 > provisório**. O MODIS do AppEEARS tem 1 km, enquanto a POWER tem de 0,5° a 1°. Quando o AppEEARS chegar, ele substitui também a temperatura e o albedo.

Para trocar um alvo, um critério ou uma tag, edite o arquivo em `entrada/` e rode o script de novo.

## Lendo no C (cJSON)

```c
cJSON *raiz = cJSON_Parse(texto);
const char *id = cJSON_GetObjectItem(raiz, "destaque")->valuestring;
cJSON *local;
cJSON_ArrayForEach(local, cJSON_GetObjectItem(raiz, "locais")) {
    if (strcmp(cJSON_GetObjectItem(local, "id")->valuestring, id) != 0) continue;
    printf("%s -> %s: %d%%\n", cJSON_GetObjectItem(local, "nome")->valuestring,
           cJSON_GetObjectItem(local, "alvo_nome")->valuestring,
           cJSON_GetObjectItem(local, "nota_pct")->valueint);
    cJSON *v;
    cJSON_ArrayForEach(v, cJSON_GetObjectItem(local, "dados")) {
        cJSON *val = cJSON_GetObjectItem(v, "valor");
        if (!cJSON_IsNumber(val)) continue;               /* null = sem dado */
        printf("  %-32s %8.2f %s [%s]\n", cJSON_GetObjectItem(v, "rotulo")->valuestring,
               val->valuedouble, cJSON_GetObjectItem(v, "unidade")->valuestring,
               cJSON_GetObjectItem(v, "status")->valuestring);
    }
}
```

Rótulos e unidades não têm acento, para não quebrar no terminal do Windows. Os nomes dos locais têm acento (UTF-8): no Windows, chame `SetConsoleOutputCP(65001);` no começo do `main`.

## Temperatura na tela

Cada local tem, em `dados`, cinco temperaturas (°C, status `medido`, fonte `nasa_power`):

| Campo | O que é | Tem valor do alvo? |
|---|---|---|
| `lst_dia_c` | Máxima da superfície (TS_MAX, média dos 12 meses) | sim (Diviner, MEDA, REMS) |
| `lst_noite_c` | Mínima da superfície (TS_MIN) | sim |
| `amplitude_termica_c` | Máxima − mínima da superfície | sim |
| `temp_media_c` | Média anual da superfície (TS) | não |
| `temp_ar_c` / `amplitude_ar_c` | Ar a 2 m (T2M) e variação diária do ar (T2M_RANGE) | não: a Lua não tem ar |

O sensor `temp` do carrinho mede o **ar**, então compare com `temp_ar_c`. A comparação com a Lua e Marte é sempre pela **superfície** (`lst_dia_c`, `lst_noite_c`). TS_MAX e TS_MIN são extremos mensais, por isso a amplitude da superfície fica maior que a de um dia comum; a variação diária típica é `amplitude_ar_c`.

## Limites conhecidos

- O relevo vem de pixels de ~1 km, então a declividade real é maior. O NASADEM de 30 m (notebook 01) resolve isso.
- A POWER (0,5°–1°) e o MOD13C2 (0,05° ≈ 5 km) têm resolução grossa e misturam o local com o entorno. Locais pequenos, como Lonar e Dallol, ficam com valores regionais. No Mauna Kea, a célula da POWER mistura o cume com as encostas e o mar, então a temperatura (~21 °C no ar) fica muito acima da do cume (~0 °C).
- Iluminação calculada com horizonte plano. Na Lua, o relevo muda tudo: os valores com relevo (`iluminacao_frac`) vêm do LOLA.
- Valores de Lua e Marte são números publicados e aproximados, não recortes processados aqui. O próximo passo é calcular a partir dos mapas LOLA, Diviner, MOLA e THEMIS.

## MQTT (carrinho)

O carrinho usa um **Arduino** (Uno ou Nano) para ler os sensores. Como o Arduino não tem Wi-Fi, as medições chegam ao MQTT por uma ponte. O caminho principal é o computador:

```
sensores -> Arduino --USB (1 linha JSON/s)--> computador: ponte_serial_mqtt.py --> broker --> site / tela em C
```

O `gerar_mqtt.py` cria em `mqtt/` mensagens pequenas com os dados de analogia:

| Arquivo | Tópico | Conteúdo |
|---|---|---|
| `mqtt/locais/<id>.json` (até ~1,8 KB) | `illuminat-horizontes/local` (mensagem **retida**) | Perfil do local escolhido: alvo, nota, notas por dimensão, funciona/quebra/teste e os valores do local × alvo, com status e fonte |
| `mqtt/indice.json` | – | Lista curta dos locais (id, nome, alvo, nota) para um menu |
| `mqtt/sensores.json` | – | Cada sensor do carrinho → campo dos dados e como comparar (direta, limite de 8°, nível baixo/médio/alto para PM2.5 × AOD) |

As medições vão para `illuminat-horizontes/carrinho`, uma linha JSON por leitura, como `{"temp":24.1,"uv":6.2,"pm25":14,"solar":410,"soil":22,"tilt":3.4,"vib":0.08,"slip":5}` (veja `firmware/README.md`).

Para rodar:

1. Grave `firmware/arduino_carrinho` no Arduino e ligue-o na USB do computador.
2. No computador: `pip install pyserial paho-mqtt`.
3. Na raiz do repositório: `python3 firmware/ponte_serial_mqtt.py --local lencois`. A ponte acha a porta sozinha, publica o perfil de Lençóis retido em `illuminat-horizontes/local` e repassa cada leitura para `illuminat-horizontes/carrinho`.
4. A tela (site ou programa em C) assina os dois tópicos e mostra "aqui agora × local análogo × alvo".

**Sem computador no carrinho:** ligue o TX do Arduino num ESP32 que só faz a ponte Wi-Fi → MQTT (`firmware/esp32_ponte_mqtt`, buffer de 2048 bytes). Os sensores continuam no Arduino.

Rode `python3 dados/essenciais/gerar_mqtt.py` depois do `gerar_dados.py` sempre que os dados mudarem.
