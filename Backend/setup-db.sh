#!/bin/bash

# Database setup script for RescueLink Backend

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '#' | xargs)
else
  echo -e "${RED}Error: .env file not found${NC}"
  exit 1
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}Error: DATABASE_URL not set in .env file${NC}"
  exit 1
fi

echo "Setting up database..."
echo "Database URL: $DATABASE_URL"

# Run the schema.sql file
psql "$DATABASE_URL" -f schema.sql

if [ $? -eq 0 ]; then
  echo -e "${GREEN}Database setup completed successfully!${NC}"
else
  echo -e "${RED}Database setup failed!${NC}"
  exit 1
fi
