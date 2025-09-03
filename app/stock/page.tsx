'use client'

import { useEffect, useState } from 'react'
import { Database } from '@/lib/database.types'
import { useAuth, useSupabase } from '@/lib/auth/client'
import ProductCode from '@/components/ProductCode'
import Barcode from 'react-barcode'
import { createRoot } from 'react-dom/client'

type StockBatch = Database['public']['Tables']['stock_batches']['Row']
type StockMovement = Database['public']['Tables']['stock_movements']['Row']
type Product = Database['public']['Tables']['products']['Row']

interface StockMovementWithProduct extends StockMovement {
  products?: Product
}

interface SelectedProduct extends Product {
  showCode?: boolean
  codeFormat?: 'barcode' | 'thermal'
}

export default function StockPageClient() {
  const [batches, setBatches] = useState<StockBatch[] | null>(null)
  const [selectedBatch, setSelectedBatch] = useState<StockBatch | null>(null)
  const [movements, setMovements] = useState<StockMovementWithProduct[] | null>(null)
  const [loadingMovements, setLoadingMovements] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<SelectedProduct | null>(null)
  const [defaultCodeFormat, setDefaultCodeFormat] = useState<'barcode' | 'thermal'>('barcode')
  const [batchPrintFormat, setBatchPrintFormat] = useState<'barcode' | 'thermal'>('barcode')
  const { user, loading, error } = useAuth(true) // true = require authentication
  const supabase = useSupabase()

  useEffect(() => {
    if (!user) return

    const fetchBatches = async () => {
      const { data, error } = await supabase
        .from('stock_batches')
        .select('*')
        .eq('type', 'in')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching stock batches:', error.message)
        return
      }

      setBatches(data)
    }

    fetchBatches()
  }, [user, supabase])

  const handleBatchPrint = () => {
    if (!movements || movements.length === 0) return

    const printWindow = window.open('', '', 'width=600,height=400')
    if (!printWindow) return

    // Write the HTML structure first
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Batch Print - ${selectedBatch?.reference || 'Stock Batch'}</title>
          <style>
            * { 
              margin: 0; 
              padding: 0; 
              box-sizing: border-box; 
            }
            body { 
              margin: 0;
              padding: 0;
              font-family: Arial, sans-serif;
            }
            .sticker {
              width: 1.40in;
              height: 0.90in;
              padding: 3px 4px 2px 4px;
              font-family: Arial, sans-serif;
              display: flex;
              flex-direction: column;
              justify-content: flex-start;
              align-items: stretch;
              border: 1px solid #ddd;
              overflow: hidden;
              page-break-inside: avoid;
              break-inside: avoid;
              box-sizing: border-box;
            }
            .gap {
              width: 1.40in;
              height: 0.90in;
              page-break-inside: avoid;
              break-inside: avoid;
            }
            @media print {
              body { 
                margin: 0; 
                padding: 0; 
              }
              @page { 
                margin: 0;
                size: 1.40in 0.90in;
              }
            }
          </style>
        </head>
        <body>
          <div id="root"></div>
        </body>
      </html>
    `)
    printWindow.document.close()

    // Create React component for stickers
    const BatchStickers = () => {
      const stickers: React.ReactElement[] = []
      
      movements.forEach((movement, productIndex) => {
        if (!movement.products) return
        
        const barcodeValue = movement.products.sku || movement.products.id
        
        // Add stickers for the quantity of this product
        for (let i = 0; i < movement.quantity; i++) {
          stickers.push(
            <div key={`${movement.id}-${i}`} className="sticker">
              {/* Top Section: Shop Name and Product */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
              }}>
                <div style={{ 
                  fontSize: '8px', 
                  fontWeight: '600',
                  lineHeight: 1,
                  marginBottom: '1px'
                }}>
                  PRAGPUR FAMILY BAZAR
                </div>
                <div style={{
                  fontSize: '11px',
                  fontWeight: 500,
                  lineHeight: '1',
                  textAlign: 'center',
                  maxWidth: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  marginBottom: '2px'
                }}>
                  {movement.products.name}
                </div>
              </div>
              
              {/* Barcode */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: '1px',
                marginBottom: '1px',
                overflow: 'hidden',
                maxHeight: '35px'
              }}>
                <Barcode
                  value={barcodeValue}
                  width={1.5}
                  height={28}
                  fontSize={10}
                  margin={0}
                  marginTop={0}
                  marginBottom={0}
                  displayValue={true}
                  textMargin={0}
                  background="transparent"
                  lineColor="#000"
                  format="CODE128"
                />
              </div>
              
              {/* Price */}
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                marginTop: '2px'
              }}>
                <div style={{
                  fontSize: '11px',
                  fontWeight: 'bold'
                }}>
                  ৳ {movement.products.price?.toFixed(2) || '0.00'}
                </div>
              </div>
            </div>
          )
        }
        
        // Add blank gap sticker after each product (except the last one)
        if (productIndex < movements.length - 1) {
          stickers.push(
            <div key={`gap-${productIndex}`} className="gap" />
          )
        }
      })
      
      return <>{stickers}</>
    }

    // Render React component in the print window
    const rootElement = printWindow.document.getElementById('root')
    if (rootElement) {
      const root = createRoot(rootElement)
      root.render(<BatchStickers />)
      
      // Auto print after components are rendered
      setTimeout(() => {
        printWindow.focus()
        printWindow.print()
        setTimeout(() => {
          printWindow.close()
        }, 100)
      }, 500)
    }
  }

  const fetchBatchMovements = async (batchId: string) => {
    setLoadingMovements(true)
    try {
      const { data, error } = await supabase
        .from('stock_movements')
        .select(`
          *,
          products (
            id,
            name,
            sku,
            price,
            cost_price
          )
        `)
        .eq('batch_id', batchId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching movements:', error.message)
        return
      }

      setMovements(data)
      const batch = batches?.find(b => b.id === batchId)
      if (batch) setSelectedBatch(batch)
    } finally {
      setLoadingMovements(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4">
        <p>Loading...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4">
        <p className="text-red-500">Error: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold mb-4">Stock Batches</h1>
      <p className="text-sm text-gray-600 mb-4">User: {user?.email}</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h2 className="text-lg font-semibold mb-2">Batches</h2>
          <div className="space-y-2">
            {batches?.map((batch) => (
              <div
                key={batch.id}
                onClick={() => fetchBatchMovements(batch.id)}
                className={`p-3 border rounded cursor-pointer hover:bg-gray-50 ${
                  selectedBatch?.id === batch.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                }`}
              >
                <div className="font-medium">{batch.reference || 'No Reference'}</div>
                <div className="text-sm text-gray-600">
                  {batch.supplier && <span>Supplier: {batch.supplier}</span>}
                </div>
                <div className="text-xs text-gray-500">
                  Items: {batch.total_items} | Qty: {batch.total_quantity} | Value: ${batch.total_value}
                </div>
                <div className="text-xs text-gray-400">
                  {batch.created_at && new Date(batch.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
            {!batches?.length && (
              <p className="text-gray-500">No stock batches found</p>
            )}
          </div>
        </div>
        
        <div>
          <h2 className="text-lg font-semibold mb-2">Movements</h2>
          {loadingMovements ? (
            <p className="text-gray-500">Loading movements...</p>
          ) : selectedBatch ? (
            <div className="space-y-2">
              <div className="p-3 bg-gray-100 rounded mb-3">
                <h3 className="font-medium">Batch: {selectedBatch.reference || 'No Reference'}</h3>
                <p className="text-sm text-gray-600">{selectedBatch.notes || 'No notes'}</p>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={handleBatchPrint}
                    className="px-3 py-1.5 text-sm bg-purple-500 text-white rounded hover:bg-purple-600"
                  >
                    Print All Batch Stickers
                  </button>
                  <select
                    value={batchPrintFormat}
                    onChange={(e) => setBatchPrintFormat(e.target.value as 'barcode' | 'thermal')}
                    className="px-2 py-1 text-sm border border-gray-300 rounded"
                  >
                    <option value="barcode">Barcode (1.40x0.90&quot;)</option>
                    <option value="thermal">QR Code (2x4&quot;)</option>
                  </select>
                </div>
              </div>
              
              {movements?.map((movement) => (
                <div key={movement.id} className="p-3 border border-gray-200 rounded">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-medium">
                        {movement.products?.name || 'Unknown Product'}
                      </div>
                      <div className="text-sm text-gray-600">
                        SKU: {movement.products?.sku || 'N/A'} | Quantity: {movement.quantity}
                      </div>
                      {movement.notes && (
                        <div className="text-xs text-gray-500 mt-1">{movement.notes}</div>
                      )}
                    </div>
                    {movement.products && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => setSelectedProduct(
                            selectedProduct?.id === movement.products?.id 
                              ? null 
                              : { ...movement.products as Product, codeFormat: defaultCodeFormat }
                          )}
                          className="ml-2 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
                        >
                          {selectedProduct?.id === movement.products.id ? 'Hide' : 'Sticker'}
                        </button>
                      </div>
                    )}
                  </div>
                  {selectedProduct?.id === movement.products?.id && selectedProduct && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="flex gap-2 mb-2">
                        <button
                          onClick={() => {
                            setSelectedProduct({ ...selectedProduct, codeFormat: 'barcode' })
                            setDefaultCodeFormat('barcode')
                          }}
                          className={`px-2 py-1 text-xs rounded ${
                            selectedProduct.codeFormat === 'barcode' 
                              ? 'bg-blue-500 text-white' 
                              : 'bg-gray-100 hover:bg-gray-200'
                          }`}
                        >
                          Barcode (1.40x0.90&quot;)
                        </button>
                        <button
                          onClick={() => {
                            setSelectedProduct({ ...selectedProduct, codeFormat: 'thermal' })
                            setDefaultCodeFormat('thermal')
                          }}
                          className={`px-2 py-1 text-xs rounded ${
                            selectedProduct.codeFormat === 'thermal' 
                              ? 'bg-blue-500 text-white' 
                              : 'bg-gray-100 hover:bg-gray-200'
                          }`}
                        >
                          QR Code (2x4&quot;)
                        </button>
                      </div>
                      <ProductCode 
                        product={selectedProduct} 
                        size={selectedProduct.codeFormat || 'barcode'}
                        stockQuantity={movement.quantity}
                      />
                    </div>
                  )}
                </div>
              ))}
              {!movements?.length && (
                <p className="text-gray-500">No movements in this batch</p>
              )}
            </div>
          ) : (
            <p className="text-gray-500">Select a batch to view movements</p>
          )}
        </div>
      </div>
    </div>
  )
}