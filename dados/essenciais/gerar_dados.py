"""Monta os dados de analogia do Illuminat Horizontes (tela do carrinho, site e relatório).

Uso (na raiz do repositório):
    python3 dados/essenciais/gerar_dados.py                      # usa o que está em entrada/
    python3 dados/essenciais/gerar_dados.py --baixar-power       # baixa de novo a NASA POWER
    python3 dados/essenciais/gerar_dados.py --appeears PASTA     # CSVs de Point Sample do AppEEARS
    python3 dados/essenciais/gerar_dados.py --notebook terra_locais.parquet

Entradas (pasta entrada/):
    locais_terra.json     locais da Terra, tags por dimensão, funciona/quebra, testes, referências
    alvos.json            alvos na Lua e em Marte (regiões Artemis III, pouso humano, rovers)
    criterios_base.json   como a NASA escolhe base/pouso e a regra para testar cada critério na Terra
    dimensoes.json        9 dimensões, indicadores, sigmas e pesos por perfil de missão
    nasa_power/*.json     respostas da NASA POWER (temperatura de superfície, albedo, poeira, chuva, vento)
    ndvi_mod13c2.csv      NDVI MOD13C2 2020-2025 (gerado por ndvi_mod13c2.py)
    terra_provisorio.csv  o que ainda não tem dado real
    fontes.csv            catálogo de fontes (short name, versão, DOI, resolução, acesso)

Calculado aqui:
    relevo -> 27 blocos NASA SRTMGL30 em dados/srtm30/
    luz    -> geometria solar a partir da latitude e da obliquidade de cada corpo

Ordem de prioridade dos valores da Terra: AppEEARS/notebook > NASA POWER > provisório.
Só precisa de numpy (pandas apenas para --appeears / --notebook).
"""
import argparse
import csv
import datetime as dt
import glob
import json
import math
import os
import time
import urllib.request
import zipfile

import numpy as np

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(os.path.dirname(AQUI))
ENTRADA = os.path.join(AQUI, "entrada")
PASTA_POWER = os.path.join(ENTRADA, "nasa_power")
SRTM = os.path.join(RAIZ, "dados", "srtm30")

# variável -> (rótulo sem acento, para o terminal; unidade; casas decimais)
VARIAVEIS = {
    "elev_media_m":            ("Elevacao media", "m", 0),
    "elev_relativa_m":         ("Desnivel no local", "m", 0),
    "declividade_media":       ("Declividade media", "graus", 1),
    "rugosidade_tri_m":        ("Rugosidade TRI", "m", 1),
    "frac_decliv_8":           ("Area com declividade < 8 graus", "fracao", 2),
    "frac_transitavel_15":     ("Area com declividade < 15 graus", "fracao", 2),
    "sol_max_graus":           ("Altura maxima do Sol", "graus", 1),
    "frac_sol_baixo":          ("Luz com Sol abaixo de 10 graus", "fracao", 2),
    "frac_ano_sol_continuo":   ("Ano com Sol 24 h", "fracao", 2),
    "frac_ano_noite_continua": ("Ano com noite 24 h", "fracao", 2),
    "insolacao_toa_wm2":       ("Sol no topo da atmosfera", "W/m2", 0),
    "iluminacao_frac":         ("Iluminacao (com relevo)", "fracao", 2),
    "lst_dia_c":               ("Temp. superficie maxima", "C", 0),
    "lst_noite_c":             ("Temp. superficie minima", "C", 0),
    "amplitude_termica_c":     ("Amplitude termica (dT)", "C", 0),
    "temp_media_c":            ("Temp. superficie media", "C", 0),
    "temp_ar_c":               ("Temp. do ar a 2 m", "C", 0),
    "amplitude_ar_c":          ("Variacao diaria do ar", "C", 0),
    "temp_subsolo_c":          ("Temp. no subsolo", "C", 0),
    "ndvi_medio":              ("Vegetacao (NDVI)", "indice", 2),
    "albedo_medio":            ("Albedo", "fracao", 2),
    "aod_medio":               ("Poeira/aerossol (AOD)", "adimensional", 2),
    "vento_10m_ms":            ("Vento a 10 m", "m/s", 1),
    "chuva_anual_mm":          ("Chuva anual", "mm", 0),
    "pressao_kpa":             ("Pressao do ar", "kPa", 2),
    "gravidade_g":             ("Gravidade", "g", 2),
    "dia_local_h":             ("Duracao do dia", "h", 1),
}

