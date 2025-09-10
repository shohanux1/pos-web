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

      // Update product stock quantities
      for (const item of cartItems) {
        const { error: stockError } = await supabase
          .from('products')
          .update({ 
            stock_quantity: item.stock_quantity - item.quantity 
          })
          .eq('id', item.id)

        if (stockError) {
          console.error('Error updating stock for product:', item.id, stockError)
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

  return {
    createSale,
    loading,
    error
  }
}