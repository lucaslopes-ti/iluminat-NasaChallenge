"""NDVI dos locais a partir do NASA MOD13C2 v061 (NDVI mensal global, CMG 0,05°), via LP DAAC.

Uso (na raiz do repositório):
    EARTHDATA_TOKEN_FILE=caminho/earthdata_token.txt python3 dados/essenciais/ndvi_mod13c2.py 2020 2025

Precisa de um token do Earthdata (urs.earthdata.nasa.gov → Generate Token), curl e pyhdf (pip install pyhdf).
Cada arquivo mensal (~100 MB) é baixado, lido e apagado. Saída: entrada/ndvi_mod13c2.csv
(uma linha por local: média de todos os meses do período e a média de cada ano). O gerar_dados.py usa esse arquivo no lugar do NDVI provisório.
"""
import csv
import json
import os
import subprocess
import sys
import tempfile
import urllib.request

import numpy as np
from pyhdf.SD import SD, SDC

AQUI = os.path.dirname(os.path.abspath(__file__))
ENTRADA = os.path.join(AQUI, "entrada")
CAMADA = "CMG 0.05 Deg Monthly NDVI"
PASSO = 0.05  # grade 7200 x 3600, linha 0 = 90°N, coluna 0 = 180°W


def granulos(ano):
    url = ("https://cmr.earthdata.nasa.gov/search/granules.json?short_name=MOD13C2&version=061"
           f"&temporal={ano}-01-01T00:00:00Z,{ano}-12-31T23:59:59Z&page_size=50")
    with urllib.request.urlopen(url, timeout=60) as r:
        entradas = json.load(r)["feed"]["entry"]
    out = []
    for g in entradas:
        links = [l["href"] for l in g["links"] if l["href"].startswith("https") and l["href"].endswith(".hdf")]
        if links:
            out.append((g["time_start"][:7], links[0]))
    return sorted(out)


def recorte(ndvi, caixa):
    la0, la1, lo0, lo1 = caixa
    r0, r1 = int((90 - la1) / PASSO), int(np.ceil((90 - la0) / PASSO))
    c0, c1 = int((lo0 + 180) / PASSO), int(np.ceil((lo1 + 180) / PASSO))
    bloco = ndvi[r0:max(r1, r0 + 1), c0:max(c1, c0 + 1)].astype(float)
    bloco = bloco[(bloco >= -2000) & (bloco <= 10000)] * 0.0001  # fill = -3000; fator de escala 0,0001
    return float(bloco.mean()) if bloco.size else None


def main():
    ano0 = int(sys.argv[1]) if len(sys.argv) > 1 else 2020
    ano1 = int(sys.argv[2]) if len(sys.argv) > 2 else ano0
    token = "".join(open(os.environ["EARTHDATA_TOKEN_FILE"]).read().split())
    with open(os.path.join(ENTRADA, "locais_terra.json"), encoding="utf-8") as f:
        locais = json.load(f)["locais"]
    meses, exemplo = {}, None
    for ano in range(ano0, ano1 + 1):
        for mes, url in granulos(ano):
            exemplo = exemplo or url
            with tempfile.TemporaryDirectory() as tmp:
                arq = os.path.join(tmp, "m.hdf")
                r = subprocess.run(["curl", "-sSfL", "-m", "900", "-H", f"Authorization: Bearer {token}", "-o", arq, url],
                                   capture_output=True, text=True)
                if r.returncode != 0:  # não mostra o comando (tem o token)
                    sys.exit(f"falha ao baixar {mes}: {r.stderr.strip()}")
                ndvi = SD(arq, SDC.READ).select(CAMADA)[:]
            meses[mes] = {l["id"]: recorte(ndvi, l["caixa"]) for l in locais}
            print("MOD13C2", mes, "ok", flush=True)
    anos = list(range(ano0, ano1 + 1))
    with open(os.path.join(ENTRADA, "ndvi_mod13c2.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["local_id", "ndvi_medio", "n_meses", "periodo"] + [f"ndvi_{a}" for a in anos] + ["produto", "url_exemplo"])
        for l in locais:
            todos = [v[l["id"]] for v in meses.values() if v[l["id"]] is not None]
            por_ano = []
            for a in anos:
                va = [v[l["id"]] for m, v in meses.items() if m.startswith(str(a)) and v[l["id"]] is not None]
                por_ano.append(round(float(np.mean(va)), 3) if va else "")
            w.writerow([l["id"], round(float(np.mean(todos)), 3) if todos else "", len(todos), f"{ano0}-{ano1}"]
                       + por_ano + ["MOD13C2.061", exemplo])


if __name__ == "__main__":
    main()