CORPOS = {"earth": (23.44, 1361.0), "moon": (1.54, 1361.0), "mars": (25.19, 586.0)}  # obliquidade, W/m2

NOTEBOOK = {"lst_dia_c": "mod11a1", "lst_noite_c": "mod11a1", "amplitude_termica_c": "mod11a1",
            "ndvi_medio": "mod13a2", "albedo_medio": "mcd43a3", "aod_medio": "mcd19a2", "chuva_anual_mm": "gpm_imergm"}

POWER_PARAMS = "TS,TS_MAX,TS_MIN,T2M,T2M_RANGE,PRECTOTCORR,ALLSKY_SRF_ALB,AOD_55,WS10M"


def ler_json(nome):
    with open(os.path.join(ENTRADA, nome), encoding="utf-8") as f:
        return json.load(f)


def ler_csv(nome):
    with open(os.path.join(ENTRADA, nome), newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def arred(var, v):
    if v is None:
        return None
    c = VARIAVEIS[var][2]
    return round(float(v), c) if c else int(round(float(v)))


# ---------------------------------------------------------------- relevo (SRTMGL30)
COLS, LINHAS, PASSO = 4800, 6000, 1 / 120
_cache = {}


def _tile(nome):
    if nome not in _cache:
        caminho = os.path.join(SRTM, f"{nome}.SRTMGL30.dem.zip")
        if not os.path.exists(caminho):
            _cache[nome] = None
        else:
            with zipfile.ZipFile(caminho) as z:
                _cache[nome] = np.frombuffer(z.read(f"{nome.upper()}.DEM"), ">i2").reshape(LINHAS, COLS)
    return _cache[nome]


def _grade(lat_min, lat_max, lon_min, lon_max):
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
            if t is not None:
                v = t[lin, min(COLS - 1, int((lo - lon0) / PASSO))]
                if v != -9999 and v != 0 and v > -500:  # -9999 e 0 = oceano; Dallol fica abaixo do nivel do mar
                    z[i, j] = v
    return z


def terreno(lat, caixa):
    """Definições do notebook 01 (célula 5) aplicadas ao SRTMGL30 (~1 km)."""
    z = _grade(*caixa)
    ok = ~np.isnan(z)
    if ok.sum() < 9:
        return None
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
    return {
        "elev_media_m": float(np.nanmean(z)),
        "elev_relativa_m": -float(np.nanmax(z) - np.nanmin(z)),
        "declividade_media": float(slope[ok].mean()),
        "rugosidade_tri_m": float(np.sqrt(soma)[ok].mean()),
        "frac_decliv_8": float(np.mean(slope[ok] < 8)),
        "frac_transitavel_15": float(np.mean(slope[ok] < 15)),
        "_pixels": int(ok.sum()),
    }


# ---------------------------------------------------------------- luz (geometria solar)
def luz(lat, corpo):
    """Horizonte plano e órbita circular: 360 'dias' x 360 ângulos horários."""
    obl, s0 = CORPOS[corpo]
    phi = math.radians(lat)
    k = np.arange(360)
    dec = np.arcsin(math.sin(math.radians(obl)) * np.sin(2 * np.pi * k / 360))[:, None]
    hora = np.radians(np.arange(360))[None, :]
    sen = math.sin(phi) * np.sin(dec) + math.cos(phi) * np.cos(dec) * np.cos(hora)
    el = np.degrees(np.arcsin(np.clip(sen, -1, 1)))
    dia = el > 0
    return {
        "sol_max_graus": float(el.max()),
        "frac_sol_baixo": float((dia & (el < 10)).sum() / max(dia.sum(), 1)),
        "frac_ano_sol_continuo": float(np.mean(el.min(axis=1) > 0)),
        "frac_ano_noite_continua": float(np.mean(el.max(axis=1) <= 0)),
        "insolacao_toa_wm2": float(s0 * np.clip(sen, 0, None).mean()),
    }


# ---------------------------------------------------------------- NASA POWER
def baixar_power(locais):
    os.makedirs(PASTA_POWER, exist_ok=True)
    for l in locais:
        url = ("https://power.larc.nasa.gov/api/temporal/climatology/point"
               f"?parameters={POWER_PARAMS}&community=AG&longitude={l['lon']}&latitude={l['lat']}&format=JSON")
        with urllib.request.urlopen(url, timeout=120) as r:
            dados = json.load(r)
        with open(os.path.join(PASTA_POWER, f"{l['id']}.json"), "w", encoding="utf-8") as f:
            json.dump(dados, f)
        print("POWER ok:", l["id"])
        time.sleep(1)


def carregar_power(lid):
    caminho = os.path.join(PASTA_POWER, f"{lid}.json")
    if not os.path.exists(caminho):
        return {}
    with open(caminho, encoding="utf-8") as f:
        p = json.load(f)["properties"]["parameter"]
    meses = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]

    def media(par):
        v = [p[par][m] for m in meses if p.get(par, {}).get(m, -999) != -999]
        return float(np.mean(v)) if v else None

    tmax, tmin = media("TS_MAX"), media("TS_MIN")
    out = {
        "lst_dia_c": (tmax, "TS_MAX: maxima da temperatura da superficie, media dos 12 meses (MERRA-2)"),
        "lst_noite_c": (tmin, "TS_MIN: minima da temperatura da superficie, media dos 12 meses (MERRA-2)"),
        "amplitude_termica_c": (None if tmax is None or tmin is None else tmax - tmin, "TS_MAX - TS_MIN"),
        "temp_media_c": (p["TS"]["ANN"], "TS: temperatura da superficie, media anual (MERRA-2)"),
        "temp_ar_c": (p["T2M"]["ANN"], "T2M: temperatura do ar a 2 m, media anual (MERRA-2); compara com o sensor do carrinho"),
        "amplitude_ar_c": (p["T2M_RANGE"]["ANN"], "T2M_RANGE: variacao diaria tipica do ar a 2 m, media anual (MERRA-2)"),
        "albedo_medio": (p["ALLSKY_SRF_ALB"]["ANN"], "ALLSKY_SRF_ALB: albedo da superficie, ceu real (CERES SYN1deg)"),
        "aod_medio": (p["AOD_55"]["ANN"], "AOD_55: profundidade optica de aerossol em 550 nm (MERRA-2)"),
        "chuva_anual_mm": (p["PRECTOTCORR"]["ANN"] * 365.25, "PRECTOTCORR: chuva corrigida, media anual (MERRA-2/GPM)"),
        "vento_10m_ms": (p["WS10M"]["ANN"], "WS10M: vento a 10 m, media anual (MERRA-2)"),
    }
    return {k: {"valor": v, "status": "medido", "fonte": "nasa_power", "nota": n}
            for k, (v, n) in out.items() if v is not None and v != -999}


