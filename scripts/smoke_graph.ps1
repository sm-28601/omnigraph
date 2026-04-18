$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($env:NEO4J_USER)) {
  $neo4jUser = "neo4j"
} else {
  $neo4jUser = $env:NEO4J_USER
}

if ([string]::IsNullOrWhiteSpace($env:NEO4J_PASSWORD)) {
  $neo4jPassword = "omnigraph123"
} else {
  $neo4jPassword = $env:NEO4J_PASSWORD
}

Write-Host "Running graph sanity checks..."

$entityCount = docker exec omnigraph-neo4j cypher-shell -u $neo4jUser -p $neo4jPassword "MATCH (e:BusinessEntity) RETURN count(e) AS c;" --format plain
if ($LASTEXITCODE -ne 0) {
  throw "Failed to query entity count from Neo4j."
}

$sourceRecordCount = docker exec omnigraph-neo4j cypher-shell -u $neo4jUser -p $neo4jPassword "MATCH (s:SourceRecord) RETURN count(s) AS c;" --format plain
if ($LASTEXITCODE -ne 0) {
  throw "Failed to query source-record count from Neo4j."
}

$resolutionEdges = docker exec omnigraph-neo4j cypher-shell -u $neo4jUser -p $neo4jPassword "MATCH ()-[r:RESOLVES_TO]->() RETURN count(r) AS c;" --format plain
if ($LASTEXITCODE -ne 0) {
  throw "Failed to query RESOLVES_TO edge count from Neo4j."
}

Write-Host "Entity query result:"
Write-Host $entityCount
Write-Host "SourceRecord query result:"
Write-Host $sourceRecordCount
Write-Host "RESOLVES_TO edge query result:"
Write-Host $resolutionEdges
Write-Host "Graph sanity checks completed."
