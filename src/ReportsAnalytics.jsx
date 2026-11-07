
import { useEffect, useMemo, useState } from 'react'
import {
    Search,
    RefreshCw,
    Download,
    TrendingUp,
    ShoppingCart,
    Receipt,
    Banknote,
    X
} from 'lucide-react'
import { supabase } from './supabase'

const today = () => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const formatAmount = (amount, currencyCode = 'USD') => {
    const value = Number(amount || 0)
    const code = currencyCode || 'USD'

    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: code,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value)
    } catch {
        return `${code} ${value.toFixed(2)}`
    }
}

const sumByCurrency = (rows, amountField) => {
    const totals = {}

    rows.forEach(row => {
        const code = row.currency_code || 'USD'
        totals[code] = (totals[code] || 0) + Number(row[amountField] || 0)
    })

    return Object.entries(totals)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([currency_code, amount]) => ({
            currency_code,
            amount
        }))
}

const styles = {
    page: {
        padding: 24,
        color: '#162b42'
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        marginBottom: 22
    },
    title: {
        margin: 0,
        fontSize: 25,
        fontWeight: 800
    },
    subtitle: {
        color: '#718096',
        marginTop: 5,
        fontSize: 13
    },
    button: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        border: 'none',
        borderRadius: 9,
        padding: '10px 14px',
        background: '#176b45',
        color: 'white',
        fontWeight: 700,
        cursor: 'pointer'
    },
    secondary: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        border: '1px solid #dce4ec',
        borderRadius: 9,
        padding: '10px 13px',
        background: 'white',
        color: '#263b50',
        fontWeight: 600,
        cursor: 'pointer'
    },
    cards: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit,minmax(175px,1fr))',
        gap: 14,
        marginBottom: 20
    },
    card: {
        background: 'white',
        border: '1px solid #e6ebf1',
        borderRadius: 13,
        padding: 17
    },
    cardLabel: {
        color: '#718096',
        fontSize: 12,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: 6
    },
    cardValue: {
        fontSize: 21,
        fontWeight: 800,
        marginTop: 9,
        overflowWrap: 'anywhere'
    },
    filters: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 16,
        alignItems: 'end'
    },
    input: {
        width: '100%',
        boxSizing: 'border-box',
        padding: '10px 12px',
        border: '1px solid #dce4ec',
        borderRadius: 8,
        background: 'white',
        color: '#162b42',
        fontSize: 13
    },
    field: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        minWidth: 0
    },
    label: {
        fontSize: 12,
        fontWeight: 700,
        color: '#536579'
    },
    tableWrap: {
        overflowX: 'auto',
        background: 'white',
        border: '1px solid #e6ebf1',
        borderRadius: 12
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse',
        minWidth: 700
    },
    th: {
        textAlign: 'left',
        padding: '13px 12px',
        background: '#f7f9fc',
        color: '#64748b',
        fontSize: 11,
        textTransform: 'uppercase',
        whiteSpace: 'nowrap'
    },
    td: {
        padding: '13px 12px',
        borderTop: '1px solid #edf1f5',
        fontSize: 13,
        whiteSpace: 'nowrap'
    },
    message: {
        padding: 12,
        borderRadius: 8,
        marginBottom: 14,
        fontSize: 13
    },
    section: {
        marginTop: 25,
        marginBottom: 12,
        fontSize: 17,
        fontWeight: 800
    },
    tab: {
        padding: '9px 14px',
        border: '1px solid #dce4ec',
        borderRadius: 8,
        background: 'white',
        cursor: 'pointer',
        color: '#536579',
        fontWeight: 600
    },
    activeTab: {
        padding: '9px 14px',
        border: '1px solid #176b45',
        borderRadius: 8,
        background: '#e9f8ef',
        cursor: 'pointer',
        color: '#176b45',
        fontWeight: 800
    }
}

