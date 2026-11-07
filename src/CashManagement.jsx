
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
    Search, RefreshCw, Plus, X, Wallet, TrendingUp, TrendingDown,
    Banknote, Save, Pencil, Landmark, LockKeyhole, ArrowDownToLine,
    FileText, Printer
} from 'lucide-react'
import { supabase } from './supabase'

const CURRENCIES = ['USD', 'ZAR', 'ZWG']

const today = () => {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Africa/Harare',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(new Date())

    const values = Object.fromEntries(parts.map(p => [p.type, p.value]))
    return `${values.year}-${values.month}-${values.day}`
}

const money = (amount, currency) => {
    const value = Number(amount || 0)
    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value)
    } catch {
        return `${currency} ${value.toFixed(2)}`
    }
}

const emptyCashForm = () => ({
    cash_date: today(),
    opening_cash: '0',
    opening_purchase_reserve: '0',
    counted_cash: '',
    notes: ''
})

const emptyAllocationForm = () => ({
    cash_date: today(),
    bank_transfer: '0',
    till_float: '0',
    purchase_reserve: '0',
    safe_deposit: '0',
    notes: ''
})

const emptyWithdrawalForm = () => ({
    withdrawal_date: today(),
    amount: '',
    purpose: '',
    notes: ''
})

const allocationCategories = [
    { key: 'bank_transfer', label: 'Bank transfer' },
    { key: 'till_float', label: "Tomorrow's till float" },
    { key: 'purchase_reserve', label: "Tomorrow's purchase reserve" },
    { key: 'safe_deposit', label: 'Safe deposit' }
]

const styles = {
    page: { padding: 24, color: '#162b42' },
    header: {
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 22
    },
    title: { margin: 0, fontSize: 25, fontWeight: 800 },
    subtitle: { color: '#718096', marginTop: 5, fontSize: 13 },
    button: {
        display: 'inline-flex', alignItems: 'center', gap: 7,
        border: 'none', borderRadius: 9, padding: '10px 14px',
        background: '#176b45', color: 'white', fontWeight: 700,
        cursor: 'pointer'
    },
    secondary: {
        display: 'inline-flex', alignItems: 'center', gap: 7,
        border: '1px solid #dce4ec', borderRadius: 9,
        padding: '10px 13px', background: 'white',
        color: '#263b50', fontWeight: 600, cursor: 'pointer'
    },
    cards: {
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(175px,1fr))',
        gap: 14, marginBottom: 20
    },
    card: {
        background: 'white', border: '1px solid #e6ebf1',
        borderRadius: 13, padding: 17
    },
    cardLabel: {
        color: '#718096', fontSize: 12, fontWeight: 600,
        display: 'flex', alignItems: 'center', gap: 6
    },
    cardValue: { fontSize: 21, fontWeight: 800, marginTop: 9 },
    filters: {
        display: 'flex', flexWrap: 'wrap', gap: 10,
        marginBottom: 14, alignItems: 'end'
    },
    input: {
        width: '100%', boxSizing: 'border-box', padding: '10px 12px',
        border: '1px solid #dce4ec', borderRadius: 8,
        background: 'white', color: '#162b42', fontSize: 13
    },
    field: { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 },
    label: { fontSize: 12, fontWeight: 700, color: '#536579' },
    tableWrap: {
        overflowX: 'auto', background: 'white',
        border: '1px solid #e6ebf1', borderRadius: 12
    },
    table: { width: '100%', borderCollapse: 'collapse', minWidth: 1250 },
    th: {
        textAlign: 'left', padding: '13px 12px',
        background: '#f7f9fc', color: '#64748b',
        fontSize: 11, textTransform: 'uppercase', whiteSpace: 'nowrap'
    },
    td: {
        padding: '13px 12px', borderTop: '1px solid #edf1f5',
        fontSize: 13, whiteSpace: 'nowrap'
    },
    modal: {
        position: 'fixed', inset: 0, background: 'rgba(15,30,45,.55)',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        padding: 16, zIndex: 1000
    },
    modalBox: {
        background: 'white', borderRadius: 15, padding: 22,
        width: '100%', maxWidth: 650, maxHeight: '90vh', overflowY: 'auto'
    },
    formGrid: {
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))',
        gap: 14
    },
    message: { padding: 12, borderRadius: 8, marginBottom: 14, fontSize: 13 }
}

