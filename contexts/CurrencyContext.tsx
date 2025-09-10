'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { useSupabase } from '@/lib/auth/client'
import { useAuth } from '@/lib/auth/client'

export interface Currency {
  code: string
  symbol: string
  name: string
  position: 'before' | 'after'
}

// Popular currencies
export const CURRENCIES: Currency[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar', position: 'before' },
  { code: 'EUR', symbol: '€', name: 'Euro', position: 'before' },
  { code: 'GBP', symbol: '£', name: 'British Pound', position: 'before' },
  { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka', position: 'before' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', position: 'before' },
  { code: 'PKR', symbol: 'Rs', name: 'Pakistani Rupee', position: 'before' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', position: 'before' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', position: 'before' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham', position: 'before' },
  { code: 'SAR', symbol: 'ر.س', name: 'Saudi Riyal', position: 'before' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', position: 'before' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', position: 'before' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', position: 'before' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit', position: 'before' },
  { code: 'THB', symbol: '฿', name: 'Thai Baht', position: 'before' },
  { code: 'PHP', symbol: '₱', name: 'Philippine Peso', position: 'before' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah', position: 'before' },
  { code: 'VND', symbol: '₫', name: 'Vietnamese Dong', position: 'after' },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won', position: 'before' },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira', position: 'before' },
  { code: 'RUB', symbol: '₽', name: 'Russian Ruble', position: 'before' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand', position: 'before' },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira', position: 'before' },
  { code: 'EGP', symbol: 'E£', name: 'Egyptian Pound', position: 'before' },
]

interface CurrencyContextType {
  currency: Currency
  setCurrency: (currency: Currency) => Promise<void>
  formatAmount: (amount: number) => string
  isLoading: boolean
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined)

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>(CURRENCIES[0]) // Default USD
  const [isLoading, setIsLoading] = useState(false)
  const supabase = useSupabase()
  const { user } = useAuth()

  // Load currency preference
  useEffect(() => {
    loadCurrencyPreference()
  }, [user])

  const loadCurrencyPreference = async () => {
    try {
      setIsLoading(true)
      
      // Try to get from localStorage first
      const savedCurrency = localStorage.getItem('currency_preference')
      if (savedCurrency) {
        const parsed = JSON.parse(savedCurrency)
        const foundCurrency = CURRENCIES.find(c => c.code === parsed.code)
        if (foundCurrency) {
          setCurrencyState(foundCurrency)
        }
      }
      
      // If user is logged in, try to get from profile
      if (user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('currency, currency_symbol')
          .eq('id', user.id)
          .single()

        if (!error && data && data.currency) {
          const foundCurrency = CURRENCIES.find(c => c.code === data.currency)
          if (foundCurrency) {
            setCurrencyState(foundCurrency)
            // Save to localStorage
            localStorage.setItem('currency_preference', JSON.stringify(foundCurrency))
          }
        }
      }
    } catch (error) {
      console.error('Error loading currency preference:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const setCurrency = async (newCurrency: Currency): Promise<void> => {
    try {
      setCurrencyState(newCurrency)
      
      // Save to localStorage
      localStorage.setItem('currency_preference', JSON.stringify(newCurrency))
      
      // If user is logged in, save to profile
      if (user) {
        await supabase
          .from('profiles')
          .update({
            currency: newCurrency.code,
            currency_symbol: newCurrency.symbol,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id)
      }
    } catch (error) {
      console.error('Error saving currency preference:', error)
    }
  }

  const formatAmount = (amount: number): string => {
    const formattedNumber = amount.toFixed(2)
    
    if (currency.position === 'before') {
      return `${currency.symbol}${formattedNumber}`
    } else {
      return `${formattedNumber}${currency.symbol}`
    }
  }

  const value: CurrencyContextType = {
    currency,
    setCurrency,
    formatAmount,
    isLoading,
  }

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrency() {
  const context = useContext(CurrencyContext)
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider')
  }
  return context
}