export default function ReportsAnalytics() {
    const [sales, setSales] = useState([])
    const [purchases, setPurchases] = useState([])
    const [expenses, setExpenses] = useState([])
    const [payments, setPayments] = useState([])
    const [categories, setCategories] = useState([])

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const [reportType, setReportType] = useState('sales')
    const [period, setPeriod] = useState('all')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [search, setSearch] = useState('')
    const [categoryFilter, setCategoryFilter] = useState('all')

    const loadData = async () => {
        setLoading(true)
        setError('')

        try {
            const [
                salesResult,
                purchasesResult,
                expensesResult,
                paymentsResult,
                categoriesResult
            ] = await Promise.all([
                supabase.rpc('reports_get_sales_lines', {
                    p_start_date: null,
                    p_end_date: null
                }),

                supabase
                    .from('purchases')
                    .select(`
                        id,
                        purchase_date,
                        item_name,
                        unit,
                        ordered_quantity,
                        quantity,
                        excess_quantity,
                        unit_price,
                        total_purchase,
                        payment_method,
                        currency_code,
                        notes
                    `)
                    .order('purchase_date', { ascending: false }),

                supabase
                    .from('expenses')
                    .select(`
                        id,
                        expense_date,
                        description,
                        category,
                        amount,
                        currency_code,
                        payment_method,
                        notes
                    `)
                    .order('expense_date', { ascending: false }),

                supabase.rpc('reports_get_payment_summary', {
                    p_start_date: null,
                    p_end_date: null
                }),

                supabase
                    .from('menu_categories')
                    .select('id,name')
                    .order('name')
            ])

            const failed = [
                salesResult.error,
                purchasesResult.error,
                expensesResult.error,
                paymentsResult.error,
                categoriesResult.error
            ].find(Boolean)

            if (failed) {
                throw failed
            }

            setSales(salesResult.data || [])
            setPurchases(purchasesResult.data || [])
            setExpenses(expensesResult.data || [])
            setPayments(paymentsResult.data || [])
            setCategories(categoriesResult.data || [])

        } catch (err) {
            console.error('Reports loading error:', err)
            setError(err.message || 'Unable to load report data. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadData()
    }, [])

    const categoryName = categoryId =>
        categories.find(category => category.id === categoryId)?.name || 'Uncategorised'

    const getDateRange = () => {
        if (period === 'all') {
            return { start: '', end: '' }
        }

        const now = new Date()
        const end = today()
        let start = new Date(now)

        if (period === 'daily') {
            start = new Date(now)
        } else if (period === 'weekly') {
            start.setDate(now.getDate() - 6)
        } else if (period === 'monthly') {
            start = new Date(now.getFullYear(), now.getMonth(), 1)
        } else if (period === 'yearly') {
            start = new Date(now.getFullYear(), 0, 1)
        }

        const formattedStart =
            `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`

        return {
            start: formattedStart,
            end
        }
    }

    const activeRange = getDateRange()
    const effectiveStart = startDate || activeRange.start
    const effectiveEnd = endDate || activeRange.end

    const matchesDate = date =>
        (!effectiveStart || date >= effectiveStart) &&
        (!effectiveEnd || date <= effectiveEnd)

    const filteredSales = useMemo(() => {
        return sales.filter(row => {
            const category = categoryName(row.category_id)

            const matchesSearch = [
                row.item_name,
                row.unit,
                row.notes,
                row.receipt_number,
                row.currency_code,
                category
            ].some(value =>
                String(value || '').toLowerCase().includes(search.toLowerCase())
            )

            const matchesCategory =
                categoryFilter === 'all' ||
                row.category_id === categoryFilter

            return (
                matchesDate(row.sale_date) &&
                matchesSearch &&
                matchesCategory
            )
        })
    }, [
        sales,
        categories,
        effectiveStart,
        effectiveEnd,
        search,
        categoryFilter
    ])

    const filteredPurchases = useMemo(() => {
        return purchases.filter(row => {
            const matchesSearch = [
                row.item_name,
                row.unit,
                row.payment_method,
                row.notes,
                row.currency_code
            ].some(value =>
                String(value || '').toLowerCase().includes(search.toLowerCase())
            )

            return matchesDate(row.purchase_date) && matchesSearch
        })
    }, [purchases, effectiveStart, effectiveEnd, search])

    const filteredExpenses = useMemo(() => {
        return expenses.filter(row => {
            const matchesSearch = [
                row.description,
                row.category,
                row.payment_method,
                row.notes,
                row.currency_code
            ].some(value =>
                String(value || '').toLowerCase().includes(search.toLowerCase())
            )

            return matchesDate(row.expense_date) && matchesSearch
        })
    }, [expenses, effectiveStart, effectiveEnd, search])

    const filteredPayments = useMemo(() => {
        return payments.filter(row => {
            const matchesSearch = [
                row.sale_date,
                row.payment_method,
                row.currency_code,
                row.transaction_count,
                row.total_amount
            ].some(value =>
                String(value ?? '').toLowerCase().includes(search.toLowerCase())
            )

            return matchesDate(row.sale_date) && matchesSearch
        })
    }, [payments, effectiveStart, effectiveEnd, search])

    const salesTotals = useMemo(() => ({
        revenue: sumByCurrency(filteredSales, 'sales_value'),
        quantity: filteredSales.reduce(
            (sum, row) => sum + Number(row.quantity_sold || 0),
            0
        ),
        entries: filteredSales.length
    }), [filteredSales])

    const purchaseTotals = useMemo(
        () => sumByCurrency(filteredPurchases, 'total_purchase'),
        [filteredPurchases]
    )

    const expenseTotals = useMemo(
        () => sumByCurrency(filteredExpenses, 'amount'),
        [filteredExpenses]
    )

    const paymentTotals = useMemo(() => {
        const grouped = {}

        filteredPayments.forEach(row => {
            const code = row.currency_code || 'USD'
            const method = row.payment_method || 'other'
            const key = `${method}_${code}`

            if (!grouped[key]) {
                grouped[key] = {
                    method,
                    currency_code: code,
                    transaction_count: 0,
                    amount: 0
                }
            }

            grouped[key].transaction_count += Number(row.transaction_count || 0)
            grouped[key].amount += Number(row.total_amount || 0)
        })

        return Object.values(grouped).sort((a, b) =>
            a.currency_code.localeCompare(b.currency_code) ||
            a.method.localeCompare(b.method)
        )
    }, [filteredPayments])

    const profitLossTotals = useMemo(() => {
        const periodSales = sumByCurrency(
            sales.filter(row => matchesDate(row.sale_date)),
            'sales_value'
        )

        const periodPurchases = sumByCurrency(
            purchases.filter(row => matchesDate(row.purchase_date)),
            'total_purchase'
        )

        const periodExpenses = sumByCurrency(
            expenses.filter(row => matchesDate(row.expense_date)),
            'amount'
        )

        const currencies = new Set([
            ...periodSales.map(row => row.currency_code),
            ...periodPurchases.map(row => row.currency_code),
            ...periodExpenses.map(row => row.currency_code)
        ])

        return [...currencies].sort().map(code => {
            const salesAmount =
                periodSales.find(row => row.currency_code === code)?.amount || 0

            const purchaseAmount =
                periodPurchases.find(row => row.currency_code === code)?.amount || 0

            const expenseAmount =
                periodExpenses.find(row => row.currency_code === code)?.amount || 0

            return {
                currency_code: code,
                sales: salesAmount,
                purchases: purchaseAmount,
                expenses: expenseAmount,
                result: salesAmount - purchaseAmount - expenseAmount
            }
        })
    }, [sales, purchases, expenses, effectiveStart, effectiveEnd])

    const bestSellers = useMemo(() => {
        const grouped = {}

        filteredSales.forEach(row => {
            const code = row.currency_code || 'USD'
            const key = `${row.menu_item_id || row.item_name}_${code}`

            if (!grouped[key]) {
                grouped[key] = {
                    name: row.item_name,
                    unit: row.unit,
                    currency_code: code,
                    quantity: 0,
                    revenue: 0
                }
            }

            grouped[key].quantity += Number(row.quantity_sold || 0)
            grouped[key].revenue += Number(row.sales_value || 0)
        })

        return Object.values(grouped).sort(
            (a, b) => b.quantity - a.quantity
        )
    }, [filteredSales])

    const dailySummary = useMemo(() => {
        const grouped = {}

        filteredSales.forEach(row => {
            const code = row.currency_code || 'USD'
            const key = `${row.sale_date}_${code}`

            if (!grouped[key]) {
                grouped[key] = {
                    date: row.sale_date,
                    currency_code: code,
                    quantity: 0,
                    revenue: 0
                }
            }

            grouped[key].quantity += Number(row.quantity_sold || 0)
            grouped[key].revenue += Number(row.sales_value || 0)
        })

        return Object.values(grouped).sort((a, b) =>
            b.date.localeCompare(a.date) ||
            a.currency_code.localeCompare(b.currency_code)
        )
    }, [filteredSales])

    const exportCsv = () => {
        let headers = []
        let rows = []

        if (reportType === 'sales') {
            headers = [
                'Date',
                'Receipt Number',
                'Menu Item',
                'Unit',
                'Currency',
                'Selling Price',
                'Quantity Sold',
                'Sales Value',
                'Category',
                'Notes'
            ]

            rows = filteredSales.map(row => [
                row.sale_date,
                row.receipt_number,
                row.item_name,
                row.unit,
                row.currency_code,
                row.selling_price,
                row.quantity_sold,
                row.sales_value,
                categoryName(row.category_id),
                row.notes
            ])

        } else if (reportType === 'purchases') {
            headers = [
                'Date',
                'Item',
                'Unit',
                'Ordered Quantity',
                'Collected Quantity',
                'Excess Quantity',
                'Currency',
                'Unit Cost',
                'Total Cost',
                'Payment Method',
                'Notes'
            ]

            rows = filteredPurchases.map(row => [
                row.purchase_date,
                row.item_name,
                row.unit,
                row.ordered_quantity,
                row.quantity,
                row.excess_quantity,
                row.currency_code,
                row.unit_price,
                row.total_purchase,
                row.payment_method,
                row.notes
            ])

        } else if (reportType === 'expenses') {
            headers = [
                'Date',
                'Description',
                'Category',
                'Currency',
                'Amount',
                'Payment Method',
                'Notes'
            ]

            rows = filteredExpenses.map(row => [
                row.expense_date,
                row.description,
                row.category,
                row.currency_code,
                row.amount,
                row.payment_method,
                row.notes
            ])

        } else if (reportType === 'profit-loss') {
            headers = [
                'Currency',
                'Sales Revenue',
                'Purchases',
                'Operating Expenses',
                'Estimated Operating Result'
            ]

            rows = profitLossTotals.map(row => [
                row.currency_code,
                row.sales,
                row.purchases,
                row.expenses,
                row.result
            ])

        } else {
            headers = [
                'Date',
                'Payment Method',
                'Currency',
                'Transaction Count',
                'Total Collected'
            ]

            rows = filteredPayments.map(row => [
                row.sale_date,
                row.payment_method,
                row.currency_code,
                row.transaction_count,
                row.total_amount
            ])
        }

        const escapeCsv = value => {
            const text = String(value ?? '')
            return `"${text.replace(/"/g, '""')}"`
        }

        const csv = [
            headers.map(escapeCsv).join(','),
            ...rows.map(row => row.map(escapeCsv).join(','))
        ].join('\n')

        const blob = new Blob(['\uFEFF' + csv], {
            type: 'text/csv;charset=utf-8;'
        })

        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')

        link.href = url
        link.download = `canteen-${reportType}-report-${today()}.csv`

        document.body.appendChild(link)
        link.click()
        link.remove()

        URL.revokeObjectURL(url)
    }

    const clearFilters = () => {
        setSearch('')
        setCategoryFilter('all')
        setStartDate('')
        setEndDate('')
        setPeriod('all')
    }

    const renderCurrencyCards = (rows, emptyLabel) => {
        if (!rows.length) {
            return (
                <div style={styles.card}>
                    <div style={styles.cardLabel}>{emptyLabel}</div>
                    <div style={styles.cardValue}>—</div>
                </div>
            )
        }

        return rows.map(row => (
            <div style={styles.card} key={row.currency_code}>
                <div style={styles.cardLabel}>
                    {emptyLabel} ({row.currency_code})
                </div>
                <div style={styles.cardValue}>
                    {formatAmount(row.amount, row.currency_code)}
                </div>
            </div>
        ))
    }

    return (
        <div style={styles.page}>
            <div style={styles.header}>
                <div>
                    <h1 style={styles.title}>Reports & Analytics</h1>
                    <div style={styles.subtitle}>
                        Review sales performance, purchases, expenses and payment collections.
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                    <button
                        style={styles.secondary}
                        onClick={loadData}
                        disabled={loading}
                    >
                        <RefreshCw size={15} />
                        {loading ? 'Loading...' : 'Refresh'}
                    </button>

                    <button
                        style={styles.button}
                        onClick={exportCsv}
                        disabled={loading}
                    >
                        <Download size={15} /> Export CSV
                    </button>
                </div>
            </div>

            {error && (
                <div style={{
                    ...styles.message,
                    background: '#fff0f0',
                    color: '#b42318'
                }}>
                    {error}
                </div>
            )}

            <div style={styles.filters}>
                <div style={{ ...styles.field, flex: '1 1 160px' }}>
                    <label style={styles.label}>Reporting period</label>
                    <select
                        style={styles.input}
                        value={period}
                        onChange={event => {
                            setPeriod(event.target.value)
                            setStartDate('')
                            setEndDate('')
                        }}
                    >
                        <option value="all">All time</option>
                        <option value="daily">Today</option>
                        <option value="weekly">Last 7 days</option>
                        <option value="monthly">This month</option>
                        <option value="yearly">This year</option>
                    </select>
                </div>

                <div style={{ ...styles.field, flex: '1 1 145px' }}>
                    <label style={styles.label}>Custom from date</label>
                    <input
                        type="date"
                        style={styles.input}
                        value={startDate}
                        max={endDate || undefined}
                        onChange={event => setStartDate(event.target.value)}
                    />
                </div>

                <div style={{ ...styles.field, flex: '1 1 145px' }}>
                    <label style={styles.label}>Custom to date</label>
                    <input
                        type="date"
                        style={styles.input}
                        value={endDate}
                        min={startDate || undefined}
                        onChange={event => setEndDate(event.target.value)}
                    />
                </div>

                <div style={{ ...styles.field, flex: '2 1 210px' }}>
                    <label style={styles.label}>Search report records</label>

                    <div style={{ position: 'relative' }}>
                        <Search
                            size={16}
                            style={{
                                position: 'absolute',
                                left: 11,
                                top: 11,
                                color: '#8795a5'
                            }}
                        />

                        <input
                            style={{ ...styles.input, paddingLeft: 35 }}
                            placeholder="Search product, category, payment or currency..."
                            value={search}
                            onChange={event => setSearch(event.target.value)}
                        />
                    </div>
                </div>

                <button
                    style={styles.secondary}
                    onClick={clearFilters}
                >
                    <X size={14} /> Clear Filters
                </button>
            </div>

            <h3 style={styles.section}>Financial Overview</h3>

            <div style={styles.cards}>
                {renderCurrencyCards(salesTotals.revenue, 'Sales Revenue')}

                <div style={styles.card}>
                    <div style={styles.cardLabel}>
                        <ShoppingCart size={15} /> Quantity Sold
                    </div>
                    <div style={styles.cardValue}>
                        {salesTotals.quantity.toLocaleString()}
                    </div>
                </div>

                {renderCurrencyCards(purchaseTotals, 'Purchases')}
                {renderCurrencyCards(expenseTotals, 'Expenses')}
            </div>

            <h3 style={styles.section}>Payment Collection Breakdown</h3>

            <div style={styles.cards}>
                {paymentTotals.length === 0 ? (
                    <div style={styles.card}>
                        <div style={styles.cardLabel}>Payment Collections</div>
                        <div style={styles.cardValue}>No payments recorded</div>
                    </div>
                ) : paymentTotals.map(row => (
                    <div
                        style={styles.card}
                        key={`${row.method}_${row.currency_code}`}
                    >
                        <div style={styles.cardLabel}>
                            {row.method.replace('_', ' ')} ({row.currency_code})
                        </div>

                        <div style={styles.cardValue}>
                            {formatAmount(row.amount, row.currency_code)}
                        </div>

                        <div style={{
                            color: '#718096',
                            fontSize: 12,
                            marginTop: 7
                        }}>
                            {row.transaction_count} transactions
                        </div>
                    </div>
                ))}
            </div>

            <h3 style={styles.section}>Detailed Reports</h3>

            <div style={{
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
                marginBottom: 15
            }}>
                {[
                    ['sales', 'Sales'],
                    ['purchases', 'Purchases'],
                    ['expenses', 'Expenses'],
                    ['payments', 'Payments'],
                    ['profit-loss', 'Estimated Profit & Loss']
                ].map(([value, label]) => (
                    <button
                        key={value}
                        style={
                            reportType === value
                                ? styles.activeTab
                                : styles.tab
                        }
                        onClick={() => setReportType(value)}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {reportType === 'profit-loss' && (
                <div style={{ ...styles.cards, marginTop: 10 }}>
                    {profitLossTotals.length === 0 ? (
                        <div style={styles.card}>
                            No financial records found for this period.
                        </div>
                    ) : profitLossTotals.map(row => (
                        <div
                            key={row.currency_code}
                            style={{
                                ...styles.card,
                                gridColumn: '1 / -1'
                            }}
                        >
                            <div style={styles.cardLabel}>
                                Estimated Operating Result ({row.currency_code})
                            </div>

                            <div style={{
                                ...styles.cardValue,
                                color: row.result >= 0 ? '#176b45' : '#b42318'
                            }}>
                                {formatAmount(row.result, row.currency_code)}
                            </div>

                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))',
                                gap: 12,
                                marginTop: 15,
                                color: '#536579',
                                fontSize: 13
                            }}>
                                <div>
                                    Sales Revenue
                                    <strong style={{ display: 'block', marginTop: 5 }}>
                                        {formatAmount(row.sales, row.currency_code)}
                                    </strong>
                                </div>

                                <div>
                                    Purchases
                                    <strong style={{ display: 'block', marginTop: 5 }}>
                                        {formatAmount(row.purchases, row.currency_code)}
                                    </strong>
                                </div>

                                <div>
                                    Operating Expenses
                                    <strong style={{ display: 'block', marginTop: 5 }}>
                                        {formatAmount(row.expenses, row.currency_code)}
                                    </strong>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {reportType === 'sales' && (
                <div style={{
                    ...styles.field,
                    maxWidth: 300,
                    marginBottom: 14
                }}>
                    <label style={styles.label}>Filter sales by category</label>

                    <select
                        style={styles.input}
                        value={categoryFilter}
                        onChange={event => setCategoryFilter(event.target.value)}
                    >
                        <option value="all">All categories</option>

                        {categories.map(category => (
                            <option
                                key={category.id}
                                value={category.id}
                            >
                                {category.name}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {reportType !== 'profit-loss' && (
                <div style={{
                    color: '#718096',
                    fontSize: 12,
                    marginBottom: 10
                }}>
                    {reportType === 'sales' &&
                        `Showing ${filteredSales.length} of ${sales.length} sales entries`}

                    {reportType === 'purchases' &&
                        `Showing ${filteredPurchases.length} of ${purchases.length} purchases`}

                    {reportType === 'expenses' &&
                        `Showing ${filteredExpenses.length} of ${expenses.length} expenses`}

                    {reportType === 'payments' &&
                        `Showing ${filteredPayments.length} of ${payments.length} payment summaries`}
                </div>
            )}

            {reportType !== 'profit-loss' && (
                <div style={styles.tableWrap}>
                    <table style={styles.table}>
                        <thead>
                            {reportType === 'sales' && (
                                <tr>
                                    <th style={styles.th}>Date</th>
                                    <th style={styles.th}>Receipt</th>
                                    <th style={styles.th}>Menu Item</th>
                                    <th style={styles.th}>Category</th>
                                    <th style={styles.th}>Quantity</th>
                                    <th style={styles.th}>Currency</th>
                                    <th style={styles.th}>Unit Price</th>
                                    <th style={styles.th}>Sales Value</th>
                                </tr>
                            )}

                            {reportType === 'purchases' && (
                                <tr>
                                    <th style={styles.th}>Date</th>
                                    <th style={styles.th}>Item</th>
                                    <th style={styles.th}>Ordered</th>
                                    <th style={styles.th}>Collected</th>
                                    <th style={styles.th}>Excess</th>
                                    <th style={styles.th}>Currency</th>
                                    <th style={styles.th}>Unit Cost</th>
                                    <th style={styles.th}>Total Cost</th>
                                    <th style={styles.th}>Payment</th>
                                </tr>
                            )}

                            {reportType === 'expenses' && (
                                <tr>
                                    <th style={styles.th}>Date</th>
                                    <th style={styles.th}>Description</th>
                                    <th style={styles.th}>Category</th>
                                    <th style={styles.th}>Currency</th>
                                    <th style={styles.th}>Amount</th>
                                    <th style={styles.th}>Payment</th>
                                </tr>
                            )}

                            {reportType === 'payments' && (
                                <tr>
                                    <th style={styles.th}>Date</th>
                                    <th style={styles.th}>Payment Method</th>
                                    <th style={styles.th}>Currency</th>
                                    <th style={styles.th}>Transactions</th>
                                    <th style={styles.th}>Total Collected</th>
                                </tr>
                            )}
                        </thead>

                        <tbody>
                            {loading ? (
                                <tr>
                                    <td
                                        style={styles.td}
                                        colSpan={
                                            reportType === 'sales' ? 8 :
                                                reportType === 'purchases' ? 9 :
                                                    reportType === 'expenses' ? 6 : 5
                                        }
                                    >
                                        Loading records...
                                    </td>
                                </tr>
                            ) : reportType === 'sales' ? (
                                filteredSales.length === 0 ? (
                                    <tr>
                                        <td style={styles.td} colSpan="8">
                                            No sales records found.
                                        </td>
                                    </tr>
                                ) : filteredSales.map(row => (
                                    <tr key={row.id}>
                                        <td style={styles.td}>{row.sale_date}</td>
                                        <td style={styles.td}>{row.receipt_number || '—'}</td>
                                        <td style={styles.td}>{row.item_name}</td>
                                        <td style={styles.td}>
                                            {categoryName(row.category_id)}
                                        </td>
                                        <td style={styles.td}>{row.quantity_sold}</td>
                                        <td style={styles.td}>{row.currency_code}</td>
                                        <td style={styles.td}>
                                            {formatAmount(row.selling_price, row.currency_code)}
                                        </td>
                                        <td style={styles.td}>
                                            {formatAmount(row.sales_value, row.currency_code)}
                                        </td>
                                    </tr>
                                ))
                            ) : reportType === 'purchases' ? (
                                filteredPurchases.length === 0 ? (
                                    <tr>
                                        <td style={styles.td} colSpan="9">
                                            No purchase records found.
                                        </td>
                                    </tr>
                                ) : filteredPurchases.map(row => (
                                    <tr key={row.id}>
                                        <td style={styles.td}>{row.purchase_date}</td>
                                        <td style={styles.td}>{row.item_name}</td>
                                        <td style={styles.td}>
                                            {row.ordered_quantity} {row.unit}
                                        </td>
                                        <td style={styles.td}>
                                            {row.quantity} {row.unit}
                                        </td>
                                        <td style={styles.td}>
                                            {row.excess_quantity} {row.unit}
                                        </td>
                                        <td style={styles.td}>{row.currency_code}</td>
                                        <td style={styles.td}>
                                            {formatAmount(row.unit_price, row.currency_code)}
                                        </td>
                                        <td style={styles.td}>
                                            {formatAmount(row.total_purchase, row.currency_code)}
                                        </td>
                                        <td style={styles.td}>{row.payment_method}</td>
                                    </tr>
                                ))
                            ) : reportType === 'expenses' ? (
                                filteredExpenses.length === 0 ? (
                                    <tr>
                                        <td style={styles.td} colSpan="6">
                                            No expense records found.
                                        </td>
                                    </tr>
                                ) : filteredExpenses.map(row => (
                                    <tr key={row.id}>
                                        <td style={styles.td}>{row.expense_date}</td>
                                        <td style={styles.td}>{row.description}</td>
                                        <td style={styles.td}>{row.category || '—'}</td>
                                        <td style={styles.td}>{row.currency_code}</td>
                                        <td style={styles.td}>
                                            {formatAmount(row.amount, row.currency_code)}
                                        </td>
                                        <td style={styles.td}>{row.payment_method}</td>
                                    </tr>
                                ))
                            ) : (
                                filteredPayments.length === 0 ? (
                                    <tr>
                                        <td style={styles.td} colSpan="5">
                                            No payment records found.
                                        </td>
                                    </tr>
                                ) : filteredPayments.map((row, index) => (
                                    <tr key={`${row.sale_date}_${row.payment_method}_${row.currency_code}_${index}`}>
                                        <td style={styles.td}>{row.sale_date}</td>
                                        <td style={styles.td}>
                                            {row.payment_method.replace('_', ' ')}
                                        </td>
                                        <td style={styles.td}>{row.currency_code}</td>
                                        <td style={styles.td}>{row.transaction_count}</td>
                                        <td style={styles.td}>
                                            {formatAmount(row.total_amount, row.currency_code)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {reportType === 'sales' && (
                <>
                    <h3 style={styles.section}>Best-Selling Menu Items</h3>

                    <div style={styles.tableWrap}>
                        <table style={styles.table}>
                            <thead>
                                <tr>
                                    <th style={styles.th}>Menu Item</th>
                                    <th style={styles.th}>Unit</th>
                                    <th style={styles.th}>Currency</th>
                                    <th style={styles.th}>Quantity Sold</th>
                                    <th style={styles.th}>Sales Revenue</th>
                                </tr>
                            </thead>

                            <tbody>
                                {bestSellers.length === 0 ? (
                                    <tr>
                                        <td style={styles.td} colSpan="5">
                                            No sales records found.
                                        </td>
                                    </tr>
                                ) : bestSellers.map((item, index) => (
                                    <tr key={`${item.name}-${item.currency_code}-${index}`}>
                                        <td style={styles.td}>{item.name}</td>
                                        <td style={styles.td}>{item.unit}</td>
                                        <td style={styles.td}>{item.currency_code}</td>
                                        <td style={styles.td}>{item.quantity}</td>
                                        <td style={styles.td}>
                                            {formatAmount(item.revenue, item.currency_code)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <h3 style={styles.section}>Daily Sales Summary</h3>

                    <div style={styles.tableWrap}>
                        <table style={styles.table}>
                            <thead>
                                <tr>
                                    <th style={styles.th}>Date</th>
                                    <th style={styles.th}>Currency</th>
                                    <th style={styles.th}>Quantity Sold</th>
                                    <th style={styles.th}>Sales Revenue</th>
                                </tr>
                            </thead>

                            <tbody>
                                {dailySummary.length === 0 ? (
                                    <tr>
                                        <td style={styles.td} colSpan="4">
                                            No daily sales records found.
                                        </td>
                                    </tr>
                                ) : dailySummary.map(row => (
                                    <tr key={`${row.date}_${row.currency_code}`}>
                                        <td style={styles.td}>{row.date}</td>
                                        <td style={styles.td}>{row.currency_code}</td>
                                        <td style={styles.td}>{row.quantity}</td>
                                        <td style={styles.td}>
                                            {formatAmount(row.revenue, row.currency_code)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {reportType === 'profit-loss' && (
                <div style={{
                    ...styles.message,
                    background: '#f3f6fa',
                    color: '#536579',
                    marginTop: 18
                }}>
                    <strong>Accounting note:</strong> Estimated operating result is
                    calculated separately for each currency as sales revenue minus
                    recorded purchases and operating expenses. This is not exact net
                    profit because purchases may include stock that has not yet been
                    used. It does not calculate the actual cost of ingredients used
                    in menu items. Business savings deposits and withdrawals are excluded.
                </div>
            )}
        </div>
    )
}
