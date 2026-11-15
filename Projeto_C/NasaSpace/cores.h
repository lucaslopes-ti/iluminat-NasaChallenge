#ifndef CORES_H
#define CORES_H
/*
 * Cores do terminal, iguais no Windows e no Mac.
 *   Windows: SetConsoleTextAttribute (console do Code::Blocks / cmd).
 *   Mac e Linux: codigos ANSI.
 * Uso: cor(COR_VERDE); printf("1)"); cor(COR_BRANCO); printf(" Lua\n");
 * Chame cor_reset() no fim (o main registra com atexit).
 */
#include <stdio.h>

#ifdef _WIN32
  #include <windows.h>
#endif

enum {
    COR_BRANCO,     /* texto normal, opcoes do menu          */
    COR_CINZA,      /* status, notas                          */
    COR_VERDE,      /* numeros do menu, rotulos, pais, IAP    */
    COR_AMARELO,    /* titulos e perguntas ("Escolha:")       */
    COR_VERMELHO,   /* o que o usuario digita                 */
    COR_VERMELHO_F, /* dimensao com nota ate 50               */
    COR_AZUL,       /* valores da Terra, dimensao acima de 50 */
    COR_MAGENTA     /* barras e leitura ao vivo do carrinho   */
};

static inline void cor(int c)
{
    fflush(stdout);   /* o que ja foi escrito sai com a cor anterior */
#ifdef _WIN32
    static const WORD attr[] = {
        FOREGROUND_RED | FOREGROUND_GREEN | FOREGROUND_BLUE | FOREGROUND_INTENSITY,  /* branco   */
        FOREGROUND_RED | FOREGROUND_GREEN | FOREGROUND_BLUE,                         /* cinza    */
        FOREGROUND_GREEN | FOREGROUND_INTENSITY,                                     /* verde    */
        FOREGROUND_RED | FOREGROUND_GREEN | FOREGROUND_INTENSITY,                    /* amarelo  */
        FOREGROUND_RED,                                                              /* vermelho */
        FOREGROUND_RED | FOREGROUND_INTENSITY,                                       /* vermelho forte */
        FOREGROUND_BLUE | FOREGROUND_INTENSITY,                                      /* azul     */
        FOREGROUND_RED | FOREGROUND_BLUE | FOREGROUND_INTENSITY                      /* magenta  */
    };
    SetConsoleTextAttribute(GetStdHandle(STD_OUTPUT_HANDLE), attr[c]);
#else
    static const char *ansi[] = {
        "\033[97m", "\033[37m", "\033[92m", "\033[93m",
        "\033[31m", "\033[91m", "\033[94m", "\033[95m"
    };
    fputs(ansi[c], stdout);
#endif
}

static inline void cor_reset(void)
{
    fflush(stdout);
#ifdef _WIN32
    SetConsoleTextAttribute(GetStdHandle(STD_OUTPUT_HANDLE),
                            FOREGROUND_RED | FOREGROUND_GREEN | FOREGROUND_BLUE);
#else
    fputs("\033[0m", stdout);
    fflush(stdout);
#endif
}

#endif
