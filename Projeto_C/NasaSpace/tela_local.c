/*
 * Tela do local escolhido: Terra x alvo, 9 dimensoes e carrinho ao vivo.
 * So usa printf, entao roda igual no Windows e no Mac.
 */
#include <stdio.h>
#include <string.h>
#include "tela_local.h"

#define LARGURA  74
#define SEM_DADO "-"

static cJSON *obj(cJSON *o, const char *chave)
{
    return cJSON_GetObjectItemCaseSensitive(o, chave);
}

static const char *txt(cJSON *o, const char *chave)
{
    cJSON *v = obj(o, chave);
    return (cJSON_IsString(v) && v->valuestring) ? v->valuestring : "";
}

/* Imprime s ocupando w colunas. Conta letras UTF-8, nao bytes,
   para os acentos nao desalinharem as colunas. */
static void col(const char *s, int w)
{
    int n = 0;
    while (*s) {
        if (((unsigned char)*s & 0xC0) != 0x80) {
            if (n == w) break;
            n++;
        }
        putchar(*s++);
    }
    for (; n < w; n++) putchar(' ');
}

static void secao(const char *nome)
{
    printf("\n%s\n", nome);
    for (int i = 0; i < LARGURA; i++) putchar('-');
    putchar('\n');
}

static void barra(int pct, int tam)
{
    int cheio = (pct * tam + 50) / 100;
    for (int i = 0; i < tam; i++) putchar(i < cheio ? '#' : '.');
}

/* valores[chave] com unidade; "fracao" vira %.
   Zero que quer dizer "nao existe" (Lua sem ar, Marte sem chuva) vira "nao ha". */
static void valor_fmt(cJSON *valores, const char *chave, char *saida, int tam)
{
    cJSON *item = obj(valores, chave);
    cJSON *v = obj(item, "valor");
    const char *un = txt(item, "unidade");
    const char *fonte = txt(item, "fonte");

    if (!cJSON_IsNumber(v)) {
        snprintf(saida, tam, "%s", SEM_DADO);
        return;
    }
    double x = v->valuedouble;
    if (x > -0.005 && x < 0.005) x = 0.0;      /* evita "-0" */

    if (x == 0.0 && (strcmp(fonte, "sem_atmosfera") == 0 || strcmp(fonte, "fisico_marte") == 0)) {
        snprintf(saida, tam, "nao ha");
        return;
    }
    if (strcmp(chave, "elev_relativa_m") == 0 && x < 0)
        x = -x;                                 /* desnivel: o tamanho, sem sinal */

    if (strcmp(un, "fracao") == 0)
        snprintf(saida, tam, "%.0f %%", x * 100);
    else if (strcmp(un, "adimensional") == 0 || strcmp(un, "indice") == 0)
        snprintf(saida, tam, "%g", x);
    else
        snprintf(saida, tam, "%g %s", x, un);
}

void tela_local_mostrar(cJSON *raiz, cJSON *local, cJSON *alvo,
                        cJSON *sensores, cJSON *leitura)
{
    const char *alvo_id = txt(alvo, "id");
    cJSON *comp  = obj(obj(local, "comparacoes"), alvo_id);
    cJSON *dims  = obj(comp, "dimensoes_pct");
    cJSON *geral = obj(obj(comp, "iap"), "geral");
    cJSON *val_t = obj(local, "valores");
    cJSON *val_a = obj(alvo, "valores");
    char a[64], b[64];

    /* uma linha so: quem e comparado com quem */
    printf("\n%s (%s)  x  %s", txt(local, "nome"), txt(local, "pais"), txt(alvo, "nome"));
    if (cJSON_IsNumber(geral)) printf("   IAP %d", geral->valueint);
    putchar('\n');

    /* ---------- Terra x alvo ---------- */
    secao("TERRA x ALVO");
    col("", 32); col("Terra", 14); col("Alvo", 14); printf("Status\n");

    const char *medidas[] = {
        "declividade_media", "frac_transitavel_15", "elev_relativa_m",
        "lst_dia_c", "lst_noite_c", "amplitude_termica_c",
        "insolacao_toa_wm2", "sol_max_graus", "frac_tempo_sol",
        "albedo_medio", "aod_medio", "chuva_anual_mm", "ndvi_medio",
        "pressao_kpa", "gravidade_g", "dia_local_h", NULL
    };
    for (int i = 0; medidas[i]; i++) {
        cJSON *m = obj(val_t, medidas[i]);
        if (m == NULL) continue;
        valor_fmt(val_t, medidas[i], a, sizeof a);
        valor_fmt(val_a, medidas[i], b, sizeof b);
        col(txt(m, "rotulo"), 32);
        col(a, 14);
        col(b, 14);
        printf("%s\n", txt(m, "status"));
    }

    /* ---------- 9 dimensoes ---------- */
    secao("9 DIMENSOES");
    cJSON *d = NULL;
    cJSON_ArrayForEach(d, obj(obj(raiz, "metodo"), "dimensoes")) {
        cJSON *v = obj(dims, txt(d, "id"));
        col(txt(d, "rotulo"), 26);
        if (cJSON_IsNumber(v)) {
            barra(v->valueint, 30);
            printf("  %3d\n", v->valueint);
        } else {
            printf("sem dado\n");
        }
    }

    /* ---------- carrinho ao vivo ---------- */
    if (sensores == NULL) return;

    secao("CARRINHO AO VIVO");
    col("", 18); col("Agora", 14); col("Local", 18); printf("Alvo\n");

    cJSON *s = NULL;
    cJSON_ArrayForEach(s, obj(sensores, "sensores")) {
        cJSON *lido = leitura ? obj(leitura, s->string) : NULL;
        char agora[64] = SEM_DADO, loc[64] = SEM_DADO, alv[64] = SEM_DADO;
        int tem_t = 0, tem_a = 0;
        cJSON *c = NULL;

        if (cJSON_IsNumber(lido))
            snprintf(agora, sizeof agora, "%g %s", lido->valuedouble, txt(s, "unidade"));

        /* primeiro campo de comparacao que existir no local e no alvo */
        cJSON_ArrayForEach(c, obj(s, "campos")) {
            if (!cJSON_IsString(c)) continue;
            if (!tem_t && cJSON_IsNumber(obj(obj(val_t, c->valuestring), "valor"))) {
                valor_fmt(val_t, c->valuestring, loc, sizeof loc);
                tem_t = 1;
            }
            if (!tem_a && cJSON_IsNumber(obj(obj(val_a, c->valuestring), "valor"))) {
                valor_fmt(val_a, c->valuestring, alv, sizeof alv);
                tem_a = 1;
            }
        }
        col(txt(s, "nome"), 18);
        col(agora, 14);
        col(loc, 18);
        printf("%s\n", alv);
    }
    if (leitura == NULL)
        printf("\naguardando o carrinho...\n");
}
