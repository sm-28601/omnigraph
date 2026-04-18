$ErrorActionPreference = "Stop"

function Assert-LastExitCode {
	param(
		[string]$StepName
	)
	if ($LASTEXITCODE -ne 0) {
		throw "$StepName failed with exit code $LASTEXITCODE"
	}
}

Write-Host "Step 0/6: Ensuring synthetic multi-department dataset exists..."
if (-not (Test-Path "data/raw/40_departments")) {
	Write-Host "40_departments dataset missing. Generating now..."
	python "scripts/generate_40_departments.py"
	Assert-LastExitCode "Synthetic data generation"
}

Write-Host "Step 1/6: Installing Python dependencies..."
python -m pip install -r "backend/etl/requirements.txt"
Assert-LastExitCode "ETL dependency install"
python -m pip install -r "backend/resolution/requirements.txt"
Assert-LastExitCode "Resolution dependency install"

Write-Host "Step 2/6: Generating processed outputs..."
python "backend/etl/run_etl.py"
Assert-LastExitCode "ETL pipeline"
python "backend/resolution/entity_resolution.py"
Assert-LastExitCode "Entity resolution pipeline"

Write-Host "Step 3/6: Starting PostgreSQL and Neo4j containers..."
docker compose up -d postgres neo4j
Assert-LastExitCode "Container startup"

Write-Host "Step 4/6: Loading Neo4j graph scripts..."
powershell -ExecutionPolicy Bypass -File ".\scripts\load_neo4j.ps1"
Assert-LastExitCode "Neo4j graph load"

Write-Host "Step 5/6: Starting API and Frontend in background terminals..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'backend/api'; npm install; `$apiDataSource='csv'; if (Test-Path '.env') { `$line = Get-Content '.env' | Where-Object { `$_ -match '^API_DATA_SOURCE=' } | Select-Object -First 1; if (`$line) { `$apiDataSource = (`$line -split '=')[1].Trim().ToLower() } } elseif (Test-Path '../../.env') { `$line = Get-Content '../../.env' | Where-Object { `$_ -match '^API_DATA_SOURCE=' } | Select-Object -First 1; if (`$line) { `$apiDataSource = (`$line -split '=')[1].Trim().ToLower() } }; if (`$apiDataSource -eq 'postgres') { npm run load-postgres }; npm start"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'frontend'; npm install; npm run dev"

Write-Host "Step 6/6: Startup completed successfully."
Write-Host "API: http://localhost:8080/health"
Write-Host "Frontend: http://localhost:5173"
Write-Host "Neo4j Browser: http://localhost:7474"
