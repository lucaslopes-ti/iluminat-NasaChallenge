"""Gera web/data/alvos.json e web/data/locais.json a partir dos dados reais.

Entrada: dados/essenciais/analogos_completo.json e dados/essenciais/notas_dimensoes.csv
         (gerados por dados/essenciais/gerar_dados.py) + web/tools/traducao_en.json.
Uso (na raiz do repositório):  python3 web/tools/gerar_dados_site.py

O site é em inglês: os textos vêm de traducao_en.json. Um texto novo sem tradução
continua em português e aparece na lista de avisos no fim.
"""
import csv
import json
import os

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ESS = os.path.join(RAIZ, 'dados', 'essenciais')
WEB = os.path.join(RAIZ, 'web', 'data')
TR = json.load(open(os.path.join(RAIZ, 'web', 'tools', 'traducao_en.json'), encoding='utf-8'))
faltando = set()


def en(txt, tabela='textos'):
    if not txt:
        return txt
    v = TR[tabela].get(txt)
    if v is None:
        if tabela == 'textos':
            faltando.add(txt)
        return txt
    return v


def val(obj, chave):
    v = obj.get('valores', {}).get(chave)
    return v.get('valor') if v else None


def fmt(x, casas=0):
    if x is None:
        return None
    s = f'{x:,.{casas}f}'
    return s.replace('-', '−')


d = json.load(open(os.path.join(ESS, 'analogos_completo.json'), encoding='utf-8'))
fontes = d['fontes']

# ---------- notas por local x alvo x dimensão (0..1) ----------
notas = {}
with open(os.path.join(ESS, 'notas_dimensoes.csv'), encoding='utf-8') as f:
    for r in csv.DictReader(f):
        if r['nota'] in ('', None):
            continue
        notas.setdefault(r['local_id'], {}).setdefault(r['alvo_id'], {})[r['dimensao']] = round(float(r['nota']), 3)

# ---------- alvos.json ----------
dims = [{'id': x['id'], 'label': x['rotulo_en']} for x in d['metodo']['dimensoes']]
perfis = []
for p in d['metodo']['perfis']:
    pid, label = TR['perfis'].get(p['id'], [p['id'], p['rotulo']])
    perfis.append({'id': pid, 'label': label, 'pesos': p['pesos']})


def nome_fonte(fid):
    f = fontes.get(fid)
    if not f:
        return fid
    prod = f.get('produto', fid)
    return prod.split(' (')[0].split(':')[0].strip()


def indicadores_alvo(a):
    out = {}
    tmin, tmax = val(a, 'lst_noite_c'), val(a, 'lst_dia_c')
    if tmin is not None and tmax is not None:
        out['Surface temp.'] = f'{fmt(tmin)} to {fmt(tmax)} °C'
    ilu = val(a, 'iluminacao_frac')
    if ilu is not None:
        out['Sunlight'] = f'~{round(ilu * 100)}% of the time'
    elif val(a, 'sol_max_graus') is not None:
        out['Sun height'] = f'up to {fmt(val(a, "sol_max_graus"))}°'
    if val(a, 'declividade_media') is not None:
        out['Mean slope'] = f'{fmt(val(a, "declividade_media"), 1)}°'
    if val(a, 'albedo_medio') is not None:
        out['Albedo'] = fmt(val(a, 'albedo_medio'), 2)
    if val(a, 'aod_medio'):
        out['Dust (AOD)'] = fmt(val(a, 'aod_medio'), 1)
    if val(a, 'pressao_kpa'):
        out['Air pressure'] = f'{fmt(val(a, "pressao_kpa"), 2)} kPa'
    if val(a, 'gravidade_g') is not None:
        out['Gravity'] = f'{fmt(val(a, "gravidade_g"), 2)} g'
    return out


alvos = []
for a in d['alvos']:
    alvos.append({
        'id': a['id'], 'corpo': a['corpo'], 'nome': a['nome_en'],
        'regiao': en(a['regiao'], 'regioes'), 'lat': a['lat'], 'lon': a['lon'],
        'coord_aprox': bool(a.get('coord_aprox')),
        'papel': a.get('papel'), 'missao': en(a.get('missao')), 'resumo': en(a.get('resumo')),
        'indicadores': indicadores_alvo(a),
        'fontes': [nome_fonte(x) for x in a.get('fontes', [])],
    })

cfg = {
    'gerado_de': 'dados/essenciais/analogos_completo.json (versão %s, %s)' % (d.get('versao_dados'), d.get('gerado_em')),
    'dimensoes': dims, 'perfis': perfis,
    'sempre_quebra': [en(x['texto']) for x in d['sempre_quebra']],
    'alvos': alvos,
}

# ---------- locais.json ----------
corpo_alvo = {a['id']: a['corpo'] for a in d['alvos']}
CAMPOS = ['elev_media_m', 'declividade_media', 'frac_transitavel_15', 'temp_media_c', 'lst_dia_c', 'lst_noite_c',
          'chuva_anual_mm', 'ndvi_medio', 'aod_medio', 'albedo_medio', 'vento_10m_ms']
locais = []
for x in d['locais']:
    pais = TR['paises'].get(x['pais'], x['pais'])
    s = {
        'id': x['id'], 'nome': x['nome'], 'nome_en': x['nome_en'], 'nome_curto': TR['nomes_curtos'].get(x['id']),
        'regiao': f"{en(x['regiao'], 'regioes')}, {pais}",
        'cidade': TR['cidades'].get(x.get('cidade'), x.get('cidade')),
        'papel': x.get('papel'), 'tipo_en': en(x.get('feicao')),
        'lat': x['lat'], 'lon': x['lon'], 'coord_aprox': bool(x.get('coord_aprox')),
        'dados_completos': x.get('dados_completos', True),
        'melhor_alvo': x.get('alvo'),
        'notas': notas.get(x['id'], {}),
        'analogia': {corpo_alvo.get(x.get('alvo'), 'mars'): {
            'works': [en(t) for t in x.get('funciona', [])],
            'breaks': [en(t) for t in x.get('quebra', [])],
        }},
        'fontes_valores': {},
    }
    for c in CAMPOS:
        v = x.get('valores', {}).get(c)
        if v and v.get('valor') is not None:
            s[c] = v['valor']
            if v.get('status') not in ('medido', 'calculado'):
                s['fontes_valores'][c] = v.get('status')
    locais.append(s)

json.dump(cfg, open(os.path.join(WEB, 'alvos.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
with open(os.path.join(WEB, 'locais.json'), 'w', encoding='utf-8') as f:
    f.write('[\n' + ',\n'.join(json.dumps(s, ensure_ascii=False) for s in locais) + '\n]\n')

# conferência: a nota geral do site deve bater com a nota do gerar_dados.py
pesos = perfis[0]['pesos']
dif = []
for x in d['locais']:
    n = notas.get(x['id'], {}).get(x['alvo'], {})
    num = sum(n[k] * w for k, w in pesos.items() if k in n and w)
    den = sum(w for k, w in pesos.items() if k in n and w)
    if den and abs(round(100 * num / den) - x['nota_pct']) > 1:
        dif.append((x['id'], round(100 * num / den), x['nota_pct']))
print(f'{len(alvos)} alvos, {len(locais)} locais, {sum(len(v) for v in notas.values())} pares local x alvo')
print('notas conferidas' if not dif else f'AVISO: notas diferentes {dif}')
if faltando:
    print('AVISO: textos sem tradução em traducao_en.json:')
    for t in sorted(faltando):
        print('  -', t)
