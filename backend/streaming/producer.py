from kafka import KafkaProducer
import json

producer = KafkaProducer(
    bootstrap_servers=["localhost:9092"],
    value_serializer=lambda v: json.dumps(v).encode("utf-8"),
)

sample_event = {
    "event_type": "business_record_ingested",
    "source": "GST",
    "source_record_id": "GST-001",
    "entity_hint": "AAACA1234B",
}
producer.send("omnigraph-events", sample_event)
producer.flush()
print("Published sample event to omnigraph-events")
