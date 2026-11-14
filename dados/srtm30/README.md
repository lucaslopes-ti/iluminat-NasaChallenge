# SRTM30: relevo da Terra (NASA SRTMGL30)

Os 27 blocos do **NASA SRTMGL30** (SRTM a 30 segundos de arco, cerca de 1 km), baixados do LP DAAC / NASA Earthdata. Cobrem a Terra de 90°N a 60°S (a Antártida não está incluída).

Cada `.zip` tem um arquivo `.DEM`:

- grade de **4800 colunas × 6000 linhas** (40° de longitude × 50° de latitude), 30" por pixel;
- valores **int16 big-endian**, em metros acima do nível do mar;
- oceano aparece como `-9999` ou `0`;
- o nome dá o **canto superior esquerdo**: `w060s10` começa em 60°W, 10°S e vai até 20°W, 60°S.

| Faixa de latitude | Blocos |
|---|---|
| 90°N a 40°N | w180n90, w140n90, w100n90, w060n90, w020n90, e020n90, e060n90, e100n90, e140n90 |
| 40°N a 10°S | w180n40, w140n40, w100n40, w060n40, w020n40, e020n40, e060n40, e100n40, e140n40 |
| 10°S a 60°S | w180s10, w140s10, w100s10, w060s10, w020s10, e020s10, e060s10, e100s10, e140s10 |

## Ler a altitude de um ponto (Python)

```python
python3 dados/srtm30/altitude.py -27.10 -51.45   # lat lon -> metros
```

O script `altitude.py` acha o bloco certo, lê só o pixel pedido de dentro do `.zip` e não precisa de bibliotecas extras. Também dá para usar como módulo: `from altitude import altitude`.

## Versão leve usada no site

O site (`web/`) usa uma média de 0,25° destes blocos: `web/data/elevacao_srtm30_025.bin` (int16 little-endian, 1440 × 720, de 90°N para baixo e de 180°W para a direita; oceano = -9999, sem dado = -32768). Veja `web/data/elevacao_srtm30_025.json`.

Fonte: NASA JPL (2013), *NASA Shuttle Radar Topography Mission Global 30 arc second*, LP DAAC, doi:10.5067/MEaSUREs/SRTM/SRTMGL30.002.
