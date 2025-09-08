import paho.mqtt.client as mqtt
import json, time, os, random, threading, sys

BROKER     = os.getenv("MQTT_BROKER", "localhost")
DEVICE_ID   = os.getenv("DEVICE_ID",   f"device-{random.randint(1000, 9999)}")
TOPIC_TEMPLATE = os.getenv("MQTT_TOPIC_TEMPLATE", "sensors/telemetry/{device_id}")
TOPIC = TOPIC_TEMPLATE.format(device_id=DEVICE_ID)

client = mqtt.Client(client_id=DEVICE_ID, clean_session=True)

# --- TLS for AWS IoT ----------------------------------------------------------
client.tls_set(
    ca_certs="/certs/AmazonRootCA1.pem",
    certfile="/certs/device.pem.crt",
    keyfile="/certs/private.key"
)
client.tls_insecure_set(False)          # require a valid cert chain
# -----------------------------------------------------------------------------


def on_connect(_, __, ___, rc):
    msg = "connected" if rc == 0 else f"connect failed (rc={rc})"
    print(f"[{DEVICE_ID}] {msg}")


client.on_connect = on_connect


def connect_mqtt() -> None:
    """Blocking connect that restarts the network loop if it ever drops."""
    while True:
        try:
            client.connect(BROKER, port=8883, keepalive=60)
            client.loop_start()               # background thread
            return                            # exit once connected
        except Exception as exc:
            print(f"[{DEVICE_ID}] connect error → {exc}, retrying in 5 s", file=sys.stderr)
            time.sleep(5)


def publish() -> None:
    """Generate one payload every 0.5 – 2.0 s forever."""
    while True:
        try:
            payload = {
                "device_id":   DEVICE_ID,
                "timestamp":   time.time(),
                "temperature": round(random.uniform(18.0, 30.0), 2),
                "humidity":    round(random.uniform(40.0, 70.0), 2),
            }
            client.publish(TOPIC, json.dumps(payload), qos=0)
        except Exception as exc:
            print(f"[{DEVICE_ID}] publish error → {exc}", file=sys.stderr)
        time.sleep(random.uniform(0.5, 2.0))


if __name__ == "__main__":
    connect_mqtt()
    publish()          # runs forever