# ---------------------------------------------------------------- AppEEARS / notebook 01
def carregar_notebook(caminho):
    import pandas as pd
    df = pd.read_parquet(caminho) if caminho.endswith(".parquet") else pd.read_csv(caminho)
    apelidos = {"ndvi_medio": ["ndvi_medio", "ndvi_mediano"]}
    out = {}
    for _, r in df.iterrows():
        out[r["id"]] = {}
        for k in NOTEBOOK:
            for col in apelidos.get(k, [k]):
                if col in df.columns and not pd.isna(r[col]):
                    out[r["id"]][k] = float(r[col])
                    break
    return out


def carregar_appeears(pasta, locais):
    """CSVs de Point Sample (um por produto). Cada ponto vai para o local cuja caixa o contém."""
    import pandas as pd
    camadas = {("MOD11A1", "LST_Day_1km"): "lst_dia_terra_k", ("MOD11A1", "LST_Night_1km"): "lst_noite_terra_k",
               ("MYD11A1", "LST_Day_1km"): "lst_dia_aqua_k", ("MYD11A1", "LST_Night_1km"): "lst_noite_aqua_k",
               ("MOD13A2", "_1_km_16_days_NDVI"): "ndvi", ("MCD43A3", "Albedo_WSA_shortwave"): "albedo",
               ("MCD19A2", "Optical_Depth_055"): "aod"}
    escala = {"lst": (0.02, 1000), "ndvi": (0.0001, 1.5), "albedo": (0.001, 1.5), "aod": (0.001, 10)}
    faixa = {"lst": (150, 400), "ndvi": (-0.2, 1.0), "albedo": (0.0, 1.0), "aod": (-0.1, 5.0)}
    series = {l["id"]: {} for l in locais}
    for arq in glob.glob(os.path.join(pasta, "**", "*.csv"), recursive=True):
        df = pd.read_csv(arq)
        if "Latitude" not in df.columns:
            continue
        for (prod, trecho), var in camadas.items():
            cols = [c for c in df.columns if prod in c and c.endswith(trecho)]
            if not cols:
                continue
            tipo = "lst" if var.startswith("lst") else var
            for l in locais:
                la0, la1, lo0, lo1 = l["caixa"]
                d = df[df.Latitude.between(la0, la1) & df.Longitude.between(lo0, lo1)]
                v = pd.to_numeric(d[cols[0]], errors="coerce").dropna()
                if v.empty:
                    continue
                if v.median() > escala[tipo][1]:
                    v = v * escala[tipo][0]
                v = v[v.between(*faixa[tipo])]
                series[l["id"]].setdefault(var, []).extend(v.tolist())
    out = {}
    for lid, s in series.items():
        o = {}
        dia = s.get("lst_dia_aqua_k") or s.get("lst_dia_terra_k")
        noite = s.get("lst_noite_aqua_k") or s.get("lst_noite_terra_k")
        if dia:
            o["lst_dia_c"] = float(np.mean(dia)) - 273.15
        if noite:
            o["lst_noite_c"] = float(np.mean(noite)) - 273.15
        if dia and noite:
            o["amplitude_termica_c"] = o["lst_dia_c"] - o["lst_noite_c"]
        for var, alvo in (("ndvi", "ndvi_medio"), ("albedo", "albedo_medio"), ("aod", "aod_medio")):
            if s.get(var):
                o[alvo] = float(np.mean(s[var]))
        if o:
            out[lid] = o
    return out


