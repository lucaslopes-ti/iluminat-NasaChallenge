/*
 * Illuminat Horizontes - tela do carrinho
 *
 * 1. O usuario escolhe Lua ou Marte.
 * 2. Escolhe o alvo (cratera, regiao).
 * 3. Ve os 3 locais da Terra mais parecidos e escolhe um.
 *    Aparece a tela do local (tela_local.c): nota, 9 dimensoes, Terra x alvo,
 *    onde funciona, onde quebra, o que testar e os sensores do carrinho.
 * 4. A escolha vai por MQTT (retida) em illuminat-horizontes/selecao.
 * 5. Abre a ponte (firmware/ponte_serial_mqtt.py) na porta Bluetooth do
 *    carrinho (HC-05), com --local <id>: ela publica o perfil do local e
 *    passa a mandar as leituras do carrinho para o MQTT.
 * 6. Modo ao vivo: assina illuminat-horizontes/carrinho (mosquitto_sub) e
 *    redesenha a tela do local a cada leitura, na coluna "Ao vivo".
 *    Ctrl+C sai (e, no Mac, desliga a ponte junto).
 *
 * Funciona no Windows e no Mac. Os arquivos sao procurados a partir da
 * pasta do executavel e da pasta atual, entao nao ha caminho fixo.
 *
 * Le um JSON so: dados/essenciais/analogos_completo.json
 * (mais dados/essenciais/mqtt/sensores.json para a tabela dos sensores).
 *
 * Uso:  NasaSpace            (porta Bluetooth padrao, ver PORTA_BT)
 *       NasaSpace COM7       (Windows: a porta "Saida" do HC-05)
 *       ./NasaSpace /dev/cu.HC-05
 *
 * Broker: broker.hivemq.com, ou o da variavel MQTT_BROKER
 * (ex.: MQTT_BROKER=localhost para testar com um mosquitto local).
 *
 * Precisa do mosquitto_pub e do mosquitto_sub no PATH (Mosquitto) e,
 * para a ponte, de Python com: pip install pyserial paho-mqtt
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <signal.h>
#include <time.h>
#include "Bibliotecas/cJSON.h"
#include "tela_local.h"

#ifdef _WIN32
  #include <windows.h>
  #define PYTHON   "python"
  #define PORTA_BT "COM5"             /* troque pela porta "Saida" do HC-05 */
  #define popen    _popen
  #define pclose   _pclose
#else
  #include <unistd.h>
  #ifdef __APPLE__
    #include <mach-o/dyld.h>
  #endif
  #define PYTHON   "python3"
  #define PORTA_BT "/dev/cu.HC-05"
#endif

/* Mesma velocidade do Serial.begin() do arduino_carrinho.ino.
   O HC-05 vem em 9600: mude o modulo para 115200 com AT+UART=115200,0,0. */
#define BAUD_BT     115200

#define BROKER      "broker.hivemq.com"
#define TOPICO_SEL  "illuminat-horizontes/selecao"
#define TOPICO_CAR  "illuminat-horizontes/carrinho"

#define ARQ_DADOS   "analogos_completo.json"
#define ARQ_SENS    "mqtt/sensores.json"
#define ARQ_PONTE   "ponte_serial_mqtt.py"

#define MAX_CAMINHO 1024
#define MAX_ALVOS   32
#define TOP_N       3

char        pasta_exe[MAX_CAMINHO];
const char *broker = BROKER;
volatile sig_atomic_t sair = 0;

void        descobrir_pasta_exe(const char *argv0);
int         achar_arquivo(const char *nome, const char *subpastas[], char *saida);
char       *ler_arquivo_para_string(const char *filename);
int         ler_opcao(int min, int max);
const char *texto(cJSON *obj, const char *chave);
cJSON      *achar_por_id(cJSON *lista, const char *id);
int         nota_no_alvo(cJSON *local, const char *alvo_id);
int         enviar_mqtt(const char *topico, const char *mensagem);
long        iniciar_ponte(const char *caminho_ponte, const char *porta, const char *local_id);
void        parar_ponte(long pid);
void        modo_ao_vivo(cJSON *raiz, cJSON *local, cJSON *alvo, cJSON *sensores);
void        limpar_tela(void);
void        ao_ctrl_c(int sinal);

