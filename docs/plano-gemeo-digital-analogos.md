# Plano de Projeto: Gêmeo Digital de Análogos Terrestres da Lua e de Marte

**NASA Space Apps Challenge 2026: "Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars"**
versão 8 · 14/11/2026

---

## 0. O que vamos fazer (resumo para a equipe)

**A ideia:** um site chamado **AnaloGêmeo** que procura, na Terra inteira, os lugares mais parecidos com Marte (cratera Jezero) e com a Lua (cratera Shackleton, no polo sul), usando dados abertos da NASA. O site mostra um ranking desses lugares, incluindo **locais brasileiros que ninguém estudou como análogo**, e explica para cada um **onde a comparação funciona e onde ela falha**. Uma **estação ESP32** com sensores, ligada ao site ao vivo, simula uma tempestade de poeira e mostra a energia solar caindo. É o mesmo problema dos rovers em Marte e das usinas solares no semiárido.

**O que precisamos entregar funcionando (o "Núcleo"):**
1. **Globo** com o mapa de semelhança da Terra com Marte e com a Lua.
2. **Ranking** dos melhores lugares, com os análogos famosos (prova de que o método funciona) e os brasileiros novos.
3. **Cartão de cada lugar:** o que é parecido, o que não é, e de onde vêm os dados.
4. **Estação ESP32 + tempestade de poeira** aparecendo ao vivo no site.

Tudo em **inglês**, com o site publicado e testado no celular. Depois disso, se der tempo: mini-rover, radar e mais perfis de missão (seção 1A).

**Quem faz o quê:**

| Pessoa | Papel | Entrega principal |
|---|---|---|
| P1 | Líder e apresentação | Decide o escopo, cuida do tempo, escreve a página do projeto e faz a submissão |
| P2 | Dados da Terra | Baixa os dados da NASA (Earthdata) no Colab e monta a tabela Parquet com os indicadores |
| P3 | Dados de Marte/Lua e cálculo | Prepara os dados dos alvos, calcula o índice de semelhança e faz a validação |
| P4 | Site (dono do site) | Globo, ranking, cartões e painel ao vivo. Site publicado desde as primeiras horas |
| P5 | Hardware | Estação ESP32, sensores, envio via MQTT, caixa de "regolito" e tempestade de poeira |
| P6 | Conteúdo e vídeo | Textos de cada lugar (funciona/quebra + fontes) e o vídeo de 30 s |

Com 4 pessoas: P1 junta com P6 e P2 junta com P3.

**Próximos passos (agora):**
1. Distribuir os papéis acima.
2. Criar as contas: NASA Earthdata, GitHub e HiveMQ Cloud (todas gratuitas).
3. P4 publica o site "esqueleto" no GitHub Pages nas primeiras 4 horas.
4. P5 separa o hardware e faz o ESP32 mandar um "olá" via MQTT.
5. P2 e P3 combinam o formato da tabela Parquet e do JSON que o site vai ler.

**Marcos:** Núcleo completo no ar com **28 h** · congelamento às **36 h** · vídeo gravado às **42 h** · envio com 2 h de folga.

**Regras que eliminam o projeto se não forem seguidas:** página, slides e legendas **em inglês**; vídeo de **até 30 s** (ou até 7 slides); links públicos sem login; **todas** as referências listadas; imagens geradas por IA com marca d'água "AI-generated".

---

## 1. A ideia em uma frase

Um **gêmeo digital** que compara, lado a lado e em tempo real, um local da Terra com um local-alvo da Lua ou de Marte. Ele combina dados abertos da NASA e de outras agências para **encontrar e pontuar análogos** no planeta inteiro, mostra **onde a analogia funciona e onde ela falha**, e se conecta a uma **estação de sensores ESP32** construída pela equipe, que traz dados reais de campo para dentro do gêmeo.

Nome provisório: **AnaloGêmeo** (alternativas: *Espelho Planetário*, *TwinSite*).

### Por que esse recorte ganha pontos
- O desafio pede expressamente que o projeto **não se limite a redescobrir Atacama, Antártida, Islândia e Havaí**, mas **busque de forma sistemática** e **explique onde a analogia falha**. Um índice de similaridade aplicado ao globo inteiro, dividido por dimensões, atende exatamente a isso.
- O "gêmeo digital" dá ao projeto um diferencial de engenharia: não é só um mapa, é um sistema com **modelo + dados ao vivo + sincronização**.
- Os análogos brasileiros, pouco explorados na literatura de análogos planetários, dão originalidade.

---

## 1A. Escopo: Núcleo e Extras (leia primeiro)

**Prioridade nº 1: o site funcionando bem e uma história que faça sentido.** Tudo o que não é Núcleo só entra depois que o Núcleo estiver pronto, publicado e testado.

### A história em 3 atos (é ela que guia o site e o vídeo)
1. **A pergunta:** "Onde na Terra podemos treinar para a Lua e para Marte?" Os análogos famosos (Atacama, Antártida, Havaí) já são conhecidos. Existem outros que ninguém olhou?
2. **A descoberta:** o AnaloGêmeo compara a Terra inteira com Marte e com a Lua usando dados abertos da NASA e de agências parceiras. Os análogos clássicos aparecem no topo, o que mostra que o método funciona, e **ao lado deles surgem locais brasileiros novos**. Cada local mostra com honestidade **onde a analogia funciona e onde quebra**.
3. **O gêmeo vivo e o impacto:** uma estação ESP32 de baixo custo traz o "chão" para o gêmeo. Numa tempestade de poeira simulada, a energia solar cai, que é o mesmo problema dos rovers em Marte e das usinas solares no semiárido brasileiro. Explorar Marte ajuda a entender a Terra.

