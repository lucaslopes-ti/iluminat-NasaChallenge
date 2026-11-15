"""Ponte do carrinho: lê as leituras do Arduino (USB ou Bluetooth) e publica cada uma no MQTT.

Aceita dois formatos de linha:
  - JSON do arduino_carrinho.ino: {"temp":24.1,"uv":6.2,...}
  - texto do sketch de teste da equipe (9600 baud):
        Umidade: 52.30%  |  Temperatura: 28.40°C
        Distancia: 23 cm
        Luminosidade (LDR): 548
    que vira {"umid":52.3,"temp":28.4,"dist":23,"luz":548}, uma mensagem por ciclo.

Instalar uma vez:
    pip install pyserial paho-mqtt

Usar (na raiz do repositório, com o Arduino ligado na USB):
    python3 firmware/ponte_serial_mqtt.py                         # acha a porta sozinho
    python3 firmware/ponte_serial_mqtt.py --porta COM4            # Windows
    python3 firmware/ponte_serial_mqtt.py --porta /dev/cu.usbmodem1101   # Mac
    python3 firmware/ponte_serial_mqtt.py --local lencois         # também publica, retido, o perfil do local análogo
    python3 firmware/ponte_serial_mqtt.py --porta /dev/cu.usbserial-21130 --baud 9600   # sketch de texto

Publica em illuminat-horizontes/carrinho (igual ao site e ao esp32_ponte_mqtt).
Com --local, publica dados/essenciais/mqtt/locais/<id>.json retido em illuminat-horizontes/local.
Feche o Monitor Serial da IDE do Arduino antes: só um programa pode abrir a porta.
"""
import argparse
import json
import os
import re
import sys
import time

import paho.mqtt.client as mqtt
import serial
from serial.tools import list_ports

AQUI = os.path.dirname(os.path.abspath(__file__))
PASTA_LOCAIS = os.path.join(AQUI, "..", "dados", "essenciais", "mqtt", "locais")
CHAVES = {"temp", "uv", "pm25", "solar", "soil", "tilt", "vib", "slip", "umid", "dist", "luz"}

# Texto do sketch de teste -> chave do carrinho. A linha do LDR sai sem quebra de linha e gruda
# na seguinte, entao os pares "Nome: numero" sao procurados em qualquer ponto da linha.
TEXTO = re.compile(r"(Umidade|Temperatura|Dist[aâ]ncia|Luminosidade(?:\s*\(LDR\))?)\s*:\s*(-?\d+(?:[.,]\d+)?)",
                   re.IGNORECASE)
NOME_TEXTO = {"umidade": "umid", "temperatura": "temp", "distancia": "dist", "distância": "dist", "luminosidade": "luz"}


class LeitorTexto:
    """Junta os pares de um ciclo (umidade, temperatura, distancia, luz) numa mensagem so."""

    def __init__(self):
        self.atual = {}

    def pares(self, texto):
        """Devolve as mensagens completas que esta linha fechou (normalmente 0 ou 1)."""
        prontas = []
        for nome, valor in TEXTO.findall(texto):
            chave = NOME_TEXTO[nome.split("(")[0].strip().lower()]
            if chave in self.atual:          # a mesma chave de novo: o ciclo anterior acabou
                prontas.append(self.atual)
                self.atual = {}
            v = float(valor.replace(",", "."))
            self.atual[chave] = int(v) if v.is_integer() and chave in ("dist", "luz") else v
        return prontas


def achar_porta():
    portas = list(list_ports.comports())
    for p in portas:  # Arduino original, CH340, FTDI, CP210x
        texto = f"{p.description} {p.manufacturer} {p.hwid}".lower()
        if any(s in texto for s in ("arduino", "ch340", "ch341", "ftdi", "cp210", "usbmodem", "usbserial", "wch")):
            return p.device
    if len(portas) == 1:
        return portas[0].device
    nomes = ", ".join(p.device for p in portas) or "nenhuma"
    sys.exit(f"Não achei o Arduino. Portas encontradas: {nomes}. Use --porta.")


def conectar_mqtt(a):
    try:
        cliente = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=f"ih-ponte-{os.getpid()}")
    except AttributeError:  # paho-mqtt 1.x
        cliente = mqtt.Client(client_id=f"ih-ponte-{os.getpid()}")
    if a.usuario:
        cliente.username_pw_set(a.usuario, os.environ.get("MQTT_SENHA", ""))
    if a.tls:
        cliente.tls_set()
    cliente.reconnect_delay_set(1, 30)
    cliente.connect(a.broker, a.porta_mqtt, keepalive=30)
    cliente.loop_start()  # reconecta sozinho se a rede cair
    return cliente


def linha_valida(texto):
    """Devolve o JSON da linha se for uma leitura do carrinho; senão None (mensagens de depuração etc.)."""
    if not texto.startswith("{"):
        return None
    try:
        d = json.loads(texto)
    except ValueError:
        return None
    if not isinstance(d, dict) or not CHAVES.intersection(d):
        return None
    return {k: v for k, v in d.items() if k in CHAVES and isinstance(v, (int, float))}


def main():
    ap = argparse.ArgumentParser(description="Arduino (USB) -> MQTT")
    ap.add_argument("--porta", help="porta serial (COM4, /dev/ttyACM0, /dev/cu.usbmodem...)")
    ap.add_argument("--baud", type=int, default=115200)
    ap.add_argument("--broker", default="broker.hivemq.com")
    ap.add_argument("--porta-mqtt", type=int, default=1883)
    ap.add_argument("--tls", action="store_true", help="usar TLS (ex.: HiveMQ Cloud na porta 8883)")
    ap.add_argument("--usuario", help="usuário do broker; a senha vem da variável MQTT_SENHA")
    ap.add_argument("--topico", default="illuminat-horizontes/carrinho")
    ap.add_argument("--local", help="id do local análogo (ex.: lencois) para publicar o perfil retido")
    ap.add_argument("--topico-local", default="illuminat-horizontes/local")
    a = ap.parse_args()

    porta = a.porta or achar_porta()
    cliente = conectar_mqtt(a)
    print(f"MQTT {a.broker}:{a.porta_mqtt} -> {a.topico}")

    if a.local:
        caminho = os.path.join(PASTA_LOCAIS, f"{a.local}.json")
        if not os.path.exists(caminho):
            sys.exit(f"Perfil não encontrado: {caminho}")
        with open(caminho, encoding="utf-8") as f:
            cliente.publish(a.topico_local, f.read(), qos=1, retain=True)
        print(f"Perfil {a.local} publicado (retido) em {a.topico_local}")

    while True:
        try:
            with serial.Serial(porta, a.baud, timeout=2) as s:
                print(f"Lendo {porta} a {a.baud} baud (Ctrl+C para sair)")
                time.sleep(2)               # o Arduino reinicia ao abrir a porta
                s.reset_input_buffer()
                leitor = LeitorTexto()
                while True:
                    texto = s.readline().decode("utf-8", errors="ignore").strip()
                    if not texto:
                        continue
                    d = linha_valida(texto)
                    lista = [d] if d is not None else leitor.pares(texto)
                    if not lista and not TEXTO.search(texto):
                        print("  (ignorada)", texto[:80])
                    for d in lista:
                        msg = json.dumps(d, separators=(",", ":"))
                        cliente.publish(a.topico, msg, qos=0)
                        print(time.strftime("%H:%M:%S"), msg)
        except serial.SerialException as e:
            print(f"Porta {porta} indisponível ({e}); tentando de novo em 3 s")
            time.sleep(3)
            if not a.porta:
                try:
                    porta = achar_porta()
                except SystemExit:
                    pass


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nfim")
