'use client'

import React, { useState } from 'react'
import { X, Printer, CheckCircle, Phone, MapPin, Store } from 'lucide-react'
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
  const [isPrinting, setIsPrinting] = useState(false)

  if (!isOpen || !receiptData) return null

  const handlePrint = () => {
    // Prevent double printing
    if (isPrinting) return
    
    setIsPrinting(true)
    
    // Small delay to ensure state is set before printing
    setTimeout(() => {
      window.print()
      // Reset after print dialog closes
      setTimeout(() => {
        setIsPrinting(false)
      }, 1000)
    }, 100)
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
    <div className="receipt-modal-wrapper fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 print:bg-white print:inset-auto print:static print:block print:h-auto">
      <div className="receipt-modal-content bg-white rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col print:max-w-full print:max-h-none print:rounded-none print:h-auto print:overflow-visible">
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
        <div className="flex-1 overflow-y-auto p-6 print:p-0 print:overflow-visible print:flex-none">
          <div className="receipt-content max-w-sm mx-auto print:max-w-none">
            {/* Business Header */}
            <div className="text-center mb-4 pb-4 border-b-2 border-dashed border-gray-300 print:border-gray-800">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Store className="h-6 w-6 text-gray-700 print:text-gray-900" />
                <h3 className="text-xl font-bold text-gray-900 uppercase tracking-wide print:font-black print:text-black">
                  {receiptData.businessName || 'Pragpur Family Bazar'}
                </h3>
              </div>
              {receiptData.businessAddress && (
                <div className="flex items-center justify-center gap-1 text-xs text-gray-600 mb-1 print:text-gray-800 print:font-semibold">
                  <MapPin className="h-3 w-3" />
                  <p>{receiptData.businessAddress}</p>
                </div>
              )}
              {receiptData.businessPhone && (
                <div className="flex items-center justify-center gap-1 text-xs text-gray-600 print:text-gray-800 print:font-semibold">
                  <Phone className="h-3 w-3" />
                  <p>Phone: {receiptData.businessPhone}</p>
                </div>
              )}
            </div>

            {/* Receipt Info */}
            <div className="mb-4 pb-3 border-b-2 border-gray-200 print:border-gray-400">
              <div className="grid grid-cols-2 gap-y-1 text-xs">
                <div>
                  <span className="text-gray-600 print:text-gray-700 print:font-semibold">Invoice No:</span>
                  <p className="font-semibold text-gray-900 print:font-bold print:text-black">#{receiptData.sale.id.slice(0, 8).toUpperCase()}</p>
                </div>
                <div className="text-right">
                  <span className="text-gray-600 print:text-gray-700 print:font-semibold">Date & Time:</span>
                  <p className="font-semibold text-gray-900 print:font-bold print:text-black">{formatDate(receiptData.sale.created_at)}</p>
                  <p className="text-gray-600 print:text-gray-800 print:font-semibold">{formatTime(receiptData.sale.created_at)}</p>
                </div>
              </div>
              {receiptData.sale.customer_name && receiptData.sale.customer_name !== 'Walk-in Customer' && (
                <div className="mt-2 pt-2 border-t border-gray-200 print:border-gray-300">
                  <span className="text-xs text-gray-600 print:text-gray-700 print:font-semibold">Customer:</span>
                  <p className="text-sm font-semibold text-gray-900 print:font-bold print:text-black">{receiptData.sale.customer_name}</p>
                  {receiptData.sale.customer_phone && (
                    <p className="text-xs text-gray-600 print:text-gray-800 print:font-semibold">{receiptData.sale.customer_phone}</p>
                  )}
                </div>
              )}
            </div>

            {/* Items */}
            <div className="mb-3">
              <div className="border-b-2 border-gray-900 pb-1 mb-2 print:border-black">
                <div className="grid grid-cols-12 text-xs font-semibold text-gray-900 print:font-bold print:text-black">
                  <div className="col-span-5">Item</div>
                  <div className="col-span-2 text-center">Qty</div>
                  <div className="col-span-2 text-right">Rate</div>
                  <div className="col-span-3 text-right">Amount</div>
                </div>
              </div>
              <div className="space-y-1">
                {receiptData.items.map((item, index) => (
                  <div key={index} className="grid grid-cols-12 text-xs">
                    <div className="col-span-5">
                      <p className="font-semibold text-gray-900 truncate pr-2 print:font-bold print:text-black">{item.product.name}</p>
                      {item.product.sku && (
                        <p className="text-gray-500 text-xs print:text-gray-700 print:font-semibold">{item.product.sku}</p>
                      )}
                    </div>
                    <div className="col-span-2 text-center font-semibold text-gray-900 print:font-bold print:text-black">{item.quantity}</div>
                    <div className="col-span-2 text-right text-gray-700 pr-2 print:text-gray-900 print:font-semibold">{formatAmount(item.price)}</div>
                    <div className="col-span-3 text-right font-semibold text-gray-900 print:font-bold print:text-black">{formatAmount(item.total)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="border-t-2 border-dashed border-gray-300 pt-2 mb-3 print:border-gray-800">
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600 font-semibold print:text-gray-800 print:font-bold">Subtotal:</span>
                  <span className="font-semibold text-gray-900 print:font-bold print:text-black">{formatAmount(receiptData.sale.subtotal)}</span>
                </div>
                {receiptData.sale.tax && receiptData.sale.tax > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600 font-semibold print:text-gray-800 print:font-bold">Tax:</span>
                    <span className="font-semibold text-gray-900 print:font-bold print:text-black">{formatAmount(receiptData.sale.tax)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold pt-1 border-t-2 border-gray-900 print:font-black print:border-black">
                  <span>TOTAL:</span>
                  <span className="text-lg">{formatAmount(receiptData.sale.total)}</span>
                </div>
              </div>
            </div>

            {/* Payment Info */}
            <div className="border-t-2 border-gray-200 pt-2 mb-4 print:border-gray-400">
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600 font-semibold print:text-gray-800 print:font-bold">Payment:</span>
                  <span className="font-semibold text-gray-900 capitalize print:font-bold print:text-black">{receiptData.sale.payment_method || 'Cash'}</span>
                </div>
                {receiptData.sale.received_amount && (
                  <>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600 font-semibold print:text-gray-800 print:font-bold">Received:</span>
                      <span className="font-semibold text-gray-900 print:font-bold print:text-black">{formatAmount(receiptData.sale.received_amount)}</span>
                    </div>
                    {receiptData.sale.change_amount !== null && receiptData.sale.change_amount > 0 && (
                      <div className="flex justify-between text-sm font-bold print:font-black">
                        <span>Change:</span>
                        <span>{formatAmount(receiptData.sale.change_amount)}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t-2 border-dashed border-gray-300 pt-3 text-center print:border-gray-800">
              <p className="text-xs font-bold text-gray-900 mb-1 print:font-black print:text-black">*** Thank You ***</p>
              <p className="text-xs font-semibold text-gray-700 print:font-bold print:text-gray-800">Visit Again!</p>
              <p className="text-xs text-gray-500 mt-3 print:font-semibold print:text-gray-600">Powered by Swift Pos</p>
            </div>
          </div>
        </div>

        {/* Action Buttons - Hidden when printing */}
        <div className="p-6 border-t border-gray-200 print:hidden">
          <div className="flex gap-3">
            <button
              onClick={handlePrint}
              disabled={isPrinting}
              className="flex-1 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Printer className="h-5 w-5" />
              {isPrinting ? 'Printing...' : 'Print Receipt'}
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