
import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, Printer, RefreshCw } from 'lucide-react'
import { supabase } from './supabase'

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

function formatSaleCurrency(value, currencyCode = 'USD') {
    const amount = Number(value || 0)

    const symbols = {
        USD: '$',
        ZAR: 'R',
        ZWG: 'ZiG'
    }

    const symbol = symbols[currencyCode] || `${currencyCode} `

    return `${symbol} ${amount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`
}

const PAYMENT_METHOD_LABELS = {
    cash: 'Cash',
    mobile_money: 'Mobile Money',
    bank_card: 'Bank Card'
}

export default function CashierDailySalesReport({ businessName }) {
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

    // The RPC returns daily totals scoped to each transaction currency.
    const currencySummaries = useMemo(() => {
        const summaries = new Map()

        reportRows.forEach(row => {
            const currency = row.currency_code || 'USD'

            if (!summaries.has(currency)) {
                summaries.set(currency, {
                    currency_code: currency,
                    daily_transaction_count:
                        Number(row.daily_transaction_count || 0),
                    daily_total: Number(row.daily_total || 0),
                    cash_total: Number(row.cash_total || 0),
                    mobile_money_total:
                        Number(row.mobile_money_total || 0),
                    bank_card_total: Number(row.bank_card_total || 0)
                })
            }
        })

        return Array.from(summaries.values()).sort((a, b) =>
            a.currency_code.localeCompare(b.currency_code)
        )
    }, [reportRows])

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
            <div
                className="no-print"
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 16,
                    marginBottom: 20
                }}
            >
                <div>
                    <h2
                        style={{
                            margin: 0,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8
                        }}
                    >
                        <CalendarDays size={21} />
                        Daily Sales Report
                    </h2>

                    <p style={{ margin: '6px 0 0', color: '#64748b' }}>
                        View and print completed Cashier sales for a business date.
                    </p>
                </div>

                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 8
                    }}
                >
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
                        disabled={!loaded || loading || sales.length === 0}
                        className="btn btn-primary"
                    >
                        <Printer size={16} />
                        Print report
                    </button>
                </div>
            </div>

            {error && (
                <div
                    className="error-message no-print"
                    style={{ marginBottom: 16 }}
                >
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

                {currencySummaries.length > 0 && (
                    <div className="daily-report-currency-summaries">
                        {currencySummaries.map(summary => (
                            <section
                                className="daily-report-currency-section"
                                key={summary.currency_code}
                            >
                                <h3>
                                    {summary.currency_code} Sales Summary
                                </h3>

                                <div className="daily-report-summary">
                                    <div className="daily-report-stat">
                                        <span>Transactions</span>
                                        <strong>
                                            {summary.daily_transaction_count}
                                        </strong>
                                    </div>

                                    <div className="daily-report-stat">
                                        <span>Total Sales</span>
                                        <strong>
                                            {formatSaleCurrency(
                                                summary.daily_total,
                                                summary.currency_code
                                            )}
                                        </strong>
                                    </div>

                                    <div className="daily-report-stat">
                                        <span>Cash</span>
                                        <strong>
                                            {formatSaleCurrency(
                                                summary.cash_total,
                                                summary.currency_code
                                            )}
                                        </strong>
                                    </div>

                                    <div className="daily-report-stat">
                                        <span>Mobile Money</span>
                                        <strong>
                                            {formatSaleCurrency(
                                                summary.mobile_money_total,
                                                summary.currency_code
                                            )}
                                        </strong>
                                    </div>

                                    <div className="daily-report-stat">
                                        <span>Bank Card</span>
                                        <strong>
                                            {formatSaleCurrency(
                                                summary.bank_card_total,
                                                summary.currency_code
                                            )}
                                        </strong>
                                    </div>
                                </div>
                            </section>
                        ))}
                    </div>
                )}

                {!loading && loaded && sales.length === 0 && (
                    <p className="daily-report-empty">
                        No completed sales were recorded for this date.
                    </p>
                )}

                {sales.map(sale => {
                    const currency = sale.currency_code || 'USD'

                    return (
                        <article
                            className="daily-report-sale"
                            key={sale.sale_id}
                        >
                            <div className="daily-report-sale-heading">
                                <div>
                                    <strong>
                                        Receipt: {sale.receipt_number}
                                    </strong>

                                    <span>
                                        {formatSaleTime(sale.sale_datetime)}
                                        {' · '}
                                        {sale.cashier_name}
                                        {' · '}
                                        {currency}
                                    </span>
                                </div>

                                <div className="daily-report-sale-total">
                                    <span>
                                        {PAYMENT_METHOD_LABELS[
                                            sale.payment_method
                                        ] || sale.payment_method?.replaceAll('_', ' ')}
                                    </span>

                                    <strong>
                                        {formatSaleCurrency(
                                            sale.total_amount,
                                            currency
                                        )}
                                    </strong>
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
                                                {item.item_unit
                                                    ? ` (${item.item_unit})`
                                                    : ''}
                                            </td>

                                            <td>
                                                {Number(item.quantity || 0)}
                                            </td>

                                            <td>
                                                {formatSaleCurrency(
                                                    item.unit_price,
                                                    currency
                                                )}
                                            </td>

                                            <td>
                                                {formatSaleCurrency(
                                                    item.line_total,
                                                    currency
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            <div className="daily-report-payment-details">
                                <span>
                                    Amount paid:{' '}
                                    {formatSaleCurrency(
                                        sale.amount_paid,
                                        currency
                                    )}
                                </span>

                                <span>
                                    Change:{' '}
                                    {formatSaleCurrency(
                                        sale.change_amount,
                                        currency
                                    )}
                                </span>
                            </div>
                        </article>
                    )
                })}

                {currencySummaries.length > 0 && (
                    <footer className="daily-report-footer">
                        {currencySummaries.map(summary => (
                            <div key={summary.currency_code}>
                                <strong>
                                    {summary.currency_code} daily total:{' '}
                                    {formatSaleCurrency(
                                        summary.daily_total,
                                        summary.currency_code
                                    )}
                                </strong>

                                <span>
                                    Transactions:{' '}
                                    {summary.daily_transaction_count}
                                </span>
                            </div>
                        ))}
                    </footer>
                )}
            </div>
        </section>
    )
}
