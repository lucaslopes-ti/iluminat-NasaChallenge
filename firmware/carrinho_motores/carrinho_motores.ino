// Illuminat Horizontes - carrinho pelo cabo USB: motores + sensores
//
// Comandos (uma letra, vindos do computador pelo cabo):
//   F = frente   T (ou B) = tras   P = parar   0..9 = velocidade (0 parado, 9 = 100%)
//   ? = estado   L = teste so motor A   R = teste so motor B
// Os dois motores andam juntos, em par: OUT1 e OUT3 recebem o mesmo sinal.
// Seguranca: sem comando por TIMEOUT_MS, o carrinho para sozinho
// (o controle no computador repete o comando enquanto o carrinho anda).
//
// Sensores: a cada ENVIO_MS manda uma linha JSON, a mesma que a ponte MQTT e a tela em C leem:
//   {"temp":26.3,"umid":53.2,"dist":85,"luz":334}
//   temp/umid: DHT22 ou DHT11 (detecta sozinho)   dist: HC-SR04 em cm   luz: LDR 0..1023
//
// Ligacoes (Arduino Uno com shield):
//   Ponte H   IN1 -> D11 (PWM)  motor A, OUT1/OUT2
//             IN2 -> D10 (PWM)
//             IN3 -> D9  (PWM)  motor B, OUT3/OUT4
//             IN4 -> D8  (sem PWM: da a direcao)
//             jumpers ENA e ENB no lugar; GND da ponte no GND do Arduino;
//             pilha (7 V ou mais) no 12V/GND da ponte; 5V da ponte solto com o cabo USB
//   DHT       dados -> D6
//   HC-SR04   TRIG -> D4   ECHO -> D5
//   LDR       A0 (com resistor para o GND, divisor)
//   D0 e D1 livres (sao do cabo USB)
//
// Bibliotecas: "DHT sensor library" e "Adafruit Unified Sensor" (Adafruit).
// Se um motor girar ao contrario, troque INVERTE_A ou INVERTE_B.

#include <DHT.h>

#define IN1 11
#define IN2 10
#define IN3 9
#define IN4 8

#define PINO_DHT 6
#define TRIG     4
#define ECHO     5
#define PINO_LDR A0

#define INVERTE_A 0   // no "frente": OUT1 alto e OUT3 alto (par OUT1/OUT3)
#define INVERTE_B 0

#define BAUD        9600
#define TIMEOUT_MS  1500      // motores param sem comando por este tempo
#define ENVIO_MS    1000      // uma linha de sensores por segundo
#define DHT_MS      2000      // o DHT nao aguenta leituras mais rapidas

DHT dht22(PINO_DHT, DHT22);
DHT dht11(PINO_DHT, DHT11);
int tipoDht = 0;              // 0 = ainda nao sei, 22 ou 11

int  velocidade = 6;          // 0..9
char sentido = 'P';           // F, T ou P
int  quais = 3;               // 1 = so motor A, 2 = so motor B, 3 = os dois
unsigned long ultimoComando = 0, ultimoEnvio = 0, ultimoDht = 0;
float temp = NAN, umid = NAN;

// ---------------------------------------------------------------- motores
// Motor A (OUT1/OUT2): IN1 e IN2 tem PWM. Frente: PWM em IN1 -> OUT1 alto.
void motorA(int sinal, int pwm) {
  if (INVERTE_A) sinal = -sinal;
  if (sinal > 0)      { analogWrite(IN1, pwm); analogWrite(IN2, 0); }
  else if (sinal < 0) { analogWrite(IN1, 0);   analogWrite(IN2, pwm); }
  else                { analogWrite(IN1, 0);   analogWrite(IN2, 0); }
}

// Motor B (OUT3/OUT4): IN3 tem PWM, IN4 (D8) so liga/desliga. Frente: OUT3 alto.
void motorB(int sinal, int pwm) {
  if (INVERTE_B) sinal = -sinal;
  if (sinal > 0)      { digitalWrite(IN4, LOW);  analogWrite(IN3, pwm); }
  else if (sinal < 0) { digitalWrite(IN4, HIGH); analogWrite(IN3, 255 - pwm); }
  else                { digitalWrite(IN4, LOW);  analogWrite(IN3, 0); }
}

void aplicar() {
  int pwm = map(velocidade, 0, 9, 0, 255);
  int sinal = (sentido == 'F') ? 1 : (sentido == 'T') ? -1 : 0;
  if (pwm == 0) sinal = 0;
  motorA((quais & 1) ? sinal : 0, pwm);
  motorB((quais & 2) ? sinal : 0, pwm);
}

