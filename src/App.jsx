
import { useEffect, useMemo, useState } from 'react'

import {
  LayoutDashboard,
  Utensils,
  ShoppingBasket,
  Boxes,
  Wallet,
  PiggyBank,
  ChartNoAxesCombined,
  Settings as SettingsIcon,
  Search,
  Bell,
  ChevronDown,
  ChevronRight,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  MoreHorizontal,
  CalendarDays,
  RefreshCw,
  TrendingUp,
  CircleAlert,
  CheckCircle2,
  Clock3,
  Menu,
  X,
  ReceiptText,
  Package,
  LogOut,
  ClipboardList,
  Users
} from 'lucide-react'

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'
import OnlineOrders from './OnlineOrders'
import MenuProducts from './MenuProducts'
import Purchases from './Purchases'
import Inventory from './Inventory'
import DailySales from './DailySales'
import CashManagement from './CashManagement'
import ReportsAnalytics from './ReportsAnalytics'
import Expenses from './Expenses'
import Settings from './Settings'
import BusinessSavings from './BusinessSavings'
import StaffPayroll from './StaffPayroll'
import OwnerBenefitReviews from './OwnerBenefitReviews'
import StartupFunding from './StartupFunding'
import FinancialStatements from './FinancialStatements'
import CashierPOS from './CashierPOS'
import ManagerDashboard from './ManagerDashboard'
import { useCurrency, formatMoney } from './CurrencyContext'
import { supabase } from './supabase'

const BUSINESS_TIME_ZONE = 'Africa/Harare'
const SUPPORTED_CURRENCIES = ['USD', 'ZAR', 'ZWG']

const CHART_COLOURS = {
  sales: '#2563EB',
  purchases: '#F97316',
  green: '#16A34A',
  purple: '#9333EA',
  pink: '#EC4899',
  yellow: '#EAB308',
  cyan: '#06B6D4',
  red: '#EF4444'
}

const PIE_COLOURS = [
  '#2563EB',
  '#F97316',
  '#16A34A',
  '#9333EA',
  '#EC4899',
  '#EAB308',
  '#06B6D4',
  '#EF4444'
]

const navItems = [
  { label: 'Overview', icon: LayoutDashboard, section: 'WORKSPACE' },
  { label: 'Manager Dashboard', icon: LayoutDashboard },
  { label: 'Cashier POS', icon: ReceiptText },
  { label: 'Menu & Products', icon: Utensils },
  { label: 'Daily Sales', icon: ReceiptText },
  { label: 'Purchases', icon: ShoppingBasket },
  { label: 'Inventory', icon: Boxes },
  { label: 'Staff Benefits', icon: Users },
  { label: 'Cash Management', icon: Wallet, section: 'MANAGEMENT' },
  { label: 'Expenses', icon: ReceiptText },
  { label: 'Reports & Analytics', icon: ChartNoAxesCombined },
  { label: 'Profit & Loss', icon: ChartNoAxesCombined, section: 'FINANCIAL STATEMENTS' },
  { label: 'Detailed Transactions', icon: ReceiptText },
  { label: 'Product Profitability', icon: TrendingUp },
  { label: 'Expense Breakdown', icon: Wallet },
  { label: 'Business Savings', icon: PiggyBank, section: 'SYSTEM' },
  { label: 'Staff & Payroll', icon: Users },
  { label: 'Startup Funding', icon: Wallet, section: 'STARTUP' },
  {
    label: 'Online Orders',
    icon: ClipboardList
  },
  { label: 'Settings', icon: SettingsIcon }
]

// --------------------------------------------------
// Zimbabwe business date/time helpers
// --------------------------------------------------

function getHarareDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date)

  const values = Object.fromEntries(
    parts.map(part => [part.type, part.value])
  )

  return `${values.year}-${values.month}-${values.day}`
}

function addDaysToDateKey(dateKey, amount) {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + amount))

  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0')
  ].join('-')
}

function getWeekdayNumber(dateKey) {
  const date = new Date(`${dateKey}T12:00:00.000Z`)
  return date.getUTCDay()
}

function getSundayOfWeek(dateKey) {
  return addDaysToDateKey(dateKey, -getWeekdayNumber(dateKey))
}

function getMonthStart(dateKey) {
  return `${dateKey.slice(0, 7)}-01`
}

function getPreviousMonthRange(dateKey) {
  const currentMonthStart = getMonthStart(dateKey)
  const previousMonthLast = addDaysToDateKey(currentMonthStart, -1)

  return {
    start: getMonthStart(previousMonthLast),
    end: previousMonthLast
  }
}

function getDateLabel(dateKey, includeYear = false) {
  const date = new Date(`${dateKey}T12:00:00.000Z`)

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
    ...(includeYear ? { year: 'numeric' } : {})
  }).format(date)
}

function getWeekdayFromDateKey(dateKey) {
  const date = new Date(`${dateKey}T12:00:00.000Z`)

  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'short'
  }).format(date)
}

function formatHarareDate(date = new Date(), options = {}) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIME_ZONE,
    ...options
  }).format(date)
}
function formatHarareClock(date = new Date()) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Harare',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).format(date)
}
function getHarareHour(date = new Date()) {
  return Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: BUSINESS_TIME_ZONE,
      hour: '2-digit',
      hourCycle: 'h23'
    }).format(date)
  )
}

function isValidDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false

  const date = new Date(`${value}T12:00:00.000Z`)

  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
}

// --------------------------------------------------
// Currency helpers
// --------------------------------------------------

function createCurrencyTotals() {
  return {
    USD: 0,
    ZAR: 0,
    ZWG: 0
  }
}

function addCurrencyAmount(totals, currencyCode, amount) {
  const code = String(currencyCode || 'USD').toUpperCase()
  totals[code] = (totals[code] || 0) + Number(amount || 0)
  return totals
}

function formatTransactionAmount(amount, currencyCode) {
  const code = String(currencyCode || 'USD').toUpperCase()

  if (SUPPORTED_CURRENCIES.includes(code)) {
    return formatMoney(amount, code)
  }

  return `${code} ${Number(amount || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`
}

function CurrencyLines({ totals, preferredCurrency = 'USD' }) {
  const entries = Object.entries(totals || {})
    .filter(([, amount]) => Number(amount || 0) !== 0)
    .sort(([a], [b]) => {
      const order = ['USD', 'ZAR', 'ZWG']
      return order.indexOf(a) - order.indexOf(b)
    })

  if (entries.length === 0) {
    return <div>{formatTransactionAmount(0, preferredCurrency)}</div>
  }

  return (
    <div style={{ display: 'grid', gap: 4, lineHeight: 1.4 }}>
      {entries.map(([currency, amount]) => (
        <div key={currency}>
          {formatTransactionAmount(amount, currency)}
        </div>
      ))}
    </div>
  )
}

