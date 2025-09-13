'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Download, Eye, Printer, RefreshCw, TrendingUp, Package, Users, DollarSign, Clock, MoreVertical, X, Calendar, CalendarDays, CheckCircle, XCircle, CreditCard, Banknote, Smartphone } from 'lucide-react'
import { useSales } from '@/hooks/useSales'
import { useAuth } from '@/lib/auth/client'
import { useCurrency } from '@/contexts/CurrencyContext'
import { Database } from '@/lib/database.types'
import ReceiptModal from '@/components/ReceiptModal'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import Select, { SelectOption } from '@/components/ui/Select'

type Sale = Database['public']['Tables']['sales']['Row']

export default function SalesPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth(true)
  const { 
    sales, 
    loading, 
    fetchSales, 
    getSaleDetails, 
    voidSale,
    totalProfit,
    todayProfit,
    fetchTotalProfit,
    calculateProfit
  } = useSales()
  const { formatAmount } = useCurrency()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFilter, setDateFilter] = useState('today')
  const [statusFilter, setStatusFilter] = useState('all')
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all')
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [customProfit, setCustomProfit] = useState(0)
  
  // Select options
  const dateOptions: SelectOption[] = [
    { value: 'all', label: 'All Time', icon: <Clock className="h-4 w-4 text-gray-500" /> },
    { value: 'today', label: 'Today', icon: <Calendar className="h-4 w-4 text-blue-500" /> },
    { value: 'week', label: 'This Week', icon: <CalendarDays className="h-4 w-4 text-purple-500" /> },
    { value: 'month', label: 'This Month', icon: <CalendarDays className="h-4 w-4 text-orange-500" /> },
    { value: 'custom', label: 'Custom Range', icon: <Calendar className="h-4 w-4 text-green-500" /> }
  ]
  
  const statusOptions: SelectOption[] = [
    { value: 'all', label: 'All Status' },
    { value: 'completed', label: 'Completed', icon: <CheckCircle className="h-4 w-4 text-green-500" /> },
    { value: 'pending', label: 'Pending', icon: <Clock className="h-4 w-4 text-yellow-500" /> },
    { value: 'cancelled', label: 'Cancelled', icon: <XCircle className="h-4 w-4 text-red-500" /> }
  ]
  
  const paymentOptions: SelectOption[] = [
    { value: 'all', label: 'All Payments' },
    { value: 'cash', label: 'Cash', icon: <Banknote className="h-4 w-4 text-green-500" /> },
    { value: 'card', label: 'Card', icon: <CreditCard className="h-4 w-4 text-blue-500" /> },
    { value: 'mobile', label: 'Mobile', icon: <Smartphone className="h-4 w-4 text-purple-500" /> }
  ]
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

  // Calculate statistics (only for completed sales, excluding cancelled/voided/refunded)
  const completedSales = sales.filter(sale => sale.status === 'completed')
  const todaysCompletedSales = completedSales.filter(sale => {
    const saleDate = new Date(sale.created_at || new Date())
    const today = new Date()
    return saleDate.toDateString() === today.toDateString()
  })
  
  const stats = {
    totalSales: completedSales.length,
    totalRevenue: completedSales.reduce((sum, sale) => sum + (sale.total || 0), 0),
    totalProfit: dateFilter === 'custom' ? customProfit : totalProfit,
    todaysSales: todaysCompletedSales.length,
    todaysRevenue: todaysCompletedSales.reduce((sum, sale) => sum + (sale.total || 0), 0),
    todaysProfit: todayProfit
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
    } else if (dateFilter === 'custom' && startDate && endDate) {
      const endDatePlusOne = new Date(endDate)
      endDatePlusOne.setHours(23, 59, 59, 999)
      if (saleDate < startDate || saleDate > endDatePlusOne) return false
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
        businessName: 'Pragpur Family Bazar',
        businessAddress: 'Pragpur, Char-Pragpur, Daulotpur',
        businessPhone: '01740486802',
        businessEmail: ''
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
      fetchTotalProfit()
    }
  }, [user])
  
  // Handle custom date range selection for profit calculation
  useEffect(() => {
    if (dateFilter === 'custom' && startDate && endDate) {
      const fetchCustomProfit = async () => {
        const endDatePlusOne = new Date(endDate)
        endDatePlusOne.setDate(endDatePlusOne.getDate() + 1)
        const result = await calculateProfit(startDate, endDatePlusOne)
        setCustomProfit(result.totalProfit)
      }
      fetchCustomProfit()
    }
  }, [startDate, endDate, dateFilter, calculateProfit])

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
              <span className="text-sm text-gray-500">Profit</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatAmount(stats.totalProfit)}</p>
            <p className="text-sm text-gray-600 mt-1">{dateFilter === 'today' ? "Today's profit" : "Total profit"}</p>
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
            <div className="flex gap-2 flex-wrap">
              <Select
                options={dateOptions}
                value={dateFilter}
                onChange={(value) => {
                  setDateFilter(value)
                  if (value === 'custom') {
                    setShowDatePicker(true)
                  }
                }}
                placeholder="Select period"
                className="min-w-[180px]"
              />
              
              {dateFilter === 'custom' && (
                <div className="relative">
                  <button
                    onClick={() => setShowDatePicker(!showDatePicker)}
                    className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center gap-2"
                  >
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">
                      {startDate && endDate 
                        ? `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
                        : 'Select dates'}
                    </span>
                  </button>
                  {showDatePicker && (
                    <div className="absolute top-full mt-2 z-50 bg-white rounded-xl shadow-lg border border-gray-200 p-4">
                      <div className="flex gap-2">
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">Start Date</label>
                          <DatePicker
                            selected={startDate}
                            onChange={(date: Date | null) => setStartDate(date)}
                            selectsStart
                            startDate={startDate}
                            endDate={endDate}
                            maxDate={new Date()}
                            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                            placeholderText="Start date"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">End Date</label>
                          <DatePicker
                            selected={endDate}
                            onChange={(date: Date | null) => setEndDate(date)}
                            selectsEnd
                            startDate={startDate}
                            endDate={endDate}
                            minDate={startDate || undefined}
                            maxDate={new Date()}
                            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                            placeholderText="End date"
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => setShowDatePicker(false)}
                        className="mt-3 w-full px-3 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800"
                      >
                        Apply
                      </button>
                    </div>
                  )}
                </div>
              )}

              <Select
                options={statusOptions}
                value={statusFilter}
                onChange={setStatusFilter}
                placeholder="Select status"
                className="min-w-[160px]"
              />

              <Select
                options={paymentOptions}
                value={paymentMethodFilter}
                onChange={setPaymentMethodFilter}
                placeholder="Payment method"
                className="min-w-[170px]"
              />
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
                            onClick={(e) => {
                              e.stopPropagation()
                              setShowActions(showActions === sale.id ? null : sale.id)
                            }}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <MoreVertical className="h-4 w-4 text-gray-600" />
                          </button>
                          
                          {showActions === sale.id && (
                            <div 
                              className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10"
                              onClick={(e) => e.stopPropagation()}>
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