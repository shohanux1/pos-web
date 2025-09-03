#!/bin/bash

# Supabase Type Generation Script
# Make sure to run: npx supabase login first

PROJECT_ID="vbrhxljqrfrrzsirwgfq"
OUTPUT_FILE="lib/database.types.ts"

echo "Generating TypeScript types for Supabase database..."

# Generate types
npx supabase gen types typescript --project-id $PROJECT_ID > $OUTPUT_FILE

if [ $? -eq 0 ]; then
    echo "✅ Types generated successfully at $OUTPUT_FILE"
    echo ""
    echo "To use the types in your code:"
    echo "import { Database } from '@/lib/database.types'"
    echo ""
    echo "Example usage:"
    echo "const { data } = await supabase"
    echo "  .from('stock_batches')"
    echo "  .select('*')"
    echo "  .returns<Database['public']['Tables']['stock_batches']['Row']>()"
else
    echo "❌ Failed to generate types. Please run: npx supabase login"
fi