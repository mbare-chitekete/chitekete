
import { useEffect, useMemo, useState } from 'react'
import {
    Search, RefreshCw, Plus, X, Save,
    Receipt, TrendingDown, CalendarDays, Download
} from 'lucide-react'
import { supabase } from './supabase'
import { useCurrency } from './CurrencyContext'

const CATEGORIES = [
    'Utilities',
    'Cleaning & Hygiene',
    'Packaging',
    'Staff Welfare',
    'Repairs & Maintenance',
    'Rent & Premises',
    'Licences & Compliance',
    'Transport & Delivery',
    'Administration',
    'Banking & Finance',
    'Marketing',
    'Security',
    'Losses',
    'Other'
]

const PAYMENT_METHODS = [
    { value: 'cash', label: 'Cash' },
    { value: 'mobile_money', label: 'Mobile Money' },
    { value: 'bank_card', label: 'Bank / Card' }
]

const SUPPORTED_CURRENCIES = ['USD', 'ZAR', 'ZWG']

const EMPTY_FORM = {
    expense_date: new Date().toISOString().slice(0, 10),
    description: '',
    category: 'Utilities',
    amount: '',
    currency_code: 'USD',
    payment_method: 'cash',
    notes: ''
}

const styles = {
    page: { padding: '24px', color: '#162b42', maxWidth: '1400px', margin: '0 auto' },
    heading: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '22px' },
    title: { fontSize: '25px', fontWeight: 800, margin: 0 },
    subtitle: { color: '#718096', marginTop: '6px', fontSize: '13px' },
    button: { border: 'none', borderRadius: '9px', padding: '10px 15px', background: '#16734a', color: '#fff', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '7px' },
    secondary: { border: '1px solid #dce5ed', borderRadius: '9px', padding: '10px 14px', background: '#fff', color: '#34495e', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '7px' },
    cards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: '14px', marginBottom: '20px' },
    card: { background: '#fff', border: '1px solid #e5ebf1', borderRadius: '13px', padding: '17px' },
    cardLabel: { color: '#718096', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' },
    cardValue: { fontSize: '23px', fontWeight: 800, marginTop: '9px' },
    panel: { background: '#fff', border: '1px solid #e5ebf1', borderRadius: '13px', padding: '17px', marginBottom: '18px' },
    filters: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '10px', marginTop: '14px' },
    input: { width: '100%', boxSizing: 'border-box', padding: '10px 11px', border: '1px solid #dce5ed', borderRadius: '8px', background: '#fff', color: '#162b42', fontSize: '13px' },
    label: { display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: '#526477' },
    tableWrap: { overflowX: 'auto' },
    table: { width: '100%', borderCollapse: 'collapse', minWidth: '900px', fontSize: '13px' },
    th: { textAlign: 'left', padding: '12px 10px', color: '#718096', background: '#f7f9fb', borderBottom: '1px solid #e5ebf1', whiteSpace: 'nowrap' },
    td: { padding: '13px 10px', borderBottom: '1px solid #edf1f5', verticalAlign: 'middle' },
    message: { padding: '11px 13px', borderRadius: '8px', background: '#eff8f2', color: '#17633c', marginBottom: '14px', fontSize: '13px' },
    error: { padding: '11px 13px', borderRadius: '8px', background: '#fff0f0', color: '#a52b2b', marginBottom: '14px', fontSize: '13px' },
    warning: { padding: '11px 13px', borderRadius: '8px', background: '#fff8e8', color: '#805b16', marginBottom: '14px', fontSize: '13px' },
    overlay: { position: 'fixed', inset: 0, background: 'rgba(15,30,45,.45)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px' },
    modal: { background: '#fff', borderRadius: '15px', padding: '22px', width: '100%', maxWidth: '570px', maxHeight: '90vh', overflowY: 'auto' },
    formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: '13px', marginTop: '18px' }
}

function formatDate(value) {
    if (!value) return '—'

    return new Date(`${value}T12:00:00`).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    })
}

function paymentLabel(value) {
    return PAYMENT_METHODS.find(item => item.value === value)?.label || value
}

function formatMoney(value, currency = 'USD') {
    const amount = Number(value || 0)

    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount)
    } catch {
        return `${currency} ${amount.toFixed(2)}`
    }
}

