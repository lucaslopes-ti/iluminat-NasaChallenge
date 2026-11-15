#include <stdio.h>
#include <stdlib.h>
#include "Bibliotecas/cJSON.h"
#include "Bibliotecas/funcoesJSON.h"
#include <locale.h>

char* ler_arquivo_para_string(const char *filename);

void UpdateCampos( float dados[],char nomes[][100]);


struct vetoresJson{
    char campo[45];
    int tamanho;
    char nomes[][100];

};

int main() {
    setlocale(LC_ALL, "");
    setlocale(LC_NUMERIC, "C");

    char nomes[][100] = {
    {"locais"},
    {"id"},
    {"posicao"},
    {"nome"},
    {"regiao"},
    {"pais"},
    {"papel"},
    {"lat"},
    {"lon"},
    {"feicao"},
    {"dados_completos"},
    {"alvo"},
    {"alvo_nome"},
    {"corpo"},
    {"nota_pct"},
    {
        "notas_perfil_pct"
    }

};
    float dados[100];
    UpdateCampos(dados,nomes);



    return 0;
}


void UpdateCampos( float dados[],char nomes[][100])
{

    const char *filename = "C:/Users/EUP9NL402.AzureAD/Documents/iluminat-NasaChallenge/Projeto_C/NasaSpace/bin/Debug/tela_carrinho.json";

    // 1. Lê o arquivo externo para a memória
    char *json_string = ler_arquivo_para_string(filename);
    if (json_string == NULL) {
        return;
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
        return;
    }


    cJSON *perfis = cJSON_GetObjectItemCaseSensitive(json_root, nomes[0]);

    if (cJSON_IsArray(perfis)) {
        cJSON *perfil = NULL;
        int j = 1;
        // 2. Percorre cada objeto dentro de "perfis"
        cJSON_ArrayForEach(perfil, perfis) {
            // 3. Extrai "id" e "rotulo" de dentro do objeto atual
            cJSON *valor = cJSON_GetObjectItemCaseSensitive(perfil, nomes[j]);

                if(valor->valuestring)
                {
                     printf("%s: %s\n", nomes[j], valor->valuestring);
                }
                if(valor->valuedouble)
                {
                     printf("%s: %f\n", nomes[j], valor->valuedouble);
                }

                j++;
            }
        }


    /*

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
    */

    // 4. Limpeza da árvore cJSON da memória para evitar vazamentos (Memory Leak)
    cJSON_Delete(json_root);

}

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

