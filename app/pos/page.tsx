'use client'

import { useState, useEffect } from 'react'
import { Search, Plus, Minus, Trash2, Grid3X3, List, User, Package, TrendingUp, Clock, Edit2, Check, X } from 'lucide-react'
import { useProducts } from '@/contexts/ProductContext'
import { useCustomers } from '@/contexts/CustomerContext'
import { useCurrency } from '@/contexts/CurrencyContext'
import { useSales } from '@/hooks/useSales'
import { useAuth } from '@/lib/auth/client'
import ProductCard from '@/components/ProductCard'
import CustomerSelectionModal from '@/components/CustomerSelectionModal'
import ReceiptModal from '@/components/ReceiptModal'
import QuickAddProductModal from '@/components/QuickAddProductModal'
import { Database } from '@/lib/database.types'

type Sale = Database['public']['Tables']['sales']['Row']
type Product = Database['public']['Tables']['products']['Row']

export default function POSPage() {
  const { user, loading: authLoading } = useAuth(true) // Require authentication
  const { 
    products, 
    cart, 
    cartItemsCount,
    loading,
    error,
    addToCart,
    removeFromCart,
    updateCartQuantity,
    updateCartItemPrice,
    clearCart,
    searchProducts,
    fetchProducts
  } = useProducts()

  const { selectedCustomer, selectCustomer, customers, searchCustomers } = useCustomers()
  const { formatAmount, currency } = useCurrency()
  const { createSale, loading: saleLoading } = useSales()

  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showReceipt, setShowReceipt] = useState(false)
  const [filteredProducts, setFilteredProducts] = useState(products)
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [receivedAmount, setReceivedAmount] = useState(0)
  const [cartPrices, setCartPrices] = useState<Record<string, number>>({}) // Store edited prices for cart items
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null)
  const [editedPrice, setEditedPrice] = useState<string>('')
  const [lastSaleData, setLastSaleData] = useState<{
    sale: Sale
    items: Array<{
      product: Product
      quantity: number
      price: number
      total: number
    }>
  } | null>(null)

  // Track if we've already processed a barcode to prevent duplicates
  const [processedBarcode, setProcessedBarcode] = useState('')
  // Quick add product modal state
  const [showQuickAddModal, setShowQuickAddModal] = useState(false)
  const [quickAddBarcode, setQuickAddBarcode] = useState('')
  
  // Update filtered products when search changes
  useEffect(() => {
    const filterProducts = async () => {
      if (searchQuery) {
        // First check if it's a barcode match in local products
        const productByBarcode = products.find(p => p.barcode && p.barcode === searchQuery)
        
        if (productByBarcode && searchQuery !== processedBarcode) {
          // Auto-add to cart if exact barcode match and not already processed
          setProcessedBarcode(searchQuery) // Mark as processed
          addToCart(productByBarcode)
          // Clear search after a small delay to ensure state updates
          setTimeout(() => {
            setSearchQuery('')
            setProcessedBarcode('') // Reset processed barcode
            setFilteredProducts(products)
          }, 100)
        } else if (!productByBarcode) {
          // Check if it looks like a barcode (numeric and certain length)
          const isLikelyBarcode = /^\d{8,13}$/.test(searchQuery)
          
          if (isLikelyBarcode) {
            // Product not found with this barcode - show quick add modal
            setQuickAddBarcode(searchQuery)
            setShowQuickAddModal(true)
            setSearchQuery('') // Clear search
            setFilteredProducts(products)
          } else {
            // Otherwise do normal search
            const searchResults = await searchProducts(searchQuery)
            setFilteredProducts(searchResults)
          }
        }
      } else {
        setFilteredProducts(products)
      }
    }

    filterProducts()
  }, [searchQuery, products, searchProducts, addToCart, processedBarcode])

  // Handle barcode scanning
  useEffect(() => {
    let barcode = ''
    let timeout: NodeJS.Timeout

    const handleKeyPress = (e: KeyboardEvent) => {
      // Skip if typing in an input field
      if (document.activeElement?.tagName === 'INPUT') return

      if (e.key === 'Enter' && barcode) {
        // Barcode scan complete - find product in local state
        const product = products.find(p => p.barcode === barcode)
        if (product) {
          addToCart(product)
        } else {
          // Product not found - show quick add modal
          setQuickAddBarcode(barcode)
          setShowQuickAddModal(true)
        }
        barcode = ''
      } else if (e.key.length === 1) {
        // Build barcode string
        barcode += e.key
        clearTimeout(timeout)
        timeout = setTimeout(() => { barcode = '' }, 100)
      }
    }

    window.addEventListener('keypress', handleKeyPress)
    return () => {
      window.removeEventListener('keypress', handleKeyPress)
      clearTimeout(timeout)
    }
  }, [products, addToCart])

  // Calculate subtotal using edited prices or original prices
  const subtotal = cart.reduce((sum, item) => {
    const price = cartPrices[item.id] ?? item.price
    return sum + (price * item.quantity)
  }, 0)
  const tax = 0 // No tax for now
  const discount = 0 // No discount for now
  const total = subtotal + tax - discount

  // Handle inline price editing
  const startEditingPrice = (itemId: string, currentPrice: number) => {
    setEditingPriceId(itemId)
    const priceToEdit = cartPrices[itemId] ?? currentPrice
    setEditedPrice(priceToEdit.toString())
  }

  const saveEditedPrice = async (itemId: string) => {
    const newPrice = parseFloat(editedPrice)
    if (!isNaN(newPrice) && newPrice >= 0) {
      // Store the edited price in cartPrices state
      setCartPrices(prev => ({
        ...prev,
        [itemId]: newPrice
      }))
      
      // Also update the price in the database immediately
      await updateCartItemPrice(itemId, newPrice)
    }
    setEditingPriceId(null)
    setEditedPrice('')
  }

  const cancelEditingPrice = () => {
    setEditingPriceId(null)
    setEditedPrice('')
  }

  const handleCheckout = async () => {
    if (cart.length === 0) return
    
    // Set received amount to total if not set
    const finalReceivedAmount = receivedAmount === 0 ? total : receivedAmount
    
    // Prepare cart items with edited prices
    const cartItemsWithEditedPrices = cart.map(item => ({
      ...item,
      price: cartPrices[item.id] ?? item.price
    }))
    
    // Create sale in database
    const result = await createSale({
      customer: selectedCustomer,
      cartItems: cartItemsWithEditedPrices,
      subtotal,
      tax,
      total,
      paymentMethod,
      receivedAmount: finalReceivedAmount
    })
    
    if (result.success && result.sale) {
      // Prepare receipt data with edited prices
      const receiptItems = cart.map(item => {
        const price = cartPrices[item.id] ?? item.price
        return {
          product: item,
          quantity: item.quantity,
          price: price,
          total: price * item.quantity
        }
      })
      
      setLastSaleData({
        sale: result.sale,
        items: receiptItems
      })
      
      // Show receipt modal
      setShowReceipt(true)
      
      // Clear cart and prices
      clearCart()
      setCartPrices({}) // Clear edited prices
      setReceivedAmount(0)
      setPaymentMethod('cash')
    } else {
      console.error('Failed to create sale')
    }
  }

  const quickAmounts = [10, 20, 50, 100, 200, 500]

  // Handle product added from quick add modal
  const handleQuickAddProduct = (newProduct: Product) => {
    // Add the new product to cart immediately
    addToCart(newProduct)
    
    // Close the modal
    setShowQuickAddModal(false)
    setQuickAddBarcode('')
    
    // Optional: Refresh products list in background without blocking
    // This won't cause a reload but will update the product list for future searches
    setTimeout(() => {
      fetchProducts()
    }, 100)
  }

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Authenticating...</p>
        </div>
      </div>
    )
  }

  // If not authenticated, the useAuth hook will redirect to login
  if (!user) {
    return null
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading products...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">Error: {error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-8">
            <h1 className="text-2xl font-bold text-gray-900">Point of Sale</h1>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <Clock className="h-4 w-4" />
                <span>{new Date().toLocaleTimeString()}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <User className="h-4 w-4" />
                <span>John Doe</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <TrendingUp className="h-4 w-4" />
                <span className="font-semibold text-green-600">$2,450 today</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-gray-900 text-white' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <Grid3X3 className="h-5 w-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-gray-900 text-white' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <List className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-73px)]">
        {/* Products Section */}
        <div className="flex-1 flex flex-col bg-white min-w-0">
          {/* Search */}
          <div className="p-6 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Products Grid/List */}
          <div className="flex-1 overflow-y-auto p-6">
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredProducts.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAddToCart={addToCart}
                    viewMode="grid"
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredProducts.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAddToCart={addToCart}
                    viewMode="list"
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Cart Section */}
        <div className="w-[480px] bg-gray-900 text-white flex flex-col flex-shrink-0">
          {/* Cart Header */}
          <div className="p-6 border-b border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Current Order</h2>
              <span className="bg-gray-800 px-3 py-1 rounded-full text-sm">
                {cartItemsCount} items
              </span>
            </div>
            <button
              onClick={() => setShowCustomerModal(true)}
              className="w-full flex items-center gap-3 p-3 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors"
            >
              <div className="h-10 w-10 bg-gray-700 rounded-full flex items-center justify-center">
                <User className="h-5 w-5 text-gray-400" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium">{selectedCustomer?.name || 'Walk-in Customer'}</p>
                <p className="text-xs text-gray-400">
                  {selectedCustomer?.phone || 'Guest checkout'}
                </p>
              </div>
            </button>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-6">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <Package className="h-16 w-16 mb-4 text-gray-700" />
                <p className="text-lg font-medium">No items in cart</p>
                <p className="text-sm text-gray-600">Add products to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map(item => (
                  <div key={item.id} className="bg-gray-800 rounded-xl p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="font-medium text-white">{item.name}</h4>
                        <div className="flex items-center gap-2">
                          {editingPriceId === item.id ? (
                            <div className="flex items-center gap-1">
                              <span className="text-sm text-gray-400">{currency.symbol}</span>
                              <input
                                type="number"
                                value={editedPrice}
                                onChange={(e) => setEditedPrice(e.target.value)}
                                className="w-20 text-sm bg-gray-700 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                autoFocus
                                step="0.01"
                              />
                              <button
                                onClick={() => saveEditedPrice(item.id)}
                                className="p-1 hover:bg-gray-700 rounded transition-colors"
                              >
                                <Check className="h-3 w-3 text-green-500" />
                              </button>
                              <button
                                onClick={cancelEditingPrice}
                                className="p-1 hover:bg-gray-700 rounded transition-colors"
                              >
                                <X className="h-3 w-3 text-red-500" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <p className="text-sm text-gray-400">{formatAmount(cartPrices[item.id] ?? item.price)} each</p>
                              <button
                                onClick={() => startEditingPrice(item.id, item.price)}
                                className="p-1 hover:bg-gray-700 rounded transition-colors"
                                title="Edit price"
                              >
                                <Edit2 className="h-3 w-3 text-gray-400" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="text-gray-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                          className="h-8 w-8 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors flex items-center justify-center"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateCartQuantity(item.id, parseInt(e.target.value) || 0)}
                          className="w-16 text-center bg-gray-700 rounded-lg px-2 py-1 mx-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                          disabled={item.quantity >= item.stock_quantity}
                          className="h-8 w-8 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      <span className="font-bold text-lg">
                        {formatAmount((cartPrices[item.id] ?? item.price) * item.quantity)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Payment Section */}
          <div className="border-t border-gray-800 p-6">
            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Subtotal</span>
                <span>{formatAmount(subtotal)}</span>
              </div>
              {tax > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Tax</span>
                  <span>{formatAmount(tax)}</span>
                </div>
              )}
              <div className="pt-3 border-t border-gray-800">
                <div className="flex justify-between items-center">
                  <span className="text-xl font-bold">Total</span>
                  <span className="text-3xl font-bold">{formatAmount(total)}</span>
                </div>
              </div>
            </div>

            {/* Quick Cash Amounts */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {quickAmounts.map(amount => (
                <button
                  key={amount}
                  className="py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
                >
                  {formatAmount(amount)}
                </button>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={clearCart}
                disabled={cart.length === 0}
                className="flex-1 py-4 bg-gray-800 hover:bg-gray-700 rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Clear
              </button>
              <button
                onClick={handleCheckout}
                disabled={cart.length === 0 || saleLoading}
                className="flex-[2] py-4 bg-blue-600 hover:bg-blue-700 rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saleLoading ? 'Processing...' : `Pay ${formatAmount(total)}`}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Selection Modal */}
      <CustomerSelectionModal
        isOpen={showCustomerModal}
        onClose={() => setShowCustomerModal(false)}
        customers={customers}
        selectedCustomer={selectedCustomer}
        onSelectCustomer={selectCustomer}
        onSearchCustomers={searchCustomers}
      />

      {/* Receipt Modal */}
      <ReceiptModal
        isOpen={showReceipt}
        onClose={() => setShowReceipt(false)}
        receiptData={lastSaleData ? {
          sale: lastSaleData.sale,
          items: lastSaleData.items,
          businessName: 'My Store',
          businessAddress: '123 Main Street, City',
          businessPhone: 'Tel: +1 234 567 8900',
          businessEmail: 'store@mystore.com'
        } : null}
      />

      {/* Quick Add Product Modal */}
      <QuickAddProductModal
        isOpen={showQuickAddModal}
        onClose={() => {
          setShowQuickAddModal(false)
          setQuickAddBarcode('')
        }}
        barcode={quickAddBarcode}
        onProductAdded={handleQuickAddProduct}
      />
    </div>
  )
}