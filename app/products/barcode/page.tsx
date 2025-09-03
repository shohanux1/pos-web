'use client'

import { useEffect, useState } from 'react'
import { Database } from '@/lib/database.types'
import { useAuth, useSupabase } from '@/lib/auth/client'
import ProductCode from '@/components/ProductCode'

type Product = Database['public']['Tables']['products']['Row']

export default function ProductBarcodePage() {
  const [products, setProducts] = useState<Product[] | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const { user, loading } = useAuth(true)
  const supabase = useSupabase()

  useEffect(() => {
    if (!user) return

    const fetchProducts = async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true })

      if (error) {
        console.error('Error fetching products:', error)
        return
      }

      setProducts(data)
    }

    fetchProducts()
  }, [user, supabase])

  const filteredProducts = products?.filter(product => 
    product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.barcode?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return <div className="p-4">Loading...</div>
  }

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Product Barcodes & QR Codes</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Product List */}
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Search products by name, SKU, or barcode..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          
          <div className="max-h-[600px] overflow-y-auto space-y-2 border rounded-lg p-2">
            {filteredProducts?.map((product) => (
              <div
                key={product.id}
                onClick={() => setSelectedProduct(product)}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedProduct?.id === product.id
                    ? 'bg-blue-50 border-blue-500 border'
                    : 'bg-white hover:bg-gray-50 border border-gray-200'
                }`}
              >
                <div className="font-medium">{product.name}</div>
                <div className="text-sm text-gray-600">
                  SKU: {product.sku || 'N/A'} | Price: ${product.price || 0}
                </div>
                {product.barcode && (
                  <div className="text-xs text-gray-500">
                    Barcode: {product.barcode}
                  </div>
                )}
              </div>
            ))}
            
            {!filteredProducts?.length && (
              <p className="text-gray-500 text-center py-4">No products found</p>
            )}
          </div>
        </div>
        
        {/* Code Display */}
        <div className="bg-gray-50 rounded-lg p-6">
          {selectedProduct ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Generate Codes</h2>
              <ProductCode 
                product={selectedProduct}
                size="thermal"
              />
            </div>
          ) : (
            <div className="text-center text-gray-500 py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              <p>Select a product to generate barcode and QR code</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}