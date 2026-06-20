$ErrorActionPreference = "Stop"

Write-Host "Starting 'container' environment setup for EzFile..."

$NodeVersion = "v20.14.0"
$NodeDir = ".\.node"
$NodeZip = "node-$NodeVersion-win-x64.zip"
$NodeUrl = "https://nodejs.org/dist/$NodeVersion/$NodeZip"

# 1. Provide an isolated Node environment if needed
if (-not (Test-Path "$NodeDir\node.exe")) {
    Write-Host "Downloading portable Node.js $NodeVersion..."
    Invoke-WebRequest -Uri $NodeUrl -OutFile $NodeZip
    Write-Host "Extracting Node.js..."
    Expand-Archive -Path $NodeZip -DestinationPath . -Force
    Rename-Item -Path "node-$NodeVersion-win-x64" -NewName ".node"
    Remove-Item $NodeZip
}

# 2. Add portable Node to PATH
Write-Host "Adding isolated Node.js to PATH..."
$env:PATH = "$pwd\.node;" + $env:PATH

Write-Host "Node version: $(node -v)"
Write-Host "NPM version: $(npm.cmd -v)"

# 3. Install dependencies
Write-Host "Installing dependencies..."
npm.cmd install

# 4. Initialize Database
Write-Host "Initializing database..."
npx.cmd prisma generate
npx.cmd prisma db push

# 5. Set Environment Variables
Write-Host "Setting environment variables..."
$env:BASE_PATH = "$pwd\storage"
$env:DOMAIN = "localhost:3000"

if (-not (Test-Path "$env:BASE_PATH")) {
    New-Item -ItemType Directory -Path "$env:BASE_PATH" | Out-Null
}

# 6. Build application
Write-Host "Building Next.js application..."
npm.cmd run build

# 7. Start Background Worker
Write-Host "Starting background worker process..."
Start-Process -NoNewWindow -FilePath "npm.cmd" -ArgumentList "run worker" -RedirectStandardOutput "worker.log" -RedirectStandardError "worker-error.log"

# 8. Start Application
Write-Host "Starting Next.js application on port 3000..."
npm.cmd run start