### Núcleo (precisa estar funcionando na entrega)

| # | Entrega | Critério de pronto |
|---|---|---|
| N1 | **Globo com o Índice de Analogia** | Mapa de calor da Terra inteira (~5 km) para **Marte/Jezero** e **Lua/Shackleton**, com troca de alvo em 1 clique. Um perfil único ("Geral", pesos iguais entre as dimensões) |
| N2 | **Ranking com os análogos brasileiros** | Top 10 clicável. Análogos clássicos marcados como "validação" e brasileiros como "novo · BR". Frase de validação com número (ex.: "7 de 8 análogos clássicos no top 5%") |
| N3 | **Cartão "funciona / quebra"** | Para cada local do ranking: radar por dimensão (Terra × alvo), 3 pontos que funcionam, 3 que quebram (gravidade, atmosfera, radiação sempre visíveis) e fontes de dados |
| N4 | **Estação ESP32 + tempestade de poeira** | Painel "aqui × Jezero" recebendo dados ao vivo por MQTT. Com o ventilador ligado, a poeira sobe e a geração solar estimada cai no gráfico. Plano B: reprodução de um log gravado |

**Requisitos do site (valem para todo o Núcleo):**
- Site **estático** (sem back-end próprio), publicado no GitHub Pages ou na Vercel desde as primeiras horas e atualizado a cada entrega.
- Abre em menos de 3 s, funciona em notebook e celular, **todo em inglês**.
- Se o MQTT cair, o painel mostra o log gravado com o aviso "replay". O site nunca fica quebrado na frente do jurado.
- Só entra na `main` o que já funciona. Trabalho em andamento fica em branch.

### Extras (só depois do Núcleo pronto, nesta ordem)

| Ordem | Extra | O que acrescenta |
|---|---|---|
| E1 | **Mini-rover com medição de patinagem** | Teste de mobilidade em 3 tipos de "regolito" (vibração, inclinação e patinagem), ligado à dimensão Terreno |
| E2 | **Radar Sentinel-1** | Rugosidade por radar nos análogos brasileiros, comparada ao Mini-RF lunar |
| E3 | **Mais perfis de missão** | Rover, Astrobiologia, Gelo/ISRU e Habitat, com pesos diferentes no índice |

Fora do escopo do hackathon (citar só como "próximos passos" no pitch): RADARSAT, JAXA G-Portal, ML, Arcadia Planitia, relevo 3D lado a lado.

---

## 2. Conceito do Gêmeo Digital

Um gêmeo digital tem três partes: o objeto físico, o modelo virtual e o fluxo de dados que liga os dois. No nosso caso:

| Camada | O que é | Como entra no projeto |
|---|---|---|
| **Gêmeo do alvo** (Lua/Marte) | Modelo do local-alvo: relevo 3D, temperatura ao longo do dia local, iluminação, poeira, gelo | Dados LRO (LOLA, Diviner) e MRO/Mars Odyssey (MOLA, CTX, THEMIS), pré-processados |
| **Gêmeo do análogo** (Terra) | Modelo do local terrestre: relevo, temperatura de superfície, aridez, minerais, vegetação | Dados NASA de satélite (NASADEM, MODIS, SMAP, GPM, EMIT) via NASA Earthdata e AppEEARS |
| **Estação física** (o "objeto real") | Estação ESP32 com sensores ambientais e um mini-rover de teste | Dados ao vivo por MQTT: temperatura, UV, poeira, umidade do solo, inclinação |
| **Motor de comparação** | Índice de similaridade por dimensão e cartão "onde a analogia quebra" | Python (pré-calculado) + painel web |

**Experiência do usuário (demo).** Os itens marcados *(extra)* só entram depois do Núcleo:
1. O usuário escolhe um **alvo**: polo sul lunar (borda da cratera Shackleton / regiões candidatas do Artemis III) ou Marte (Cratera Jezero; Arcadia Planitia, candidata para missões humanas por ter gelo raso).
2. *(extra)* Escolhe um **perfil de missão**, que muda os pesos do índice: *Teste de rover/mobilidade*, *Astrobiologia*, *Gelo e ISRU*, *Construção/habitat*.
3. Um **globo 3D** mostra o mapa de calor de similaridade da Terra inteira e um ranking dos 10 melhores locais.
4. Ao clicar em um local, abre o **cartão do análogo**: um gráfico radar por dimensão (Terra x alvo), *(extra: relevo 3D lado a lado)* e a lista "funciona / não funciona".
5. O **painel ao vivo** mostra a estação ESP32 medindo agora e compara com o valor do alvo na mesma hora solar local. Exemplo: "Aqui: 31 °C, UV 9. Jezero agora: −62 °C, UV estimado 3× maior".

---

## 3. Fontes de dados concretas

Regra de ouro para o hackathon: **não baixar dados globais brutos em alta resolução**. Todo o fluxo usa só ferramentas gratuitas da NASA (basta um login gratuito no **NASA Earthdata**):

