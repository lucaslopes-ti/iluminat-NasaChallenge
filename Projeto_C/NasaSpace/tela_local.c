/*
 * Tela do local escolhido: o que aparece quando o seletor manda um local
 * para o carrinho. So usa printf, entao roda igual no Windows e no Mac.
 */
#include <stdio.h>
#include <string.h>
#include "tela_local.h"

#define LARGURA 76
#define SEM_DADO "-"

/* ------------------------------------------------------------ ajudantes */

static cJSON *obj(cJSON *o, const char *chave)
{
    return cJSON_GetObjectItemCaseSensitive(o, chave);
}

static const char *txt(cJSON *o, const char *chave)
{
    cJSON *v = obj(o, chave);
    return (cJSON_IsString(v) && v->valuestring) ? v->valuestring : "";
}

/* Quantos caracteres aparecem na tela (UTF-8: so conta o 1o byte de cada letra) */
static int largura_utf8(const char *s)
{
    int n = 0;
    for (; *s; s++)
        if (((unsigned char)*s & 0xC0) != 0x80) n++;
    return n;
}

/* Imprime s ocupando exatamente w colunas (corta ou completa com espacos) */
static void col(const char *s, int w)
{
    int n = 0;
    const char *p = s;
    while (*p) {
        if (((unsigned char)*p & 0xC0) != 0x80) {
            if (n == w) break;
            n++;
        }
        putchar(*p++);
    }
    for (; n < w; n++) putchar(' ');
}

static void linha(char c)
{
    for (int i = 0; i < LARGURA; i++) putchar(c);
    putchar('\n');
}

static void titulo(const char *t)
{
    int n = largura_utf8(t) + 4;
    printf("\n== %s ", t);
    for (; n < LARGURA; n++) putchar('=');
    putchar('\n');
}

/* Texto longo quebrado em palavras, com recuo */
static void paragrafo(const char *marca, const char *s, int recuo)
{
    int usado = recuo + largura_utf8(marca);
    for (int i = 0; i < recuo; i++) putchar(' ');
    printf("%s", marca);

    while (*s) {
        while (*s == ' ') s++;
        const char *fim = s;
        while (*fim && *fim != ' ') fim++;

        char palavra[256];
        int tam = (int)(fim - s);
        if (tam > (int)sizeof palavra - 1) tam = sizeof palavra - 1;
        memcpy(palavra, s, tam);
        palavra[tam] = '\0';
        int w = largura_utf8(palavra);

        if (usado + w + 1 > LARGURA && usado > recuo + 2) {
            putchar('\n');
            for (int i = 0; i < recuo + largura_utf8(marca); i++) putchar(' ');
            usado = recuo + largura_utf8(marca);
        }
        printf("%s ", palavra);
        usado += w + 1;
        s = fim;
    }
    putchar('\n');
}

static void lista(cJSON *arr, const char *marca)
{
    cJSON *it = NULL;
    int n = 0;
    cJSON_ArrayForEach(it, arr) {
        if (cJSON_IsString(it)) {
            paragrafo(marca, it->valuestring, 2);
            n++;
        }
    }
    if (n == 0) printf("  %s\n", SEM_DADO);
}

/* Barra de 0 a 100: [##########..........] */
static void barra(int pct, int tam)
{
    int cheio = (pct < 0) ? 0 : (pct * tam + 50) / 100;
    putchar('[');
    for (int i = 0; i < tam; i++) putchar(i < cheio ? '#' : '.');
    putchar(']');
}

/* Valor de valores[chave] formatado com unidade; "fracao" vira % */
static void valor_fmt(cJSON *valores, const char *chave, char *saida, int tam)
{
    cJSON *v = obj(obj(valores, chave), "valor");
    const char *un = txt(obj(valores, chave), "unidade");

    if (!cJSON_IsNumber(v)) {
        snprintf(saida, tam, "%s", SEM_DADO);
        return;
    }
    double x = v->valuedouble + 0.0;           /* evita mostrar "-0" */
    if (x > -0.005 && x < 0.005) x = 0.0;
    if (strcmp(un, "fracao") == 0) {
        snprintf(saida, tam, "%.0f %%", x * 100);
    } else if (strcmp(un, "adimensional") == 0 || strcmp(un, "indice") == 0) {
        snprintf(saida, tam, "%g", x);
    } else {
        snprintf(saida, tam, "%g %s", x, un);
    }
}

