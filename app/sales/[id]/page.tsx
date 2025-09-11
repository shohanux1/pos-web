'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Printer, Download, X, Calendar, User, CreditCard, Package, DollarSign, Hash, Phone, Mail, Clock, FileText, Edit2, Save, Trash2, Plus, Minus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useCurrency } from '@/contexts/CurrencyContext'
import { useAuth } from '@/lib/auth/client'
import ReceiptModal from '@/components/ReceiptModal'
import { Database } from '@/lib/database.types'

type Sale = Database['public']['Tables']['sales']['Row']
type SaleItem = Database['public']['Tables']['sale_items']['Row']
type Product = Database['public']['Tables']['products']['Row']

interface SaleDetails extends Sale {
  sale_items: (SaleItem & {
    product: Product
  })[]
}

export default function SaleDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const saleId = params.id as string
  
  const { user, loading: authLoading } = useAuth(true)
  const { formatAmount } = useCurrency()
  const supabase = createClient()
  
  const [sale, setSale] = useState<SaleDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [receiptData, setReceiptData] = useState<{
    sale: Sale | SaleDetails
    items: Array<{
      product: Product
      quantity: number
      price: number
      total: number
    }>
    businessName: string
    businessAddress: string
    businessPhone: string
    businessEmail: string
  } | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [editedItems, setEditedItems] = useState<(SaleItem & { product: Product })[]>([])

  // Fetch sale details
  const fetchSaleDetails = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      // Fetch sale with items and product details
      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .select(`
          *,
          sale_items (
            *,
            product:products (*)
          )
        `)
        .eq('id', saleId)
        .single()
      
      if (saleError) throw saleError
      
      setSale(saleData as SaleDetails)
    } catch (err) {
      console.error('Error fetching sale details:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch sale details')
    } finally {
      setLoading(false)
    }
  }, [saleId, supabase])

  // Void sale
  const handleVoidSale = async () => {
    if (!sale || sale.status === 'cancelled') return
    
    if (!confirm('Are you sure you want to void this sale? This action cannot be undone.')) {
      return
    }
    
    try {
      // Only restore stock if the sale was previously completed
      if (sale.status === 'completed') {
        // Get current user for inventory tracking
        const { data: { user } } = await supabase.auth.getUser()
        
        // Restore stock for each item
        for (const item of sale.sale_items) {
          const { data: currentProduct, error: fetchError } = await supabase
            .from('products')
            .select('stock_quantity')
            .eq('id', item.product_id)
            .single()
          
          if (fetchError) {
            console.error('Error fetching product:', fetchError)
            continue
          }
          
          // Add back the quantity that was sold
          const newStock = (currentProduct?.stock_quantity || 0) + item.quantity
          
          const { error: updateError } = await supabase
            .from('products')
            .update({ 
              stock_quantity: newStock 
            })
            .eq('id', item.product_id)
          
          if (updateError) {
            console.error('Error updating stock for product:', item.product_id, updateError)
          }
          
          // Create inventory movement record for tracking
          if (user) {
            const { error: movementError } = await supabase
              .from('stock_movements')
              .insert({
                product_id: item.product_id,
                type: 'in', // Use 'in' for restoring stock
                quantity: item.quantity,
                reference: `VOID-${saleId.slice(0, 8).toUpperCase()}`,
                notes: `Stock restored from voided sale #${saleNumber}`,
                // Don't set batch_id - it has foreign key to stock_batches table
                user_id: user.id
                // created_at and updated_at are handled by database defaults
              })
            
            if (movementError) {
              console.error('Error creating stock movement:', movementError)
            }
          }
        }
      }
      
      // Update sale status to cancelled
      const { error } = await supabase
        .from('sales')
        .update({ status: 'cancelled' })
        .eq('id', saleId)
      
      if (error) throw error
      
      // Refresh data
      await fetchSaleDetails()
    } catch (err) {
      console.error('Error voiding sale:', err)
      alert('Failed to void sale: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  // Enter edit mode
  const handleEnterEditMode = () => {
    if (sale?.status !== 'completed') {
      alert('Only completed sales can be edited')
      return
    }
    setEditedItems([...sale.sale_items])
    setIsEditMode(true)
  }

  // Cancel edit mode
  const handleCancelEdit = () => {
    setIsEditMode(false)
    setEditedItems([])
  }

  // Update item quantity
  const handleUpdateQuantity = (itemId: string, change: number) => {
    setEditedItems(prev => prev.map(item => {
      if (item.id === itemId) {
        const newQuantity = Math.max(0, item.quantity + change)
        return {
          ...item,
          quantity: newQuantity,
          total: newQuantity * item.price
        }
      }
      return item
    }).filter(item => item.quantity > 0))
  }

  // Remove item from sale
  const handleRemoveItem = (itemId: string) => {
    if (editedItems.length <= 1) {
      alert('Cannot remove all items. Void the sale instead.')
      return
    }
    setEditedItems(prev => prev.filter(item => item.id !== itemId))
  }

  // Save edited sale
  const handleSaveEdit = async () => {
    if (!sale) return
    
    try {
      // Get current user for inventory tracking
      const { data: { user } } = await supabase.auth.getUser()
      
      // Calculate which items were removed or changed
      const originalItems = sale.sale_items
      const itemsToRestore: { product_id: string, quantity: number, product_name?: string }[] = []
      const itemsToUpdate: { id: string, quantity: number, total: number }[] = []
      const itemsToDelete: string[] = []
      
      // Find removed or changed items
      for (const original of originalItems) {
        const edited = editedItems.find(e => e.id === original.id)
        
        if (!edited) {
          // Item was removed - restore full quantity
          itemsToDelete.push(original.id)
          itemsToRestore.push({ 
            product_id: original.product_id, 
            quantity: original.quantity,
            product_name: original.product.name
          })
        } else if (edited.quantity !== original.quantity) {
          // Quantity changed - restore difference
          const diff = original.quantity - edited.quantity
          if (diff !== 0) {
            itemsToRestore.push({ 
              product_id: original.product_id, 
              quantity: diff,
              product_name: original.product.name
            })
          }
          itemsToUpdate.push({ id: edited.id, quantity: edited.quantity, total: edited.total })
        }
      }
      
      // Restore/adjust stock for removed/changed items
      for (const restore of itemsToRestore) {
        const { data: product, error: fetchError } = await supabase
          .from('products')
          .select('stock_quantity')
          .eq('id', restore.product_id)
          .single()
        
        if (fetchError) {
          console.error('Error fetching product:', fetchError)
          continue
        }
        
        const newStock = (product?.stock_quantity || 0) + restore.quantity
        
        await supabase
          .from('products')
          .update({ stock_quantity: newStock })
          .eq('id', restore.product_id)
        
        // Create inventory movement record
        if (user) {
          const movementType = restore.quantity > 0 ? 'in' : 'out'
          const absQuantity = Math.abs(restore.quantity)
          
          const { error: movementError } = await supabase
            .from('stock_movements')
            .insert({
              product_id: restore.product_id,
              type: movementType,
              quantity: absQuantity,
              reference: `EDIT-${saleId.slice(0, 8).toUpperCase()}`,
              notes: `Sale edit: ${restore.quantity > 0 ? 'Returned' : 'Added'} ${absQuantity} x ${restore.product_name}`,
              // Don't set batch_id - it has foreign key to stock_batches table
              user_id: user.id
              // created_at and updated_at are handled by database defaults
            })
          
          if (movementError) {
            console.error('Error creating stock movement:', movementError)
          }
        }
      }
      
      // Delete removed items from sale_items table
      if (itemsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('sale_items')
          .delete()
          .in('id', itemsToDelete)
        
        if (deleteError) {
          console.error('Error deleting sale items:', deleteError)
          throw new Error('Failed to remove items from sale')
        }
      }
      
      // Update changed items
      for (const update of itemsToUpdate) {
        const { error: updateError } = await supabase
          .from('sale_items')
          .update({ quantity: update.quantity, total: update.total })
          .eq('id', update.id)
        
        if (updateError) {
          console.error('Error updating sale item:', updateError)
          throw new Error('Failed to update item quantity')
        }
      }
      
      // Recalculate totals
      const newSubtotal = editedItems.reduce((sum, item) => sum + item.total, 0)
      // Calculate tax rate from original sale and apply to new subtotal
      const taxRate = sale.subtotal > 0 ? (sale.tax || 0) / sale.subtotal : 0
      const newTax = newSubtotal * taxRate
      const newTotal = newSubtotal + newTax
      
      // Update sale totals
      const { error: updateSaleError } = await supabase
        .from('sales')
        .update({ 
          subtotal: newSubtotal,
          tax: newTax,
          total: newTotal,
          updated_at: new Date().toISOString()
        })
        .eq('id', saleId)
      
      if (updateSaleError) {
        throw new Error('Failed to update sale totals')
      }
      
      // Update the local state immediately with the edited items
      setSale(prev => {
        if (!prev) return prev
        return {
          ...prev,
          sale_items: editedItems,
          subtotal: newSubtotal,
          tax: newTax,
          total: newTotal
        }
      })
      
      // Exit edit mode
      setIsEditMode(false)
      setEditedItems([])
      
      // Then fetch fresh data from database to ensure consistency
      await fetchSaleDetails()
    } catch (err) {
      console.error('Error updating sale:', err)
      alert('Failed to update sale: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  // Prepare receipt data
  const prepareReceiptData = () => {
    if (!sale) return
    
    const receiptData = {
      sale: sale,
      items: sale.sale_items.map(item => ({
        product: item.product, // Use the full product object
        quantity: item.quantity,
        price: item.price,
        total: item.total
      })),
      businessName: 'Pragpur Family Bazar',
      businessAddress: 'Pragpur, Char-Pragpur, Daulotpur',
      businessPhone: 'Phone: 01740486802',
      businessEmail: 'shohanux@gmail.com'
    }
    
    setReceiptData(receiptData)
    setShowReceiptModal(true)
  }

  // Export sale as PDF (simplified version)
  const handleExportPDF = () => {
    if (!sale) return
    window.print()
  }

  useEffect(() => {
    if (user && saleId) {
      fetchSaleDetails()
    }
  }, [user, saleId, fetchSaleDetails])

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading sale details...</p>
        </div>
      </div>
    )
  }

  if (error || !sale) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Sale not found'}</p>
          <button
            onClick={() => router.push('/sales')}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            Back to Sales
          </button>
        </div>
      </div>
    )
  }

  const saleNumber = `SALE-${sale.id.slice(0, 8).toUpperCase()}`

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/sales')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Sale Details</h1>
              <p className="text-sm text-gray-600 mt-1">Order #{saleNumber}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isEditMode ? (
              <>
                <button
                  onClick={handleCancelEdit}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  Save Changes
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={prepareReceiptData}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
                >
                  <Printer className="h-4 w-4" />
                  Print Receipt
                </button>
                <button
                  onClick={handleExportPDF}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export PDF
                </button>
                {sale.status === 'completed' && (
                  <button
                    onClick={handleEnterEditMode}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <Edit2 className="h-4 w-4" />
                    Edit Sale
                  </button>
                )}
                {sale.status !== 'cancelled' && (
                  <button
                    onClick={handleVoidSale}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                  >
                    <X className="h-4 w-4" />
                    Void Sale
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Sale Status */}
            {sale.status === 'cancelled' && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-red-800 font-semibold">This sale has been cancelled</p>
                <p className="text-red-600 text-sm mt-1">The inventory has been restored for all items in this sale.</p>
              </div>
            )}

            {/* Products Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Products ({isEditMode ? editedItems.length : sale.sale_items.length} items)
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">
                        Product
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Barcode
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Quantity
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Unit Price
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total
                      </th>
                      {isEditMode && (
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {(isEditMode ? editedItems : sale.sale_items).map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-medium text-gray-900">{item.product.name}</p>
                            {item.product.description && (
                              <p className="text-sm text-gray-500 mt-1">{item.product.description}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {item.product.barcode || '-'}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {isEditMode ? (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleUpdateQuantity(item.id, -1)}
                                className="p-1 hover:bg-gray-200 rounded transition-colors"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-sm font-medium min-w-[32px] text-center">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => handleUpdateQuantity(item.id, 1)}
                                className="p-1 hover:bg-gray-200 rounded transition-colors"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium">
                              {item.quantity}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right text-sm text-gray-900">
                          {formatAmount(item.price)}
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-gray-900">
                          {formatAmount(item.total)}
                        </td>
                        {isEditMode && (
                          <td className="px-4 py-4 text-center">
                            <button
                              onClick={() => handleRemoveItem(item.id)}
                              className="p-1.5 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                              title="Remove item"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                    <tr>
                      <td colSpan={4} className="px-6 py-4 text-right font-medium text-gray-700">
                        Subtotal
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-gray-900">
                        {isEditMode 
                          ? formatAmount(editedItems.reduce((sum, item) => sum + item.total, 0))
                          : formatAmount(sale.subtotal || 0)}
                      </td>
                      {isEditMode && <td />}
                    </tr>
                    {sale.tax && sale.tax > 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-4 text-right font-medium text-gray-700">
                          Tax
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-gray-900">
                          {isEditMode 
                            ? formatAmount((editedItems.reduce((sum, item) => sum + item.total, 0) * (sale.tax / sale.subtotal)) || 0)
                            : formatAmount(sale.tax || 0)}
                        </td>
                        {isEditMode && <td />}
                      </tr>
                    ) : null}
                    <tr className="text-lg">
                      <td colSpan={isEditMode ? 4 : 5} className="px-6 py-4 text-right font-bold text-gray-900">
                        Total
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-gray-900">
                        {isEditMode 
                          ? formatAmount(
                              editedItems.reduce((sum, item) => sum + item.total, 0) + 
                              (sale.tax ? (editedItems.reduce((sum, item) => sum + item.total, 0) * (sale.tax / sale.subtotal)) : 0)
                            )
                          : formatAmount(sale.total)}
                      </td>
                      {isEditMode && <td />}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Payment Information */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment Information
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Payment Method</p>
                  <p className="font-medium text-gray-900 capitalize">{sale.payment_method}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Amount Received</p>
                  <p className="font-medium text-gray-900">{formatAmount(sale.received_amount || 0)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Change Given</p>
                  <p className="font-medium text-gray-900">{formatAmount(sale.change_amount || 0)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Transaction Status</p>
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                    sale.status === 'completed' 
                      ? 'bg-green-100 text-green-800'
                      : sale.status === 'cancelled'
                      ? 'bg-red-100 text-red-800'
                      : sale.status === 'refunded'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {sale.status}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Customer Information */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <User className="h-5 w-5" />
                Customer Information
              </h2>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">Name</p>
                  <p className="font-medium text-gray-900">{sale.customer_name || 'Walk-in Customer'}</p>
                </div>
                {sale.customer_phone && (
                  <div>
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <Phone className="h-3 w-3" /> Phone
                    </p>
                    <p className="font-medium text-gray-900">{sale.customer_phone}</p>
                  </div>
                )}
                {sale.customer_email && (
                  <div>
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <Mail className="h-3 w-3" /> Email
                    </p>
                    <p className="font-medium text-gray-900">{sale.customer_email}</p>
                  </div>
                )}
                {sale.customer_id && (
                  <div>
                    <p className="text-sm text-gray-500">Customer ID</p>
                    <p className="font-mono text-xs text-gray-600">{sale.customer_id}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Sale Information */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Sale Information
              </h2>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    <Hash className="h-3 w-3" /> Sale Number
                  </p>
                  <p className="font-medium text-gray-900">{saleNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Date
                  </p>
                  <p className="font-medium text-gray-900">
                    {sale.created_at ? new Date(sale.created_at).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Time
                  </p>
                  <p className="font-medium text-gray-900">
                    {sale.created_at ? new Date(sale.created_at).toLocaleTimeString() : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Cashier</p>
                  <p className="font-medium text-gray-900">John Doe</p>
                </div>
              </div>
            </div>

            {/* Summary Card */}
            <div className="bg-gray-900 text-white rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Sale Summary
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Items</span>
                  <span className="font-medium">{sale.sale_items.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Quantity</span>
                  <span className="font-medium">
                    {sale.sale_items.reduce((sum, item) => sum + item.quantity, 0)}
                  </span>
                </div>
                <div className="pt-3 border-t border-gray-700">
                  <div className="flex justify-between items-center">
                    <span className="text-xl font-bold">Total</span>
                    <span className="text-2xl font-bold">{formatAmount(sale.total)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Receipt Modal */}
      <ReceiptModal
        isOpen={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
        receiptData={receiptData}
      />
    </div>
  )
}