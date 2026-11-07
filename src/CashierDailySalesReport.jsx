
import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, Printer, RefreshCw } from 'lucide-react'
import { supabase } from './supabase'
import { useCurrency } from './CurrencyContext'

function getHarareDate() {
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

function formatSaleTime(value) {
    if (!value) return '—'

    return new Date(value).toLocaleTimeString('en-GB', {
        timeZone: 'Africa/Harare',
        hour: '2-digit',
        minute: '2-digit'
    })
}

function formatReportDate(value) {
    if (!value) return ''

    const [year, month, day] = value.split('-')
    return `${day}/${month}/${year}`
}

export default function CashierDailySalesReport({ businessName }) {
    const { formatCurrency } = useCurrency()

    const [selectedDate, setSelectedDate] = useState(getHarareDate)
    const [reportRows, setReportRows] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [loaded, setLoaded] = useState(false)

    const loadReport = useCallback(async () => {
        if (!selectedDate) {
            setError('Please select a report date.')
            return
        }

        setLoading(true)
        setError('')

        try {
            const { data, error: reportError } = await supabase.rpc(
                'cashier_get_daily_sales_report',
                { p_report_date: selectedDate }
            )

            if (reportError) throw reportError

            setReportRows(data || [])
            setLoaded(true)
        } catch (err) {
            console.error('Daily sales report error:', err)
            setError(err.message || 'Could not load the daily sales report.')
            setReportRows([])
            setLoaded(false)
        } finally {
            setLoading(false)
        }
    }, [selectedDate])

    useEffect(() => {
        loadReport()
    }, [loadReport])

    const sales = useMemo(() => {
        const grouped = new Map()

        reportRows.forEach(row => {
            if (!grouped.has(row.sale_id)) {
                grouped.set(row.sale_id, {
                    ...row,
                    items: []
                })
            }

            if (row.item_name) {
                grouped.get(row.sale_id).items.push(row)
            }
        })

        return Array.from(grouped.values())
    }, [reportRows])

    const summary = reportRows[0] || {
        daily_transaction_count: 0,
        daily_total: 0,
        cash_total: 0,
        mobile_money_total: 0,
        bank_card_total: 0
    }

    const handlePrint = () => {
        document.body.classList.add('cashier-daily-report-printing')

        const cleanup = () => {
            document.body.classList.remove('cashier-daily-report-printing')
            window.removeEventListener('afterprint', cleanup)
        }

        window.addEventListener('afterprint', cleanup)
        window.print()
    }

    return (
        <section className="panel cashier-daily-report">
            <div className="no-print" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 16,
                marginBottom: 20
            }}>
                <div>
                    <h2 style={{
                        margin: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8
                    }}>
                        <CalendarDays size={21} />
                        Daily Sales Report
                    </h2>
                    <p style={{ margin: '6px 0 0', color: '#64748b' }}>
                        View and print all completed Cashier sales for a business date.
                    </p>
                </div>

                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 8
                }}>
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={event => setSelectedDate(event.target.value)}
                        style={{
                            padding: '9px 10px',
                            border: '1px solid #cbd5e1',
                            borderRadius: 8
                        }}
                    />

                    <button
                        type="button"
                        onClick={loadReport}
                        disabled={loading}
                        className="btn btn-secondary"
                    >
                        <RefreshCw size={16} />
                        {loading ? 'Loading...' : 'Load report'}
                    </button>

                    <button
                        type="button"
                        onClick={handlePrint}
                        disabled={!loaded || loading || reportRows.length === 0}
                        className="btn btn-primary"
                    >
                        <Printer size={16} />
                        Print report
                    </button>
                </div>
            </div>

            {error && (
                <div className="error-message no-print" style={{ marginBottom: 16 }}>
                    {error}
                </div>
            )}

            <div className="daily-report-print-content">
                <header className="daily-report-heading">
                    <h2>{businessName || 'Canteen'}</h2>
                    <h3>Daily Sales Report</h3>
                    <p>Business date: {formatReportDate(selectedDate)}</p>
                    <p>All completed Cashier transactions</p>
                </header>

                <div className="daily-report-summary">
                    <div className="daily-report-stat">
                        <span>Transactions</span>
                        <strong>{Number(summary.daily_transaction_count || 0)}</strong>
                    </div>
                    <div className="daily-report-stat">
                        <span>Total Sales</span>
                        <strong>{formatCurrency(summary.daily_total || 0)}</strong>
                    </div>
                    <div className="daily-report-stat">
                        <span>Cash</span>
                        <strong>{formatCurrency(summary.cash_total || 0)}</strong>
                    </div>
                    <div className="daily-report-stat">
                        <span>Mobile Money</span>
                        <strong>{formatCurrency(summary.mobile_money_total || 0)}</strong>
                    </div>
                    <div className="daily-report-stat">
                        <span>Bank Card</span>
                        <strong>{formatCurrency(summary.bank_card_total || 0)}</strong>
                    </div>
                </div>

                {!loading && loaded && sales.length === 0 && (
                    <p className="daily-report-empty">
                        No completed sales were recorded for this date.
                    </p>
                )}

                {sales.map(sale => (
                    <article className="daily-report-sale" key={sale.sale_id}>
                        <div className="daily-report-sale-heading">
                            <div>
                                <strong>Receipt: {sale.receipt_number}</strong>
                                <span>
                                    {formatSaleTime(sale.sale_datetime)} · {sale.cashier_name}
                                </span>
                            </div>
                            <div className="daily-report-sale-total">
                                <span>{sale.payment_method?.replaceAll('_', ' ')}</span>
                                <strong>{formatCurrency(sale.total_amount || 0)}</strong>
                            </div>
                        </div>

                        <table className="daily-report-items">
                            <thead>
                                <tr>
                                    <th>Item</th>
                                    <th>Quantity</th>
                                    <th>Unit Price</th>
                                    <th>Line Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sale.items.map((item, index) => (
                                    <tr key={`${sale.sale_id}-${index}`}>
                                        <td>
                                            {item.item_name}
                                            {item.item_unit ? ` (${item.item_unit})` : ''}
                                        </td>
                                        <td>{Number(item.quantity || 0)}</td>
                                        <td>{formatCurrency(item.unit_price || 0)}</td>
                                        <td>{formatCurrency(item.line_total || 0)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="daily-report-payment-details">
                            <span>Amount paid: {formatCurrency(sale.amount_paid || 0)}</span>
                            <span>Change: {formatCurrency(sale.change_amount || 0)}</span>
                        </div>
                    </article>
                ))}

                {sales.length > 0 && (
                    <footer className="daily-report-footer">
                        <strong>
                            Daily total: {formatCurrency(summary.daily_total || 0)}
                        </strong>
                        <span>
                            Number of transactions: {Number(summary.daily_transaction_count || 0)}
                        </span>
                    </footer>
                )}
            </div>
        </section>
    )
}
