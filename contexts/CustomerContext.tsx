'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Database } from '@/lib/database.types'
import { useSupabase } from '@/lib/auth/client'
import { useAuth } from '@/lib/auth/client'

type Customer = Database['public']['Tables']['customers']['Row']

interface CustomerContextType {
  customers: Customer[]
  loading: boolean
  error: string | null
  selectedCustomer: Customer | null
  
  // Actions
  fetchCustomers: () => Promise<void>
  selectCustomer: (customer: Customer | null) => void
  createCustomer: (data: Partial<Customer>) => Promise<Customer | null>
  updateCustomer: (id: string, data: Partial<Customer>) => Promise<boolean>
  searchCustomers: (query: string) => Promise<Customer[]>
  getCustomerByPhone: (phone: string) => Promise<Customer | null>
}

const CustomerContext = createContext<CustomerContextType | undefined>(undefined)

// Default walk-in customer
export const WALK_IN_CUSTOMER: Customer = {
  id: 'walk-in',
  name: 'Walk-in Customer',
  phone: '',
  email: null,
  address: null,
  notes: null,
  total_purchases: 0,
  total_spent: 0,
  loyalty_points: 0,
  loyalty_enabled: false,
  email_updates: false,
  sms_notifications: false,
  status: 'active',
  user_id: '',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

export function CustomerProvider({ children }: { children: ReactNode }) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(WALK_IN_CUSTOMER)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = useSupabase()
  const { user } = useAuth()

  // Fetch all customers
  const fetchCustomers = async () => {
    if (!user) return
    
    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      setCustomers(data || [])
    } catch (err) {
      console.error('Error fetching customers:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch customers')
    } finally {
      setLoading(false)
    }
  }

  // Select a customer
  const selectCustomer = (customer: Customer | null) => {
    setSelectedCustomer(customer || WALK_IN_CUSTOMER)
  }

  // Create new customer
  const createCustomer = async (data: Partial<Customer>): Promise<Customer | null> => {
    if (!user) return null
    
    try {
      const { data: newCustomer, error } = await supabase
        .from('customers')
        .insert({
          ...data,
          user_id: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (error) throw error

      setCustomers(prev => [newCustomer, ...prev])
      return newCustomer
    } catch (err) {
      console.error('Error creating customer:', err)
      return null
    }
  }

  // Update customer
  const updateCustomer = async (id: string, data: Partial<Customer>): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('customers')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (error) throw error

      setCustomers(prev => 
        prev.map(c => c.id === id ? { ...c, ...data } : c)
      )
      
      if (selectedCustomer?.id === id) {
        setSelectedCustomer({ ...selectedCustomer, ...data })
      }
      
      return true
    } catch (err) {
      console.error('Error updating customer:', err)
      return false
    }
  }

  // Search customers
  const searchCustomers = async (query: string): Promise<Customer[]> => {
    if (!user) return []
    
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', user.id)
        .or(`name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`)
        .order('name')

      if (error) throw error

      return data || []
    } catch (err) {
      console.error('Error searching customers:', err)
      return []
    }
  }

  // Get customer by phone
  const getCustomerByPhone = async (phone: string): Promise<Customer | null> => {
    if (!user) return null
    
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', user.id)
        .eq('phone', phone)
        .single()

      if (error) throw error

      return data
    } catch (err) {
      console.error('Error fetching customer by phone:', err)
      return null
    }
  }

  // Load customers on mount
  useEffect(() => {
    if (user) {
      fetchCustomers()
    }
  }, [user])

  const value: CustomerContextType = {
    customers,
    loading,
    error,
    selectedCustomer,
    fetchCustomers,
    selectCustomer,
    createCustomer,
    updateCustomer,
    searchCustomers,
    getCustomerByPhone,
  }

  return (
    <CustomerContext.Provider value={value}>
      {children}
    </CustomerContext.Provider>
  )
}

export function useCustomers() {
  const context = useContext(CustomerContext)
  if (context === undefined) {
    throw new Error('useCustomers must be used within a CustomerProvider')
  }
  return context
}