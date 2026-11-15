#!/usr/bin/env python3
"""
Relevo dos locais fora do SRTM30 (ao sul de 60°S, ou seja, a Antártida),
com o Copernicus DEM GLO-90 (ESA, 3" ~ 90 m).

Baixa os blocos do AWS Open Data (copernicus-dem-90m, sem login) para
dados/copernicus_dem/, faz a média de cada célula de 30" (~1 km, a mesma
grade do SRTMGL30) e calcula o relevo com a mesma função do gerar_dados.py.
Grava entrada/relevo_copernicus.csv, que o gerar_dados.py lê sozinho.

    pip install numpy tifffile imagecodecs
    python3 dados/essenciais/relevo_copernicus.py
"""
import csv
import datetime
import json
import math
import os
import urllib.request

import numpy as np
import tifffile

import gerar_dados as g

AQUI = os.path.dirname(os.path.abspath(__file__))
PASTA = os.path.join(AQUI, "..", "copernicus_dem")
URL = "https://copernicus-dem-90m.s3.amazonaws.com/{n}/{n}.tif"
SAIDA = os.path.join(AQUI, "entrada", "relevo_copernicus.csv")
LIMITE_SRTM = -60.0


def nome_bloco(lat0, lon0):
    """lat0/lon0 = canto sul/oeste do bloco de 1°."""
    ns = ("N" if lat0 >= 0 else "S") + f"{abs(lat0):02d}"
    ew = ("E" if lon0 >= 0 else "W") + f"{abs(lon0):03d}"
    return f"Copernicus_DSM_COG_30_{ns}_00_{ew}_00_DEM"


def bloco(lat0, lon0):
    n = nome_bloco(lat0, lon0)
    os.makedirs(PASTA, exist_ok=True)
    caminho = os.path.join(PASTA, n + ".tif")
    if not os.path.exists(caminho):
        print("baixando", n)
        urllib.request.urlretrieve(URL.format(n=n), caminho)
    with tifffile.TiffFile(caminho) as t:
        p = t.pages[0]
        dlon, dlat = p.tags[33550].value[:2]
        lon_ini, lat_ini = p.tags[33922].value[3:5]    # canto noroeste
        return p.asarray().astype(float), lon_ini, lat_ini, dlon, dlat, n


def grade_30s(caixa):
    """Grade de 30" na caixa: cada célula é a média dos pixels de 90 m dentro dela."""
    lat_min, lat_max, lon_min, lon_max = caixa
    passo = g.PASSO
    lats = np.arange(lat_max - passo / 2, lat_min, -passo)
    lons = np.arange(lon_min + passo / 2, lon_max, passo)
    z = np.full((len(lats), len(lons)), np.nan)
    blocos = {}
    for i, la in enumerate(lats):
        for j, lo in enumerate(lons):
            chave = (math.floor(la), math.floor(lo))
            if chave not in blocos:
                blocos[chave] = bloco(*chave)
            dem, lon_ini, lat_ini, dlon, dlat, _ = blocos[chave]
            r0 = int((lat_ini - (la + passo / 2)) / dlat)
            r1 = int(math.ceil((lat_ini - (la - passo / 2)) / dlat))
            c0 = int((lo - passo / 2 - lon_ini) / dlon)
            c1 = int(math.ceil((lo + passo / 2 - lon_ini) / dlon))
            jan = dem[max(r0, 0):min(r1, dem.shape[0]), max(c0, 0):min(c1, dem.shape[1])]
            jan = jan[(jan != 0) & (jan > -500)]                # 0 = mar, como no SRTM30
            if jan.size:
                z[i, j] = jan.mean()
    return z, sorted(b[5] for b in blocos.values())


def main():
    locais = json.load(open(os.path.join(AQUI, "entrada", "locais_terra.json"), encoding="utf-8"))["locais"]
    linhas = []
    for l in locais:
        if l["caixa"][1] > LIMITE_SRTM:          # o SRTM30 cobre
            continue
        z, nomes = grade_30s(l["caixa"])
        m = g.metricas_relevo(z, l["lat"])
        if m is None:
            print(l["id"], "sem pixels de terra")
            continue
        linhas.append({"local_id": l["id"], **{k: round(v, 4) if isinstance(v, float) else v for k, v in m.items()},
                       "blocos": " ".join(nomes), "acesso": datetime.date.today().isoformat()})
        print(l["id"], {k: round(v, 2) for k, v in m.items() if not k.startswith("_")})
    with open(SAIDA, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["local_id", "elev_media_m", "elev_relativa_m", "declividade_media",
                                          "rugosidade_tri_m", "frac_decliv_8", "frac_transitavel_15", "_pixels",
                                          "blocos", "acesso"])
        w.writeheader()
        w.writerows(linhas)
    print("gravado", SAIDA)


if __name__ == "__main__":
    main()
