# Site Illuminat Horizontes (three.js)

Site estático, todo em inglês, em tela cheia e com pouca informação à vista: a Lua ou Marte de um lado e a Terra do outro (empilhados no celular), ligados por uma linha animada com a nota de semelhança no meio. Clicar num alvo (Shackleton, Malapert, Haworth, Marius Hills, Jezero, Gale, Arcadia) leva a Terra até o melhor análogo; os outros aparecem como botões embaixo. "Why it matches" abre o painel com radar Terra × alvo, onde a analogia funciona e onde quebra, e os dados em "More data". O perfil de missão (pesos por dimensão) fica no botão de ajustes do topo.

## Rodar localmente

O site lê arquivos JSON com `fetch`, então precisa de um servidor (abrir o `index.html` direto com `file://` não funciona):

```bash
cd Site
python3 -m http.server 8000
# abra http://localhost:8000
```

Link direto para um alvo e um local: `index.html#moon/shackleton/vargeao`, `index.html#mars/jezero/atacama`.

## Estrutura

```
Site/
  index.html                 layout (painel esquerdo, globo central, painel da Terra, cartão)
  Main.js                    estado da página, ranking, cartões
  Scripts/Javascript/Globe.js    globo three.js reutilizável (textura, marcadores clicáveis, rótulos, voo da câmera)
  Scripts/Javascript/Scoring.js  índice de analogia (média ponderada por dimensão)
  Scripts/css/principal.css  estilos (desktop, tablet e celular)
  data/alvos.json            alvos da Lua e de Marte, dimensões, perfis de missão
  data/locais.json           locais da Terra (EXEMPLO até chegar a saída do notebook)
  Assets/Textures/           texturas equiretangulares (Terra, Marte, Lua)
  lib/three/                 three.js r170 + OrbitControls, local (sem CDN, funciona offline)
```

## Formato dos dados

`data/locais.json` segue o formato que o notebook `01_dados_terra` grava (uma linha por local: `id`, `nome`, `regiao`, `papel`, `tipo`, `lat`, `lon`, caixas e indicadores como `elev_media_m`, `declividade_media`, `t2m_c`, `chuva_anual_mm`, `ndvi_medio`, `emit_mineral_dominante`). O site usa os indicadores que existirem e ignora os que faltarem.

Para o ranking, cada local precisa de notas por alvo. Há duas formas, o site aceita qualquer uma:

```json
"notas": {
  "shackleton": { "terrain": 0.86, "materials": 0.78, "thermal": 0.35, "water_ice": 0.15, "dust": 0.30, "biology": 0.40, "operations": 0.80 },
  "jezero":     { "terrain": 0.74, "materials": 0.62, "...": 0.0 }
}
```

ou só a nota geral, `"nota_shackleton": 0.61` (aí os pesos do perfil não mudam esse local). Notas de 0 a 1.

Campos opcionais que o site mostra: `tipo_en` (descrição em inglês), `analogia` com listas `works` e `breaks` por alvo (`"analogia": {"shackleton": {...}}`) ou por corpo (`"moon"`, `"mars"`). Gravidade, atmosfera e radiação aparecem sempre em "breaks" (vêm de `alvos.json`).

Enquanto algum local tiver `"exemplo": true` ou `"modo_teste": true`, o site mostra o selo **Sample data**. As notas de hoje são valores de exemplo, não resultados.

Para trocar pelos dados reais: rodar o notebook, acrescentar as notas (notebook 04 de similaridade) e substituir `data/locais.json`.

## Texturas e créditos

| Arquivo | Fonte |
|---|---|
| `earth.jpg` | NASA Blue Marble (NASA Earth Observatory), cópia de 4096 px dos exemplos do three-globe, reduzida para 2048 px |
| `mars.jpg` | NASA 3D Resources, "Images and Textures/Mars" (domínio público) |
| `moon.jpg` | Textura de exemplo do three.js, **provisória** |

**Pendente:** trocar `moon.jpg` pelo NASA SVS CGI Moon Kit (`lroc_color_poles_2k.jpg`, LRO LROC + LOLA, com os polos corretos): https://svs.gsfc.nasa.gov/4720. Basta salvar com o mesmo nome em `Assets/Textures/`.

Os modelos `.glb` em `Assets/Models/` não são usados no globo: a textura deles vem em formato de cubo (não equiretangular), o da Terra tem nuvens que escondem os locais e pesa 19 MB, o que deixaria o site lento no celular.
