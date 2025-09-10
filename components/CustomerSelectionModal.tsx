'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Search, X, User, UserPlus } from 'lucide-react'
import { Database } from '@/lib/database.types'
import { WALK_IN_CUSTOMER } from '@/contexts/CustomerContext'

type Customer = Database['public']['Tables']['customers']['Row']

interface CustomerSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  customers: Customer[]
  selectedCustomer: Customer | null
  onSelectCustomer: (customer: Customer) => void
  onSearchCustomers: (query: string) => Promise<Customer[]>
}

export default function CustomerSelectionModal({
  isOpen,
  onClose,
  customers,
  selectedCustomer,
  onSelectCustomer,
  onSearchCustomers
}: CustomerSelectionModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchedCustomers, setSearchedCustomers] = useState(customers)
  const modalRef = useRef<HTMLDivElement>(null)

  // Update searched customers when customers prop changes
  useEffect(() => {
    setSearchedCustomers(customers)
  }, [customers])

  // Search customers
  useEffect(() => {
    const searchForCustomers = async () => {
      if (searchQuery) {
        const results = await onSearchCustomers(searchQuery)
        setSearchedCustomers(results)
      } else {
        setSearchedCustomers(customers)
      }
    }

    searchForCustomers()
  }, [searchQuery, customers, onSearchCustomers])

  const handleClose = useCallback(() => {
    setSearchQuery('')
    onClose()
  }, [onClose])

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        handleClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, handleClose])

  const handleSelectCustomer = (customer: Customer) => {
    onSelectCustomer(customer)
    handleClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div ref={modalRef} className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col">
        {/* Modal Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Select Customer</h2>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, phone, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>
        </div>

        {/* Customer List */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Walk-in Customer Option */}
          <button
            onClick={() => handleSelectCustomer(WALK_IN_CUSTOMER)}
            className={`w-full p-4 rounded-xl mb-2 text-left transition-colors ${
              selectedCustomer?.id === 'walk-in'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-50 hover:bg-gray-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
                <User className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="font-medium">Walk-in Customer</p>
                <p className={`text-sm ${
                  selectedCustomer?.id === 'walk-in' ? 'text-gray-300' : 'text-gray-500'
                }`}>
                  Guest checkout
                </p>
              </div>
            </div>
          </button>

          {/* Customer List */}
          {searchedCustomers.map(customer => (
            <button
              key={customer.id}
              onClick={() => handleSelectCustomer(customer)}
              className={`w-full p-4 rounded-xl mb-2 text-left transition-colors ${
                selectedCustomer?.id === customer.id
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-50 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
                  <User className="h-5 w-5 text-gray-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{customer.name}</p>
                  <div className="flex items-center gap-3">
                    <p className={`text-sm ${
                      selectedCustomer?.id === customer.id ? 'text-gray-300' : 'text-gray-500'
                    }`}>
                      {customer.phone}
                    </p>
                    {customer.loyalty_points && customer.loyalty_points > 0 && (
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        selectedCustomer?.id === customer.id
                          ? 'bg-gray-700 text-gray-300'
                          : 'bg-green-100 text-green-600'
                      }`}>
                        {customer.loyalty_points} pts
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}

          {/* No Results */}
          {searchedCustomers.length === 0 && searchQuery && (
            <div className="text-center py-8 text-gray-500">
              <p className="mb-2">No customers found</p>
              <button className="text-blue-600 hover:underline flex items-center gap-2 mx-auto">
                <UserPlus className="h-4 w-4" />
                Add new customer
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-gray-200">
          <button className="w-full py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors flex items-center justify-center gap-2">
            <UserPlus className="h-5 w-5" />
            Add New Customer
          </button>
        </div>
      </div>
    </div>
  )
}