import { useEffect, useState } from 'react'

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
  Sparkles,
  Package,
  LogOut,
  ClipboardList,
  Users
} from 'lucide-react'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts'

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
import { useCurrency } from './CurrencyContext'
import { supabase } from './supabase'


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
  { label: 'Settings', icon: SettingsIcon }
]
function Sidebar({
  active,
  setActive,
  open,
  setOpen,
  businessName,
  ownerEmail,
  userRole
}) {
  return <>
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
          <span>{userRole ? `${userRole.charAt(0).toUpperCase()}${userRole.slice(1)} workspace` : 'Loading workspace...'}</span>
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
        {(userRole === 'owner'
          ? navItems
          : userRole === 'manager'
            ? navItems.filter(item =>
              [
                'Manager Dashboard',
                'Purchases',
                'Inventory'
              ].includes(item.label)
            )
            : userRole === 'cashier'
              ? navItems.filter(item =>
                ['Cashier POS'].includes(item.label)
              )
              : []
        ).map(item => {
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
            <strong>
              {ownerEmail || 'Owner account'}
            </strong>
            <span>{userRole ? `${userRole.charAt(0).toUpperCase()}${userRole.slice(1)}` : 'Employee'}</span>
          </div>
          <MoreHorizontal size={19} className="muted-icon" />
        </div>
        <button
          type="button"
          onClick={async () => {
            const confirmed = window.confirm('Are you sure you want to sign out?')
            if (!confirmed) return

            const { error } = await supabase.auth.signOut()

            if (error) {
              window.alert(error.message)
            }
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
    </aside >
  </>
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

function Overview({ businessName }) {

  const { formatCurrency, currencyCode } = useCurrency()
  const [currentDate, setCurrentDate] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDate(new Date())
    }, 60000)

    return () => clearInterval(timer)
  }, [])
  const [salesData, setSalesData] = useState([])
  const [transactions, setTransactions] = useState([])
  const [inventory, setInventory] = useState([])
  const [dashboardLoading, setDashboardLoading] = useState(true)
  const [dashboardError, setDashboardError] = useState('')
  const [dashboardTotals, setDashboardTotals] = useState({
    sales: 0,
    purchases: 0,
    expenses: 0,
    quantitySold: 0
  })
  const [savingsTotals, setSavingsTotals] = useState({
    deposits: 0,
    withdrawals: 0,
    balance: 0
  })
  const [outstandingSalary, setOutstandingSalary] = useState(0)

  useEffect(() => {
    async function loadDashboardData() {
      setDashboardLoading(true)
      setDashboardError('')

      try {
        const today = new Date()
        const dateKey = date => {
          const year = date.getFullYear()
          const month = String(date.getMonth() + 1).padStart(2, '0')
          const day = String(date.getDate()).padStart(2, '0')
          return `${year}-${month}-${day}`
        }

        const todayKey = dateKey(today)
        const weekStart = new Date(today)
        weekStart.setDate(today.getDate() - 6)
        const weekStartKey = dateKey(weekStart)

        const [
          salesResult,
          purchasesResult,
          expensesResult,
          inventoryResult,
          savingsResult,
          payrollResult
        ] = await Promise.all([
          supabase.rpc('cashier_get_sales_lines', {
            p_start_date: weekStartKey,
            p_end_date: todayKey
          }),


          supabase
            .from('purchases')
            .select('purchase_date, item_name, quantity, unit, total_purchase')
            .gte('purchase_date', weekStartKey)
            .lte('purchase_date', todayKey)
            .order('purchase_date', { ascending: false }),

          supabase
            .from('expenses')
            .select('expense_date, amount')
            .eq('expense_date', todayKey),

          supabase
            .from('menu_items')
            .select('id, name, unit, current_quantity, minimum_quantity, active')
            .eq('active', true)
            .order('name'),
          supabase
            .from('business_savings')
            .select('transaction_type, amount'),
          supabase
            .from('staff_payroll_summary')
            .select('balance_due')
        ])
        const outstandingSalaryTotal = (payrollResult.data || []).reduce(
          (total, row) => total + Number(row.balance_due || 0),
          0
        )

        setOutstandingSalary(outstandingSalaryTotal)

        const errors = [
          salesResult.error,
          purchasesResult.error,
          expensesResult.error,
          inventoryResult.error,
          savingsResult.error,
          payrollResult.error
        ].filter(Boolean)

        if (errors.length) {
          throw new Error(errors.map(error => error.message).join('; '))
        }

        const sales = salesResult.data || []
        const purchases = purchasesResult.data || []
        const todaySales = sales.filter(item => item.sale_date === todayKey)
        const todayPurchases = purchases.filter(item => item.purchase_date === todayKey)
        const todayExpenses = expensesResult.data || []
        const savingsTransactions = savingsResult.data || []

        const totalSavingsDeposits = savingsTransactions
          .filter(item => item.transaction_type === 'deposit')
          .reduce((sum, item) => sum + Number(item.amount || 0), 0)

        const totalSavingsWithdrawals = savingsTransactions
          .filter(item => item.transaction_type === 'withdrawal')
          .reduce((sum, item) => sum + Number(item.amount || 0), 0)

        setSavingsTotals({
          deposits: totalSavingsDeposits,
          withdrawals: totalSavingsWithdrawals,
          balance: totalSavingsDeposits - totalSavingsWithdrawals
        })

        setDashboardTotals({
          sales: todaySales.reduce(
            (sum, item) => sum + Number(item.sales_value || 0), 0
          ),
          purchases: todayPurchases.reduce(
            (sum, item) => sum + Number(item.total_purchase || 0), 0
          ),
          expenses: todayExpenses.reduce(
            (sum, item) => sum + Number(item.amount || 0), 0
          ),
          quantitySold: todaySales.reduce(
            (sum, item) => sum + Number(item.quantity_sold || 0), 0
          )
        })

        const lastSevenDays = Array.from({ length: 7 }, (_, index) => {
          const date = new Date(weekStart)
          date.setDate(weekStart.getDate() + index)
          const key = dateKey(date)

          return {
            day: date.toLocaleDateString('en-US', { weekday: 'short' }),
            sales: 0,
            purchases: 0,
            date: key
          }
        })

        sales.forEach(item => {
          const day = lastSevenDays.find(row => row.date === item.sale_date)
          if (day) day.sales += Number(item.sales_value || 0)
        })

        purchases.forEach(item => {
          const day = lastSevenDays.find(row => row.date === item.purchase_date)
          if (day) day.purchases += Number(item.total_purchase || 0)
        })

        setSalesData(lastSevenDays)

        setTransactions(
          sales
            .filter(item => item.sale_date === todayKey)
            .map(item => ({
              name: item.item_name,
              quantity: Number(item.quantity_sold || 0),
              unit: item.unit || '',
              amount: Number(item.sales_value || 0)
            }))
        )

        setInventory(inventoryResult.data || [])

      } catch (error) {
        setDashboardError(error.message || 'Could not load dashboard data.')
      } finally {
        setDashboardLoading(false)
      }
    }

    loadDashboardData()

    const handleRefresh = () => {
      loadDashboardData()
    }

    window.addEventListener('refresh-canteen-dashboard', handleRefresh)

    return () => {
      window.removeEventListener('refresh-canteen-dashboard', handleRefresh)
    }
  }, [currentDate.toDateString()])


  return (
    <div className="page-content">
      <div className="welcome-row">
        <div>
          <div className="eyebrow">
            {currentDate.toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            }).toUpperCase()}
          </div>
          <h1>
            {currentDate.getHours() < 12
              ? 'Good morning'
              : currentDate.getHours() < 17
                ? 'Good afternoon'
                : 'Good evening'}
            {' '}<span className="wave">✳</span>
          </h1>
          <p>Here’s what’s happening with your canteen today.</p>
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
            <CalendarDays size={16} /> Today <ChevronDown size={14} />
          </button>

          <button
            className="button button-primary"
            onClick={() => window.dispatchEvent(
              new CustomEvent('navigate-canteen', { detail: 'Daily Sales' })
            )}
          >
            <Plus size={17} /> New sale
          </button>
          <button
            className="button button-light"
            onClick={() => window.dispatchEvent(
              new CustomEvent('navigate-canteen', {
                detail: 'Business Savings'
              })
            )}
          >
            <PiggyBank size={17} /> Business Savings
          </button>
        </div>
      </div>



      <div className="stats-grid">
        {dashboardLoading && (
          <div className="panel" style={{ padding: '16px', marginBottom: '20px' }}>
            Loading your business records from Supabase...
          </div>
        )}

        {dashboardError && (
          <div
            className="panel"
            style={{
              padding: '16px',
              marginBottom: '20px',
              color: '#b42318'
            }}
          >
            Could not load dashboard data: {dashboardError}
          </div>
        )}
        <StatCard
          title="Today's sales"
          value={formatCurrency(dashboardTotals.sales)}
          note="Recorded sales today"
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
          value={formatCurrency(
            dashboardTotals.purchases + dashboardTotals.expenses
          )}
          note="Purchases + expenses today"
          icon={ShoppingBasket}
        />
        <StatCard
          title="Outstanding staff salaries"
          value={formatCurrency(outstandingSalary)}
          note="Unpaid staff salary balances"
          icon={Users}
        />

        <StatCard
          title="Sales less costs"
          value={formatCurrency(
            dashboardTotals.sales -
            dashboardTotals.purchases -
            dashboardTotals.expenses
          )}
          note="Sales − purchases − expenses"
          icon={TrendingUp}
        />
        <StatCard
          title="Business savings balance"
          value={formatCurrency(savingsTotals.balance)}
          note="Total money currently saved"
          icon={PiggyBank}
        />

        <StatCard
          title="Total savings deposits"
          value={formatCurrency(savingsTotals.deposits)}
          note="All recorded deposits"
          icon={ArrowDownRight}
        />

        <StatCard
          title="Total savings withdrawals"
          value={formatCurrency(savingsTotals.withdrawals)}
          note="All recorded withdrawals"
          icon={ArrowUpRight}
        />
      </div>

      <div className="main-grid">
        <section className="panel sales-panel">
          <div className="panel-heading">
            <div>
              <h3>Sales overview</h3>
              <p>Track your revenue through the week</p>
            </div>
            <span className="select-control">Last 7 days</span>
          </div>

          <div className="chart-legend">
            <span><i className="legend-dot sales-dot" /> Sales</span>
            <span><i className="legend-dot purchase-dot" /> Purchases</span>
          </div>

          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesData} margin={{ top: 8, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#28785f" stopOpacity={0.17} />
                    <stop offset="100%" stopColor="#28785f" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#edf0eb" vertical={false} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#8a938b', fontSize: 11 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#8a938b', fontSize: 11 }} tickFormatter={v => formatCurrency(v)} />
                <Tooltip formatter={v => formatCurrency(v)} contentStyle={{ border: '1px solid #e8ece6', borderRadius: 12 }} />
                <Area type="monotone" dataKey="sales" stroke="#28785f" strokeWidth={2.5} fill="url(#salesFill)" />
                <Area type="monotone" dataKey="purchases" stroke="#e6a65d" strokeWidth={2} fill="none" strokeDasharray="5 4" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-summary">
            <div>
              <span>Total sales</span>
              <strong>
                {formatCurrency(
                  salesData.reduce((sum, item) => sum + item.sales, 0)
                )}
              </strong>
            </div>

            <div>
              <span>Total purchases</span>
              <strong>
                {formatCurrency(
                  salesData.reduce((sum, item) => sum + item.purchases, 0)
                )}
              </strong>
            </div>

            <div>
              <span>Difference</span>
              <strong className="green-text">
                {formatCurrency(
                  salesData.reduce((sum, item) => sum + item.sales - item.purchases, 0)
                )}
              </strong>
            </div>
          </div>
        </section>

        <section className="panel stock-panel">
          <div className="panel-heading">
            <div><h3>Stock watch</h3><p>Items that need your attention</p></div>
            <button className="icon-button"><MoreHorizontal size={19} /></button>
          </div>

          <div className="stock-alert">
            <CircleAlert size={17} />
            <span>
              <strong>
                {inventory.filter(item =>
                  Number(item.current_quantity || 0) <= Number(item.minimum_quantity || 0)
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
                transactions.map((t, index) => (
                  <tr key={`${t.name}-${index}`}>
                    <td>
                      <div className="transaction-name">
                        <div className="transaction-icon green">
                          <ReceiptText size={17} />
                        </div>
                        <strong>{t.name}</strong>
                      </div>
                    </td>

                    <td className="muted-cell">
                      {t.quantity} {t.unit}
                    </td>

                    <td className="amount-cell">
                      {formatCurrency(t.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="footer-note">
        <span>© {new Date().getFullYear()} {businessName}</span>
        <span><span className="secure-dot" /> Your workspace · {currencyCode}</span>
      </div>
    </div >
  )
}

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

  const Icon = navItems.find(n => n.label === active)?.icon || Package

  return (
    <div className="page-content placeholder-page">
      <div className="welcome-row">
        <div>
          <div className="eyebrow">WORKSPACE / {active.toUpperCase()}</div>
          <h1>{active}</h1>
          <p>{descriptions[active]}</p>
        </div>
        <button className="button button-light"><SettingsIcon size={16} /> Configure</button>
      </div>

      <div className="empty-state panel">
        <div className="empty-icon"><Icon size={27} /></div>
        <h2>{active} workspace</h2>
        <p>This module will be connected to your Supabase database in the next development phase.</p>
        <div className="empty-actions">
          <span><CheckCircle2 size={15} /> Dashboard interface ready</span>
          <span><Clock3 size={15} /> Database connection pending</span>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [active, setActive] = useState('Overview')
  const [businessName, setBusinessName] = useState('Mbare Chitekete')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [userRole, setUserRole] = useState('')
  const [roleLoading, setRoleLoading] = useState(true)
  const [roleError, setRoleError] = useState('')
  const [currentUserId, setCurrentUserId] = useState('')
  const [notifications, setNotifications] = useState([])
  const [notificationLoading, setNotificationLoading] = useState(false)
  const [notificationError, setNotificationError] = useState('')
  const [notificationOpen, setNotificationOpen] = useState(false)
  const unreadNotificationCount = notifications.filter(
    notification => !notification.is_read
  ).length
  useEffect(() => {
    async function loadBusinessName() {
      const { data, error } = await supabase
        .from('canteen_settings')
        .select('business_name')
        .eq('id', true)
        .maybeSingle()

      if (!error && data?.business_name) {
        setBusinessName(data.business_name)
      }
    }

    async function loadOwnerAccount() {
      setRoleLoading(true)
      setRoleError('')

      try {
        const { data, error } = await supabase.auth.getUser()

        if (error || !data?.user) {
          throw new Error('Unable to verify your signed-in account.')
        }

        setOwnerEmail(data.user.email || '')
        setCurrentUserId(data.user.id)

        const { data: roleData, error: roleError } = await supabase
          .from('employee_roles')
          .select('role, is_active')
          .eq('user_id', data.user.id)
          .maybeSingle()

        if (roleError) throw roleError

        if (!roleData || !roleData.is_active) {
          throw new Error('Your employee account is inactive or has no assigned role. Please contact the canteen owner.')
        }

        const allowedRoles = ['owner', 'manager', 'cashier']

        if (!allowedRoles.includes(roleData.role)) {
          throw new Error('Your account has an unrecognized role. Please contact the canteen owner.')
        }

        setUserRole(roleData.role)
      } catch (err) {
        console.error('Account permission check failed:', err)
        setUserRole('')
        setRoleError(err.message || 'Unable to verify account permissions.')
      } finally {
        setRoleLoading(false)
      }
    }

    loadBusinessName()
    loadOwnerAccount()
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
      setNotificationError(
        error.message || 'Could not load notifications.'
      )
    } finally {
      setNotificationLoading(false)
    }
  }
  async function markNotificationRead(notificationId) {
    const readAt = new Date().toISOString()

    const { error } = await supabase
      .from('app_notifications')
      .update({
        is_read: true,
        read_at: readAt
      })
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
      .update({
        is_read: true,
        read_at: readAt
      })
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
      timeZone: 'Africa/Harare',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  useEffect(() => {
    if (currentUserId) {
      loadNotifications()
    }
  }, [currentUserId])
  const [mobileOpen, setMobileOpen] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const handler = e => setActive(e.detail)
    window.addEventListener('navigate-canteen', handler)

    return () => window.removeEventListener('navigate-canteen', handler)
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
            <p>{roleError || 'Your account does not have an active employee role.'}</p>
            <button onClick={() => supabase.auth.signOut()}>
              Sign out
            </button>
          </div>
        </div>
      )
    }
    // Manager: approved operational modules
    if (userRole === 'manager') {
      if (active === 'Manager Dashboard') {
        return <ManagerDashboard />
      }

      if (active === 'Purchases') {
        return <Purchases />
      }

      if (active === 'Inventory') {
        return <Inventory />
      }

      // All other modules remain restricted to the Owner.
      return (
        <div className="page-content">
          <div className="panel" style={{ padding: 24 }}>
            <h2>Access Restricted</h2>
            <p>You do not have permission to access this module.</p>
          </div>
        </div>
      )
    }

    // Cashier: POS only
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
    // Only Owner can access the administration modules
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

    // Owner-only administration modules

    if (active === 'Overview') {
      return <Overview businessName={businessName} />
    }

    if (active === 'Manager Dashboard') {
      return <ManagerDashboard />
    }

    if (active === 'Cashier POS') {
      return (
        <CashierPOS
          businessName={businessName}
          ownerEmail={ownerEmail}
        />
      )
    }

    if (active === 'Menu & Products') {
      return <MenuProducts />
    }


    if (active === 'Staff Benefits') {
      return <OwnerBenefitReviews />
    }

    if (active === 'Purchases') {
      return <Purchases />
    }

    if (active === 'Daily Sales') {
      return <DailySales />
    }

    if (active === 'Inventory') {
      return <Inventory />
    }

    if (active === 'Cash Management') {
      return <CashManagement />
    }

    if (active === 'Expenses') {
      return <Expenses />
    }

    if (active === 'Reports & Analytics') {
      return <ReportsAnalytics />
    }

    if (active === 'Profit & Loss') {
      return <FinancialStatements initialView="profit-loss" />
    }

    if (active === 'Detailed Transactions') {
      return <FinancialStatements initialView="transactions" />
    }

    if (active === 'Product Profitability') {
      return <FinancialStatements initialView="products" />
    }

    if (active === 'Expense Breakdown') {
      return <FinancialStatements initialView="expenses" />
    }

    if (active === 'Settings') {
      return <Settings />
    }

    if (active === 'Startup Funding') {
      return <StartupFunding />
    }

    if (active === 'Business Savings') {
      return <BusinessSavings />
    }

    if (active === 'Staff & Payroll') {
      return <StaffPayroll userRole={userRole} />
    }

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
          <button className="mobile-menu" onClick={() => setMobileOpen(true)}>
            <Menu size={21} />
          </button>

          <div className="breadcrumb">
            Workspace <ChevronRight size={14} /> <strong>{active}</strong>
          </div>

          <div className="topbar-right">
            <label className="search-box">
              <Search size={16} />
              <input
                placeholder="Search anything..."
                value={search}
                onChange={e => setSearch(e.target.value)}
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

                  if (willOpen) {
                    loadNotifications()
                  }
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
                      <span>
                        {unreadNotificationCount} unread
                      </span>
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

                  {!notificationLoading && !notificationError && notifications.length === 0 && (
                    <div className="notification-empty">
                      <Bell size={22} />
                      <strong>No notifications yet</strong>
                      <span>New updates will appear here.</span>
                    </div>
                  )}

                  {!notificationLoading && notifications.length > 0 && (
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
    </div >
  )
}
