
import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { supabase } from './supabase'

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

const CURRENCY_INFO = {
  USD: { symbol: '$', name: 'US Dollar' },
  ZAR: { symbol: 'R', name: 'South African Rand' },
  ZWG: { symbol: 'ZiG', name: 'Zimbabwe Gold' }
}

function formatSaleCurrency(value, currencyCode) {
  const amount = Number(value || 0)

  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

  const currency = CURRENCY_INFO[currencyCode]

  if (!currency) {
    return `${currencyCode || 'Unknown'} ${formatted}`
  }

  return `${currency.symbol}${formatted}`
}

export default function DailySales() {
  const [sales, setSales] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [currency, setCurrency] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [salesResult, categoriesResult] = await Promise.all([
        supabase.rpc('cashier_get_sales_lines', {
          p_start_date: null,
          p_end_date: null
        }),
        supabase
          .from('menu_categories')
          .select('id,name')
          .order('name')
      ])

      if (salesResult.error) throw salesResult.error
      if (categoriesResult.error) throw categoriesResult.error

      setSales(salesResult.data || [])
      setCategories(categoriesResult.data || [])
    } catch (err) {
      console.error('Daily sales loading error:', err)
      setError(err.message || 'Could not load daily sales.')

      setSales([])
      setCategories([])
    } finally {
      setLoading(false)
    }
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

  const availableCurrencies = useMemo(() => {
    return [
      ...new Set(
        sales.map(row => row.currency_code || 'UNKNOWN')
      )
    ].sort()
  }, [sales])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()

    return sales.filter(row => {
      const itemCategory = categoryName(row.category_id)
      const rowCurrency = row.currency_code || 'UNKNOWN'

      const searchableText = [
        row.item_name,
        row.unit,
        row.receipt_number,
        row.notes
      ].join(' ').toLowerCase()

      return (
        (!q || searchableText.includes(q)) &&
        (category === 'all' || itemCategory === category) &&
        (currency === 'all' || rowCurrency === currency) &&
        (!startDate || row.sale_date >= startDate) &&
        (!endDate || row.sale_date <= endDate)
      )
    })
  }, [
    sales,
    categories,
    search,
    category,
    currency,
    startDate,
    endDate
  ])

  const totalQty = useMemo(() => {
    return filtered.reduce(
      (sum, row) => sum + Number(row.quantity_sold || 0),
      0
    )
  }, [filtered])

  // Revenue is grouped by transaction currency.
  // Different currencies are never added together.
  const revenueByCurrency = useMemo(() => {
    const grouped = new Map()

    filtered.forEach(row => {
      const code = row.currency_code || 'UNKNOWN'

      if (!grouped.has(code)) {
        grouped.set(code, {
          currency_code: code,
          sales_value: 0,
          sale_lines: 0
        })
      }

      const summary = grouped.get(code)

      summary.sales_value += Number(row.sales_value || 0)
      summary.sale_lines += 1
    })

    return Array.from(grouped.values())
      .sort((a, b) =>
        a.currency_code.localeCompare(b.currency_code)
      )
  }, [filtered])

  return (
    <div
      className="page-content"
      style={{ display: 'grid', gap: 18 }}
    >
      <div className="welcome-row">
        <div>
          <div className="eyebrow">SALES REPORTING</div>
          <h1>Daily Sales</h1>
          <p>
            POS-confirmed sales by product, date, receipt
            and transaction currency.
          </p>
        </div>

        <button
          className="button button-light"
          onClick={load}
          disabled={loading}
        >
          <RefreshCw
            size={16}
            className={loading ? 'spin' : ''}
          />
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div
          className="panel"
          style={{ padding: 14, color: '#b42318' }}
        >
          {error}
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <span>Sale lines</span>
          <strong>{filtered.length.toLocaleString()}</strong>
          <small>Current filters</small>
        </div>

        <div className="stat-card">
          <span>Quantity sold</span>
          <strong>{totalQty.toLocaleString()}</strong>
          <small>POS-confirmed units</small>
        </div>

        {revenueByCurrency.map(summary => (
          <div
            className="stat-card"
            key={summary.currency_code}
          >
            <span>
              {summary.currency_code} Sales Revenue
            </span>

            <strong>
              {formatSaleCurrency(
                summary.sales_value,
                summary.currency_code
              )}
            </strong>

            <small>
              {summary.sale_lines.toLocaleString()} sale lines
            </small>
          </div>
        ))}
      </div>

      <section className="panel">
        <div
          style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            marginBottom: 16,
            alignItems: 'end'
          }}
        >
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
                <option key={x.id} value={x.name}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>

          <label style={{ minWidth: 140 }}>
            Currency

            <select
              style={input}
              value={currency}
              onChange={e => setCurrency(e.target.value)}
            >
              <option value="all">All currencies</option>

              {availableCurrencies.map(code => (
                <option key={code} value={code}>
                  {code}
                  {CURRENCY_INFO[code]
                    ? ` - ${CURRENCY_INFO[code].name}`
                    : ''}
                </option>
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

        {currency === 'all' && revenueByCurrency.length > 1 && (
          <div
            style={{
              padding: '10px 12px',
              marginBottom: 14,
              borderRadius: 8,
              background: '#eff6ff',
              color: '#1e40af',
              fontSize: 13
            }}
          >
            Revenue is displayed separately for each currency.
            Different currencies are not combined.
          </div>
        )}

        {loading ? (
          <p>Loading sales...</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Date &amp; time</th>
                  <th>Receipt</th>
                  <th>Product</th>
                  <th>Currency</th>
                  <th>Quantity</th>
                  <th>Unit price</th>
                  <th>Sales value</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map(row => {
                  const rowCurrency =
                    row.currency_code || 'UNKNOWN'

                  return (
                    <tr key={row.id}>
                      <td>
                        {row.sale_datetime
                          ? new Date(
                            row.sale_datetime
                          ).toLocaleString(
                            'en-GB',
                            {
                              timeZone:
                                'Africa/Harare'
                            }
                          )
                          : row.sale_date}
                      </td>

                      <td>
                        {row.receipt_number || 'POS sale'}
                      </td>

                      <td>
                        <strong>{row.item_name}</strong>

                        <div className="muted-cell">
                          {row.unit}
                        </div>
                      </td>

                      <td>{rowCurrency}</td>

                      <td>
                        {Number(
                          row.quantity_sold || 0
                        ).toLocaleString()}
                      </td>

                      <td>
                        {formatSaleCurrency(
                          row.selling_price,
                          rowCurrency
                        )}
                      </td>

                      <td>
                        <strong>
                          {formatSaleCurrency(
                            row.sales_value,
                            rowCurrency
                          )}
                        </strong>
                      </td>
                    </tr>
                  )
                })}

                {!filtered.length && (
                  <tr>
                    <td
                      colSpan="7"
                      style={{
                        textAlign: 'center',
                        padding: 24
                      }}
                    >
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
