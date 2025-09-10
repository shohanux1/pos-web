import { useState, useEffect } from 'react'
import { Database } from '@/lib/database.types'
import { useSupabase } from '@/lib/auth/client'

type Product = Database['public']['Tables']['products']['Row'] & {
  categories?: Database['public']['Tables']['categories']['Row'] | null
}

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Database['public']['Tables']['categories']['Row'][]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = useSupabase()

  // Fetch all products with categories
  const fetchProducts = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          categories:category_id (*)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      setProducts(data || [])
    } catch (err) {
      console.error('Error fetching products:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch products')
    } finally {
      setLoading(false)
    }
  }

  // Fetch all categories
  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name')

      if (error) throw error

      setCategories(data || [])
    } catch (err) {
      console.error('Error fetching categories:', err)
    }
  }

  // Update product stock after sale
  const updateProductStock = async (productId: string, quantity: number) => {
    try {
      // First get current stock
      const { data: product, error: fetchError } = await supabase
        .from('products')
        .select('stock_quantity')
        .eq('id', productId)
        .single()

      if (fetchError) throw fetchError

      const newStock = product.stock_quantity - quantity

      // Update stock
      const { error: updateError } = await supabase
        .from('products')
        .update({ 
          stock_quantity: newStock,
          updated_at: new Date().toISOString()
        })
        .eq('id', productId)

      if (updateError) throw updateError

      // Update local state
      setProducts(prev => 
        prev.map(p => 
          p.id === productId 
            ? { ...p, stock_quantity: newStock }
            : p
        )
      )

      return true
    } catch (err) {
      console.error('Error updating product stock:', err)
      return false
    }
  }

  // Search products by name or SKU
  const searchProducts = async (query: string) => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          categories:category_id (*)
        `)
        .or(`name.ilike.%${query}%,sku.ilike.%${query}%,barcode.eq.${query}`)
        .order('name')

      if (error) throw error

      return data || []
    } catch (err) {
      console.error('Error searching products:', err)
      return []
    }
  }

  // Get product by barcode
  const getProductByBarcode = async (barcode: string) => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          categories:category_id (*)
        `)
        .eq('barcode', barcode)
        .single()

      if (error) throw error

      return data
    } catch (err) {
      console.error('Error fetching product by barcode:', err)
      return null
    }
  }

  // Get products by category
  const getProductsByCategory = async (categoryId: string) => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          categories:category_id (*)
        `)
        .eq('category_id', categoryId)
        .order('name')

      if (error) throw error

      return data || []
    } catch (err) {
      console.error('Error fetching products by category:', err)
      return []
    }
  }

  useEffect(() => {
    fetchProducts()
    fetchCategories()
  }, [])

  return {
    products,
    categories,
    loading,
    error,
    fetchProducts,
    updateProductStock,
    searchProducts,
    getProductByBarcode,
    getProductsByCategory
  }
}