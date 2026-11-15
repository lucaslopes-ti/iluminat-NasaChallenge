"""Gera as mensagens MQTT pequenas para o carrinho a partir de analogos_completo.json.

Uso (na raiz do repositório, depois do gerar_dados.py):
    python3 dados/essenciais/gerar_mqtt.py

Saída em dados/essenciais/mqtt/:
    sensores.json        cada sensor do carrinho -> campo dos dados, unidade e como comparar
    locais/<id>.json     perfil de um local (~2 KB) para publicar retido no tópico illuminat-horizontes/local
    indice.json          lista curta dos locais (id, nome, alvo, nota) para um menu
"""
import json
import os

AQUI = os.path.dirname(os.path.abspath(__file__))
SAIDA = os.path.join(AQUI, "mqtt")

# Níveis para comparar grandezas de unidades diferentes (PM2.5 no chão x AOD do satélite).
NIVEIS = {
    "pm25": {"unidade": "ug/m3", "limites": [12, 35], "fonte": "faixas de qualidade do ar da EPA (PM2.5, 24 h)"},
    "aod":  {"unidade": "adimensional", "limites": [0.1, 0.3], "fonte": "faixas usuais de AOD 550 nm (limpo / moderado / empoeirado)"},
}
NOMES_NIVEL = ["baixo", "medio", "alto"]

SENSORES = {
    "temp":  {"nome": "Temperatura", "unidade": "C", "campos": ["temp_ar_c", "amplitude_ar_c", "lst_dia_c", "lst_noite_c"], "comparacao": "direta",
              "texto": "O sensor mede o ar: compare com temp_ar_c (NASA POWER T2M) do local. Lua e Marte so tem temperatura de superficie (lst_dia_c/lst_noite_c); na Lua nao ha ar."},
    "tilt":  {"nome": "Inclinacao", "unidade": "graus", "campos": ["declividade_media", "frac_decliv_8"], "comparacao": "limite",
              "limite": 8, "texto": "Acima de 8 graus um modulo de pouso lunar nao pousa com seguranca (criterio Artemis)."},
    "pm25":  {"nome": "Poeira", "unidade": "ug/m3", "campos": ["aod_medio"], "comparacao": "nivel",
              "texto": "PM2.5 (chao) e AOD (satelite) tem unidades diferentes: compare o nivel baixo/medio/alto."},
    "solar": {"nome": "Energia solar", "unidade": "mW", "campos": ["insolacao_toa_wm2", "sol_max_graus"], "comparacao": "relativa",
              "texto": "Marte recebe ~43% do sol da Terra; no polo sul lunar o sol fica sempre perto do horizonte."},
    "soil":  {"nome": "Umidade do solo", "unidade": "%", "campos": ["chuva_anual_mm"], "comparacao": "qualitativa",
              "texto": "Lua e Marte estao secos na superficie; a agua fica como gelo (PSRs, gelo raso)."},
    "uv":    {"nome": "UV", "unidade": "indice", "campos": [], "comparacao": "qualitativa",
              "texto": "Sem ozonio, o UV-C chega ao chao em Marte; na Lua nao ha atmosfera nenhuma."},
    "vib":   {"nome": "Vibracao", "unidade": "g", "campos": ["rugosidade_tri_m"], "comparacao": "qualitativa",
              "texto": "Terreno mais rugoso = mais vibracao nas rodas."},
    "slip":  {"nome": "Patinagem", "unidade": "%", "campos": [], "comparacao": "qualitativa",
              "texto": "Areia solta prende rodas (o Spirit ficou preso em Marte)."},
}

CAMPOS_PERFIL = ["declividade_media", "frac_decliv_8", "rugosidade_tri_m", "lst_dia_c", "lst_noite_c",
                 "amplitude_termica_c", "temp_media_c", "temp_ar_c", "amplitude_ar_c", "aod_medio", "insolacao_toa_wm2", "sol_max_graus", "chuva_anual_mm", "ndvi_medio"]


def nivel(v, tipo):
    if v is None:
        return None
    a, b = NIVEIS[tipo]["limites"]
    return NOMES_NIVEL[0] if v < a else NOMES_NIVEL[1] if v < b else NOMES_NIVEL[2]


def main():
    with open(os.path.join(AQUI, "analogos_completo.json"), encoding="utf-8") as f:
        dados = json.load(f)
    alvos = {a["id"]: a for a in dados["alvos"]}
    os.makedirs(os.path.join(SAIDA, "locais"), exist_ok=True)

    sensores = {"mensagem_carrinho": {"topico": "illuminat-horizontes/carrinho",
                                      "exemplo": {"temp": 24.1, "uv": 6.2, "pm25": 14, "solar": 410, "soil": 22, "tilt": 3.4, "vib": 0.08, "slip": 5}},
                "topico_local": "illuminat-horizontes/local",
                "niveis": NIVEIS, "nomes_nivel": NOMES_NIVEL, "sensores": SENSORES}
    with open(os.path.join(SAIDA, "sensores.json"), "w", encoding="utf-8") as f:
        json.dump(sensores, f, ensure_ascii=False, indent=1)

    indice = []
    for l in dados["locais"]:
        a = alvos[l["alvo"]]
        par = {}
        for k in CAMPOS_PERFIL:
            v = l["valores"].get(k)
            if v is None:
                continue
            item = {"local": v["valor"], "u": v["unidade"], "st": v["status"], "f": v["fonte"]}
            if k in a["valores"]:
                item["alvo"] = a["valores"][k]["valor"]
            par[k] = item
        if "aod_medio" in par:
            par["aod_medio"]["nivel_local"] = nivel(par["aod_medio"]["local"], "aod")
            par["aod_medio"]["nivel_alvo"] = nivel(par["aod_medio"].get("alvo"), "aod")
        perfil = {
            "id": l["id"], "nome": l["nome"], "regiao": l["regiao"], "pais": l["pais"], "lat": l["lat"], "lon": l["lon"],
            "alvo": a["id"], "alvo_nome": a["nome"], "corpo": a["corpo"], "nota_pct": l["nota_pct"],
            "dimensoes_pct": l["dimensoes_pct"], "funciona": l["funciona"][0], "quebra": l["quebra"][0], "teste": l["testes"][0],
            "dados": par,
        }
        with open(os.path.join(SAIDA, "locais", f"{l['id']}.json"), "w", encoding="utf-8") as f:
            json.dump(perfil, f, ensure_ascii=False, separators=(",", ":"))
        indice.append({"id": l["id"], "nome": l["nome"], "alvo": a["id"], "nota_pct": l["nota_pct"], "papel": l["papel"]})

    with open(os.path.join(SAIDA, "indice.json"), "w", encoding="utf-8") as f:
        json.dump({"destaque": dados["destaques"]["candidato_brasil"], "locais": indice}, f, ensure_ascii=False, indent=1)
    tamanhos = [os.path.getsize(os.path.join(SAIDA, "locais", f"{l['id']}.json")) for l in dados["locais"]]
    print(f"{len(tamanhos)} perfis; maior {max(tamanhos)} bytes")


if __name__ == "__main__":
    main()
