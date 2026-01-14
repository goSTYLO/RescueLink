@echo off
REM Database setup script for RescueLink Backend (Windows)

echo Setting up database...

REM Check if psql is available
where psql >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
  echo Error: PostgreSQL (psql) is not installed or not in PATH
  exit /b 1
)

REM Run the schema.sql file
REM You need to set DATABASE_URL in your environment or modify the connection string below
REM For example: postgresql://postgres:password@localhost:5432/rescuelink_db

REM Option 1: Using DATABASE_URL from environment (recommended)
if defined DATABASE_URL (
  psql %DATABASE_URL% -f schema.sql
  if %ERRORLEVEL% EQU 0 (
    echo Database setup completed successfully!
  ) else (
    echo Database setup failed!
    exit /b 1
  )
) else (
  echo Error: DATABASE_URL environment variable not set
  echo Please set DATABASE_URL in your .env file or system environment
  exit /b 1
)
