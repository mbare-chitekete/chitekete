
import { useEffect, useMemo, useState } from 'react'
import {
    PiggyBank,
    Plus,
    RefreshCw,
    ArrowDownCircle,
    ArrowUpCircle,
    X,
    Save,
    Wallet
} from 'lucide-react'
import { supabase } from './supabase'
import { useCurrency } from './CurrencyContext'

const today = () => {
    const date = new Date()
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const emptyForm = {
    transaction_date: today(),
    transaction_type: 'deposit',
    amount: '',
    reason: '',
    notes: ''
}

const styles = {
    page: { padding: 24, color: '#162b42' },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        marginBottom: 22
    },
    title: { margin: 0, fontSize: 25, fontWeight: 800 },
    subtitle: { color: '#718096', marginTop: 5, fontSize: 13 },
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
        gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))',
        gap: 14,
        marginBottom: 20
    },
    card: {
        background: 'white',
        border: '1px solid #e6ebf1',
        borderRadius: 13,
        padding: 19
    },
    cardLabel: { color: '#718096', fontSize: 12, fontWeight: 600 },
    cardValue: { fontSize: 25, fontWeight: 800, marginTop: 9 },
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
    field: { display: 'flex', flexDirection: 'column', gap: 6 },
    label: { fontSize: 12, fontWeight: 700, color: '#536579' },
    tableWrap: {
        overflowX: 'auto',
        background: 'white',
        border: '1px solid #e6ebf1',
        borderRadius: 12
    },
    table: { width: '100%', borderCollapse: 'collapse', minWidth: 750 },
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
    modal: {
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,30,45,.55)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
        zIndex: 1000
    },
    modalBox: {
        background: 'white',
        borderRadius: 15,
        padding: 22,
        width: '100%',
        maxWidth: 520,
        maxHeight: '90vh',
        overflowY: 'auto'
    },
    message: {
        padding: 12,
        borderRadius: 8,
        marginBottom: 14,
        fontSize: 13
    }
}