- **Mapa global (~5 km):** produtos MODIS em *Climate Modeling Grid* (CMG, 0,05°). Cada um cobre a Terra inteira em **um único arquivo pequeno** (dezenas de MB), baixado do LP DAAC/Earthdata e processado em Python no próprio notebook.
- **Zoom nos locais candidatos (30 m–1 km):** o **NASA AppEEARS** recorta MODIS, SMAP, NASADEM, ASTER e outros apenas para a área desenhada e devolve GeoTIFF/NetCDF prontos.
- **Lua e Marte:** apenas **recortes pequenos** dos locais-alvo (alguns MB).

O Google Earth Engine fica **opcional**: é gratuito para uso não comercial, mas exige cadastro de projeto no Google Cloud e não é necessário para o MVP.

### 3.1 Terra (NASA e parceiros)

| Dimensão | Conjunto de dados | Resolução | Onde |
|---|---|---|---|
| Relevo global, declividade, rugosidade | **GMTED2010** (USGS, 30″ ≈ 1 km) ou ETOPO 2022 (NOAA, 60″) | ~1–2 km | USGS EarthExplorer / NOAA |
| Relevo local (zoom) | **NASADEM** / SRTM; ASTER GDEM v3 | 30 m | AppEEARS / OpenTopography |
| Temperatura de superfície (dia/noite → amplitude térmica) | **MODIS LST mensal CMG (MOD11C3)**; local: MOD11A2 | 5 km / 1 km | Earthdata (LP DAAC) / AppEEARS |
| Vegetação (ausência = analogia) | **MODIS NDVI mensal CMG (MOD13C2)**; local: MOD13A2, Landsat 8/9 | 5 km / 1 km / 30 m | Earthdata / AppEEARS |
| Albedo e materiais | **MODIS albedo CMG (MCD43C3)**; local: MCD43A3 | 5 km / 500 m | Earthdata / AppEEARS |
| **Mineralogia** (óxidos de ferro, argilas, sulfatos) | **EMIT** (espectrômetro na ISS, focado em regiões áridas fontes de poeira); ASTER (índices de minerais, emissividade AG100) | 60 m / 90–100 m | Earthdata (LP DAAC) / AppEEARS |
| Poeira e aerossóis | MODIS aerossol mensal (MOD08_M3); **MERRA-2** (poeira) | 1° / ~50 km | Earthdata (LAADS / GES DISC) |
| Água, umidade do solo, chuva | **SMAP** umidade do solo (L3, 9 km); **GPM IMERG** precipitação mensal | 9 km / 10 km | Earthdata (NSIDC / GES DISC) / AppEEARS |
| Clima (vento, radiação, umidade) | MERRA-2; opcional ERA5-Land (Copernicus CDS, conta gratuita) | ~50 km / ~9 km | GES DISC / CDS |
| Gelo e neve | MODIS cobertura de neve CMG (MOD10CM) | 5 km | Earthdata (NSIDC) |
| Crateras de impacto terrestres | Earth Impact Database (PASSC) | lista | site PASSC |

### 3.2 Lua (alvo: polo sul / bases permanentes)

| Dimensão | Conjunto de dados | Observação |
|---|---|---|
| Relevo, declividade, rugosidade | **LRO LOLA**: DEMs polares (5–20 m/px no polo sul) | PDS Geosciences Node; Moon Trek |
| Temperatura | **LRO Diviner**: temperaturas máx./mín. e médias do polo sul | Mostra as regiões permanentemente sombreadas (PSRs), abaixo de 40 K |
| Iluminação | Mapas de iluminação média do polo sul (derivados de LOLA) | Essencial para energia solar da base |
| Gelo/água | Chandrayaan-1 **M3** (ISRO/NASA), LRO LEND, LRO LAMP, Mini-RF | Distribuição de gelo superficial nas PSRs |
| Imagens | LROC NAC/WAC | Visual e textura |
| Candidatos de base | 9 regiões candidatas do Artemis III ao redor do polo sul (NASA) | Pontos de referência do gêmeo |

### 3.3 Marte (alvo: pouso e exploração)

| Dimensão | Conjunto de dados | Observação |
|---|---|---|
| Relevo global | **MGS MOLA** MEGDR (463 m); DEM HRSC+MOLA (200 m, ESA/DLR) | USGS Astrogeology |
| Relevo local | **MRO CTX** (mosaico global ~5 m/px) e **HiRISE** (DTMs até 1 m) | Jezero tem DTMs HiRISE prontos |
| Temperatura e inércia térmica | **Mars Odyssey THEMIS** (IR dia/noite, inércia térmica); TES | Inércia térmica indica areia, poeira ou rocha |
| Mineralogia | **MRO CRISM** (argilas, carbonatos, sulfatos); OMEGA (ESA) | Jezero: carbonatos e argilas no delta |
| Poeira | TES Dust Cover Index | |
| Gelo raso | **SWIM** (Subsurface Water Ice Mapping), SHARAD | Arcadia Planitia, Deuteronilus Mensae |
| Clima no solo | Perseverance **MEDA** (temperatura, vento, poeira, UV); Curiosity REMS; Mars Climate Database (LMD/ESA) | Alimenta o "Marte agora" do gêmeo |

### 3.4 Recursos oficiais do desafio e como usamos cada um