function getConfiguredRates(settings) {
    const rates = settings?.exchange_rates_to_usd || {}

    return SUPPORTED_CURRENCIES.reduce((result, currency) => {
        const rate = Number(rates[currency])

        if (Number.isFinite(rate) && rate > 0) {
            result[currency] = rate
        }

        return result
    }, {})
}

export default function Expenses() {
    const { currencyCode } = useCurrency()

    const [expenses, setExpenses] = useState([])
    const [settings, setSettings] = useState(null)

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [showForm, setShowForm] = useState(false)

    const [form, setForm] = useState({
        ...EMPTY_FORM,
        currency_code: currencyCode || 'USD'
    })

    const [search, setSearch] = useState('')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [categoryFilter, setCategoryFilter] = useState('all')
    const [paymentFilter, setPaymentFilter] = useState('all')
    const [currencyFilter, setCurrencyFilter] = useState('all')

    const [message, setMessage] = useState('')
    const [errorMessage, setErrorMessage] = useState('')

    const exchangeRates = useMemo(
        () => getConfiguredRates(settings),
        [settings]
    )

    const availableCurrencies = useMemo(
        () => SUPPORTED_CURRENCIES.filter(
            currency => Number.isFinite(exchangeRates[currency]) &&
                exchangeRates[currency] > 0
        ),
        [exchangeRates]
    )

    async function loadExpenses() {
        setLoading(true)
        setErrorMessage('')

        const [expensesResult, settingsResult] = await Promise.all([
            supabase
                .from('expenses')
                .select('*')
                .order('expense_date', { ascending: false })
                .order('created_at', { ascending: false }),

            supabase
                .from('canteen_settings')
                .select('currency_code, exchange_rates_to_usd')
                .eq('id', true)
                .maybeSingle()
        ])

        if (expensesResult.error) {
            setErrorMessage(expensesResult.error.message)
        } else {
            setExpenses(expensesResult.data || [])
        }

        if (settingsResult.error) {
            setErrorMessage(current =>
                current
                    ? `${current} | Settings: ${settingsResult.error.message}`
                    : `Could not load currency settings: ${settingsResult.error.message}`
            )
        } else {
            setSettings(settingsResult.data || null)
        }

        setLoading(false)
    }

    useEffect(() => {
        loadExpenses()
    }, [])

    useEffect(() => {
        if (!showForm) return

        const defaultCurrency =
            settings?.currency_code ||
            currencyCode ||
            'USD'

        setForm(current => ({
            ...current,
            currency_code: availableCurrencies.includes(defaultCurrency)
                ? defaultCurrency
                : availableCurrencies[0] || 'USD'
        }))
    }, [settings, currencyCode, showForm, availableCurrencies])

    const filteredExpenses = useMemo(() => {
        const term = search.trim().toLowerCase()

        return expenses.filter(expense => {
            const matchesSearch = !term || [
                expense.description,
                expense.category,
                expense.payment_method,
                expense.notes,
                expense.currency_code
            ].some(value =>
                String(value || '').toLowerCase().includes(term)
            )

            const matchesStart =
                !startDate || expense.expense_date >= startDate

            const matchesEnd =
                !endDate || expense.expense_date <= endDate

            const matchesCategory =
                categoryFilter === 'all' ||
                expense.category === categoryFilter

            const matchesPayment =
                paymentFilter === 'all' ||
                expense.payment_method === paymentFilter

            const matchesCurrency =
                currencyFilter === 'all' ||
                expense.currency_code === currencyFilter

            return matchesSearch &&
                matchesStart &&
                matchesEnd &&
                matchesCategory &&
                matchesPayment &&
                matchesCurrency
        })
    }, [
        expenses,
        search,
        startDate,
        endDate,
        categoryFilter,
        paymentFilter,
        currencyFilter
    ])

    // Never add amounts in different currencies together.
    const totalsByCurrency = useMemo(() => {
        const totals = {}

        filteredExpenses.forEach(expense => {
            const currency = expense.currency_code || 'USD'
            const amount = Number(expense.amount || 0)

            if (!totals[currency]) {
                totals[currency] = {
                    total: 0,
                    cash: 0,
                    digital: 0,
                    count: 0
                }
            }

            totals[currency].total += amount
            totals[currency].count += 1

            if (expense.payment_method === 'cash') {
                totals[currency].cash += amount
            } else {
                totals[currency].digital += amount
            }
        })

        return totals
    }, [filteredExpenses])

    const currenciesInTotals = Object.keys(totalsByCurrency).sort()

    function openNewForm() {
        const defaultCurrency =
            settings?.currency_code ||
            currencyCode ||
            'USD'

        setForm({
            ...EMPTY_FORM,
            expense_date: new Date().toISOString().slice(0, 10),
            currency_code: availableCurrencies.includes(defaultCurrency)
                ? defaultCurrency
                : availableCurrencies[0] || 'USD'
        })

        setMessage('')
        setErrorMessage('')
        setShowForm(true)
    }

    async function handleSave(event) {
        event.preventDefault()

        setSaving(true)
        setMessage('')
        setErrorMessage('')

        const amount = Number(form.amount)
        const selectedCurrency = form.currency_code

        if (
            !form.expense_date ||
            !form.description.trim() ||
            !form.category ||
            !form.payment_method ||
            form.amount === '' ||
            !Number.isFinite(amount) ||
            amount <= 0
        ) {
            setErrorMessage(
                'Please complete all required fields and enter an amount greater than zero.'
            )
            setSaving(false)
            return
        }

        if (!availableCurrencies.includes(selectedCurrency)) {
            setErrorMessage(
                `No valid exchange rate is configured for ${selectedCurrency}. Configure it in Settings before recording this expense.`
            )
            setSaving(false)
            return
        }

        const payload = {
            expense_date: form.expense_date,
            description: form.description.trim(),
            category: form.category,
            amount,
            currency_code: selectedCurrency,
            payment_method: form.payment_method,
            notes: form.notes.trim() || null
        }

        // The database trigger reads the central exchange rate and
        // stores the FX snapshot. Do not send a client-calculated rate.
        const { error } = await supabase
            .from('expenses')
            .insert(payload)

        if (error) {
            setErrorMessage(error.message)
        } else {
            setMessage('Expense recorded successfully.')
            setShowForm(false)
            setForm({
                ...EMPTY_FORM,
                currency_code: settings?.currency_code || currencyCode || 'USD'
            })

            await loadExpenses()

            window.dispatchEvent(
                new Event('refresh-canteen-dashboard')
            )
        }

        setSaving(false)
    }

    function clearFilters() {
        setSearch('')
        setStartDate('')
        setEndDate('')
        setCategoryFilter('all')
        setPaymentFilter('all')
        setCurrencyFilter('all')
    }

    function exportCsv() {
        const headers = [
            'Date',
            'Description',
            'Category',
            'Amount',
            'Currency',
            'FX Rate to USD',
            'Payment Method',
            'Notes'
        ]

        const rows = filteredExpenses.map(item => [
            item.expense_date,
            item.description,
            item.category,
            item.amount,
            item.currency_code || '',
            item.fx_rate_to_usd ?? '',
            paymentLabel(item.payment_method),
            item.notes || ''
        ])

        const escapeCsv = value =>
            `"${String(value ?? '').replace(/"/g, '""')}"`

        const csv = [headers, ...rows]
            .map(row => row.map(escapeCsv).join(','))
            .join('\n')

        const blob = new Blob(
            ['\uFEFF', csv],
            { type: 'text/csv;charset=utf-8;' }
        )

        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')

        link.href = url
        link.download = `canteen-expenses-${new Date().toISOString().slice(0, 10)}.csv`

        document.body.appendChild(link)
        link.click()
        link.remove()

        URL.revokeObjectURL(url)
    }

    return (
        <div style={styles.page}>
            <div style={styles.heading}>
                <div>
                    <h1 style={styles.title}>Expenses</h1>
                    <p style={styles.subtitle}>
                        Record, manage and track all canteen expenses.
                    </p>
                </div>

                <div style={{
                    display: 'flex',
                    gap: '9px',
                    flexWrap: 'wrap'
                }}>
                    <button
                        style={styles.secondary}
                        onClick={loadExpenses}
                        disabled={loading}
                    >
                        <RefreshCw size={15} />
                        Refresh
                    </button>

                    <button
                        style={styles.secondary}
                        onClick={exportCsv}
                        disabled={filteredExpenses.length === 0}
                    >
                        <Download size={15} />
                        Export CSV
                    </button>

                    <button
                        style={styles.button}
                        onClick={openNewForm}
                        disabled={availableCurrencies.length === 0}
                    >
                        <Plus size={16} />
                        Add Expense
                    </button>
                </div>
            </div>

            {message && (
                <div style={styles.message}>{message}</div>
            )}

            {errorMessage && (
                <div style={styles.error}>{errorMessage}</div>
            )}

            {!loading && availableCurrencies.length === 0 && (
                <div style={styles.warning}>
                    No valid exchange rates are configured. Add a valid
                    USD, ZAR or ZWG rate in Settings before recording
                    expenses.
                </div>
            )}

            <div style={styles.cards}>
                <div style={styles.card}>
                    <div style={styles.cardLabel}>
                        <Receipt size={15} />
                        Total Expenses by Currency
                    </div>

                    {currenciesInTotals.length === 0 ? (
                        <div style={styles.cardValue}>—</div>
                    ) : (
                        <div style={{ marginTop: '9px' }}>
                            {currenciesInTotals.map(currency => (
                                <div
                                    key={currency}
                                    style={{
                                        fontSize: '18px',
                                        fontWeight: 800,
                                        marginBottom: '5px'
                                    }}
                                >
                                    {formatMoney(
                                        totalsByCurrency[currency].total,
                                        currency
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    <div style={styles.subtitle}>
                        Filtered records; currencies kept separate
                    </div>
                </div>

                <div style={styles.card}>
                    <div style={styles.cardLabel}>
                        Cash Expenses
                    </div>

                    {currenciesInTotals.length === 0 ? (
                        <div style={styles.cardValue}>—</div>
                    ) : (
                        <div style={{ marginTop: '9px' }}>
                            {currenciesInTotals.map(currency => (
                                <div
                                    key={currency}
                                    style={{
                                        fontSize: '18px',
                                        fontWeight: 800,
                                        marginBottom: '5px'
                                    }}
                                >
                                    {formatMoney(
                                        totalsByCurrency[currency].cash,
                                        currency
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    <div style={styles.subtitle}>
                        Physical cash expenses
                    </div>
                </div>

                <div style={styles.card}>
                    <div style={styles.cardLabel}>
                        Digital Expenses
                    </div>

                    {currenciesInTotals.length === 0 ? (
                        <div style={styles.cardValue}>—</div>
                    ) : (
                        <div style={{ marginTop: '9px' }}>
                            {currenciesInTotals.map(currency => (
                                <div
                                    key={currency}
                                    style={{
                                        fontSize: '18px',
                                        fontWeight: 800,
                                        marginBottom: '5px'
                                    }}
                                >
                                    {formatMoney(
                                        totalsByCurrency[currency].digital,
                                        currency
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    <div style={styles.subtitle}>
                        Mobile Money and Bank / Card
                    </div>
                </div>

                <div style={styles.card}>
                    <div style={styles.cardLabel}>
                        <TrendingDown size={15} />
                        Expense Records
                    </div>

                    <div style={styles.cardValue}>
                        {filteredExpenses.length}
                    </div>

                    <div style={styles.subtitle}>
                        Matching records
                    </div>
                </div>
            </div>

            <div style={styles.panel}>
                <strong style={{ fontSize: '14px' }}>
                    Search and filter expenses
                </strong>

                <div style={styles.filters}>
                    <div>
                        <label style={styles.label}>Search</label>

                        <div style={{ position: 'relative' }}>
                            <Search
                                size={15}
                                style={{
                                    position: 'absolute',
                                    left: 10,
                                    top: 11,
                                    color: '#8998a8'
                                }}
                            />

                            <input
                                style={{
                                    ...styles.input,
                                    paddingLeft: '32px'
                                }}
                                placeholder="Description, notes, category..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <label style={styles.label}>From date</label>
                        <input
                            style={styles.input}
                            type="date"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                        />
                    </div>

                    <div>
                        <label style={styles.label}>To date</label>
                        <input
                            style={styles.input}
                            type="date"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                        />
                    </div>

                    <div>
                        <label style={styles.label}>Category</label>

                        <select
                            style={styles.input}
                            value={categoryFilter}
                            onChange={e => setCategoryFilter(e.target.value)}
                        >
                            <option value="all">All Categories</option>

                            {[...new Set([
                                ...CATEGORIES,
                                ...expenses
                                    .map(expense => expense.category)
                                    .filter(Boolean)
                            ])].map(category => (
                                <option key={category} value={category}>
                                    {category}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label style={styles.label}>Payment method</label>

                        <select
                            style={styles.input}
                            value={paymentFilter}
                            onChange={e => setPaymentFilter(e.target.value)}
                        >
                            <option value="all">
                                All Payment Methods
                            </option>

                            {PAYMENT_METHODS.map(method => (
                                <option
                                    key={method.value}
                                    value={method.value}
                                >
                                    {method.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label style={styles.label}>Currency</label>

                        <select
                            style={styles.input}
                            value={currencyFilter}
                            onChange={e => setCurrencyFilter(e.target.value)}
                        >
                            <option value="all">All Currencies</option>

                            {SUPPORTED_CURRENCIES.map(currency => (
                                <option key={currency} value={currency}>
                                    {currency}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div style={{
                        display: 'flex',
                        alignItems: 'end'
                    }}>
                        <button
                            style={styles.secondary}
                            onClick={clearFilters}
                        >
                            Clear Filters
                        </button>
                    </div>
                </div>

                <p style={{
                    fontSize: '12px',
                    color: '#718096',
                    margin: '13px 0 0'
                }}>
                    Showing {filteredExpenses.length} of {expenses.length} expenses
                </p>
            </div>

            <div style={styles.panel}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '10px',
                    marginBottom: '14px'
                }}>
                    <strong style={{ fontSize: '15px' }}>
                        Expense Records
                    </strong>

                    <span style={{
                        fontSize: '12px',
                        color: '#718096'
                    }}>
                        <CalendarDays
                            size={14}
                            style={{
                                verticalAlign: 'middle',
                                marginRight: '5px'
                            }}
                        />
                        Latest records first
                    </span>
                </div>

                {loading ? (
                    <p style={{
                        color: '#718096',
                        padding: '20px'
                    }}>
                        Loading expenses...
                    </p>
                ) : filteredExpenses.length === 0 ? (
                    <p style={{
                        color: '#718096',
                        padding: '25px',
                        textAlign: 'center'
                    }}>
                        No expenses found. Add an expense or adjust your filters.
                    </p>
                ) : (
                    <div style={styles.tableWrap}>
                        <table style={styles.table}>
                            <thead>
                                <tr>
                                    <th style={styles.th}>Date</th>
                                    <th style={styles.th}>Description</th>
                                    <th style={styles.th}>Category</th>
                                    <th style={styles.th}>Amount</th>
                                    <th style={styles.th}>Currency</th>
                                    <th style={styles.th}>Payment Method</th>
                                    <th style={styles.th}>Notes</th>
                                    <th style={styles.th}>Record Type</th>
                                </tr>
                            </thead>

                            <tbody>
                                {filteredExpenses.map(expense => (
                                    <tr key={expense.id}>
                                        <td style={styles.td}>
                                            {formatDate(expense.expense_date)}
                                        </td>

                                        <td style={{
                                            ...styles.td,
                                            fontWeight: 700
                                        }}>
                                            {expense.description}
                                        </td>

                                        <td style={styles.td}>
                                            {expense.category}
                                        </td>

                                        <td style={{
                                            ...styles.td,
                                            fontWeight: 700,
                                            whiteSpace: 'nowrap'
                                        }}>
                                            {formatMoney(
                                                expense.amount,
                                                expense.currency_code || 'USD'
                                            )}
                                        </td>

                                        <td style={styles.td}>
                                            <span style={{
                                                background: '#f0f4f8',
                                                borderRadius: '6px',
                                                padding: '4px 7px',
                                                fontWeight: 700,
                                                fontSize: '11px'
                                            }}>
                                                {expense.currency_code || 'USD'}
                                            </span>
                                        </td>

                                        <td style={styles.td}>
                                            {paymentLabel(expense.payment_method)}
                                        </td>

                                        <td style={{
                                            ...styles.td,
                                            color: '#718096',
                                            maxWidth: '180px'
                                        }}>
                                            {expense.notes || '—'}
                                        </td>

                                        <td style={styles.td}>
                                            {expense.category === 'Staff Salary' ? (
                                                <span style={{
                                                    color: '#718096',
                                                    fontSize: '12px',
                                                    fontWeight: 600
                                                }}>
                                                    Payroll record
                                                </span>
                                            ) : (
                                                <span style={{
                                                    color: '#17633c',
                                                    fontSize: '12px',
                                                    fontWeight: 600
                                                }}>
                                                    Operational expense
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {showForm && (
                <div
                    style={styles.overlay}
                    onClick={() => !saving && setShowForm(false)}
                >
                    <div
                        style={styles.modal}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <h2 style={{
                                margin: 0,
                                fontSize: '19px'
                            }}>
                                Record New Expense
                            </h2>

                            <button
                                type="button"
                                style={styles.secondary}
                                onClick={() => setShowForm(false)}
                                disabled={saving}
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSave}>
                            <div style={styles.formGrid}>
                                <div>
                                    <label style={styles.label}>
                                        Expense Date *
                                    </label>

                                    <input
                                        required
                                        type="date"
                                        style={styles.input}
                                        value={form.expense_date}
                                        onChange={e => setForm({
                                            ...form,
                                            expense_date: e.target.value
                                        })}
                                    />
                                </div>

                                <div>
                                    <label style={styles.label}>
                                        Description *
                                    </label>

                                    <input
                                        required
                                        style={styles.input}
                                        placeholder="e.g. Electricity bill"
                                        value={form.description}
                                        onChange={e => setForm({
                                            ...form,
                                            description: e.target.value
                                        })}
                                    />
                                </div>

                                <div>
                                    <label style={styles.label}>
                                        Category *
                                    </label>

                                    <select
                                        required
                                        style={styles.input}
                                        value={form.category}
                                        onChange={e => setForm({
                                            ...form,
                                            category: e.target.value
                                        })}
                                    >
                                        {CATEGORIES.map(category => (
                                            <option
                                                key={category}
                                                value={category}
                                            >
                                                {category}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label style={styles.label}>
                                        Amount *
                                    </label>

                                    <input
                                        required
                                        min="0.01"
                                        step="0.01"
                                        type="number"
                                        style={styles.input}
                                        placeholder="Enter amount"
                                        value={form.amount}
                                        onChange={e => setForm({
                                            ...form,
                                            amount: e.target.value
                                        })}
                                    />
                                </div>

                                <div>
                                    <label style={styles.label}>
                                        Expense Currency *
                                    </label>

                                    <select
                                        required
                                        style={styles.input}
                                        value={form.currency_code}
                                        onChange={e => setForm({
                                            ...form,
                                            currency_code: e.target.value
                                        })}
                                    >
                                        {availableCurrencies.map(currency => (
                                            <option
                                                key={currency}
                                                value={currency}
                                            >
                                                {currency}
                                                {currency === settings?.currency_code
                                                    ? ' (Business Currency)'
                                                    : ''}
                                            </option>
                                        ))}
                                    </select>

                                    <p style={{
                                        fontSize: '11px',
                                        color: '#718096',
                                        margin: '5px 0 0'
                                    }}>
                                        The exchange rate is taken automatically
                                        from Settings and saved with this expense.
                                    </p>
                                </div>

                                <div>
                                    <label style={styles.label}>
                                        Payment Method *
                                    </label>

                                    <select
                                        required
                                        style={styles.input}
                                        value={form.payment_method}
                                        onChange={e => setForm({
                                            ...form,
                                            payment_method: e.target.value
                                        })}
                                    >
                                        {PAYMENT_METHODS.map(method => (
                                            <option
                                                key={method.value}
                                                value={method.value}
                                            >
                                                {method.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label style={styles.label}>
                                        Notes (Optional)
                                    </label>

                                    <textarea
                                        rows="3"
                                        style={{
                                            ...styles.input,
                                            resize: 'vertical'
                                        }}
                                        placeholder="Additional information..."
                                        value={form.notes}
                                        onChange={e => setForm({
                                            ...form,
                                            notes: e.target.value
                                        })}
                                    />
                                </div>
                            </div>

                            <div style={{
                                display: 'flex',
                                justifyContent: 'flex-end',
                                gap: '9px',
                                marginTop: '20px'
                            }}>
                                <button
                                    type="button"
                                    style={styles.secondary}
                                    onClick={() => setShowForm(false)}
                                    disabled={saving}
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    disabled={saving || availableCurrencies.length === 0}
                                    style={{
                                        ...styles.button,
                                        opacity: saving ? 0.65 : 1
                                    }}
                                >
                                    <Save size={15} />
                                    {saving ? 'Saving...' : 'Save Expense'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
