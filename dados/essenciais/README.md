# Dados essenciais do Illuminat Horizontes

Esta pasta reúne, num só lugar, os dados centrais do projeto: os locais da Terra que estudamos, os dois alvos de exploração (**Shackleton**, no polo sul da Lua, e **Jezero**, em Marte) e uma nota de similaridade entre eles. Tudo está pronto para a tela do carrinho ESP32 ler quando o servidor web for ligado, e também serve para o site.

Cada número tem **status** e **fonte**. Assim dá para saber o que já foi medido com dados da NASA e o que ainda é provisório.

## Arquivos

| Arquivo | O que tem | Para quem |
|---|---|---|
| `tela_carrinho.json` | Tudo junto: alvos, locais em ordem de nota, destaque, fontes. Cada variável traz `valor`, `unidade`, `status`, `fonte` e, quando dá para comparar, `valor_alvo` e `similaridade` | Programa em C (cJSON) e servidor web do ESP32 |
| `resumo_locais.csv` | Uma linha por local, com a posição no ranking, a nota e as variáveis principais | Planilha, apresentação |
| `medidas_terra.csv` | Formato longo: um valor por linha, com status, short name, versão e DOI | Conferência das fontes |
| `medidas_alvos.csv` | Mesmo formato, para Shackleton e Jezero | Conferência das fontes |
| `entrada/` | Os dados de partida (locais, valores dos alvos, valores provisórios, catálogo de fontes) | Quem for atualizar |
| `gerar_dados.py` | Gera os quatro arquivos acima a partir de `entrada/` e dos blocos SRTM30 | Quem for atualizar |

## Status de cada valor

| Status | Significado |
|---|---|
| `medido` | Calculado neste repositório a partir de dados da NASA |
| `referencia` | Valor publicado por missão da NASA (aproximado, com a referência citada) |
| `provisorio` | Estimativa temporária, para a tela já funcionar. Será trocada pela saída do notebook 01 (AppEEARS e GPM) |
| `sem_dado` | O produto usado não cobre o local |

**Hoje:** o relevo da Terra está `medido` (SRTMGL30). Os valores de Shackleton e Jezero são `referencia`. Temperatura de superfície, NDVI, albedo, poeira e chuva da Terra ainda são `provisorio`. A McMurdo Dry Valleys fica sem relevo porque o SRTM30 não cobre a Antártida.

## Variáveis essenciais

Escolhemos poucas dimensões, as que mais pesam para uma base ou um campo de testes:

| Dimensão | Variável | Terra (fonte) | Lua: Shackleton | Marte: Jezero |
|---|---|---|---|---|
| Relevo | `elev_media_m`, `elev_relativa_m` (desnível na caixa) | SRTMGL30 v002 | LRO LOLA | MGS MOLA |
| Mobilidade | `declividade_media`, `rugosidade_tri_m`, `frac_transitavel_15` | SRTMGL30 v002 | LRO LOLA | MGS MOLA |
| Temperatura | `lst_dia_c`, `lst_noite_c`, `amplitude_termica_c` (ΔT) | MOD11A1 / MYD11A1 v061 | LRO Diviner | Perseverance MEDA |
| Vegetação | `ndvi_medio` | MOD13A2 v061 | 0 (sem vida) | 0 (sem vida) |
| Superfície | `albedo_medio` | MCD43A3 v061 | LRO LOLA (aprox.) | MGS TES |
| Poeira | `aod_medio` (550 nm) | MCD19A2 v061 (MAIAC) | 0 (sem atmosfera) | Perseverance (opacidade) |
| Água | `chuva_anual_mm` | GPM_3IMERGM v07 | 0 | 0 |
| Só nos alvos | `iluminacao_frac`, `pressao_kpa` | – | LRO LOLA | Perseverance MEDA |

O catálogo completo, com DOI, resolução, link e data de acesso, está em `entrada/fontes.csv` e também vai dentro do JSON, em `fontes`.

### Como o relevo foi calculado

