
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
    ClipboardList,
    Search,
    RefreshCw,
    Clock3,
    CheckCircle2,
    ChefHat,
    PackageCheck,
    XCircle,
    Phone,
    Mail,
    CalendarDays,
    UserRound,
    AlertCircle
} from 'lucide-react'
import { supabase } from './supabase'

const HARARE_TIME_ZONE = 'Africa/Harare'

const ORDER_SELECT = `
    id,
    order_reference,
    customer_name,
    customer_phone,
    customer_email,
    order_status,
    payment_status,
    fulfillment_method,
    currency_code,
    subtotal,
    total_amount,
    customer_notes,
    reservation_expires_at,
    confirmed_at,
    collected_at,
    created_at,
    updated_at,
    placed_at,
    expected_collection_at,
    collected_by,
    sale_id,
    online_order_items (
        id,
        menu_item_id,
        item_name,
        item_unit,
        quantity,
        unit_price,
        line_total,
        created_at
    )
`

const STATUS_OPTIONS = [
    { value: 'all', label: 'All orders' },
    { value: 'pending', label: 'Pending' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'preparing', label: 'Preparing' },
    { value: 'ready', label: 'Ready for collection' },
    { value: 'collected', label: 'Collected' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'expired', label: 'Expired' }
]

const STATUS_META = {
    pending: {
        label: 'Pending',
        className: 'oo-status-pending'
    },
    confirmed: {
        label: 'Confirmed',
        className: 'oo-status-confirmed'
    },
    preparing: {
        label: 'Preparing',
        className: 'oo-status-preparing'
    },
    ready: {
        label: 'Ready for collection',
        className: 'oo-status-ready'
    },
    collected: {
        label: 'Collected',
        className: 'oo-status-collected'
    },
    cancelled: {
        label: 'Cancelled',
        className: 'oo-status-cancelled'
    },
    expired: {
        label: 'Expired',
        className: 'oo-status-expired'
    }
}

function formatDateTime(value) {
    if (!value) return 'Not recorded'

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'Not recorded'

    return new Intl.DateTimeFormat('en-GB', {
        timeZone: HARARE_TIME_ZONE,
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    }).format(date)
}

function formatMoney(amount, currency = 'USD') {
    const value = Number(amount || 0)

    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency || 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value)
    } catch {
        return `${currency || 'USD'} ${value.toFixed(2)}`
    }
}
function formatPaymentMethod(method) {
    const labels = {
        cash: 'Cash',
        mobile_money: 'Mobile Money',
        bank_card: 'Bank Card'
    }

    return labels[method] || method || 'Not recorded'
}
function getAvailableActions(status) {
    switch (status) {
        case 'pending':
            return [
                {
                    value: 'confirmed',
                    label: 'Confirm order',
                    icon: CheckCircle2,
                    className: 'oo-action-primary'
                },
                {
                    value: 'cancelled',
                    label: 'Cancel',
                    icon: XCircle,
                    className: 'oo-action-danger'
                }
            ]

        case 'confirmed':
            return [
                {
                    value: 'preparing',
                    label: 'Start preparing',
                    icon: ChefHat,
                    className: 'oo-action-primary'
                },
                {
                    value: 'cancelled',
                    label: 'Cancel',
                    icon: XCircle,
                    className: 'oo-action-danger'
                }
            ]

        case 'preparing':
            return [
                {
                    value: 'ready',
                    label: 'Ready for collection',
                    icon: PackageCheck,
                    className: 'oo-action-success'
                },
                {
                    value: 'cancelled',
                    label: 'Cancel',
                    icon: XCircle,
                    className: 'oo-action-danger'
                }
            ]

        case 'ready':
            return [
                {
                    value: 'cancelled',
                    label: 'Cancel order',
                    icon: XCircle,
                    className: 'oo-action-danger'
                }
            ]

        default:
            return []
    }
}

function isReservationExpired(order) {
    if (order.order_status !== 'pending' || !order.reservation_expires_at) {
        return false
    }

    return new Date(order.reservation_expires_at).getTime() <= Date.now()
}

