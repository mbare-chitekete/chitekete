
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarDays,
  Download, FileText, Package, RefreshCw, TrendingUp, Wallet
} from 'lucide-react'
import { supabase } from './supabase'

const CURRENCIES = ['USD', 'ZAR', 'ZWG']

const views = [
  { id: 'profit-loss', label: 'Profit & Loss', icon: TrendingUp },
  { id: 'transactions', label: 'Detailed Transactions', icon: FileText },
  { id: 'products', label: 'Product Profitability', icon: Package },
  { id: 'expenses', label: 'Expense Breakdown', icon: Wallet }
]

const currencySymbols = {
  USD: '$',
  ZAR: 'R',
  ZWG: 'ZWG'
}

const money = (value, currency = 'USD') => {
  const code = CURRENCIES.includes(currency) ? currency : 'USD'

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Number(value || 0))
  } catch {
    return `${currencySymbols[code]}${Number(value || 0).toFixed(2)}`
  }
}

const localDate = date => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getRange(period) {
  const now = new Date()
  const today = localDate(now)

  const startOfWeek = new Date(now)
  const day = (startOfWeek.getDay() + 6) % 7
  startOfWeek.setDate(startOfWeek.getDate() - day)

  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const firstOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0)
  const firstOfYear = new Date(now.getFullYear(), 0, 1)

  if (period === 'today') return { start: today, end: today }

  if (period === 'yesterday') {
    const d = new Date(now)
    d.setDate(d.getDate() - 1)
    return { start: localDate(d), end: localDate(d) }
  }

  if (period === 'week') {
    return { start: localDate(startOfWeek), end: today }
  }

  if (period === 'month') {
    return { start: localDate(firstOfMonth), end: today }
  }

  if (period === 'previous_month') {
    return {
      start: localDate(firstOfPreviousMonth),
      end: localDate(lastOfPreviousMonth)
    }
  }

  if (period === 'year') {
    return { start: localDate(firstOfYear), end: today }
  }

  return { start: today, end: today }
}

const panel = {
  background: '#fff',
  border: '1px solid #e5ebf1',
  borderRadius: 14,
  padding: 18
}

const button = {
  border: '1px solid #dce5ed',
  borderRadius: 9,
  padding: '9px 12px',
  background: '#fff',
  color: '#34495e',
  fontWeight: 650,
  cursor: 'pointer'
}

const input = {
  ...button,
  fontWeight: 500,
  minWidth: 145
}

function Metric({
  label,
  value,
  currency,
  note,
  icon: Icon,
  tone
}) {
  return (
    <div style={panel}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        color: '#64748b',
        fontSize: 12,
        fontWeight: 700
      }}>
        {label}
        <Icon size={18} color={tone || '#28785f'} />
      </div>

      <div style={{
        fontSize: 25,
        fontWeight: 800,
        color: '#172b3d',
        marginTop: 12
      }}>
        {money(value, currency)}
      </div>

      <div style={{
        fontSize: 12,
        color: '#8793a0',
        marginTop: 6
      }}>
        {note}
      </div>
    </div>
  )
}