A página do desafio lista recursos específicos. Usar os recursos indicados, **inclusive os das agências parceiras**, mostra aos jurados que o projeto conversa com o que foi pedido. Mapeamento:

| Recurso listado no desafio | Uso no projeto | Prioridade |
|---|---|---|
| **NASA Earthdata Search** | Download dos produtos MODIS CMG, SMAP, GPM, MERRA-2 e EMIT (mapa global e indicadores) | Essencial |
| **NASA Worldview** | Olhar rapidamente os locais candidatos (cor real, temperatura, poeira) antes de baixar; capturas para o vídeo | Essencial |
| **NASA PDS** | Recortes de Marte (MOLA, CTX, THEMIS, CRISM) e da Lua | Essencial |
| **LRO (PDS Geosciences)** | LOLA (relevo do polo sul) e **Mini-RF** (radar da Lua) | Essencial |
| **LRO Diviner** | Temperaturas e produtos polares: dimensão térmica e "armadilhas frias" de gelo. O próprio desafio sugere compará-lo com ambientes terrestres extremamente frios ou com gelo | Essencial |
| **ESA Copernicus Data Space** | **Sentinel-1** (radar SAR) e **Sentinel-2** (multiespectral 10 m) para o zoom nos locais candidatos | Alta |
| **CSA RADARSAT-1 / RCM** + tutorial SAR em Python | Radar de abertura sintética para comparar **rugosidade de superfície por radar** na Terra com o Mini-RF lunar. O tutorial da CSA acelera o processamento | Média (diferencial) |
| **JAXA G-Portal** | GSMaP (chuva) e GCOM-C/SGLI (temperatura de superfície e vegetação) como validação cruzada do MODIS e do GPM | Baixa (se sobrar tempo) |
| **ESA Open Science Catalog** | Busca de conjuntos complementares (permafrost, solos, aerossóis) | Baixa |

**Ideia de destaque com o radar:** o radar "enxerga" a rugosidade do solo em escala de centímetros a decímetros, que é o que importa para as rodas de um rover e para o pouso. Comparar o retroespalhamento SAR de Vargeão, dos Lençóis ou do semiárido (Sentinel-1/RADARSAT) com o Mini-RF da Lua cria uma dimensão de analogia **que não depende de luz nem de nuvens**, algo pouco explorado em estudos de análogos. Atenção: radares diferentes têm frequências e geometrias diferentes, então a comparação deve ser feita em termos relativos (percentis), como o resto da métrica.

**Portais úteis:** NASA Earthdata Search, **NASA AppEEARS**, Worldview (para olhar as imagens antes de baixar), PDS (Geosciences e Imaging), USGS Astrogeology, **NASA Moon Trek e Mars Trek** (permitem baixar recortes já recortados e reprojetados, o que poupa horas).

---

## 4. Métrica de similaridade (o coração do projeto)

### 4.1 O problema
Não dá para comparar valores absolutos: nenhum lugar da Terra tem −170 °C, vácuo ou 1/6 da gravidade. Por isso a métrica compara **papéis análogos**, não números crus, e declara de forma explícita o que é impossível de reproduzir.

### 4.2 Dimensões e indicadores

| Dimensão | Indicador na Terra | Indicador no alvo |
|---|---|---|
| **Terreno** | declividade média, rugosidade (TRI), densidade de crateras/depressões, amplitude de relevo em 1 km; no zoom, **rugosidade por radar** (Sentinel-1 / RADARSAT) | mesmos indicadores a partir de LOLA/MOLA/CTX; radar Mini-RF (Lua) |
| **Materiais de superfície** | albedo, índice de óxido de ferro, máficos (basalto), minerais hidratados (EMIT/ASTER) | albedo, mineralogia CRISM/M3 |
| **Térmico** | amplitude dia-noite de LST (MODIS), inércia térmica aparente | amplitude Diviner/THEMIS, inércia térmica |
| **Água/gelo** | índice de aridez, umidade do solo (SMAP), presença de gelo/permafrost | gelo em PSRs (Lua) e gelo raso (SWIM, Marte) |
| **Processos eólicos/poeira** | AOD de poeira, velocidade do vento (ERA5), campos de dunas | Dust Cover Index, dunas em CTX |
| **Biologia** | NDVI baixo, produtividade baixa (o quanto o local é "quase estéril") | estéril (alvo = 0) |
| **Operações** | acesso (distância de estrada), declividade transitável para rover | declividade transitável |

### 4.3 Cálculo

1. **Normalização por percentil dentro de cada mundo.** Cada indicador vira um percentil (0–1) na distribuição do seu próprio planeta. Assim, "o terreno mais acidentado da Terra" pode ser comparado com "o terreno mais acidentado da Lua". Para indicadores onde há sobreposição física real (declividade, rugosidade, albedo, mineralogia), usamos também a distância em valores físicos.
2. **Similaridade por dimensão:** `S_d = exp( −‖x_Terra − x_alvo‖² / (2σ_d²) )`, um valor entre 0 e 1.
3. **Índice final ponderado por perfil de missão:** `IAP = Σ w_d · S_d` (Índice de Analogia Planetária, 0–100). Os pesos `w_d` mudam conforme o perfil escolhido:

   | Perfil | Terreno | Materiais | Térmico | Água/gelo | Poeira | Biologia | Operações |
   |---|---|---|---|---|---|---|---|
   | Rover/mobilidade | 0,35 | 0,15 | 0,10 | 0,05 | 0,15 | 0,05 | 0,15 |
   | Astrobiologia | 0,05 | 0,25 | 0,10 | 0,25 | 0,05 | 0,25 | 0,05 |
   | Gelo e ISRU | 0,10 | 0,20 | 0,20 | 0,35 | 0,05 | 0,00 | 0,10 |
   | Construção/habitat | 0,25 | 0,25 | 0,15 | 0,05 | 0,15 | 0,00 | 0,15 |

