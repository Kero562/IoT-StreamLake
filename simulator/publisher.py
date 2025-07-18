import paho.mqtt.client as mqtt
import json
import time
import os
import random

BROKER = os.getenv("MQTT_BROKER", "localhost") # Default to localhost if not set
TOPIC = os.getenv("MQTT_TOPIC", "iot/topic")
DEVICE_ID = os.getenv("DEVICE_ID", f"device-{random.randint(1000, 9999)}")

client = mqtt.Client()

def connect_mqtt():
    client.connect(BROKER)
    print(f"{DEVICE_ID} connected to broker at {BROKER}")

def publish():
    while True:
        payload = {
            "device_id": DEVICE_ID,
            "timestamp": time.time(),
            "temperature": round(random.uniform(18.0, 30.0), 2),
            "humidity": round(random.uniform(40.0, 70.0), 2)
        }
        client.publish(TOPIC, json.dumps(payload))
        time.sleep(random.uniform(0.5, 2))  # mimic real-world delay

if __name__ == "__main__":
    connect_mqtt()
    publish()
