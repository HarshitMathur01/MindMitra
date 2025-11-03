#!/bin/bash

# Quick cleanup script - removes temporary files
echo "🗑️  Cleaning up temporary files..."

cd "$(dirname "$0")/chatbotAgent"

# Remove temporary Python files
rm -f apply_memory_update.py
rm -f update_memory_file.py  
rm -f tempCodeRunnerFile.py
rm -f test.py
rm -f test_api.py

# Remove Python cache
rm -rf __pycache__

echo "✅ Cleanup complete!"
echo ""
echo "Removed:"
echo "  - apply_memory_update.py"
echo "  - update_memory_file.py"
echo "  - tempCodeRunnerFile.py"
echo "  - test.py"
echo "  - test_api.py"
echo "  - __pycache__/"
echo ""
echo "Kept for reference:"
echo "  - memory_architecture_new.py (verify then delete)"
echo "  - memory_architecture_backup.py (safety backup)"
