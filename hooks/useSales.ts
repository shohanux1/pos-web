import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/lib/database.types'

type Sale = Database['public']['Tables']['sales']['Row']
type SaleItem = Database['public']['Tables']['sale_items']['Row']
type Product = Database['public']['Tables']['products']['Row']
type Customer = Database['public']['Tables']['customers']['Row']

interface CartItem extends Product {
  quantity: number
}

interface CreateSaleParams {
  customer: Customer | null
  cartItems: CartItem[]
  subtotal: number
  tax: number
  total: number
  paymentMethod: string
  receivedAmount: number
}

interface CreateSaleResult {
  success: boolean
  sale?: Sale
  saleItems?: CartItem[]
  error?: any
}

export function useSales() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sales, setSales] = useState<Sale[]>([])
  const supabase = createClient()

  const createSale = async (params: CreateSaleParams): Promise<CreateSaleResult> => {
    setLoading(true)
    setError(null)

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        throw new Error('User not authenticated')
      }

      const { 
        customer, 
        cartItems, 
        subtotal, 
        tax, 
        total, 
        paymentMethod, 
        receivedAmount 
      } = params

      const changeAmount = receivedAmount - total

      // Create sale record
      const saleData = {
        customer_id: customer?.id === 'walk-in' ? null : customer?.id,
        customer_name: customer?.name || 'Walk-in Customer',
        customer_phone: customer?.phone || null,
        customer_email: customer?.email || null,
        subtotal,
        tax,
        total,
        payment_method: paymentMethod,
        received_amount: receivedAmount,
        change_amount: changeAmount,
        status: 'completed',
        user_id: user.id
      }

      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert(saleData)
        .select()
        .single()

      if (saleError) throw saleError

      // Create sale items
      const saleItems = cartItems.map(item => ({
        sale_id: sale.id,
        product_id: item.id,
        quantity: item.quantity,
        price: item.price,
        total: item.price * item.quantity
      }))

      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(saleItems)

      if (itemsError) throw itemsError

      // Update product stock quantities and create inventory tracking records
      for (const item of cartItems) {
        // First get current stock from database
        const { data: product, error: fetchError } = await supabase
          .from('products')
          .select('stock_quantity')
          .eq('id', item.id)
          .single()
        
        if (fetchError) {
          console.error('Error fetching product stock:', item.id, fetchError)
          continue
        }
        
        // Decrement stock by quantity sold
        const newStock = (product?.stock_quantity || 0) - item.quantity
        
        const { error: stockError } = await supabase
          .from('products')
          .update({ 
            stock_quantity: newStock 
          })
          .eq('id', item.id)

        if (stockError) {
          console.error('Error updating stock for product:', item.id, stockError)
        }
        
        // Create inventory movement record for tracking
        const { error: movementError } = await supabase
          .from('stock_movements')
          .insert({
            product_id: item.id,
            type: 'out',
            quantity: item.quantity,
            reference: `SALE-${sale.id.slice(0, 8).toUpperCase()}`,
            notes: `Sold to ${customer?.name || 'Walk-in Customer'}`,
            // Don't set batch_id unless we create a corresponding stock_batches record
            // batch_id has foreign key constraint to stock_batches table
            user_id: user.id
            // created_at and updated_at are handled by database defaults
          })
        
        if (movementError) {
          console.error('Error creating stock movement:', movementError)
        }
      }

      // Update customer loyalty points if applicable
      if (customer && customer.id !== 'walk-in' && customer.loyalty_enabled) {
        const loyaltyPoints = Math.floor(total) // 1 point per currency unit
        
        const { error: loyaltyError } = await supabase
          .from('customers')
          .update({ 
            loyalty_points: (customer.loyalty_points || 0) + loyaltyPoints 
          })
          .eq('id', customer.id)

        if (loyaltyError) {
          console.error('Error updating loyalty points:', loyaltyError)
        }
      }

      setLoading(false)
      return { success: true, sale, saleItems: cartItems }
    } catch (err) {
      console.error('Error creating sale:', err)
      setError(err instanceof Error ? err.message : 'Failed to create sale')
      setLoading(false)
      return { success: false, error: err }
    }
  }

  // Fetch all sales
  const fetchSales = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const { data, error: fetchError } = await supabase
        .from('sales')
        .select(`
          *,
          sale_items(count)
        `)
        .order('created_at', { ascending: false })
      
      if (fetchError) throw fetchError
      
      // Transform data to include items_count
      const salesWithCount = (data || []).map(sale => ({
        ...sale,
        items_count: sale.sale_items?.[0]?.count || 0
      }))
      
      setSales(salesWithCount as any)
      setLoading(false)
    } catch (err) {
      console.error('Error fetching sales:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch sales')
      setLoading(false)
    }
  }

  // Get sale details including items
  const getSaleDetails = async (saleId: string) => {
    try {
      const { data, error: fetchError } = await supabase
        .from('sale_items')
        .select(`
          *,
          products:product_id (
            name,
            sku,
            barcode
          )
        `)
        .eq('sale_id', saleId)
      
      if (fetchError) throw fetchError
      
      return {
        items: (data || []).map(item => ({
          product_name: item.products?.name || 'Unknown',
          product_sku: item.products?.sku || '',
          quantity: item.quantity,
          unit_price: item.price,
          total_price: item.total
        }))
      }
    } catch (err) {
      console.error('Error fetching sale details:', err)
      return null
    }
  }

  // Void a sale
  const voidSale = async (saleId: string) => {
    try {
      // First get the sale items to restore stock
      const { data: saleItems, error: itemsError } = await supabase
        .from('sale_items')
        .select('product_id, quantity')
        .eq('sale_id', saleId)
      
      if (itemsError) throw itemsError
      
      // Restore stock for each item
      for (const item of saleItems || []) {
        const { data: product } = await supabase
          .from('products')
          .select('stock_quantity')
          .eq('id', item.product_id)
          .single()
        
        if (product) {
          await supabase
            .from('products')
            .update({ 
              stock_quantity: product.stock_quantity + item.quantity 
            })
            .eq('id', item.product_id)
        }
      }
      
      // Update sale status to voided
      const { error: voidError } = await supabase
        .from('sales')
        .update({ status: 'voided' })
        .eq('id', saleId)
      
      if (voidError) throw voidError
      
      return true
    } catch (err) {
      console.error('Error voiding sale:', err)
      return false
    }
  }

  return {
    sales,
    createSale,
    fetchSales,
    getSaleDetails,
    voidSale,
    loading,
    error
  }
}