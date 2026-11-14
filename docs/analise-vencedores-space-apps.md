# O AnaloGêmeo está no nível dos vencedores do Space Apps?

Análise feita em 14/11/2026 a partir dos Global Winners de 2023, 2024 e 2025 (30 projetos) e dos guias oficiais de julgamento e de submissão.

## Veredito

**Sim: a ideia está no nível dos vencedores, mas o escopo atual é maior do que o de qualquer um deles.** O conceito tem os ingredientes que se repetem nos projetos premiados: dados da NASA tornados acessíveis, um produto que funciona, impacto na Terra e um toque físico/local. O risco não é a ideia. É tentar entregar tudo e chegar ao domingo com várias partes pela metade, num vídeo de **30 segundos** que só comporta uma mensagem.

## O que os vencedores têm em comum

1. **Um problema, uma resposta clara.** Exemplos: "o tempo vai estragar meu evento?" (Twisters, México, 2025), "qual o risco de plantar agora?" (2plant, Ucrânia, 2024) e "onde estão os focos de biodiversidade?" (Taiwan, 2023). Nenhum faz cinco coisas ao mesmo tempo.
2. **Produto funcionando, quase sempre web.** Em 30 vencedores, a maioria é site, dashboard, app ou jogo. Modelos de ML aparecem, mas apresentados com uma interface ou um resultado visual.
3. **Dados da NASA no centro e explícitos.** "Best Use of Data" premia quem torna dados espaciais **acessíveis** ou os usa de forma original. O campo "NASA Data" é obrigatório para concorrer a prêmio global.
4. **Impacto concreto na Terra ou na comunidade local.** Agricultura, queimadas, clima e reflorestamento dominam *Galactic Impact* e *Local Impact*.
5. **Hardware ou campo + satélite também vence.** QUEÑARIS (Peru, *Local Impact* 2025) juntou microrganismos nativos, drones, dados de satélite e IA para reflorestar. É o mesmo espírito da nossa estação ESP32 + satélite.
6. **O Brasil vence com frequência.** PureFlow (Best Mission Concept 2025), 42 QuakeHeroes de Maceió (Best Use of Technology 2024), Connected Earth Museum de Campinas e G.R.O.W. de Florianópolis (2024), além de três vencedores brasileiros em 2023. Ser brasileiro não é desvantagem, e o recorte local até ajuda.
7. **Apresentação conta tanto quanto o resto.** O guia de julgamento diz explicitamente que a Apresentação tem o mesmo peso dos outros quatro critérios.

## Como o AnaloGêmeo se compara

| Critério oficial | Onde estamos fortes | Onde corremos risco |
|---|---|---|
| **Impacto** | Ponte com a desertificação do semiárido e energia solar com poeira | Se o impacto na Terra virar só um parágrafo e não aparecer no produto |
| **Criatividade** | Índice de analogia por dimensão, radar Terra × Mini-RF lunar, gêmeo com estação física, análogos brasileiros inéditos | Nenhum: é o ponto mais forte |
| **Validade** | Validação com análogos conhecidos (Atacama, Haughton) e cartão "onde a analogia quebra" | Pesos e σ escolhidos "no olho". É preciso mostrar a validação com números |
| **Relevância** | Responde exatamente ao que o desafio pede: busca sistemática, caracterização, mapa e limites | Escopo grande demais e o risco de entregar incompleto |
| **Apresentação** | Globo + demo física geram uma imagem forte | 30 s em inglês, e muita coisa para mostrar |

**Prêmios onde o projeto encaixa melhor:**
- **Best Use of Data:** dados de NASA, ESA, CSA e JAXA num índice acessível. É o encaixe mais natural.
- **Local Impact:** análogos brasileiros + semiárido + estação de baixo custo, no estilo do QUEÑARIS.
- *Galactic Impact* ou *Best Use of Science* como alternativas, se a validação ficar muito sólida.

## O que ajustar

1. **Cortar o escopo para um MVP que cabe em 30 s.**
   - **Manter:** 1 alvo (Marte/Jezero) e, se der tempo, o segundo (Lua/Shackleton); 2 perfis (Rover e Astrobiologia) em vez de 4; globo + ranking + cartão "funciona / quebra"; estação ESP32 com a tempestade de poeira.
   - **Opcional, só se sobrar tempo:** mini-rover com encoders, radar Sentinel-1/RADARSAT, JAXA, ML.
2. **Transformar a validação em evidência visível.** Uma frase e um número no produto, por exemplo: "dos 8 análogos clássicos, 7 aparecem no top 5% do índice". É isso que dá *Validade* e diferencia de "um mapa bonito".
3. **Fazer o impacto na Terra aparecer no produto.** Uma camada ou botão no globo: "Semi-arid watch: as mesmas variáveis mostram onde o semiárido está mais parecido com Marte, e isso é ruim".
4. **Escrever tudo em inglês desde já:** página, slides, legendas e interface do site. É regra eliminatória.
5. **Respeitar as regras de IA:** as imagens de referência que fizemos (mockup e estação) foram geradas com IA. Se forem usadas na submissão, precisam de marca d'água "AI-generated" visível, e o uso de IA para código e texto precisa ser declarado.
6. **Listar todas as referências:** cada conjunto de dados, biblioteca e imagem.
7. **Escolher entre vídeo e slides cedo.** Com uma demo física, o **vídeo de 30 s** mostra mais. Gravar o take da tempestade de poeira assim que a estação funcionar, sem deixar para o domingo.

## Fontes

- [NASA: 2025 Global Winners](https://www.nasa.gov/learning-resources/stem-engagement-at-nasa/nasa-announces-2025-international-space-apps-challenge-global-winners/)
- [NASA: 2024 Global Winners](https://www.nasa.gov/learning-resources/stem-engagement-at-nasa/nasa-international-space-apps-challenge-announces-2024-global-winners/)
- [NASA Science: 2023 Global Winners](https://science.nasa.gov/directorates/smd/2023-nasa-international-space-apps-challenge-announces-10-global-winners)
- [Space Apps: Judging & Awards Guide](https://www.spaceappschallenge.org/resources/judging-awards-guide)
- [Space Apps: Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/)
