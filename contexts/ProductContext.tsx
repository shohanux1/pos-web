'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Database } from '@/lib/database.types'
import { useSupabase } from '@/lib/auth/client'

type Product = Database['public']['Tables']['products']['Row'] & {
  categories?: Database['public']['Tables']['categories']['Row'] | null
}

type Category = Database['public']['Tables']['categories']['Row']

interface CartItem extends Product {
  quantity: number
}

interface ProductContextType {
  // Products
  products: Product[]
  categories: Category[]
  loading: boolean
  error: string | null
  
  // Cart
  cart: CartItem[]
  cartTotal: number
  cartItemsCount: number
  
  // Actions
  fetchProducts: () => Promise<void>
  searchProducts: (query: string) => Promise<Product[]>
  getProductByBarcode: (barcode: string) => Promise<Product | null>
  getProductsByCategory: (categoryId: string | null) => Product[]
  
  // Cart Actions
  addToCart: (product: Product) => void
  removeFromCart: (productId: string) => void
  updateCartQuantity: (productId: string, quantity: number) => void
  clearCart: () => void
  
  // Stock
  updateProductStock: (productId: string, quantity: number) => Promise<boolean>
}

const ProductContext = createContext<ProductContextType | undefined>(undefined)

export function ProductProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = useSupabase()

  // Calculate cart totals
  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  const cartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0)

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
        .order('name')

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

  // Search products by name, SKU, or barcode
  const searchProducts = async (query: string): Promise<Product[]> => {
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
  const getProductByBarcode = async (barcode: string): Promise<Product | null> => {
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

  // Get products by category (filtered locally)
  const getProductsByCategory = (categoryId: string | null): Product[] => {
    if (!categoryId) return products
    return products.filter(product => product.category_id === categoryId)
  }

  // Add product to cart
  const addToCart = (product: Product) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === product.id)
      
      if (existingItem) {
        // Check stock before adding
        if (existingItem.quantity >= product.stock_quantity) {
          console.warn('Insufficient stock')
          return prevCart
        }
        
        return prevCart.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      }
      
      // Check if product has stock
      if (product.stock_quantity <= 0) {
        console.warn('Product out of stock')
        return prevCart
      }
      
      return [...prevCart, { ...product, quantity: 1 }]
    })
  }

  // Remove product from cart
  const removeFromCart = (productId: string) => {
    setCart(prevCart => prevCart.filter(item => item.id !== productId))
  }

  // Update cart item quantity
  const updateCartQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId)
      return
    }

    setCart(prevCart => {
      return prevCart.map(item => {
        if (item.id === productId) {
          // Check stock limit
          const maxQuantity = Math.min(quantity, item.stock_quantity)
          return { ...item, quantity: maxQuantity }
        }
        return item
      })
    })
  }

  // Clear cart
  const clearCart = () => {
    setCart([])
  }

  // Update product stock after sale
  const updateProductStock = async (productId: string, quantity: number): Promise<boolean> => {
    try {
      // First get current stock
      const { data: product, error: fetchError } = await supabase
        .from('products')
        .select('stock_quantity')
        .eq('id', productId)
        .single()

      if (fetchError) throw fetchError

      const newStock = Math.max(0, product.stock_quantity - quantity)

      // Update stock in database
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

  // Load initial data
  useEffect(() => {
    fetchProducts()
    fetchCategories()
  }, [])

  const value: ProductContextType = {
    // Products
    products,
    categories,
    loading,
    error,
    
    // Cart
    cart,
    cartTotal,
    cartItemsCount,
    
    // Actions
    fetchProducts,
    searchProducts,
    getProductByBarcode,
    getProductsByCategory,
    
    // Cart Actions
    addToCart,
    removeFromCart,
    updateCartQuantity,
    clearCart,
    
    // Stock
    updateProductStock
  }

  return (
    <ProductContext.Provider value={value}>
      {children}
    </ProductContext.Provider>
  )
}

export function useProducts() {
  const context = useContext(ProductContext)
  if (context === undefined) {
    throw new Error('useProducts must be used within a ProductProvider')
  }
  return context
}