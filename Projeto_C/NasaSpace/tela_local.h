#ifndef TELA_LOCAL_H
#define TELA_LOCAL_H

#include "Bibliotecas/cJSON.h"

/*
 * Mostra no terminal a tela de um local da Terra comparado com um alvo
 * (Lua ou Marte), usando o analogos_completo.json.
 *
 *   raiz      raiz do analogos_completo.json (usa metodo.dimensoes e sempre_quebra)
 *   local     item de raiz.locais[]
 *   alvo      item de raiz.alvos[]
 *   sensores  raiz do dados/essenciais/mqtt/sensores.json, ou NULL
 *   leitura   ultima mensagem do carrinho ({"temp":24.1,...}), ou NULL
 *             (sem leitura, a coluna "Ao vivo" mostra "-")
 */
void tela_local_mostrar(cJSON *raiz, cJSON *local, cJSON *alvo,
                        cJSON *sensores, cJSON *leitura);

#endif
