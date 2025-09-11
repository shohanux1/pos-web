-- Allow negative stock values in products table
-- This enables selling items that are physically available but not yet in the system

-- First, check if there's a constraint preventing negative stock
-- and remove it if it exists
ALTER TABLE products 
DROP CONSTRAINT IF EXISTS products_stock_quantity_check;

-- Optional: Add a new constraint that allows negative but sets a reasonable limit
-- This prevents data entry errors (like -999999)
ALTER TABLE products 
ADD CONSTRAINT products_stock_quantity_check 
CHECK (stock_quantity >= -10000);

-- Add a comment to document this decision
COMMENT ON COLUMN products.stock_quantity IS 
'Stock quantity can be negative to allow selling items not yet in system. Negative values indicate items sold but not yet received in inventory.';

-- Create an index for finding products with negative stock (for reports)
CREATE INDEX IF NOT EXISTS idx_products_negative_stock 
ON products(stock_quantity) 
WHERE stock_quantity < 0;

-- Optional: Create a view for products with stock issues
CREATE OR REPLACE VIEW products_stock_issues AS
SELECT 
  id,
  name,
  sku,
  barcode,
  stock_quantity,
  CASE 
    WHEN stock_quantity < 0 THEN 'Negative Stock'
    WHEN stock_quantity = 0 THEN 'Out of Stock'
    WHEN stock_quantity < min_stock_level THEN 'Low Stock'
    ELSE 'OK'
  END as stock_status,
  min_stock_level
FROM products
WHERE stock_quantity <= 0 OR stock_quantity < min_stock_level
ORDER BY stock_quantity ASC;