/* Onde procurar, relativo a pasta do executavel (bin/Debug) e a pasta atual.
   O primeiro que existir vale; copiar o JSON para bin/Debug tambem funciona. */
const char *PASTAS_DADOS[] = {
    "",                                   /* ao lado do executavel           */
    "../../../../dados/essenciais/",      /* bin/Debug -> raiz do repositorio */
    "../../dados/essenciais/",            /* rodando da pasta do projeto      */
    NULL
};
const char *PASTAS_PONTE[] = {
    "../../../../firmware/",
    "../../firmware/",
    "",
    NULL
};

int main(int argc, char *argv[])
{
#ifdef _WIN32
    SetConsoleOutputCP(CP_UTF8);   /* os nomes no JSON tem acento (UTF-8) */
#endif
    const char *porta = (argc > 1) ? argv[1] : PORTA_BT;
    if (getenv("MQTT_BROKER") && getenv("MQTT_BROKER")[0])
        broker = getenv("MQTT_BROKER");
    char caminho_dados[MAX_CAMINHO], caminho_ponte[MAX_CAMINHO];

    descobrir_pasta_exe(argc > 0 ? argv[0] : "");

    if (!achar_arquivo(ARQ_DADOS, PASTAS_DADOS, caminho_dados)) {
        printf("Erro: nao achei %s (procurei em dados/essenciais e ao lado do programa)\n", ARQ_DADOS);
        return 1;
    }

    char *conteudo = ler_arquivo_para_string(caminho_dados);
    if (conteudo == NULL) return 1;

    cJSON *raiz = cJSON_Parse(conteudo);
    free(conteudo);
    if (raiz == NULL) {
        fprintf(stderr, "Erro de sintaxe no JSON perto de: %s\n", cJSON_GetErrorPtr());
        return 1;
    }

    cJSON *alvos   = cJSON_GetObjectItemCaseSensitive(raiz, "alvos");
    cJSON *locais  = cJSON_GetObjectItemCaseSensitive(raiz, "locais");
    cJSON *ranking = cJSON_GetObjectItemCaseSensitive(raiz, "ranking_por_alvo");
    if (!cJSON_IsArray(alvos) || !cJSON_IsArray(locais) || !cJSON_IsObject(ranking)) {
        fprintf(stderr, "JSON sem alvos/locais/ranking_por_alvo\n");
        cJSON_Delete(raiz);
        return 1;
    }

    /* ---------- 1. Lua ou Marte ---------- */
    printf("=== Illuminat Horizontes ===\n\n");
    printf("1) Lua\n2) Marte\nEscolha: ");
    const char *corpo = (ler_opcao(1, 2) == 1) ? "moon" : "mars";

    /* ---------- 2. Lista os alvos desse corpo ---------- */
    cJSON *opcoes[MAX_ALVOS];
    int n = 0;
    cJSON *alvo = NULL;

    printf("\nAlvos em %s:\n", strcmp(corpo, "moon") == 0 ? "Lua" : "Marte");
    cJSON_ArrayForEach(alvo, alvos) {
        if (strcmp(texto(alvo, "corpo"), corpo) == 0 && n < MAX_ALVOS) {
            opcoes[n++] = alvo;
            printf("%2d) %s\n", n, texto(alvo, "nome"));
        }
    }
    if (n == 0) {
        printf("Nenhum alvo encontrado.\n");
        cJSON_Delete(raiz);
        return 1;
    }
    printf("Escolha: ");
    alvo = opcoes[ler_opcao(1, n) - 1];
    const char *alvo_id = texto(alvo, "id");

    /* ---------- 3. Top 3 analogos na Terra ---------- */
    cJSON *ordem = cJSON_GetObjectItemCaseSensitive(ranking, alvo_id);
    cJSON *top[TOP_N];
    int nt = 0;
    cJSON *item = NULL;

    printf("\nMelhores analogos na Terra para %s:\n", texto(alvo, "nome"));
    cJSON_ArrayForEach(item, ordem) {
        if (nt == TOP_N) break;
        if (!cJSON_IsString(item)) continue;
        cJSON *loc = achar_por_id(locais, item->valuestring);
        if (loc == NULL) continue;
        top[nt++] = loc;
        printf("%d) %-40s %-12s IAP %d\n", nt, texto(loc, "nome"),
               texto(loc, "pais"), nota_no_alvo(loc, alvo_id));
    }
    if (nt == 0) {
        printf("Nenhum local para esse alvo.\n");
        cJSON_Delete(raiz);
        return 1;
    }

    printf("\nQual local o carrinho vai simular? ");
    cJSON *escolhido = top[ler_opcao(1, nt) - 1];
    const char *local_id = texto(escolhido, "id");

    /* ---------- Tela do local escolhido ---------- */
    cJSON *sensores = NULL;
    char caminho_sens[MAX_CAMINHO];
    if (achar_arquivo(ARQ_SENS, PASTAS_DADOS, caminho_sens)) {
        char *s = ler_arquivo_para_string(caminho_sens);
        if (s) {
            sensores = cJSON_Parse(s);
            free(s);
        }
    }
    tela_local_mostrar(raiz, escolhido, alvo, sensores, NULL);

    /* ---------- 4. Monta a mensagem e envia por MQTT ---------- */
    cJSON *msg = cJSON_CreateObject();
    cJSON_AddStringToObject(msg, "corpo", corpo);
    cJSON_AddStringToObject(msg, "alvo", alvo_id);
    cJSON_AddStringToObject(msg, "alvo_nome", texto(alvo, "nome"));
    cJSON_AddStringToObject(msg, "local", local_id);
    cJSON_AddStringToObject(msg, "local_nome", texto(escolhido, "nome"));
    cJSON_AddNumberToObject(msg, "nota_pct", nota_no_alvo(escolhido, alvo_id));

    cJSON *lista = cJSON_AddArrayToObject(msg, "top3");
    for (int i = 0; i < nt; i++) {
        cJSON *t = cJSON_CreateObject();
        cJSON_AddStringToObject(t, "id", texto(top[i], "id"));
        cJSON_AddStringToObject(t, "nome", texto(top[i], "nome"));
        cJSON_AddNumberToObject(t, "nota_pct", nota_no_alvo(top[i], alvo_id));
        cJSON_AddItemToArray(lista, t);
    }

    char *json = cJSON_PrintUnformatted(msg);
    printf("\nEnviando para %s:\n%s\n", TOPICO_SEL, json);
    fflush(stdout);
    if (enviar_mqtt(TOPICO_SEL, json) != 0)
        printf("Falhou o envio (o mosquitto_pub esta instalado e no PATH?)\n");
    free(json);
    cJSON_Delete(msg);

    /* ---------- 5. Liga a ponte na porta Bluetooth do carrinho ---------- */
    long pid_ponte = 0;
    printf("\nIniciar o carrinho via Bluetooth (%s)? (1 = sim, 2 = nao): ", porta);
    if (ler_opcao(1, 2) == 1) {
        if (!achar_arquivo(ARQ_PONTE, PASTAS_PONTE, caminho_ponte))
            printf("Erro: nao achei firmware/%s\n", ARQ_PONTE);
        else
            pid_ponte = iniciar_ponte(caminho_ponte, porta, local_id);
    }

    /* ---------- 6. Coluna "Ao vivo" com o MQTT do carrinho ---------- */
    printf("\nAcompanhar o carrinho ao vivo? (1 = sim, 2 = nao): ");
    if (ler_opcao(1, 2) == 1)
        modo_ao_vivo(raiz, escolhido, alvo, sensores);

    parar_ponte(pid_ponte);
    cJSON_Delete(sensores);
    cJSON_Delete(raiz);
    return 0;
}