void estado(const char *motivo) {
  Serial.print("{\"cmd\":\"");
  Serial.print(motivo);
  Serial.print("\",\"sentido\":\"");
  Serial.print(sentido);
  Serial.print("\",\"vel\":");
  Serial.print(velocidade * 100 / 9);
  Serial.print(",\"motores\":\"");
  Serial.print(quais == 3 ? "A+B" : quais == 1 ? "A" : "B");
  Serial.println("\"}");
}

// ---------------------------------------------------------------- sensores
// Le o DHT; na primeira vez descobre se e DHT22 ou DHT11 pela leitura valida.
void lerDht() {
  float t, h;
  if (tipoDht != 11) {
    t = dht22.readTemperature(); h = dht22.readHumidity();
    if (!isnan(t) && !isnan(h) && h > 0 && h <= 100 && t > -40 && t < 80) { temp = t; umid = h; tipoDht = 22; return; }
  }
  if (tipoDht != 22) {
    t = dht11.readTemperature(); h = dht11.readHumidity();
    if (!isnan(t) && !isnan(h) && h > 0 && h <= 100 && t > -10 && t < 60) { temp = t; umid = h; tipoDht = 11; return; }
  }
  temp = NAN; umid = NAN;
}

// Distancia em cm pelo HC-SR04; -1 se nao houver eco (nada na frente ou fora do alcance).
long lerDistancia() {
  digitalWrite(TRIG, LOW);  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH); delayMicroseconds(10);
  digitalWrite(TRIG, LOW);
  unsigned long us = pulseIn(ECHO, HIGH, 25000UL);   // ate ~4 m; limita a espera
  if (us == 0) return -1;
  return (long)(us / 58UL);
}

void enviarSensores() {
  long dist = lerDistancia();
  int luz = analogRead(PINO_LDR);
  Serial.print("{");
  bool primeiro = true;
  if (!isnan(temp)) { Serial.print("\"temp\":"); Serial.print(temp, 1); primeiro = false; }
  if (!isnan(umid)) { if (!primeiro) Serial.print(','); Serial.print("\"umid\":"); Serial.print(umid, 1); primeiro = false; }
  if (dist >= 0 && dist <= 400) { if (!primeiro) Serial.print(','); Serial.print("\"dist\":"); Serial.print(dist); primeiro = false; }
  if (!primeiro) Serial.print(',');
  Serial.print("\"luz\":"); Serial.print(luz);
  Serial.println("}");
}

// ---------------------------------------------------------------- principal
void setup() {
  pinMode(IN1, OUTPUT); pinMode(IN2, OUTPUT);
  pinMode(IN3, OUTPUT); pinMode(IN4, OUTPUT);
  pinMode(TRIG, OUTPUT); pinMode(ECHO, INPUT);
  sentido = 'P';
  aplicar();
  Serial.begin(BAUD);
  dht22.begin();
  dht11.begin();
  Serial.println("{\"cmd\":\"pronto\",\"sentido\":\"P\",\"vel\":66}");
}

void loop() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c >= 'a' && c <= 'z') c -= 32;            // aceita minuscula
    ultimoComando = millis();
    if (c == 'F' || c == 'W')                    { if (sentido != 'F' || quais != 3) { sentido = 'F'; quais = 3; aplicar(); estado("F"); } }
    else if (c == 'T' || c == 'B' || c == 'S')   { if (sentido != 'T' || quais != 3) { sentido = 'T'; quais = 3; aplicar(); estado("T"); } }
    else if (c == 'L')                           { if (sentido != 'F' || quais != 1) { sentido = 'F'; quais = 1; aplicar(); estado("L"); } }
    else if (c == 'R')                           { if (sentido != 'F' || quais != 2) { sentido = 'F'; quais = 2; aplicar(); estado("R"); } }
    else if (c == 'P' || c == 'X' || c == ' ')   { sentido = 'P'; aplicar(); estado("P"); }
    else if (c >= '0' && c <= '9')               { velocidade = c - '0'; aplicar(); estado("vel"); }
    else if (c == '?')                           { estado("?"); }
    // outros caracteres (quebra de linha etc.) so renovam o tempo
  }

  unsigned long agora = millis();
  if (sentido != 'P' && agora - ultimoComando > TIMEOUT_MS) {
    sentido = 'P';
    aplicar();
    estado("parou: sem comando");
  }
  if (agora - ultimoDht >= DHT_MS) {
    ultimoDht = agora;
    lerDht();
  }
  if (agora - ultimoEnvio >= ENVIO_MS) {
    ultimoEnvio = agora;
    enviarSensores();
  }
}
