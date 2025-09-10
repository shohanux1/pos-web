'use client'

import React from 'react'
import { Database } from '@/lib/database.types'
import { useCurrency } from '@/contexts/CurrencyContext'

type Product = Database['public']['Tables']['products']['Row'] & {
  categories?: Database['public']['Tables']['categories']['Row'] | null
}

interface ProductCardProps {
  product: Product
  onAddToCart: (product: Product) => void
  viewMode?: 'grid' | 'list'
}

export default function ProductCard({ product, onAddToCart, viewMode = 'grid' }: ProductCardProps) {
  const { formatAmount } = useCurrency()
  const isOutOfStock = product.stock_quantity === 0
  const isLowStock = product.stock_quantity < 20

  if (viewMode === 'list') {
    return (
      <button
        onClick={() => onAddToCart(product)}
        disabled={isOutOfStock}
        className={`w-full bg-white border border-gray-200 rounded-xl p-4 transition-all flex items-center gap-4 ${
          isOutOfStock 
            ? 'opacity-50 cursor-not-allowed' 
            : 'hover:border-gray-300 hover:shadow-md'
        }`}
      >
        <span className="text-2xl flex-shrink-0">📦</span>
        <div className="flex-1 text-left min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{product.name}</h3>
          <p className="text-sm text-gray-500 truncate">
            {product.sku} • {product.categories?.name || 'Uncategorized'}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-lg font-bold text-gray-900">{formatAmount(product.price)}</p>
          <p className={`text-xs ${isLowStock ? 'text-red-600' : 'text-green-600'}`}>
            {product.stock_quantity} in stock
          </p>
        </div>
      </button>
    )
  }

  // Grid view
  return (
    <button
      onClick={() => onAddToCart(product)}
      disabled={isOutOfStock}
      className={`bg-white border border-gray-200 rounded-2xl p-5 transition-all group flex flex-col h-full min-h-[220px] ${
        isOutOfStock 
          ? 'opacity-50 cursor-not-allowed' 
          : 'hover:border-gray-300 hover:shadow-lg'
      }`}
    >
      <div className="text-4xl mb-4">📦</div>
      <div className="flex-1 flex flex-col">
        <h3 className="font-semibold text-gray-900 text-sm mb-1 text-left line-clamp-2 min-h-[40px]">
          {product.name}
        </h3>
        <p className="text-xs text-gray-500 mb-3 text-left truncate">{product.sku}</p>
      </div>
      <div className="flex justify-between items-end gap-2">
        <span className="text-lg font-bold text-gray-900 truncate">
          {formatAmount(product.price)}
        </span>
        <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0 ${
          isLowStock ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
        }`}>
          {product.stock_quantity} left
        </span>
      </div>
    </button>
  )
}