function DataTable({
  columns,
  rows,
  empty = 'No records found for this period.'
}) {
  return (
    <div style={{ ...panel, padding: 0, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          minWidth: 680,
          fontSize: 13
        }}>
          <thead>
            <tr>
              {columns.map(column => (
                <th
                  key={column.key}
                  style={{
                    textAlign: column.align || 'left',
                    padding: 13,
                    background: '#f7f9fb',
                    color: '#64748b',
                    borderBottom: '1px solid #e5ebf1',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.length ? rows.map((row, index) => (
              <tr key={row.id || `${index}-${row.name || row.description || ''}`}>
                {columns.map(column => (
                  <td
                    key={column.key}
                    style={{
                      padding: 13,
                      borderBottom: '1px solid #edf1f5',
                      textAlign: column.align || 'left',
                      color: '#334155'
                    }}
                  >
                    {column.render
                      ? column.render(row)
                      : (row[column.key] ?? '—')}
                  </td>
                ))}
              </tr>
            )) : (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{
                    padding: 28,
                    textAlign: 'center',
                    color: '#8793a0'
                  }}
                >
                  {empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CurrencyHeading({ currency }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 12
    }}>
      <h3 style={{
        margin: 0,
        fontSize: 17,
        color: '#172b3d'
      }}>
        {currency} Profit & Loss
      </h3>

      <span style={{
        background: '#eef6f2',
        color: '#28785f',
        padding: '5px 10px',
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 800
      }}>
        {currency}
      </span>
    </div>
  )
}

function ProfitLossSection({
  currency,
  data,
  incomplete
}) {
  const revenue = Number(data?.sales_revenue || 0)
  const cogs = Number(data?.cost_of_goods_sold || 0)
  const grossProfit = Number(data?.gross_profit ?? revenue - cogs)
  const expenses = Number(data?.operating_expenses || 0)
  const netProfit = Number(data?.net_profit ?? grossProfit - expenses)

  return (
    <div style={{ marginBottom: 24 }}>
      <CurrencyHeading currency={currency} />

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))',
        gap: 13,
        marginBottom: 14
      }}>
        <Metric
          label="Sales revenue"
          value={revenue}
          currency={currency}
          note={`Completed ${currency} sales`}
          icon={ArrowUpRight}
        />

        <Metric
          label="Cost of goods sold"
          value={cogs}
          currency={currency}
          note="Inventory cost of stock sold"
          icon={Package}
          tone="#c47b26"
        />

        <Metric
          label="Gross profit"
          value={grossProfit}
          currency={currency}
          note="Revenue less cost of goods sold"
          icon={TrendingUp}
        />

        <Metric
          label="Operating expenses"
          value={expenses}
          currency={currency}
          note={`${currency} expenses`}
          icon={ArrowDownRight}
          tone="#c47b26"
        />

        <Metric
          label="Net profit / loss"
          value={netProfit}
          currency={currency}
          note={incomplete
            ? 'Provisional — records need review'
            : 'Gross profit less operating expenses'}
          icon={Activity}
          tone={netProfit >= 0 ? '#28785f' : '#b42318'}
        />
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))',
        gap: 14
      }}>
        <div style={panel}>
          <h3 style={{ margin: '0 0 15px', fontSize: 16 }}>
            Profit calculation
          </h3>

          {[
            ['Sales revenue', revenue],
            ['Less: stock cost', -cogs],
            ['Gross profit', grossProfit],
            ['Less: expenses', -expenses],
            ['Net profit / loss', netProfit]
          ].map(([label, value], index) => (
            <div
              key={label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                padding: '11px 0',
                borderBottom: index === 4 ? 'none' : '1px solid #edf1f5',
                fontWeight: index === 2 || index === 4 ? 800 : 500
              }}
            >
              <span>{label}</span>
              <span>{money(value, currency)}</span>
            </div>
          ))}
        </div>

        <div style={panel}>
          <h3 style={{ margin: '0 0 15px', fontSize: 16 }}>
            Profit margins
          </h3>

          <div style={{ color: '#64748b', fontSize: 12 }}>
            Gross profit margin
          </div>

          <div style={{
            fontSize: 28,
            fontWeight: 800,
            margin: '5px 0 18px'
          }}>
            {Number(data?.gross_profit_margin || 0).toFixed(2)}%
          </div>

          <div style={{ color: '#64748b', fontSize: 12 }}>
            Net profit margin
          </div>

          <div style={{
            fontSize: 28,
            fontWeight: 800,
            marginTop: 5
          }}>
            {Number(data?.net_profit_margin || 0).toFixed(2)}%
          </div>
        </div>
      </div>
    </div>
  )
}

