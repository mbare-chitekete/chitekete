
import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { supabase } from './supabase'
import { useCurrency } from './CurrencyContext'

const input = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  border: '1px solid #dce4ec',
  borderRadius: 8,
  background: 'white',
  color: '#162b42',
  fontSize: 13
}

export default function DailySales() {
  const { formatCurrency } = useCurrency()
  const [sales, setSales] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    const [salesResult, categoriesResult] = await Promise.all([
      supabase.rpc('cashier_get_sales_lines', {
        p_start_date: null,
        p_end_date: null
      }),
      supabase.from('menu_categories').select('id,name').order('name')
    ])

    if (salesResult.error || categoriesResult.error) {
      setError(
        salesResult.error?.message ||
        categoriesResult.error?.message
      )
    } else {
      setSales(salesResult.data || [])
      setCategories(categoriesResult.data || [])
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    load()

    const fn = () => load()
    window.addEventListener('refresh-canteen-dashboard', fn)

    return () => {
      window.removeEventListener('refresh-canteen-dashboard', fn)
    }
  }, [load])

  const categoryName = id =>
    categories.find(x => x.id === id)?.name || 'Uncategorised'

  const filtered = useMemo(() => {
    return sales.filter(row => {
      const itemCategory = categoryName(row.category_id)
      const q = search.trim().toLowerCase()

      return (
        (!q || `${row.item_name} ${row.unit} ${row.receipt_number || ''} ${row.notes || ''}`.toLowerCase().includes(q)) &&
        (category === 'all' || itemCategory === category) &&
        (!startDate || row.sale_date >= startDate) &&
        (!endDate || row.sale_date <= endDate)
      )
    })
  }, [sales, categories, search, category, startDate, endDate])

  const totalQty = filtered.reduce(
    (sum, row) => sum + Number(row.quantity_sold || 0), 0
  )

  const totalRevenue = filtered.reduce(
    (sum, row) => sum + Number(row.sales_value || 0), 0
  )

  return (
    <div className="page-content" style={{ display: 'grid', gap: 18 }}>
      <div className="welcome-row">
        <div>
          <div className="eyebrow">SALES REPORTING</div>
          <h1>Daily Sales</h1>
          <p>POS-confirmed sales by product, date and receipt.</p>
        </div>

        <button
          className="button button-light"
          onClick={load}
          disabled={loading}
        >
          <RefreshCw size={16} />
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="panel" style={{ padding: 14, color: '#b42318' }}>
          {error}
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <span>Sale lines</span>
          <strong>{filtered.length}</strong>
          <small>Current filters</small>
        </div>

        <div className="stat-card">
          <span>Quantity sold</span>
          <strong>{totalQty.toLocaleString()}</strong>
          <small>POS-confirmed units</small>
        </div>

        <div className="stat-card">
          <span>Sales revenue</span>
          <strong>{formatCurrency(totalRevenue)}</strong>
          <small>Current filters</small>
        </div>
      </div>

      <section className="panel">
        <div style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          marginBottom: 16,
          alignItems: 'end'
        }}>
          <label style={{ flex: '2 1 220px' }}>
            Search product or receipt
            <input
              style={input}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search..."
            />
          </label>

          <label style={{ minWidth: 170 }}>
            Category
            <select
              style={input}
              value={category}
              onChange={e => setCategory(e.target.value)}
            >
              <option value="all">All categories</option>
              {categories.map(x => (
                <option key={x.id} value={x.name}>{x.name}</option>
              ))}
            </select>
          </label>

          <label>
            From
            <input
              style={input}
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </label>

          <label>
            To
            <input
              style={input}
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </label>
        </div>

        {loading ? (
          <p>Loading sales...</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Date & time</th>
                  <th>Receipt</th>
                  <th>Product</th>
                  <th>Quantity</th>
                  <th>Unit price</th>
                  <th>Sales value</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map(row => (
                  <tr key={row.id}>
                    <td>
                      {row.sale_datetime
                        ? new Date(row.sale_datetime).toLocaleString(
                          'en-GB',
                          { timeZone: 'Africa/Harare' }
                        )
                        : row.sale_date}
                    </td>

                    <td>{row.receipt_number || 'POS sale'}</td>

                    <td>
                      <strong>{row.item_name}</strong>
                      <div className="muted-cell">{row.unit}</div>
                    </td>

                    <td>{Number(row.quantity_sold || 0)}</td>
                    <td>{formatCurrency(row.selling_price)}</td>
                    <td><strong>{formatCurrency(row.sales_value)}</strong></td>
                  </tr>
                ))}

                {!filtered.length && (
                  <tr>
                    <td colSpan="6" style={{
                      textAlign: 'center',
                      padding: 24
                    }}>
                      No sales match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
