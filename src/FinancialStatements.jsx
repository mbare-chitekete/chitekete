import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarDays,
  Download, FileText, Package, RefreshCw, TrendingUp, Wallet
} from 'lucide-react'
import { supabase } from './supabase'

const views = [
  { id: 'profit-loss', label: 'Profit & Loss', icon: TrendingUp },
  { id: 'transactions', label: 'Detailed Transactions', icon: FileText },
  { id: 'products', label: 'Product Profitability', icon: Package },
  { id: 'expenses', label: 'Expense Breakdown', icon: Wallet }
]

const money = value => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', minimumFractionDigits: 2
}).format(Number(value || 0))

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
    const d = new Date(now); d.setDate(d.getDate() - 1)
    return { start: localDate(d), end: localDate(d) }
  }
  if (period === 'week') return { start: localDate(startOfWeek), end: today }
  if (period === 'month') return { start: localDate(firstOfMonth), end: today }
  if (period === 'previous_month') return { start: localDate(firstOfPreviousMonth), end: localDate(lastOfPreviousMonth) }
  if (period === 'year') return { start: localDate(firstOfYear), end: today }
  return { start: today, end: today }
}

const panel = { background: '#fff', border: '1px solid #e5ebf1', borderRadius: 14, padding: 18 }
const button = { border: '1px solid #dce5ed', borderRadius: 9, padding: '9px 12px', background: '#fff', color: '#34495e', fontWeight: 650, cursor: 'pointer' }
const input = { ...button, fontWeight: 500, minWidth: 145 }

function Metric({ label, value, note, icon: Icon, tone }) {
  return <div style={panel}>
    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: 12, fontWeight: 700 }}>
      {label}<Icon size={18} color={tone || '#28785f'} />
    </div>
    <div style={{ fontSize: 25, fontWeight: 800, color: '#172b3d', marginTop: 12 }}>{money(value)}</div>
    <div style={{ fontSize: 12, color: '#8793a0', marginTop: 6 }}>{note}</div>
  </div>
}

function DataTable({ columns, rows, empty = 'No records found for this period.' }) {
  return <div style={{ ...panel, padding: 0, overflow: 'hidden' }}>
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680, fontSize: 13 }}>
        <thead><tr>{columns.map(c => <th key={c.key} style={{ textAlign: c.align || 'left', padding: 13, background: '#f7f9fb', color: '#64748b', borderBottom: '1px solid #e5ebf1', whiteSpace: 'nowrap' }}>{c.label}</th>)}</tr></thead>
        <tbody>{rows.length ? rows.map((row, i) => <tr key={row.id || `${i}-${row.name || row.description || ''}`}>
          {columns.map(c => <td key={c.key} style={{ padding: 13, borderBottom: '1px solid #edf1f5', textAlign: c.align || 'left', color: '#334155' }}>{c.render ? c.render(row) : (row[c.key] ?? '—')}</td>)}
        </tr>) : <tr><td colSpan={columns.length} style={{ padding: 28, textAlign: 'center', color: '#8793a0' }}>{empty}</td></tr>}</tbody>
      </table>
    </div>
  </div>
}