`gerar_dados.py` lê os 27 blocos de `dados/srtm30/` (NASA SRTMGL30, doi:10.5067/MEaSUREs/SRTM/SRTMGL30.002) e recorta a caixa de cada local (`lat_min…lon_max` de `entrada/locais.csv`, a mesma do site). As definições são as do notebook 01, célula 5: declividade com o pixel convertido para metros na latitude do local, rugosidade TRI de Riley (1999) nos 8 vizinhos e fração da área com declividade abaixo de 15°.

O SRTM30 tem pixel de cerca de 1 km. Por isso a declividade sai bem menor do que a real, que só aparece no NASADEM de 30 m (notebook 01). Os números servem para comparar os locais entre si, não para planejar a rota do carrinho.

## Nota de similaridade

Para cada variável comparável:

```
similaridade = max(0, 1 − |Terra − alvo| / escala)
```

A nota do local é a média dessas similaridades, de 0 a 100 %. As escalas estão no JSON (`escalas`): 15° para declividade, 120 °C para ΔT, 1,0 para AOD, e assim por diante. É um método simples e transparente. Ele não tenta dizer que a Terra "é" a Lua: a temperatura noturna, por exemplo, nunca chega perto de Shackleton, e isso aparece como similaridade baixa. O que sempre quebra (gravidade, atmosfera, radiação) está em `sempre_quebra`.

O JSON traz três destaques:

- `destaque`: o local com maior nota geral;
- `destaque_candidato`: o melhor entre os candidatos novos (não as referências clássicas, como Atacama). É o local que o carrinho pode apresentar como "base possível";
- `destaque_por_alvo`: o melhor para Shackleton e o melhor para Jezero.

Locais com alguma variável faltando (`dados_completos: false`) ficam no fim do ranking.

## Como atualizar com os dados reais do AppEEARS

1. Rode o notebook 01 no Colab. Ele gera `terra_locais.parquet`, com as colunas `lst_dia_c`, `lst_noite_c`, `amplitude_termica_c`, `ndvi_mediano` (ou `ndvi_medio`), `albedo_medio`, `aod_medio` e `chuva_anual_mm`.
2. Na raiz do repositório:

   ```
   pip install numpy pandas pyarrow
   python3 dados/essenciais/gerar_dados.py --notebook caminho/para/terra_locais.parquet
   ```

3. Os valores do notebook substituem os provisórios e passam a `medido`. O ranking e as notas são recalculados.

Para corrigir um valor à mão, edite `entrada/terra_provisorio.csv` ou `entrada/alvos_referencia.csv` e rode o script de novo (sem `--notebook`, só precisa do numpy).

## Lendo no C

O `tela_carrinho.json` funciona direto com o cJSON do `Projeto_C`:

```c
cJSON *raiz = cJSON_Parse(texto);
const char *id = cJSON_GetObjectItem(raiz, "destaque_candidato")->valuestring;
cJSON *local;
cJSON_ArrayForEach(local, cJSON_GetObjectItem(raiz, "locais")) {
    if (strcmp(cJSON_GetObjectItem(local, "id")->valuestring, id) != 0) continue;
    cJSON *dados = cJSON_GetObjectItem(local, "dados");
    cJSON *decl  = cJSON_GetObjectItem(dados, "declividade_media");
    printf("%s: %.1f %s [%s]\n",
           cJSON_GetObjectItem(decl, "rotulo")->valuestring,
           cJSON_GetObjectItem(decl, "valor")->valuedouble,
           cJSON_GetObjectItem(decl, "unidade")->valuestring,
           cJSON_GetObjectItem(decl, "status")->valuestring);
}
```

Os rótulos e unidades estão sem acento para não quebrar no terminal do Windows. Os nomes dos locais têm acento (UTF-8): no Windows, chame `SetConsoleOutputCP(65001);` (de `windows.h`) no começo do `main`. Um valor `null` significa sem dado; teste com `cJSON_IsNumber` antes de ler.

O arquivo tem cerca de 47 KB, então cabe no LittleFS do ESP32.