# ---------------------------------------------------------------- comparação
def gauss(a, b, sigma):
    return math.exp(-((a - b) ** 2) / (2 * sigma ** 2))


def jaccard(a, b):
    a, b = set(a), set(b)
    if not a and not b:
        return None
    return len(a & b) / len(a | b)


def comparar(terra, alvo, dims):
    out = {}
    for d in dims:
        ind = {}
        for var, sigma in d["indicadores"]:
            if var == "tags":
                j = jaccard(terra["tags"].get(d["id"], []), alvo["tags"].get(d["id"], []))
                if j is not None:
                    ind["tags"] = round(j, 2)
            else:
                a = terra["valores"].get(var, {}).get("valor")
                b = alvo["valores"].get(var, {}).get("valor")
                if a is not None and b is not None:
                    ind[var] = round(gauss(a, b, sigma), 2)
        out[d["id"]] = {"nota": round(sum(ind.values()) / len(ind), 2) if ind else None, "indicadores": ind}
    return out


def iap(notas, pesos):
    num = den = 0.0
    for dim, w in pesos.items():
        n = notas[dim]["nota"]
        if n is not None and w:
            num += w * n
            den += w
    return round(100 * num / den) if den else None


def avaliar_regra(regra, terra):
    if regra is None:
        return None
    todas = {t for v in terra["tags"].values() for t in v}
    if "tag" in regra:
        return regra["tag"] in todas
    if "tags_qualquer" in regra:
        return bool(todas & set(regra["tags_qualquer"]))
    v = terra["valores"].get(regra["variavel"], {}).get("valor")
    if v is None:
        return None
    return v >= regra["valor"] if regra["op"] == ">=" else v <= regra["valor"]


