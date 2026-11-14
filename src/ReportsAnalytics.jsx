
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
    Search,
    RefreshCw,
    Download,
    ShoppingCart,
    X,
    TrendingUp,
    Receipt,
    Banknote,
    Package,
    AlertCircle
} from 'lucide-react'
import { supabase } from './supabase'

const BUSINESS_TIMEZONE = 'Africa/Harare'
const PAGE_SIZE = 1000

const getHarareToday = () => {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: BUSINESS_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(new Date())

    const values = Object.fromEntries(
        parts.map(part => [part.type, part.value])
    )

    return `${values.year}-${values.month}-${values.day}`
}

const addDays = (dateString, amount) => {
    const [year, month, day] = dateString.split('-').map(Number)
    const date = new Date(Date.UTC(year, month - 1, day))
    date.setUTCDate(date.getUTCDate() + amount)

    return date.toISOString().slice(0, 10)
}

const getPeriodRange = period => {
    const end = getHarareToday()
    const [year, month] = end.split('-').map(Number)

    switch (period) {
        case 'daily':
            return { start: end, end }

        case 'weekly':
            return { start: addDays(end, -6), end }

        case 'monthly':
            return {
                start: `${year}-${String(month).padStart(2, '0')}-01`,
                end
            }

        case 'yearly':
            return {
                start: `${year}-01-01`,
                end
            }

        default:
            return { start: '', end: '' }
    }
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

const formatNumber = value =>
    Number(value || 0).toLocaleString('en-US', {
        maximumFractionDigits: 3
    })

const sumByCurrency = (rows, amountField) => {
    const totals = {}

    rows.forEach(row => {
        const code = row.currency_code || 'USD'
        totals[code] = (totals[code] || 0) +
            Number(row[amountField] || 0)
    })

    return Object.entries(totals)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([currency_code, amount]) => ({
            currency_code,
            amount
        }))
}

// Fetch every page instead of silently stopping at Supabase's row limit.
const fetchAllPages = async queryFactory => {
    const allRows = []

    for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data, error } = await queryFactory()
            .range(offset, offset + PAGE_SIZE - 1)

        if (error) throw error

        const rows = data || []
        allRows.push(...rows)

        if (rows.length < PAGE_SIZE) break
    }

    return allRows
}

