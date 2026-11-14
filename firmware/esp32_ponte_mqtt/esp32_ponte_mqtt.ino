// Illuminat Horizontes - ponte ESP32 -> Wi-Fi/MQTT
// Recebe as linhas JSON do Arduino pela Serial2 e publica cada uma no broker MQTT.
// O site assina o mesmo tópico pelo WebSocket (botão "Wi-Fi").
// Também dá para ligar sensores direto no ESP32 e montar a linha aqui (ex.: BME280, PMS5003).
//
// Ligações:
//   Arduino TX (5 V) -> divisor 1k/2k -> ESP32 RX2 (GPIO16)   (o ESP32 é 3,3 V!)
//   GND do Arduino   -> GND do ESP32
// Biblioteca: PubSubClient (Nick O'Leary), pelo Gerenciador de Bibliotecas.

#include <WiFi.h>
#include <PubSubClient.h>

const char *WIFI_SSID  = "SUA_REDE";
const char *WIFI_SENHA = "SUA_SENHA";
const char *BROKER     = "broker.hivemq.com";   // o site usa wss://broker.hivemq.com:8884/mqtt
const int   PORTA      = 1883;
const char *TOPICO     = "illuminat-horizontes/carrinho";   // igual ao do site

WiFiClient rede;
PubSubClient mqtt(rede);
String linha;

void conectar() {
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.begin(WIFI_SSID, WIFI_SENHA);
    Serial.print("Wi-Fi");
    while (WiFi.status() != WL_CONNECTED) { delay(400); Serial.print('.'); }
    Serial.println(" ok");
  }
  while (!mqtt.connected()) {
    String id = "ih-esp32-" + String((uint32_t)ESP.getEfuseMac(), HEX);
    if (mqtt.connect(id.c_str())) Serial.println("MQTT ok");
    else { Serial.println("MQTT falhou, tentando de novo"); delay(2000); }
  }
}

void setup() {
  Serial.begin(115200);                       // depuração (USB)
  Serial2.begin(115200, SERIAL_8N1, 16, 17);  // RX2 = 16, TX2 = 17
  mqtt.setServer(BROKER, PORTA);
  mqtt.setBufferSize(512);
  conectar();
}

void loop() {
  conectar();
  mqtt.loop();
  while (Serial2.available()) {
    char c = Serial2.read();
    if (c == '\n') {
      linha.trim();
      if (linha.startsWith("{")) {
        mqtt.publish(TOPICO, linha.c_str());
        Serial.println(linha);
      }
      linha = "";
    } else if (linha.length() < 400) {
      linha += c;
    }
  }
}