# ---------------------------------------------------------------- principal
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--baixar-power", action="store_true", help="baixa de novo a climatologia da NASA POWER")
    ap.add_argument("--notebook", help="terra_locais.parquet/.csv do notebook 01")
    ap.add_argument("--appeears", help="pasta com os CSVs de Point Sample baixados do AppEEARS")
    args = ap.parse_args()

    fontes = {f["fonte_id"]: f for f in ler_csv("fontes.csv")}
    locais = ler_json("locais_terra.json")["locais"]
    cfg_alvos = ler_json("alvos.json")
    criterios = ler_json("criterios_base.json")
    cfg = ler_json("dimensoes.json")
    dims, perfis = cfg["dimensoes"], cfg["perfis"]
    if args.baixar_power:
        baixar_power(locais)

    # ---- alvos
    alvos = []
    for a in cfg_alvos["alvos"]:
        pad = cfg_alvos["padroes"][a["padrao"]]
        vals = {}
        for grupo in (pad["valores"], a["valores"]):
            for k, (v, f, nota) in grupo.items():
                vals[k] = {"valor": v, "status": "referencia", "fonte": f, "nota": nota}
        for k, v in luz(a["lat"], pad["corpo"]).items():
            vals[k] = {"valor": v, "status": "calculado", "fonte": "calculo_solar", "nota": "horizonte plano"}
        tags = dict(pad["tags"])
        tags.update(a.get("tags", {}))
        alvos.append({**{k: v for k, v in a.items() if k not in ("valores", "tags", "padrao")},
                      "corpo": pad["corpo"], "valores": vals, "tags": tags})

    # ---- Terra
    externos, origem, fonte_ext = {}, None, NOTEBOOK
    if args.notebook:
        externos, origem = carregar_notebook(args.notebook), "notebook 01 (AppEEARS / GPM)"
    elif args.appeears:
        externos, origem = carregar_appeears(args.appeears, locais), "CSVs do AppEEARS (Point Sample)"
    prov = {}
    for r in ler_csv("terra_provisorio.csv"):
        prov.setdefault(r["local_id"], {})[r["variavel"]] = {
            "valor": float(r["valor"]), "status": "provisorio", "fonte": r["fonte_id"], "nota": r["nota"]}

    ndvi_mod13c2 = {}
    caminho_ndvi = os.path.join(ENTRADA, "ndvi_mod13c2.csv")
    if os.path.exists(caminho_ndvi):
        for r in ler_csv("ndvi_mod13c2.csv"):
            if r["ndvi_medio"]:
                ndvi_mod13c2[r["local_id"]] = {"ndvi_medio": {
                    "valor": float(r["ndvi_medio"]), "status": "medido", "fonte": "mod13c2",
                    "nota": f"media de {r['n_meses']} meses ({r.get('periodo', '2024')}) na caixa do local (CMG 0,05 grau)"}}

    terra = []
    for l in locais:
        vals = {}
        t = terreno(l["lat"], l["caixa"])
        for k in ("elev_media_m", "elev_relativa_m", "declividade_media", "rugosidade_tri_m", "frac_decliv_8", "frac_transitavel_15"):
            vals[k] = ({"valor": t[k], "status": "medido", "fonte": "srtmgl30",
                        "nota": f"{t['_pixels']} pixels de ~1 km na caixa do local"} if t else
                       {"valor": None, "status": "sem_dado", "fonte": "srtmgl30",
                        "nota": "fora da cobertura do SRTM30 (90N-60S); usar Copernicus DEM GLO-30"})
        for k, v in luz(l["lat"], "earth").items():
            vals[k] = {"valor": v, "status": "calculado", "fonte": "calculo_solar", "nota": "horizonte plano"}
        vals.update(prov.get(l["id"], {}))
        vals.update(carregar_power(l["id"]))
        vals.update(ndvi_mod13c2.get(l["id"], {}))
        for k, v in externos.get(l["id"], {}).items():
            vals[k] = {"valor": v, "status": "medido", "fonte": fonte_ext[k], "nota": origem}
        vals["pressao_kpa"] = {"valor": 101.3 * math.exp(-(vals["elev_media_m"]["valor"] or 0) / 8400),
                               "status": "calculado", "fonte": "fisica", "nota": "atmosfera padrao pela altitude"}
        vals["gravidade_g"] = {"valor": 1.0, "status": "referencia", "fonte": "fisica", "nota": ""}
        vals["dia_local_h"] = {"valor": 24.0, "status": "referencia", "fonte": "fisica", "nota": ""}
        terra.append({**{k: v for k, v in l.items() if k != "tags"}, "valores": vals, "tags": l["tags"]})

    # ---- comparação de todos com todos
    resultados = {}
    for t in terra:
        resultados[t["id"]] = {}
        for a in alvos:
            notas = comparar(t, a, dims)
            resultados[t["id"]][a["id"]] = {"dimensoes": notas, "iap": {p["id"]: iap(notas, p["pesos"]) for p in perfis}}

    def melhor_alvo(tid, perfil="geral"):
        return max(alvos, key=lambda a: resultados[tid][a["id"]]["iap"][perfil] or 0)["id"]

    completo = {t["id"]: all(t["valores"].get(k, {}).get("valor") is not None for k in ("declividade_media", "lst_dia_c"))
                for t in terra}
    rank = {p["id"]: sorted(terra, key=lambda t: (not completo[t["id"]],
                                                  -(resultados[t["id"]][melhor_alvo(t["id"], p["id"])]["iap"][p["id"]] or 0)))
            for p in perfis}
    por_alvo = {a["id"]: [t["id"] for t in sorted(terra, key=lambda t: (not completo[t["id"]],
                                                                         -resultados[t["id"]][a["id"]]["iap"]["geral"]))]
                for a in alvos}

    crit_terra = {t["id"]: {} for t in terra}
    for corpo in ("lua", "marte"):
        for c in criterios[corpo]["criterios"]:
            for t in terra:
                crit_terra[t["id"]][f"{corpo}.{c['id']}"] = avaliar_regra(c["regra"], t)

    validacao = {}
    for p in perfis:
        ids = [t["id"] for t in rank[p["id"]]]
        validacao[p["id"]] = {t["id"]: ids.index(t["id"]) + 1 for t in terra if t["papel"] == "referencia"}

    gerar_saidas(terra, alvos, dims, perfis, cfg, criterios, fontes, resultados, rank, por_alvo,
                 completo, crit_terra, validacao, melhor_alvo)


