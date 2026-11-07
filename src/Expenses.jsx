
import { useEffect, useMemo, useState } from 'react'
import {
    Search, RefreshCw, Plus, X, Pencil, Trash2, Save,
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

const EMPTY_FORM = {
    expense_date: new Date().toISOString().slice(0, 10),
    description: '',
    category: 'Utilities',
    amount: '',
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
    cards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: '14px', marginBottom: '20px' },
    card: { background: '#fff', border: '1px solid #e5ebf1', borderRadius: '13px', padding: '17px' },
    cardLabel: { color: '#718096', fontSize: '12px', fontWeight: 600 },
    cardValue: { fontSize: '24px', fontWeight: 800, marginTop: '9px' },
    panel: { background: '#fff', border: '1px solid #e5ebf1', borderRadius: '13px', padding: '17px', marginBottom: '18px' },
    filters: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '10px', marginTop: '14px' },
    input: { width: '100%', boxSizing: 'border-box', padding: '10px 11px', border: '1px solid #dce5ed', borderRadius: '8px', background: '#fff', color: '#162b42', fontSize: '13px' },
    label: { display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: '#526477' },
    tableWrap: { overflowX: 'auto' },
    table: { width: '100%', borderCollapse: 'collapse', minWidth: '850px', fontSize: '13px' },
    th: { textAlign: 'left', padding: '12px 10px', color: '#718096', background: '#f7f9fb', borderBottom: '1px solid #e5ebf1', whiteSpace: 'nowrap' },
    td: { padding: '13px 10px', borderBottom: '1px solid #edf1f5', verticalAlign: 'middle' },
    iconButton: { border: '1px solid #e1e8ef', borderRadius: '7px', background: '#fff', padding: '7px', cursor: 'pointer', marginRight: '5px', color: '#526477' },
    message: { padding: '11px 13px', borderRadius: '8px', background: '#eff8f2', color: '#17633c', marginBottom: '14px', fontSize: '13px' },
    error: { padding: '11px 13px', borderRadius: '8px', background: '#fff0f0', color: '#a52b2b', marginBottom: '14px', fontSize: '13px' },
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

