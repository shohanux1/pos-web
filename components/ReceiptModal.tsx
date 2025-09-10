'use client'

import React from 'react'
import { X, Printer, CheckCircle } from 'lucide-react'
import { useCurrency } from '@/contexts/CurrencyContext'
import { Database } from '@/lib/database.types'

type Sale = Database['public']['Tables']['sales']['Row']
type Product = Database['public']['Tables']['products']['Row']

interface ReceiptData {
  sale: Sale
  items: Array<{
    product: Product
    quantity: number
    price: number
    total: number
  }>
  businessName?: string
  businessAddress?: string
  businessPhone?: string
  businessEmail?: string
}

interface ReceiptModalProps {
  isOpen: boolean
  onClose: () => void
  receiptData: ReceiptData | null
}

export default function ReceiptModal({ isOpen, onClose, receiptData }: ReceiptModalProps) {
  const { formatAmount } = useCurrency()

  if (!isOpen || !receiptData) return null

  const handlePrint = () => {
    window.print()
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return new Date().toLocaleDateString()
    return new Date(dateString).toLocaleDateString()
  }

  const formatTime = (dateString: string | null) => {
    if (!dateString) return new Date().toLocaleTimeString()
    return new Date(dateString).toLocaleTimeString()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 print:bg-white">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col print:max-w-full print:max-h-full print:rounded-none">
        {/* Modal Header - Hidden when printing */}
        <div className="p-6 border-b border-gray-200 print:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Payment Successful</h2>
                <p className="text-sm text-gray-500">Transaction completed</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Receipt Content */}
        <div className="flex-1 overflow-y-auto p-6 print:p-8">
          <div className="receipt-content">
            {/* Business Header */}
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-1">
                {receiptData.businessName || 'My Store'}
              </h3>
              <p className="text-sm text-gray-600">
                {receiptData.businessAddress || '123 Main Street, City'}
              </p>
              <p className="text-sm text-gray-600">
                {receiptData.businessPhone || 'Tel: +1 234 567 8900'}
              </p>
            </div>

            {/* Receipt Info */}
            <div className="border-t border-b border-gray-200 py-3 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Receipt #</span>
                <span className="font-medium">{receiptData.sale.id.slice(0, 8).toUpperCase()}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-gray-600">Date</span>
                <span>{formatDate(receiptData.sale.created_at)}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-gray-600">Time</span>
                <span>{formatTime(receiptData.sale.created_at)}</span>
              </div>
              {receiptData.sale.customer_name && (
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-gray-600">Customer</span>
                  <span>{receiptData.sale.customer_name}</span>
                </div>
              )}
            </div>

            {/* Items */}
            <div className="mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 text-gray-600 font-medium">Item</th>
                    <th className="text-center py-2 text-gray-600 font-medium">Qty</th>
                    <th className="text-right py-2 text-gray-600 font-medium">Price</th>
                    <th className="text-right py-2 text-gray-600 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {receiptData.items.map((item, index) => (
                    <tr key={index} className="border-b border-gray-100">
                      <td className="py-2 text-gray-900">{item.product.name}</td>
                      <td className="text-center py-2">{item.quantity}</td>
                      <td className="text-right py-2">{formatAmount(item.price)}</td>
                      <td className="text-right py-2 font-medium">{formatAmount(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="border-t border-gray-200 pt-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span>{formatAmount(receiptData.sale.subtotal)}</span>
              </div>
              {receiptData.sale.tax && receiptData.sale.tax > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tax</span>
                  <span>{formatAmount(receiptData.sale.tax)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base pt-2 border-t border-gray-200">
                <span>Total</span>
                <span>{formatAmount(receiptData.sale.total)}</span>
              </div>
            </div>

            {/* Payment Info */}
            <div className="mt-4 pt-3 border-t border-gray-200 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Payment Method</span>
                <span className="capitalize">{receiptData.sale.payment_method || 'Cash'}</span>
              </div>
              {receiptData.sale.received_amount && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Received</span>
                    <span>{formatAmount(receiptData.sale.received_amount)}</span>
                  </div>
                  {receiptData.sale.change_amount !== null && receiptData.sale.change_amount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Change</span>
                      <span>{formatAmount(receiptData.sale.change_amount)}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="mt-6 pt-4 border-t border-gray-200 text-center">
              <p className="text-sm text-gray-600">Thank you for your purchase!</p>
              <p className="text-xs text-gray-500 mt-1">Please keep this receipt for your records</p>
            </div>
          </div>
        </div>

        {/* Action Buttons - Hidden when printing */}
        <div className="p-6 border-t border-gray-200 print:hidden">
          <div className="flex gap-3">
            <button
              onClick={handlePrint}
              className="flex-1 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
            >
              <Printer className="h-5 w-5" />
              Print Receipt
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}