export default function FinancialStatements({ initialView = 'profit-loss' }) {
  const [view, setView] = useState(initialView)
  const [period, setPeriod] = useState('month')
  const [range, setRange] = useState(() => getRange('month'))
  const [report, setReport] = useState(null)
  const [products, setProducts] = useState([])
  const [expenses, setExpenses] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => setView(initialView), [initialView])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [pl, productRows, expenseRows, transactionRows] = await Promise.all([
        supabase.rpc('owner_profit_loss_report', { p_start_date: range.start, p_end_date: range.end }),
        supabase.rpc('owner_product_profitability_report', { p_start_date: range.start, p_end_date: range.end }),
        supabase.rpc('owner_expense_breakdown_report', { p_start_date: range.start, p_end_date: range.end }),
        supabase.rpc('owner_financial_transactions_report', { p_start_date: range.start, p_end_date: range.end })
      ])
      const failed = [pl, productRows, expenseRows, transactionRows].find(r => r.error)
      if (failed?.error) throw failed.error
      setReport(pl.data || {})
      setProducts(Array.isArray(productRows.data) ? productRows.data : productRows.data?.rows || [])
      setExpenses(Array.isArray(expenseRows.data) ? expenseRows.data : expenseRows.data?.rows || [])
      setTransactions(Array.isArray(transactionRows.data) ? transactionRows.data : transactionRows.data?.rows || [])
    } catch (e) {
      setError(e.message || 'Could not load the financial statement. Apply the financial reporting SQL migration first.')
    } finally {
      setLoading(false)
    }
  }, [range.start, range.end])

  useEffect(() => { load() }, [load])

  function changePeriod(value) {
    setPeriod(value)
    if (value !== 'custom') setRange(getRange(value))
  }

  function exportCsv() {
    const rows = view === 'products' ? products : view === 'expenses' ? expenses : transactions
    const keys = rows.length ? Object.keys(rows[0]) : []
    if (!keys.length) return
    const quote = value => `"${String(value ?? '').replaceAll('"', '""')}"`
    const csv = [keys.map(quote).join(','), ...rows.map(row => keys.map(key => quote(row[key])).join(','))].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a'); a.href = url; a.download = `mbare-${view}-${range.start}-to-${range.end}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  const tabs = useMemo(() => views, [])
  const missingSales = Number(report?.unclassified_sales_count || 0)
  const missingCosts = Number(report?.missing_cost_lines || 0)
  const missingExpenses = Number(report?.unclassified_expenses_count || 0)
  const incomplete = missingSales + missingCosts + missingExpenses > 0

  return <div style={{ padding: 24, maxWidth: 1500, margin: '0 auto', color: '#172b3d' }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
      <div><div style={{ color: '#28785f', fontSize: 11, letterSpacing: 1.2, fontWeight: 800 }}>MBARE CHITEKETE CANTEEN</div><h1 style={{ fontSize: 27, margin: '6px 0' }}>Financial Statements</h1><p style={{ color: '#718096', margin: 0 }}>Owner financial reporting · USD only</p></div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button style={button} onClick={load} disabled={loading}><RefreshCw size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />{loading ? 'Loading…' : 'Refresh'}</button><button style={button} onClick={exportCsv}><Download size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />Export CSV</button></div>
    </div>

    <div style={{ ...panel, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end', marginBottom: 16 }}>
      <label style={{ display: 'grid', gap: 5, fontSize: 11, color: '#64748b', fontWeight: 700 }}>REPORTING PERIOD
        <select style={input} value={period} onChange={e => changePeriod(e.target.value)}>
          <option value="today">Today</option><option value="yesterday">Yesterday</option><option value="week">This week</option><option value="month">This month</option><option value="previous_month">Previous month</option><option value="year">This year</option><option value="custom">Custom range</option>
        </select>
      </label>
      <label style={{ display: 'grid', gap: 5, fontSize: 11, color: '#64748b', fontWeight: 700 }}>FROM<input type="date" style={input} value={range.start} onChange={e => { setPeriod('custom'); setRange(r => ({ ...r, start: e.target.value })) }} /></label>
      <label style={{ display: 'grid', gap: 5, fontSize: 11, color: '#64748b', fontWeight: 700 }}>TO<input type="date" style={input} value={range.end} min={range.start} onChange={e => { setPeriod('custom'); setRange(r => ({ ...r, end: e.target.value })) }} /></label>
      <div style={{ marginLeft: 'auto', color: '#28785f', fontSize: 12, fontWeight: 800, padding: '10px 2px' }}>USD REPORT</div>
    </div>

    <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 18, borderBottom: '1px solid #e5ebf1' }}>
      {tabs.map(tab => { const Icon = tab.icon; return <button key={tab.id} onClick={() => setView(tab.id)} style={{ ...button, border: 0, borderRadius: '9px 9px 0 0', borderBottom: view === tab.id ? '3px solid #28785f' : '3px solid transparent', color: view === tab.id ? '#28785f' : '#64748b', whiteSpace: 'nowrap' }}><Icon size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />{tab.label}</button> })}
    </div>

    {error && <div style={{ ...panel, borderColor: '#f0c7c7', color: '#a52b2b', marginBottom: 16 }}><AlertTriangle size={17} style={{ verticalAlign: 'middle', marginRight: 7 }} />{error}</div>}
    {incomplete && <div style={{ ...panel, borderColor: '#f2d49b', background: '#fffaf0', color: '#805b17', marginBottom: 16 }}><AlertTriangle size={17} style={{ verticalAlign: 'middle', marginRight: 7 }} /><strong>Some records need cost or currency review.</strong><div style={{ fontSize: 12, marginTop: 6 }}>Unclassified sales: {missingSales} · Sales lines missing reliable cost: {missingCosts} · Unclassified expenses: {missingExpenses}. These records are not silently assigned USD or invented costs.</div></div>}

    {loading && <div style={{ ...panel, marginBottom: 16, color: '#64748b' }}>Loading financial records…</div>}

    {view === 'profit-loss' && <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 13, marginBottom: 18 }}>
        <Metric label="Sales revenue" value={report?.sales_revenue} note="Completed USD sales" icon={ArrowUpRight} />
        <Metric label="Cost of goods sold" value={report?.cost_of_goods_sold} note="Costed USD stock sold" icon={Package} tone="#c47b26" />
        <Metric label="Gross profit" value={report?.gross_profit} note="Revenue less cost of goods sold" icon={TrendingUp} />
        <Metric label="Operating expenses" value={report?.operating_expenses} note="USD expenses only" icon={ArrowDownRight} tone="#c47b26" />
        <Metric label="Net profit / loss" value={report?.net_profit} note={incomplete ? 'Provisional — records need review' : 'Gross profit less operating expenses'} icon={Activity} tone={Number(report?.net_profit || 0) >= 0 ? '#28785f' : '#b42318'} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 14 }}>
        <div style={panel}><h3 style={{ margin: '0 0 15px', fontSize: 16 }}>Profit calculation</h3>{[
          ['Sales revenue', report?.sales_revenue], ['Less: stock cost', -Number(report?.cost_of_goods_sold || 0)], ['Gross profit', report?.gross_profit], ['Less: expenses', -Number(report?.operating_expenses || 0)], ['Net profit / loss', report?.net_profit]
        ].map(([label, value], i) => <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '11px 0', borderBottom: i === 4 ? 'none' : '1px solid #edf1f5', fontWeight: i === 2 || i === 4 ? 800 : 500 }}><span>{label}</span><span>{money(value)}</span></div>)}</div>
        <div style={panel}><h3 style={{ margin: '0 0 15px', fontSize: 16 }}>Profit margins</h3><div style={{ color: '#64748b', fontSize: 12 }}>Gross profit margin</div><div style={{ fontSize: 28, fontWeight: 800, margin: '5px 0 18px' }}>{Number(report?.gross_profit_margin || 0).toFixed(2)}%</div><div style={{ color: '#64748b', fontSize: 12 }}>Net profit margin</div><div style={{ fontSize: 28, fontWeight: 800, marginTop: 5 }}>{Number(report?.net_profit_margin || 0).toFixed(2)}%</div><div style={{ marginTop: 18, fontSize: 12, color: '#8793a0' }}>Reporting dates: {range.start} to {range.end}</div></div>
      </div>
    </>}

    {view === 'products' && <DataTable columns={[
      { key: 'product_name', label: 'Product' }, { key: 'quantity_sold', label: 'Qty sold', align: 'right' }, { key: 'revenue', label: 'Revenue', align: 'right', render: r => money(r.revenue) }, { key: 'cost_of_goods_sold', label: 'Stock cost', align: 'right', render: r => money(r.cost_of_goods_sold) }, { key: 'gross_profit', label: 'Gross profit', align: 'right', render: r => money(r.gross_profit) }, { key: 'cost_status', label: 'Cost status' }
    ]} rows={products} />}
    {view === 'expenses' && <DataTable columns={[
      { key: 'category', label: 'Expense category' }, { key: 'transaction_count', label: 'Records', align: 'right' }, { key: 'total_amount', label: 'Total USD', align: 'right', render: r => money(r.total_amount) }, { key: 'share_percent', label: 'Share', align: 'right', render: r => `${Number(r.share_percent || 0).toFixed(2)}%` }
    ]} rows={expenses} />}
    {view === 'transactions' && <DataTable columns={[
      { key: 'transaction_date', label: 'Date' }, { key: 'transaction_type', label: 'Type' }, { key: 'description', label: 'Description' }, { key: 'reference', label: 'Reference' }, { key: 'amount', label: 'USD amount', align: 'right', render: r => money(r.amount) }, { key: 'status', label: 'Status' }
    ]} rows={transactions} />}
  </div>
}
