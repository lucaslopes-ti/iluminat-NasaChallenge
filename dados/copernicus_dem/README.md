# Copernicus DEM GLO-90: relevo da Antártida

O SRTMGL30 (`dados/srtm30/`) não cobre a Terra ao sul de 60°S. Para os locais da Antártida (hoje só a McMurdo Dry Valleys), o relevo vem do **Copernicus DEM GLO-90** (ESA, doi:10.5270/ESA-c5d3d65), baixado sem login do AWS Open Data (`copernicus-dem-90m`).

- Cada `.tif` é um bloco de 1° × 1°, float32, em metros. O nome dá o canto sul/oeste: `S78_00_E161_00` vai de 78°S a 77°S e de 161°E a 162°E.
- Ao sul de 70°S, o pixel é de 3" em latitude e 9" em longitude.
- `dados/essenciais/relevo_copernicus.py` faz a média dos pixels em cada célula de 30" (~1 km, a mesma grade do SRTM30), calcula o relevo com a mesma função do `gerar_dados.py` e grava `dados/essenciais/entrada/relevo_copernicus.csv`.

```
pip3 install numpy tifffile imagecodecs
python3 dados/essenciais/relevo_copernicus.py
python3 dados/essenciais/gerar_dados.py
```