/* Liga a ponte em segundo plano, para a tela ficar livre.
   Mac: roda com & e guarda o PID; a saida vai para ponte.log ao lado do programa.
   Windows: abre numa janela minimizada propria ("Ponte do carrinho"). */
long iniciar_ponte(const char *caminho_ponte, const char *porta, const char *local_id)
{
    char cmd[MAX_CAMINHO * 3];
#ifdef _WIN32
    snprintf(cmd, sizeof cmd,
             "start \"Ponte do carrinho\" /MIN " PYTHON " \"%s\" --porta %s --baud %d --broker %s --local %s",
             caminho_ponte, porta, BAUD_BT, broker, local_id);
    printf("%s\n", cmd);
    system(cmd);
    printf("A ponte abriu em outra janela. Feche essa janela para desligar o carrinho.\n");
    return 0;
#else
    snprintf(cmd, sizeof cmd,
             PYTHON " \"%s\" --porta %s --baud %d --broker %s --local %s > \"%sponte.log\" 2>&1 & echo $!",
             caminho_ponte, porta, BAUD_BT, broker, local_id, pasta_exe);
    printf("%s\n", cmd);
    long pid = 0;
    FILE *p = popen(cmd, "r");
    if (p) {
        if (fscanf(p, "%ld", &pid) != 1) pid = 0;
        pclose(p);
    }
    printf("Ponte ligada (PID %ld). Mensagens em %sponte.log\n", pid, pasta_exe);
    return pid;
#endif
}

