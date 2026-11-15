// Illuminat Horizontes - carrinho (Arduino Uno/Nano)
// Lê os sensores do carrinho e envia UMA linha JSON por segundo pela Serial USB (115200).
// A mesma linha serve para:
//   - a ponte no computador (firmware/ponte_serial_mqtt.py), que publica no MQTT;
//   - o site direto pelo USB (botão "USB", Chrome/Edge no computador);
//   - um ESP32 só como ponte Wi-Fi (firmware esp32_ponte_mqtt), sem computador.
// Exemplo de linha: {"temp":24.1,"uv":6.2,"pm25":14,"solar":410,"soil":22,"tilt":3.4,"vib":0.08,"slip":5}
// Chaves: temp, uv, pm25, solar, soil, tilt, vib, slip. Sensor ausente = chave fora da linha (o site mostra "–").
//
// Ligações (ajuste para o seu carrinho):
//   MPU6050 (inclinação, vibração)  -> SDA A4, SCL A5, VCC 5V, GND   (sem biblioteca)
//   Umidade do solo (capacitivo)    -> A0
//   UV GUVA-S12SD                   -> A1
//   Painel solar sobre R_CARGA      -> A2 (use divisor se o painel passar de 5 V)
//   Temperatura LM35                -> A3            (TEMP_SENSOR 1)
//   Temperatura DHT22               -> D4            (TEMP_SENSOR 2, biblioteca "DHT sensor library" da Adafruit)
//   Temperatura DS18B20             -> D4 + 4k7 p/ 5V (TEMP_SENSOR 3, bibliotecas OneWire e DallasTemperature)
//   Poeira PMS5003 (TX do sensor)   -> D8            (USAR_PMS5003 1; VCC 5V, sem biblioteca)
//   Encoder da roda com motor       -> D2            (USAR_PATINAGEM 1)
//   Encoder de uma roda livre       -> D3            (USAR_PATINAGEM 1)
//   Bluetooth HC-05/HC-06           -> TXD do módulo em D0 (RX), RXD do módulo em D1 (TX) com
//                                      divisor 1k/2k (o RX do módulo é 3,3 V), VCC 5V, GND.
//                                      Na Serial de hardware, cada linha sai pelo USB e pelo
//                                      Bluetooth ao mesmo tempo. O módulo vem em 9600: mude para
//                                      115200 com AT+UART=115200,0,0. Desligue o fio do D0 para gravar.
//
// Ligue só o que tiver: os sensores desligados abaixo não entram na linha.

// ------------------------------------------------------------------ escolha dos sensores
#define TEMP_SENSOR     1   // 0 = nenhum, 1 = LM35, 2 = DHT22, 3 = DS18B20
#define USAR_PMS5003    1   // 0 ou 1
#define USAR_PATINAGEM  0   // 0 ou 1 (precisa de dois encoders)
#define USAR_MPU6050    1
#define USAR_SOLO       1
#define USAR_UV         1
#define USAR_SOLAR      1

const unsigned long PERIODO_MS = 1000;
const float R_CARGA = 100.0;                     // ohms do resistor de carga do painel
const int SOLO_SECO = 600, SOLO_MOLHADO = 280;   // calibre com o seu sensor

#include <Wire.h>

#if TEMP_SENSOR == 2
  #include <DHT.h>
  DHT dht(4, DHT22);
#elif TEMP_SENSOR == 3
  #include <OneWire.h>
  #include <DallasTemperature.h>
  OneWire umFio(4);
  DallasTemperature ds(&umFio);
#endif

#if USAR_PMS5003
  #include <SoftwareSerial.h>
  SoftwareSerial pms(8, 9);   // RX = D8 (TX do PMS5003), TX = D9 (não usado)
  int pm25 = -1;              // último valor válido (ug/m3); -1 = ainda sem leitura
  uint8_t quadro[32];
  uint8_t posQuadro = 0;

  void lerPms() {             // quadro de 32 bytes: 0x42 0x4D ... PM2.5 (atmosférico) nos bytes 12-13
    while (pms.available()) {
      uint8_t b = pms.read();
      if (posQuadro == 0 && b != 0x42) continue;
      if (posQuadro == 1 && b != 0x4D) { posQuadro = 0; continue; }
      quadro[posQuadro++] = b;
      if (posQuadro == 32) {
        posQuadro = 0;
        uint16_t soma = 0;
        for (uint8_t i = 0; i < 30; i++) soma += quadro[i];
        if (soma == ((uint16_t)quadro[30] << 8 | quadro[31])) pm25 = (int)((uint16_t)quadro[12] << 8 | quadro[13]);
      }
    }
  }
