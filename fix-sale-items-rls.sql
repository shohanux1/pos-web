-- Fix RLS policies for sale_items table to allow deletion

-- First, check existing policies
-- SELECT * FROM pg_policies WHERE tablename = 'sale_items';

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view sale items for their sales" ON sale_items;
DROP POLICY IF EXISTS "Users can create sale items for their sales" ON sale_items;
DROP POLICY IF EXISTS "Users can update sale items for their sales" ON sale_items;
DROP POLICY IF EXISTS "Users can delete sale items for their sales" ON sale_items;

-- Create comprehensive RLS policies for sale_items

-- Policy for SELECT (viewing)
CREATE POLICY "Users can view sale items for their sales" ON sale_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sales 
      WHERE sales.id = sale_items.sale_id 
      AND sales.user_id = auth.uid()
    )
  );

-- Policy for INSERT (creating)
CREATE POLICY "Users can create sale items for their sales" ON sale_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales 
      WHERE sales.id = sale_items.sale_id 
      AND sales.user_id = auth.uid()
    )
  );

-- Policy for UPDATE (editing)
CREATE POLICY "Users can update sale items for their sales" ON sale_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM sales 
      WHERE sales.id = sale_items.sale_id 
      AND sales.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales 
      WHERE sales.id = sale_items.sale_id 
      AND sales.user_id = auth.uid()
    )
  );

-- Policy for DELETE (removing) - THIS IS THE IMPORTANT ONE
CREATE POLICY "Users can delete sale items for their sales" ON sale_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM sales 
      WHERE sales.id = sale_items.sale_id 
      AND sales.user_id = auth.uid()
    )
  );

-- Verify RLS is enabled
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

-- Test query to verify policies are in place
-- SELECT * FROM pg_policies WHERE tablename = 'sale_items';

-- Alternative: If you want to allow service role to bypass RLS
-- (useful for admin operations)
-- CREATE POLICY "Service role bypass" ON sale_items
--   USING (auth.jwt() ->> 'role' = 'service_role');