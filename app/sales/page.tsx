'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Download, Eye, Printer, RefreshCw, TrendingUp, Package, Users, DollarSign, Clock, MoreVertical, X } from 'lucide-react'
import { useSales } from '@/hooks/useSales'
import { useAuth } from '@/lib/auth/client'
import { useCurrency } from '@/contexts/CurrencyContext'
import { Database } from '@/lib/database.types'
import ReceiptModal from '@/components/ReceiptModal'

type Sale = Database['public']['Tables']['sales']['Row']

export default function SalesPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth(true)
  const { sales, loading, fetchSales, getSaleDetails, voidSale } = useSales()
  const { formatAmount } = useCurrency()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFilter, setDateFilter] = useState('today')
  const [statusFilter, setStatusFilter] = useState('all')
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all')
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [receiptData, setReceiptData] = useState<{
    sale: Sale
    items: Array<{
      product: Database['public']['Tables']['products']['Row']
      quantity: number
      price: number
      total: number
    }>
    businessName: string
    businessAddress: string
    businessPhone: string
    businessEmail: string
  } | null>(null)
  const [showActions, setShowActions] = useState<string | null>(null)

  // Calculate statistics
  const stats = {
    totalSales: sales.length,
    totalRevenue: sales.reduce((sum, sale) => sum + (sale.total || 0), 0),
    averageOrderValue: sales.length > 0 ? sales.reduce((sum, sale) => sum + (sale.total || 0), 0) / sales.length : 0,
    todaysSales: sales.filter(sale => {
      const saleDate = new Date(sale.created_at || new Date())
      const today = new Date()
      return saleDate.toDateString() === today.toDateString()
    }).length
  }

  // Filter sales based on search and filters
  const filteredSales = sales.filter(sale => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const saleNumber = `SALE-${sale.id.slice(0, 8).toUpperCase()}`
      if (!saleNumber.toLowerCase().includes(query) &&
          !sale.customer_name?.toLowerCase().includes(query) &&
          !sale.customer_phone?.toLowerCase().includes(query)) {
        return false
      }
    }

    // Date filter
    const saleDate = new Date(sale.created_at || new Date())
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    if (dateFilter === 'today') {
      const todayEnd = new Date(today)
      todayEnd.setHours(23, 59, 59, 999)
      if (saleDate < today || saleDate > todayEnd) return false
    } else if (dateFilter === 'week') {
      const weekAgo = new Date(today)
      weekAgo.setDate(weekAgo.getDate() - 7)
      if (saleDate < weekAgo) return false
    } else if (dateFilter === 'month') {
      const monthAgo = new Date(today)
      monthAgo.setMonth(monthAgo.getMonth() - 1)
      if (saleDate < monthAgo) return false
    }

    // Status filter
    if (statusFilter !== 'all' && sale.status !== statusFilter) return false

    // Payment method filter
    if (paymentMethodFilter !== 'all' && sale.payment_method !== paymentMethodFilter) return false

    return true
  })

  const handleViewReceipt = useCallback(async (sale: Sale) => {
    const details = await getSaleDetails(sale.id)
    if (details) {
      // We need to create mock product objects since getSaleDetails only returns partial data
      // The ReceiptModal will use the product.name and product.sku from this
      const itemsWithProducts = details.items.map(item => ({
        product: {
          id: '',
          name: item.product_name,
          sku: item.product_sku,
          barcode: null,
          category_id: null,
          brand_id: null,
          supplier_id: null,
          description: null,
          price: item.unit_price,
          cost_price: null,
          stock_quantity: 0,
          min_stock_level: null,
          image_url: null,
          created_at: null,
          updated_at: null,
          user_id: ''
        } as Database['public']['Tables']['products']['Row'],
        quantity: item.quantity,
        price: item.unit_price,
        total: item.total_price
      }))
      
      setReceiptData({
        sale,
        items: itemsWithProducts,
        businessName: 'My Store',
        businessAddress: '123 Main Street, City',
        businessPhone: 'Tel: +1 234 567 8900',
        businessEmail: 'store@mystore.com'
      })
      setShowReceiptModal(true)
    }
  }, [getSaleDetails])

  const handleVoidSale = async (saleId: string) => {
    if (confirm('Are you sure you want to void this sale? This action cannot be undone.')) {
      await voidSale(saleId)
      await fetchSales()
      setShowActions(null)
    }
  }

  const handleExportCSV = () => {
    const csvContent = [
      ['Sale Number', 'Date', 'Customer', 'Items', 'Total', 'Payment Method', 'Status'],
      ...filteredSales.map(sale => [
        `SALE-${sale.id.slice(0, 8).toUpperCase()}`,
        new Date(sale.created_at || new Date()).toLocaleString(),
        sale.customer_name || 'Walk-in',
        (sale as Sale & { items_count?: number }).items_count || 0,
        formatAmount(sale.total || 0),
        sale.payment_method,
        sale.status
      ])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sales-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  useEffect(() => {
    if (user) {
      fetchSales()
    }
  }, [user])

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-8">
            <h1 className="text-2xl font-bold text-gray-900">Sales Management</h1>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <Clock className="h-4 w-4" />
                <span>{new Date().toLocaleTimeString()}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <TrendingUp className="h-4 w-4" />
                <span className="font-semibold text-green-600">{formatAmount(stats.totalRevenue)} total</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchSales()}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
            >
              <RefreshCw className="h-5 w-5" />
            </button>
            <button
              onClick={handleExportCSV}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </div>
      </header>

      <div className="p-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
              <span className="text-sm text-gray-500">Today</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.todaysSales}</p>
            <p className="text-sm text-gray-600 mt-1">Sales today</p>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
              <span className="text-sm text-gray-500">Revenue</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatAmount(stats.totalRevenue)}</p>
            <p className="text-sm text-gray-600 mt-1">Total revenue</p>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
              <span className="text-sm text-gray-500">Total</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.totalSales}</p>
            <p className="text-sm text-gray-600 mt-1">Total sales</p>
          </div>

          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-orange-600" />
              </div>
              <span className="text-sm text-gray-500">Average</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatAmount(stats.averageOrderValue)}</p>
            <p className="text-sm text-gray-600 mt-1">Avg. order value</p>
          </div>
        </div>

        {/* Filters Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by sale number, customer name or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Quick Filters */}
            <div className="flex gap-2">
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="voided">Voided</option>
              </select>

              <select
                value={paymentMethodFilter}
                onChange={(e) => setPaymentMethodFilter(e.target.value)}
                className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Payments</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="mobile">Mobile</option>
              </select>
            </div>
          </div>
        </div>

        {/* Sales Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sale #
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Items
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payment
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
                      Loading sales...
                    </td>
                  </tr>
                ) : filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                      <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                      No sales found
                    </td>
                  </tr>
                ) : (
                  filteredSales.map((sale) => {
                    const saleNumber = `SALE-${sale.id.slice(0, 8).toUpperCase()}`
                    const itemsCount = (sale as Sale & { items_count?: number }).items_count || 0
                    return (
                      <tr key={sale.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => router.push(`/sales/${sale.id}`)}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-medium text-gray-900 hover:text-blue-600">{saleNumber}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {new Date(sale.created_at || new Date()).toLocaleDateString()}<br />
                        <span className="text-xs text-gray-400">
                          {new Date(sale.created_at || new Date()).toLocaleTimeString()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {sale.customer_name || 'Walk-in Customer'}
                          </p>
                          {sale.customer_phone && (
                            <p className="text-xs text-gray-500">{sale.customer_phone}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm">
                          {itemsCount} items
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-semibold text-gray-900">
                          {formatAmount(sale.total || 0)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="capitalize text-sm text-gray-600">
                          {sale.payment_method}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          sale.status === 'completed' 
                            ? 'bg-green-100 text-green-800'
                            : sale.status === 'voided'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {sale.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="relative">
                          <button
                            onClick={() => setShowActions(showActions === sale.id ? null : sale.id)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <MoreVertical className="h-4 w-4 text-gray-600" />
                          </button>
                          
                          {showActions === sale.id && (
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                              <button
                                onClick={() => {
                                  handleViewReceipt(sale)
                                  setShowActions(null)
                                }}
                                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                              >
                                <Eye className="h-4 w-4" />
                                View Receipt
                              </button>
                              <button
                                onClick={() => {
                                  handleViewReceipt(sale)
                                  setShowActions(null)
                                }}
                                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                              >
                                <Printer className="h-4 w-4" />
                                Print Receipt
                              </button>
                              {sale.status === 'completed' && (
                                <button
                                  onClick={() => handleVoidSale(sale.id)}
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 text-red-600 flex items-center gap-2"
                                >
                                  <X className="h-4 w-4" />
                                  Void Sale
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                    )
                  })
                )}
              </tbody>
            </table>
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