export default function BusinessSavings() {
    const { formatCurrency, currencyCode } = useCurrency()

    const CURRENCY_SYMBOLS = {
        USD: '$',
        ZAR: 'R',
        ZWG: 'ZiG'
    }

    const formatTransactionCurrency = (amount, code = 'USD') => {
        const symbol = CURRENCY_SYMBOLS[code] || code

        return `${symbol}${new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(Number(amount) || 0)}`
    }

    const [transactions, setTransactions] = useState([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [showForm, setShowForm] = useState(false)
    const [form, setForm] = useState(emptyForm)
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')

    const loadTransactions = async () => {
        setLoading(true)
        setError('')

        try {
            const { data, error } = await supabase
                .from('business_savings')
                .select('*')
                .order('transaction_date', { ascending: false })
                .order('created_at', { ascending: false })

            if (error) throw error

            setTransactions(data || [])
        } catch (err) {
            setError(err.message || 'Could not load savings records.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadTransactions()
    }, [])

    const currentCurrencyTransactions = useMemo(
        () => transactions.filter(
            item => item.currency_code === currencyCode
        ),
        [transactions, currencyCode]
    )

    const balance = useMemo(() => {
        return currentCurrencyTransactions.reduce((total, item) => {
            const amount = Number(item.amount || 0)

            return item.transaction_type === 'deposit'
                ? total + amount
                : total - amount
        }, 0)
    }, [currentCurrencyTransactions])

    const totalDeposits = useMemo(
        () => currentCurrencyTransactions
            .filter(item => item.transaction_type === 'deposit')
            .reduce((sum, item) => sum + Number(item.amount || 0), 0),
        [currentCurrencyTransactions]
    )

    const totalWithdrawals = useMemo(
        () => currentCurrencyTransactions
            .filter(item => item.transaction_type === 'withdrawal')
            .reduce((sum, item) => sum + Number(item.amount || 0), 0),
        [currentCurrencyTransactions]
    )

    const filteredTransactions = useMemo(() => {
        return transactions.filter(item => {
            const matchesStart = !startDate || item.transaction_date >= startDate
            const matchesEnd = !endDate || item.transaction_date <= endDate

            return matchesStart && matchesEnd
        })
    }, [transactions, startDate, endDate])

    const openForm = (type = 'deposit') => {
        setForm({
            ...emptyForm,
            transaction_date: today(),
            transaction_type: type
        })
        setMessage('')
        setError('')
        setShowForm(true)
    }

    const updateForm = (field, value) => {
        setForm(previous => ({ ...previous, [field]: value }))
    }

    const saveTransaction = async event => {
        event.preventDefault()
        setError('')
        setMessage('')

        const amount = Number(form.amount)

        if (!form.transaction_date || !Number.isFinite(amount) || amount <= 0) {
            setError('Please enter a valid date and amount greater than zero.')
            return
        }

        if (!(form.reason ?? '').trim()) {
            setError('Please enter a reason for this transaction.')
            return
        }

        if (form.transaction_type === 'withdrawal' && amount > balance) {
            setError(`Insufficient savings. Available balance: ${formatCurrency(balance)}.`)
            return
        }

        setSaving(true)

        try {
            const { error } = await supabase
                .from('business_savings')
                .insert({
                    transaction_date: form.transaction_date,
                    transaction_type: form.transaction_type,
                    amount,
                    reason: (form.reason ?? '').trim(),
                    notes: (form.notes ?? '').trim() || null
                })

            if (error) throw error

            setShowForm(false)
            setForm(emptyForm)
            setMessage('Savings transaction recorded successfully.')

            await loadTransactions()
        } catch (err) {
            setError(err.message || 'Could not save the transaction.')
        } finally {
            setSaving(false)
        }
    }


    return (
        <div style={styles.page}>
            <div style={styles.header}>
                <div>
                    <h1 style={styles.title}>Business Savings</h1>
                    <div style={styles.subtitle}>
                        Track money saved by Mbare Chitekete and record withdrawals.
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
                    <button style={styles.secondary} onClick={loadTransactions}>
                        <RefreshCw size={15} /> Refresh
                    </button>

                    <button style={styles.secondary} onClick={() => openForm('withdrawal')}>
                        <ArrowUpCircle size={16} /> Withdraw
                    </button>

                    <button style={styles.button} onClick={() => openForm('deposit')}>
                        <Plus size={16} /> Add Savings
                    </button>
                </div>
            </div>

            {message && (
                <div style={{ ...styles.message, background: '#e9f8ef', color: '#176b45' }}>
                    {message}
                </div>
            )}

            {error && !showForm && (
                <div style={{ ...styles.message, background: '#fff0f0', color: '#b42318' }}>
                    {error}
                </div>
            )}

            <div style={styles.cards}>
                <div style={styles.card}>
                    <div style={styles.cardLabel}>
                        <PiggyBank size={15} /> Current Savings Balance ({currencyCode})
                    </div>
                    <div style={{ ...styles.cardValue, color: balance < 0 ? '#b42318' : '#176b45' }}>
                        {formatCurrency(balance)}
                    </div>
                </div>

                <div style={styles.card}>
                    <div style={styles.cardLabel}>
                        <ArrowDownCircle size={15} /> Total Deposits ({currencyCode})
                    </div>
                    <div style={styles.cardValue}>
                        {formatCurrency(totalDeposits)}
                    </div>
                </div>

                <div style={styles.card}>
                    <div style={styles.cardLabel}>
                        <ArrowUpCircle size={15} /> Total Withdrawals ({currencyCode})
                    </div>
                    <div style={styles.cardValue}>
                        {formatCurrency(totalWithdrawals)}
                    </div>
                </div>
            </div>

            <div style={{
                ...styles.message,
                background: '#eff6ff',
                color: '#315b86'
            }}>
                <Wallet size={16} style={{ verticalAlign: 'middle', marginRight: 7 }} />
                Only money actually put aside should be recorded as savings.
                Savings are tracked separately from sales, purchases and cash allocations.
            </div>

            <div style={{
                display: 'flex',
                gap: 12,
                flexWrap: 'wrap',
                alignItems: 'end',
                marginBottom: 15
            }}>
                <div style={{ ...styles.field, minWidth: 160 }}>
                    <label style={styles.label}>From date</label>
                    <input
                        type="date"
                        style={styles.input}
                        value={startDate}
                        onChange={event => setStartDate(event.target.value)}
                    />
                </div>

                <div style={{ ...styles.field, minWidth: 160 }}>
                    <label style={styles.label}>To date</label>
                    <input
                        type="date"
                        style={styles.input}
                        value={endDate}
                        onChange={event => setEndDate(event.target.value)}
                    />
                </div>

                <button
                    style={styles.secondary}
                    onClick={() => {
                        setStartDate('')
                        setEndDate('')
                    }}
                >
                    <X size={14} /> Clear Filters
                </button>
            </div>

            <div style={{ color: '#718096', fontSize: 12, marginBottom: 10 }}>
                Showing {filteredTransactions.length} of {transactions.length} transactions
            </div>

            <div style={styles.tableWrap}>
                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={styles.th}>Date</th>
                            <th style={styles.th}>Transaction</th>
                            <th style={styles.th}>Amount</th>
                            <th style={styles.th}>Reason</th>
                            <th style={styles.th}>Notes</th>

                        </tr>
                    </thead>

                    <tbody>
                        {loading ? (
                            <tr>
                                <td style={styles.td} colSpan="5">Loading savings records...</td>
                            </tr>
                        ) : filteredTransactions.length === 0 ? (
                            <tr>
                                <td
                                    style={{ ...styles.td, textAlign: 'center', color: '#718096' }}
                                    colSpan="5"
                                >
                                    No savings transactions found.
                                </td>
                            </tr>
                        ) : filteredTransactions.map(transaction => (
                            <tr key={transaction.id}>
                                <td style={styles.td}>{transaction.transaction_date}</td>

                                <td style={styles.td}>
                                    <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        color: transaction.transaction_type === 'deposit'
                                            ? '#176b45'
                                            : '#b42318',
                                        fontWeight: 700
                                    }}>
                                        {transaction.transaction_type === 'deposit'
                                            ? <ArrowDownCircle size={15} />
                                            : <ArrowUpCircle size={15} />}
                                        {transaction.transaction_type === 'deposit'
                                            ? 'Deposit'
                                            : 'Withdrawal'}
                                    </span>
                                </td>

                                <td style={{
                                    ...styles.td,
                                    fontWeight: 700,
                                    color: transaction.transaction_type === 'deposit'
                                        ? '#176b45'
                                        : '#b42318'
                                }}>
                                    {transaction.transaction_type === 'deposit' ? '+' : '-'}
                                    {formatTransactionCurrency(
                                        transaction.amount,
                                        transaction.currency_code
                                    )}
                                </td>

                                <td style={styles.td}>{transaction.reason}</td>
                                <td style={styles.td}>{transaction.notes || '—'}</td>


                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showForm && (
                <div style={styles.modal}>
                    <div style={styles.modalBox}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 20
                        }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: 20 }}>
                                    {form.transaction_type === 'deposit'
                                        ? 'Add Business Savings'
                                        : 'Withdraw from Savings'}
                                </h2>
                                <p style={{ margin: '5px 0 0', color: '#718096', fontSize: 12 }}>
                                    Current balance: {formatCurrency(balance)}
                                </p>
                            </div>

                            <button
                                type="button"
                                style={styles.secondary}
                                onClick={() => setShowForm(false)}
                            >
                                <X size={17} />
                            </button>
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

                        <form onSubmit={saveTransaction}>
                            <div style={{ display: 'grid', gap: 14 }}>
                                <div style={styles.field}>
                                    <label style={styles.label}>Transaction type</label>
                                    <select
                                        style={styles.input}
                                        value={form.transaction_type}
                                        onChange={event => updateForm('transaction_type', event.target.value)}
                                    >
                                        <option value="deposit">Deposit — Add savings</option>
                                        <option value="withdrawal">Withdrawal — Remove savings</option>
                                    </select>
                                </div>

                                <div style={styles.field}>
                                    <label style={styles.label}>Transaction date *</label>
                                    <input
                                        type="date"
                                        required
                                        style={styles.input}
                                        value={form.transaction_date}
                                        onChange={event => updateForm('transaction_date', event.target.value)}
                                    />
                                </div>

                                <div style={styles.field}>
                                    <label style={styles.label}>Amount *</label>
                                    <input
                                        type="number"
                                        required
                                        min="0.01"
                                        step="0.01"
                                        style={styles.input}
                                        placeholder="Enter amount"
                                        value={form.amount}
                                        onChange={event => updateForm('amount', event.target.value)}
                                    />
                                </div>

                                <div style={styles.field}>
                                    <label style={styles.label}>Reason *</label>
                                    <input
                                        required
                                        style={styles.input}
                                        placeholder="e.g. Daily business savings"
                                        value={form.reason}
                                        onChange={event => updateForm('reason', event.target.value)}
                                    />
                                </div>

                                <div style={styles.field}>
                                    <label style={styles.label}>Notes</label>
                                    <textarea
                                        style={{ ...styles.input, minHeight: 75, resize: 'vertical' }}
                                        placeholder="Optional notes..."
                                        value={form.notes}
                                        onChange={event => updateForm('notes', event.target.value)}
                                    />
                                </div>
                            </div>

                            <div style={{
                                display: 'flex',
                                justifyContent: 'flex-end',
                                gap: 9,
                                marginTop: 20
                            }}>
                                <button
                                    type="button"
                                    style={styles.secondary}
                                    onClick={() => setShowForm(false)}
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    style={styles.button}
                                    disabled={saving}
                                >
                                    <Save size={15} />
                                    {saving ? 'Saving...' : 'Save Transaction'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
