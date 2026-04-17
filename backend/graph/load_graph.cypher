// Load resolved entity nodes
LOAD CSV WITH HEADERS FROM 'file:///resolved_entities.csv' AS row
MERGE (b:BusinessEntity {entity_id: row.entity_id})
SET b.name = row.canonical_name,
    b.pan = row.pan,
    b.city = row.city,
    b.state = row.state,
    b.pincode = row.pincode,
    b.resolution_quality = toFloat(row.resolution_quality);

// Load source records and relationships
LOAD CSV WITH HEADERS FROM 'file:///source_to_entity_mapping.csv' AS row
MERGE (s:SourceRecord {source_record_id: row.source_record_id, source: row.source})
SET s.tier = row.tier,
    s.confidence = toFloat(row.confidence),
    s.pan = row.pan,
    s.name = row.name,
    s.address = row.address,
    s.city = row.city,
    s.state = row.state,
    s.pincode = row.pincode
WITH s, row
MATCH (b:BusinessEntity {entity_id: row.entity_id})
MERGE (s)-[:RESOLVES_TO]->(b);

// Optional address aggregation nodes
MATCH (s:SourceRecord)
WITH s, toLower(trim(s.address)) AS addr
MERGE (a:Address {normalized: addr})
MERGE (s)-[:LOCATED_AT]->(a);
