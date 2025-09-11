'use client'

import { useState } from 'react'
import { X, Barcode } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/lib/database.types'
import { useCurrency } from '@/contexts/CurrencyContext'

type Product = Database['public']['Tables']['products']['Row']

interface QuickAddProductModalProps {
  isOpen: boolean
  onClose: () => void
  barcode: string
  onProductAdded: (product: Product) => void
}

export default function QuickAddProductModal({ 
  isOpen, 
  onClose, 
  barcode, 
  onProductAdded 
}: QuickAddProductModalProps) {
  const { currency } = useCurrency()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    price: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name || !formData.price) {
      alert('Please fill in product name and price')
      return
    }
    
    setLoading(true)
    
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        alert('Please login to add products')
        setLoading(false)
        return
      }
      
      // Validate price
      const price = parseFloat(formData.price)
      if (isNaN(price) || price < 0) {
        alert('Please enter a valid price')
        setLoading(false)
        return
      }
      
      // Create product
      const productData = {
        name: formData.name.trim(),
        sku: barcode, // Use barcode as SKU
        barcode: barcode, // Use the scanned barcode
        price: price,
        cost_price: price, // Same as price initially
        stock_quantity: 0, // Default to 0 for products not yet in stock
        min_stock_level: 0, // Default
        category_id: null,
        brand_id: null,
        supplier_id: null,
        description: `Quick added product - ${new Date().toLocaleDateString()}`
      }
      
      console.log('Creating product with data:', productData)
      
      const { data, error } = await supabase
        .from('products')
        .insert(productData)
        .select()
        .single()
      
      if (error) {
        console.error('Supabase error:', error)
        throw error
      }
      
      if (!data) {
        throw new Error('No data returned from insert')
      }
      
      // Call the callback with the new product
      onProductAdded(data)
      
      // Reset form and close modal
      setFormData({
        name: '',
        price: ''
      })
      onClose()
      
    } catch (error) {
      console.error('Error creating product:', error)
      
      // Provide more detailed error message
      let errorMessage = 'Failed to create product: '
      if (error instanceof Error) {
        errorMessage += error.message
      } else if (typeof error === 'object' && error !== null) {
        const err = error as { message?: string; details?: string; code?: string }
        if (err.message) {
          errorMessage += err.message
        } else if (err.details) {
          errorMessage += err.details
        } else if (err.code) {
          errorMessage += `Error code: ${err.code}`
        } else {
          errorMessage += 'Unknown error. Check console for details.'
        }
      } else {
        errorMessage += 'Unknown error. Check console for details.'
      }
      
      alert(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col">
        {/* Modal Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Quick Add Product</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
          
          {/* Barcode Display */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center gap-3">
            <Barcode className="h-5 w-5 text-gray-500" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">Scanned Barcode</p>
              <p className="text-xs text-gray-500">{barcode}</p>
            </div>
          </div>
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Product Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Product Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter product name"
                autoFocus
                required
              />
            </div>

            {/* Price */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Price <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                  {currency.symbol}
                </span>
                <input
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-3 px-4 bg-gray-900 hover:bg-gray-800 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
              >
                {loading ? 'Adding...' : 'Add Product'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}