"""Altitude (m) de um ponto a partir dos blocos SRTMGL30 desta pasta.

Uso: python3 altitude.py LAT LON
"""
import math
import os
import struct
import sys
import zipfile

PASTA = os.path.dirname(os.path.abspath(__file__))
COLS, LINHAS, PASSO = 4800, 6000, 1 / 120  # 30 segundos de arco


def _bloco(lat, lon):
    if not (-60 <= lat <= 90 and -180 <= lon < 180):
        return None
    # cantos superiores esquerdos: lon -180, -140, ..., 140; lat 90, 40, -10
    lon0 = -180 + 40 * math.floor((lon + 180) / 40)
    lat0 = 90 if lat > 40 else (40 if lat > -10 else -10)
    nome = ('w' if lon0 < 0 else 'e') + f'{abs(lon0):03d}' + ('n' if lat0 > 0 else 's') + f'{abs(lat0):02d}'
    return nome, lat0, lon0


def altitude(lat, lon):
    """Metros acima do nível do mar, ou None (oceano -9999 ou fora da cobertura; oceano também pode vir como 0)."""
    b = _bloco(lat, lon)
    if b is None:
        return None
    nome, lat0, lon0 = b
    linha = min(LINHAS - 1, int((lat0 - lat) / PASSO))
    col = min(COLS - 1, int((lon - lon0) / PASSO))
    with zipfile.ZipFile(os.path.join(PASTA, f'{nome}.SRTMGL30.dem.zip')) as z:
        with z.open(f'{nome.upper()}.DEM') as f:
            f.seek(2 * (linha * COLS + col))
            (v,) = struct.unpack('>h', f.read(2))
    return None if v == -9999 else v


if __name__ == '__main__':
    lat, lon = float(sys.argv[1]), float(sys.argv[2])
    print(altitude(lat, lon))