const escapeCsv = value => {
    let text = String(value ?? '')

    // Prevent spreadsheet formula execution when opening exported CSV files.
    if (/^[\s]*[=+\-@]/.test(text)) {
        text = `'${text}`
    }

    return `"${text.replace(/"/g, '""')}"`
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

    const [ownerProfitLoss, setOwnerProfitLoss] = useState(null)
    const [productProfitability, setProductProfitability] = useState([])
    const [ownerReportError, setOwnerReportError] = useState('')

    const [loading, setLoading] = useState(true)
    const [ownerReportLoading, setOwnerReportLoading] = useState(false)
    const [error, setError] = useState('')

    const [reportType, setReportType] = useState('sales')
    const [period, setPeriod] = useState('all')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [search, setSearch] = useState('')
    const [categoryFilter, setCategoryFilter] = useState('all')

    const activeRange = useMemo(
        () => getPeriodRange(period),
        [period]
    )

    const effectiveStart = startDate || activeRange.start
    const effectiveEnd = endDate || activeRange.end

    const matchesDate = useCallback(date => {
        return (
            (!effectiveStart || date >= effectiveStart) &&
            (!effectiveEnd || date <= effectiveEnd)
        )
    }, [effectiveStart, effectiveEnd])

    const loadData = useCallback(async () => {
        setLoading(true)
        setError('')

        try {
            const [
                salesRows,
                purchaseRows,
                expenseRows,
                paymentRows,
                categoriesResult
            ] = await Promise.all([
                fetchAllPages(() =>
                    supabase.rpc('reports_get_sales_lines', {
                        p_start_date: null,
                        p_end_date: null
                    })
                ),

                fetchAllPages(() =>
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
                        .order('purchase_date', { ascending: false })
                ),

                fetchAllPages(() =>
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
                        .order('expense_date', { ascending: false })
                ),

                fetchAllPages(() =>
                    supabase.rpc('reports_get_payment_summary', {
                        p_start_date: null,
                        p_end_date: null
                    })
                ),

                supabase
                    .from('menu_categories')
                    .select('id,name,active')
                    .order('name')
            ])

            if (categoriesResult.error) {
                throw categoriesResult.error
            }

            setSales(salesRows)
            setPurchases(purchaseRows)
            setExpenses(expenseRows)
            setPayments(paymentRows)
            setCategories(categoriesResult.data || [])

        } catch (err) {
            console.error('Reports loading error:', err)
            setError(
                err.message ||
                'Unable to load report data. Please try again.'
            )
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        loadData()
    }, [loadData])

    const categoryName = useCallback(categoryId => {
        return categories.find(category => category.id === categoryId)?.name ||
            'Uncategorised'
    }, [categories])

    // Owner RPCs require both dates. For all-time reports, use the earliest
    // available transaction date through the current Harare date.
    const getOwnerReportRange = useCallback(() => {
        const end = effectiveEnd || getHarareToday()

        let start = effectiveStart

        if (!start) {
            const dates = [
                ...sales.map(row => row.sale_date),
                ...purchases.map(row => row.purchase_date),
                ...expenses.map(row => row.expense_date)
            ].filter(Boolean).sort()

            start = dates[0] || end
        }

        return { start, end }
    }, [
        effectiveStart,
        effectiveEnd,
        sales,
        purchases,
        expenses
    ])

    const loadOwnerReports = useCallback(async () => {
        setOwnerReportLoading(true)
        setOwnerReportError('')

        try {
            const { start, end } = getOwnerReportRange()

            if (start > end) {
                throw new Error('The report start date cannot be after the end date.')
            }

            const [profitResult, productResult] = await Promise.all([
                supabase.rpc('owner_profit_loss_report', {
                    p_start_date: start,
                    p_end_date: end
                }),

                supabase.rpc('owner_product_profitability_report', {
                    p_start_date: start,
                    p_end_date: end
                })
            ])

            if (profitResult.error) throw profitResult.error
            if (productResult.error) throw productResult.error

            setOwnerProfitLoss(profitResult.data || null)
            setProductProfitability(productResult.data || [])

        } catch (err) {
            console.error('Owner reports error:', err)
            setOwnerProfitLoss(null)
            setProductProfitability([])
            setOwnerReportError(
                err.message ||
                'Owner financial reports are unavailable for this account.'
            )
        } finally {
            setOwnerReportLoading(false)
        }
    }, [getOwnerReportRange])

    useEffect(() => {
        if (
            reportType === 'profit-loss' ||
            reportType === 'product-profitability'
        ) {
            loadOwnerReports()
        }
    }, [
        reportType,
        effectiveStart,
        effectiveEnd,
        loadOwnerReports
    ])

    const filteredSales = useMemo(() => {
        const term = search.trim().toLowerCase()

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
                String(value || '').toLowerCase().includes(term)
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
        categoryName,
        matchesDate,
        search,
        categoryFilter
    ])

    const filteredPurchases = useMemo(() => {
        const term = search.trim().toLowerCase()

        return purchases.filter(row => {
            const matchesSearch = [
                row.item_name,
                row.unit,
                row.payment_method,
                row.notes,
                row.currency_code
            ].some(value =>
                String(value || '').toLowerCase().includes(term)
            )

            return matchesDate(row.purchase_date) && matchesSearch
        })
    }, [purchases, matchesDate, search])

    const filteredExpenses = useMemo(() => {
        const term = search.trim().toLowerCase()

        return expenses.filter(row => {
            const matchesSearch = [
                row.description,
                row.category,
                row.payment_method,
                row.notes,
                row.currency_code
            ].some(value =>
                String(value || '').toLowerCase().includes(term)
            )

            return matchesDate(row.expense_date) && matchesSearch
        })
    }, [expenses, matchesDate, search])

    const filteredPayments = useMemo(() => {
        const term = search.trim().toLowerCase()

        return payments.filter(row => {
            const matchesSearch = [
                row.sale_date,
                row.payment_method,
                row.currency_code,
                row.transaction_count,
                row.total_amount
            ].some(value =>
                String(value ?? '').toLowerCase().includes(term)
            )

            return matchesDate(row.sale_date) && matchesSearch
        })
    }, [payments, matchesDate, search])

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

            grouped[key].transaction_count +=
                Number(row.transaction_count || 0)

            grouped[key].amount += Number(row.total_amount || 0)
        })

        return Object.values(grouped).sort((a, b) =>
            a.currency_code.localeCompare(b.currency_code) ||
            a.method.localeCompare(b.method)
        )
    }, [filteredPayments])

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
                'Cost of Goods Sold',
                'Gross Profit',
                'Operating Expenses',
                'Net Profit',
                'Gross Profit Margin',
                'Net Profit Margin',
                'Missing Cost Lines',
                'Unclassified Sales',
                'Unclassified Expenses'
            ]

            rows = ownerProfitLoss ? [[
                'USD',
                ownerProfitLoss.sales_revenue,
                ownerProfitLoss.cost_of_goods_sold,
                ownerProfitLoss.gross_profit,
                ownerProfitLoss.operating_expenses,
                ownerProfitLoss.net_profit,
                ownerProfitLoss.gross_profit_margin,
                ownerProfitLoss.net_profit_margin,
                ownerProfitLoss.missing_cost_lines,
                ownerProfitLoss.unclassified_sales_count,
                ownerProfitLoss.unclassified_expenses_count
            ]] : []

        } else if (reportType === 'product-profitability') {
            headers = [
                'Product',
                'Quantity Sold',
                'Revenue USD',
                'Cost of Goods Sold USD',
                'Gross Profit USD',
                'Cost Status'
            ]

            rows = productProfitability.map(row => [
                row.product_name,
                row.quantity_sold,
                row.revenue,
                row.cost_of_goods_sold,
                row.gross_profit,
                row.cost_status
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

        const csv = [
            headers.map(escapeCsv).join(','),
            ...rows.map(row => row.map(escapeCsv).join(','))
        ].join('\r\n')

        const blob = new Blob(['\uFEFF' + csv], {
            type: 'text/csv;charset=utf-8;'
        })

        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')

        link.href = url
        link.download =
            `canteen-${reportType}-report-${getHarareToday()}.csv`

        document.body.appendChild(link)
        link.click()
        link.remove()

        // Revoke after the browser has had time to start the download.
        setTimeout(() => URL.revokeObjectURL(url), 1000)
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

    const reportTabs = [
        ['sales', 'Sales'],
        ['purchases', 'Purchases'],
        ['expenses', 'Expenses'],
        ['payments', 'Payments'],
        ['profit-loss', 'Owner Profit & Loss'],
        ['product-profitability', 'Product Profitability']
    ]

    return (
        <div style={styles.page}>
            <div style={styles.header}>
                <div>
                    <h1 style={styles.title}>Reports & Analytics</h1>
                    <div style={styles.subtitle}>
                        Review sales performance, purchases, expenses and payment collections.
                        Business reporting dates use Africa/Harare.
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                    <button
                        style={styles.secondary}
                        onClick={() => {
                            loadData()
                            if (
                                reportType === 'profit-loss' ||
                                reportType === 'product-profitability'
                            ) {
                                loadOwnerReports()
                            }
                        }}
                        disabled={loading || ownerReportLoading}
                    >
                        <RefreshCw size={15} />
                        {loading ? 'Loading...' : 'Refresh'}
                    </button>

                    <button
                        style={styles.button}
                        onClick={exportCsv}
                        disabled={loading || ownerReportLoading}
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
                        max={effectiveEnd || undefined}
                        onChange={event => setStartDate(event.target.value)}
                    />
                </div>

                <div style={{ ...styles.field, flex: '1 1 145px' }}>
                    <label style={styles.label}>Custom to date</label>
                    <input
                        type="date"
                        style={styles.input}
                        value={endDate}
                        min={effectiveStart || undefined}
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
                        {formatNumber(salesTotals.quantity)}
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
                            {row.method.replace(/_/g, ' ')} ({row.currency_code})
                        </div>

                        <div style={styles.cardValue}>
                            {formatAmount(row.amount, row.currency_code)}
                        </div>

                        <div style={{
                            color: '#718096',
                            fontSize: 12,
                            marginTop: 7
                        }}>
                            {formatNumber(row.transaction_count)} transactions
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
                {reportTabs.map(([value, label]) => (
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
                <div style={{ marginTop: 10 }}>
                    {ownerReportLoading ? (
                        <div style={styles.card}>Loading Owner financial report...</div>
                    ) : ownerReportError ? (
                        <div style={{
                            ...styles.message,
                            background: '#fff7e6',
                            color: '#8a5a00'
                        }}>
                            <AlertCircle size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                            {ownerReportError}
                            <div style={{ marginTop: 6 }}>
                                This report is restricted to the canteen Owner by the database.
                                Your other reports remain available.
                            </div>
                        </div>
                    ) : ownerProfitLoss ? (
                        <>
                            <div style={styles.cards}>
                                {[
                                    ['Sales Revenue', ownerProfitLoss.sales_revenue],
                                    ['Cost of Goods Sold', ownerProfitLoss.cost_of_goods_sold],
                                    ['Gross Profit', ownerProfitLoss.gross_profit],
                                    ['Operating Expenses', ownerProfitLoss.operating_expenses],
                                    ['Net Profit', ownerProfitLoss.net_profit]
                                ].map(([label, amount]) => (
                                    <div style={styles.card} key={label}>
                                        <div style={styles.cardLabel}>{label} (USD)</div>
                                        <div style={{
                                            ...styles.cardValue,
                                            color: label === 'Net Profit'
                                                ? Number(amount) >= 0 ? '#176b45' : '#b42318'
                                                : '#162b42'
                                        }}>
                                            {formatAmount(amount, 'USD')}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div style={styles.cards}>
                                <div style={styles.card}>
                                    <div style={styles.cardLabel}>Gross Profit Margin</div>
                                    <div style={styles.cardValue}>
                                        {formatNumber(ownerProfitLoss.gross_profit_margin)}%
                                    </div>
                                </div>

                                <div style={styles.card}>
                                    <div style={styles.cardLabel}>Net Profit Margin</div>
                                    <div style={styles.cardValue}>
                                        {formatNumber(ownerProfitLoss.net_profit_margin)}%
                                    </div>
                                </div>

                                <div style={styles.card}>
                                    <div style={styles.cardLabel}>Missing Cost Lines</div>
                                    <div style={styles.cardValue}>
                                        {formatNumber(ownerProfitLoss.missing_cost_lines)}
                                    </div>
                                </div>

                                <div style={styles.card}>
                                    <div style={styles.cardLabel}>Unclassified Sales</div>
                                    <div style={styles.cardValue}>
                                        {formatNumber(ownerProfitLoss.unclassified_sales_count)}
                                    </div>
                                </div>

                                <div style={styles.card}>
                                    <div style={styles.cardLabel}>Unclassified Expenses</div>
                                    <div style={styles.cardValue}>
                                        {formatNumber(ownerProfitLoss.unclassified_expenses_count)}
                                    </div>
                                </div>
                            </div>

                            <div style={{
                                ...styles.message,
                                background: '#f3f6fa',
                                color: '#536579'
                            }}>
                                <strong>Accounting basis:</strong> This report uses posted
                                financial journal entries and recorded cost of goods sold.
                                It is the database's USD-only Owner financial report, not a
                                calculation based on purchase totals.
                            </div>
                        </>
                    ) : (
                        <div style={styles.card}>No Owner profit-and-loss data returned.</div>
                    )}
                </div>
            )}

            {reportType === 'product-profitability' && (
                <div style={{ marginTop: 10 }}>
                    {ownerReportLoading ? (
                        <div style={styles.card}>Loading product profitability...</div>
                    ) : ownerReportError ? (
                        <div style={{
                            ...styles.message,
                            background: '#fff7e6',
                            color: '#8a5a00'
                        }}>
                            <AlertCircle size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                            {ownerReportError}
                            <div style={{ marginTop: 6 }}>
                                Product profitability is restricted to the canteen Owner.
                            </div>
                        </div>
                    ) : (
                        <>
                            <div style={{
                                ...styles.message,
                                background: '#f3f6fa',
                                color: '#536579'
                            }}>
                                <strong>USD only:</strong> Revenue and cost are calculated
                                from sale-item cost snapshots. Products marked Incomplete
                                have at least one sales line without a recorded cost.
                            </div>

                            <div style={styles.tableWrap}>
                                <table style={styles.table}>
                                    <thead>
                                        <tr>
                                            <th style={styles.th}>Product</th>
                                            <th style={styles.th}>Quantity Sold</th>
                                            <th style={styles.th}>Revenue</th>
                                            <th style={styles.th}>Cost of Goods Sold</th>
                                            <th style={styles.th}>Gross Profit</th>
                                            <th style={styles.th}>Cost Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {productProfitability.length === 0 ? (
                                            <tr>
                                                <td style={styles.td} colSpan="6">
                                                    No product profitability records found.
                                                </td>
                                            </tr>
                                        ) : productProfitability.map((row, index) => (
                                            <tr key={`${row.product_name}-${index}`}>
                                                <td style={styles.td}>{row.product_name}</td>
                                                <td style={styles.td}>
                                                    {formatNumber(row.quantity_sold)}
                                                </td>
                                                <td style={styles.td}>
                                                    {formatAmount(row.revenue, 'USD')}
                                                </td>
                                                <td style={styles.td}>
                                                    {formatAmount(row.cost_of_goods_sold, 'USD')}
                                                </td>
                                                <td style={styles.td}>
                                                    {formatAmount(row.gross_profit, 'USD')}
                                                </td>
                                                <td style={styles.td}>
                                                    <span style={{
                                                        color: row.cost_status === 'Costed'
                                                            ? '#176b45'
                                                            : '#b42318',
                                                        fontWeight: 700
                                                    }}>
                                                        {row.cost_status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
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
                                {category.name}{category.active === false ? ' (Inactive)' : ''}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {!['profit-loss', 'product-profitability'].includes(reportType) && (
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

            {!['profit-loss', 'product-profitability'].includes(reportType) && (
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
                                    <td style={styles.td} colSpan={
                                        reportType === 'sales' ? 8 :
                                            reportType === 'purchases' ? 9 :
                                                reportType === 'expenses' ? 6 : 5
                                    }>
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
                                        <td style={styles.td}>
                                            {formatNumber(row.quantity_sold)}
                                        </td>
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
                                            {formatNumber(row.ordered_quantity)} {row.unit}
                                        </td>
                                        <td style={styles.td}>
                                            {formatNumber(row.quantity)} {row.unit}
                                        </td>
                                        <td style={styles.td}>
                                            {formatNumber(row.excess_quantity)} {row.unit}
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
                                            {(row.payment_method || 'other').replace(/_/g, ' ')}
                                        </td>
                                        <td style={styles.td}>{row.currency_code}</td>
                                        <td style={styles.td}>
                                            {formatNumber(row.transaction_count)}
                                        </td>
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
                                        <td style={styles.td}>
                                            {formatNumber(item.quantity)}
                                        </td>
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
                                        <td style={styles.td}>
                                            {formatNumber(row.quantity)}
                                        </td>
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
        </div>
    )
}
