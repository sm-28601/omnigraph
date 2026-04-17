// Businesses sharing same normalized address (possible shell entity clusters)
MATCH (s:SourceRecord)-[:LOCATED_AT]->(a:Address)
WITH a, collect(DISTINCT s) AS records
WHERE size(records) >= 3
RETURN a.normalized AS address, size(records) AS record_count
ORDER BY record_count DESC;

// Cross-source entities with low confidence records
MATCH (s:SourceRecord)-[:RESOLVES_TO]->(b:BusinessEntity)
WHERE s.confidence < 0.85
RETURN b.entity_id, b.name, collect(s.source_record_id) AS low_confidence_records
ORDER BY size(low_confidence_records) DESC;

// Community detection fallback (pure Cypher, no GDS dependency)
// Treat each shared address as a community and rank by number of linked businesses.
MATCH (b:BusinessEntity)<-[:RESOLVES_TO]-(:SourceRecord)-[:LOCATED_AT]->(a:Address)
WITH a.normalized AS address, collect(DISTINCT b.entity_id) AS entity_ids
WHERE size(entity_ids) >= 2
RETURN address AS community_key, size(entity_ids) AS businesses_in_community, entity_ids
ORDER BY businesses_in_community DESC;

// Optional (if GDS plugin is installed), run Louvain manually:
// CALL gds.graph.project('businessRiskGraph', 'BusinessEntity', {LINKED_TO: {orientation: 'UNDIRECTED'}})
// YIELD graphName, nodeCount, relationshipCount;
// CALL gds.louvain.stream('businessRiskGraph') YIELD nodeId, communityId RETURN nodeId, communityId;