def melhor_par(terra, alvos, resultados, completo, corpo, perfil="geral"):
    """Melhor par (local da Terra, alvo) para um corpo."""
    pares = [(t, a) for t in terra for a in alvos if a["corpo"] == corpo and completo[t["id"]]]
    t, a = max(pares, key=lambda p: resultados[p[0]["id"]][p[1]["id"]]["iap"][perfil] or 0)
    return {"local": t["id"], "alvo": a["id"], "iap": resultados[t["id"]][a["id"]]["iap"][perfil]}


def bloco_valores(vals):
    out = {}
    for k, v in vals.items():
        out[k] = {"rotulo": VARIAVEIS[k][0], "valor": arred(k, v["valor"]), "unidade": VARIAVEIS[k][1],
                  "status": v["status"], "fonte": v["fonte"]}
        if v.get("nota"):
            out[k]["nota"] = v["nota"]
    return out


def gerar_saidas(terra, alvos, dims, perfis, cfg, criterios, fontes, resultados, rank, por_alvo,
                 completo, crit_terra, validacao, melhor_alvo):
    hoje = dt.date.today().isoformat()
    alvo_por_id = {a["id"]: a for a in alvos}
    rot_dim = {d["id"]: d["rotulo"] for d in dims}
    legenda = {
        "medido": "medido por satelite/modelo da NASA e processado neste repositorio",
        "calculado": "calculado por fisica (geometria solar, pressao pela altitude)",
        "referencia": "valor publicado por missao NASA/ESA/JAXA (aproximado)",
        "provisorio": "estimativa temporaria; nenhum produto NASA usado cobre o local",
        "sem_dado": "sem cobertura no produto usado",
    }
    geral = rank["geral"]
    candidatos = [t for t in geral if t["papel"] == "candidato"]
    descobertas = [t for t in geral if t["papel"] == "descoberta"]

    def resumo_local(t, pos):
        ba = melhor_alvo(t["id"])
        r = resultados[t["id"]][ba]
        validas = [d for d, v in r["dimensoes"].items() if v["nota"] is not None]
        validas.sort(key=lambda d: -r["dimensoes"][d]["nota"])
        return {
            "id": t["id"], "posicao": pos, "nome": t["nome"], "nome_en": t["nome_en"], "regiao": t["regiao"],
            "pais": t["pais"], "cidade": t["cidade"], "papel": t["papel"], "lat": t["lat"], "lon": t["lon"],
            "feicao": t["feicao"], "dados_completos": completo[t["id"]],
            "alvo": ba, "alvo_nome": alvo_por_id[ba]["nome"], "corpo": alvo_por_id[ba]["corpo"],
            "nota_pct": r["iap"]["geral"], "notas_perfil_pct": r["iap"],
            "dimensao_mais_forte": rot_dim[validas[0]], "dimensao_mais_fraca": rot_dim[validas[-1]],
            "dimensoes_pct": {d: None if v["nota"] is None else round(100 * v["nota"]) for d, v in r["dimensoes"].items()},
            "funciona": t["funciona"], "quebra": t["quebra"], "testes": t["testes"],
        }

    # ---------------- analogos_completo.json
    saida = {
        "projeto": "Illuminat Horizontes", "versao_dados": 2, "gerado_em": hoje, "legenda_status": legenda,
        "metodo": {
            "indicador_numerico": "S = exp(-(Terra - alvo)^2 / (2 sigma^2))",
            "indicador_tags": "Jaccard: tags em comum / tags no total",
            "dimensao": "media dos indicadores disponiveis",
            "iap": "Indice de Analogia Planetaria = media ponderada das dimensoes pelo perfil de missao (0-100)",
            "dimensoes": dims, "perfis": perfis,
        },
        "sempre_quebra": cfg["sempre_quebra"],
        "criterios_base": criterios,
        "destaques": {
            "geral": geral[0]["id"], "candidato_brasil": candidatos[0]["id"], "descoberta": descobertas[0]["id"],
            "por_perfil": {p: rank[p][0]["id"] for p in rank},
            "por_alvo": {a: ids[0] for a, ids in por_alvo.items()},
            "lua": melhor_par(terra, alvos, resultados, completo, "moon"),
            "marte": melhor_par(terra, alvos, resultados, completo, "mars"),
        },
        "ranking": {p: [t["id"] for t in rank[p]] for p in rank},
        "ranking_por_alvo": por_alvo,
        "validacao_referencias": validacao,
        "alvos": [{**{k: v for k, v in a.items() if k != "valores"}, "valores": bloco_valores(a["valores"])} for a in alvos],
        "locais": [],
        "fontes": {k: {"produto": v["produto"], "versao": v["short_name_versao"], "missao": v["missao_instrumento"],
                       "resolucao": v["resolucao"], "referencia": v["doi_ou_referencia"], "link": v["link"],
                       "acesso": v["acesso"]} for k, v in fontes.items()},
    }
    for pos, t in enumerate(geral, 1):
        item = resumo_local(t, pos)
        item.update({"caixa": t["caixa"], "diametro_km": t.get("diametro_km"), "processos": t["processos"],
                     "referencias": t["referencias"], "coord_aprox": t.get("coord_aprox", False), "tags": t["tags"],
                     "valores": bloco_valores(t["valores"]), "criterios_base": crit_terra[t["id"]],
                     "comparacoes": {a: {"iap": c["iap"],
                                         "dimensoes_pct": {d: None if v["nota"] is None else round(100 * v["nota"])
                                                           for d, v in c["dimensoes"].items()}}
                                     for a, c in resultados[t["id"]].items()}})
        saida["locais"].append(item)
    with open(os.path.join(AQUI, "analogos_completo.json"), "w", encoding="utf-8") as f:
        json.dump(saida, f, ensure_ascii=False, indent=1)

    # ---------------- tela_carrinho.json (compacto, para o ESP32 / C)
    chaves = ["elev_media_m", "declividade_media", "frac_decliv_8", "sol_max_graus", "frac_ano_sol_continuo",
              "lst_dia_c", "lst_noite_c", "amplitude_termica_c", "temp_media_c", "temp_ar_c", "amplitude_ar_c", "ndvi_medio", "albedo_medio", "aod_medio",
              "vento_10m_ms", "chuva_anual_mm", "pressao_kpa"]
    tela = {
        "projeto": "Illuminat Horizontes", "versao_dados": 2, "gerado_em": hoje, "legenda_status": legenda,
        "destaque": candidatos[0]["id"], "destaque_geral": geral[0]["id"], "destaque_descoberta": descobertas[0]["id"],
        "destaque_por_perfil": {p: rank[p][0]["id"] for p in rank},
        "destaque_lua": melhor_par(terra, alvos, resultados, completo, "moon"),
        "destaque_marte": melhor_par(terra, alvos, resultados, completo, "mars"),
        "melhor_analogo_por_alvo": {a: ids[0] for a, ids in por_alvo.items()},
        "perfis": [{"id": p["id"], "rotulo": p["rotulo"]} for p in perfis],
        "rotulos_dimensoes": rot_dim,
        "sempre_quebra": [s["texto"] for s in cfg["sempre_quebra"]],
        "alvos": [{"id": a["id"], "nome": a["nome"], "corpo": a["corpo"], "papel": a["papel"],
                   "lat": a["lat"], "lon": a["lon"], "resumo": a["resumo"]} for a in alvos],
        "locais": [],
    }
    for pos, t in enumerate(geral, 1):
        r = resumo_local(t, pos)
        alvo = alvo_por_id[r["alvo"]]
        dados = {}
        for k in chaves:
            v = t["valores"].get(k)
            if v is None:
                continue
            d = {"rotulo": VARIAVEIS[k][0], "valor": arred(k, v["valor"]), "unidade": VARIAVEIS[k][1],
                 "status": v["status"], "fonte": v["fonte"]}
            if k in alvo["valores"]:
                d["valor_alvo"] = arred(k, alvo["valores"][k]["valor"])
            dados[k] = d
        tela["locais"].append({
            "id": r["id"], "posicao": pos, "nome": r["nome"], "regiao": r["regiao"], "pais": r["pais"], "papel": r["papel"],
            "lat": r["lat"], "lon": r["lon"], "feicao": r["feicao"], "dados_completos": r["dados_completos"],
            "alvo": r["alvo"], "alvo_nome": r["alvo_nome"], "corpo": r["corpo"],
            "nota_pct": r["nota_pct"], "notas_perfil_pct": r["notas_perfil_pct"], "dimensoes_pct": r["dimensoes_pct"],
            "funciona": t["funciona"][0], "quebra": t["quebra"][0], "teste": t["testes"][0], "dados": dados,
        })
    with open(os.path.join(AQUI, "tela_carrinho.json"), "w", encoding="utf-8") as f:
        json.dump(tela, f, ensure_ascii=False, indent=1)

    # ---------------- CSVs
    def escrever(nome, cab, linhas):
        with open(os.path.join(AQUI, nome), "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(cab)
            w.writerows(linhas)

    escrever("medidas_terra.csv",
             ["local_id", "variavel", "valor", "unidade", "status", "fonte_id", "short_name_versao", "doi_ou_referencia", "nota"],
             [[t["id"], k, arred(k, v["valor"]), VARIAVEIS[k][1], v["status"], v["fonte"],
               fontes[v["fonte"]]["short_name_versao"], fontes[v["fonte"]]["doi_ou_referencia"], v.get("nota", "")]
              for t in terra for k, v in t["valores"].items()])
    escrever("medidas_alvos.csv",
             ["alvo_id", "corpo", "variavel", "valor", "unidade", "status", "fonte_id", "doi_ou_referencia", "nota"],
             [[a["id"], a["corpo"], k, arred(k, v["valor"]), VARIAVEIS[k][1], v["status"], v["fonte"],
               fontes[v["fonte"]]["doi_ou_referencia"], v.get("nota", "")] for a in alvos for k, v in a["valores"].items()])
    escrever("notas_dimensoes.csv", ["local_id", "alvo_id", "dimensao", "nota", "indicadores"],
             [[t["id"], a["id"], d, v["nota"], json.dumps(v["indicadores"])]
              for t in terra for a in alvos for d, v in resultados[t["id"]][a["id"]]["dimensoes"].items()])
    escrever("ranking.csv",
             ["posicao", "local_id", "nome", "pais", "papel", "melhor_alvo"] + [f"iap_{p['id']}" for p in perfis]
             + [f"dim_{d['id']}" for d in dims] + ["dados_completos"],
             [[i, t["id"], t["nome"], t["pais"], t["papel"], melhor_alvo(t["id"])]
              + [resultados[t["id"]][melhor_alvo(t["id"])]["iap"][p["id"]] for p in perfis]
              + [resultados[t["id"]][melhor_alvo(t["id"])]["dimensoes"][d["id"]]["nota"] for d in dims]
              + [completo[t["id"]]] for i, t in enumerate(geral, 1)])
    crits = list(next(iter(crit_terra.values())).keys())
    escrever("criterios_terra.csv", ["local_id"] + crits,
             [[t["id"]] + ["" if crit_terra[t["id"]][c] is None else ("sim" if crit_terra[t["id"]][c] else "nao") for c in crits]
              for t in terra])

    print("Ranking geral (melhor alvo de cada local):")
    for i, t in enumerate(geral, 1):
        ba = melhor_alvo(t["id"])
        print(f"{i:2d}. {t['id']:14s} {t['papel']:10s} -> {ba:20s} IAP {resultados[t['id']][ba]['iap']['geral']:3d}"
              + ("" if completo[t["id"]] else "  (dados incompletos)"))
    print("Lua:", melhor_par(terra, alvos, resultados, completo, "moon"), "| Marte:", melhor_par(terra, alvos, resultados, completo, "mars"))
    for a in alvos:
        print(f"   {a['id']:20s} melhor analogo: {por_alvo[a['id']][0]:14s} IAP {resultados[por_alvo[a['id']][0]][a['id']]['iap']['geral']}")
    print("Destaques por perfil:", {p: rank[p][0]["id"] for p in rank})
    print("Validacao (posicao das referencias, perfil geral):", validacao["geral"])


if __name__ == "__main__":
    main()