// --------------------------------------------------
// Sidebar
// --------------------------------------------------

function Sidebar({
  active,
  setActive,
  open,
  setOpen,
  businessName,
  ownerEmail,
  userRole
}) {
  const visibleItems = userRole === 'owner'
    ? navItems
    : userRole === 'manager'
      ? navItems.filter(item =>
        ['Manager Dashboard', 'Purchases', 'Online Orders', 'Inventory'].includes(item.label)
      )
      : userRole === 'cashier'
        ? navItems.filter(item => item.label === 'Cashier POS')
        : []

  return (
    <>
      {open && (
        <button
          className="mobile-scrim"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">
            <Utensils size={21} strokeWidth={2.2} />
          </div>

          <div>
            <div className="brand-name">Canteen<span>.</span></div>
            <div className="brand-caption">MANAGEMENT SYSTEM</div>
          </div>

          <button className="mobile-close" onClick={() => setOpen(false)}>
            <X size={19} />
          </button>
        </div>

        <div className="workspace-switch">
          <div className="workspace-avatar">C</div>

          <div className="workspace-copy">
            <strong>{businessName}</strong>
            <span>
              {userRole
                ? `${userRole.charAt(0).toUpperCase()}${userRole.slice(1)} workspace`
                : 'Loading workspace...'}
            </span>
          </div>

          <ChevronDown size={15} className="muted-icon" />
        </div>

        <nav style={{
          padding: '18px 14px',
          display: 'grid',
          gap: 5,
          overflowY: 'auto',
          flex: 1
        }}>
          {visibleItems.map(item => {
            const Icon = item.icon
            const isActive = active === item.label

            return (
              <div key={item.label}>
                {item.section && (
                  <div style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '1px',
                    color: '#929b94',
                    padding: '15px 10px 8px'
                  }}>
                    {item.section}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setActive(item.label)
                    setOpen(false)
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    width: '100%',
                    padding: '11px 12px',
                    border: 'none',
                    borderRadius: 9,
                    background: isActive ? '#eaf3ee' : 'transparent',
                    color: isActive ? '#28785f' : '#64716a',
                    fontWeight: isActive ? 700 : 500,
                    fontSize: 13,
                    textAlign: 'left',
                    cursor: 'pointer'
                  }}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </button>
              </div>
            )
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="profile">
            <div className="profile-avatar">
              {ownerEmail ? ownerEmail.charAt(0).toUpperCase() : 'O'}
            </div>

            <div className="profile-copy">
              <strong>{ownerEmail || 'Owner account'}</strong>
              <span>
                {userRole
                  ? `${userRole.charAt(0).toUpperCase()}${userRole.slice(1)}`
                  : 'Employee'}
              </span>
            </div>

            <MoreHorizontal size={19} className="muted-icon" />
          </div>

          <button
            type="button"
            onClick={async () => {
              const confirmed = window.confirm(
                'Are you sure you want to sign out?'
              )

              if (!confirmed) return

              const { error } = await supabase.auth.signOut()

              if (error) window.alert(error.message)
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              padding: '12px 14px',
              marginTop: 12,
              border: '1px solid #f0dada',
              borderRadius: 9,
              background: '#fff',
              color: '#b42318',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <LogOut size={17} />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  )
}

function StatCard({ title, value, change, positive, icon: Icon, note }) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{title}</span>
        <div className="stat-icon"><Icon size={18} /></div>
      </div>

      <div className="stat-value">{value}</div>

      <div className="stat-foot">
        {change && (
          <span className={`trend ${positive ? 'trend-up' : 'trend-down'}`}>
            {positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {' '}{change}
          </span>
        )}
        <span className="stat-note">{note}</span>
      </div>
    </div>
  )
}

// --------------------------------------------------
// Chart helpers
// --------------------------------------------------

function buildHistogram(rows) {
  const values = rows
    .flatMap(row => [
      { type: 'Sales', value: Number(row.sales || 0) },
      { type: 'Purchases', value: Number(row.purchases || 0) }
    ])
    .filter(item => item.value > 0)

  if (!values.length) {
    return [
      { range: 'No activity', sales: 0, purchases: 0 }
    ]
  }

  const maxValue = Math.max(...values.map(item => item.value))
  const binCount = Math.min(6, Math.max(3, Math.ceil(Math.sqrt(values.length))))
  const binSize = maxValue / binCount || 1

  const bins = Array.from({ length: binCount }, (_, index) => {
    const lower = index * binSize
    const upper = index === binCount - 1
      ? maxValue
      : (index + 1) * binSize

    return {
      range: `${lower.toFixed(0)}–${upper.toFixed(0)}`,
      sales: 0,
      purchases: 0
    }
  })

  values.forEach(item => {
    const index = Math.min(
      binCount - 1,
      Math.floor(item.value / binSize)
    )

    if (item.type === 'Sales') {
      bins[index].sales += 1
    } else {
      bins[index].purchases += 1
    }
  })

  return bins
}

function ChartTooltip({ active, payload, label, currency }) {
  if (!active || !payload?.length) return null

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: 12,
      padding: '11px 14px',
      boxShadow: '0 8px 24px rgba(15,23,42,.10)'
    }}>
      <strong style={{ display: 'block', marginBottom: 7 }}>
        {label}
      </strong>

      {payload.map((item, index) => (
        <div
          key={`${item.dataKey}-${index}`}
          style={{
            color: item.color,
            fontSize: 12,
            marginTop: 4,
            fontWeight: 600
          }}
        >
          {item.name || item.dataKey}: {
            item.dataKey === 'frequency'
              ? item.value
              : formatTransactionAmount(item.value, currency)
          }
        </div>
      ))}
    </div>
  )
}

// --------------------------------------------------
// Overview dashboard
// --------------------------------------------------

function Overview({ businessName }) {
  const { currencyCode } = useCurrency()

  const [currentDate, setCurrentDate] = useState(() => new Date())

  const [chartPeriod, setChartPeriod] = useState('weekly')
  const [chartType, setChartType] = useState('bar')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')

  const [salesData, setSalesData] = useState([])
  const [transactions, setTransactions] = useState([])
  const [inventory, setInventory] = useState([])

  const [dashboardLoading, setDashboardLoading] = useState(true)
  const [dashboardError, setDashboardError] = useState('')

  const [dashboardTotals, setDashboardTotals] = useState({
    sales: createCurrencyTotals(),
    purchases: createCurrencyTotals(),
    expenses: createCurrencyTotals(),
    quantitySold: 0
  })

  const [savingsTotals, setSavingsTotals] = useState({
    deposits: createCurrencyTotals(),
    withdrawals: createCurrencyTotals(),
    balance: createCurrencyTotals()
  })

  const [outstandingSalary, setOutstandingSalary] = useState(
    createCurrencyTotals()
  )

  const todayKey = getHarareDateKey(currentDate)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDate(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!customStartDate) setCustomStartDate(getMonthStart(todayKey))
    if (!customEndDate) setCustomEndDate(todayKey)
  }, [todayKey, customStartDate, customEndDate])

  const chartRange = useMemo(() => {
    if (chartPeriod === 'weekly') {
      const start = getSundayOfWeek(todayKey)

      return {
        start,
        end: addDaysToDateKey(start, 6),
        label: 'Sunday – Saturday'
      }
    }

    if (chartPeriod === 'monthly') {
      return {
        start: getMonthStart(todayKey),
        end: todayKey,
        label: 'This month'
      }
    }

    if (chartPeriod === 'last_month') {
      return {
        ...getPreviousMonthRange(todayKey),
        label: 'Last month'
      }
    }

    return {
      start: customStartDate,
      end: customEndDate,
      label: 'Custom range'
    }
  }, [chartPeriod, todayKey, customStartDate, customEndDate])

  const customRangeInvalid = chartPeriod === 'custom' && (
    !isValidDateKey(chartRange.start) ||
    !isValidDateKey(chartRange.end) ||
    chartRange.start > chartRange.end
  )

  useEffect(() => {
    let cancelled = false

    async function loadDashboardData() {
      if (customRangeInvalid) {
        setDashboardError('Please select a valid custom date range.')
        setDashboardLoading(false)
        return
      }

      setDashboardLoading(true)
      setDashboardError('')

      try {
        const [
          chartSalesResult,
          todaySalesResult,
          chartPurchasesResult,
          todayPurchasesResult,
          expensesResult,
          inventoryResult,
          savingsResult,
          payrollResult
        ] = await Promise.all([
          supabase.rpc('cashier_get_sales_lines', {
            p_start_date: chartRange.start,
            p_end_date: chartRange.end
          }),

          supabase.rpc('cashier_get_sales_lines', {
            p_start_date: todayKey,
            p_end_date: todayKey
          }),

          supabase
            .from('purchases')
            .select(`
              purchase_date,
              item_name,
              quantity,
              unit,
              total_purchase,
              currency_code
            `)
            .gte('purchase_date', chartRange.start)
            .lte('purchase_date', chartRange.end)
            .order('purchase_date', { ascending: true }),

          supabase
            .from('purchases')
            .select(`
              purchase_date,
              item_name,
              quantity,
              unit,
              total_purchase,
              currency_code
            `)
            .eq('purchase_date', todayKey),

          supabase
            .from('expenses')
            .select('expense_date, amount, currency_code')
            .eq('expense_date', todayKey),

          supabase
            .from('menu_items')
            .select(`
              id,
              name,
              unit,
              current_quantity,
              minimum_quantity,
              active
            `)
            .eq('active', true)
            .order('name'),

          supabase
            .from('business_savings')
            .select('transaction_type, amount, currency_code'),

          supabase
            .from('staff_payroll_summary')
            .select('payroll_period_id, balance_due')
        ])

        const errors = [
          chartSalesResult.error,
          todaySalesResult.error,
          chartPurchasesResult.error,
          todayPurchasesResult.error,
          expensesResult.error,
          inventoryResult.error,
          savingsResult.error,
          payrollResult.error
        ].filter(Boolean)

        if (errors.length) {
          throw new Error(errors.map(error => error.message).join('; '))
        }

        const chartSales = chartSalesResult.data || []
        const todaySales = todaySalesResult.data || []
        const chartPurchases = chartPurchasesResult.data || []
        const todayPurchases = todayPurchasesResult.data || []
        const todayExpenses = expensesResult.data || []
        const savingsTransactions = savingsResult.data || []
        const payrollRows = payrollResult.data || []

        // Payroll currency belongs to its payroll period.
        const payrollPeriodIds = [
          ...new Set(
            payrollRows
              .map(row => row.payroll_period_id)
              .filter(Boolean)
          )
        ]

        let payrollPeriods = []

        if (payrollPeriodIds.length > 0) {
          const { data, error } = await supabase
            .from('staff_payroll_periods')
            .select('id, currency_code')
            .in('id', payrollPeriodIds)

          if (error) throw error

          payrollPeriods = data || []
        }

        const payrollCurrencyMap = new Map(
          payrollPeriods.map(period => [
            period.id,
            period.currency_code || 'USD'
          ])
        )

        if (cancelled) return

        // Today's cards are independent of the selected graph range.
        const salesTotals = createCurrencyTotals()
        const purchaseTotals = createCurrencyTotals()
        const expenseTotals = createCurrencyTotals()

        todaySales.forEach(item => {
          addCurrencyAmount(salesTotals, item.currency_code, item.sales_value)
        })

        todayPurchases.forEach(item => {
          addCurrencyAmount(
            purchaseTotals,
            item.currency_code,
            item.total_purchase
          )
        })

        todayExpenses.forEach(item => {
          addCurrencyAmount(expenseTotals, item.currency_code, item.amount)
        })

        const quantitySold = todaySales.reduce(
          (sum, item) => sum + Number(item.quantity_sold || 0),
          0
        )

        setDashboardTotals({
          sales: salesTotals,
          purchases: purchaseTotals,
          expenses: expenseTotals,
          quantitySold
        })

        // Savings totals by currency.
        const deposits = createCurrencyTotals()
        const withdrawals = createCurrencyTotals()

        savingsTransactions.forEach(item => {
          if (item.transaction_type === 'deposit') {
            addCurrencyAmount(deposits, item.currency_code, item.amount)
          }

          if (item.transaction_type === 'withdrawal') {
            addCurrencyAmount(withdrawals, item.currency_code, item.amount)
          }
        })

        const savingsBalance = createCurrencyTotals()

        Object.keys(savingsBalance).forEach(code => {
          savingsBalance[code] =
            Number(deposits[code] || 0) -
            Number(withdrawals[code] || 0)
        })

        setSavingsTotals({
          deposits,
          withdrawals,
          balance: savingsBalance
        })

        // Outstanding payroll by payroll currency.
        const salaryTotals = createCurrencyTotals()

        payrollRows.forEach(row => {
          const code = payrollCurrencyMap.get(row.payroll_period_id) || 'USD'
          addCurrencyAmount(salaryTotals, code, row.balance_due)
        })

        setOutstandingSalary(salaryTotals)

        // Build the selected date range, preserving every calendar day.
        const rangeLength = Math.floor(
          (
            new Date(`${chartRange.end}T12:00:00.000Z`).getTime() -
            new Date(`${chartRange.start}T12:00:00.000Z`).getTime()
          ) / 86400000
        ) + 1

        if (rangeLength > 0 && rangeLength <= 5000) {
          const rows = Array.from({ length: rangeLength }, (_, index) => {
            const date = addDaysToDateKey(chartRange.start, index)

            return {
              date,
              day: chartPeriod === 'weekly'
                ? getWeekdayFromDateKey(date)
                : getDateLabel(date),
              sales: 0,
              purchases: 0
            }
          })

          const selectedCurrency = String(currencyCode || 'USD').toUpperCase()
          const rowsByDate = new Map(rows.map(row => [row.date, row]))

          chartSales.forEach(item => {
            if (
              String(item.currency_code || 'USD').toUpperCase() !==
              selectedCurrency
            ) return

            const row = rowsByDate.get(item.sale_date)

            if (row) row.sales += Number(item.sales_value || 0)
          })

          chartPurchases.forEach(item => {
            if (
              String(item.currency_code || 'USD').toUpperCase() !==
              selectedCurrency
            ) return

            const row = rowsByDate.get(item.purchase_date)

            if (row) row.purchases += Number(item.total_purchase || 0)
          })

          setSalesData(rows)
        } else {
          setSalesData([])
        }

        setTransactions(
          todaySales.map(item => ({
            id: item.id,
            name: item.item_name,
            quantity: Number(item.quantity_sold || 0),
            unit: item.unit || '',
            amount: Number(item.sales_value || 0),
            currencyCode: item.currency_code || 'USD'
          }))
        )

        setInventory(inventoryResult.data || [])
      } catch (error) {
        if (!cancelled) {
          setDashboardError(
            error.message || 'Could not load dashboard data.'
          )
        }
      } finally {
        if (!cancelled) setDashboardLoading(false)
      }
    }

    loadDashboardData()

    const handleRefresh = () => loadDashboardData()

    window.addEventListener('refresh-canteen-dashboard', handleRefresh)

    return () => {
      cancelled = true
      window.removeEventListener('refresh-canteen-dashboard', handleRefresh)
    }
  }, [
    todayKey,
    chartRange.start,
    chartRange.end,
    chartPeriod,
    currencyCode,
    customRangeInvalid
  ])

  const selectedCurrency = currencyCode || 'USD'

  const selectedSales = Number(dashboardTotals.sales[selectedCurrency] || 0)
  const selectedPurchases = Number(dashboardTotals.purchases[selectedCurrency] || 0)
  const selectedExpenses = Number(dashboardTotals.expenses[selectedCurrency] || 0)

  const selectedCosts = selectedPurchases + selectedExpenses
  const selectedDifference = selectedSales - selectedCosts

  const chartSalesTotal = salesData.reduce(
    (sum, item) => sum + Number(item.sales || 0),
    0
  )

  const chartPurchasesTotal = salesData.reduce(
    (sum, item) => sum + Number(item.purchases || 0),
    0
  )

  const chartDifference = chartSalesTotal - chartPurchasesTotal

  const pieData = [
    { name: 'Sales', value: chartSalesTotal },
    { name: 'Purchases', value: chartPurchasesTotal }
  ].filter(item => item.value > 0)

  const histogramData = useMemo(
    () => buildHistogram(salesData),
    [salesData]
  )

  const hour = getHarareHour(currentDate)

  function renderSelectedChart() {
    const commonAxis = {
      axisLine: false,
      tickLine: false,
      tick: { fill: '#64748B', fontSize: 11 }
    }

    if (chartType === 'pie') {
      if (!pieData.length) {
        return (
          <div className="chart-empty">
            No sales or purchases recorded for this period.
          </div>
        )
      }

      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="48%"
              outerRadius="78%"
              innerRadius="42%"
              paddingAngle={5}
              stroke="#fff"
              strokeWidth={3}
              label={({ name, percent }) =>
                `${name} ${(percent * 100).toFixed(1)}%`
              }
            >
              {pieData.map((entry, index) => (
                <Cell
                  key={entry.name}
                  fill={
                    entry.name === 'Sales'
                      ? CHART_COLOURS.sales
                      : CHART_COLOURS.purchases
                  }
                />
              ))}
            </Pie>

            <Tooltip
              content={({ active, payload }) => (
                <ChartTooltip
                  active={active}
                  payload={payload}
                  currency={selectedCurrency}
                />
              )}
            />

            <Legend />
          </PieChart>
        </ResponsiveContainer>
      )
    }

    if (chartType === 'histogram') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={histogramData}
            margin={{ top: 12, right: 8, left: -12, bottom: 5 }}
          >
            <CartesianGrid stroke="#E2E8F0" strokeDasharray="4 4" vertical={false} />
            <XAxis dataKey="range" {...commonAxis} />
            <YAxis
              {...commonAxis}
              allowDecimals={false}
              label={{
                value: 'Number of days',
                angle: -90,
                position: 'insideLeft',
                fill: '#64748B',
                fontSize: 10
              }}
            />
            <Tooltip
              contentStyle={{
                border: '1px solid #E2E8F0',
                borderRadius: 12
              }}
            />
            <Legend />
            <Bar
              dataKey="sales"
              name="Sales frequency"
              fill={CHART_COLOURS.sales}
              radius={[7, 7, 0, 0]}
            />
            <Bar
              dataKey="purchases"
              name="Purchases frequency"
              fill={CHART_COLOURS.purchases}
              radius={[7, 7, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      )
    }

    if (chartType === 'line') {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={salesData}
            margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
          >
            <CartesianGrid stroke="#E2E8F0" strokeDasharray="4 4" vertical={false} />
            <XAxis dataKey="day" {...commonAxis} dy={9} />
            <YAxis
              {...commonAxis}
              tickFormatter={value =>
                formatTransactionAmount(value, selectedCurrency)
              }
            />
            <Tooltip
              content={({ active, payload, label }) => (
                <ChartTooltip
                  active={active}
                  payload={payload}
                  label={label}
                  currency={selectedCurrency}
                />
              )}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="sales"
              name="Sales"
              stroke={CHART_COLOURS.sales}
              strokeWidth={3.5}
              dot={{ r: 4, fill: CHART_COLOURS.sales, strokeWidth: 0 }}
              activeDot={{ r: 7 }}
            />
            <Line
              type="monotone"
              dataKey="purchases"
              name="Purchases"
              stroke={CHART_COLOURS.purchases}
              strokeWidth={3.5}
              dot={{ r: 4, fill: CHART_COLOURS.purchases, strokeWidth: 0 }}
              activeDot={{ r: 7 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )
    }

    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={salesData}
          margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
          barGap={5}
        >
          <CartesianGrid stroke="#E2E8F0" strokeDasharray="4 4" vertical={false} />
          <XAxis dataKey="day" {...commonAxis} dy={9} />
          <YAxis
            {...commonAxis}
            tickFormatter={value =>
              formatTransactionAmount(value, selectedCurrency)
            }
          />
          <Tooltip
            content={({ active, payload, label }) => (
              <ChartTooltip
                active={active}
                payload={payload}
                label={label}
                currency={selectedCurrency}
              />
            )}
          />
          <Legend />
          <Bar
            dataKey="sales"
            name="Sales"
            fill={CHART_COLOURS.sales}
            radius={[7, 7, 0, 0]}
            maxBarSize={34}
          />
          <Bar
            dataKey="purchases"
            name="Purchases"
            fill={CHART_COLOURS.purchases}
            radius={[7, 7, 0, 0]}
            maxBarSize={34}
          />
        </BarChart>
      </ResponsiveContainer>
    )
  }

  return (
    <div className="page-content">
      <div className="welcome-row">
        <div>
          <div className="zimbabwe-clock">
            <div className="zimbabwe-clock-label">
              <span className="clock-live-dot" />
              ZIMBABWE TIME · CAT (UTC+2)
            </div>

            <div className="zimbabwe-clock-time">
              {formatHarareClock(currentDate)}
            </div>

            <div className="zimbabwe-clock-date">
              {formatHarareDate(currentDate, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
            </div>
          </div>


          <h1>
            {hour < 12
              ? 'Good morning'
              : hour < 17
                ? 'Good afternoon'
                : 'Good evening'}
            {' '}<span className="wave">✳</span>
          </h1>

          <p>Here’s what’s happening with {businessName} today.</p>
        </div>

        <div className="welcome-actions">
          <button
            className="button button-light"
            disabled={dashboardLoading}
            onClick={() => window.dispatchEvent(
              new Event('refresh-canteen-dashboard')
            )}
          >
            <RefreshCw size={16} />
            {dashboardLoading ? 'Refreshing...' : 'Refresh'}
          </button>

          <button className="button button-light">
            <CalendarDays size={16} />
            Today
            <ChevronDown size={14} />
          </button>

          <button
            className="button button-primary"
            onClick={() => window.dispatchEvent(
              new CustomEvent('navigate-canteen', {
                detail: 'Daily Sales'
              })
            )}
          >
            <Plus size={17} />
            New sale
          </button>

          <button
            className="button button-light"
            onClick={() => window.dispatchEvent(
              new CustomEvent('navigate-canteen', {
                detail: 'Business Savings'
              })
            )}
          >
            <PiggyBank size={17} />
            Business Savings
          </button>
        </div>
      </div>

      {dashboardLoading && (
        <div className="panel" style={{ padding: 16, marginBottom: 20 }}>
          Loading your business records from Supabase...
        </div>
      )}

      {dashboardError && (
        <div className="panel" style={{
          padding: 16,
          marginBottom: 20,
          color: '#b42318'
        }}>
          Could not load dashboard data: {dashboardError}
        </div>
      )}

      <div className="stats-grid">
        <StatCard
          title="Today's sales"
          value={
            <CurrencyLines
              totals={dashboardTotals.sales}
              preferredCurrency={selectedCurrency}
            />
          }
          note="Recorded sales today · By currency"
          icon={Wallet}
        />

        <StatCard
          title="Items sold"
          value={dashboardTotals.quantitySold.toLocaleString()}
          note="Total quantity sold today"
          icon={ReceiptText}
        />

        <StatCard
          title="Total recorded costs"
          value={
            <CurrencyLines
              totals={Object.keys(dashboardTotals.purchases).reduce((result, code) => {
                result[code] =
                  Number(dashboardTotals.purchases[code] || 0) +
                  Number(dashboardTotals.expenses[code] || 0)
                return result
              }, {})}
              preferredCurrency={selectedCurrency}
            />
          }
          note="Purchases + expenses today · By currency"
          icon={ShoppingBasket}
        />

        <StatCard
          title="Outstanding staff salaries"
          value={
            <CurrencyLines
              totals={outstandingSalary}
              preferredCurrency={selectedCurrency}
            />
          }
          note="Unpaid staff salary balances · By currency"
          icon={Users}
        />

        <StatCard
          title="Sales less costs"
          value={
            <CurrencyLines
              totals={Object.keys(dashboardTotals.sales).reduce((result, code) => {
                result[code] =
                  Number(dashboardTotals.sales[code] || 0) -
                  Number(dashboardTotals.purchases[code] || 0) -
                  Number(dashboardTotals.expenses[code] || 0)
                return result
              }, {})}
              preferredCurrency={selectedCurrency}
            />
          }
          note="Sales − purchases − expenses · By currency"
          icon={TrendingUp}
        />

        <StatCard
          title="Business savings balance"
          value={
            <CurrencyLines
              totals={savingsTotals.balance}
              preferredCurrency={selectedCurrency}
            />
          }
          note="Deposits less withdrawals · By currency"
          icon={PiggyBank}
        />

        <StatCard
          title="Total savings deposits"
          value={
            <CurrencyLines
              totals={savingsTotals.deposits}
              preferredCurrency={selectedCurrency}
            />
          }
          note="All recorded deposits · By currency"
          icon={ArrowDownRight}
        />

        <StatCard
          title="Total savings withdrawals"
          value={
            <CurrencyLines
              totals={savingsTotals.withdrawals}
              preferredCurrency={selectedCurrency}
            />
          }
          note="All recorded withdrawals · By currency"
          icon={ArrowUpRight}
        />
      </div>

      <div className="main-grid">
        <section className="panel sales-panel">
          <div className="panel-heading">
            <div>
              <h3>Sales overview</h3>
              <p>
                {chartRange.label} · {getDateLabel(chartRange.start, true)}
                {' – '}
                {getDateLabel(chartRange.end, true)}
                {' · '}
                {selectedCurrency} only
              </p>
            </div>

            <button
              type="button"
              className="button button-light"
              onClick={() => window.dispatchEvent(
                new Event('refresh-canteen-dashboard')
              )}
            >
              <RefreshCw size={15} />
              Refresh graph
            </button>
          </div>

          <div style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            alignItems: 'center',
            margin: '18px 0'
          }}>
            <label style={{
              display: 'grid',
              gap: 5,
              fontSize: 11,
              fontWeight: 700,
              color: '#64748B'
            }}>
              REPORTING PERIOD
              <select
                className="select-control"
                value={chartPeriod}
                onChange={event => setChartPeriod(event.target.value)}
                style={{
                  minWidth: 145,
                  padding: '9px 12px',
                  border: '1px solid #CBD5E1',
                  borderRadius: 9,
                  background: '#fff',
                  color: '#1E293B',
                  fontWeight: 600
                }}
              >
                <option value="weekly">Weekly (Sun–Sat)</option>
                <option value="monthly">Monthly</option>
                <option value="last_month">Last Month</option>
                <option value="custom">Custom Range</option>
              </select>
            </label>

            {chartPeriod === 'custom' && (
              <>
                <label style={{
                  display: 'grid',
                  gap: 5,
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#64748B'
                }}>
                  START DATE
                  <input
                    type="date"
                    value={customStartDate}
                    max={customEndDate || undefined}
                    onChange={event => setCustomStartDate(event.target.value)}
                    style={{
                      padding: '9px 10px',
                      border: '1px solid #CBD5E1',
                      borderRadius: 9,
                      color: '#1E293B'
                    }}
                  />
                </label>

                <label style={{
                  display: 'grid',
                  gap: 5,
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#64748B'
                }}>
                  END DATE
                  <input
                    type="date"
                    value={customEndDate}
                    min={customStartDate || undefined}
                    onChange={event => setCustomEndDate(event.target.value)}
                    style={{
                      padding: '9px 10px',
                      border: '1px solid #CBD5E1',
                      borderRadius: 9,
                      color: '#1E293B'
                    }}
                  />
                </label>
              </>
            )}

            <label style={{
              display: 'grid',
              gap: 5,
              fontSize: 11,
              fontWeight: 700,
              color: '#64748B'
            }}>
              CHART TYPE
              <select
                className="select-control"
                value={chartType}
                onChange={event => setChartType(event.target.value)}
                style={{
                  minWidth: 145,
                  padding: '9px 12px',
                  border: '1px solid #CBD5E1',
                  borderRadius: 9,
                  background: '#fff',
                  color: '#1E293B',
                  fontWeight: 600
                }}
              >
                <option value="bar">Bar Chart</option>
                <option value="pie">Pie Chart</option>
                <option value="histogram">Histogram</option>
                <option value="line">Line Graph</option>
              </select>
            </label>
          </div>

          {customRangeInvalid && (
            <div style={{
              padding: 12,
              marginBottom: 12,
              borderRadius: 9,
              background: '#FEF2F2',
              color: '#B91C1C',
              fontSize: 13
            }}>
              Select valid start and end dates. The end date must not be
              earlier than the start date.
            </div>
          )}

          <div className="chart-legend" style={{ marginBottom: 12 }}>
            <span>
              <i
                className="legend-dot"
                style={{ background: CHART_COLOURS.sales }}
              />
              Sales ({selectedCurrency})
            </span>

            <span>
              <i
                className="legend-dot"
                style={{ background: CHART_COLOURS.purchases }}
              />
              Purchases ({selectedCurrency})
            </span>
          </div>

          <div className="chart-wrap" style={{ minHeight: 300 }}>
            {salesData.length === 0 ? (
              <div className="chart-empty">
                {dashboardLoading
                  ? 'Loading graph data...'
                  : 'No graph data is available for this period.'}
              </div>
            ) : (
              renderSelectedChart()
            )}
          </div>

          <div className="chart-summary">
            <div>
              <span>Total sales</span>
              <strong>
                {formatTransactionAmount(chartSalesTotal, selectedCurrency)}
              </strong>
            </div>

            <div>
              <span>Total purchases</span>
              <strong>
                {formatTransactionAmount(chartPurchasesTotal, selectedCurrency)}
              </strong>
            </div>

            <div>
              <span>Difference</span>
              <strong className={chartDifference >= 0 ? 'green-text' : ''}>
                {formatTransactionAmount(chartDifference, selectedCurrency)}
              </strong>
            </div>
          </div>
        </section>

        <section className="panel stock-panel">
          <div className="panel-heading">
            <div>
              <h3>Stock watch</h3>
              <p>Items that need your attention</p>
            </div>

            <button className="icon-button">
              <MoreHorizontal size={19} />
            </button>
          </div>

          <div className="stock-alert">
            <CircleAlert size={17} />
            <span>
              <strong>
                {inventory.filter(item =>
                  Number(item.current_quantity || 0) <=
                  Number(item.minimum_quantity || 0)
                ).length} items
              </strong>
              {' '}are at or below their minimum stock level
            </span>
          </div>

          <div className="stock-list">
            {inventory.length === 0 ? (
              <p>No active stock items have been added yet.</p>
            ) : (
              inventory.map(item => {
                const isLow =
                  Number(item.current_quantity || 0) <=
                  Number(item.minimum_quantity || 0)

                return (
                  <div className="stock-row" key={item.id}>
                    <div className="stock-info">
                      <div>
                        <strong>{item.name}</strong>
                        <span>
                          Minimum: {item.minimum_quantity} {item.unit}
                        </span>
                      </div>

                      <div className="stock-qty">
                        <strong>
                          {Number(item.current_quantity || 0)} {item.unit}
                        </strong>

                        <span className={isLow ? 'low-label' : 'healthy-label'}>
                          {isLow ? 'Low stock' : 'Good stock'}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <button
            className="text-link"
            onClick={() => window.dispatchEvent(
              new CustomEvent('navigate-canteen', { detail: 'Inventory' })
            )}
          >
            View inventory <ArrowUpRight size={14} />
          </button>
        </section>
      </div>

      <section className="panel transactions-panel">
        <div className="panel-heading">
          <div>
            <h3>Today's sales by item</h3>
            <p>Recorded quantities and sales values for today</p>
          </div>

          <button
            className="text-link"
            onClick={() => window.dispatchEvent(
              new CustomEvent('navigate-canteen', { detail: 'Daily Sales' })
            )}
          >
            View all sales <ArrowUpRight size={14} />
          </button>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>ITEM</th>
                <th>QUANTITY SOLD</th>
                <th>SALES VALUE</th>
              </tr>
            </thead>

            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan="3" className="muted-cell">
                    No sales have been recorded today.
                  </td>
                </tr>
              ) : (
                transactions.map((transaction, index) => (
                  <tr key={transaction.id || `${transaction.name}-${index}`}>
                    <td>
                      <div className="transaction-name">
                        <div className="transaction-icon green">
                          <ReceiptText size={17} />
                        </div>
                        <strong>{transaction.name}</strong>
                      </div>
                    </td>

                    <td className="muted-cell">
                      {transaction.quantity} {transaction.unit}
                    </td>

                    <td className="amount-cell">
                      {formatTransactionAmount(
                        transaction.amount,
                        transaction.currencyCode
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="footer-note">
        <span>
          © {formatHarareDate(currentDate, { year: 'numeric' })} {businessName}
        </span>

        <span>
          <span className="secure-dot" />
          Your workspace · {selectedCurrency} · Zimbabwe time
        </span>
      </div>
    </div>
  )
}

// --------------------------------------------------
// Placeholder page
// --------------------------------------------------

function PlaceholderPage({ active }) {
  const descriptions = {
    'Daily Sales': 'Record daily sales, quantities sold and your day-to-day revenue.',
    'Purchases': 'Track supplier purchases, quantities, unit costs and purchase history.',
    'Inventory': 'Monitor ready-made product stock, stock movements and restocking.',
    'Cash Management': 'Record opening cash, expected closing cash and cash counted.',
    'Expenses': 'Record and manage operating costs, staff salaries, rent, utilities and other expenses.',
    'Reports & Analytics': 'Explore daily, weekly and monthly sales, purchase and expense reports.',
    'Settings': 'Configure your canteen details, currency, preferences and account.'
  }

  const Icon = navItems.find(item => item.label === active)?.icon || Package

  return (
    <div className="page-content placeholder-page">
      <div className="welcome-row">
        <div>
          <div className="eyebrow">WORKSPACE / {active.toUpperCase()}</div>
          <h1>{active}</h1>
          <p>{descriptions[active]}</p>
        </div>

        <button className="button button-light">
          <SettingsIcon size={16} />
          Configure
        </button>
      </div>

      <div className="empty-state panel">
        <div className="empty-icon"><Icon size={27} /></div>
        <h2>{active} workspace</h2>
        <p>
          This module will be connected to your Supabase database
          in the next development phase.
        </p>

        <div className="empty-actions">
          <span><CheckCircle2 size={15} /> Dashboard interface ready</span>
          <span><Clock3 size={15} /> Database connection pending</span>
        </div>
      </div>
    </div>
  )
}

// --------------------------------------------------
// Main application
// --------------------------------------------------

export default function App() {
  const [active, setActive] = useState('Overview')

  const [businessName, setBusinessName] = useState('Canteen')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [userRole, setUserRole] = useState('')

  const [roleLoading, setRoleLoading] = useState(true)
  const [roleError, setRoleError] = useState('')
  const [currentUserId, setCurrentUserId] = useState('')

  const [notifications, setNotifications] = useState([])
  const [notificationLoading, setNotificationLoading] = useState(false)
  const [notificationError, setNotificationError] = useState('')
  const [notificationOpen, setNotificationOpen] = useState(false)

  const [mobileOpen, setMobileOpen] = useState(false)
  const [search, setSearch] = useState('')

  const unreadNotificationCount = notifications.filter(
    notification => !notification.is_read
  ).length

  useEffect(() => {
    let cancelled = false

    async function loadBusinessName() {
      const { data, error } = await supabase
        .from('canteen_settings')
        .select('business_name')
        .eq('id', true)
        .maybeSingle()

      if (cancelled) return

      if (error) {
        console.error('Could not load business name:', error.message)
        return
      }

      setBusinessName(data?.business_name?.trim() || 'Canteen')
    }

    async function loadOwnerAccount() {
      setRoleLoading(true)
      setRoleError('')

      try {
        const { data, error } = await supabase.auth.getUser()

        if (error || !data?.user) {
          throw new Error('Unable to verify your signed-in account.')
        }

        if (cancelled) return

        setOwnerEmail(data.user.email || '')
        setCurrentUserId(data.user.id)

        const { data: roleData, error: roleQueryError } = await supabase
          .from('employee_roles')
          .select('role, is_active')
          .eq('user_id', data.user.id)
          .maybeSingle()

        if (roleQueryError) throw roleQueryError

        if (!roleData || !roleData.is_active) {
          throw new Error(
            'Your employee account is inactive or has no assigned role. Please contact the canteen owner.'
          )
        }

        const allowedRoles = ['owner', 'manager', 'cashier']

        if (!allowedRoles.includes(roleData.role)) {
          throw new Error(
            'Your account has an unrecognized role. Please contact the canteen owner.'
          )
        }

        if (!cancelled) setUserRole(roleData.role)
      } catch (error) {
        console.error('Account permission check failed:', error)

        if (!cancelled) {
          setUserRole('')
          setRoleError(error.message || 'Unable to verify account permissions.')
        }
      } finally {
        if (!cancelled) setRoleLoading(false)
      }
    }

    loadBusinessName()
    loadOwnerAccount()

    return () => {
      cancelled = true
    }
  }, [])

  async function loadNotifications() {
    if (!currentUserId) return

    setNotificationLoading(true)
    setNotificationError('')

    try {
      const { data, error } = await supabase
        .from('app_notifications')
        .select(`
          id,
          title,
          message,
          notification_type,
          related_table,
          related_record_id,
          is_read,
          created_at,
          read_at
        `)
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: false })
        .limit(30)

      if (error) throw error

      setNotifications(data || [])
    } catch (error) {
      console.error('Notification loading failed:', error)
      setNotificationError(error.message || 'Could not load notifications.')
    } finally {
      setNotificationLoading(false)
    }
  }

  async function markNotificationRead(notificationId) {
    const readAt = new Date().toISOString()

    const { error } = await supabase
      .from('app_notifications')
      .update({ is_read: true, read_at: readAt })
      .eq('id', notificationId)
      .eq('user_id', currentUserId)
      .eq('is_read', false)

    if (error) {
      setNotificationError(error.message || 'Could not update notification.')
      return
    }

    setNotifications(current =>
      current.map(notification =>
        notification.id === notificationId
          ? { ...notification, is_read: true, read_at: readAt }
          : notification
      )
    )
  }

  async function markAllNotificationsRead() {
    const readAt = new Date().toISOString()

    const { error } = await supabase
      .from('app_notifications')
      .update({ is_read: true, read_at: readAt })
      .eq('user_id', currentUserId)
      .eq('is_read', false)

    if (error) {
      setNotificationError(error.message || 'Could not update notifications.')
      return
    }

    setNotifications(current =>
      current.map(notification => ({
        ...notification,
        is_read: true,
        read_at: notification.read_at || readAt
      }))
    )
  }

  function formatNotificationDate(value) {
    if (!value) return ''

    return new Date(value).toLocaleString('en-GB', {
      timeZone: BUSINESS_TIME_ZONE,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  useEffect(() => {
    if (currentUserId) loadNotifications()
  }, [currentUserId])

  useEffect(() => {
    const handler = event => setActive(event.detail)

    window.addEventListener('navigate-canteen', handler)

    return () => {
      window.removeEventListener('navigate-canteen', handler)
    }
  }, [])

  function renderPage() {
    if (roleLoading) {
      return (
        <div className="page-content">
          <div className="panel" style={{ padding: 24 }}>
            Loading account permissions...
          </div>
        </div>
      )
    }

    if (!userRole) {
      return (
        <div className="page-content">
          <div className="panel" style={{ padding: 24 }}>
            <h2>Access Denied</h2>
            <p>
              {roleError ||
                'Your account does not have an active employee role.'}
            </p>
            <button onClick={() => supabase.auth.signOut()}>
              Sign out
            </button>
          </div>
        </div>
      )
    }

    if (userRole === 'manager') {
      if (active === 'Manager Dashboard') return <ManagerDashboard />
      if (active === 'Purchases') return <Purchases />
      if (active === 'Inventory') return <Inventory />

      return (
        <div className="page-content">
          <div className="panel" style={{ padding: 24 }}>
            <h2>Access Restricted</h2>
            <p>You do not have permission to access this module.</p>
          </div>
        </div>
      )
    }

    if (userRole === 'cashier') {
      if (active === 'Cashier POS') {
        return (
          <CashierPOS
            businessName={businessName}
            ownerEmail={ownerEmail}
          />
        )
      }

      return (
        <div className="page-content">
          <div className="panel" style={{ padding: 24 }}>
            <h2>Access Restricted</h2>
            <p>You only have access to the Cashier POS.</p>
          </div>
        </div>
      )
    }

    if (userRole !== 'owner') {
      return (
        <div className="page-content">
          <div className="panel" style={{ padding: 24 }}>
            <h2>Access Restricted</h2>
            <p>Your employee dashboard is not available.</p>
          </div>
        </div>
      )
    }

    if (active === 'Overview') return <Overview businessName={businessName} />
    if (active === 'Manager Dashboard') return <ManagerDashboard />

    if (active === 'Cashier POS') {
      return (
        <CashierPOS
          businessName={businessName}
          ownerEmail={ownerEmail}
        />
      )
    }
    if (active === 'Online Orders') {
      return <OnlineOrders />
    }
    if (active === 'Menu & Products') return <MenuProducts />
    if (active === 'Staff Benefits') return <OwnerBenefitReviews />
    if (active === 'Purchases') return <Purchases />
    if (active === 'Daily Sales') return <DailySales />
    if (active === 'Inventory') return <Inventory />
    if (active === 'Cash Management') return <CashManagement />
    if (active === 'Expenses') return <Expenses />
    if (active === 'Reports & Analytics') return <ReportsAnalytics />
    if (active === 'Profit & Loss') return <FinancialStatements initialView="profit-loss" />
    if (active === 'Detailed Transactions') return <FinancialStatements initialView="transactions" />
    if (active === 'Product Profitability') return <FinancialStatements initialView="products" />
    if (active === 'Expense Breakdown') return <FinancialStatements initialView="expenses" />
    if (active === 'Settings') return <Settings />
    if (active === 'Startup Funding') return <StartupFunding />
    if (active === 'Business Savings') return <BusinessSavings />
    if (active === 'Staff & Payroll') return <StaffPayroll userRole={userRole} />

    return <PlaceholderPage active={active} />
  }

  return (
    <div className="app-shell">
      <Sidebar
        active={active}
        setActive={setActive}
        open={mobileOpen}
        setOpen={setMobileOpen}
        businessName={businessName}
        ownerEmail={ownerEmail}
        userRole={userRole}
      />

      <main className="main-area">
        <header className="topbar">
          <button
            className="mobile-menu"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={21} />
          </button>

          <div className="breadcrumb">
            Workspace
            <ChevronRight size={14} />
            <strong>{active}</strong>
          </div>

          <div className="topbar-right">
            <label className="search-box">
              <Search size={16} />
              <input
                placeholder="Search anything..."
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
              <kbd>⌘ K</kbd>
            </label>

            <div className="notification-wrapper">
              <button
                type="button"
                className="notification-button"
                onClick={() => {
                  const willOpen = !notificationOpen
                  setNotificationOpen(willOpen)
                  if (willOpen) loadNotifications()
                }}
                aria-label="Notifications"
                aria-expanded={notificationOpen}
              >
                <Bell size={18} />

                {unreadNotificationCount > 0 && (
                  <span className="notification-count">
                    {unreadNotificationCount > 99
                      ? '99+'
                      : unreadNotificationCount}
                  </span>
                )}
              </button>

              {notificationOpen && (
                <div className="notification-panel">
                  <div className="notification-panel-header">
                    <div>
                      <strong>Notifications</strong>
                      <span>{unreadNotificationCount} unread</span>
                    </div>

                    {unreadNotificationCount > 0 && (
                      <button
                        type="button"
                        className="notification-mark-all"
                        onClick={markAllNotificationsRead}
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  {notificationLoading && (
                    <div className="notification-empty">
                      Loading notifications...
                    </div>
                  )}

                  {notificationError && (
                    <div className="notification-error">
                      {notificationError}
                    </div>
                  )}

                  {!notificationLoading &&
                    !notificationError &&
                    notifications.length === 0 && (
                      <div className="notification-empty">
                        <Bell size={22} />
                        <strong>No notifications yet</strong>
                        <span>New updates will appear here.</span>
                      </div>
                    )}

                  {!notificationLoading &&
                    notifications.length > 0 && (
                      <div className="notification-list">
                        {notifications.map(notification => (
                          <button
                            type="button"
                            key={notification.id}
                            className={`notification-item ${notification.is_read ? '' : 'unread'
                              }`}
                            onClick={() => {
                              if (!notification.is_read) {
                                markNotificationRead(notification.id)
                              }
                            }}
                          >
                            <span className="notification-item-indicator" />

                            <span className="notification-item-content">
                              <strong>{notification.title}</strong>
                              <span>{notification.message}</span>
                              <small>
                                {formatNotificationDate(notification.created_at)}
                              </small>
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                </div>
              )}
            </div>

            <div className="topbar-divider" />

            <div className="topbar-user">
              <div className="profile-avatar">
                {ownerEmail ? ownerEmail.charAt(0).toUpperCase() : 'O'}
              </div>
              <ChevronDown size={14} />
            </div>
          </div>
        </header>

        {renderPage()}
      </main>
    </div>
  )
}