4. **Cartão "onde a analogia quebra"**, sempre visível: gravidade, vácuo/pressão atmosférica, radiação, campo magnético e ciclo dia-noite (14 dias na Lua) recebem **0 fixo** e aparecem em vermelho. Isso responde diretamente ao último item do desafio.
5. **Validação (credibilidade):** rodar o índice e verificar se análogos já consagrados (Atacama, Vales Secos da Antártida, cratera Haughton, Rio Tinto) aparecem no topo para os perfis certos. Se aparecerem, o método está calibrado, e os locais **novos** que surgirem ao lado deles ganham peso.

### 4.4 Implementação prática
- Grade global da Terra em **0,05° (~5 km)** a partir dos produtos MODIS CMG, reamostrando relevo e clima para a mesma grade (Python, `rioxarray`). São ~26 milhões de células: roda em minutos num notebook comum. Exportar como GeoTIFF/COG para os 4 perfis.
- Para os 10–20 melhores locais, refazer o cálculo em **resolução fina (30 m–1 km)** com recortes do AppEEARS. É aí que aparece o detalhe de crateras, dunas e cavernas.
- Vetor de referência do alvo: média e desvio dos indicadores em um raio de 10–20 km do local-alvo, calculados localmente em Python a partir dos recortes.
- Opcional, se sobrar tempo: um **modelo de ML** (k-NN ou Random Forest) treinado nos análogos conhecidos para sugerir "locais parecidos com Atacama/Haughton". Fica como "fase 2" no pitch, sem comprometer o MVP.

---

## 5. Análogos sugeridos

### 5.1 Brasileiros (diferencial do projeto)

| Local | Alvo | Por que é análogo | Onde a analogia quebra | Uso em exploração |
|---|---|---|---|---|
| **Cratera de Vargeão (SC)**, ~12 km | Lua (crateras em basalto dos mares) e Marte | Impacto em **basalto** (Formação Serra Geral), raro no mundo; brechas e feições de choque em rocha vulcânica, como nos mares lunares e nas planícies marcianas | Clima úmido, vegetação densa, erosão intensa | Treinar geólogos e IA para reconhecer feições de impacto em basalto; calibrar algoritmos de detecção de crateras |
| **Vista Alegre (PR)**, ~9,5 km | Lua/Marte | Outro impacto em basalto, permite comparar duas estruturas | Idem | Idem, estudo comparativo |
| **Serra da Cangalha (TO)**, ~13 km, e **Araguainha (MT/GO)**, ~40 km, a maior da América do Sul | Marte | Picos centrais e anéis bem expostos no Cerrado seco, com relevo de cratera complexa | Rocha sedimentar, clima com estação chuvosa | Teste de navegação de rover em terreno de cratera complexa; mapeamento com drone |
| **Cavernas ferríferas de Carajás (PA) e do Quadrilátero Ferrífero (MG)** | Marte | Cavernas em **formações ferríferas e canga**, ricas em hematita e goethita, os minerais que dão a cor de Marte e que o Opportunity encontrou em Meridiani. Abrigam microbiologia em rocha de ferro | Úmidas e com vida abundante; não são tubos de lava | Testar navegação subterrânea, mapeamento LiDAR e busca de bioassinaturas em ambiente rico em ferro |
| **Lençóis Maranhenses (MA)** | Marte | Campo de **dunas** com **lagoas temporárias** entre as dunas: processo eólico + água efêmera, como se supõe em parte do passado marciano | Chuva alta (~1.600 mm/ano), sem aridez | Testar mobilidade em areia solta; estudar a dinâmica de dunas com séries Landsat |
| **Núcleos de desertificação do semiárido (Cabrobó-PE, Gilbués-PI, Seridó-RN/PB) e Raso da Catarina (BA)** | Marte (poeira/aridez) | Solo exposto, alta temperatura de superfície, poeira, baixa vegetação | Pressão atmosférica, temperatura média alta | Testar painéis solares com poeira, filtros e coleta de água. **É o elo direto com o impacto na Terra** (ver seção 9) |

### 5.2 Internacionais pouco explorados (para o algoritmo "descobrir")
- **Deserto de Lut (Irã):** temperaturas de superfície entre as mais altas já medidas pelo MODIS; yardangs gigantes, parecidos com os de Marte.
- **Depressão de Danakil / Dallol (Etiópia):** salmouras ácidas, sulfatos e hidrotermalismo, ligado à astrobiologia de Marte.
- **Bacia de Qaidam (Tibete, China):** alta altitude, frio, seca, sais e yardangs (estudada pela China, pouco conhecida no Ocidente).
- **Cratera de Lonar (Índia):** impacto em basalto, um contraponto internacional a Vargeão.
- **Planaltos de Svalbard / Ártico canadense:** sol rasante o ano todo, para testar iluminação de base no polo sul lunar.

