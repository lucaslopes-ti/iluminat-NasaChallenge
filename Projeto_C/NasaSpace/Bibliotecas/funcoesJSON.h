#include <stdio.h>
#include <stdlib.h>
#include "Bibliotecas/cJSON.h"

// Função auxiliar para carregar o arquivo inteiro para uma string
char* ler_arquivo_para_string(const char *filename) {
    FILE *file = fopen(filename, "rb");
    if (file == NULL) {
        printf("Erro: Não foi possível abrir o arquivo %s\n", filename);
        return NULL;
    }

    // Descobre o tamanho do arquivo
    fseek(file, 0, SEEK_END);
    long length = ftell(file);
    fseek(file, 0, SEEK_SET);

    // Aloca memória para o conteúdo + o caractere nulo '\0'
    char *buffer = (char*)malloc(length + 1);
    if (buffer == NULL) {
        printf("Erro de alocação de memória.\n");
        fclose(file);
        return NULL;
    }

    // Lê o conteúdo do arquivo para o buffer
    size_t read_bytes = fread(buffer, 1, length, file);
    buffer[read_bytes] = '\0'; // Garante o término da string

    fclose(file);
    return buffer;
}