export default function CashManagement() {
    const [currencyCode, setCurrencyCode] = useState('USD')

    const [cashDays, setCashDays] = useState([])
    const [sales, setSales] = useState([])
    const [purchases, setPurchases] = useState([])
    const [expenses, setExpenses] = useState([])
    const [allocations, setAllocations] = useState([])
    const [withdrawals, setWithdrawals] = useState([])

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    const [showCashForm, setShowCashForm] = useState(false)
    const [showAllocationForm, setShowAllocationForm] = useState(false)
    const [showWithdrawalForm, setShowWithdrawalForm] = useState(false)

    const [cashForm, setCashForm] = useState(emptyCashForm)
    const [allocationForm, setAllocationForm] = useState(emptyAllocationForm)
    const [withdrawalForm, setWithdrawalForm] = useState(emptyWithdrawalForm)

    const [editingId, setEditingId] = useState(null)
    const [reportRow, setReportRow] = useState(null)

    const [search, setSearch] = useState('')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')

    const [message, setMessage] = useState('')
    const [error, setError] = useState('')

    const fmt = value => money(value, currencyCode)

    const loadData = useCallback(async () => {
        setLoading(true)
        setError('')

        try {
            const results = await Promise.all([
                supabase.from('cash_management_days')
                    .select('*')
                    .order('cash_date', { ascending: false }),

                supabase.rpc('reports_get_payment_summary', {
                    p_start_date: null,
                    p_end_date: null
                }),

                supabase.from('purchases')
                    .select('purchase_date,total_purchase,payment_method,currency_code,item_name,notes'),

                supabase.from('expenses')
                    .select('expense_date,description,amount,payment_method,currency_code,notes'),

                supabase.from('cash_allocations')
                    .select('*')
                    .order('created_at', { ascending: false }),

                supabase.from('safe_withdrawals')
                    .select('*,cash_management_days!inner(cash_date,currency_code)')
                    .order('created_at', { ascending: false })
            ])

            const failed = results.find(result => result.error)
            if (failed) throw failed.error

            setCashDays(results[0].data || [])
            setSales(results[1].data || [])
            setPurchases(results[2].data || [])
            setExpenses(results[3].data || [])
            setAllocations(results[4].data || [])
            setWithdrawals(results[5].data || [])
        } catch (err) {
            setError(err.message || 'Could not load cash-management records.')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        loadData()
    }, [loadData])

    const dailyRows = useMemo(() => {
        const dates = new Set([
            ...cashDays.filter(r => r.currency_code === currencyCode).map(r => r.cash_date),
            ...sales.filter(r => r.currency_code === currencyCode).map(r => r.sale_date),
            ...purchases.filter(r => r.currency_code === currencyCode).map(r => r.purchase_date),
            ...expenses.filter(r => r.currency_code === currencyCode).map(r => r.expense_date)
        ])

        return [...dates].sort((a, b) => b.localeCompare(a)).map(date => {
            const position = cashDays.find(r =>
                r.cash_date === date && r.currency_code === currencyCode
            )

            const daySales = sales.filter(r =>
                r.sale_date === date && r.currency_code === currencyCode
            )
            const dayPurchases = purchases.filter(r =>
                r.purchase_date === date && r.currency_code === currencyCode
            )
            const dayExpenses = expenses.filter(r =>
                r.expense_date === date && r.currency_code === currencyCode
            )

            const dayAllocations = position
                ? allocations.filter(r => r.cash_day_id === position.id)
                : []

            const dayWithdrawals = position
                ? withdrawals.filter(r => r.cash_day_id === position.id)
                : []

            const sumSales = methods => daySales
                .filter(r => methods.includes(r.payment_method))
                .reduce((sum, r) => sum + Number(r.total_amount || 0), 0)

            const cashSales = sumSales(['cash'])
            const mobileMoney = sumSales(['mobile_money'])
            const bankCard = sumSales(['bank_card', 'card', 'bank'])
            const otherSales = daySales
                .filter(r => !['cash', 'mobile_money', 'bank_card', 'card', 'bank'].includes(r.payment_method))
                .reduce((sum, r) => sum + Number(r.total_amount || 0), 0)

            const cashPurchases = dayPurchases
                .filter(r => r.payment_method === 'cash')
                .reduce((sum, r) => sum + Number(r.total_purchase || 0), 0)

            const cashExpenses = dayExpenses
                .filter(r => r.payment_method === 'cash')
                .reduce((sum, r) => sum + Number(r.amount || 0), 0)

            const openingCash = Number(position?.opening_cash || 0)
            const openingPurchaseReserve = Number(position?.opening_purchase_reserve || 0)

            const expectedClosing =
                openingCash + openingPurchaseReserve + cashSales -
                cashPurchases - cashExpenses

            const countedCash = position?.counted_cash == null
                ? null
                : Number(position.counted_cash)

            const difference = countedCash === null
                ? null
                : countedCash - expectedClosing

            const allocationTotal = dayAllocations.reduce(
                (sum, r) => sum + Number(r.amount || 0), 0
            )

            const allocationValue = category => dayAllocations
                .filter(r => r.category === category)
                .reduce((sum, r) => sum + Number(r.amount || 0), 0)

            const allocationStatus = countedCash === null
                ? 'Awaiting Cash Count'
                : Math.abs(allocationTotal - countedCash) <= 0.01
                    ? 'Fully Allocated'
                    : allocationTotal === 0
                        ? 'Not Allocated'
                        : 'Incomplete'

            const closingStatus = position?.closed_at
                ? 'Closed'
                : countedCash === null
                    ? 'Open'
                    : difference < -0.01
                        ? 'Shortage'
                        : difference > 0.01
                            ? 'Surplus'
                            : 'Reconciled'

            return {
                date, position, daySales, dayPurchases, dayExpenses,
                dayAllocations, dayWithdrawals, cashSales, mobileMoney,
                bankCard, otherSales, cashPurchases, cashExpenses,
                openingCash, openingPurchaseReserve, expectedClosing,
                countedCash, difference, closingStatus, allocationTotal,
                allocationStatus,
                bankTransfer: allocationValue('bank_transfer'),
                tillFloat: allocationValue('till_float'),
                purchaseReserve: allocationValue('purchase_reserve'),
                safeDeposit: allocationValue('safe_deposit'),
                totalSales: cashSales + mobileMoney + bankCard + otherSales
            }
        })
    }, [cashDays, sales, purchases, expenses, allocations, withdrawals, currencyCode])

    const filteredRows = useMemo(() => dailyRows.filter(row => {
        const searchText = [
            row.date,
            row.position?.notes,
            ...row.dayPurchases.flatMap(r => [r.item_name, r.payment_method, r.notes]),
            ...row.dayExpenses.flatMap(r => [r.description, r.payment_method, r.notes]),
            ...row.dayAllocations.map(r => r.notes),
            ...row.dayWithdrawals.map(r => r.purpose)
        ].join(' ').toLowerCase()

        return searchText.includes(search.toLowerCase()) &&
            (!startDate || row.date >= startDate) &&
            (!endDate || row.date <= endDate) &&
            (statusFilter === 'all' || row.closingStatus.toLowerCase() === statusFilter)
    }), [dailyRows, search, startDate, endDate, statusFilter])

    const totals = useMemo(() => {
        const sum = key => filteredRows.reduce(
            (total, row) => total + Number(row[key] || 0), 0
        )

        const currencyAllocations = allocations.filter(r =>
            cashDays.some(d => d.id === r.cash_day_id && d.currency_code === currencyCode)
        )

        const currencyWithdrawals = withdrawals.filter(r =>
            r.cash_management_days?.currency_code === currencyCode
        )

        const safeDeposits = currencyAllocations
            .filter(r => r.category === 'safe_deposit')
            .reduce((total, r) => total + Number(r.amount || 0), 0)

        const safeWithdrawals = currencyWithdrawals.reduce(
            (total, r) => total + Number(r.amount || 0), 0
        )

        return {
            cashSales: sum('cashSales'),
            digitalSales: sum('mobileMoney') + sum('bankCard') + sum('otherSales'),
            purchases: sum('cashPurchases'),
            expenses: sum('cashExpenses'),
            expected: filteredRows[0]?.expectedClosing || 0,
            safeBalance: safeDeposits - safeWithdrawals,
            open: filteredRows.filter(r => r.closingStatus === 'Open').length,
            closed: filteredRows.filter(r => r.closingStatus === 'Closed').length,
            reconciled: filteredRows.filter(r => r.closingStatus === 'Reconciled').length,
            shortage: filteredRows.filter(r => r.closingStatus === 'Shortage').length,
            surplus: filteredRows.filter(r => r.closingStatus === 'Surplus').length
        }
    }, [filteredRows, allocations, withdrawals, cashDays, currencyCode])

    const updateCashForm = (field, value) => {
        setCashForm(previous => ({ ...previous, [field]: value }))
    }

    const openNewCashForm = () => {
        setEditingId(null)
        setCashForm(emptyCashForm())
        setError('')
        setMessage('')
        setShowCashForm(true)
    }

    const openEditForm = row => {
        if (!row.position) {
            setError('Record the opening cash details before editing this day.')
            return
        }

        if (row.position.closed_at) {
            setError('This day is closed. Reopen it before editing.')
            return
        }

        setEditingId(row.position.id)
        setCashForm({
            cash_date: row.date,
            opening_cash: String(row.openingCash),
            opening_purchase_reserve: String(row.openingPurchaseReserve),
            counted_cash: row.countedCash == null ? '' : String(row.countedCash),
            notes: row.position.notes || ''
        })
        setError('')
        setMessage('')
        setShowCashForm(true)
    }

    const saveCashDay = async event => {
        event.preventDefault()
        setError('')
        setMessage('')

        const openingValues = [
            cashForm.opening_cash,
            cashForm.opening_purchase_reserve
        ]

        if (openingValues.some(v =>
            v.trim() === '' || !Number.isFinite(Number(v)) || Number(v) < 0
        )) {
            setError('Opening balances must be valid non-negative amounts.')
            return
        }

        if (cashForm.counted_cash.trim() !== '' &&
            (!Number.isFinite(Number(cashForm.counted_cash)) ||
                Number(cashForm.counted_cash) < 0)) {
            setError('Counted cash must be a valid non-negative amount.')
            return
        }

        setSaving(true)

        try {
            const payload = {
                cash_date: cashForm.cash_date,
                currency_code: currencyCode,
                opening_cash: Number(cashForm.opening_cash),
                opening_purchase_reserve: Number(cashForm.opening_purchase_reserve),
                counted_cash: cashForm.counted_cash.trim() === ''
                    ? null
                    : Number(cashForm.counted_cash),
                notes: cashForm.notes.trim() || null,
                updated_at: new Date().toISOString()
            }

            // Avoid relying on an unconfirmed unique constraint for upsert.
            const { data: existing, error: findError } = await supabase
                .from('cash_management_days')
                .select('id,closed_at')
                .eq('cash_date', cashForm.cash_date)
                .eq('currency_code', currencyCode)
                .maybeSingle()

            if (findError) throw findError

            if (existing?.closed_at) {
                throw new Error('This cash day is closed. Reopen it before editing.')
            }

            const result = existing
                ? await supabase.from('cash_management_days')
                    .update(payload).eq('id', existing.id)
                : await supabase.from('cash_management_days')
                    .insert(payload)

            if (result.error) throw result.error

            setShowCashForm(false)
            setEditingId(null)
            setCashForm(emptyCashForm())
            setMessage('Cash record saved successfully.')
            await loadData()
        } catch (err) {
            setError(err.message || 'Could not save cash record.')
        } finally {
            setSaving(false)
        }
    }

    const openAllocationForm = row => {
        if (!row.position) {
            setError('Save the daily cash record before allocating cash.')
            return
        }

        if (row.countedCash === null) {
            setError('Enter the actual counted cash before allocating it.')
            return
        }

        if (row.position.closed_at) {
            setError('This day is closed. Reopen it before changing allocations.')
            return
        }

        const existing = row.dayAllocations
        const getAmount = category => existing
            .filter(r => r.category === category)
            .reduce((sum, r) => sum + Number(r.amount || 0), 0)

        setAllocationForm({
            cash_date: row.date,
            bank_transfer: String(getAmount('bank_transfer')),
            till_float: String(getAmount('till_float')),
            purchase_reserve: String(getAmount('purchase_reserve')),
            safe_deposit: String(getAmount('safe_deposit')),
            notes: existing[0]?.notes || ''
        })
        setError('')
        setMessage('')
        setShowAllocationForm(true)
    }

    const saveAllocation = async event => {
        event.preventDefault()
        setError('')
        setMessage('')

        const values = allocationCategories.map(item =>
            Number(allocationForm[item.key])
        )

        if (values.some(v => !Number.isFinite(v) || v < 0)) {
            setError('Enter valid non-negative allocation amounts.')
            return
        }

        const position = cashDays.find(r =>
            r.cash_date === allocationForm.cash_date &&
            r.currency_code === currencyCode
        )

        if (!position) {
            setError('Daily cash record not found.')
            return
        }

        if (position.closed_at) {
            setError('This cash day is closed. Reopen it before editing allocations.')
            return
        }

        if (position.counted_cash == null) {
            setError('Enter counted cash before allocating it.')
            return
        }

        const allocatedTotal = values.reduce((sum, v) => sum + v, 0)

        if (Math.abs(allocatedTotal - Number(position.counted_cash)) > 0.01) {
            setError(
                `Allocation total (${fmt(allocatedTotal)}) must equal counted cash (${fmt(position.counted_cash)}).`
            )
            return
        }

        setSaving(true)

        try {
            const { error: deleteError } = await supabase
                .from('cash_allocations')
                .delete()
                .eq('cash_day_id', position.id)

            if (deleteError) throw deleteError

            const records = allocationCategories
                .map(item => ({
                    cash_day_id: position.id,
                    category: item.key,
                    amount: Number(allocationForm[item.key]),
                    notes: allocationForm.notes.trim() || null
                }))
                .filter(item => item.amount > 0)

            if (records.length) {
                const { error: insertError } = await supabase
                    .from('cash_allocations')
                    .insert(records)

                if (insertError) throw insertError
            }

            setShowAllocationForm(false)
            setMessage('Closing cash allocation saved successfully.')
            await loadData()
        } catch (err) {
            setError(err.message || 'Could not save allocation.')
        } finally {
            setSaving(false)
        }
    }

    const openWithdrawalForm = () => {
        setWithdrawalForm(emptyWithdrawalForm())
        setError('')
        setMessage('')
        setShowWithdrawalForm(true)
    }

    const saveWithdrawal = async event => {
        event.preventDefault()
        setError('')
        setMessage('')

        const amount = Number(withdrawalForm.amount)

        if (!withdrawalForm.purpose.trim()) {
            setError('Please provide the reason for this withdrawal.')
            return
        }

        if (!Number.isFinite(amount) || amount <= 0) {
            setError('Withdrawal amount must be greater than zero.')
            return
        }

        const position = cashDays.find(r =>
            r.cash_date === withdrawalForm.withdrawal_date &&
            r.currency_code === currencyCode
        )

        if (!position) {
            setError('Create the cash-day record for this date and currency first.')
            return
        }

        if (position.closed_at) {
            setError('This day is closed. Reopen it before recording a withdrawal.')
            return
        }

        const safeDeposits = allocations
            .filter(r => r.category === 'safe_deposit' &&
                cashDays.some(d =>
                    d.id === r.cash_day_id &&
                    d.currency_code === currencyCode &&
                    d.cash_date <= withdrawalForm.withdrawal_date
                ))
            .reduce((sum, r) => sum + Number(r.amount || 0), 0)

        const previousWithdrawals = withdrawals
            .filter(r =>
                r.cash_management_days?.currency_code === currencyCode &&
                r.cash_management_days?.cash_date <= withdrawalForm.withdrawal_date
            )
            .reduce((sum, r) => sum + Number(r.amount || 0), 0)

        const available = safeDeposits - previousWithdrawals

        if (amount > available + 0.01) {
            setError(`Insufficient safe balance. Available: ${fmt(Math.max(0, available))}.`)
            return
        }

        setSaving(true)

        try {
            const { error: saveError } = await supabase
                .from('safe_withdrawals')
                .insert({
                    cash_day_id: position.id,
                    amount,
                    purpose: withdrawalForm.purpose.trim(),
                    notes: withdrawalForm.notes.trim() || null
                })

            if (saveError) throw saveError

            setShowWithdrawalForm(false)
            setMessage('Safe withdrawal recorded successfully.')
            await loadData()
        } catch (err) {
            setError(err.message || 'Could not record withdrawal.')
        } finally {
            setSaving(false)
        }
    }

    const handleClosingAction = async (row, action) => {
        if (!row.position) {
            setError('Save the cash-day record before closing it.')
            return
        }

        if (action === 'close' && row.countedCash === null) {
            setError('Enter the actual counted cash before closing the day.')
            return
        }

        if (action === 'close' && row.position.closed_at) {
            setError('This day is already closed.')
            return
        }

        if (action === 'reopen' && !row.position.closed_at) {
            setError('This day is not currently closed.')
            return
        }

        setError('')
        setMessage('')
        setSaving(true)

        try {
            const functionName = action === 'close'
                ? 'owner_close_cash_day'
                : 'owner_reopen_cash_day'

            const { error: actionError } = await supabase.rpc(functionName, {
                p_cash_day_id: row.position.id
            })

            if (actionError) throw actionError

            setMessage(action === 'close'
                ? 'Cash day closed successfully.'
                : 'Cash day reopened successfully.')

            await loadData()
        } catch (err) {
            setError(err.message || 'Could not update cash-day status.')
        } finally {
            setSaving(false)
        }
    }

    const clearFilters = () => {
        setSearch('')
        setStartDate('')
        setEndDate('')
        setStatusFilter('all')
    }

    const allocationTotal = allocationCategories.reduce(
        (sum, item) => sum + Number(allocationForm[item.key] || 0), 0
    )

    const renderMessage = text => text && (
        <div style={{
            ...styles.message,
            background: '#fff0f0',
            color: '#b42318'
        }}>
            {text}
        </div>
    )

    return (
        <div style={styles.page}>
            <style>{`
                @media print {
                    @page { size: A4 portrait; margin: 12mm; }
                    body * { visibility: hidden !important; }
                    .cash-report-print,
                    .cash-report-print * { visibility: visible !important; }
                    .cash-report-print {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 15px !important;
                        background: white !important;
                        color: #162b42 !important;
                        box-shadow: none !important;
                        max-height: none !important;
                        overflow: visible !important;
                    }
                    .cash-report-no-print { display: none !important; }
                }
            `}</style>

            <div style={styles.header}>
                <div>
                    <h1 style={styles.title}>Cash Management</h1>
                    <div style={styles.subtitle}>
                        Daily cash reconciliation, allocations and safe management.
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                    <button style={styles.secondary} onClick={loadData}>
                        <RefreshCw size={15} /> Refresh
                    </button>
                    <button style={styles.secondary} onClick={openWithdrawalForm}>
                        <ArrowDownToLine size={15} /> Safe Withdrawal
                    </button>
                    <button style={styles.button} onClick={openNewCashForm}>
                        <Plus size={16} /> Record Daily Cash
                    </button>
                </div>
            </div>

            <div style={{ ...styles.filters, alignItems: 'center' }}>
                <div style={{ ...styles.field, minWidth: 150 }}>
                    <label style={styles.label}>Currency</label>
                    <select
                        style={styles.input}
                        value={currencyCode}
                        onChange={event => {
                            setCurrencyCode(event.target.value)
                            setError('')
                            setMessage('')
                        }}
                    >
                        {CURRENCIES.map(currency => (
                            <option key={currency} value={currency}>{currency}</option>
                        ))}
                    </select>
                </div>
                <div style={{ fontSize: 12, color: '#718096' }}>
                    All figures below are shown in {currencyCode} only.
                </div>
            </div>

            {message && (
                <div style={{
                    ...styles.message,
                    background: '#e9f8ef',
                    color: '#176b45'
                }}>
                    {message}
                </div>
            )}

            {error && !showCashForm && !showAllocationForm && !showWithdrawalForm &&
                renderMessage(error)}

            <div style={styles.cards}>
                {[
                    [<Banknote size={15} />, 'Cash Sales', totals.cashSales],
                    [<Wallet size={15} />, 'Digital Sales', totals.digitalSales],
                    [<TrendingDown size={15} />, 'Cash Purchases', totals.purchases],
                    [<TrendingDown size={15} />, 'Cash Expenses', totals.expenses],
                    [<TrendingUp size={15} />, 'Latest Expected Closing', totals.expected],
                    [<LockKeyhole size={15} />, 'Safe Balance', totals.safeBalance]
                ].map(([icon, label, value]) => (
                    <div style={styles.card} key={label}>
                        <div style={styles.cardLabel}>{icon} {label}</div>
                        <div style={styles.cardValue}>{fmt(value)}</div>
                    </div>
                ))}
            </div>

            <div style={styles.cards}>
                {[
                    ['Open Closings', totals.open, '#9a6700'],
                    ['Closed Days', totals.closed, '#14532d'],
                    ['Reconciled', totals.reconciled, '#176b45'],
                    ['Cash Shortages', totals.shortage, '#b42318'],
                    ['Cash Surpluses', totals.surplus, '#1d4ed8']
                ].map(([label, value, color]) => (
                    <div style={styles.card} key={label}>
                        <div style={styles.cardLabel}>{label}</div>
                        <div style={{ ...styles.cardValue, color }}>{value}</div>
                    </div>
                ))}
            </div>

            <div style={styles.filters}>
                <div style={{ ...styles.field, flex: '2 1 210px' }}>
                    <label style={styles.label}>Search records</label>
                    <div style={{ position: 'relative' }}>
                        <Search size={16} style={{
                            position: 'absolute', left: 11, top: 11, color: '#8795a5'
                        }} />
                        <input
                            style={{ ...styles.input, paddingLeft: 35 }}
                            placeholder="Search date or notes..."
                            value={search}
                            onChange={event => setSearch(event.target.value)}
                        />
                    </div>
                </div>

                <div style={{ ...styles.field, flex: '1 1 145px' }}>
                    <label style={styles.label}>From date</label>
                    <input type="date" style={styles.input} value={startDate}
                        onChange={event => setStartDate(event.target.value)} />
                </div>

                <div style={{ ...styles.field, flex: '1 1 145px' }}>
                    <label style={styles.label}>To date</label>
                    <input type="date" style={styles.input} value={endDate}
                        onChange={event => setEndDate(event.target.value)} />
                </div>

                <div style={{ ...styles.field, flex: '1 1 160px' }}>
                    <label style={styles.label}>Cash status</label>
                    <select style={styles.input} value={statusFilter}
                        onChange={event => setStatusFilter(event.target.value)}>
                        <option value="all">All records</option>
                        <option value="open">Open</option>
                        <option value="reconciled">Reconciled</option>
                        <option value="shortage">Cash shortage</option>
                        <option value="surplus">Cash surplus</option>
                        <option value="closed">Closed</option>
                    </select>
                </div>

                <button style={styles.secondary} onClick={clearFilters}>
                    <X size={14} /> Clear Filters
                </button>
            </div>

            <div style={{ color: '#718096', fontSize: 12, marginBottom: 10 }}>
                Showing {filteredRows.length} of {dailyRows.length} {currencyCode} daily records
            </div>

            <div style={styles.tableWrap}>
                <table style={styles.table}>
                    <thead>
                        <tr>
                            {[
                                'Date', 'Opening Till Float', 'Purchase Reserve',
                                'Cash Sales', 'Mobile Money', 'Bank/Card', 'Other Sales',
                                'Cash Purchases', 'Cash Expenses', 'Expected Closing',
                                'Counted Cash', 'Difference', 'Closing Status',
                                'Allocation', 'Actions'
                            ].map(label => <th style={styles.th} key={label}>{label}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td style={styles.td} colSpan="15">Loading cash records...</td></tr>
                        ) : filteredRows.length === 0 ? (
                            <tr><td style={{ ...styles.td, textAlign: 'center' }} colSpan="15">
                                No cash records found for {currencyCode}.
                            </td></tr>
                        ) : filteredRows.map(row => (
                            <tr key={`${row.date}-${currencyCode}`}>
                                <td style={styles.td}>{row.date}</td>
                                <td style={styles.td}>{fmt(row.openingCash)}</td>
                                <td style={styles.td}>{fmt(row.openingPurchaseReserve)}</td>
                                <td style={styles.td}>{fmt(row.cashSales)}</td>
                                <td style={styles.td}>{fmt(row.mobileMoney)}</td>
                                <td style={styles.td}>{fmt(row.bankCard)}</td>
                                <td style={styles.td}>{fmt(row.otherSales)}</td>
                                <td style={styles.td}>{fmt(row.cashPurchases)}</td>
                                <td style={styles.td}>{fmt(row.cashExpenses)}</td>
                                <td style={{ ...styles.td, fontWeight: 800 }}>
                                    {fmt(row.expectedClosing)}
                                </td>
                                <td style={styles.td}>
                                    {row.countedCash === null ? 'Not counted' : fmt(row.countedCash)}
                                </td>
                                <td style={{
                                    ...styles.td,
                                    fontWeight: 700,
                                    color: row.difference === null ? '#718096'
                                        : row.difference < -0.01 ? '#b42318'
                                            : row.difference > 0.01 ? '#176b45' : '#536579'
                                }}>
                                    {row.difference === null ? '—' : fmt(row.difference)}
                                </td>
                                <td style={styles.td}>{row.closingStatus}</td>
                                <td style={styles.td}>{row.allocationStatus}</td>
                                <td style={styles.td}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <button type="button" style={styles.secondary}
                                            onClick={() => setReportRow(row)}>
                                            <FileText size={14} /> Report
                                        </button>

                                        {row.position?.closed_at ? (
                                            <button type="button" style={styles.secondary}
                                                disabled={saving}
                                                onClick={() => handleClosingAction(row, 'reopen')}>
                                                Reopen Day
                                            </button>
                                        ) : (
                                            <>
                                                <button type="button" style={styles.secondary}
                                                    onClick={() => openEditForm(row)}>
                                                    <Pencil size={14} /> Edit
                                                </button>
                                                <button type="button" style={styles.secondary}
                                                    onClick={() => openAllocationForm(row)}>
                                                    <Landmark size={14} /> Allocate
                                                </button>
                                                <button type="button" style={styles.button}
                                                    disabled={saving}
                                                    onClick={() => handleClosingAction(row, 'close')}>
                                                    Close Day
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <section style={{ marginTop: 24 }}>
                <h2 style={{ fontSize: 18, marginBottom: 12 }}>
                    Safe Withdrawal History ({currencyCode})
                </h2>
                <div style={styles.tableWrap}>
                    <table style={{ ...styles.table, minWidth: 750 }}>
                        <thead>
                            <tr>
                                <th style={styles.th}>Date</th>
                                <th style={styles.th}>Amount</th>
                                <th style={styles.th}>Purpose</th>
                                <th style={styles.th}>Notes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {withdrawals.filter(r =>
                                r.cash_management_days?.currency_code === currencyCode
                            ).length === 0 ? (
                                <tr><td style={styles.td} colSpan="4">
                                    No safe withdrawals recorded.
                                </td></tr>
                            ) : withdrawals.filter(r =>
                                r.cash_management_days?.currency_code === currencyCode
                            ).map(row => (
                                <tr key={row.id}>
                                    <td style={styles.td}>{row.cash_management_days?.cash_date}</td>
                                    <td style={styles.td}>{fmt(row.amount)}</td>
                                    <td style={styles.td}>{row.purpose}</td>
                                    <td style={styles.td}>{row.notes || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <section style={{ marginTop: 24 }}>
                <h2 style={{ fontSize: 18, marginBottom: 12 }}>
                    Closing Cash Allocation History ({currencyCode})
                </h2>
                <div style={styles.tableWrap}>
                    <table style={{ ...styles.table, minWidth: 850 }}>
                        <thead>
                            <tr>
                                <th style={styles.th}>Date</th>
                                <th style={styles.th}>Category</th>
                                <th style={styles.th}>Amount</th>
                                <th style={styles.th}>Notes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {allocations.filter(r =>
                                cashDays.some(d =>
                                    d.id === r.cash_day_id && d.currency_code === currencyCode
                                )
                            ).length === 0 ? (
                                <tr><td style={styles.td} colSpan="4">No allocations recorded.</td></tr>
                            ) : allocations.filter(r =>
                                cashDays.some(d =>
                                    d.id === r.cash_day_id && d.currency_code === currencyCode
                                )
                            ).map(row => {
                                const day = cashDays.find(d => d.id === row.cash_day_id)
                                const category = allocationCategories.find(c => c.key === row.category)
                                return (
                                    <tr key={row.id}>
                                        <td style={styles.td}>{day?.cash_date}</td>
                                        <td style={styles.td}>{category?.label || row.category}</td>
                                        <td style={styles.td}>{fmt(row.amount)}</td>
                                        <td style={styles.td}>{row.notes || '—'}</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </section>

            {showCashForm && (
                <div style={styles.modal}>
                    <div style={styles.modalBox}>
                        <div style={{
                            display: 'flex', justifyContent: 'space-between',
                            alignItems: 'center', marginBottom: 18
                        }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: 20 }}>
                                    {editingId ? 'Edit Daily Cash Record' : 'Record Daily Cash'}
                                </h2>
                                <p style={{ margin: '5px 0 0', color: '#718096', fontSize: 12 }}>
                                    Currency: {currencyCode}. Sales, purchases and expenses are automatic.
                                </p>
                            </div>
                            <button type="button" style={styles.secondary}
                                onClick={() => setShowCashForm(false)}>
                                <X size={17} />
                            </button>
                        </div>

                        {renderMessage(error)}

                        <form onSubmit={saveCashDay}>
                            <div style={styles.formGrid}>
                                <div style={styles.field}>
                                    <label style={styles.label}>Business date *</label>
                                    <input type="date" required style={styles.input}
                                        value={cashForm.cash_date}
                                        onChange={e => updateCashForm('cash_date', e.target.value)}
                                        disabled={Boolean(editingId)} />
                                </div>

                                <div style={styles.field}>
                                    <label style={styles.label}>Opening till float ({currencyCode}) *</label>
                                    <input type="number" min="0" step="0.01" required
                                        style={styles.input} value={cashForm.opening_cash}
                                        onChange={e => updateCashForm('opening_cash', e.target.value)} />
                                </div>

                                <div style={styles.field}>
                                    <label style={styles.label}>Opening purchase reserve ({currencyCode}) *</label>
                                    <input type="number" min="0" step="0.01" required
                                        style={styles.input} value={cashForm.opening_purchase_reserve}
                                        onChange={e => updateCashForm('opening_purchase_reserve', e.target.value)} />
                                </div>

                                <div style={styles.field}>
                                    <label style={styles.label}>Actual counted closing cash ({currencyCode})</label>
                                    <input type="number" min="0" step="0.01"
                                        style={styles.input} placeholder="Leave blank if not counted"
                                        value={cashForm.counted_cash}
                                        onChange={e => updateCashForm('counted_cash', e.target.value)} />
                                </div>

                                <div style={{ ...styles.field, gridColumn: '1 / -1' }}>
                                    <label style={styles.label}>Notes</label>
                                    <textarea style={{ ...styles.input, minHeight: 75, resize: 'vertical' }}
                                        value={cashForm.notes}
                                        onChange={e => updateCashForm('notes', e.target.value)} />
                                </div>
                            </div>

                            <div style={{ background: '#f1f7f3', padding: 14, borderRadius: 9, marginTop: 17 }}>
                                <strong>Cash calculation</strong>
                                <p style={{ fontSize: 13, marginBottom: 5 }}>
                                    Expected closing = Opening till float + Opening purchase reserve
                                    + Cash sales − Cash purchases − Cash expenses.
                                </p>
                                <div style={{ fontSize: 11, color: '#718096' }}>
                                    POS sales and operational records are used automatically.
                                    Digital payments are excluded from physical cash.
                                </div>
                            </div>

                            <div style={{
                                display: 'flex', justifyContent: 'flex-end',
                                gap: 9, marginTop: 20
                            }}>
                                <button type="button" style={styles.secondary}
                                    onClick={() => setShowCashForm(false)}>Cancel</button>
                                <button type="submit" style={styles.button} disabled={saving}>
                                    <Save size={15} /> {saving ? 'Saving...' : 'Save Cash Record'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showAllocationForm && (
                <div style={styles.modal}>
                    <div style={styles.modalBox}>
                        <div style={{
                            display: 'flex', justifyContent: 'space-between',
                            alignItems: 'center', marginBottom: 18
                        }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: 20 }}>Allocate Closing Cash</h2>
                                <p style={{ margin: '5px 0 0', color: '#718096', fontSize: 12 }}>
                                    Currency: {currencyCode}
                                </p>
                            </div>
                            <button type="button" style={styles.secondary}
                                onClick={() => setShowAllocationForm(false)}>
                                <X size={17} />
                            </button>
                        </div>

                        {renderMessage(error)}

                        <form onSubmit={saveAllocation}>
                            <div style={styles.formGrid}>
                                <div style={styles.field}>
                                    <label style={styles.label}>Allocation date</label>
                                    <input type="date" style={styles.input}
                                        value={allocationForm.cash_date} disabled />
                                </div>

                                {allocationCategories.map(item => (
                                    <div style={styles.field} key={item.key}>
                                        <label style={styles.label}>{item.label} ({currencyCode})</label>
                                        <input type="number" min="0" step="0.01" required
                                            style={styles.input}
                                            value={allocationForm[item.key]}
                                            onChange={e => setAllocationForm(prev => ({
                                                ...prev, [item.key]: e.target.value
                                            }))} />
                                    </div>
                                ))}

                                <div style={{ ...styles.field, gridColumn: '1 / -1' }}>
                                    <label style={styles.label}>Notes</label>
                                    <textarea style={{ ...styles.input, minHeight: 70 }}
                                        value={allocationForm.notes}
                                        onChange={e => setAllocationForm(prev => ({
                                            ...prev, notes: e.target.value
                                        }))} />
                                </div>
                            </div>

                            <div style={{ background: '#f1f7f3', padding: 14, borderRadius: 9, marginTop: 17 }}>
                                <strong>Allocation total: {fmt(allocationTotal)}</strong>
                                <div style={{ fontSize: 12, color: '#718096', marginTop: 5 }}>
                                    All four categories must equal the actual counted closing cash.
                                </div>
                            </div>

                            <div style={{
                                display: 'flex', justifyContent: 'flex-end',
                                gap: 9, marginTop: 20
                            }}>
                                <button type="button" style={styles.secondary}
                                    onClick={() => setShowAllocationForm(false)}>Cancel</button>
                                <button type="submit" style={styles.button} disabled={saving}>
                                    <Save size={15} /> {saving ? 'Saving...' : 'Save Allocation'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showWithdrawalForm && (
                <div style={styles.modal}>
                    <div style={styles.modalBox}>
                        <div style={{
                            display: 'flex', justifyContent: 'space-between',
                            alignItems: 'center', marginBottom: 18
                        }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: 20 }}>Record Safe Withdrawal</h2>
                                <p style={{ margin: '5px 0 0', color: '#718096', fontSize: 12 }}>
                                    Currency: {currencyCode}
                                </p>
                            </div>
                            <button type="button" style={styles.secondary}
                                onClick={() => setShowWithdrawalForm(false)}>
                                <X size={17} />
                            </button>
                        </div>

                        {renderMessage(error)}

                        <form onSubmit={saveWithdrawal}>
                            <div style={styles.formGrid}>
                                <div style={styles.field}>
                                    <label style={styles.label}>Withdrawal date *</label>
                                    <input type="date" required style={styles.input}
                                        value={withdrawalForm.withdrawal_date}
                                        onChange={e => setWithdrawalForm(prev => ({
                                            ...prev, withdrawal_date: e.target.value
                                        }))} />
                                </div>

                                <div style={styles.field}>
                                    <label style={styles.label}>Amount ({currencyCode}) *</label>
                                    <input type="number" min="0.01" step="0.01" required
                                        style={styles.input} value={withdrawalForm.amount}
                                        onChange={e => setWithdrawalForm(prev => ({
                                            ...prev, amount: e.target.value
                                        }))} />
                                </div>

                                <div style={{ ...styles.field, gridColumn: '1 / -1' }}>
                                    <label style={styles.label}>Purpose *</label>
                                    <input type="text" required style={styles.input}
                                        value={withdrawalForm.purpose}
                                        onChange={e => setWithdrawalForm(prev => ({
                                            ...prev, purpose: e.target.value
                                        }))} />
                                </div>

                                <div style={{ ...styles.field, gridColumn: '1 / -1' }}>
                                    <label style={styles.label}>Additional notes</label>
                                    <textarea style={{ ...styles.input, minHeight: 70 }}
                                        value={withdrawalForm.notes}
                                        onChange={e => setWithdrawalForm(prev => ({
                                            ...prev, notes: e.target.value
                                        }))} />
                                </div>
                            </div>

                            <div style={{
                                display: 'flex', justifyContent: 'flex-end',
                                gap: 9, marginTop: 20
                            }}>
                                <button type="button" style={styles.secondary}
                                    onClick={() => setShowWithdrawalForm(false)}>Cancel</button>
                                <button type="submit" style={styles.button} disabled={saving}>
                                    <Save size={15} /> {saving ? 'Saving...' : 'Save Withdrawal'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {reportRow && (
                <div style={styles.modal}>
                    <div className="cash-report-print"
                        style={{ ...styles.modalBox, maxWidth: 800 }}>
                        <div className="cash-report-no-print" style={{
                            display: 'flex', justifyContent: 'flex-end',
                            gap: 9, marginBottom: 18
                        }}>
                            <button type="button" style={styles.button}
                                onClick={() => window.print()}>
                                <Printer size={15} /> Print / Save PDF
                            </button>
                            <button type="button" style={styles.secondary}
                                onClick={() => setReportRow(null)}>
                                <X size={15} /> Close
                            </button>
                        </div>

                        <div style={{
                            borderBottom: '2px solid #176b45',
                            paddingBottom: 16, marginBottom: 20
                        }}>
                            <h1 style={{ margin: 0, fontSize: 27, color: '#176b45' }}>
                                Mbare Chitekete
                            </h1>
                            <h2 style={{ margin: '8px 0 4px', fontSize: 20 }}>
                                Daily Cash Closing Report
                            </h2>
                            <div style={{ color: '#64748b', fontSize: 13 }}>
                                Business date: {reportRow.date} | Currency: {currencyCode}
                            </div>
                        </div>

                        <h3>1. Daily Sales</h3>
                        <table style={{ ...styles.table, minWidth: 0 }}>
                            <tbody>
                                {[
                                    ['Cash sales', reportRow.cashSales],
                                    ['Mobile money sales', reportRow.mobileMoney],
                                    ['Bank/card sales', reportRow.bankCard],
                                    ['Other sales', reportRow.otherSales],
                                    ['Total sales', reportRow.totalSales]
                                ].map(([label, amount]) => (
                                    <tr key={label}>
                                        <td style={styles.td}>{label}</td>
                                        <td style={{ ...styles.td, textAlign: 'right', fontWeight: 700 }}>
                                            {fmt(amount)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <h3 style={{ marginTop: 22 }}>2. Physical Cash Reconciliation</h3>
                        <table style={{ ...styles.table, minWidth: 0 }}>
                            <tbody>
                                {[
                                    ['Opening till float', reportRow.openingCash],
                                    ['Opening purchase reserve', reportRow.openingPurchaseReserve],
                                    ['Cash sales', reportRow.cashSales],
                                    ['Cash purchases', -reportRow.cashPurchases],
                                    ['Cash expenses', -reportRow.cashExpenses],
                                    ['Expected closing cash', reportRow.expectedClosing],
                                    ['Actual counted cash', reportRow.countedCash],
                                    ['Cash difference', reportRow.difference]
                                ].map(([label, amount]) => (
                                    <tr key={label}>
                                        <td style={styles.td}>{label}</td>
                                        <td style={{ ...styles.td, textAlign: 'right', fontWeight: 700 }}>
                                            {amount === null ? 'Not counted' : fmt(amount)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <h3 style={{ marginTop: 22 }}>3. Closing Cash Allocation</h3>
                        <table style={{ ...styles.table, minWidth: 0 }}>
                            <tbody>
                                {[
                                    ['Bank transfer', reportRow.bankTransfer],
                                    ["Tomorrow's till float", reportRow.tillFloat],
                                    ["Tomorrow's purchase reserve", reportRow.purchaseReserve],
                                    ['Safe deposit', reportRow.safeDeposit],
                                    ['Total allocated', reportRow.allocationTotal]
                                ].map(([label, amount]) => (
                                    <tr key={label}>
                                        <td style={styles.td}>{label}</td>
                                        <td style={{ ...styles.td, textAlign: 'right', fontWeight: 700 }}>
                                            {fmt(amount)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <h3 style={{ marginTop: 22 }}>4. Closing Status</h3>
                        <p><strong>Closing status:</strong> {reportRow.closingStatus}</p>
                        <p><strong>Allocation status:</strong> {reportRow.allocationStatus}</p>
                        <p>
                            <strong>Closed at:</strong>{' '}
                            {reportRow.position?.closed_at
                                ? new Date(reportRow.position.closed_at).toLocaleString('en-GB')
                                : 'Not formally closed'}
                        </p>

                        <h3 style={{ marginTop: 22 }}>5. Notes</h3>
                        <p style={{ whiteSpace: 'pre-wrap', color: '#536579' }}>
                            {reportRow.position?.notes || 'No notes recorded.'}
                        </p>

                        <div style={{
                            borderTop: '1px solid #dce4ec', paddingTop: 14,
                            marginTop: 25, fontSize: 11, color: '#718096',
                            textAlign: 'center'
                        }}>
                            Mbare Chitekete — Daily Cash Closing Report
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
