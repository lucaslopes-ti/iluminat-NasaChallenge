# Site Illuminat Horizontes (three.js) — pasta web/

Esta versão fica em `web/` para não mexer na pasta `Site/`, onde a equipe está trabalhando. A prévia publicada está na branch `gh-pages`.

Site estático, todo em inglês, em tela cheia e com pouca informação à vista: a Lua ou Marte de um lado e a Terra do outro (empilhados no celular), ligados por uma linha animada com a nota de semelhança no meio. Clicar num alvo (Shackleton, Malapert, Haworth, Marius Hills, Jezero, Gale, Arcadia) leva a Terra até o melhor análogo; os outros aparecem como botões embaixo. "Why it matches" abre o painel com radar Terra × alvo, onde a analogia funciona e onde quebra, e os dados em "More data". O perfil de missão (pesos por dimensão) fica no botão de ajustes do topo.

## Rodar localmente

O site lê arquivos JSON com `fetch`, então precisa de um servidor (abrir o `index.html` direto com `file://` não funciona):

```bash
cd web
python3 -m http.server 8000
# abra http://localhost:8000
```

Link direto para um alvo e um local: `index.html#moon/shackleton/vargeao`, `index.html#mars/jezero/atacama`.

## Estrutura

```
web/
  index.html                 layout (painel esquerdo, globo central, painel da Terra, cartão)
  Main.js                    estado da página, ranking, cartões
  Scripts/Javascript/Globe.js    globo three.js reutilizável (textura, marcadores clicáveis, rótulos, voo da câmera)
  Scripts/Javascript/Scoring.js  índice de analogia (média ponderada por dimensão)
  Scripts/css/principal.css  estilos (desktop, tablet e celular)
  data/alvos.json            alvos da Lua e de Marte, dimensões, perfis de missão
  data/locais.json           locais da Terra com as notas reais (gerado por tools/gerar_dados_site.py)
  Assets/Textures/           texturas equiretangulares (Terra, Marte, Lua)
  lib/three/                 three.js r170 + OrbitControls, local (sem CDN, funciona offline)
```

## Formato dos dados

`data/locais.json` tem uma linha por local: `id`, `nome_en`, `regiao`, `cidade`, `lat`, `lon`, `coord_aprox`, `notas[alvo][dimensão]` (0 a 1), `analogia` (works/breaks) e indicadores como `elev_media_m`, `declividade_media`, `temp_media_c`, `lst_dia_c`, `chuva_anual_mm`, `aod_medio`, `ndvi_medio`. `fontes_valores` marca os valores que não foram medidos (aparecem como "est."). O site usa os indicadores que existirem e ignora os que faltarem.

Para o ranking, cada local precisa de notas por alvo. Há duas formas, o site aceita qualquer uma:

```json
"notas": {
  "shackleton": { "terrain": 0.86, "materials": 0.78, "thermal": 0.35, "water_ice": 0.15, "dust": 0.30, "biology": 0.40, "operations": 0.80 },
  "jezero":     { "terrain": 0.74, "materials": 0.62, "...": 0.0 }
}
```

ou só a nota geral, `"nota_shackleton": 0.61` (aí os pesos do perfil não mudam esse local). Notas de 0 a 1.

Campos opcionais que o site mostra: `tipo_en` (descrição em inglês), `analogia` com listas `works` e `breaks` por alvo (`"analogia": {"shackleton": {...}}`) ou por corpo (`"moon"`, `"mars"`). Gravidade, atmosfera e radiação aparecem sempre em "breaks" (vêm de `alvos.json`).

Se algum local tiver `"exemplo": true` ou `"modo_teste": true`, o site mostra o selo **Sample data**. Com os dados reais o selo some.

Os dados vêm de `dados/essenciais/` (notas reais de 17 locais × 16 alvos). Para atualizar depois de rodar `dados/essenciais/gerar_dados.py`:

```
python3 web/tools/gerar_dados_site.py
```

Ele reescreve `data/alvos.json` e `data/locais.json` em inglês, usando `web/tools/traducao_en.json` (texto novo sem tradução aparece no aviso).

## Texturas e créditos

| Arquivo | Fonte |
|---|---|
| `earth.jpg` | NASA Blue Marble (NASA Earth Observatory), cópia de 4096 px dos exemplos do three-globe, reduzida para 2048 px |
| `moon_8k.jpg`, `moon_4k.jpg` | NASA SVS CGI Moon Kit (`lroc_color_poles_8k`, LRO LROC), via github.com/nasa/virgo; relevo sombreado leve calculado do LRO LOLA LDEM 16 ppd (`ldem_16_uint`). 8k no computador, 4k no celular |
| `moon_bump.jpg` | Relevo local (LOLA LDEM 16 ppd menos a média de ~30 px), para o `bumpMap` |
| `mars_4k.jpg`, `mars_normal_4k.jpg` | NASA 3D Resources, modelo Mars 5672 (cor e normal map, 4k), girado 180° para começar em 180°W |

Os modelos `.glb` da pasta `Site/Assets/Models/` (da equipe) não são usados aqui: a textura deles vem em formato de cubo (não equiretangular), o da Terra tem nuvens que escondem os locais e pesa 19 MB, o que deixaria o site lento no celular.

## Carrinho (Arduino no cabo USB)

Abaixo dos globos há a seção "Field rover", com uma tabela que compara a leitura do carrinho agora, o análogo da Terra selecionado e o alvo na Lua ou em Marte. As medidas e os valores de referência dos alvos ficam em `data/estacao.json`.

O carrinho manda uma linha JSON por leitura (`{"temp":24.1,"pm25":14,"solar":410,"tilt":3.4}`) por um destes caminhos:
- **Web:** o computador onde o Arduino está ligado roda `firmware/ponte_serial_mqtt.py` (ou `controle_carrinho.py`) e publica no broker MQTT; o site assina pelo WebSocket (`lib/mqtt/mqtt.esm.js`, mqtt.js 5.10.4, MIT). O site já abre ouvindo esse tópico.
- **USB:** Arduino ligado neste computador; o site lê pela Web Serial (Chrome ou Edge, 9600 baud).

O site também assina `illuminat-horizontes/local` (perfil retido que a ponte publica com `--local <id>`) e `illuminat-horizontes/selecao` (escolha da tela em C) e troca sozinho para o local e o alvo escolhidos no terminal.

Não há mais modo Demo: a tabela só mostra o que vem do carrinho de verdade.

Código do Arduino e da ponte: pasta `firmware/` na raiz do repositório.
