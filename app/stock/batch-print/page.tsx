'use client'

import React, { useEffect, useState, ReactElement, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Barcode from 'react-barcode'

interface ProductSticker {
  id: string
  name: string
  price: number
  sku: string
  quantity: number
}

function BatchPrintContent() {
  const searchParams = useSearchParams()
  const [products, setProducts] = useState<ProductSticker[]>([])
  const shopName = 'প্রাগপুর ফ্যামিলি বাজার'

  useEffect(() => {
    const productsParam = searchParams.get('products')
    if (productsParam) {
      try {
        const parsedProducts = JSON.parse(decodeURIComponent(productsParam))
        setProducts(parsedProducts)
        // Auto print after loading
        setTimeout(() => {
          window.print()
        }, 500)
      } catch (e) {
        console.error('Failed to parse products:', e)
      }
    }
  }, [searchParams])

  const renderStickers = () => {
    const stickers: ReactElement[] = []
    
    products.forEach((product, productIndex) => {
      // Add stickers for each product quantity
      for (let i = 0; i < product.quantity; i++) {
        stickers.push(
          <div
            key={`${product.id}-${i}`}
            className="barcode-sticker-print"
            style={{
              width: '1.40in',
              height: '0.90in',
              padding: '2px',
              fontFamily: 'Arial, sans-serif',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              border: '1px solid #ddd',
              overflow: 'hidden',
              pageBreakInside: 'avoid',
              breakInside: 'avoid'
            }}
          >
            <div style={{ fontSize: '9px', lineHeight: 1, marginBottom: '1px' }}>
              {shopName}
            </div>
            <div style={{
              fontSize: '10px',
              fontWeight: 500,
              lineHeight: 1.1,
              textAlign: 'center',
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginBottom: '1px'
            }}>
              {product.name}
            </div>
            <div style={{
              fontSize: '10px',
              fontWeight: 'bold',
              marginBottom: '2px'
            }}>
              ৳ {product.price.toFixed(2)}
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Barcode
                value={product.sku}
                width={1.2}
                height={22}
                fontSize={8}
                margin={0}
                displayValue={true}
                background="transparent"
                lineColor="#000"
              />
            </div>
          </div>
        )
      }
      
      // Add blank gap sticker after each product (except the last one)
      if (productIndex < products.length - 1) {
        stickers.push(
          <div
            key={`gap-${productIndex}`}
            style={{
              width: '1.40in',
              height: '0.90in',
              pageBreakInside: 'avoid',
              breakInside: 'avoid'
            }}
          />
        )
      }
    })
    
    return stickers
  }

  return (
    <>
      <style jsx global>{`
        @media print {
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            margin: 0;
            padding: 0;
          }
          @page { 
            margin: 0;
            size: 1.40in 0.90in;
          }
          .no-print { display: none !important; }
        }
      `}</style>
      
      <div className="no-print p-4">
        <h1 className="text-xl font-bold mb-2">Batch Print Preview</h1>
        <p className="text-sm text-gray-600 mb-4">
          Total stickers: {products.reduce((sum, p) => sum + p.quantity, 0)} 
          (with {products.length - 1} gap{products.length > 2 ? 's' : ''})
        </p>
        <button 
          onClick={() => window.print()} 
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          Print All Stickers
        </button>
      </div>
      
      <div className="print-area">
        {renderStickers()}
      </div>
    </>
  )
}

export default function BatchPrintPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <BatchPrintContent />
    </Suspense>
  )
}