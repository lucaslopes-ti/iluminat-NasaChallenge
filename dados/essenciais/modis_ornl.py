#!/usr/bin/env python3
"""
Temperatura da superficie de cada local a 1 km, pelo servico
de recortes MODIS do ORNL DAAC (MODIS/VIIRS Land Product Subsets, NASA), sem login.
Serve enquanto a task do AppEEARS nao termina; o AppEEARS continua com prioridade.

  MYD11A2 v061 (Aqua, 8 dias, 1 km): LST_Day_1km (~13:30) e LST_Night_1km (~01:30),
                                     o mais perto da maxima e da minima do dia.
  (O albedo ficou de fora: o MCD43 nao esta disponivel nesse servico, e o
  carrinho nao tem sensor de albedo. Continua o da NASA POWER.)

Para cada data: media dos pixels validos na caixa do local (o MODIS so tem pixels
de terra, entao o mar fica de fora). Depois: media das datas do ano.
So usa a biblioteca padrao do Python. Cada pedido leva ~20 s; as respostas ficam
em dados/modis_ornl/cache/, entao da para parar e rodar de novo.

    python3 dados/essenciais/modis_ornl.py          # grava entrada/modis_ornl.csv
    python3 dados/essenciais/modis_ornl.py --ano 2023
"""
import argparse
import concurrent.futures as cf
import csv
import datetime
import json
import math
import os
import time
import urllib.request

AQUI = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(AQUI, "..", "modis_ornl", "cache")
SAIDA = os.path.join(AQUI, "entrada", "modis_ornl.csv")
API = "https://modis.ornl.gov/rst/api/v1"

# produto, banda, passo em dias, escala, faixa valida (valores crus)
BANDAS = {
    "lst_dia":   ("MYD11A2", "LST_Day_1km",     8,  0.02,  (7500, 65535)),
    "lst_noite": ("MYD11A2", "LST_Night_1km",   8,  0.02,  (7500, 65535)),
}
POR_PEDIDO = 10        # limite do servico: 10 datas por pedido


def janelas(ano, passo):
    """Intervalos de dias do ano com no maximo 10 compostos cada."""
    dias = list(range(1, 366, passo))
    for i in range(0, len(dias), POR_PEDIDO):
        bloco = dias[i:i + POR_PEDIDO]
        yield f"A{ano}{bloco[0]:03d}", f"A{ano}{bloco[-1]:03d}"


def pedir(url, arquivo):
    if os.path.exists(arquivo):
        with open(arquivo, encoding="utf-8") as f:
            return json.load(f)
    for tentativa in range(4):
        try:
            req = urllib.request.Request(url, headers={"Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=180) as r:
                dados = json.loads(r.read().decode("utf-8"))
            tmp = arquivo + ".tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(dados, f)
            os.replace(tmp, arquivo)
            return dados
        except Exception as e:                      # rede instavel: espera e tenta de novo
            print(f"  erro ({tentativa + 1}/4) {os.path.basename(arquivo)}: {e}", flush=True)
            time.sleep(10 * (tentativa + 1))
    return None


def tarefas(locais, ano):
    for l in locais:
        lat_min, lat_max, lon_min, lon_max = l["caixa"]
        lat, lon = (lat_min + lat_max) / 2, (lon_min + lon_max) / 2
        km_ab = max(1, min(100, math.ceil((lat_max - lat_min) * 111 / 2)))
        km_lr = max(1, min(100, math.ceil((lon_max - lon_min) * 111 * math.cos(math.radians(lat)) / 2)))
        for var, (prod, banda, passo, _, _) in BANDAS.items():
            for ini, fim in janelas(ano, passo):
                url = (f"{API}/{prod}/subset?latitude={lat:.4f}&longitude={lon:.4f}&band={banda}"
                       f"&startDate={ini}&endDate={fim}&kmAboveBelow={km_ab}&kmLeftRight={km_lr}")
                arq = os.path.join(CACHE, f"{l['id']}_{prod}_{banda}_{ini}_{fim}.json")
                yield l["id"], var, url, arq


def resumir(respostas):
    """{(local, var): [respostas]} -> media anual das medias de cada data."""
    out = {}
    for (lid, var), lista in respostas.items():
        _, _, _, escala, (vmin, vmax) = BANDAS[var]
        por_data = []
        for d in lista:
            for s in (d or {}).get("subset", []):
                ok = [v for v in s["data"] if v is not None and vmin <= v <= vmax]
                if ok:
                    por_data.append(sum(ok) / len(ok) * escala)
        if por_data:
            media = sum(por_data) / len(por_data)
            out.setdefault(lid, {})[var] = (media - 273.15 if var.startswith("lst") else media, len(por_data))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ano", type=int, default=2024)
    ap.add_argument("--paralelo", type=int, default=4, help="pedidos ao mesmo tempo (seja gentil com o servidor)")
    a = ap.parse_args()

    os.makedirs(CACHE, exist_ok=True)
    with open(os.path.join(AQUI, "entrada", "locais_terra.json"), encoding="utf-8") as f:
        locais = json.load(f)["locais"]
    lista = list(tarefas(locais, a.ano))
    print(f"{len(lista)} pedidos ({sum(os.path.exists(t[3]) for t in lista)} ja no cache)", flush=True)

    respostas, feitos = {}, 0
    with cf.ThreadPoolExecutor(max_workers=a.paralelo) as ex:
        futuros = {ex.submit(pedir, url, arq): (lid, var) for lid, var, url, arq in lista}
        for fut in cf.as_completed(futuros):
            respostas.setdefault(futuros[fut], []).append(fut.result())
            feitos += 1
            if feitos % 10 == 0 or feitos == len(lista):
                print(f"  {feitos}/{len(lista)}", flush=True)

    res = resumir(respostas)
    hoje = datetime.date.today().isoformat()
    with open(SAIDA, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["local_id", "lst_dia_c", "lst_noite_c",
                    "n_datas_lst_dia", "n_datas_lst_noite", "periodo", "acesso"])
        for l in locais:
            r = res.get(l["id"], {})
            val = lambda k, n=1: "" if k not in r else round(r[k][0], n)
            cnt = lambda k: r[k][1] if k in r else 0
            w.writerow([l["id"], val("lst_dia"), val("lst_noite"),
                        cnt("lst_dia"), cnt("lst_noite"), str(a.ano), hoje])
            print(f"{l['id']:14} dia {val('lst_dia')!s:>6}  noite {val('lst_noite')!s:>6}"
                  f"   ({cnt('lst_dia')}/{cnt('lst_noite')} datas)")
    print("gravado", SAIDA)


if __name__ == "__main__":
    main()