A narrativa que recomendo: **"O algoritmo reencontrou os análogos clássicos (validação) e revelou estes novos, incluindo cinco no Brasil."**

---

## 6. Arquitetura técnica

```
 [Earthdata/AppEEARS: MODIS CMG, GMTED, SMAP,     [Recortes Lua/Marte: LOLA, Diviner, MOLA, CTX, THEMIS, CRISM]
               │  GPM, MERRA-2, NASADEM] (Python)           │ (Python: rasterio, xarray, numpy)
               ▼                                           ▼
   Tabela de indicadores Terra (Parquet, ~5 km)  Vetores de referência dos alvos (JSON)
               └──────────────► Motor de similaridade (Python) ◄──────────┘
                                         │
                       mapas de score (PNG/COG tiles) + ranking (GeoJSON)
                                         │
                                         ▼
 [ESP32 + sensores] ──MQTT──► Broker (HiveMQ Cloud / Mosquitto) ──WebSocket──► Front-end web
                                                                                 (CesiumJS globo 3D
                                                                                  + painel ao vivo)
```

### Pipeline de dados: Parquet + Colab + Drive

Os rasters da NASA (GeoTIFF/NetCDF) são convertidos numa **tabela de indicadores em Parquet**, com uma linha por célula de ~5 km da Terra (`lat, lon, declividade, rugosidade, LST_dia, LST_noite, NDVI, albedo, AOD, chuva, ...`). Essa tabela é o **contrato entre quem prepara os dados (P2) e quem faz o motor de similaridade (P3)**: cada um trabalha em paralelo sem esperar o outro.

- **Tamanho:** só as células de terra (sem oceano) dão ~8 milhões de linhas, algumas centenas de MB em memória. Em Parquet fica compacto e abre em segundos com pandas, Polars ou DuckDB. Em CSV seria lento e pesado.
- **Onde roda:** **Google Colab** (gratuito, ~12 GB de RAM, sem instalar nada; `pip install earthaccess rioxarray duckdb`). Alternativa: Jupyter ou VS Code num notebook com 16 GB de RAM.
- **Onde ficam os dados:** numa **pasta compartilhada do Google Drive** da equipe, montada no Colab. Dados brutos e Parquet **não vão para o GitHub**, que recusa arquivos acima de 100 MB. No repositório entram só o código e os resultados pequenos que o site usa (GeoJSON do ranking, PNG/tiles do mapa).
- **Sem exagero:** nada de Spark, data lake ou banco de dados. Arquivos Parquet numa pasta + DuckDB/pandas bastam para 48h.
- **Bônus:** o histórico de leituras da estação ESP32 também pode ser salvo em Parquet para análise e para a reprodução na demo.

Estrutura no Drive:
```
Drive/AnaloGemeo/
  bruto/          # downloads do Earthdata, AppEEARS, PDS (GeoTIFF, NetCDF, HDF)
  parquet/
    terra_indicadores.parquet        # 1 linha por célula de ~5 km
    alvos.parquet                    # vetores de referência Lua/Marte
    scores_<alvo>_<perfil>.parquet   # índice calculado
    esp32_leituras.parquet           # histórico da estação
```

Estrutura no repositório:
```
pipeline/
  01_baixar_dados.ipynb        # earthaccess: MODIS CMG, GMTED, GPM, SMAP, MERRA-2
  02_tabela_indicadores.ipynb  # raster → Parquet (1 linha por célula)
  03_alvos_lua_marte.ipynb     # recortes LOLA/Diviner/MOLA/THEMIS → vetor de referência
  04_motor_similaridade.ipynb  # Parquet → índice por alvo e perfil → GeoJSON/PNG para o site
web/                           # front-end estático (CesiumJS + painel ao vivo)
firmware/                      # código do ESP32
docs/                          # este plano
```

### Stack recomendada (simples e robusta para 48h)
- **Dados/ciência:** Google Colab com Python, `earthaccess` (download autenticado do Earthdata), `rasterio`, `rioxarray`, `xarray`, `numpy`, `pandas` + `pyarrow` (Parquet), `duckdb`, `scikit-learn`.
- **Front-end:** HTML/JS ou React + **CesiumJS** (globo 3D, relevo, camadas) + Chart.js (radar). O front é **estático**: os resultados são pré-calculados em GeoJSON/PNG, então nada quebra na hora da demo.
- **Tempo real:** MQTT via WebSocket direto no navegador (biblioteca `mqtt.js`), usando um broker gratuito (HiveMQ Cloud). Sem back-end próprio.
- **Hospedagem:** GitHub Pages ou Vercel (gratuito). Repositório público no GitHub, que é bom para a submissão.

### Estação ESP32 (o lado físico do gêmeo)

