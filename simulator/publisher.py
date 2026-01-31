# simulator/publisher.py
import os, sys, json, time, random, socket
import paho.mqtt.client as mqtt
from collections import deque

# --- MQTT config ---
BROKER = os.getenv("MQTT_BROKER", "localhost")
PORT = int(os.getenv("MQTT_PORT", "8883"))
KEEPALIVE = int(os.getenv("MQTT_KEEPALIVE", "60"))
TOPIC_TEMPLATE = os.getenv("MQTT_TOPIC_TEMPLATE", "sensors/telemetry/{device_id}")

# TLS (adjust/disable if you use WebSockets instead)
CA   = os.getenv("MQTT_CA",   "/certs/AmazonRootCA1.pem")
CERT = os.getenv("MQTT_CERT", "/certs/device.pem.crt")
KEY  = os.getenv("MQTT_KEY",  "/certs/private.key")

CLIENT_ID = os.getenv("CLIENT_ID", f"sim-{socket.gethostname()}-{random.randint(1000,9999)}")

# --- Simulation mode ---
MODE = os.getenv("MODE", "POOL").upper()          # "POOL" or "INFINITE"
DEVICE_PREFIX = os.getenv("DEVICE_PREFIX", "device")
SIM_INDEX = int(os.getenv("SIM_INDEX", "0"))      # shard marker for uniqueness across containers

print(f"[sim] HOSTNAME={socket.gethostname()} SIM_INDEX={SIM_INDEX} MODE={MODE}", flush=True)

# POOL mode
DEVICE_COUNT = int(os.getenv("DEVICE_COUNT", "500"))

# INFINITE mode knobs
# Probability that the next message uses a brand-new device id
P_NEW = float(os.getenv("NEW_DEVICE_PROB", "0.3"))
# Size of “active set” we randomly revisit to keep devices alive in the window
ACTIVE_SET_SIZE = int(os.getenv("ACTIVE_SET_SIZE", "500"))

# Message cadence
SLEEP_MIN = float(os.getenv("SLEEP_MIN", "0.05"))
SLEEP_MAX = float(os.getenv("SLEEP_MAX", "0.5"))

def mk_client():
    client = mqtt.Client(client_id=CLIENT_ID, clean_session=True)
    # comment these lines if you’re using MQTT over WebSockets instead of TLS/TCP
    if os.path.exists(CA) and os.path.exists(CERT) and os.path.exists(KEY):
        client.tls_set(ca_certs=CA, certfile=CERT, keyfile=KEY)
        client.tls_insecure_set(False)
    client.connect(BROKER, PORT, KEEPALIVE)
    client.loop_start()
    return client

def mk_payload(device_id: str):
    return {
        "device_id": device_id,
        "timestamp": int(time.time() * 1000),
        "temperature": round(random.uniform(18.0, 30.0), 2),
        "humidity": round(random.uniform(40.0, 70.0), 2),
    }

def run_pool(client: mqtt.Client):
    start = SIM_INDEX * DEVICE_COUNT
    ids = [f"{DEVICE_PREFIX}-{start + i}" for i in range(DEVICE_COUNT)]
    while True:
        did = random.choice(ids)
        topic = TOPIC_TEMPLATE.format(device_id=did)
        client.publish(topic, json.dumps(mk_payload(did)), qos=0)
        time.sleep(random.uniform(SLEEP_MIN, SLEEP_MAX))

def run_infinite(client: mqtt.Client):
    # continually mint new IDs, but keep a recent active set we revisit
    recent = deque(maxlen=ACTIVE_SET_SIZE)
    counter = 0
    while True:
        use_new = (len(recent) == 0) or (random.random() < P_NEW)
        if use_new:
            did = f"{DEVICE_PREFIX}-sim{SIM_INDEX}-{counter}"
            counter += 1
            recent.append(did)
        else:
            did = random.choice(list(recent))

        topic = TOPIC_TEMPLATE.format(device_id=did)
        client.publish(topic, json.dumps(mk_payload(did)), qos=0)
        time.sleep(random.uniform(SLEEP_MIN, SLEEP_MAX))

if __name__ == "__main__":
    client = mk_client()
    try:
        if MODE == "INFINITE":
            run_infinite(client)
        else:
            run_pool(client)   # default
    except Exception as e:
        print(f"simulator error: {e}", file=sys.stderr)
        raise
