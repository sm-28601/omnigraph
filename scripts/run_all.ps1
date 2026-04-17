Write-Host "Step 1/5: Installing Python dependencies..."
python -m pip install -r "backend/etl/requirements.txt"
python -m pip install -r "backend/resolution/requirements.txt"

Write-Host "Step 2/5: Generating processed outputs..."
python "backend/etl/run_etl.py"
python "backend/resolution/entity_resolution.py"

Write-Host "Step 3/5: Starting PostgreSQL and Neo4j containers..."
docker compose up -d postgres neo4j

Write-Host "Step 4/5: Loading Neo4j graph scripts..."
powershell -ExecutionPolicy Bypass -File ".\scripts\load_neo4j.ps1"

Write-Host "Step 5/5: Starting API and Frontend in background terminals..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'backend/api'; npm install; npm start"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'frontend'; npm install; npm run dev"

Write-Host "All startup commands launched."
Write-Host "API: http://localhost:8080/health"
Write-Host "Frontend: http://localhost:5173"
Write-Host "Neo4j Browser: http://localhost:7474 (neo4j / omnigraph123)"