void parar_ponte(long pid)
{
#ifndef _WIN32
    if (pid > 0) {
        char cmd[64];
        snprintf(cmd, sizeof cmd, "kill %ld 2>/dev/null", pid);
        system(cmd);
        printf("Ponte desligada.\n");
    }
#else
    (void)pid;
#endif
}

void ao_ctrl_c(int sinal)
{
    (void)sinal;
    sair = 1;   /* o mosquitto_sub tambem recebe o Ctrl+C e fecha; ai o laco termina */
}

void limpar_tela(void)
{
    printf("\033[2J\033[H");   /* ANSI: funciona no Terminal do Mac e no Windows 10+ */
    fflush(stdout);
}

/* Assina o topico do carrinho e redesenha a tela do local a cada leitura. */
void modo_ao_vivo(cJSON *raiz, cJSON *local, cJSON *alvo, cJSON *sensores)
{
#ifdef _WIN32
    HANDLE h = GetStdHandle(STD_OUTPUT_HANDLE);
    DWORD modo = 0;
    if (GetConsoleMode(h, &modo))
        SetConsoleMode(h, modo | 0x0004);   /* ENABLE_VIRTUAL_TERMINAL_PROCESSING */
#endif
    char cmd[512];
    snprintf(cmd, sizeof cmd, "mosquitto_sub -h %s -t %s -q 0", broker, TOPICO_CAR);

    FILE *sub = popen(cmd, "r");
    if (sub == NULL) {
        printf("Nao consegui rodar o mosquitto_sub (esta no PATH?)\n");
        return;
    }
    signal(SIGINT, ao_ctrl_c);

    limpar_tela();
    tela_local_mostrar(raiz, local, alvo, sensores, NULL);
    printf("  Ouvindo %s em %s. Ctrl+C para sair.\n", TOPICO_CAR, broker);
    fflush(stdout);

    char linha[2048];
    long n = 0;
    while (!sair && fgets(linha, sizeof linha, sub) != NULL) {
        cJSON *leitura = cJSON_Parse(linha);
        if (!cJSON_IsObject(leitura)) {       /* ignora o que nao for JSON */
            cJSON_Delete(leitura);
            continue;
        }
        n++;
        char hora[16];
        time_t t = time(NULL);
        strftime(hora, sizeof hora, "%H:%M:%S", localtime(&t));

        limpar_tela();
        tela_local_mostrar(raiz, local, alvo, sensores, leitura);
        printf("  Ultima leitura %s (%ld recebidas) de %s. Ctrl+C para sair.\n", hora, n, TOPICO_CAR);
        fflush(stdout);
        cJSON_Delete(leitura);
    }
    pclose(sub);
    signal(SIGINT, SIG_DFL);
    printf("\nModo ao vivo encerrado.\n");
}

/* Guarda em pasta_exe a pasta do executavel, terminando em '/' (ou vazia). */
void descobrir_pasta_exe(const char *argv0)
{
    char buf[MAX_CAMINHO] = "";
#if defined(_WIN32)
    GetModuleFileNameA(NULL, buf, sizeof buf);
#elif defined(__APPLE__)
    uint32_t tam = sizeof buf;
    if (_NSGetExecutablePath(buf, &tam) != 0) buf[0] = '\0';
#else
    ssize_t k = readlink("/proc/self/exe", buf, sizeof buf - 1);
    buf[k > 0 ? k : 0] = '\0';
#endif
    if (buf[0] == '\0') {
        strncpy(buf, argv0, sizeof buf - 1);
        buf[sizeof buf - 1] = '\0';
    }

    /* corta o nome do programa: tudo depois da ultima barra */
    char *barra = NULL;
    for (char *p = buf; *p; p++)
        if (*p == '/' || *p == '\\') barra = p;
    if (barra) barra[1] = '\0';
    else buf[0] = '\0';

    /* o Windows aceita '/' no fopen, entao padroniza */
    for (char *p = buf; *p; p++)
        if (*p == '\\') *p = '/';

    strcpy(pasta_exe, buf);
}