#endif

#if USAR_PATINAGEM
  volatile unsigned long pulsosMotor = 0, pulsosLivre = 0;
  void contaMotor() { pulsosMotor++; }
  void contaLivre() { pulsosLivre++; }
#endif

const uint8_t MPU = 0x68;
float vibFiltrada = 0;
bool primeiro = true;

void campo(const char *nome, float v, int casas) {
  if (!primeiro) Serial.print(',');
  primeiro = false;
  Serial.print('"'); Serial.print(nome); Serial.print("\":"); Serial.print(v, casas);
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

void setup() {
  Serial.begin(115200);
#if USAR_MPU6050
  Wire.begin();
  Wire.beginTransmission(MPU); Wire.write(0x6B); Wire.write(0); Wire.endTransmission(true); // acorda o MPU6050
#endif
#if TEMP_SENSOR == 2
  dht.begin();
#elif TEMP_SENSOR == 3
  ds.begin();
  ds.setWaitForConversion(false);
  ds.requestTemperatures();
#endif
#if USAR_PMS5003
  pms.begin(9600);
#endif
#if USAR_PATINAGEM
  pinMode(2, INPUT_PULLUP); pinMode(3, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(2), contaMotor, FALLING);
  attachInterrupt(digitalPinToInterrupt(3), contaLivre, FALLING);
#endif
}

void loop() {
#if USAR_PMS5003
  lerPms();                       // o PMS5003 manda um quadro por segundo; leia sempre
#endif
  static unsigned long ultimo = 0;
  if (millis() - ultimo < PERIODO_MS) return;
  ultimo = millis();

  primeiro = true;
  Serial.print('{');

#if TEMP_SENSOR == 1
  float t = 0;
  for (int i = 0; i < 8; i++) t += analogRead(A3);
  campo("temp", t / 8 * 500.0 / 1023.0, 1);          // LM35: 10 mV/°C
#elif TEMP_SENSOR == 2
  float t = dht.readTemperature();
  if (!isnan(t)) campo("temp", t, 1);
#elif TEMP_SENSOR == 3
  float t = ds.getTempCByIndex(0);
  if (t > -100) campo("temp", t, 1);                 // -127 = sensor desligado
  ds.requestTemperatures();                          // a próxima fica pronta em < 1 s
#endif

#if USAR_UV
  float vUv = analogRead(A1) * 5.0 / 1023.0;
  campo("uv", vUv / 0.1, 1);                         // GUVA-S12SD: índice UV ≈ Vout / 0,1 V
#endif

#if USAR_PMS5003
  if (pm25 >= 0) campo("pm25", pm25, 0);
#endif

#if USAR_SOLAR
  float vPainel = analogRead(A2) * 5.0 / 1023.0;
  campo("solar", vPainel * vPainel / R_CARGA * 1000.0, 0);   // mW
#endif

#if USAR_SOLO
  int solo = analogRead(A0);
  campo("soil", constrain(map(solo, SOLO_SECO, SOLO_MOLHADO, 0, 100), 0, 100), 0);
#endif

#if USAR_MPU6050
  float ax, ay, az;
  if (lerAcel(ax, ay, az)) {
    float modulo = sqrt(ax * ax + ay * ay + az * az);
    float tilt = degrees(acos(constrain(az / modulo, -1.0, 1.0)));
    vibFiltrada = 0.7 * vibFiltrada + 0.3 * fabs(modulo - 1.0);
    campo("tilt", tilt, 1);
    campo("vib", vibFiltrada, 2);
  }
#endif

#if USAR_PATINAGEM
  noInterrupts();
  unsigned long m = pulsosMotor, l = pulsosLivre;
  pulsosMotor = pulsosLivre = 0;
  interrupts();
  if (m > 0) campo("slip", constrain(100.0 * (1.0 - (float)l / m), 0, 100), 0);   // roda girou sem o carrinho andar
#endif

  Serial.println('}');
}
