'use client'

import React from 'react'
import Barcode from 'react-barcode'

interface BarcodeStickerProps {
  shopName?: string
  productName: string
  price: number
  barcode: string
}

export default function BarcodeSticker({ 
  shopName = 'প্রাগপুর ফ্যামিলি বাজার',
  productName, 
  price, 
  barcode 
}: BarcodeStickerProps) {
  return (
    <div className="barcode-sticker">
      <div className="shop-name">{shopName}</div>
      <div className="product-name">{productName}</div>
      <div className="price">৳ {price.toFixed(2)}</div>
      <div className="barcode-container">
        <Barcode 
          value={barcode}
          width={1.2}
          height={22}
          fontSize={8}
          margin={0}
          displayValue={true}
        />
      </div>
      
      <style jsx>{`
        .barcode-sticker {
          width: 1.40in;
          height: 0.90in;
          padding: 2px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          font-family: Arial, sans-serif;
          box-sizing: border-box;
          overflow: hidden;
        }
        
        .shop-name {
          font-size: 9px;
          line-height: 1;
          margin-bottom: 1px;
        }
        
        .product-name {
          font-size: 10px;
          font-weight: 500;
          line-height: 1.1;
          text-align: center;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          margin-bottom: 1px;
        }
        
        .price {
          font-size: 10px;
          font-weight: bold;
          margin-bottom: 2px;
        }
        
        .barcode-container {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        @media print {
          .barcode-sticker {
            page-break-inside: avoid;
            break-inside: avoid;
          }
        }
      `}</style>
    </div>
  )
}