| Componente | Mede | Papel no gêmeo |
|---|---|---|
| ESP32 DevKit | Wi-Fi, MQTT | Cérebro da estação |
| BME280 | temperatura, umidade, pressão do ar | Compara com a pressão de Marte (~0,6% da Terra) |
| DS18B20 (à prova d'água) | temperatura do solo/regolito simulado | Amplitude térmica |
| GUVA-S12SD ou ML8511 | índice UV | UV na superfície de Marte é muito mais forte |
| BH1750 | iluminância (lux) | Iluminação para energia solar |
| PMS5003 ou SDS011 | poeira (PM2.5/PM10) | Processos de poeira |
| Sensor capacitivo de umidade do solo | água no solo | Dimensão água |
| MPU6050 em um mini-rover (carrinho 2WD) | inclinação e vibração | Teste de mobilidade em "regolito" (areia + brita) em bancada |

**Demo física:** uma caixa de areia (simulante de regolito com areia fina e pó de basalto/argila vermelha) com a estação e o mini-rover. Um secador ou ventilador gera "tempestade de poeira", e o gêmeo mostra o PM subir e a geração solar estimada cair. O jurado vê o físico e o digital reagindo juntos.

Custo estimado dos componentes: R$ 250–450 (componentes comuns de eletrônica, fáceis de encontrar).

---

## 7. Cronograma de 48 horas e papéis

### Papéis (equipe de até 6)

| Papel | Perfil sugerido | Responsabilidade |
|---|---|---|
| **P1 Líder de produto e pitch** | qualquer área, boa comunicação | Escopo, decisões, roteiro do vídeo, submissão |
| **P2 Dados da Terra** | TI / desenvolvimento | Download Earthdata/AppEEARS, indicadores e **tabela Parquet** de indicadores (notebooks 01 e 02) |
| **P3 Dados planetários e métrica** | TI / ciência de dados | Recortes Lua/Marte, vetores de referência, motor de similaridade sobre o Parquet, validação (notebooks 03 e 04) |
| **P4 Front-end e visualização 3D** | desenvolvimento web | **Dono do site**: CesiumJS, ranking, cartão do análogo, painel ao vivo, publicação contínua e qualidade |
| **P5 IoT e hardware** | eletrônica / automação / mecatrônica | ESP32, sensores, MQTT, caixa de regolito, tempestade de poeira (Núcleo); mini-rover (Extra E1) |
| **P6 Pesquisa, conteúdo e vídeo** | qualquer área | Fichas dos análogos, textos "funciona/quebra", gravação e edição do vídeo |

Com 4 pessoas: P1+P6 juntos e P2+P3 juntos.

### Primeiras horas (preparação, já com o evento em andamento)
- Criar contas: **NASA Earthdata** (gratuita e imediata; dá acesso ao AppEEARS), **Copernicus Data Space** (gratuita), GitHub, HiveMQ Cloud.
- Fazer um pedido de teste no AppEEARS: os pedidos entram numa fila e podem levar de minutos a algumas horas, então conhecer o fluxo antes evita surpresa.
- Ler a página do desafio e os recursos listados pela NASA.
- Separar o hardware e testar a gravação do ESP32 com um "olá mundo" de MQTT.
- Estudar o Moon Trek e o Mars Trek para saber baixar recortes.

### Durante (48 h): Núcleo primeiro

| Bloco | Horas | Entregas | Marco |
|---|---|---|---|
| **Sexta à noite: Arrancada** | 0–4 | Escopo travado no Núcleo. Repositório e branches. P4 publica um **site "esqueleto" no ar** (globo vazio + layout das 4 áreas, em inglês). P3 baixa os recortes de Jezero e Shackleton. P5 monta a estação na protoboard. P6 escreve o texto dos 3 atos | Site no ar |
| **Noite: Dados base** | 4–12 | P2: produtos globais (MODIS CMG, GMTED, GPM, MERRA-2) → tabela Parquet de indicadores. P3: vetores de referência dos 2 alvos. P4: ranking e cartão com **dados falsos** no formato final (JSON combinado com P3). P5: sensores publicando no MQTT. P6: fichas dos análogos (funciona/quebra + fontes) | Contrato de dados (formato do JSON) fechado |
| **Sábado de manhã: Motor** | 12–20 | Índice "Geral" para os 2 alvos. **Checkpoint de validação às 18 h:** os análogos clássicos aparecem no topo? Ajustar σ. Gerar a frase de validação com número. P4: painel ao vivo lendo o MQTT | Índice real calculado |
| **Sábado à tarde: Integração** | 20–28 | Dados reais no site: mapa de calor, ranking, cartões. Tempestade de poeira funcionando de ponta a ponta. **Gravar o log da estação (plano B)** | **Núcleo completo no ar (28 h)** |
| **Sábado à noite: Teste e Extras** | 28–36 | Teste do site em celular e notebook, por quem não fez o código. Corrigir o que quebrar. **Só então** começar os Extras, na ordem E1 → E2 → E3, cada um em branch | Núcleo estável |
| **Domingo de manhã: Congelar e gravar** | 36–42 | **Congelamento às 36 h**: nenhuma funcionalidade nova. Extras inacabados ficam fora da `main`. Gravar o vídeo de 30 s (tela + estação). README, referências e declaração de IA | Vídeo gravado |
| **Domingo: Submissão** | 42–48 | Página do projeto em inglês, links públicos testados numa aba anônima, envio com pelo menos 2 h de folga | Enviado |

**Regras de corte:**
- **Às 18 h**, se o índice não estiver confiável: ficar só com **Marte/Jezero** e 3 dimensões (terreno, térmico, aridez). A Lua vira "próximo passo".
- **Às 28 h**, se o Núcleo não estiver no ar: cancelar todos os Extras e dedicar a equipe inteira a terminar o Núcleo.
- **Às 36 h**, o que não estiver pronto fica fora. Um site pequeno funcionando vence um grande quebrado.

---

## 8. Entregáveis do Space Apps

Regras do Guia de Submissão de 2025 (conferir se mudou em 2026). **Se qualquer limite for ultrapassado, o projeto fica fora do julgamento global.**

1. **Página do projeto em inglês:** nome, resumo, descrição detalhada (o que faz, como funciona, ferramentas e hardware), **NASA Data** (campo obrigatório para prêmio global) e **Space Agency Partner & Other Data**. Aceita imagens (até 10 MB), mas não vídeos.
2. **Demonstração:** **vídeo de até 30 s** (com legenda em inglês) **ou até 7 slides em inglês**, contando o slide de título. Precisa de link público, sem login (YouTube, Drive, GitHub). Roteiro sugerido, com uma única ideia forte:
   - 0–5 s: "Where on Earth can we train for the Moon and Mars?"
   - 5–15 s: globo com o mapa de calor; os análogos conhecidos aparecem no topo (validação) e, ao lado deles, os novos brasileiros
   - 15–25 s: cartão de Vargeão "funciona / quebra" e corte para a estação ESP32 na tempestade de poeira, com a geração solar caindo no painel
   - 25–30 s: "The same data tracks desertification in Brazil's semi-arid region. AnaloGêmeo."
3. **Link do projeto final:** público, sem senha nem cadastro (site publicado + repositório GitHub).
4. **Referências:** listar **todo** recurso externo usado (dados, código aberto, imagens, bibliotecas). O formulário exige marcar que o trabalho é original.
5. **Uso de IA:** é permitido, mas imagens e vídeos gerados por IA precisam de **marca d'água visível** "AI-generated", e código e dados gerados por IA precisam ser declarados no texto. Não usar logos da NASA em material gerado.
6. **Equipe:** de 1 a 6 pessoas, todas inscritas no mesmo evento local.

**Critérios de avaliação** (oficiais, sem pesos): **Impacto**, **Criatividade**, **Validade** (cientificamente válido e funcionando no mundo real), **Relevância** (responde ao desafio, completo, viável, utilizável) e **Apresentação**, que tem o mesmo peso dos outros quatro. Como o plano cobre cada um: impacto (seção 9), criatividade (gêmeo + IoT + análogos brasileiros), validade (validação com análogos conhecidos + "onde quebra"), relevância (mapa + métrica + caracterização) e apresentação (globo + demo física).

**Prêmios-alvo:** *Best Use of Data* (dados de várias agências em um índice acessível) e *Local Impact* (semiárido e análogos brasileiros). *Galactic Impact* fica como opção.

---

## 9. Impacto na Terra

- **Desertificação no semiárido brasileiro:** o mesmo índice que procura "parecido com Marte" identifica as áreas mais áridas, quentes, empoeiradas e sem vegetação, ou seja, os núcleos de desertificação. O gêmeo pode monitorar como essas áreas avançam ou se recuperam com séries MODIS/Landsat.
- **Tecnologia de baixo custo para o campo:** a estação ESP32 é a mesma que um pequeno produtor do semiárido pode usar para medir umidade do solo, calor extremo e poeira, a uma fração do custo de estações comerciais.
- **Energia solar com poeira:** o teste de queda de geração com poeira (crítico em Marte) vale para usinas solares no Nordeste.
- **Construção com material local:** pesquisa de "regolito" (ISRU) se conecta a tijolos de solo-cimento e materiais de baixo carbono, com aplicação direta na construção civil.
- **Educação técnica:** o kit (estação + caixa de regolito + gêmeo web) pode virar material didático replicável em escolas técnicas e universidades, unindo eletrônica, programação e ciência espacial.

---

## 10. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Fila do AppEEARS demorar durante o evento | Disparar os pedidos dos recortes logo na primeira noite; o mapa global (MODIS CMG) não depende do AppEEARS |
| Download lento na rede do evento | Baixar os arquivos globais (são poucos e pequenos) numa única máquina e compartilhar pela pasta do Drive da equipe |
| Dados de Lua/Marte grandes demais | Usar Moon Trek / Mars Trek para recortes; trabalhar em resolução reduzida |
| Wi-Fi do evento instável para o MQTT | Gravar um log de dados da estação para reprodução; usar um roteador de celular |
| Métrica gera resultados estranhos | Checkpoint de validação às 20 h com análogos conhecidos; ajustar pesos e σ |
| Escopo grande demais | Núcleo e Extras separados; regras de corte às 18 h, 28 h e 36 h |
| Afirmações científicas erradas | Toda ficha de análogo cita a fonte; usar "indica", "sugere" e evitar exageros |

---

## 11. Próximos passos imediatos

1. Confirmar o tamanho da equipe e distribuir os papéis da seção 7. **P4 é o dono do site.**
2. Criar as contas: Earthdata, GitHub e HiveMQ agora. A Copernicus Data Space só é necessária para o Extra E2.
3. Alvos do Núcleo definidos: **Marte / Jezero** e **Lua / Shackleton**.
4. Separar o hardware da estação (seção 6). O mini-rover só depois do Núcleo.
5. P4 publica o site "esqueleto" no GitHub Pages nas primeiras 4 horas.