function OrderStatus({ status }) {
    const meta = STATUS_META[status] || {
        label: status || 'Unknown',
        className: ''
    }

    return (
        <span className={`oo-status ${meta.className}`}>
            {meta.label}
        </span>
    )
}

function OrderCard({ order, onUpdateStatus, updatingId }) {
    const [expanded, setExpanded] = useState(true)

    const items = Array.isArray(order.online_order_items)
        ? [...order.online_order_items].sort((a, b) =>
            new Date(a.created_at || 0) - new Date(b.created_at || 0)
        )
        : []

    const actions = getAvailableActions(order.order_status)
    const expiredReservation = isReservationExpired(order)
    const isUpdating = updatingId === order.id

    return (
        <article className="oo-order-card">
            <div className="oo-order-top">
                <div className="oo-order-reference">
                    <span className="oo-reference-label">Order reference</span>
                    <strong>{order.order_reference}</strong>
                    <OrderStatus status={order.order_status} />
                </div>

                <button
                    type="button"
                    className="oo-expand-button"
                    onClick={() => setExpanded(value => !value)}
                >
                    {expanded ? 'Hide details' : 'View details'}
                </button>
            </div>

            <div className="oo-customer-grid">
                <div className="oo-info-item">
                    <UserRound size={16} />
                    <div>
                        <span>Customer</span>
                        <strong>{order.customer_name}</strong>
                    </div>
                </div>

                <div className="oo-info-item">
                    <Phone size={16} />
                    <div>
                        <span>Phone</span>
                        <a href={`tel:${order.customer_phone}`}>
                            {order.customer_phone}
                        </a>
                    </div>
                </div>

                {order.customer_email && (
                    <div className="oo-info-item">
                        <Mail size={16} />
                        <div>
                            <span>Email</span>
                            <a href={`mailto:${order.customer_email}`}>
                                {order.customer_email}
                            </a>
                        </div>
                    </div>
                )}

                <div className="oo-info-item">
                    <CalendarDays size={16} />
                    <div>
                        <span>Placed</span>
                        <strong>{formatDateTime(order.placed_at || order.created_at)}</strong>
                    </div>
                </div>

                <div className="oo-info-item">
                    <Clock3 size={16} />
                    <div>
                        <span>Expected collection</span>
                        <strong>{formatDateTime(order.expected_collection_at)}</strong>
                    </div>
                </div>

                {order.order_status === 'pending' && order.reservation_expires_at && (
                    <div className={`oo-info-item ${expiredReservation ? 'oo-expired-warning' : ''}`}>
                        <AlertCircle size={16} />
                        <div>
                            <span>Reservation expires</span>
                            <strong>{formatDateTime(order.reservation_expires_at)}</strong>
                        </div>
                    </div>
                )}

                {order.order_status === 'collected' && (
                    <div className="oo-info-item">
                        <CheckCircle2 size={16} />
                        <div>
                            <span>Collected</span>
                            <strong>{formatDateTime(order.collected_at)}</strong>
                        </div>
                    </div>
                )}
            </div>

            {expiredReservation && (
                <div className="oo-warning">
                    This reservation has passed its expiry time. Refresh orders to
                    check whether the database has marked it as expired.
                </div>
            )}

            {expanded && (
                <>
                    <div className="oo-items-section">
                        <h4>Order items</h4>

                        {items.length === 0 ? (
                            <p className="oo-muted">No order items were returned.</p>
                        ) : (
                            <div className="oo-items-list">
                                {items.map(item => (
                                    <div className="oo-item-row" key={item.id}>
                                        <div className="oo-item-description">
                                            <strong>{item.item_name}</strong>
                                            <span>
                                                {Number(item.quantity).toLocaleString()} {item.item_unit || ''}
                                                {' × '}
                                                {formatMoney(item.unit_price, order.currency_code)}
                                            </span>
                                        </div>

                                        <strong>
                                            {formatMoney(item.line_total, order.currency_code)}
                                        </strong>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {order.customer_notes && (
                        <div className="oo-customer-notes">
                            <strong>Customer notes</strong>
                            <p>{order.customer_notes}</p>
                        </div>
                    )}

                    <div className="oo-order-total">
                        <div>
                            <span>Payment status</span>
                            <strong>
                                {order.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
                            </strong>
                        </div>

                        <div>
                            <span>Order total</span>
                            <strong className="oo-total-amount">
                                {formatMoney(order.total_amount, order.currency_code)}
                            </strong>
                        </div>
                    </div>

                    {order.sale_id && (
                        <p className="oo-sale-note">
                            POS sale recorded for this order.
                        </p>
                    )}
                    {order.order_status === 'collected' && (
                        <div className="oo-collection-details">
                            <h4>Payment & Collection Details</h4>

                            {order.collection_sale ? (
                                <div className="oo-collection-grid">
                                    <div className="oo-collection-info">
                                        <span>Receipt number</span>
                                        <strong>
                                            {order.collection_sale.receipt_number || 'Not recorded'}
                                        </strong>
                                    </div>

                                    <div className="oo-collection-info">
                                        <span>Payment method</span>
                                        <strong>
                                            {formatPaymentMethod(
                                                order.collection_sale.payment_method
                                            )}
                                        </strong>
                                    </div>

                                    <div className="oo-collection-info">
                                        <span>Amount received</span>
                                        <strong>
                                            {formatMoney(
                                                order.collection_sale.amount_paid,
                                                order.currency_code
                                            )}
                                        </strong>
                                    </div>

                                    <div className="oo-collection-info">
                                        <span>Change given</span>
                                        <strong>
                                            {formatMoney(
                                                order.collection_sale.change_amount,
                                                order.currency_code
                                            )}
                                        </strong>
                                    </div>

                                    <div className="oo-collection-info">
                                        <span>Cashier who collected</span>
                                        <strong>
                                            {order.collection_sale.cashier_name}
                                        </strong>
                                    </div>

                                    <div className="oo-collection-info">
                                        <span>POS sale reference</span>
                                        <strong>
                                            {order.collection_sale.id}
                                        </strong>
                                    </div>
                                </div>
                            ) : (
                                <p className="oo-muted">
                                    The order is marked as collected, but its linked POS
                                    payment details could not be retrieved.
                                </p>
                            )}
                        </div>
                    )}
                </>
            )}

            {actions.length > 0 && (
                <div className="oo-actions">
                    {actions.map(action => {
                        const Icon = action.icon

                        return (
                            <button
                                type="button"
                                key={action.value}
                                className={`oo-action-button ${action.className}`}
                                disabled={isUpdating}
                                onClick={() => onUpdateStatus(order, action.value)}
                            >
                                <Icon size={16} />
                                {isUpdating ? 'Updating...' : action.label}
                            </button>
                        )
                    })}
                </div>
            )}

            {order.order_status === 'ready' && (
                <p className="oo-collection-note">
                    This order is ready. Complete payment and collection through
                    Cashier POS using the online-order collection workflow.
                </p>
            )}

            {order.order_status === 'collected' && (
                <p className="oo-collected-note">
                    This order has been collected and recorded.
                </p>
            )}
        </article>
    )
}

export default function OnlineOrders() {
    const [orders, setOrders] = useState([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState('')
    const [search, setSearch] = useState('')
    const [activeFilter, setActiveFilter] = useState('all')
    const [updatingId, setUpdatingId] = useState(null)
    const [lastUpdated, setLastUpdated] = useState(null)

    const loadOrders = useCallback(async (showRefresh = false) => {
        if (showRefresh) {
            setRefreshing(true)
        } else {
            setLoading(true)
        }

        setError('')

        try {
            const { error: expiryError } = await supabase.rpc(
                'expire_unconfirmed_online_orders'
            )

            if (expiryError) {
                console.warn('Could not expire overdue reservations:', expiryError)
            }
            const { data, error: queryError } = await supabase
                .from('online_orders')
                .select(ORDER_SELECT)
                .order('placed_at', { ascending: false })
                .limit(100)

            if (queryError) throw queryError

            const loadedOrders = data || []

            // Collect POS sale IDs for collected orders.
            const saleIds = [
                ...new Set(
                    loadedOrders
                        .filter(order => order.order_status === 'collected' && order.sale_id)
                        .map(order => order.sale_id)
                )
            ]

            let salesById = {}
            let staffById = {}
            let employeeRolesById = {}

            if (saleIds.length > 0) {
                const { data: salesData, error: salesError } = await supabase
                    .from('sales')
                    .select(`
            id,
            receipt_number,
            payment_method,
            amount_paid,
            change_amount,
            cashier_id
        `)
                    .in('id', saleIds)

                if (salesError) throw salesError

                const sales = salesData || []

                salesById = Object.fromEntries(
                    sales.map(sale => [sale.id, sale])
                )

                // Include both sale cashier IDs and order collected_by IDs.
                const cashierIds = [
                    ...new Set([
                        ...sales.map(sale => sale.cashier_id),
                        ...loadedOrders
                            .filter(order => order.order_status === 'collected')
                            .map(order => order.collected_by)
                    ].filter(Boolean))
                ]

                if (cashierIds.length > 0) {
                    const [
                        { data: staffData, error: staffError },
                        { data: rolesData, error: rolesError }
                    ] = await Promise.all([
                        supabase
                            .from('staff_members')
                            .select('user_id, full_name')
                            .in('user_id', cashierIds),

                        supabase
                            .from('employee_roles')
                            .select('user_id, display_name')
                            .in('user_id', cashierIds)
                    ])

                    if (staffError) throw staffError
                    if (rolesError) throw rolesError

                    staffById = Object.fromEntries(
                        (staffData || []).map(staff => [
                            staff.user_id,
                            staff.full_name
                        ])
                    )

                    employeeRolesById = Object.fromEntries(
                        (rolesData || []).map(employee => [
                            employee.user_id,
                            employee.display_name
                        ])
                    )
                }
            }

            // Attach the POS payment and cashier information to each order.
            const enrichedOrders = loadedOrders.map(order => {
                const sale = order.sale_id
                    ? salesById[order.sale_id] || null
                    : null

                const cashierId = sale?.cashier_id || order.collected_by

                const cashierName = cashierId
                    ? (
                        staffById[cashierId] ||
                        employeeRolesById[cashierId] ||
                        'Cashier account'
                    )
                    : 'Not recorded'

                return {
                    ...order,
                    collection_sale: sale
                        ? {
                            ...sale,
                            cashier_name: cashierName
                        }
                        : null
                }
            })

            setOrders(enrichedOrders)
            setLastUpdated(new Date())
        } catch (err) {
            console.error('Online orders load error:', err)
            setError(err.message || 'Could not load online orders.')
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }, [])

    useEffect(() => {
        loadOrders()

        const interval = setInterval(() => {
            loadOrders(true)
        }, 30000)

        return () => clearInterval(interval)
    }, [loadOrders])

    const updateOrderStatus = async (order, newStatus) => {
        const actionLabels = {
            confirmed: 'confirm this order',
            preparing: 'start preparing this order',
            ready: 'mark this order as ready for collection',
            cancelled: 'cancel this order'
        }

        const message = actionLabels[newStatus] || 'update this order'

        if (!window.confirm(`Are you sure you want to ${message}?`)) {
            return
        }

        setUpdatingId(order.id)
        setError('')

        try {
            const { error: rpcError } = await supabase.rpc(
                'update_online_order_status',
                {
                    p_order_id: order.id,
                    p_new_status: newStatus
                }
            )

            if (rpcError) throw rpcError

            await loadOrders(true)
        } catch (err) {
            console.error('Online order status update error:', err)
            setError(err.message || 'Could not update the order status.')
        } finally {
            setUpdatingId(null)
        }
    }

    const filteredOrders = useMemo(() => {
        const term = search.trim().toLowerCase()

        return orders.filter(order => {
            const matchesStatus =
                activeFilter === 'all' || order.order_status === activeFilter

            const matchesSearch =
                !term ||
                String(order.order_reference || '').toLowerCase().includes(term) ||
                String(order.customer_name || '').toLowerCase().includes(term) ||
                String(order.customer_phone || '').toLowerCase().includes(term)

            return matchesStatus && matchesSearch
        })
    }, [orders, activeFilter, search])

    const counts = useMemo(() => {
        const result = { all: orders.length }

        STATUS_OPTIONS.forEach(option => {
            if (option.value !== 'all') {
                result[option.value] = orders.filter(
                    order => order.order_status === option.value
                ).length
            }
        })

        return result
    }, [orders])

    return (
        <div className="online-orders-page">
            <div className="oo-page-header">
                <div>
                    <div className="oo-title-line">
                        <ClipboardList size={25} />
                        <h1>Online Orders</h1>
                    </div>
                    <p>Manage customer orders and prepare them for collection.</p>
                </div>

                <button
                    type="button"
                    className="oo-refresh-button"
                    onClick={() => loadOrders(true)}
                    disabled={refreshing || loading}
                >
                    <RefreshCw size={17} className={refreshing ? 'oo-spinning' : ''} />
                    {refreshing ? 'Refreshing...' : 'Refresh'}
                </button>
            </div>

            {lastUpdated && (
                <p className="oo-last-updated">
                    Last updated: {formatDateTime(lastUpdated.toISOString())} (Harare time)
                </p>
            )}

            {error && (
                <div className="oo-error-message">
                    <AlertCircle size={18} />
                    <span>{error}</span>
                </div>
            )}

            <div className="oo-summary-grid">
                <div className="oo-summary-card">
                    <span>Total loaded</span>
                    <strong>{counts.all || 0}</strong>
                </div>
                <div className="oo-summary-card">
                    <span>Pending</span>
                    <strong>{counts.pending || 0}</strong>
                </div>
                <div className="oo-summary-card">
                    <span>Preparing</span>
                    <strong>{counts.preparing || 0}</strong>
                </div>
                <div className="oo-summary-card">
                    <span>Ready for collection</span>
                    <strong>{counts.ready || 0}</strong>
                </div>
            </div>

            <div className="oo-toolbar">
                <div className="oo-search">
                    <Search size={18} />
                    <input
                        type="search"
                        placeholder="Search reference, customer or phone..."
                        value={search}
                        onChange={event => setSearch(event.target.value)}
                    />
                </div>
            </div>

            <div className="oo-filter-list">
                {STATUS_OPTIONS.map(option => (
                    <button
                        type="button"
                        key={option.value}
                        className={activeFilter === option.value ? 'active' : ''}
                        onClick={() => setActiveFilter(option.value)}
                    >
                        {option.label}
                        <span>{counts[option.value] || 0}</span>
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="oo-empty-state">
                    <RefreshCw size={25} className="oo-spinning" />
                    <p>Loading online orders...</p>
                </div>
            ) : filteredOrders.length === 0 ? (
                <div className="oo-empty-state">
                    <ClipboardList size={35} />
                    <h3>No orders found</h3>
                    <p>
                        {search || activeFilter !== 'all'
                            ? 'Try changing your search or status filter.'
                            : 'Customer orders will appear here when they are placed.'}
                    </p>
                </div>
            ) : (
                <div className="oo-orders-list">
                    {filteredOrders.map(order => (
                        <OrderCard
                            key={order.id}
                            order={order}
                            onUpdateStatus={updateOrderStatus}
                            updatingId={updatingId}
                        />
                    ))}
                </div>
            )}

            <p className="oo-footer-note">
                Online orders do not become sales when placed. Record payment,
                inventory deductions and the receipt through the cashier POS
                collection process.
            </p>
        </div>
    )
}
