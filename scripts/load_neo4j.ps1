Write-Host "Waiting for Neo4j to become ready..."
$maxAttempts = 24
$attempt = 0
$ready = $false
while ($attempt -lt $maxAttempts) {
  $attempt += 1
  docker exec omnigraph-neo4j cypher-shell -u neo4j -p omnigraph123 "RETURN 1;" *> $null
  if ($LASTEXITCODE -eq 0) {
    $ready = $true
    break
  }
  Start-Sleep -Seconds 5
}

if (-not $ready) {
  throw "Neo4j is not ready after waiting. Check container logs."
}

Write-Host "Loading graph data script..."
docker exec omnigraph-neo4j cypher-shell -u neo4j -p omnigraph123 -f /graph/load_graph.cypher
if ($LASTEXITCODE -ne 0) {
  throw "Graph load script failed."
}

Write-Host "Running risk query script..."
docker exec omnigraph-neo4j cypher-shell -u neo4j -p omnigraph123 -f /graph/risk_queries.cypher
if ($LASTEXITCODE -ne 0) {
  throw "Risk query script failed."
}

Write-Host "Neo4j load complete."
