from kafka import KafkaConsumer
import json

consumer = KafkaConsumer(
    "omnigraph-events",
    bootstrap_servers=["localhost:9092"],
    auto_offset_reset="earliest",
    value_deserializer=lambda v: json.loads(v.decode("utf-8")),
    consumer_timeout_ms=5000,
)

print("Listening for events on omnigraph-events...")
for msg in consumer:
    print(msg.value)