export default function FinancialStatements({
  initialView = 'profit-loss'
}) {
  const [view, setView] = useState(initialView)
  const [businessName, setBusinessName] = useState('Canteen')
  const [period, setPeriod] = useState('month')
  const [range, setRange] = useState(() => getRange('month'))

  const [report, setReport] = useState(null)
  const [products, setProducts] = useState([])
  const [expenses, setExpenses] = useState([])
  const [transactions, setTransactions] = useState([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setView(initialView)
  }, [initialView])

  const loadBusinessName = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('canteen_settings')
        .select('business_name')
        .eq('id', true)
        .maybeSingle()

      if (error) throw error

      if (data?.business_name?.trim()) {
        setBusinessName(data.business_name.trim())
      }
    } catch (err) {
      console.error('Business name loading failed:', err)
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [
        profitLossResult,
        productResult,
        expenseResult,
        transactionResult
      ] = await Promise.all([
        supabase.rpc('owner_profit_loss_report', {
          p_start_date: range.start,
          p_end_date: range.end
        }),

        supabase.rpc('owner_product_profitability_report', {
          p_start_date: range.start,
          p_end_date: range.end
        }),

        supabase.rpc('owner_expense_breakdown_report', {
          p_start_date: range.start,
          p_end_date: range.end
        }),

        supabase.rpc('owner_financial_transactions_report', {
          p_start_date: range.start,
          p_end_date: range.end
        })
      ])

      const failed = [
        profitLossResult,
        productResult,
        expenseResult,
        transactionResult
      ].find(result => result.error)

      if (failed?.error) throw failed.error

      setReport(profitLossResult.data || {})

      setProducts(
        Array.isArray(productResult.data)
          ? productResult.data
          : productResult.data?.rows || []
      )

      setExpenses(
        Array.isArray(expenseResult.data)
          ? expenseResult.data
          : expenseResult.data?.rows || []
      )

      setTransactions(
        Array.isArray(transactionResult.data)
          ? transactionResult.data
          : transactionResult.data?.rows || []
      )
    } catch (err) {
      console.error('Financial report loading failed:', err)

      setError(
        err.message ||
        'Could not load financial statements. Check that the updated financial reporting SQL functions have been installed.'
      )
    } finally {
      setLoading(false)
    }
  }, [range.start, range.end])

  useEffect(() => {
    load()
    loadBusinessName()
  }, [load, loadBusinessName])

  function changePeriod(value) {
    setPeriod(value)

    if (value !== 'custom') {
      setRange(getRange(value))
    }
  }

  const currencyReports = useMemo(() => {
    const source = report?.currencies

    if (Array.isArray(source)) {
      return source.filter(item =>
        CURRENCIES.includes(item.currency_code)
      )
    }

    if (source && typeof source === 'object') {
      return CURRENCIES
        .filter(currency => source[currency])
        .map(currency => ({
          currency_code: currency,
          ...source[currency]
        }))
    }

    return []
  }, [report])

  const missingSales = Number(report?.unclassified_sales_count || 0)
  const missingCosts = Number(report?.missing_cost_lines || 0)
  const missingExpenses = Number(report?.unclassified_expenses_count || 0)

  const incomplete =
    missingSales + missingCosts + missingExpenses > 0

  function exportCsv() {
    let rows = []

    if (view === 'products') rows = products
    if (view === 'expenses') rows = expenses
    if (view === 'transactions') rows = transactions

    if (view === 'profit-loss') {
      rows = currencyReports.map(item => ({
        currency_code: item.currency_code,
        sales_revenue: item.sales_revenue,
        cost_of_goods_sold: item.cost_of_goods_sold,
        gross_profit: item.gross_profit,
        operating_expenses: item.operating_expenses,
        net_profit: item.net_profit,
        gross_profit_margin: item.gross_profit_margin,
        net_profit_margin: item.net_profit_margin
      }))
    }

    if (!rows.length) return

    const keys = Object.keys(rows[0])

    const quote = value =>
      `"${String(value ?? '').replaceAll('"', '""')}"`

    const csv = [
      keys.map(quote).join(','),
      ...rows.map(row =>
        keys.map(key => quote(row[key])).join(',')
      )
    ].join('\n')

    const blob = new Blob([csv], {
      type: 'text/csv;charset=utf-8;'
    })

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')

    a.href = url

    const businessSlug = businessName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'canteen'

    a.download =
      `${businessSlug}-${view}-${range.start}-to-${range.end}.csv`

    a.click()
    URL.revokeObjectURL(url)
  }

  const tabs = useMemo(() => views, [])

  return (
    <div style={{
      padding: 24,
      maxWidth: 1500,
      margin: '0 auto',
      color: '#172b3d'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap',
        marginBottom: 20
      }}>
        <div style={{
          color: '#28785f',
          fontSize: 11,
          letterSpacing: 1.2,
          fontWeight: 800
        }}>
          {businessName.toUpperCase()}
        </div>

        <div style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap'
        }}>
          <button
            style={button}
            onClick={load}
            disabled={loading}
          >
            <RefreshCw
              size={15}
              style={{
                verticalAlign: 'middle',
                marginRight: 6
              }}
            />
            {loading ? 'Loading…' : 'Refresh'}
          </button>

          <button
            style={button}
            onClick={exportCsv}
            disabled={loading}
          >
            <Download
              size={15}
              style={{
                verticalAlign: 'middle',
                marginRight: 6
              }}
            />
            Export CSV
          </button>
        </div>
      </div>

      <div style={{
        ...panel,
        display: 'flex',
        gap: 10,
        flexWrap: 'wrap',
        alignItems: 'end',
        marginBottom: 16
      }}>
        <label style={{
          display: 'grid',
          gap: 5,
          fontSize: 11,
          color: '#64748b',
          fontWeight: 700
        }}>
          REPORTING PERIOD

          <select
            style={input}
            value={period}
            onChange={event => changePeriod(event.target.value)}
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
            <option value="previous_month">Previous month</option>
            <option value="year">This year</option>
            <option value="custom">Custom range</option>
          </select>
        </label>

        <label style={{
          display: 'grid',
          gap: 5,
          fontSize: 11,
          color: '#64748b',
          fontWeight: 700
        }}>
          FROM

          <input
            type="date"
            style={input}
            value={range.start}
            onChange={event => {
              setPeriod('custom')
              setRange(current => ({
                ...current,
                start: event.target.value
              }))
            }}
          />
        </label>

        <label style={{
          display: 'grid',
          gap: 5,
          fontSize: 11,
          color: '#64748b',
          fontWeight: 700
        }}>
          TO

          <input
            type="date"
            style={input}
            value={range.end}
            min={range.start}
            onChange={event => {
              setPeriod('custom')
              setRange(current => ({
                ...current,
                end: event.target.value
              }))
            }}
          />
        </label>

        <div style={{
          marginLeft: 'auto',
          color: '#28785f',
          fontSize: 12,
          fontWeight: 800,
          padding: '10px 2px'
        }}>
          USD · ZAR · ZWG REPORT
        </div>
      </div>

      <div style={{
        display: 'flex',
        gap: 6,
        overflowX: 'auto',
        marginBottom: 18,
        borderBottom: '1px solid #e5ebf1'
      }}>
        {tabs.map(tab => {
          const Icon = tab.icon

          return (
            <button
              key={tab.id}
              onClick={() => setView(tab.id)}
              style={{
                ...button,
                border: 0,
                borderRadius: '9px 9px 0 0',
                borderBottom: view === tab.id
                  ? '3px solid #28785f'
                  : '3px solid transparent',
                color: view === tab.id ? '#28785f' : '#64748b',
                whiteSpace: 'nowrap'
              }}
            >
              <Icon
                size={15}
                style={{
                  verticalAlign: 'middle',
                  marginRight: 6
                }}
              />
              {tab.label}
            </button>
          )
        })}
      </div>

      {error && (
        <div style={{
          ...panel,
          borderColor: '#f0c7c7',
          color: '#a52b2b',
          marginBottom: 16
        }}>
          <AlertTriangle
            size={17}
            style={{
              verticalAlign: 'middle',
              marginRight: 7
            }}
          />
          {error}
        </div>
      )}

      {incomplete && (
        <div style={{
          ...panel,
          borderColor: '#f2d49b',
          background: '#fffaf0',
          color: '#805b17',
          marginBottom: 16
        }}>
          <AlertTriangle
            size={17}
            style={{
              verticalAlign: 'middle',
              marginRight: 7
            }}
          />

          <strong>
            Some records need cost or currency review.
          </strong>

          <div style={{
            fontSize: 12,
            marginTop: 6
          }}>
            Unclassified sales: {missingSales}
            {' · '}
            Sales lines missing reliable cost: {missingCosts}
            {' · '}
            Unclassified expenses: {missingExpenses}.
            {' '}
            These records are not silently assigned a currency or given invented costs.
          </div>
        </div>
      )}

      {loading && (
        <div style={{
          ...panel,
          marginBottom: 16,
          color: '#64748b'
        }}>
          Loading financial records…
        </div>
      )}

      {!loading && !error && view === 'profit-loss' && (
        <>
          {currencyReports.length ? (
            currencyReports.map(item => (
              <ProfitLossSection
                key={item.currency_code}
                currency={item.currency_code}
                data={item}
                incomplete={incomplete}
              />
            ))
          ) : (
            <div style={{
              ...panel,
              color: '#64748b'
            }}>
              No currency-specific profit and loss data was returned for this period.
            </div>
          )}

          <div style={{
            ...panel,
            marginTop: 8,
            fontSize: 12,
            color: '#64748b'
          }}>
            <strong>Accounting note:</strong> Each currency is reported separately.
            USD, ZAR and ZWG are not combined into a single total.
            Inventory is valued using the USD base-currency costing method.
          </div>
        </>
      )}

      {!loading && !error && view === 'products' && (
        <DataTable
          columns={[
            {
              key: 'product_name',
              label: 'Product'
            },
            {
              key: 'currency_code',
              label: 'Currency'
            },
            {
              key: 'quantity_sold',
              label: 'Qty sold',
              align: 'right'
            },
            {
              key: 'revenue',
              label: 'Revenue',
              align: 'right',
              render: row => money(row.revenue, row.currency_code)
            },
            {
              key: 'cost_of_goods_sold',
              label: 'Stock cost',
              align: 'right',
              render: row => money(
                row.cost_of_goods_sold,
                row.currency_code
              )
            },
            {
              key: 'gross_profit',
              label: 'Gross profit',
              align: 'right',
              render: row => money(row.gross_profit, row.currency_code)
            },
            {
              key: 'cost_status',
              label: 'Cost status'
            }
          ]}
          rows={products}
        />
      )}

      {!loading && !error && view === 'expenses' && (
        <DataTable
          columns={[
            {
              key: 'category',
              label: 'Expense category'
            },
            {
              key: 'currency_code',
              label: 'Currency'
            },
            {
              key: 'transaction_count',
              label: 'Records',
              align: 'right'
            },
            {
              key: 'total_amount',
              label: 'Total amount',
              align: 'right',
              render: row => money(row.total_amount, row.currency_code)
            },
            {
              key: 'share_percent',
              label: 'Share',
              align: 'right',
              render: row =>
                `${Number(row.share_percent || 0).toFixed(2)}%`
            }
          ]}
          rows={expenses}
        />
      )}

      {!loading && !error && view === 'transactions' && (
        <DataTable
          columns={[
            {
              key: 'transaction_date',
              label: 'Date'
            },
            {
              key: 'transaction_type',
              label: 'Type'
            },
            {
              key: 'description',
              label: 'Description'
            },
            {
              key: 'reference',
              label: 'Reference'
            },
            {
              key: 'currency_code',
              label: 'Currency'
            },
            {
              key: 'amount',
              label: 'Amount',
              align: 'right',
              render: row => money(row.amount, row.currency_code)
            },
            {
              key: 'status',
              label: 'Status'
            }
          ]}
          rows={transactions}
        />
      )}

      <div style={{
        marginTop: 18,
        color: '#8793a0',
        fontSize: 11,
        display: 'flex',
        alignItems: 'center',
        gap: 6
      }}>
        <CalendarDays size={14} />
        Reporting dates: {range.start} to {range.end}
      </div>
    </div>
  )
}
