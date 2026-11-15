"""Monta os dados essenciais do Illuminat Horizontes (tela do carrinho e site).

Uso (na raiz do repositório):
    python3 dados/essenciais/gerar_dados.py
    python3 dados/essenciais/gerar_dados.py --notebook terra_locais.parquet   # ou .csv

O que faz:
1. Lê os locais da Terra (entrada/locais.csv), os valores dos alvos Lua/Marte
   (entrada/alvos_referencia.csv) e as fontes (entrada/fontes.csv).
2. Calcula o relevo de cada local direto dos 27 blocos NASA SRTMGL30 que estão em
   dados/srtm30/ (elevação, declividade, rugosidade TRI, fração transitável).
3. Usa entrada/terra_provisorio.csv para temperatura, NDVI, albedo, poeira e chuva.
   Se --notebook for passado, os valores do notebook 01 (AppEEARS/GPM) substituem
   os provisórios e passam a "medido".
4. Compara cada local com Shackleton (Lua) e Jezero (Marte) e grava:
   medidas_terra.csv, medidas_alvos.csv, resumo_locais.csv e tela_carrinho.json.

Precisa só de numpy (e pandas, apenas se usar --notebook).
"""
import argparse
import csv
import datetime as dt
import io
import json
import math
import os
import zipfile

import numpy as np

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(os.path.dirname(AQUI))
ENTRADA = os.path.join(AQUI, "entrada")
SRTM = os.path.join(RAIZ, "dados", "srtm30")
LOCAIS_SITE = os.path.join(RAIZ, "web", "data", "locais.json")
ALVOS_SITE = os.path.join(RAIZ, "web", "data", "alvos.json")

ALVOS = ["shackleton", "jezero"]

# variável -> (rótulo curto, unidade, casas decimais)
VARIAVEIS = {
    "elev_media_m":        ("Elevacao media", "m", 0),
    "elev_relativa_m":     ("Desnivel no local", "m", 0),
    "declividade_media":   ("Declividade media", "graus", 1),
    "rugosidade_tri_m":    ("Rugosidade TRI", "m", 1),
    "frac_transitavel_15": ("Area transitavel (<15 graus)", "fracao", 2),
    "lst_dia_c":           ("Temp. superficie dia", "C", 0),
    "lst_noite_c":         ("Temp. superficie noite", "C", 0),
    "amplitude_termica_c": ("Amplitude termica (dT)", "C", 0),
    "ndvi_medio":          ("Vegetacao (NDVI)", "indice", 2),
    "albedo_medio":        ("Albedo", "fracao", 2),
    "aod_medio":           ("Poeira/aerossol (AOD)", "adimensional", 2),
    "chuva_anual_mm":      ("Chuva anual", "mm", 0),
    "iluminacao_frac":     ("Iluminacao", "fracao", 2),
    "pressao_kpa":         ("Pressao do ar", "kPa", 2),
}

# Comparação Terra x alvo: similaridade = max(0, 1 - |terra - alvo| / escala)
ESCALAS = {
    "declividade_media": 15.0,
    "elev_relativa_m": 4000.0,
    "lst_noite_c": 150.0,
    "amplitude_termica_c": 120.0,
    "ndvi_medio": 0.8,
    "albedo_medio": 0.3,
    "aod_medio": 1.0,
    "chuva_anual_mm": 2000.0,
}

# colunas do notebook 01 que podem substituir valores provisórios
NOTEBOOK = {
    "lst_dia_c": "mod11a1", "lst_noite_c": "mod11a1", "amplitude_termica_c": "mod11a1",
    "ndvi_medio": "mod13a2", "albedo_medio": "mcd43a3", "aod_medio": "mcd19a2",
    "chuva_anual_mm": "gpm_imergm",
}


