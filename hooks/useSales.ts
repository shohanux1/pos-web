import { useState, useEffect } from 'react'
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
  const [dailyTotal, setDailyTotal] = useState(0)
  const [totalProfit, setTotalProfit] = useState(0)
  const [todayProfit, setTodayProfit] = useState(0)
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

      // Create inventory tracking records - the database trigger will handle stock updates
      for (const item of cartItems) {
        console.log(`[STOCK MOVEMENT] Creating stock movement for ${item.name}, quantity: ${item.quantity}`)
        
        // Create inventory movement record
        // The database trigger 'trigger_update_product_stock' will automatically update the stock
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
        } else {
          console.log(`[STOCK MOVEMENT] Stock movement created for ${item.name}, database trigger will update stock`)
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
      
      // Update daily total after successful sale
      fetchDailyTotal()
      
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

  // Calculate profit for sales
  const calculateProfit = async (startDate?: Date, endDate?: Date) => {
    try {
      let query = supabase
        .from('sale_items')
        .select(`
          quantity,
          price,
          total,
          sales!inner(status, created_at),
          products!inner(cost_price)
        `)
        .eq('sales.status', 'completed')

      if (startDate && endDate) {
        query = query
          .gte('sales.created_at', startDate.toISOString())
          .lt('sales.created_at', endDate.toISOString())
      }

      const { data, error } = await query

      if (error) {
        console.error('Error calculating profit:', error)
        return { totalProfit: 0, totalRevenue: 0, totalCost: 0 }
      }

      let totalRevenue = 0
      let totalCost = 0

      if (data) {
        data.forEach((item: any) => {
          const revenue = item.total || 0
          const cost = (item.products?.cost_price || 0) * item.quantity
          totalRevenue += revenue
          totalCost += cost
        })
      }

      const totalProfit = totalRevenue - totalCost
      return { totalProfit, totalRevenue, totalCost }
    } catch (err) {
      console.error('Error in calculateProfit:', err)
      return { totalProfit: 0, totalRevenue: 0, totalCost: 0 }
    }
  }

  // Fetch today's sales total and profit (only completed sales)
  const fetchDailyTotal = async () => {
    try {
      // Get start and end of today in local time
      const now = new Date()
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
      
      console.log('[DAILY TOTAL] Fetching sales for date:', startOfToday.toLocaleDateString())

      const { data, error: fetchError } = await supabase
        .from('sales')
        .select('total, created_at')
        .gte('created_at', startOfToday.toISOString())
        .lt('created_at', startOfTomorrow.toISOString())
        .eq('status', 'completed') // Only completed sales
      
      if (fetchError) {
        console.error('[DAILY TOTAL] Error:', fetchError)
        throw fetchError
      }
      
      // Calculate total
      const total = (data || []).reduce((sum, sale) => sum + (sale.total || 0), 0)
      console.log(`[DAILY TOTAL] Today's completed sales: ${data?.length || 0} sales, Total: ${total}`)
      
      setDailyTotal(total)
      
      // Also calculate today's profit
      const profitData = await calculateProfit(startOfToday, startOfTomorrow)
      setTodayProfit(profitData.totalProfit)
      
      return total
    } catch (err) {
      console.error('Error fetching daily total:', err)
      return 0
    }
  }
  
  // Fetch all-time profit
  const fetchTotalProfit = async () => {
    try {
      const profitData = await calculateProfit()
      setTotalProfit(profitData.totalProfit)
      return profitData.totalProfit
    } catch (err) {
      console.error('Error fetching total profit:', err)
      return 0
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
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')
      
      // First get the sale items to create reverse stock movements
      const { data: saleItems, error: itemsError } = await supabase
        .from('sale_items')
        .select('product_id, quantity')
        .eq('sale_id', saleId)
      
      if (itemsError) throw itemsError
      
      // Create reverse stock movements - the database trigger will handle stock updates
      for (const item of saleItems || []) {
        console.log(`[VOID STOCK MOVEMENT] Creating reverse movement for product ${item.product_id}, quantity: ${item.quantity}`)
        
        // Create inventory movement record with type 'in' to restore stock
        // The database trigger 'trigger_update_product_stock' will automatically update the stock
        const { error: movementError } = await supabase
          .from('stock_movements')
          .insert({
            product_id: item.product_id,
            type: 'in',  // 'in' type will increase stock
            quantity: item.quantity,
            reference: `VOID-${saleId.slice(0, 8).toUpperCase()}`,
            notes: `Voided sale - stock restored`,
            user_id: user.id
          })
        
        if (movementError) {
          console.error('Error creating void stock movement:', movementError)
        } else {
          console.log(`[VOID STOCK MOVEMENT] Stock movement created, database trigger will restore stock`)
        }
      }
      
      // Update sale status to cancelled (voided is not in the database CHECK constraint)
      const { error: voidError } = await supabase
        .from('sales')
        .update({ status: 'cancelled' })
        .eq('id', saleId)
      
      if (voidError) throw voidError
      
      // Update daily total after voiding
      fetchDailyTotal()
      
      return true
    } catch (err) {
      console.error('Error voiding sale:', err)
      return false
    }
  }

  return {
    sales,
    dailyTotal,
    totalProfit,
    todayProfit,
    createSale,
    fetchSales,
    fetchDailyTotal,
    fetchTotalProfit,
    calculateProfit,
    getSaleDetails,
    voidSale,
    loading,
    error
  }
}