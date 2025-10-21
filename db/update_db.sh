#!/usr/bin/env bash
set -e

DB_HOST=localhost
DB_NAME=mydb
DB_USER=postgres

echo "🚀 Running migration 1.1__users_add_password.sql..."
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f migrations/1.1__users_add_password.sql

echo "✅ Migration complete!"
