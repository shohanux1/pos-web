'use client'

import React, { useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import Barcode from 'react-barcode'
import html2canvas from 'html2canvas'

interface ProductCodeProps {
  product: {
    id: string
    name: string
    sku?: string | null
    price?: number | null
    barcode?: string | null
  }
  size?: 'barcode' | 'thermal' | 'small' | 'medium' | 'large'
  storeName?: string
  stockQuantity?: number // Incoming stock quantity for default copies
}

// 2x4 inch = 50.8mm x 101.6mm = 192px x 384px at 96 DPI
// For thermal printer at 203 DPI
// 1.40x0.90 inch = 35.56mm x 22.86mm = 134px x 86px at 96 DPI
const sizeConfig = {
  barcode: { width: '134px', height: '86px' }, // 1.40 x 0.90 inch label
  thermal: { qr: 60, width: '192px', height: '384px' }, // 2x4 inch label at 96 DPI
  small: { qr: 100, width: '200px', height: 'auto' },
  medium: { qr: 140, width: '300px', height: 'auto' },
  large: { qr: 180, width: '400px', height: 'auto' }
}

export default function ProductCode({ 
  product, 
  size = 'thermal',
  storeName = 'PRAGPUR FAMILY BAZAR',
  stockQuantity
}: ProductCodeProps) {
  const codeRef = useRef<HTMLDivElement>(null)
  
  // Generate barcode value - use barcode field if available, otherwise use SKU or ID
  const barcodeValue = product.barcode || product.sku || product.id
  
  // QR code only contains the barcode/ID number
  const qrData = barcodeValue
  
  const handleDownload = async (format: 'png' | 'svg') => {
    if (!codeRef.current) return
    
    if (format === 'png') {
      const canvas = await html2canvas(codeRef.current)
      const url = canvas.toDataURL('image/png')
      const a = document.createElement('a')
      a.href = url
      a.download = `${product.sku || product.id}-codes.png`
      a.click()
    }
  }
  
  const handlePrint = (copies: number = 1) => {
    const printWindow = window.open('', '', 'width=600,height=400')
    if (!printWindow || !codeRef.current) return
    
    const content = codeRef.current.outerHTML
    
    // Create one label per page for all sizes
    let labelPages = ''
    for (let i = 0; i < copies; i++) {
      // Each label on its own page
      labelPages += `
        <div style="
          page-break-after: ${i < copies - 1 ? 'always' : 'auto'};
          width: ${isBarcode ? '1.40in' : isThermal ? '192px' : 'auto'};
          height: ${isBarcode ? '0.90in' : isThermal ? '384px' : 'auto'};
          display: flex;
          justify-content: center;
          align-items: center;
        ">
          ${content}
        </div>
      `
    }
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Print ${product.name} (${copies} copies)</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              margin: 0; 
              padding: 0;
              font-family: monospace;
            }
            @media print {
              body { margin: 0; padding: 0; }
              @page { 
                margin: 0;
                size: ${isBarcode ? '1.40in 0.90in' : isThermal ? '2in 4in' : 'auto'};
              }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          ${labelPages}
        </body>
      </html>
    `)
    printWindow.document.close()
    
    // Small delay to ensure content is loaded before printing
    setTimeout(() => {
      printWindow.focus()
      printWindow.print()
      printWindow.close()
    }, 250)
  }
  
  const isThermal = size === 'thermal'
  const isBarcode = size === 'barcode'
  
  // Compact barcode sticker for 1.40 x 0.90 inch labels
  if (isBarcode) {
    return (
      <div className="inline-block">
        <div 
          ref={codeRef}
          className="bg-white text-black"
          style={{ 
            width: '1.40in',
            height: '0.90in',
            padding: '3px 4px 2px 4px',
            fontFamily: 'Arial, sans-serif',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: 'stretch',
            border: '1px solid #ddd',
            overflow: 'hidden',
            boxSizing: 'border-box'
          }}
        >
          {/* Top Section: Shop Name and Product */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}>
            {/* Shop Name */}
            <div style={{ 
              fontSize: '8px',
              fontWeight: '600',
              lineHeight: '1',
              marginBottom: '1px'
            }}>
              {storeName}
            </div>
            
            {/* Product Name */}
            <div style={{ 
              fontSize: '11px',
              fontWeight: '500',
              lineHeight: '1',
              textAlign: 'center',
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginBottom: '2px'
            }}>
              {product.name}
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
          {product.price !== null && product.price !== undefined && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              marginTop: '2px'
            }}>
              <div style={{ 
                fontSize: '11px',
                fontWeight: 'bold'
              }}>
                ৳ {product.price.toFixed(2)}
              </div>
            </div>
          )}
        </div>
        
        {/* Print buttons outside label */}
        <div className="space-y-2 mt-4">
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => handleDownload('png')}
              className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Download
            </button>
            <button
              onClick={() => handlePrint(1)}
              className="px-3 py-1.5 text-sm bg-green-500 text-white rounded hover:bg-green-600"
            >
              Print 1
            </button>
          </div>
          
          {/* Quick print copies buttons */}
          <div className="flex gap-2 justify-center flex-wrap">
            <span className="text-xs text-gray-600 self-center">Quick Print:</span>
            {stockQuantity && stockQuantity > 0 && (
              <button
                onClick={() => handlePrint(stockQuantity)}
                className="px-2 py-1 text-xs bg-orange-500 text-white hover:bg-orange-600 rounded"
              >
                Stock In: {stockQuantity} copies
              </button>
            )}
            {[2, 5, 10, 20, 50].map(num => (
              <button
                key={num}
                onClick={() => handlePrint(num)}
                className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded border border-gray-300"
              >
                {num} copies
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }
  
  if (isThermal) {
    // Thermal printer specific compact layout
    return (
      <div className="inline-block">
        <div 
          ref={codeRef}
          className="bg-white text-black"
          style={{ 
            width: '192px',
            height: '384px',
            padding: '8px',
            fontFamily: 'monospace',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            border: '1px solid #000'
          }}
        >
          {/* Compact Header */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              fontSize: '11px', 
              fontWeight: 'bold',
              borderBottom: '1px solid #000',
              paddingBottom: '2px',
              marginBottom: '4px'
            }}>
              {storeName.toUpperCase()}
            </div>
            
            {/* Product Name */}
            <div style={{ 
              fontSize: '9px',
              fontWeight: '600',
              marginBottom: '8px',
              lineHeight: '1.1',
              maxHeight: '30px',
              overflow: 'hidden'
            }}>
              {product.name}
            </div>
          </div>
          
          {/* Centered QR Code */}
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1
          }}>
            <QRCodeSVG 
              value={qrData}
              size={60}
              level="L"
              marginSize={0}
            />
            <div style={{ 
              fontSize: '7px',
              marginTop: '4px',
              color: '#333'
            }}>
              {barcodeValue}
            </div>
          </div>
          
          {/* Price at Bottom */}
          {product.price !== null && product.price !== undefined && (
            <div style={{ 
              textAlign: 'center',
              borderTop: '1px solid #000',
              paddingTop: '4px'
            }}>
              <div style={{ 
                fontSize: '14px',
                fontWeight: 'bold'
              }}>
                ৳ {product.price.toFixed(2)}
              </div>
            </div>
          )}
        </div>
        
        {/* Print buttons outside label */}
        <div className="space-y-2 mt-4">
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => handleDownload('png')}
              className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Download
            </button>
            <button
              onClick={() => handlePrint(1)}
              className="px-3 py-1.5 text-sm bg-green-500 text-white rounded hover:bg-green-600"
            >
              Print 1
            </button>
          </div>
          
          {/* Quick print copies buttons */}
          <div className="flex gap-2 justify-center flex-wrap">
            <span className="text-xs text-gray-600 self-center">Quick Print:</span>
            {stockQuantity && stockQuantity > 0 && (
              <button
                onClick={() => handlePrint(stockQuantity)}
                className="px-2 py-1 text-xs bg-orange-500 text-white hover:bg-orange-600 rounded"
              >
                Stock In: {stockQuantity} copies
              </button>
            )}
            {[2, 5, 10, 20].map(num => (
              <button
                key={num}
                onClick={() => handlePrint(num)}
                className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded border border-gray-300"
              >
                {num} copies
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }
  
  // Regular size layouts
  return (
    <div className="space-y-4">
      <div 
        ref={codeRef}
        className="bg-white p-6 rounded-lg border-2 border-gray-300 inline-block min-w-[300px]"
        style={{ 
          fontFamily: 'Arial, sans-serif',
          width: sizeConfig[size].width,
          height: sizeConfig[size].height,
          maxWidth: '100%'
        }}
      >
        {/* Store Name Header */}
        <div className="text-center mb-4">
          <h2 className="text-lg font-bold text-gray-900 pb-2 border-b-2 border-gray-800 inline-block px-4">
            {storeName}
          </h2>
        </div>
        
        {/* Product Name */}
        <div className="text-center mb-4">
          <h3 className="text-xl font-semibold text-gray-800">
            {product.name}
          </h3>
        </div>
        
        {/* QR Code Section */}
        <div className="flex flex-col items-center mb-6">
          <QRCodeSVG 
            value={qrData}
            size={sizeConfig[size].qr}
            level="M"
            marginSize={2}
          />
          <p className="text-xs text-gray-600 mt-2">
            {barcodeValue}
          </p>
        </div>
        
        {/* Price Section */}
        {product.price !== null && product.price !== undefined && (
          <div className="text-center pt-4 border-t border-gray-200">
            <p className="text-2xl font-bold text-gray-900">
              ৳ {product.price.toFixed(2)}
            </p>
            <p className="text-xs text-gray-500 mt-1">Price</p>
          </div>
        )}
      </div>
      
      <div className="space-y-2">
        <div className="flex gap-2 justify-center">
          <button
            onClick={() => handleDownload('png')}
            className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Download PNG
          </button>
          <button
            onClick={() => handlePrint(1)}
            className="px-3 py-1.5 text-sm bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
          >
            Print 1
          </button>
        </div>
        
        {/* Quick print copies buttons */}
        <div className="flex gap-2 justify-center flex-wrap">
          <span className="text-xs text-gray-600 self-center">Quick Print:</span>
          {stockQuantity && stockQuantity > 0 && (
            <button
              onClick={() => handlePrint(stockQuantity)}
              className="px-2 py-1 text-xs bg-orange-500 text-white hover:bg-orange-600 rounded"
            >
              Stock In: {stockQuantity} copies
            </button>
          )}
          {[2, 5, 10, 20].map(num => (
            <button
              key={num}
              onClick={() => handlePrint(num)}
              className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded border border-gray-300"
            >
              {num} copies
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}