export default function Expenses() {
    const { formatCurrency, currencyCode } = useCurrency()
    const [expenses, setExpenses] = useState([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState(null)
    const [form, setForm] = useState(EMPTY_FORM)

    const [search, setSearch] = useState('')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [categoryFilter, setCategoryFilter] = useState('all')
    const [paymentFilter, setPaymentFilter] = useState('all')

    const [message, setMessage] = useState('')
    const [errorMessage, setErrorMessage] = useState('')

    async function loadExpenses() {
        setLoading(true)
        setErrorMessage('')

        const { data, error } = await supabase
            .from('expenses')
            .select('*')
            .order('expense_date', { ascending: false })
            .order('created_at', { ascending: false })

        if (error) {
            setErrorMessage(error.message)
        } else {
            setExpenses(data || [])
        }

        setLoading(false)
    }

    useEffect(() => {
        loadExpenses()
    }, [])

    const filteredExpenses = useMemo(() => {
        const term = search.trim().toLowerCase()

        return expenses.filter(expense => {
            const matchesSearch = !term || [
                expense.description,
                expense.category,
                expense.payment_method,
                expense.notes
            ].some(value => String(value || '').toLowerCase().includes(term))

            const matchesStart = !startDate || expense.expense_date >= startDate
            const matchesEnd = !endDate || expense.expense_date <= endDate
            const matchesCategory = categoryFilter === 'all' || expense.category === categoryFilter
            const matchesPayment = paymentFilter === 'all' || expense.payment_method === paymentFilter

            return matchesSearch && matchesStart && matchesEnd &&
                matchesCategory && matchesPayment
        })
    }, [expenses, search, startDate, endDate, categoryFilter, paymentFilter])

    const totalExpenses = filteredExpenses.reduce(
        (sum, expense) => sum + Number(expense.amount || 0), 0
    )

    const cashExpenses = filteredExpenses
        .filter(item => item.payment_method === 'cash')
        .reduce((sum, item) => sum + Number(item.amount || 0), 0)

    const digitalExpenses = filteredExpenses
        .filter(item => item.payment_method !== 'cash')
        .reduce((sum, item) => sum + Number(item.amount || 0), 0)

    function openNewForm() {
        setEditingId(null)
        setForm({ ...EMPTY_FORM, expense_date: new Date().toISOString().slice(0, 10) })
        setMessage('')
        setErrorMessage('')
        setShowForm(true)
    }

    function openEditForm(expense) {
        setEditingId(expense.id)
        setForm({
            expense_date: expense.expense_date || '',
            description: expense.description || '',
            category: expense.category || 'Other',
            amount: String(expense.amount ?? ''),
            payment_method: expense.payment_method || 'cash',
            notes: expense.notes || ''
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

        if (!form.expense_date || !form.description.trim() ||
            !form.category || !form.payment_method ||
            form.amount === '' || !Number.isFinite(amount) || amount < 0) {
            setErrorMessage('Please complete all required fields and enter a valid amount.')
            setSaving(false)
            return
        }

        const payload = {
            expense_date: form.expense_date,
            description: form.description.trim(),
            category: form.category,
            amount,
            payment_method: form.payment_method,
            notes: form.notes.trim() || null
        }

        const result = editingId
            ? await supabase.from('expenses').update(payload).eq('id', editingId)
            : await supabase.from('expenses').insert(payload)

        if (result.error) {
            setErrorMessage(result.error.message)
        } else {
            setMessage(editingId ? 'Expense updated successfully.' : 'Expense recorded successfully.')
            setShowForm(false)
            setForm(EMPTY_FORM)
            setEditingId(null)
            await loadExpenses()

            window.dispatchEvent(
                new Event('refresh-canteen-dashboard')
            )
        }

        setSaving(false)
    }

    async function handleDelete(expense) {
        const confirmed = window.confirm(
            `Delete the expense "${expense.description}"? This action cannot be undone.`
        )

        if (!confirmed) return

        setMessage('')
        setErrorMessage('')

        const { error } = await supabase
            .from('expenses')
            .delete()
            .eq('id', expense.id)

        if (error) {
            setErrorMessage(error.message)
        } else {
            setMessage('Expense deleted successfully.')
            await loadExpenses()

            window.dispatchEvent(
                new Event('refresh-canteen-dashboard')
            )
        }
    }

    function clearFilters() {
        setSearch('')
        setStartDate('')
        setEndDate('')
        setCategoryFilter('all')
        setPaymentFilter('all')
    }

    function exportCsv() {
        const headers = [
            'Date', 'Description', 'Category', `Amount (${currencyCode})`,
            'Payment Method', 'Notes'
        ]

        const rows = filteredExpenses.map(item => [
            item.expense_date,
            item.description,
            item.category,
            item.amount,
            paymentLabel(item.payment_method),
            item.notes || ''
        ])

        const escapeCsv = value =>
            `"${String(value ?? '').replace(/"/g, '""')}"`

        const csv = [headers, ...rows]
            .map(row => row.map(escapeCsv).join(','))
            .join('\n')

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `canteen-expenses-${new Date().toISOString().slice(0, 10)}.csv`
        link.click()
        URL.revokeObjectURL(url)
    }

    return (
        <div style={styles.page}>
            <div style={styles.heading}>
                <div>
                    <h1 style={styles.title}>Expenses</h1>
                    <p style={styles.subtitle}>Record, manage and track all canteen expenses.</p>
                </div>

                <div style={{ display: 'flex', gap: '9px', flexWrap: 'wrap' }}>
                    <button style={styles.secondary} onClick={loadExpenses}>
                        <RefreshCw size={15} /> Refresh
                    </button>
                    <button style={styles.secondary} onClick={exportCsv}>
                        <Download size={15} /> Export CSV
                    </button>
                    <button style={styles.button} onClick={openNewForm}>
                        <Plus size={16} /> Add Expense
                    </button>
                </div>
            </div>

            {message && <div style={styles.message}>{message}</div>}
            {errorMessage && <div style={styles.error}>{errorMessage}</div>}

            <div style={styles.cards}>
                <div style={styles.card}>
                    <div style={styles.cardLabel}><Receipt size={15} /> Total Expenses</div>
                    <div style={styles.cardValue}>{formatCurrency(totalExpenses)}</div>
                    <div style={styles.subtitle}>Filtered records</div>
                </div>

                <div style={styles.card}>
                    <div style={styles.cardLabel}>Cash Expenses</div>
                    <div style={styles.cardValue}>{formatCurrency(cashExpenses)}</div>
                    <div style={styles.subtitle}>Reduces physical cash</div>
                </div>

                <div style={styles.card}>
                    <div style={styles.cardLabel}>Digital Expenses</div>
                    <div style={styles.cardValue}>{formatCurrency(digitalExpenses)}</div>
                    <div style={styles.subtitle}>Mobile Money and Bank / Card</div>
                </div>

                <div style={styles.card}>
                    <div style={styles.cardLabel}><TrendingDown size={15} /> Expense Records</div>
                    <div style={styles.cardValue}>{filteredExpenses.length}</div>
                    <div style={styles.subtitle}>Matching records</div>
                </div>
            </div>

            <div style={styles.panel}>
                <strong style={{ fontSize: '14px' }}>Search and filter expenses</strong>

                <div style={styles.filters}>
                    <div>
                        <label style={styles.label}>Search</label>
                        <div style={{ position: 'relative' }}>
                            <Search size={15} style={{ position: 'absolute', left: 10, top: 11, color: '#8998a8' }} />
                            <input
                                style={{ ...styles.input, paddingLeft: '32px' }}
                                placeholder="Description, notes, category..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <label style={styles.label}>From date</label>
                        <input style={styles.input} type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    </div>

                    <div>
                        <label style={styles.label}>To date</label>
                        <input style={styles.input} type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
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
                                ...expenses.map(expense => expense.category).filter(Boolean)
                            ])].map(category => (
                                <option key={category} value={category}>
                                    {category}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label style={styles.label}>Payment method</label>
                        <select style={styles.input} value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)}>
                            <option value="all">All Payment Methods</option>
                            {PAYMENT_METHODS.map(method => <option key={method.value} value={method.value}>{method.label}</option>)}
                        </select>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'end' }}>
                        <button style={styles.secondary} onClick={clearFilters}>Clear Filters</button>
                    </div>
                </div>

                <p style={{ fontSize: '12px', color: '#718096', margin: '13px 0 0' }}>
                    Showing {filteredExpenses.length} of {expenses.length} expenses
                </p>
            </div>

            <div style={styles.panel}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                    <strong style={{ fontSize: '15px' }}>Expense Records</strong>
                    <span style={{ fontSize: '12px', color: '#718096' }}>
                        <CalendarDays size={14} style={{ verticalAlign: 'middle', marginRight: '5px' }} />
                        Latest records first
                    </span>
                </div>

                {loading ? (
                    <p style={{ color: '#718096', padding: '20px' }}>Loading expenses...</p>
                ) : filteredExpenses.length === 0 ? (
                    <p style={{ color: '#718096', padding: '25px', textAlign: 'center' }}>
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
                                    <th style={styles.th}>Payment Method</th>
                                    <th style={styles.th}>Notes</th>
                                    <th style={styles.th}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredExpenses.map(expense => (
                                    <tr key={expense.id}>
                                        <td style={styles.td}>{formatDate(expense.expense_date)}</td>
                                        <td style={{ ...styles.td, fontWeight: 700 }}>{expense.description}</td>
                                        <td style={styles.td}>{expense.category}</td>
                                        <td style={{ ...styles.td, fontWeight: 700 }}>{formatCurrency(expense.amount)}</td>
                                        <td style={styles.td}>{paymentLabel(expense.payment_method)}</td>
                                        <td style={{ ...styles.td, color: '#718096', maxWidth: '180px' }}>{expense.notes || '—'}</td>
                                        <td style={styles.td}>
                                            {expense.category === 'Staff Salary' ? (
                                                <span style={{ color: '#718096', fontSize: '12px', fontWeight: 600 }}>
                                                    Payroll record
                                                </span>
                                            ) : (
                                                <>
                                                    <button
                                                        title="Edit expense"
                                                        style={styles.iconButton}
                                                        onClick={() => openEditForm(expense)}
                                                    >
                                                        <Pencil size={15} />
                                                    </button>
                                                    <button
                                                        title="Delete expense"
                                                        style={{ ...styles.iconButton, color: '#b83232' }}
                                                        onClick={() => handleDelete(expense)}
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                </>
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
                <div style={styles.overlay} onClick={() => setShowForm(false)}>
                    <div style={styles.modal} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ margin: 0, fontSize: '19px' }}>
                                {editingId ? 'Edit Expense' : 'Record New Expense'}
                            </h2>
                            <button style={styles.iconButton} onClick={() => setShowForm(false)}>
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSave}>
                            <div style={styles.formGrid}>
                                <div>
                                    <label style={styles.label}>Expense Date *</label>
                                    <input required type="date" style={styles.input} value={form.expense_date} onChange={e => setForm({ ...form, expense_date: e.target.value })} />
                                </div>

                                <div>
                                    <label style={styles.label}>Description *</label>
                                    <input required style={styles.input} placeholder="e.g. Electricity bill" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                                </div>

                                <div>
                                    <label style={styles.label}>Category *</label>
                                    <select
                                        style={styles.input}
                                        value={form.category}
                                        onChange={e => setForm({ ...form, category: e.target.value })}
                                    >
                                        {editingId &&
                                            form.category &&
                                            !CATEGORIES.includes(form.category) && (
                                                <option value={form.category}>
                                                    Existing category: {form.category}
                                                </option>
                                            )
                                        }

                                        {CATEGORIES.map(category => (
                                            <option key={category} value={category}>
                                                {category}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label style={styles.label}>Amount *</label>
                                    <input required min="0" step="0.01" type="number" style={styles.input} placeholder="Enter amount" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
                                </div>

                                <div>
                                    <label style={styles.label}>Payment Method *</label>
                                    <select required style={styles.input} value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })}>
                                        {PAYMENT_METHODS.map(method => <option key={method.value} value={method.value}>{method.label}</option>)}
                                    </select>
                                </div>

                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label style={styles.label}>Notes (Optional)</label>
                                    <textarea rows="3" style={{ ...styles.input, resize: 'vertical' }} placeholder="Additional information..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '9px', marginTop: '20px' }}>
                                <button type="button" style={styles.secondary} onClick={() => setShowForm(false)}>Cancel</button>
                                <button type="submit" disabled={saving} style={{ ...styles.button, opacity: saving ? 0.65 : 1 }}>
                                    <Save size={15} /> {saving ? 'Saving...' : editingId ? 'Update Expense' : 'Save Expense'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
