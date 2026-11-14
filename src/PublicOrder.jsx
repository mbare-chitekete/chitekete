
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
    Search,
    ShoppingBag,
    ShoppingCart,
    Plus,
    Minus,
    Trash2,
    X,
    MapPin,
    Phone,
    Mail,
    Clock,
    Instagram,
    Facebook,
    MessageCircle,
    ArrowLeft,
    CheckCircle2,
    Package,
    RefreshCw,
    CalendarDays,
    Utensils,
    Share2,
    Copy,
    AlertCircle,
    Image as ImageIcon
} from 'lucide-react'
import { supabase } from './supabase'

const BUSINESS_TIME_ZONE = 'Africa/Harare'

const styles = {
    page: {
        minHeight: '100vh',
        background: '#f5f7f9',
        color: '#172b3a',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
    },
    container: {
        width: 'min(1180px, 100%)',
        margin: '0 auto',
        padding: '0 18px'
    },
    button: {
        border: 'none',
        borderRadius: 10,
        padding: '12px 17px',
        fontWeight: 700,
        cursor: 'pointer',
        fontSize: 14
    },
    primary: {
        background: '#176b50',
        color: '#fff'
    },
    secondary: {
        background: '#e8f2ed',
        color: '#176b50'
    },
    muted: {
        color: '#718096'
    },
    panel: {
        background: '#fff',
        border: '1px solid #e7edf0',
        borderRadius: 16,
        padding: 18
    },
    input: {
        width: '100%',
        boxSizing: 'border-box',
        border: '1px solid #dce4e8',
        borderRadius: 9,
        padding: '12px 13px',
        fontSize: 14,
        outlineColor: '#176b50',
        background: '#fff'
    }
}

function harareParts(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: BUSINESS_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23'
    }).formatToParts(date)

    return Object.fromEntries(
        parts
            .filter(part => part.type !== 'literal')
            .map(part => [part.type, Number(part.value)])
    )
}

