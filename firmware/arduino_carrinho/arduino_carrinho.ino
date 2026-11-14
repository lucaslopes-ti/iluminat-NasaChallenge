// Illuminat Horizontes - carrinho (Arduino Uno/Nano)
// Lê os sensores do carrinho e envia UMA linha JSON a cada 500 ms pela Serial (115200).
// A mesma linha serve para:
//   - o site direto pelo USB (botão "USB", Chrome/Edge no computador);
//   - o ESP32 (firmware esp32_ponte_mqtt), que repassa por Wi-Fi/MQTT.
// Exemplo de linha: {"uv":6.2,"solar":410,"soil":22,"tilt":3.4,"vib":0.08}
// Chaves aceitas pelo site: temp, uv, pm25, solar, soil, tilt, vib, slip (as que faltarem aparecem como "–").
//
// Ligações (ajuste para o seu carrinho):
//   MPU6050  -> SDA A4, SCL A5, VCC 5V, GND   (inclinação e vibração; sem biblioteca)
//   Umidade do solo (capacitivo) -> A0
//   UV GUVA-S12SD                -> A1
//   Painel solar sobre resistor de carga R_CARGA -> A2 (use divisor se o painel passar de 5 V)

#include <Wire.h>

const uint8_t MPU = 0x68;
const float R_CARGA = 100.0;          // ohms do resistor de carga do painel
const int SOLO_SECO = 600, SOLO_MOLHADO = 280;   // calibre com o seu sensor
const unsigned long PERIODO_MS = 500;

float vibFiltrada = 0;

void setup() {
  Serial.begin(115200);
  Wire.begin();
  Wire.beginTransmission(MPU); Wire.write(0x6B); Wire.write(0); Wire.endTransmission(true); // acorda o MPU6050
}

bool lerAcel(float &ax, float &ay, float &az) {
  Wire.beginTransmission(MPU); Wire.write(0x3B);
  if (Wire.endTransmission(false) != 0) return false;
  if (Wire.requestFrom(MPU, (uint8_t)6, (uint8_t)true) != 6) return false;
  int16_t x = Wire.read() << 8 | Wire.read();
  int16_t y = Wire.read() << 8 | Wire.read();
  int16_t z = Wire.read() << 8 | Wire.read();
  ax = x / 16384.0; ay = y / 16384.0; az = z / 16384.0;   // em g (escala ±2 g)
  return true;
}

void loop() {
  static unsigned long ultimo = 0;
  if (millis() - ultimo < PERIODO_MS) return;
  ultimo = millis();

  Serial.print('{');
  bool primeiro = true;
  auto campo = [&](const char *nome, float v, int casas) {
    if (!primeiro) Serial.print(',');
    primeiro = false;
    Serial.print('"'); Serial.print(nome); Serial.print("\":"); Serial.print(v, casas);
  };

  float ax, ay, az;
  if (lerAcel(ax, ay, az)) {
    float tilt = degrees(acos(constrain(az / sqrt(ax * ax + ay * ay + az * az), -1.0, 1.0)));
    float modulo = sqrt(ax * ax + ay * ay + az * az);
    vibFiltrada = 0.7 * vibFiltrada + 0.3 * fabs(modulo - 1.0);
    campo("tilt", tilt, 1);
    campo("vib", vibFiltrada, 2);
  }

  int solo = analogRead(A0);
  campo("soil", constrain(map(solo, SOLO_SECO, SOLO_MOLHADO, 0, 100), 0, 100), 0);

  float vUv = analogRead(A1) * 5.0 / 1023.0;
  campo("uv", vUv / 0.1, 1);                      // GUVA-S12SD: índice UV ≈ Vout / 0,1 V

  float vPainel = analogRead(A2) * 5.0 / 1023.0;
  campo("solar", vPainel * vPainel / R_CARGA * 1000.0, 0);   // mW

  Serial.println('}');
}
