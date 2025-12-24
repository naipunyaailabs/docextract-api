#!/bin/sh
set -e

# Wait for MongoDB to be ready (optional, but good practice)
# You might want to use a tool like wait-for-it or wait-for-godot here if needed
# For now, we'll assume MongoDB is ready or handled by the app's retry logic

# Run the seeding script
echo "Running service seeding script..."
bun scripts/addDocumentServices.ts || echo "Seeding failed, but continuing..."

# Execute the main container command
exec "$@"