function getHarareDateTimeLocal() {
    const p = harareParts()

    return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}T${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`
}

// Interpret a datetime-local value as Africa/Harare time,
// regardless of the customer's device timezone.
function harareLocalToIso(value) {
    if (!value) return null

    const match = value.match(
        /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/
    )

    if (!match) return null

    const [, y, mo, d, h, mi] = match.map(Number)

    const wallTime = Date.UTC(y, mo - 1, d, h, mi, 0)

    let utcGuess = wallTime

    for (let i = 0; i < 3; i++) {
        const p = harareParts(new Date(utcGuess))

        const representedTime = Date.UTC(
            p.year,
            p.month - 1,
            p.day,
            p.hour,
            p.minute,
            p.second
        )

        const offset = representedTime - utcGuess
        utcGuess = wallTime - offset
    }

    return new Date(utcGuess).toISOString()
}

function formatHarareDate(value, includeTime = true) {
    if (!value) return 'Not provided'

    return new Intl.DateTimeFormat('en-GB', {
        timeZone: BUSINESS_TIME_ZONE,
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        ...(includeTime
            ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }
            : {})
    }).format(new Date(value))
}

function formatTime(value) {
    if (!value) return ''

    return String(value).slice(0, 5)
}

function currencyFormatter(currency) {
    const supported = ['USD', 'ZAR', 'ZWG'].includes(currency)
        ? currency
        : 'USD'

    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: supported
    })
}

function getErrorMessage(error) {
    return error?.message || 'Something went wrong. Please try again.'
}

function normalizePhone(value) {
    return String(value || '').trim()
}

function getIsoWeekday(dateValue) {
    const date = new Date(`${dateValue}T12:00:00Z`)
    const day = date.getUTCDay()

    return day === 0 ? 7 : day
}

const STATUS_LABELS = {
    pending: 'Awaiting confirmation',
    confirmed: 'Order confirmed',
    preparing: 'Being prepared',
    ready: 'Ready for collection',
    collected: 'Collected',
    cancelled: 'Cancelled',
    expired: 'Expired'
}

const STATUS_COLORS = {
    pending: '#b7791f',
    confirmed: '#2875bd',
    preparing: '#805ad5',
    ready: '#16834d',
    collected: '#16834d',
    cancelled: '#c53030',
    expired: '#718096'
}

export default function PublicOrder() {
    const [settings, setSettings] = useState(null)
    const [menu, setMenu] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [settingsError, setSettingsError] = useState('')

    const [search, setSearch] = useState('')
    const [selectedCategory, setSelectedCategory] = useState('all')
    const [cart, setCart] = useState([])
    const [cartOpen, setCartOpen] = useState(false)

    const [checkoutOpen, setCheckoutOpen] = useState(false)
    const [customerName, setCustomerName] = useState('')
    const [customerPhone, setCustomerPhone] = useState('')
    const [customerEmail, setCustomerEmail] = useState('')
    const [customerNotes, setCustomerNotes] = useState('')
    const [collectionAt, setCollectionAt] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [checkoutError, setCheckoutError] = useState('')

    const [completedOrder, setCompletedOrder] = useState(null)

    const [trackingOpen, setTrackingOpen] = useState(false)
    const [trackingReference, setTrackingReference] = useState('')
    const [trackingPhone, setTrackingPhone] = useState('')
    const [trackingOrder, setTrackingOrder] = useState(null)
    const [trackingLoading, setTrackingLoading] = useState(false)
    const [trackingError, setTrackingError] = useState('')

    const [notice, setNotice] = useState('')

    const currency = useMemo(
        () => currencyFormatter(settings?.currency_code),
        [settings?.currency_code]
    )

    const formatMoney = useCallback(
        value => currency.format(Number(value || 0)),
        [currency]
    )

    const loadWebsite = useCallback(async () => {
        setLoading(true)
        setError('')
        setSettingsError('')

        try {
            const [settingsResult, menuResult] = await Promise.all([
                supabase.rpc('get_public_canteen_settings'),
                supabase.rpc('get_public_order_menu')
            ])

            if (settingsResult.error) {
                throw settingsResult.error
            }

            if (menuResult.error) {
                throw menuResult.error
            }

            const settingsData = Array.isArray(settingsResult.data)
                ? settingsResult.data[0]
                : settingsResult.data

            if (!settingsData) {
                throw new Error('Canteen settings are not available.')
            }

            setSettings(settingsData)
            setMenu(menuResult.data || [])
        } catch (err) {
            console.error('Public website loading failed:', err)
            setError(getErrorMessage(err))
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        loadWebsite()
    }, [loadWebsite])

    const categories = useMemo(() => {
        const unique = new Map()

        menu.forEach(item => {
            if (item.category_id && item.category_name) {
                unique.set(item.category_id, item.category_name)
            }
        })

        return Array.from(unique, ([id, name]) => ({ id, name }))
    }, [menu])

    const filteredMenu = useMemo(() => {
        const term = search.trim().toLowerCase()

        return menu.filter(item => {
            const matchesCategory =
                selectedCategory === 'all' ||
                item.category_id === selectedCategory

            const matchesSearch =
                !term ||
                item.item_name?.toLowerCase().includes(term) ||
                item.category_name?.toLowerCase().includes(term)

            return matchesCategory && matchesSearch
        })
    }, [menu, search, selectedCategory])

    const cartCount = useMemo(
        () => cart.reduce((sum, item) => sum + item.quantity, 0),
        [cart]
    )

    const cartTotal = useMemo(
        () => cart.reduce(
            (sum, item) => sum + item.quantity * Number(item.selling_price),
            0
        ),
        [cart]
    )

    const openingConfigured =
        Boolean(settings?.opening_time) &&
        Boolean(settings?.closing_time)

    const openingDays = settings?.opening_days || []

    const selectedWeekday = collectionAt
        ? getIsoWeekday(collectionAt.slice(0, 10))
        : null

    const selectedDayOpen = selectedWeekday
        ? openingDays.includes(selectedWeekday)
        : false

    const selectedTime = collectionAt
        ? collectionAt.slice(11, 16)
        : ''

    const selectedTimeValid =
        openingConfigured &&
        selectedTime >= formatTime(settings.opening_time) &&
        selectedTime < formatTime(settings.closing_time)

    const collectionValid =
        Boolean(collectionAt) &&
        Boolean(selectedDayOpen) &&
        Boolean(selectedTimeValid) &&
        Boolean(harareLocalToIso(collectionAt)) &&
        new Date(harareLocalToIso(collectionAt)) > new Date()

    function addToCart(product) {
        if (!product.available) return

        setCart(current => {
            const existing = current.find(
                item => item.menu_item_id === product.menu_item_id
            )

            if (existing) {
                return current.map(item =>
                    item.menu_item_id === product.menu_item_id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                )
            }

            return [
                ...current,
                {
                    menu_item_id: product.menu_item_id,
                    item_name: product.item_name,
                    unit: product.unit,
                    selling_price: Number(product.selling_price),
                    image_url: product.image_url,
                    quantity: 1
                }
            ]
        })

        setNotice(`${product.item_name} added to cart`)
        setTimeout(() => setNotice(''), 2200)
    }

    function changeQuantity(menuItemId, amount) {
        setCart(current =>
            current
                .map(item =>
                    item.menu_item_id === menuItemId
                        ? { ...item, quantity: item.quantity + amount }
                        : item
                )
                .filter(item => item.quantity > 0)
        )
    }

    function removeFromCart(menuItemId) {
        setCart(current =>
            current.filter(item => item.menu_item_id !== menuItemId)
        )
    }

    function openCheckout() {
        if (!cart.length) return

        setCartOpen(false)
        setCheckoutError('')
        setCheckoutOpen(true)
    }

    async function submitOrder(event) {
        event.preventDefault()
        setCheckoutError('')

        if (!cart.length) {
            setCheckoutError('Your shopping cart is empty.')
            return
        }

        if (!openingConfigured) {
            setCheckoutError(
                'The canteen collection hours have not been configured. Please contact the canteen.'
            )
            return
        }

        if (!collectionValid) {
            setCheckoutError(
                'Please select a future collection time during the canteen opening days and hours (Harare time).'
            )
            return
        }

        if (customerName.trim().length < 2) {
            setCheckoutError('Please enter your full name.')
            return
        }

        if (customerPhone.replace(/[^0-9]/g, '').length < 7) {
            setCheckoutError('Please enter a valid phone number.')
            return
        }

        if (
            customerEmail.trim() &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim())
        ) {
            setCheckoutError('Please enter a valid email address.')
            return
        }

        setSubmitting(true)

        try {
            const items = cart.map(item => ({
                menu_item_id: item.menu_item_id,
                quantity: item.quantity
            }))

            const expectedCollectionAt = harareLocalToIso(collectionAt)

            const { data, error: rpcError } = await supabase.rpc(
                'place_public_online_order_v2',
                {
                    p_customer_name: customerName.trim(),
                    p_customer_phone: normalizePhone(customerPhone),
                    p_items: items,
                    p_expected_collection_at: expectedCollectionAt,
                    p_customer_email: customerEmail.trim() || null,
                    p_customer_notes: customerNotes.trim() || null
                }
            )

            if (rpcError) throw rpcError

            const order = Array.isArray(data) ? data[0] : data

            if (!order?.order_reference) {
                throw new Error(
                    'The order was submitted but no order reference was returned. Please contact the canteen before submitting again.'
                )
            }

            setCompletedOrder({
                ...order,
                customer_name: customerName.trim(),
                customer_phone: normalizePhone(customerPhone),
                items: cart.map(item => ({ ...item })),
                expected_collection_at: order.expected_collection_at ||
                    expectedCollectionAt
            })

            setCart([])
            setCheckoutOpen(false)
            setCheckoutError('')
            setCustomerNotes('')
        } catch (err) {
            console.error('Online order submission failed:', err)
            setCheckoutError(getErrorMessage(err))
        } finally {
            setSubmitting(false)
        }
    }

    async function trackOrder(event) {
        event.preventDefault()
        setTrackingError('')
        setTrackingOrder(null)

        if (!trackingReference.trim() || !trackingPhone.trim()) {
            setTrackingError('Enter your order reference and phone number.')
            return
        }

        setTrackingLoading(true)

        try {
            const { data, error: rpcError } = await supabase.rpc(
                'track_public_online_order',
                {
                    p_order_reference: trackingReference.trim().toUpperCase(),
                    p_customer_phone: trackingPhone.trim()
                }
            )

            if (rpcError) throw rpcError

            const order = Array.isArray(data) ? data[0] : data

            if (!order) {
                setTrackingError(
                    'No matching order was found. Check your order reference and phone number.'
                )
            } else {
                setTrackingOrder(order)
            }
        } catch (err) {
            console.error('Order tracking failed:', err)
            setTrackingError(getErrorMessage(err))
        } finally {
            setTrackingLoading(false)
        }
    }

    async function copyOrderReference(reference) {
        try {
            await navigator.clipboard.writeText(reference)
            setNotice('Order reference copied')
        } catch {
            setNotice(`Your order reference is ${reference}`)
        }

        setTimeout(() => setNotice(''), 2500)
    }

    async function shareWebsite() {
        const url = window.location.origin + '/order'

        try {
            if (navigator.share) {
                await navigator.share({
                    title: settings?.business_name || 'Online Ordering',
                    text: 'Order from our canteen.',
                    url
                })
            } else if (navigator.clipboard) {
                await navigator.clipboard.writeText(url)
                setNotice('Website link copied')
                setTimeout(() => setNotice(''), 2500)
            } else {
                setNotice(url)
            }
        } catch (err) {
            if (err?.name !== 'AbortError') {
                setNotice('Unable to share the website link.')
                setTimeout(() => setNotice(''), 2500)
            }
        }
    }

    function openWhatsApp() {
        const number = String(
            settings?.business_whatsapp ||
            settings?.business_mobile_1 ||
            settings?.business_phone ||
            ''
        ).replace(/[^0-9]/g, '')

        if (!number) return

        window.open(
            `https://wa.me/${number}`,
            '_blank',
            'noopener,noreferrer'
        )
    }

    const photos = [
        settings?.website_photo_1_url,
        settings?.website_photo_2_url,
        settings?.website_photo_3_url
    ].filter(Boolean)

    const businessPhone =
        settings?.business_mobile_1 ||
        settings?.business_phone ||
        ''

    const secondPhone = settings?.business_mobile_2 || ''

    const businessName = settings?.business_name || 'Canteen'

    const status = trackingOrder?.order_status || ''

    if (loading) {
        return (
            <div style={{
                ...styles.page,
                display: 'grid',
                placeItems: 'center',
                minHeight: '100vh'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <Utensils
                        size={38}
                        color="#176b50"
                        style={{ marginBottom: 15 }}
                    />
                    <div style={{ fontWeight: 700 }}>
                        Loading {businessName}...
                    </div>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div style={{
                ...styles.page,
                display: 'grid',
                placeItems: 'center',
                padding: 20
            }}>
                <div style={{
                    ...styles.panel,
                    maxWidth: 450,
                    textAlign: 'center'
                }}>
                    <AlertCircle
                        size={42}
                        color="#c53030"
                    />
                    <h2>Unable to load the ordering website</h2>
                    <p style={styles.muted}>{error}</p>
                    <button
                        style={{ ...styles.button, ...styles.primary }}
                        onClick={loadWebsite}
                    >
                        <RefreshCw size={15} /> Try again
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div style={styles.page}>
            {/* HEADER */}
            <header style={{
                background: '#123d31',
                color: '#fff',
                padding: '15px 0'
            }}>
                <div style={{
                    ...styles.container,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 11
                    }}>
                        <div style={{
                            width: 43,
                            height: 43,
                            background: '#ffffff1c',
                            borderRadius: 12,
                            display: 'grid',
                            placeItems: 'center'
                        }}>
                            <Utensils size={23} />
                        </div>

                        <div>
                            <div style={{
                                fontWeight: 800,
                                fontSize: 18
                            }}>
                                {businessName}
                            </div>
                            <div style={{
                                fontSize: 11,
                                color: '#c9e3d7'
                            }}>
                                Online ordering
                            </div>
                        </div>
                    </div>

                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 9
                    }}>
                        <button
                            onClick={() => {
                                setTrackingOpen(true)
                                setTrackingOrder(null)
                                setTrackingError('')
                            }}
                            style={{
                                ...styles.button,
                                background: '#ffffff1c',
                                color: '#fff',
                                padding: '10px 12px'
                            }}
                        >
                            Track order
                        </button>

                        <button
                            onClick={() => setCartOpen(true)}
                            aria-label="Open shopping cart"
                            style={{
                                ...styles.button,
                                background: '#fff',
                                color: '#176b50',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 7,
                                padding: '10px 13px'
                            }}
                        >
                            <ShoppingCart size={18} />
                            <span>{cartCount}</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* BUSINESS INTRO */}
            <section style={{
                background: '#e9f2ed',
                padding: '36px 0'
            }}>
                <div style={styles.container}>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,330px),1fr))',
                        gap: 25,
                        alignItems: 'center'
                    }}>
                        <div>
                            <div style={{
                                color: '#176b50',
                                fontWeight: 800,
                                fontSize: 12,
                                textTransform: 'uppercase',
                                letterSpacing: 1.5
                            }}>
                                Welcome
                            </div>

                            <h1 style={{
                                fontSize: 'clamp(30px,5vw,46px)',
                                lineHeight: 1.12,
                                margin: '12px 0',
                                color: '#123d31'
                            }}>
                                Order from {businessName}
                            </h1>

                            <p style={{
                                color: '#52665d',
                                lineHeight: 1.7,
                                maxWidth: 500
                            }}>
                                Browse our menu, choose your favourites
                                and place your collection order online.
                            </p>

                            <div style={{
                                display: 'flex',
                                gap: 10,
                                flexWrap: 'wrap',
                                marginTop: 22
                            }}>
                                <button
                                    onClick={() =>
                                        document.getElementById('menu-section')
                                            ?.scrollIntoView({
                                                behavior: 'smooth'
                                            })
                                    }
                                    style={{
                                        ...styles.button,
                                        ...styles.primary
                                    }}
                                >
                                    Browse menu
                                </button>

                                <button
                                    onClick={shareWebsite}
                                    style={{
                                        ...styles.button,
                                        background: '#fff',
                                        color: '#176b50',
                                        display: 'flex',
                                        gap: 8,
                                        alignItems: 'center'
                                    }}
                                >
                                    <Share2 size={16} />
                                    Share website
                                </button>
                            </div>
                        </div>

                        {photos.length > 0 ? (
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: photos.length === 1
                                    ? '1fr'
                                    : 'repeat(2,minmax(0,1fr))',
                                gap: 9
                            }}>
                                {photos.map((photo, index) => (
                                    <img
                                        key={photo}
                                        src={photo}
                                        alt={`${businessName} premises ${index + 1}`}
                                        style={{
                                            width: '100%',
                                            height: 150,
                                            objectFit: 'cover',
                                            borderRadius: 14,
                                            gridColumn:
                                                photos.length === 3 &&
                                                    index === 0
                                                    ? 'span 2'
                                                    : undefined
                                        }}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div style={{
                                minHeight: 190,
                                borderRadius: 16,
                                background: '#dce9e0',
                                display: 'grid',
                                placeItems: 'center',
                                color: '#668074'
                            }}>
                                <div style={{ textAlign: 'center' }}>
                                    <ImageIcon size={36} />
                                    <p style={{ fontSize: 13 }}>
                                        Premises photos coming soon
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* CONTACT STRIP */}
            <section style={{
                background: '#fff',
                borderBottom: '1px solid #e7edf0'
            }}>
                <div style={{
                    ...styles.container,
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 20,
                    paddingTop: 15,
                    paddingBottom: 15
                }}>
                    {settings?.business_address && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 7,
                            fontSize: 13
                        }}>
                            <MapPin size={16} color="#176b50" />
                            {settings.business_address}
                        </div>
                    )}

                    {businessPhone && (
                        <a
                            href={`tel:${businessPhone}`}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 7,
                                fontSize: 13,
                                color: '#176b50',
                                textDecoration: 'none'
                            }}
                        >
                            <Phone size={16} />
                            {businessPhone}
                        </a>
                    )}

                    {secondPhone && (
                        <a
                            href={`tel:${secondPhone}`}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 7,
                                fontSize: 13,
                                color: '#176b50',
                                textDecoration: 'none'
                            }}
                        >
                            <Phone size={16} />
                            {secondPhone}
                        </a>
                    )}

                    {settings?.business_email && (
                        <a
                            href={`mailto:${settings.business_email}`}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 7,
                                fontSize: 13,
                                color: '#176b50',
                                textDecoration: 'none'
                            }}
                        >
                            <Mail size={16} />
                            {settings.business_email}
                        </a>
                    )}
                </div>
            </section>

            {/* MAIN MENU */}
            <main
                id="menu-section"
                style={{ ...styles.container, paddingTop: 32, paddingBottom: 55 }}
            >
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'end',
                    gap: 15,
                    flexWrap: 'wrap'
                }}>
                    <div>
                        <h2 style={{
                            fontSize: 27,
                            margin: '0 0 6px'
                        }}>
                            Our menu
                        </h2>
                        <p style={{
                            ...styles.muted,
                            margin: 0,
                            fontSize: 14
                        }}>
                            Choose your products and add them to your cart.
                        </p>
                    </div>

                    <button
                        onClick={loadWebsite}
                        style={{
                            ...styles.button,
                            ...styles.secondary,
                            display: 'flex',
                            gap: 7,
                            alignItems: 'center'
                        }}
                    >
                        <RefreshCw size={15} />
                        Refresh menu
                    </button>
                </div>

                {/* SEARCH */}
                <div style={{
                    position: 'relative',
                    marginTop: 23,
                    maxWidth: 500
                }}>
                    <Search
                        size={18}
                        style={{
                            position: 'absolute',
                            left: 13,
                            top: 13,
                            color: '#82919a'
                        }}
                    />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search food or products..."
                        style={{
                            ...styles.input,
                            paddingLeft: 42
                        }}
                    />
                </div>

                {/* CATEGORIES */}
                <div style={{
                    display: 'flex',
                    gap: 9,
                    overflowX: 'auto',
                    padding: '18px 0'
                }}>
                    <button
                        onClick={() => setSelectedCategory('all')}
                        style={{
                            ...styles.button,
                            whiteSpace: 'nowrap',
                            background: selectedCategory === 'all'
                                ? '#176b50'
                                : '#fff',
                            color: selectedCategory === 'all'
                                ? '#fff'
                                : '#52665d'
                        }}
                    >
                        All products
                    </button>

                    {categories.map(category => (
                        <button
                            key={category.id}
                            onClick={() => setSelectedCategory(category.id)}
                            style={{
                                ...styles.button,
                                whiteSpace: 'nowrap',
                                background:
                                    selectedCategory === category.id
                                        ? '#176b50'
                                        : '#fff',
                                color:
                                    selectedCategory === category.id
                                        ? '#fff'
                                        : '#52665d'
                            }}
                        >
                            {category.name}
                        </button>
                    ))}
                </div>

                {/* PRODUCT GRID */}
                {filteredMenu.length === 0 ? (
                    <div style={{
                        ...styles.panel,
                        textAlign: 'center',
                        padding: 45
                    }}>
                        <ShoppingBag size={35} color="#9aabb3" />
                        <h3>No products found</h3>
                        <p style={styles.muted}>
                            Try another search or category.
                        </p>
                    </div>
                ) : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns:
                            'repeat(auto-fill,minmax(min(100%,220px),1fr))',
                        gap: 17
                    }}>
                        {filteredMenu.map(product => {
                            const inCart = cart.find(
                                item => item.menu_item_id === product.menu_item_id
                            )

                            return (
                                <article
                                    key={product.menu_item_id}
                                    style={{
                                        background: '#fff',
                                        border: '1px solid #e7edf0',
                                        borderRadius: 15,
                                        overflow: 'hidden',
                                        display: 'flex',
                                        flexDirection: 'column'
                                    }}
                                >
                                    <div style={{
                                        height: 165,
                                        background: '#edf2ef',
                                        position: 'relative'
                                    }}>
                                        {product.image_url ? (
                                            <img
                                                src={product.image_url}
                                                alt={product.item_name}
                                                loading="lazy"
                                                style={{
                                                    width: '100%',
                                                    height: '100%',
                                                    objectFit: 'cover'
                                                }}
                                            />
                                        ) : (
                                            <div style={{
                                                height: '100%',
                                                display: 'grid',
                                                placeItems: 'center',
                                                color: '#8ba197'
                                            }}>
                                                <Utensils size={35} />
                                            </div>
                                        )}

                                        {!product.available && (
                                            <span style={{
                                                position: 'absolute',
                                                top: 10,
                                                right: 10,
                                                background: '#b83232',
                                                color: '#fff',
                                                borderRadius: 6,
                                                padding: '5px 8px',
                                                fontSize: 11,
                                                fontWeight: 700
                                            }}>
                                                Unavailable
                                            </span>
                                        )}
                                    </div>

                                    <div style={{
                                        padding: 14,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        flex: 1
                                    }}>
                                        <div style={{
                                            fontSize: 11,
                                            color: '#718096',
                                            marginBottom: 6
                                        }}>
                                            {product.category_name || 'Menu'}
                                        </div>

                                        <h3 style={{
                                            margin: '0 0 5px',
                                            fontSize: 16
                                        }}>
                                            {product.item_name}
                                        </h3>

                                        <div style={{
                                            color: '#718096',
                                            fontSize: 12
                                        }}>
                                            Per {product.unit}
                                        </div>

                                        <div style={{
                                            marginTop: 'auto',
                                            paddingTop: 14,
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            gap: 8
                                        }}>
                                            <strong style={{
                                                color: '#176b50',
                                                fontSize: 16
                                            }}>
                                                {formatMoney(product.selling_price)}
                                            </strong>

                                            <button
                                                disabled={!product.available}
                                                onClick={() => addToCart(product)}
                                                style={{
                                                    ...styles.button,
                                                    ...styles.primary,
                                                    padding: '9px 11px',
                                                    opacity: product.available ? 1 : 0.45,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 5
                                                }}
                                            >
                                                <Plus size={15} />
                                                {inCart ? inCart.quantity : 'Add'}
                                            </button>
                                        </div>
                                    </div>
                                </article>
                            )
                        })}
                    </div>
                )}

                {/* COLLECTION INFORMATION */}
                <section style={{
                    ...styles.panel,
                    marginTop: 32
                }}>
                    <h3 style={{
                        marginTop: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 9
                    }}>
                        <Clock size={20} color="#176b50" />
                        Collection information
                    </h3>

                    {openingConfigured ? (
                        <>
                            <p style={{
                                color: '#52665d',
                                fontSize: 14
                            }}>
                                Opening hours: {formatTime(settings.opening_time)}
                                {' '}–{' '}
                                {formatTime(settings.closing_time)}
                            </p>

                            <p style={{
                                color: '#718096',
                                fontSize: 12
                            }}>
                                Business timezone: Africa/Harare (Zimbabwe).
                                Orders must be collected on an open day.
                            </p>
                        </>
                    ) : (
                        <p style={{
                            color: '#b7791f',
                            fontSize: 14
                        }}>
                            Collection hours have not yet been configured.
                            Please contact the canteen.
                        </p>
                    )}
                </section>
            </main>

            {/* FOOTER */}
            <footer style={{
                background: '#123d31',
                color: '#fff',
                padding: '32px 0'
            }}>
                <div style={styles.container}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 20,
                        flexWrap: 'wrap'
                    }}>
                        <div>
                            <h3 style={{ marginTop: 0 }}>
                                {businessName}
                            </h3>

                            {settings?.business_address && (
                                <p style={{
                                    color: '#c9e3d7',
                                    fontSize: 13
                                }}>
                                    <MapPin size={14} />
                                    {' '}{settings.business_address}
                                </p>
                            )}

                            {settings?.google_maps_url && (
                                <a
                                    href={settings.google_maps_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{
                                        color: '#c9e3d7',
                                        fontSize: 13
                                    }}
                                >
                                    View location on Google Maps
                                </a>
                            )}
                        </div>

                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12
                        }}>
                            {settings?.business_whatsapp ||
                                settings?.business_mobile_1 ||
                                settings?.business_phone ? (
                                <button
                                    onClick={openWhatsApp}
                                    style={{
                                        ...styles.button,
                                        background: '#207b52',
                                        color: '#fff',
                                        display: 'flex',
                                        gap: 7,
                                        alignItems: 'center'
                                    }}
                                >
                                    <MessageCircle size={17} />
                                    WhatsApp
                                </button>
                            ) : null}

                            {settings?.instagram_url && (
                                <a
                                    href={settings.instagram_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    aria-label="Instagram"
                                    style={{ color: '#fff' }}
                                >
                                    <Instagram size={23} />
                                </a>
                            )}

                            {settings?.facebook_url && (
                                <a
                                    href={settings.facebook_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    aria-label="Facebook"
                                    style={{ color: '#fff' }}
                                >
                                    <Facebook size={23} />
                                </a>
                            )}
                        </div>
                    </div>

                    <div style={{
                        borderTop: '1px solid #ffffff25',
                        marginTop: 25,
                        paddingTop: 18,
                        color: '#c9e3d7',
                        fontSize: 12
                    }}>
                        © {new Date().getFullYear()} {businessName}.
                        All rights reserved.
                        <span style={{ float: 'right' }}>
                            Collection orders only
                        </span>
                    </div>
                </div>
            </footer>

            {/* CART DRAWER */}
            {cartOpen && (
                <div
                    onClick={() => setCartOpen(false)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 50,
                        background: '#0008',
                        display: 'flex',
                        justifyContent: 'flex-end'
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            width: 'min(440px,100%)',
                            height: '100%',
                            overflowY: 'auto',
                            background: '#fff',
                            padding: 20,
                            boxSizing: 'border-box'
                        }}
                    >
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <h2>Your cart ({cartCount})</h2>
                            <button
                                onClick={() => setCartOpen(false)}
                                style={{
                                    ...styles.button,
                                    ...styles.secondary
                                }}
                            >
                                <X size={19} />
                            </button>
                        </div>

                        {cart.length === 0 ? (
                            <p style={styles.muted}>
                                Your cart is empty.
                            </p>
                        ) : (
                            <>
                                {cart.map(item => (
                                    <div
                                        key={item.menu_item_id}
                                        style={{
                                            display: 'flex',
                                            gap: 12,
                                            padding: '14px 0',
                                            borderBottom: '1px solid #e7edf0'
                                        }}
                                    >
                                        {item.image_url ? (
                                            <img
                                                src={item.image_url}
                                                alt=""
                                                style={{
                                                    width: 65,
                                                    height: 65,
                                                    objectFit: 'cover',
                                                    borderRadius: 9
                                                }}
                                            />
                                        ) : (
                                            <div style={{
                                                width: 65,
                                                height: 65,
                                                background: '#edf2ef',
                                                borderRadius: 9,
                                                display: 'grid',
                                                placeItems: 'center'
                                            }}>
                                                <Utensils size={22} />
                                            </div>
                                        )}

                                        <div style={{ flex: 1 }}>
                                            <strong>{item.item_name}</strong>
                                            <div style={{
                                                fontSize: 12,
                                                color: '#718096',
                                                marginTop: 4
                                            }}>
                                                {formatMoney(item.selling_price)}
                                            </div>

                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 12,
                                                marginTop: 9
                                            }}>
                                                <button
                                                    onClick={() => changeQuantity(
                                                        item.menu_item_id, -1
                                                    )}
                                                    style={{
                                                        ...styles.button,
                                                        ...styles.secondary,
                                                        padding: 6
                                                    }}
                                                >
                                                    <Minus size={14} />
                                                </button>

                                                <strong>{item.quantity}</strong>

                                                <button
                                                    onClick={() => changeQuantity(
                                                        item.menu_item_id, 1
                                                    )}
                                                    style={{
                                                        ...styles.button,
                                                        ...styles.secondary,
                                                        padding: 6
                                                    }}
                                                >
                                                    <Plus size={14} />
                                                </button>

                                                <button
                                                    onClick={() => removeFromCart(
                                                        item.menu_item_id
                                                    )}
                                                    style={{
                                                        ...styles.button,
                                                        background: '#fff0f0',
                                                        color: '#c53030',
                                                        padding: 6
                                                    }}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>

                                        <strong>
                                            {formatMoney(
                                                item.quantity * item.selling_price
                                            )}
                                        </strong>
                                    </div>
                                ))}

                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    padding: '20px 0',
                                    fontSize: 18
                                }}>
                                    <strong>Total</strong>
                                    <strong style={{ color: '#176b50' }}>
                                        {formatMoney(cartTotal)}
                                    </strong>
                                </div>

                                <button
                                    onClick={openCheckout}
                                    style={{
                                        ...styles.button,
                                        ...styles.primary,
                                        width: '100%',
                                        padding: 15
                                    }}
                                >
                                    Continue to checkout
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* CHECKOUT */}
            {checkoutOpen && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 60,
                    background: '#0009',
                    display: 'grid',
                    placeItems: 'center',
                    padding: 12
                }}>
                    <div style={{
                        width: 'min(560px,100%)',
                        maxHeight: '94vh',
                        overflowY: 'auto',
                        background: '#fff',
                        borderRadius: 16,
                        padding: 22,
                        boxSizing: 'border-box'
                    }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <h2>Checkout</h2>
                            <button
                                onClick={() => setCheckoutOpen(false)}
                                style={{
                                    ...styles.button,
                                    ...styles.secondary
                                }}
                            >
                                <X size={19} />
                            </button>
                        </div>

                        <div style={{
                            background: '#e9f2ed',
                            borderRadius: 10,
                            padding: 13,
                            marginBottom: 18
                        }}>
                            <strong>Collection order</strong>
                            <p style={{
                                margin: '5px 0 0',
                                fontSize: 12,
                                color: '#52665d'
                            }}>
                                Pay at the canteen when collecting your order.
                                No delivery or online payment is available.
                            </p>
                        </div>

                        <form onSubmit={submitOrder}>
                            <div style={{
                                display: 'grid',
                                gap: 13
                            }}>
                                <label>
                                    <span style={{
                                        display: 'block',
                                        fontSize: 13,
                                        fontWeight: 700,
                                        marginBottom: 6
                                    }}>
                                        Full name *
                                    </span>
                                    <input
                                        required
                                        minLength={2}
                                        maxLength={100}
                                        value={customerName}
                                        onChange={e => setCustomerName(e.target.value)}
                                        placeholder="Enter your name"
                                        style={styles.input}
                                    />
                                </label>

                                <label>
                                    <span style={{
                                        display: 'block',
                                        fontSize: 13,
                                        fontWeight: 700,
                                        marginBottom: 6
                                    }}>
                                        Phone number *
                                    </span>
                                    <input
                                        required
                                        value={customerPhone}
                                        onChange={e => setCustomerPhone(e.target.value)}
                                        placeholder="Enter your phone number"
                                        style={styles.input}
                                    />
                                </label>

                                <label>
                                    <span style={{
                                        display: 'block',
                                        fontSize: 13,
                                        fontWeight: 700,
                                        marginBottom: 6
                                    }}>
                                        Email (optional)
                                    </span>
                                    <input
                                        type="email"
                                        value={customerEmail}
                                        onChange={e => setCustomerEmail(e.target.value)}
                                        placeholder="your@email.com"
                                        style={styles.input}
                                    />
                                </label>

                                <label>
                                    <span style={{
                                        display: 'block',
                                        fontSize: 13,
                                        fontWeight: 700,
                                        marginBottom: 6
                                    }}>
                                        Expected collection date and time *
                                    </span>
                                    <input
                                        type="datetime-local"
                                        required
                                        min={getHarareDateTimeLocal()}
                                        value={collectionAt}
                                        onChange={e => setCollectionAt(e.target.value)}
                                        style={styles.input}
                                    />
                                    <small style={{
                                        display: 'block',
                                        marginTop: 6,
                                        color: '#718096'
                                    }}>
                                        All times are Africa/Harare time (Zimbabwe).
                                    </small>
                                </label>

                                {collectionAt && (
                                    <div style={{
                                        padding: 11,
                                        background: collectionValid
                                            ? '#e8f5ed'
                                            : '#fff6e5',
                                        borderRadius: 9,
                                        fontSize: 12,
                                        color: collectionValid
                                            ? '#176b50'
                                            : '#9c6817'
                                    }}>
                                        {collectionValid
                                            ? `Collection time: ${formatHarareDate(harareLocalToIso(collectionAt))}`
                                            : !selectedDayOpen
                                                ? 'The canteen is closed on this day.'
                                                : !selectedTimeValid
                                                    ? `Choose a time from ${formatTime(settings?.opening_time)} to before ${formatTime(settings?.closing_time)}.`
                                                    : 'Choose a future collection time.'
                                        }
                                    </div>
                                )}

                                <label>
                                    <span style={{
                                        display: 'block',
                                        fontSize: 13,
                                        fontWeight: 700,
                                        marginBottom: 6
                                    }}>
                                        Order notes (optional)
                                    </span>
                                    <textarea
                                        value={customerNotes}
                                        onChange={e => setCustomerNotes(e.target.value)}
                                        maxLength={500}
                                        rows={3}
                                        placeholder="Any additional information..."
                                        style={{
                                            ...styles.input,
                                            resize: 'vertical'
                                        }}
                                    />
                                </label>
                            </div>

                            <div style={{
                                marginTop: 18,
                                padding: 14,
                                background: '#f5f7f9',
                                borderRadius: 10
                            }}>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between'
                                }}>
                                    <span>Items ({cartCount})</span>
                                    <strong>{formatMoney(cartTotal)}</strong>
                                </div>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    marginTop: 9,
                                    fontSize: 18
                                }}>
                                    <strong>Total</strong>
                                    <strong style={{ color: '#176b50' }}>
                                        {formatMoney(cartTotal)}
                                    </strong>
                                </div>
                            </div>

                            {checkoutError && (
                                <div style={{
                                    color: '#b83232',
                                    background: '#fff0f0',
                                    padding: 12,
                                    borderRadius: 8,
                                    marginTop: 14,
                                    fontSize: 13
                                }}>
                                    {checkoutError}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={
                                    submitting ||
                                    !openingConfigured ||
                                    !collectionValid
                                }
                                style={{
                                    ...styles.button,
                                    ...styles.primary,
                                    width: '100%',
                                    padding: 15,
                                    marginTop: 16,
                                    opacity:
                                        submitting ||
                                            !openingConfigured ||
                                            !collectionValid
                                            ? 0.5
                                            : 1
                                }}
                            >
                                {submitting
                                    ? 'Submitting order...'
                                    : 'Place collection order'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* ORDER SUCCESS */}
            {completedOrder && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 70,
                    background: '#0009',
                    display: 'grid',
                    placeItems: 'center',
                    padding: 15
                }}>
                    <div style={{
                        width: 'min(460px,100%)',
                        background: '#fff',
                        borderRadius: 18,
                        padding: 25,
                        textAlign: 'center',
                        boxSizing: 'border-box'
                    }}>
                        <CheckCircle2
                            size={55}
                            color="#16834d"
                        />

                        <h2>Order submitted!</h2>

                        <p style={{
                            color: '#718096',
                            fontSize: 14
                        }}>
                            Thank you, {completedOrder.customer_name}.
                            Your order has been received and is awaiting confirmation.
                        </p>

                        <div style={{
                            background: '#e9f2ed',
                            borderRadius: 12,
                            padding: 18,
                            margin: '20px 0'
                        }}>
                            <div style={{
                                fontSize: 12,
                                color: '#52665d'
                            }}>
                                Your order reference
                            </div>

                            <div style={{
                                fontSize: 23,
                                fontWeight: 900,
                                color: '#176b50',
                                margin: '8px 0'
                            }}>
                                {completedOrder.order_reference}
                            </div>

                            <button
                                onClick={() => copyOrderReference(
                                    completedOrder.order_reference
                                )}
                                style={{
                                    ...styles.button,
                                    ...styles.secondary
                                }}
                            >
                                <Copy size={14} /> Copy reference
                            </button>
                        </div>

                        <div style={{
                            textAlign: 'left',
                            fontSize: 13,
                            lineHeight: 1.9
                        }}>
                            <div>
                                <strong>Total:</strong>{' '}
                                {formatMoney(completedOrder.total_amount)}
                            </div>
                            <div>
                                <strong>Status:</strong> Awaiting confirmation
                            </div>
                            <div>
                                <strong>Expected collection:</strong>{' '}
                                {formatHarareDate(
                                    completedOrder.expected_collection_at
                                )}
                            </div>
                            <div>
                                <strong>Reservation expires:</strong>{' '}
                                {formatHarareDate(
                                    completedOrder.reservation_expires_at
                                )}
                            </div>
                        </div>

                        <p style={{
                            fontSize: 12,
                            color: '#718096',
                            marginTop: 16
                        }}>
                            Save your reference and use it together with
                            your phone number to track your order.
                        </p>

                        <button
                            onClick={() => {
                                setTrackingReference(
                                    completedOrder.order_reference
                                )
                                setTrackingPhone(
                                    completedOrder.customer_phone
                                )
                                setCompletedOrder(null)
                                setTrackingOpen(true)
                            }}
                            style={{
                                ...styles.button,
                                ...styles.primary,
                                width: '100%',
                                marginTop: 10
                            }}
                        >
                            Track this order
                        </button>

                        <button
                            onClick={() => setCompletedOrder(null)}
                            style={{
                                ...styles.button,
                                background: '#f1f4f5',
                                color: '#52665d',
                                width: '100%',
                                marginTop: 9
                            }}
                        >
                            Continue browsing
                        </button>
                    </div>
                </div>
            )}

            {/* TRACK ORDER */}
            {trackingOpen && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 80,
                    background: '#0009',
                    display: 'grid',
                    placeItems: 'center',
                    padding: 15
                }}>
                    <div style={{
                        width: 'min(460px,100%)',
                        maxHeight: '92vh',
                        overflowY: 'auto',
                        background: '#fff',
                        borderRadius: 16,
                        padding: 23,
                        boxSizing: 'border-box'
                    }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <h2>Track your order</h2>
                            <button
                                onClick={() => setTrackingOpen(false)}
                                style={{
                                    ...styles.button,
                                    ...styles.secondary
                                }}
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form
                            onSubmit={trackOrder}
                            style={{
                                display: 'grid',
                                gap: 13
                            }}
                        >
                            <label>
                                <span style={{
                                    display: 'block',
                                    fontSize: 13,
                                    fontWeight: 700,
                                    marginBottom: 6
                                }}>
                                    Order reference
                                </span>
                                <input
                                    required
                                    value={trackingReference}
                                    onChange={e =>
                                        setTrackingReference(e.target.value)
                                    }
                                    placeholder="MBC-YYYYMMDD-XXXXXXXX"
                                    style={styles.input}
                                />
                            </label>

                            <label>
                                <span style={{
                                    display: 'block',
                                    fontSize: 13,
                                    fontWeight: 700,
                                    marginBottom: 6
                                }}>
                                    Phone number used for ordering
                                </span>
                                <input
                                    required
                                    value={trackingPhone}
                                    onChange={e =>
                                        setTrackingPhone(e.target.value)
                                    }
                                    placeholder="Your phone number"
                                    style={styles.input}
                                />
                            </label>

                            <button
                                type="submit"
                                disabled={trackingLoading}
                                style={{
                                    ...styles.button,
                                    ...styles.primary
                                }}
                            >
                                {trackingLoading
                                    ? 'Checking...'
                                    : 'Find my order'}
                            </button>
                        </form>

                        {trackingError && (
                            <div style={{
                                background: '#fff0f0',
                                color: '#b83232',
                                padding: 12,
                                borderRadius: 8,
                                marginTop: 14,
                                fontSize: 13
                            }}>
                                {trackingError}
                            </div>
                        )}

                        {trackingOrder && (
                            <div style={{
                                marginTop: 20,
                                padding: 16,
                                borderRadius: 12,
                                background: '#f5f7f9'
                            }}>
                                <div style={{
                                    fontSize: 12,
                                    color: '#718096'
                                }}>
                                    Order reference
                                </div>

                                <strong style={{ fontSize: 18 }}>
                                    {trackingOrder.order_reference}
                                </strong>

                                <div style={{
                                    margin: '15px 0',
                                    padding: 13,
                                    background: '#fff',
                                    borderRadius: 9
                                }}>
                                    <div style={{
                                        fontSize: 11,
                                        color: '#718096'
                                    }}>
                                        Current status
                                    </div>

                                    <strong style={{
                                        color: STATUS_COLORS[status] || '#52665d',
                                        fontSize: 18
                                    }}>
                                        {STATUS_LABELS[status] || status}
                                    </strong>
                                </div>

                                <div style={{
                                    fontSize: 13,
                                    lineHeight: 1.9
                                }}>
                                    <div>
                                        <strong>Customer:</strong>{' '}
                                        {trackingOrder.customer_name}
                                    </div>
                                    <div>
                                        <strong>Total:</strong>{' '}
                                        {formatMoney(trackingOrder.total_amount)}
                                    </div>
                                    <div>
                                        <strong>Payment:</strong>{' '}
                                        {trackingOrder.payment_status}
                                    </div>
                                    <div>
                                        <strong>Order placed:</strong>{' '}
                                        {formatHarareDate(
                                            trackingOrder.created_at
                                        )}
                                    </div>
                                    <div>
                                        <strong>Last updated:</strong>{' '}
                                        {formatHarareDate(
                                            trackingOrder.updated_at
                                        )}
                                    </div>
                                </div>

                                <button
                                    onClick={trackOrder}
                                    style={{
                                        ...styles.button,
                                        ...styles.secondary,
                                        width: '100%',
                                        marginTop: 15
                                    }}
                                >
                                    <RefreshCw size={14} />
                                    Refresh status
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* FLOATING CART BUTTON */}
            {!cartOpen && !checkoutOpen && !completedOrder && cartCount > 0 && (
                <button
                    onClick={() => setCartOpen(true)}
                    style={{
                        position: 'fixed',
                        bottom: 20,
                        right: 20,
                        zIndex: 40,
                        border: 'none',
                        borderRadius: 50,
                        background: '#176b50',
                        color: '#fff',
                        padding: '15px 21px',
                        boxShadow: '0 5px 20px #0003',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10
                    }}
                >
                    <ShoppingCart size={19} />
                    {cartCount} items · {formatMoney(cartTotal)}
                </button>
            )}

            {/* NOTIFICATION */}
            {notice && (
                <div style={{
                    position: 'fixed',
                    bottom: 85,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 100,
                    background: '#123d31',
                    color: '#fff',
                    borderRadius: 10,
                    padding: '12px 18px',
                    fontSize: 13,
                    boxShadow: '0 4px 15px #0003',
                    maxWidth: '90%',
                    textAlign: 'center'
                }}>
                    {notice}
                </div>
            )}
        </div>
    )
}
