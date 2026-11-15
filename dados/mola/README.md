# MGS MOLA: altitude de Marte

`megt90n000cb.img` e `.lbl`: MGS MOLA MEGDR, 4 pixels por grau (~15 km), int16 big-endian, metros sobre o areoide, 720 linhas × 1440 colunas, de 90°N a 90°S e de 0° a 360°E. Baixado do PDS Geosciences Node (NASA): https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg004/

O `dados/essenciais/gerar_dados.py` usa a altitude de cada alvo de Marte para ajustar a pressão medida em Jezero (MEDA) pela escala de altura de 11,1 km.