/* Procura "nome" nas subpastas, primeiro a partir do executavel e depois
   da pasta atual. Devolve 1 e o caminho em "saida" se achar. */
int achar_arquivo(const char *nome, const char *subpastas[], char *saida)
{
    const char *bases[] = { pasta_exe, "" };
    for (int b = 0; b < 2; b++) {
        for (int i = 0; subpastas[i] != NULL; i++) {
            snprintf(saida, MAX_CAMINHO, "%s%s%s", bases[b], subpastas[i], nome);
            FILE *f = fopen(saida, "rb");
            if (f) {
                fclose(f);
                return 1;
            }
        }
    }
    return 0;
}

/* Le um numero entre min e max, repetindo ate ser valido */
int ler_opcao(int min, int max)
{
    char linha[32];
    int v;
    fflush(stdout);
    while (fgets(linha, sizeof linha, stdin) != NULL) {
        if (sscanf(linha, "%d", &v) == 1 && v >= min && v <= max)
            return v;
        printf("Digite um numero de %d a %d: ", min, max);
        fflush(stdout);
    }
    exit(0);   /* fim da entrada */
}

/* Devolve o texto de uma chave, ou "" se nao existir */
const char *texto(cJSON *obj, const char *chave)
{
    cJSON *v = cJSON_GetObjectItemCaseSensitive(obj, chave);
    return (cJSON_IsString(v) && v->valuestring) ? v->valuestring : "";
}

cJSON *achar_por_id(cJSON *lista, const char *id)
{
    cJSON *x = NULL;
    cJSON_ArrayForEach(x, lista) {
        if (strcmp(texto(x, "id"), id) == 0) return x;
    }
    return NULL;
}

/* locais[].comparacoes.<alvo>.iap.geral */
int nota_no_alvo(cJSON *local, const char *alvo_id)
{
    cJSON *c = cJSON_GetObjectItemCaseSensitive(local, "comparacoes");
    c = cJSON_GetObjectItemCaseSensitive(c, alvo_id);
    c = cJSON_GetObjectItemCaseSensitive(c, "iap");
    c = cJSON_GetObjectItemCaseSensitive(c, "geral");
    return cJSON_IsNumber(c) ? c->valueint : -1;
}

/* Publica (retido, QoS 1) com o mosquitto_pub.
   Windows (cmd): a mensagem vai entre aspas duplas, com \" por dentro.
   Mac (sh): vai entre aspas simples; um ' no texto vira '\''. */
int enviar_mqtt(const char *topico, const char *mensagem)
{
    char esc[3500];
    char cmd[4096];
    int j = 0;

    for (int i = 0; mensagem[i] && j < (int)sizeof esc - 5; i++) {
#ifdef _WIN32
        if (mensagem[i] == '"') esc[j++] = '\\';
        esc[j++] = mensagem[i];
#else
        if (mensagem[i] == '\'') {
            memcpy(esc + j, "'\\''", 4);
            j += 4;
        } else {
            esc[j++] = mensagem[i];
        }
#endif
    }
    esc[j] = '\0';

#ifdef _WIN32
    snprintf(cmd, sizeof cmd, "mosquitto_pub -h %s -t %s -r -q 1 -m \"%s\"", broker, topico, esc);
#else
    snprintf(cmd, sizeof cmd, "mosquitto_pub -h %s -t %s -r -q 1 -m '%s'", broker, topico, esc);
#endif
    return system(cmd);
}

char *ler_arquivo_para_string(const char *filename)
{
    FILE *file = fopen(filename, "rb");
    if (file == NULL) {
        printf("Erro: nao foi possivel abrir %s\n", filename);
        return NULL;
    }
    fseek(file, 0, SEEK_END);
    long length = ftell(file);
    fseek(file, 0, SEEK_SET);

    char *buffer = (char *)malloc(length + 1);
    if (buffer == NULL) {
        printf("Erro de alocacao de memoria.\n");
        fclose(file);
        return NULL;
    }
    size_t lidos = fread(buffer, 1, length, file);
    buffer[lidos] = '\0';
    fclose(file);
    return buffer;
}
