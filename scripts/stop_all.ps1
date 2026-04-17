Write-Host "Stopping OmniGraph core services (PostgreSQL + Neo4j)..."
docker compose stop postgres neo4j

Write-Host "Stopping OmniGraph optional services (Kafka + Zookeeper + Airflow if running)..."
docker compose -f "infra/optional/docker-compose.optional.yml" --profile optional stop kafka zookeeper airflow

Write-Host "All requested services have been stopped."
Write-Host "Use scripts/run_all.ps1 to start core stack again."
