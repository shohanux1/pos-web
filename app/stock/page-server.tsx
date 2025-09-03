import { Database } from '@/lib/database.types'
import { requireAuth } from '@/lib/auth/server'

type StockBatch = Database['public']['Tables']['stock_batches']['Row']

export default async function StockPageServer() {
  // This will redirect to login if not authenticated
  const { user, supabase } = await requireAuth()

  const { data: batches, error } = await supabase
    .from('stock_batches')
    .select('*')
    .eq('type', 'in')

  if (error) {
    return (
      <div className="p-4">
        <p className="text-red-500">Error: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold mb-4">Stock Batches (Server)</h1>
      <p className="text-sm text-gray-600 mb-2">User: {user.email}</p>
      <pre className="bg-gray-100 p-4 rounded-md text-sm">
        {JSON.stringify(batches, null, 2)}
      </pre>
    </div>
  )
}