
import { useCallback, useEffect, useMemo, useState } from 'react'
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

const CURRENCIES = ['USD', 'ZAR', 'ZWG']

const CURRENCY_SYMBOLS = {
    USD: '$',
    ZAR: 'R',
    ZWG: 'ZiG'
}

const today = () => {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Africa/Harare',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(new Date())

    const values = Object.fromEntries(
        parts.map(part => [part.type, part.value])
    )

    return `${values.year}-${values.month}-${values.day}`
}

const emptyForm = {
    transaction_date: today(),
    transaction_type: 'deposit',
    amount: '',
    reason: '',
    notes: ''
}

const formatTransactionCurrency = (amount, code = 'USD') => {
    const symbol = CURRENCY_SYMBOLS[code] || code

    return `${symbol}${new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(Number(amount) || 0)}`
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

    cardLabel: {
        color: '#718096',
        fontSize: 12,
        fontWeight: 600
    },

    cardValue: {
        fontSize: 25,
        fontWeight: 800,
        marginTop: 9
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
        gap: 6
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
        minWidth: 800
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
    const {
        formatCurrency,
        currencyCode: contextCurrencyCode = 'USD'
    } = useCurrency()

    const currencyCode = CURRENCIES.includes(contextCurrencyCode)
        ? contextCurrencyCode
        : 'USD'

    const [transactions, setTransactions] = useState([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    const [showForm, setShowForm] = useState(false)
    const [form, setForm] = useState({
        ...emptyForm,
        transaction_date: today()
    })

    const [message, setMessage] = useState('')
    const [error, setError] = useState('')

    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')

    // --------------------------------------------------
    // LOAD SAVINGS TRANSACTIONS
    // --------------------------------------------------

    const loadTransactions = useCallback(async () => {
        setLoading(true)
        setError('')

        try {
            const { data, error } = await supabase
                .from('business_savings')
                .select(`
                    id,
                    transaction_date,
                    transaction_type,
                    amount,
                    reason,
                    notes,
                    currency_code,
                    created_by,
                    created_at
                `)
                .order('transaction_date', { ascending: false })
                .order('created_at', { ascending: false })

            if (error) throw error

            setTransactions(data || [])
        } catch (err) {
            setError(err.message || 'Could not load savings records.')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        loadTransactions()
    }, [loadTransactions])

    // --------------------------------------------------
    // FILTER BY BUSINESS CURRENCY
    // --------------------------------------------------

    const currentCurrencyTransactions = useMemo(() => {
        return transactions.filter(
            item => item.currency_code === currencyCode
        )
    }, [transactions, currencyCode])

    // --------------------------------------------------
    // SAVINGS BALANCE
    // --------------------------------------------------

    const balance = useMemo(() => {
        return currentCurrencyTransactions.reduce((total, item) => {
            const amount = Number(item.amount || 0)

            return item.transaction_type === 'deposit'
                ? total + amount
                : total - amount
        }, 0)
    }, [currentCurrencyTransactions])

    // --------------------------------------------------
    // TOTAL DEPOSITS
    // --------------------------------------------------

    const totalDeposits = useMemo(() => {
        return currentCurrencyTransactions
            .filter(item => item.transaction_type === 'deposit')
            .reduce(
                (sum, item) => sum + Number(item.amount || 0),
                0
            )
    }, [currentCurrencyTransactions])

    // --------------------------------------------------
    // TOTAL WITHDRAWALS
    // --------------------------------------------------

    const totalWithdrawals = useMemo(() => {
        return currentCurrencyTransactions
            .filter(item => item.transaction_type === 'withdrawal')
            .reduce(
                (sum, item) => sum + Number(item.amount || 0),
                0
            )
    }, [currentCurrencyTransactions])

    // --------------------------------------------------
    // DATE FILTERS
    // --------------------------------------------------

    const filteredTransactions = useMemo(() => {
        return currentCurrencyTransactions.filter(item => {
            const matchesStart =
                !startDate || item.transaction_date >= startDate

            const matchesEnd =
                !endDate || item.transaction_date <= endDate

            return matchesStart && matchesEnd
        })
    }, [
        currentCurrencyTransactions,
        startDate,
        endDate
    ])

    // --------------------------------------------------
    // OPEN TRANSACTION FORM
    // --------------------------------------------------

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
        setForm(previous => ({
            ...previous,
            [field]: value
        }))
    }

    // --------------------------------------------------
    // SAVE TRANSACTION
    // --------------------------------------------------

    const saveTransaction = async event => {
        event.preventDefault()

        setError('')
        setMessage('')

        const amount = Number(form.amount)

        if (
            !form.transaction_date ||
            !Number.isFinite(amount) ||
            amount <= 0
        ) {
            setError(
                'Please enter a valid date and an amount greater than zero.'
            )
            return
        }

        if (
            !['deposit', 'withdrawal'].includes(form.transaction_type)
        ) {
            setError('Invalid savings transaction type.')
            return
        }

        if (!(form.reason || '').trim()) {
            setError('Please enter a reason for this transaction.')
            return
        }

        if (
            form.transaction_type === 'withdrawal' &&
            amount > balance
        ) {
            setError(
                `Insufficient savings. Available balance: ${formatCurrency(balance)}.`
            )
            return
        }

        setSaving(true)

        try {
            // Insert only. Existing savings transactions are never
            // updated or deleted because they generate financial journals.

            const { error } = await supabase
                .from('business_savings')
                .insert({
                    transaction_date: form.transaction_date,
                    transaction_type: form.transaction_type,
                    amount,
                    reason: form.reason.trim(),
                    notes: form.notes.trim() || null,
                    currency_code: currencyCode
                })

            if (error) throw error

            setShowForm(false)

            setForm({
                ...emptyForm,
                transaction_date: today()
            })

            setMessage(
                `${form.transaction_type === 'deposit' ? 'Savings deposit' : 'Savings withdrawal'} recorded successfully.`
            )

            await loadTransactions()
        } catch (err) {
            setError(
                err.message || 'Could not save the savings transaction.'
            )
        } finally {
            setSaving(false)
        }
    }

    // --------------------------------------------------
    // RENDER
    // --------------------------------------------------

    return (
        <div style={styles.page}>

            {/* HEADER */}

            <div style={styles.header}>
                <div>
                    <h1 style={styles.title}>
                        Business Savings
                    </h1>

                    <div style={styles.subtitle}>
                        Track money saved by Mbare Chitekete and record withdrawals.
                        All balances are maintained separately by currency.
                    </div>
                </div>

                <div style={{
                    display: 'flex',
                    gap: 9,
                    flexWrap: 'wrap'
                }}>
                    <button
                        type="button"
                        style={styles.secondary}
                        onClick={loadTransactions}
                        disabled={loading}
                    >
                        <RefreshCw size={15} />
                        {loading ? 'Refreshing...' : 'Refresh'}
                    </button>

                    <button
                        type="button"
                        style={styles.secondary}
                        onClick={() => openForm('withdrawal')}
                    >
                        <ArrowUpCircle size={16} />
                        Withdraw
                    </button>

                    <button
                        type="button"
                        style={styles.button}
                        onClick={() => openForm('deposit')}
                    >
                        <Plus size={16} />
                        Add Savings
                    </button>
                </div>
            </div>

            {/* SUCCESS MESSAGE */}

            {message && (
                <div style={{
                    ...styles.message,
                    background: '#e9f8ef',
                    color: '#176b45'
                }}>
                    {message}
                </div>
            )}

            {/* ERROR MESSAGE */}

            {error && !showForm && (
                <div style={{
                    ...styles.message,
                    background: '#fff0f0',
                    color: '#b42318'
                }}>
                    {error}
                </div>
            )}

            {/* SUMMARY CARDS */}

            <div style={styles.cards}>

                <div style={styles.card}>
                    <div style={styles.cardLabel}>
                        <PiggyBank
                            size={15}
                            style={{
                                verticalAlign: 'middle',
                                marginRight: 5
                            }}
                        />
                        Current Savings Balance ({currencyCode})
                    </div>

                    <div style={{
                        ...styles.cardValue,
                        color: balance < 0 ? '#b42318' : '#176b45'
                    }}>
                        {formatCurrency(balance)}
                    </div>
                </div>

                <div style={styles.card}>
                    <div style={styles.cardLabel}>
                        <ArrowDownCircle
                            size={15}
                            style={{
                                verticalAlign: 'middle',
                                marginRight: 5
                            }}
                        />
                        Total Deposits ({currencyCode})
                    </div>

                    <div style={styles.cardValue}>
                        {formatCurrency(totalDeposits)}
                    </div>
                </div>

                <div style={styles.card}>
                    <div style={styles.cardLabel}>
                        <ArrowUpCircle
                            size={15}
                            style={{
                                verticalAlign: 'middle',
                                marginRight: 5
                            }}
                        />
                        Total Withdrawals ({currencyCode})
                    </div>

                    <div style={styles.cardValue}>
                        {formatCurrency(totalWithdrawals)}
                    </div>
                </div>

            </div>

            {/* FINANCIAL INFORMATION */}

            <div style={{
                ...styles.message,
                background: '#eff6ff',
                color: '#315b86'
            }}>
                <Wallet
                    size={16}
                    style={{
                        verticalAlign: 'middle',
                        marginRight: 7
                    }}
                />

                Only money actually put aside should be recorded as savings.
                Savings are tracked separately from sales, purchases and cash allocations.

                <br />

                <strong>
                    Current currency: {currencyCode}
                </strong>

                <br />

                Deposits and withdrawals are recorded in their original transaction
                currency. No automatic currency conversion is performed here.
            </div>

            {/* DATE FILTERS */}

            <div style={{
                display: 'flex',
                gap: 12,
                flexWrap: 'wrap',
                alignItems: 'end',
                marginBottom: 15
            }}>

                <div style={{
                    ...styles.field,
                    minWidth: 160
                }}>
                    <label style={styles.label}>
                        From date
                    </label>

                    <input
                        type="date"
                        style={styles.input}
                        value={startDate}
                        onChange={event => setStartDate(event.target.value)}
                    />
                </div>

                <div style={{
                    ...styles.field,
                    minWidth: 160
                }}>
                    <label style={styles.label}>
                        To date
                    </label>

                    <input
                        type="date"
                        style={styles.input}
                        value={endDate}
                        onChange={event => setEndDate(event.target.value)}
                    />
                </div>

                <button
                    type="button"
                    style={styles.secondary}
                    onClick={() => {
                        setStartDate('')
                        setEndDate('')
                    }}
                >
                    <X size={14} />
                    Clear Filters
                </button>

            </div>

            {/* TRANSACTION COUNT */}

            <div style={{
                color: '#718096',
                fontSize: 12,
                marginBottom: 10
            }}>
                Showing {filteredTransactions.length} of {currentCurrencyTransactions.length} {currencyCode} transactions
            </div>

            {/* TRANSACTION TABLE */}

            <div style={styles.tableWrap}>
                <table style={styles.table}>

                    <thead>
                        <tr>
                            <th style={styles.th}>Date</th>
                            <th style={styles.th}>Transaction</th>
                            <th style={styles.th}>Currency</th>
                            <th style={styles.th}>Amount</th>
                            <th style={styles.th}>Reason</th>
                            <th style={styles.th}>Notes</th>
                        </tr>
                    </thead>

                    <tbody>

                        {loading ? (
                            <tr>
                                <td style={styles.td} colSpan="6">
                                    Loading savings records...
                                </td>
                            </tr>
                        ) : filteredTransactions.length === 0 ? (
                            <tr>
                                <td
                                    style={{
                                        ...styles.td,
                                        textAlign: 'center',
                                        color: '#718096'
                                    }}
                                    colSpan="6"
                                >
                                    No {currencyCode} savings transactions found.
                                </td>
                            </tr>
                        ) : (
                            filteredTransactions.map(transaction => (
                                <tr key={transaction.id}>

                                    <td style={styles.td}>
                                        {transaction.transaction_date}
                                    </td>

                                    <td style={styles.td}>
                                        <span style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 6,
                                            color:
                                                transaction.transaction_type === 'deposit'
                                                    ? '#176b45'
                                                    : '#b42318',
                                            fontWeight: 700
                                        }}>
                                            {transaction.transaction_type === 'deposit'
                                                ? <ArrowDownCircle size={15} />
                                                : <ArrowUpCircle size={15} />
                                            }

                                            {transaction.transaction_type === 'deposit'
                                                ? 'Deposit'
                                                : 'Withdrawal'
                                            }
                                        </span>
                                    </td>

                                    <td style={styles.td}>
                                        {transaction.currency_code}
                                    </td>

                                    <td style={{
                                        ...styles.td,
                                        fontWeight: 700,
                                        color:
                                            transaction.transaction_type === 'deposit'
                                                ? '#176b45'
                                                : '#b42318'
                                    }}>
                                        {transaction.transaction_type === 'deposit'
                                            ? '+'
                                            : '-'
                                        }

                                        {formatTransactionCurrency(
                                            transaction.amount,
                                            transaction.currency_code
                                        )}
                                    </td>

                                    <td style={styles.td}>
                                        {transaction.reason}
                                    </td>

                                    <td style={styles.td}>
                                        {transaction.notes || '—'}
                                    </td>

                                </tr>
                            ))
                        )}

                    </tbody>
                </table>
            </div>

            {/* TRANSACTION FORM */}

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
                                <h2 style={{
                                    margin: 0,
                                    fontSize: 20
                                }}>
                                    {form.transaction_type === 'deposit'
                                        ? 'Add Business Savings'
                                        : 'Withdraw from Savings'
                                    }
                                </h2>

                                <p style={{
                                    margin: '5px 0 0',
                                    color: '#718096',
                                    fontSize: 12
                                }}>
                                    Available balance: {formatCurrency(balance)}
                                </p>
                            </div>

                            <button
                                type="button"
                                style={styles.secondary}
                                onClick={() => {
                                    setShowForm(false)
                                    setError('')
                                }}
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
                            <div style={{
                                display: 'grid',
                                gap: 14
                            }}>

                                {/* TRANSACTION TYPE */}

                                <div style={styles.field}>
                                    <label style={styles.label}>
                                        Transaction type
                                    </label>

                                    <select
                                        style={styles.input}
                                        value={form.transaction_type}
                                        onChange={event => updateForm(
                                            'transaction_type',
                                            event.target.value
                                        )}
                                    >
                                        <option value="deposit">
                                            Deposit — Add savings
                                        </option>

                                        <option value="withdrawal">
                                            Withdrawal — Remove savings
                                        </option>
                                    </select>
                                </div>

                                {/* CURRENCY */}

                                <div style={styles.field}>
                                    <label style={styles.label}>
                                        Transaction currency
                                    </label>

                                    <input
                                        style={{
                                            ...styles.input,
                                            background: '#f7f9fc',
                                            fontWeight: 700
                                        }}
                                        value={currencyCode}
                                        readOnly
                                    />

                                    <span style={{
                                        fontSize: 11,
                                        color: '#718096'
                                    }}>
                                        The business currency configured in Settings
                                        is applied by the database.
                                    </span>
                                </div>

                                {/* DATE */}

                                <div style={styles.field}>
                                    <label style={styles.label}>
                                        Transaction date *
                                    </label>

                                    <input
                                        type="date"
                                        required
                                        style={styles.input}
                                        value={form.transaction_date}
                                        onChange={event => updateForm(
                                            'transaction_date',
                                            event.target.value
                                        )}
                                    />
                                </div>

                                {/* AMOUNT */}

                                <div style={styles.field}>
                                    <label style={styles.label}>
                                        Amount ({currencyCode}) *
                                    </label>

                                    <input
                                        type="number"
                                        required
                                        min="0.01"
                                        step="0.01"
                                        style={styles.input}
                                        placeholder="Enter amount"
                                        value={form.amount}
                                        onChange={event => updateForm(
                                            'amount',
                                            event.target.value
                                        )}
                                    />
                                </div>

                                {/* REASON */}

                                <div style={styles.field}>
                                    <label style={styles.label}>
                                        Reason *
                                    </label>

                                    <input
                                        required
                                        style={styles.input}
                                        placeholder="e.g. Daily business savings"
                                        value={form.reason}
                                        onChange={event => updateForm(
                                            'reason',
                                            event.target.value
                                        )}
                                    />
                                </div>

                                {/* NOTES */}

                                <div style={styles.field}>
                                    <label style={styles.label}>
                                        Notes
                                    </label>

                                    <textarea
                                        style={{
                                            ...styles.input,
                                            minHeight: 75,
                                            resize: 'vertical'
                                        }}
                                        placeholder="Optional notes..."
                                        value={form.notes}
                                        onChange={event => updateForm(
                                            'notes',
                                            event.target.value
                                        )}
                                    />
                                </div>

                            </div>

                            {/* FORM BUTTONS */}

                            <div style={{
                                display: 'flex',
                                justifyContent: 'flex-end',
                                gap: 9,
                                marginTop: 20
                            }}>

                                <button
                                    type="button"
                                    style={styles.secondary}
                                    onClick={() => {
                                        setShowForm(false)
                                        setError('')
                                    }}
                                    disabled={saving}
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    style={{
                                        ...styles.button,
                                        opacity: saving ? 0.65 : 1
                                    }}
                                    disabled={saving}
                                >
                                    <Save size={15} />

                                    {saving
                                        ? 'Saving...'
                                        : 'Save Transaction'
                                    }
                                </button>

                            </div>
                        </form>

                    </div>
                </div>
            )}

        </div>
    )
}
