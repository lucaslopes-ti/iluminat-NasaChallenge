#!/usr/bin/env python3
"""Controle dos motores do carrinho pelo cabo USB (sem MQTT, sem Bluetooth).

Le comandos da entrada padrao (um caractere por comando) e manda ao Arduino
com o sketch firmware/carrinho_motores:
    F = frente   T = tras   P = parar   0..9 = velocidade   ? = estado
Enquanto o carrinho anda (F ou T), repete o comando a cada 0,5 s: o sketch
para sozinho se ficar 1,5 s sem receber nada (se o cabo sair, ele para).

As linhas de sensores do Arduino ({"temp":..,"umid":..,"dist":..,"luz":..}) tambem
vao para o MQTT (illuminat-horizontes/carrinho), as mesmas que a ponte publica:
assim o site (botao Wi-Fi -> Connect) mostra o que a tela em C mostra enquanto voce
dirige. Sem o paho-mqtt ou sem internet, o controle funciona do mesmo jeito.
Com --local <id>, publica tambem o perfil do local (retido), como a ponte.

A tela em C (Projeto_C/NasaSpace) abre este programa e escreve as teclas nele.
Sozinho:
    python3 firmware/controle_carrinho.py                       # acha a porta USB
    python3 firmware/controle_carrinho.py --porta COM4          # Windows
    python3 firmware/controle_carrinho.py --porta /dev/cu.usbserial-21130

Precisa de: pip install pyserial paho-mqtt  (Mac/Homebrew: python3 -m pip install --user --break-system-packages pyserial)
Feche o Monitor Serial da IDE antes: so um programa pode abrir a porta.
"""
import argparse
import json
import os
import queue
import sys
import threading
import time

import serial
from serial.tools import list_ports

REPETIR_S = 0.5
MOVIMENTO = {"F", "T", "L", "R"}
VALIDOS = "FTPLR0123456789?"
CHAVES = {"temp", "uv", "pm25", "solar", "soil", "tilt", "vib", "slip", "umid", "dist", "luz"}
PASTA_LOCAIS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "dados", "essenciais", "mqtt", "locais")


def conectar_mqtt(a):
    """Cliente MQTT em segundo plano, ou None (sem paho-mqtt, --sem-mqtt ou sem rede)."""
    if a.sem_mqtt:
        return None
    try:
        import paho.mqtt.client as mqtt
    except ImportError:
        sys.stderr.write("[sem paho-mqtt: o site nao recebe as leituras; pip install paho-mqtt]\n")
        return None
    try:
        try:
            c = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=f"ih-controle-{os.getpid()}")
        except AttributeError:  # paho-mqtt 1.x
            c = mqtt.Client(client_id=f"ih-controle-{os.getpid()}")
        if a.usuario:
            c.username_pw_set(a.usuario, os.environ.get("MQTT_SENHA", ""))
        if a.tls:
            c.tls_set()
        c.reconnect_delay_set(1, 30)
        c.connect_async(a.broker, a.porta_mqtt, keepalive=30)   # nao trava se a rede demorar
        c.loop_start()
    except Exception as e:  # noqa: BLE001 - o carrinho anda mesmo sem MQTT
        sys.stderr.write(f"[MQTT indisponivel ({e}); o site nao recebe as leituras]\n")
        return None
    if a.local:
        caminho = os.path.join(PASTA_LOCAIS, f"{a.local}.json")
        if os.path.exists(caminho):
            with open(caminho, encoding="utf-8") as f:
                c.publish(a.topico_local, f.read(), qos=1, retain=True)
    sys.stderr.write(f"[MQTT {a.broker} -> {a.topico}]\n")
    return c


def leitura_sensores(linha):
    """Devolve o JSON compacto da linha se for uma leitura de sensores; senao None."""
    linha = linha.strip()
    if not linha.startswith("{"):
        return None
    try:
        d = json.loads(linha)
    except ValueError:
        return None
    if not isinstance(d, dict):
        return None
    d = {k: v for k, v in d.items() if k in CHAVES and isinstance(v, (int, float)) and not isinstance(v, bool)}
    return json.dumps(d, separators=(",", ":")) if d else None


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
    ap.add_argument("--broker", default="broker.hivemq.com")
    ap.add_argument("--porta-mqtt", type=int, default=1883)
    ap.add_argument("--tls", action="store_true", help="usar TLS (ex.: HiveMQ Cloud na porta 8883)")
    ap.add_argument("--usuario", help="usuario do broker; a senha vem da variavel MQTT_SENHA")
    ap.add_argument("--topico", default="illuminat-horizontes/carrinho")
    ap.add_argument("--local", help="id do local analogo (ex.: lencois) para publicar o perfil retido")
    ap.add_argument("--topico-local", default="illuminat-horizontes/local")
    ap.add_argument("--sem-mqtt", action="store_true", help="nao publicar as leituras")
    a = ap.parse_args()

    porta = a.porta or achar_porta()
    s = serial.Serial(porta, a.baud, timeout=0)
    time.sleep(2.5)                      # o Arduino reinicia ao abrir a porta
    sys.stderr.write(f"[cabo USB: {porta}, {a.baud} baud]\n")

    cliente = conectar_mqtt(a)
    pedaco = ""                          # linha do Arduino ainda incompleta

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
                texto = resposta.decode("utf-8", "replace")
                sys.stderr.write(texto)
                sys.stderr.flush()
                if cliente is not None:
                    pedaco += texto
                    *linhas, pedaco = pedaco.split("\n")
                    if len(pedaco) > 2048:
                        pedaco = ""
                    for linha in linhas:
                        msg = leitura_sensores(linha)
                        if msg:
                            cliente.publish(a.topico, msg, qos=0)
            time.sleep(0.03)
    except KeyboardInterrupt:
        pass
    finally:
        try:
            s.write(b"P")
            time.sleep(0.1)
        finally:
            s.close()
            if cliente is not None:
                cliente.loop_stop()
                cliente.disconnect()


if __name__ == "__main__":
    main()
