#!/usr/bin/env python3
"""Controle dos motores do carrinho pelo cabo USB (sem MQTT, sem Bluetooth).

Le comandos da entrada padrao (um caractere por comando) e manda ao Arduino
com o sketch firmware/carrinho_motores:
    F = frente   T = tras   P = parar   0..9 = velocidade   ? = estado
Enquanto o carrinho anda (F ou T), repete o comando a cada 0,5 s: o sketch
para sozinho se ficar 1,5 s sem receber nada (se o cabo sair, ele para).

A tela em C (Projeto_C/NasaSpace) abre este programa e escreve as teclas nele.
Sozinho:
    python3 firmware/controle_carrinho.py                       # acha a porta USB
    python3 firmware/controle_carrinho.py --porta COM4          # Windows
    python3 firmware/controle_carrinho.py --porta /dev/cu.usbserial-21130

Precisa de: pip install pyserial  (Mac/Homebrew: python3 -m pip install --user --break-system-packages pyserial)
Feche o Monitor Serial da IDE antes: so um programa pode abrir a porta.
"""
import argparse
import queue
import sys
import threading
import time

import serial
from serial.tools import list_ports

REPETIR_S = 0.5
MOVIMENTO = {"F", "T", "L", "R"}
VALIDOS = "FTPLR0123456789?"


def achar_porta():
    portas = list(list_ports.comports())
    for p in portas:  # Arduino original, CH340, FTDI, CP210x
        texto = f"{p.description} {p.manufacturer} {p.hwid} {p.device}".lower()
        if any(s in texto for s in ("arduino", "ch340", "ch341", "ftdi", "cp210", "usbmodem", "usbserial", "wch")):
            return p.device
    nomes = ", ".join(p.device for p in portas) or "nenhuma"
    sys.exit(f"Nao achei o Arduino no cabo USB. Portas: {nomes}. Use --porta.")


def main():
    ap = argparse.ArgumentParser(description="Motores do carrinho pelo cabo USB")
    ap.add_argument("--porta", help="porta USB do Arduino (COM4, /dev/cu.usbserial-...)")
    ap.add_argument("--baud", type=int, default=9600)
    a = ap.parse_args()

    porta = a.porta or achar_porta()
    s = serial.Serial(porta, a.baud, timeout=0)
    time.sleep(2.5)                      # o Arduino reinicia ao abrir a porta
    sys.stderr.write(f"[cabo USB: {porta}, {a.baud} baud]\n")

    fila = queue.Queue()                 # teclado lido numa thread (igual no Windows e no Mac)

    def ler_entrada():
        while True:
            c = sys.stdin.buffer.read(1)
            fila.put(c)
            if not c:
                return
    threading.Thread(target=ler_entrada, daemon=True).start()

    atual, ultimo = "P", 0.0
    try:
        while True:
            fim = False
            while not fila.empty():
                c = fila.get()
                if not c:                # a tela fechou: para e sai
                    fim = True
                    break
                ch = c.decode("ascii", "ignore").upper()
                if ch and ch in VALIDOS:
                    s.write(ch.encode())
                    ultimo = time.time()
                    if ch in "FTPLR":
                        atual = ch
            if fim:
                break
            if atual in MOVIMENTO and time.time() - ultimo >= REPETIR_S:
                s.write(atual.encode())  # mantem o carrinho andando
                ultimo = time.time()
            resposta = s.read(512)       # o que o Arduino respondeu
            if resposta:
                sys.stderr.write(resposta.decode("utf-8", "replace"))
                sys.stderr.flush()
            time.sleep(0.03)
    except KeyboardInterrupt:
        pass
    finally:
        try:
            s.write(b"P")
            time.sleep(0.1)
        finally:
            s.close()


if __name__ == "__main__":
    main()
