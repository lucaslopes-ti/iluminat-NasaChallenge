#include <stdio.h>
#include <stdlib.h>
#include "Bibliotecas/cJSON.h"
#include "Bibliotecas/funcoesJSON.h"


int main() {
    const char *filename = "D:/Documentos/Nasa Hackaton/iluminat-NasaChallenge/Projeto_C/NasaSpace/bin/Debug/dados.json";

    // 1. Lê o arquivo externo para a memória
    char *json_string = ler_arquivo_para_string(filename);
    if (json_string == NULL) {
        return 1;
    }

    // 2. Faz o parse da string JSON usando o cJSON
    cJSON *json_root = cJSON_Parse(json_string);

    // A string do arquivo já pode ser liberada da memória
    free(json_string);

    if (json_root == NULL) {
        const char *error_ptr = cJSON_GetErrorPtr();
        if (error_ptr != NULL) {
            fprintf(stderr, "Erro de sintaxe no JSON antes de: %s\n", error_ptr);
        }
        cJSON_Delete(json_root);
        return 1;
    }

    // 3. Extrai os dados do objeto JSON
    cJSON *nome = cJSON_GetObjectItemCaseSensitive(json_root, "nome");
    cJSON *idade = cJSON_GetObjectItemCaseSensitive(json_root, "idade");
    cJSON *ativo = cJSON_GetObjectItemCaseSensitive(json_root, "ativo");

    if (cJSON_IsString(nome) && (nome->valuestring != NULL)) {
        printf("Nome: %s\n", nome->valuestring);
    }

    if (cJSON_IsNumber(idade)) {
        printf("Idade: %d\n", idade->valueint);
    }

    if (cJSON_IsBool(ativo)) {
        printf("Ativo: %s\n", cJSON_IsTrue(ativo) ? "Sim" : "Não");
    }

    // 4. Limpeza da árvore cJSON da memória para evitar vazamentos (Memory Leak)
    cJSON_Delete(json_root);

    return 0;
}