def ler_csv(nome):
    with open(os.path.join(ENTRADA, nome), newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


# ---------------------------------------------------------------- SRTMGL30
COLS, LINHAS, PASSO = 4800, 6000, 1 / 120
_cache = {}


def _tile(nome):
    if nome not in _cache:
        caminho = os.path.join(SRTM, f"{nome}.SRTMGL30.dem.zip")
        if not os.path.exists(caminho):
            _cache[nome] = None
        else:
            with zipfile.ZipFile(caminho) as z:
                dados = z.read(f"{nome.upper()}.DEM")
            _cache[nome] = np.frombuffer(dados, ">i2").reshape(LINHAS, COLS)
    return _cache[nome]


def _altitude_grade(lat_min, lat_max, lon_min, lon_max):
    """Grade de altitude (float, NaN = oceano/sem dado) cobrindo a caixa."""
    lats = np.arange(lat_max - PASSO / 2, lat_min, -PASSO)
    lons = np.arange(lon_min + PASSO / 2, lon_max, PASSO)
    z = np.full((len(lats), len(lons)), np.nan)
    for i, la in enumerate(lats):
        if not -60 <= la <= 90:
            continue
        lat0 = 90 if la > 40 else (40 if la > -10 else -10)
        lin = min(LINHAS - 1, int((lat0 - la) / PASSO))
        for j, lo in enumerate(lons):
            lon0 = -180 + 40 * math.floor((lo + 180) / 40)
            nome = ("w" if lon0 < 0 else "e") + f"{abs(lon0):03d}" + ("n" if lat0 > 0 else "s") + f"{abs(lat0):02d}"
            t = _tile(nome)
            if t is None:
                continue
            v = t[lin, min(COLS - 1, int((lo - lon0) / PASSO))]
            if v > 0:            # -9999 e 0 = oceano no SRTM30
                z[i, j] = v
    return z


def terreno(l):
    """Mesmas definições do notebook 01 (célula 5), aplicadas ao SRTMGL30 (~1 km)."""
    z = _altitude_grade(float(l["lat_min"]), float(l["lat_max"]), float(l["lon_min"]), float(l["lon_max"]))
    ok = ~np.isnan(z)
    if ok.sum() < 9:
        return None
    lat = float(l["lat"])
    dx = PASSO * 111_320.0 * math.cos(math.radians(lat))
    dy = PASSO * 110_540.0
    zf = np.where(ok, z, np.nanmean(z))
    dzdy, dzdx = np.gradient(zf, dy, dx)
    slope = np.degrees(np.arctan(np.hypot(dzdx, dzdy)))
    zp = np.pad(zf, 1, mode="edge")
    h, w = zf.shape
    soma = np.zeros_like(zf)
    for di in (-1, 0, 1):
        for dj in (-1, 0, 1):
            if di or dj:
                soma += (zp[1 + di:1 + di + h, 1 + dj:1 + dj + w] - zf) ** 2
    tri = np.sqrt(soma)
    return {
        "elev_media_m": float(np.nanmean(z)),
        "elev_relativa_m": -float(np.nanmax(z) - np.nanmin(z)),
        "declividade_media": float(slope[ok].mean()),
        "rugosidade_tri_m": float(tri[ok].mean()),
        "frac_transitavel_15": float(np.mean(slope[ok] < 15)),
        "_pixels": int(ok.sum()),
    }


# ---------------------------------------------------------------- montagem
def arred(var, v):
    if v is None:
        return None
    c = VARIAVEIS[var][2]
    return round(float(v), c) if c else int(round(float(v)))


def carregar_notebook(caminho):
    import pandas as pd
    df = pd.read_parquet(caminho) if caminho.endswith(".parquet") else pd.read_csv(caminho)
    apelidos = {"ndvi_medio": ["ndvi_medio", "ndvi_mediano"]}   # o notebook 01 grava ndvi_mediano
    out = {}
    for _, r in df.iterrows():
        out[r["id"]] = {}
        for k in NOTEBOOK:
            for col in apelidos.get(k, [k]):
                if col in df.columns and not pd.isna(r[col]):
                    out[r["id"]][k] = float(r[col])
                    break
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--notebook", help="terra_locais.parquet/.csv do notebook 01 (opcional)")
    args = ap.parse_args()
    hoje = dt.date.today().isoformat()

    fontes = {f["fonte_id"]: f for f in ler_csv("fontes.csv")}
    locais = ler_csv("locais.csv")
    site_locais = {l["id"]: l for l in json.load(open(LOCAIS_SITE, encoding="utf-8"))}
    site_alvos = {a["id"]: a for a in json.load(open(ALVOS_SITE, encoding="utf-8"))["alvos"]}
    sempre_quebra = json.load(open(ALVOS_SITE, encoding="utf-8"))["sempre_quebra"]
    nb = carregar_notebook(args.notebook) if args.notebook else {}

    # ---- alvos
    alvos = {a: {} for a in ALVOS}
    for r in ler_csv("alvos_referencia.csv"):
        alvos[r["alvo_id"]][r["variavel"]] = {
            "valor": float(r["valor"]), "unidade": r["unidade"], "status": r["status"],
            "fonte": r["fonte_id"], "nota": r["nota"]}

    # ---- Terra
    medidas = {l["local_id"]: {} for l in locais}
    for l in locais:
        t = terreno(l)
        for k in ("elev_media_m", "elev_relativa_m", "declividade_media", "rugosidade_tri_m", "frac_transitavel_15"):
            if t is None:
                medidas[l["local_id"]][k] = {"valor": None, "status": "sem_dado", "fonte": "srtmgl30",
                                             "nota": "fora da cobertura do SRTM30 (90N-60S); usar Copernicus DEM GLO-30"}
            else:
                medidas[l["local_id"]][k] = {"valor": t[k], "status": "medido", "fonte": "srtmgl30",
                                             "nota": f"calculado de {t['_pixels']} pixels de ~1 km na caixa do local"}
    for r in ler_csv("terra_provisorio.csv"):
        medidas[r["local_id"]][r["variavel"]] = {"valor": float(r["valor"]), "status": r["status"],
                                                 "fonte": r["fonte_id"], "nota": r["nota"]}
    for lid, vals in nb.items():
        for k, v in vals.items():
            if lid in medidas:
                medidas[lid][k] = {"valor": v, "status": "medido", "fonte": NOTEBOOK[k],
                                   "nota": "notebook 01 (AppEEARS / GPM)"}

    # ---- comparação
    resumo = []
    for l in locais:
        lid = l["local_id"]
        notas = {}
        for a in ALVOS:
            sims = {}
            for k, esc in ESCALAS.items():
                te, al = medidas[lid].get(k, {}).get("valor"), alvos[a].get(k, {}).get("valor")
                if te is not None and al is not None:
                    sims[k] = max(0.0, 1 - abs(te - al) / esc)
            notas[a] = (sum(sims.values()) / len(sims) if sims else 0.0, sims)
        melhor = max(ALVOS, key=lambda a: notas[a][0])
        completo = all(len(notas[a][1]) == len(ESCALAS) for a in ALVOS)
        resumo.append((l, notas, melhor, completo))
    # locais com variáveis faltando vão para o fim (a nota deles usa menos dados)
    resumo.sort(key=lambda x: (not x[3], -x[1][x[2]][0]))
    por_alvo = {a: [x[0]["local_id"] for x in sorted(resumo, key=lambda x: (not x[3], -x[1][a][0]))] for a in ALVOS}

    # ---- CSVs
    with open(os.path.join(AQUI, "medidas_terra.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["local_id", "variavel", "valor", "unidade", "status", "fonte_id", "short_name_versao", "doi_ou_referencia", "nota"])
        for l in locais:
            for k, m in medidas[l["local_id"]].items():
                fo = fontes[m["fonte"]]
                w.writerow([l["local_id"], k, arred(k, m["valor"]), VARIAVEIS[k][1], m["status"], m["fonte"],
                            fo["short_name_versao"], fo["doi_ou_referencia"], m["nota"]])
    with open(os.path.join(AQUI, "medidas_alvos.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["alvo_id", "variavel", "valor", "unidade", "status", "fonte_id", "doi_ou_referencia", "nota"])
        for a in ALVOS:
            for k, m in alvos[a].items():
                w.writerow([a, k, arred(k, m["valor"]), m["unidade"], m["status"], m["fonte"],
                            fontes[m["fonte"]]["doi_ou_referencia"], m["nota"]])
    with open(os.path.join(AQUI, "resumo_locais.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        cols = ["elev_media_m", "declividade_media", "rugosidade_tri_m", "frac_transitavel_15",
                "amplitude_termica_c", "ndvi_medio", "albedo_medio", "aod_medio", "chuva_anual_mm"]
        w.writerow(["posicao", "local_id", "nome", "regiao", "lat", "lon", "alvo", "nota_pct",
                    "nota_shackleton_pct", "nota_jezero_pct"] + cols + ["status_geral"])
        for i, (l, notas, melhor, completo) in enumerate(resumo, 1):
            m = medidas[l["local_id"]]
            prov = any(m[k]["status"] == "provisorio" for k in cols if k in m)
            w.writerow([i, l["local_id"], l["nome"], l["regiao"], l["lat"], l["lon"], melhor,
                        round(100 * notas[melhor][0]), round(100 * notas["shackleton"][0]), round(100 * notas["jezero"][0])]
                       + [arred(k, m.get(k, {}).get("valor")) for k in cols]
                       + ["incompleto (sem relevo SRTM30); resto provisorio" if not completo
                          else "parcial (relevo medido, resto provisorio)" if prov else "medido"])

    # ---- JSON da tela
    def bloco(m, alvo=None, sims=None):
        out = {}
        for k, v in m.items():
            d = {"rotulo": VARIAVEIS[k][0], "valor": arred(k, v["valor"]), "unidade": VARIAVEIS[k][1],
                 "status": v["status"], "fonte": v["fonte"]}
            if alvo is not None and k in alvo:
                d["valor_alvo"] = arred(k, alvo[k]["valor"])
            if sims is not None and k in sims:
                d["similaridade"] = round(sims[k], 2)
            out[k] = d
        return out

    corpo = {"shackleton": "moon", "jezero": "mars"}
    tela = {
        "projeto": "Illuminat Horizontes",
        "versao_dados": 1,
        "gerado_em": hoje,
        "legenda_status": {
            "medido": "calculado neste repositorio a partir de dados NASA",
            "referencia": "valor publicado de missao NASA (aproximado)",
            "provisorio": "estimativa temporaria; sera trocada pelo notebook 01 (AppEEARS/GPM)",
            "sem_dado": "sem cobertura no produto usado",
        },
        "metodo_nota": "media de max(0, 1 - |Terra - alvo| / escala) nas variaveis de 'escalas'",
        "escalas": ESCALAS,
        "destaque": resumo[0][0]["local_id"],
        "ranking": [x[0]["local_id"] for x in resumo],
        "destaque_candidato": next(x[0]["local_id"] for x in resumo if x[0]["papel"] == "candidato"),
        "destaque_por_alvo": {a: por_alvo[a][0] for a in ALVOS},
        "ranking_por_alvo": por_alvo,
        "sempre_quebra": sempre_quebra,
        "alvos": [],
        "locais": [],
        "fontes": {k: {"produto": v["produto"], "versao": v["short_name_versao"], "resolucao": v["resolucao"],
                       "referencia": v["doi_ou_referencia"], "link": v["link"]} for k, v in fontes.items()},
    }
    for a in ALVOS:
        s = site_alvos[a]
        tela["alvos"].append({"id": a, "nome": s["nome"], "corpo": s["corpo"], "regiao": s["regiao"],
                              "lat": s["lat"], "lon": s["lon"], "resumo": s["resumo"], "dados": bloco(alvos[a])})
    for i, (l, notas, melhor, completo) in enumerate(resumo, 1):
        sl = site_locais.get(l["local_id"], {})
        an = sl.get("analogia", {}).get(corpo[melhor], {})
        tela["locais"].append({
            "id": l["local_id"], "posicao": i, "nome": l["nome"], "nome_en": l["nome_en"],
            "regiao": l["regiao"], "cidade": l["cidade"], "papel": l["papel"], "tipo": l["tipo_en"],
            "lat": float(l["lat"]), "lon": float(l["lon"]),
            "dados_completos": completo,
            "alvo": melhor, "nota_pct": round(100 * notas[melhor][0]),
            "notas_pct": {a: round(100 * notas[a][0]) for a in ALVOS},
            "funciona": an.get("works", [""])[0], "quebra": an.get("breaks", [""])[0],
            "dados": bloco(medidas[l["local_id"]], alvos[melhor], notas[melhor][1]),
        })
    with open(os.path.join(AQUI, "tela_carrinho.json"), "w", encoding="utf-8") as f:
        json.dump(tela, f, ensure_ascii=False, indent=1)

    for l, notas, melhor, completo in resumo:
        print(f"{l['local_id']:14s} Lua {100 * notas['shackleton'][0]:5.1f}%  Marte {100 * notas['jezero'][0]:5.1f}%"
              + ("" if completo else "  (dados incompletos)"))
    print("destaque:", resumo[0][0]["local_id"], "| por alvo:", {a: por_alvo[a][0] for a in ALVOS})


if __name__ == "__main__":
    main()