static const char *nome_corpo(const char *corpo)
{
    if (strcmp(corpo, "moon") == 0) return "Lua";
    if (strcmp(corpo, "mars") == 0) return "Marte";
    return corpo;
}

/* ------------------------------------------------------------ a tela */

void tela_local_mostrar(cJSON *raiz, cJSON *local, cJSON *alvo,
                        cJSON *sensores, cJSON *leitura)
{
    const char *alvo_id = txt(alvo, "id");
    cJSON *comp    = obj(obj(local, "comparacoes"), alvo_id);
    cJSON *iap     = obj(comp, "iap");
    cJSON *dims    = obj(comp, "dimensoes_pct");
    cJSON *val_t   = obj(local, "valores");
    cJSON *val_a   = obj(alvo, "valores");
    cJSON *geral   = obj(iap, "geral");
    int nota       = cJSON_IsNumber(geral) ? geral->valueint : -1;
    char buf[128], buf2[128];

    /* ---------- cabecalho ---------- */
    putchar('\n');
    linha('#');
    printf("  ILLUMINAT HORIZONTES  |  carrinho em modo: %s\n", txt(local, "nome"));
    linha('#');

    printf("\n  TERRA   %s\n", txt(local, "nome"));
    snprintf(buf, sizeof buf, "%s, %s, %s", txt(local, "cidade"), txt(local, "regiao"), txt(local, "pais"));
    printf("          %s\n", buf);
    printf("          %s\n", txt(local, "feicao"));

    printf("\n  ALVO    %s (%s)\n", txt(alvo, "nome"), nome_corpo(txt(alvo, "corpo")));
    printf("          %s\n", txt(alvo, "regiao"));
    paragrafo("", txt(alvo, "resumo"), 10);
    if (cJSON_IsTrue(obj(alvo, "coord_aprox")))
        printf("          (coordenadas aproximadas)\n");

    /* ---------- nota ---------- */
    titulo("SIMILARIDADE (IAP)");
    printf("  Geral   ");
    barra(nota, 40);
    if (nota >= 0) printf("  %d / 100\n", nota);
    else printf("  %s\n", SEM_DADO);

    const char *perfis[][2] = {
        {"rover", "Rover"}, {"astrobio", "Astrobiologia"}, {"isru", "Gelo / ISRU"},
        {"habitat", "Base e construcao"}, {"energia", "Energia solar"}
    };
    for (int i = 0; i < 5; i++) {
        cJSON *p = obj(iap, perfis[i][0]);
        printf("  ");
        col(perfis[i][1], 18);
        if (cJSON_IsNumber(p)) printf("%3d\n", p->valueint);
        else printf("%3s\n", SEM_DADO);
    }

    /* ---------- dimensoes ---------- */
    titulo("9 DIMENSOES");
    cJSON *d = NULL;
    cJSON_ArrayForEach(d, obj(obj(raiz, "metodo"), "dimensoes")) {
        cJSON *v = obj(dims, txt(d, "id"));
        printf("  ");
        col(txt(d, "rotulo"), 24);
        if (cJSON_IsNumber(v)) {
            barra(v->valueint, 30);
            printf(" %3d\n", v->valueint);
        } else {
            printf("%-32s %3s\n", "(sem dado)", SEM_DADO);
        }
    }

    /* ---------- Terra x alvo ---------- */
    titulo("TERRA x ALVO");
    printf("  ");
    col("Medida", 32);
    col("Terra", 14);
    col("Alvo", 14);
    printf("Status\n");
    printf("  ");
    for (int i = 0; i < LARGURA - 2; i++) putchar('-');
    putchar('\n');

    const char *medidas[] = {
        "declividade_media", "frac_transitavel_15", "elev_relativa_m",
        "lst_dia_c", "lst_noite_c", "amplitude_termica_c",
        "insolacao_toa_wm2", "sol_max_graus", "frac_ano_sol_continuo",
        "albedo_medio", "aod_medio", "chuva_anual_mm", "ndvi_medio",
        "pressao_kpa", "gravidade_g", "dia_local_h", NULL
    };
    for (int i = 0; medidas[i]; i++) {
        cJSON *mt = obj(val_t, medidas[i]);
        if (mt == NULL) continue;
        valor_fmt(val_t, medidas[i], buf, sizeof buf);
        valor_fmt(val_a, medidas[i], buf2, sizeof buf2);
        printf("  ");
        col(txt(mt, "rotulo"), 32);
        col(buf, 14);
        col(buf2, 14);
        printf("%s\n", txt(mt, "status"));
    }

    /* ---------- funciona / quebra / testes ---------- */
    if (strcmp(txt(local, "alvo"), alvo_id) != 0)
        printf("\n  (os textos abaixo comparam com %s, o melhor alvo deste local)\n",
               txt(local, "alvo_nome"));

    titulo("ONDE A ANALOGIA FUNCIONA");
    lista(obj(local, "funciona"), "+ ");

    titulo("ONDE QUEBRA");
    lista(obj(local, "quebra"), "- ");
    cJSON *sq = NULL;
    cJSON_ArrayForEach(sq, obj(raiz, "sempre_quebra"))
        paragrafo("! ", txt(sq, "texto"), 2);

    titulo("O QUE TESTAR AQUI COM O CARRINHO");
    lista(obj(local, "testes"), "> ");

    /* ---------- carrinho ao vivo ---------- */
    if (sensores != NULL) {
        titulo("CARRINHO (AO VIVO)");
        printf("  ");
        col("Sensor", 18);
        col("Ao vivo", 14);
        col("Local (Terra)", 22);
        printf("Alvo\n");
        printf("  ");
        for (int i = 0; i < LARGURA - 2; i++) putchar('-');
        putchar('\n');

        cJSON *s = NULL;
        cJSON_ArrayForEach(s, obj(sensores, "sensores")) {
            const char *chave = s->string;          /* temp, uv, pm25... */
            cJSON *lido = leitura ? obj(leitura, chave) : NULL;
            if (cJSON_IsNumber(lido))
                snprintf(buf, sizeof buf, "%g %s", lido->valuedouble, txt(s, "unidade"));
            else
                snprintf(buf, sizeof buf, "%s", SEM_DADO);

            /* primeiro campo de comparacao que existir no local e no alvo */
            char loc_txt[128] = SEM_DADO, alv_txt[128] = SEM_DADO;
            cJSON *c = NULL;
            int achou_t = 0, achou_a = 0;
            cJSON_ArrayForEach(c, obj(s, "campos")) {
                if (!cJSON_IsString(c)) continue;
                if (!achou_t && cJSON_IsNumber(obj(obj(val_t, c->valuestring), "valor"))) {
                    valor_fmt(val_t, c->valuestring, loc_txt, sizeof loc_txt);
                    achou_t = 1;
                }
                if (!achou_a && cJSON_IsNumber(obj(obj(val_a, c->valuestring), "valor"))) {
                    valor_fmt(val_a, c->valuestring, alv_txt, sizeof alv_txt);
                    achou_a = 1;
                }
            }
            printf("  ");
            col(txt(s, "nome"), 18);
            col(buf, 14);
            col(loc_txt, 22);
            printf("%s\n", alv_txt);
        }
        if (leitura == NULL)
            printf("\n  Aguardando leituras em illuminat-horizontes/carrinho...\n");
    }

    /* ---------- rodape ---------- */
    putchar('\n');
    linha('-');
    printf("  medido = satelite/modelo NASA | calculado = fisica | referencia = missao\n");
    if (!cJSON_IsTrue(obj(local, "dados_completos")))
        printf("  Atencao: este local ainda tem dados incompletos.\n");
    linha('-');
}
