
import { useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { EscPosPrinter } from '@fedejm/capacitor-esc-pos-printer'
import {
    Search,
    ShoppingCart,
    Plus,
    Minus,
    Trash2,
    CreditCard,
    Banknote,
    Smartphone,
    ReceiptText
} from 'lucide-react'
import { supabase } from './supabase'
import { useCurrency } from './CurrencyContext'

const SUPPORTED_CURRENCIES = ['USD', 'ZAR', 'ZWG']

const CURRENCY_SYMBOLS = {
    USD: '$',
    ZAR: 'R',
    ZWG: 'ZiG'
}

function roundMoney(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}

export default function CashierPOS({ businessName }) {

    const [currentDate, setCurrentDate] = useState(() => new Date())
    function formatZimbabweTime(date) {
        return new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Africa/Harare',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hourCycle: 'h23'
        }).format(date)
    }

    function formatZimbabweDate(date) {
        return new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Africa/Harare',
            weekday: 'long',
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        }).format(date)
    }

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentDate(new Date())
        }, 1000)

        return () => clearInterval(timer)
    }, [])
    const { currencyCode: contextCurrency = 'USD' } = useCurrency()

    const [settingsCurrency, setSettingsCurrency] = useState(
        SUPPORTED_CURRENCIES.includes(contextCurrency)
            ? contextCurrency
            : 'USD'
    )

    const [exchangeRates, setExchangeRates] = useState({ USD: 1 })
    const [settingsLoaded, setSettingsLoaded] = useState(false)

    const [saleCurrencyCode, setSaleCurrencyCode] = useState(
        SUPPORTED_CURRENCIES.includes(contextCurrency)
            ? contextCurrency
            : 'USD'
    )

    const [savedBusinessName, setSavedBusinessName] = useState(
        businessName || ''
    )
    function formatMoney(value, code = 'USD') {
        const numericValue = Number(value)

        if (!Number.isFinite(numericValue)) {
            return 'Rate unavailable'
        }

        const symbol = CURRENCY_SYMBOLS[code] || `${code} `

        return `${symbol}${new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(numericValue)}`
    }

    const displayBusinessName =
        savedBusinessName.trim() ||
        businessName?.trim() ||
        'CANTEEN'

    const [menuItems, setMenuItems] = useState([])
    const [categories, setCategories] = useState([])
    const [cart, setCart] = useState([])
    const [search, setSearch] = useState('')
    const [activeCategory, setActiveCategory] = useState('All')

    const [paymentMethod, setPaymentMethod] = useState('cash')
    const [amountPaid, setAmountPaid] = useState('')

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [processing, setProcessing] = useState(false)

    const checkoutRequestId = useRef(null)

    const [successMessage, setSuccessMessage] = useState('')
    const [lastReceipt, setLastReceipt] = useState(null)
    const [receiptDetails, setReceiptDetails] = useState([])
    const [loadingReceipt, setLoadingReceipt] = useState(false)

    const [salesHistory, setSalesHistory] = useState([])
    const [loadingHistory, setLoadingHistory] = useState(false)

    // Online-order collection
    const [onlineOrderReference, setOnlineOrderReference] = useState('')
    const [onlineOrderPhone, setOnlineOrderPhone] = useState('')
    const [onlineOrder, setOnlineOrder] = useState(null)
    const [onlineOrderItems, setOnlineOrderItems] = useState([])
    const [onlineLookupLoading, setOnlineLookupLoading] = useState(false)
    const [onlinePaymentMethod, setOnlinePaymentMethod] = useState('cash')
    const [onlineAmountPaid, setOnlineAmountPaid] = useState('')
    const onlineCheckoutRequestId = useRef(null)

    const [printerType, setPrinterType] = useState('bluetooth')
    const [printerDevices, setPrinterDevices] = useState([])
    const [selectedPrinterAddress, setSelectedPrinterAddress] = useState('')
    const [printerHashKey, setPrinterHashKey] = useState('')
    const printerHashKeyRef = useRef('')

    const [printerConnected, setPrinterConnected] = useState(false)
    const [printerLoading, setPrinterLoading] = useState(false)
    const [printerError, setPrinterError] = useState('')
    const [printerMessage, setPrinterMessage] = useState('')

    // =========================================================
    // CENTRAL CURRENCY CONFIGURATION
    // =========================================================

    const baseCurrencyRate = Number(exchangeRates[settingsCurrency])
    const selectedCurrencyRate = Number(exchangeRates[saleCurrencyCode])

    const baseRateValid =
        Number.isFinite(baseCurrencyRate) && baseCurrencyRate > 0

    const saleRateValid =
        Number.isFinite(selectedCurrencyRate) && selectedCurrencyRate > 0

    const fxConfigurationValid =
        settingsLoaded &&
        baseRateValid &&
        saleRateValid


    function convertedMenuPrice(item) {
        if (!fxConfigurationValid) return NaN

        const originalPrice = Number(item.selling_price)

        if (!Number.isFinite(originalPrice)) return NaN

        return roundMoney(
            originalPrice * baseCurrencyRate / selectedCurrencyRate
        )
    }

    function getLineTotal(item) {
        const unitPrice = convertedMenuPrice(item)

        if (!Number.isFinite(unitPrice)) return NaN

        return roundMoney(Number(item.quantity) * unitPrice)
    }

    const total = roundMoney(
        cart.reduce((sum, item) => {
            const lineTotal = getLineTotal(item)

            return sum + (Number.isFinite(lineTotal) ? lineTotal : 0)
        }, 0)
    )

    const missingSaleCurrencyRate =
        settingsLoaded && !saleRateValid

    // =========================================================
    // PRINTER DISCOVERY
    // =========================================================

    async function discoverPrinters() {
        setPrinterLoading(true)
        setPrinterError('')
        setPrinterMessage('')
        setPrinterDevices([])
        setSelectedPrinterAddress('')

        try {
            if (!Capacitor.isNativePlatform()) {
                setPrinterMessage(
                    'Bluetooth and USB printer discovery is available in the Android app. Use Print Receipt to print from your browser.'
                )
                return
            }

            if (printerType === 'bluetooth') {
                const enableResult =
                    await EscPosPrinter.requestBluetoothEnable()

                if (!enableResult.value) {
                    throw new Error(
                        'Please enable Bluetooth to find printers.'
                    )
                }

                const result =
                    await EscPosPrinter.getBluetoothPrinterDevices()

                setPrinterDevices(result.devices || [])

                if (!result.devices?.length) {
                    setPrinterMessage(
                        'No paired printer devices found. Pair your printer in Android Bluetooth settings first.'
                    )
                }
            } else {
                const result =
                    await EscPosPrinter.getUsbPrinterDevices()

                setPrinterDevices(result.devices || [])

                if (!result.devices?.length) {
                    setPrinterMessage(
                        'No compatible USB printer found. Connect the printer to the Android device.'
                    )
                }
            }
        } catch (err) {
            setPrinterError(
                err.message || 'Could not discover printers.'
            )
        } finally {
            setPrinterLoading(false)
        }
    }

    function handlePrinterTypeChange(type) {
        setPrinterType(type)
        setPrinterDevices([])
        setSelectedPrinterAddress('')
        setPrinterError('')
        setPrinterMessage('')
    }

    // =========================================================
    // PRINTER CONNECTION
    // =========================================================

    async function connectPrinter() {
        if (!selectedPrinterAddress) {
            setPrinterError('Please select a printer first.')
            return
        }

        setPrinterLoading(true)
        setPrinterError('')
        setPrinterMessage('')

        let newHashKey = null

        try {
            if (printerType === 'usb') {
                const permission =
                    await EscPosPrinter.requestUsbPermission({
                        address: selectedPrinterAddress
                    })

                if (!permission.value) {
                    throw new Error(
                        'USB printer permission was not granted.'
                    )
                }
            }

            const result = await EscPosPrinter.createPrinter({
                connectionType: printerType,
                address: selectedPrinterAddress
            })

            newHashKey = result.value

            if (!newHashKey) {
                throw new Error(
                    'Could not create the printer connection.'
                )
            }

            await EscPosPrinter.connectPrinter({
                hashKey: newHashKey
            })

            setPrinterHashKey(newHashKey)
            printerHashKeyRef.current = newHashKey
            setPrinterConnected(true)
            setPrinterMessage('Printer connected successfully.')
        } catch (err) {
            if (newHashKey) {
                try {
                    await EscPosPrinter.disposePrinter({
                        hashKey: newHashKey
                    })
                } catch (disposeError) {
                    console.error(
                        'Printer cleanup failed:',
                        disposeError
                    )
                }
            }

            setPrinterHashKey('')
            setPrinterConnected(false)

            setPrinterError(
                err.message || 'Could not connect to the printer.'
            )
        } finally {
            setPrinterLoading(false)
        }
    }

    async function disconnectPrinter() {
        if (!printerHashKey) return

        setPrinterLoading(true)
        setPrinterError('')
        setPrinterMessage('Disconnecting printer...')

        const hashKey = printerHashKey

        try {
            await EscPosPrinter.disconnectPrinter({ hashKey })
            await EscPosPrinter.disposePrinter({ hashKey })

            printerHashKeyRef.current = ''

            setPrinterHashKey('')
            setPrinterConnected(false)
            setSelectedPrinterAddress('')
            setPrinterMessage('Printer disconnected successfully.')
        } catch (err) {
            setPrinterError(
                err.message || 'Could not disconnect the printer.'
            )
        } finally {
            setPrinterLoading(false)
        }
    }

    // =========================================================
    // PRINTER TEST
    // =========================================================

    async function testPrinter() {
        if (!printerConnected || !printerHashKey) {
            setPrinterError('Please connect a printer first.')
            return
        }

        setPrinterLoading(true)
        setPrinterError('')
        setPrinterMessage('')

        try {
            const testText = [
                '\x1B\x40',
                '\x1B\x61\x01',
                '\x1B\x45\x01',
                displayBusinessName,
                '\x1B\x45\x00',
                'PRINTER TEST',
                '\n',
                '\x1B\x61\x00',
                'Printer connection successful.',
                'Test print completed.',
                '\n\n\n',
                '\x1D\x56\x00'
            ].join('\n')

            await EscPosPrinter.sendToPrinter({
                hashKey: printerHashKey,
                data: textToPrinterBytes(testText),
                waitingTime: 3000
            })

            setPrinterMessage(
                'Test receipt printed successfully.'
            )
        } catch (err) {
            setPrinterError(
                err.message || 'Printer test failed.'
            )
        } finally {
            setPrinterLoading(false)
        }
    }

    function textToPrinterBytes(text) {
        return Array.from(new TextEncoder().encode(text))
    }

    // =========================================================
    // RECEIPT PRINTING
    // =========================================================

    function buildReceiptPrintText(items, receipt) {
        const width = 32
        const line = '-'.repeat(width)

        const center = text =>
            text.length >= width
                ? text.slice(0, width)
                : ' '.repeat(
                    Math.floor((width - text.length) / 2)
                ) + text

        const date = new Date(receipt.sale_datetime)

        const dateText = date.toLocaleDateString('en-GB', {
            timeZone: 'Africa/Harare'
        })

        const timeText = date.toLocaleTimeString('en-GB', {
            timeZone: 'Africa/Harare',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        })

        const receiptCurrency =
            receipt.currency_code || 'USD'

        const rows = [
            '\x1B\x40',
            '\x1B\x61\x01',
            '\x1B\x45\x01',
            displayBusinessName,
            '\x1B\x45\x00',
            'SALES RECEIPT',
            '\n',
            '\x1B\x61\x00',
            `Receipt No: ${receipt.receipt_number}`,
            `Date: ${dateText}`,
            `Time: ${timeText}`,
            `Cashier: ${receipt.cashier_name || 'Cashier'}`,
            line,
            'Description',
            'QTY       Unit price     Amount',
            line
        ]

        items.forEach(item => {
            const quantity = Number(item.quantity || 0)

            const unitPrice = formatMoney(
                item.unit_price,
                receiptCurrency
            )

            const amount = formatMoney(
                item.line_total,
                receiptCurrency
            )

            rows.push(
                String(item.item_name || 'Item'),
                `${quantity}  ${unitPrice}  ${amount}`
            )
        })

        rows.push(
            line,
            '\x1B\x45\x01',
            `TOTAL: ${formatMoney(receipt.total_amount, receiptCurrency)}`,
            '\x1B\x45\x00',
            line,
            `Payment method: ${(receipt.payment_method || '').replace('_', ' ')}`,
            `Amount paid: ${formatMoney(receipt.amount_paid, receiptCurrency)}`,
            `Change: ${formatMoney(receipt.change_amount, receiptCurrency)}`,
            '\n',
            center('THANK YOU FOR YOUR PURCHASE!'),
            center('We appreciate your support.'),
            '\n\n\n',
            '\x1D\x56\x00'
        )

        return rows.join('\n')
    }

    async function printReceipt() {
        if (!receiptDetails.length || !lastReceipt) {
            setError('Receipt details are not available.')
            return
        }

        if (!Capacitor.isNativePlatform()) {
            setPrinterMessage(
                'Bluetooth and USB printer discovery is available in the Android app. Use Print Receipt to print from your browser.'
            )

            window.print()
            return
        }

        if (!printerConnected || !printerHashKey) {
            setError(
                'Please connect a thermal printer before printing.'
            )
            return
        }

        setPrinterLoading(true)
        setPrinterError('')
        setPrinterMessage('')

        try {
            const receipt = receiptDetails[0]

            const receiptText = buildReceiptPrintText(
                receiptDetails,
                {
                    ...receipt,
                    receipt_number: lastReceipt.receipt_number
                }
            )

            await EscPosPrinter.sendToPrinter({
                hashKey: printerHashKey,
                data: textToPrinterBytes(receiptText),
                waitingTime: 3000
            })

            setPrinterMessage(
                `Receipt ${lastReceipt.receipt_number} printed successfully.`
            )
        } catch (err) {
            setPrinterError(
                err.message || 'Could not print the receipt.'
            )
        } finally {
            setPrinterLoading(false)
        }
    }

    // =========================================================
    // INITIAL LOAD AND PRINTER CLEANUP
    // =========================================================

    useEffect(() => {
        loadMenu()
        loadSalesHistory()
        loadBusinessName()
    }, [])

    useEffect(() => {
        return () => {
            const hashKey = printerHashKeyRef.current

            if (!hashKey) return

            const cleanupPrinter = async () => {
                try {
                    await EscPosPrinter.disconnectPrinter({
                        hashKey
                    })
                } catch (err) {
                    console.error(
                        'Printer disconnect failed:',
                        err
                    )
                }

                try {
                    await EscPosPrinter.disposePrinter({
                        hashKey
                    })
                } catch (err) {
                    console.error(
                        'Printer disposal failed:',
                        err
                    )
                }
            }

            cleanupPrinter()
        }
    }, [])

    // =========================================================
    // LOAD POS MENU AND SHARED STOCK
    // =========================================================

    async function loadMenu() {
        setLoading(true)
        setError('')

        try {
            const [
                { data: menuData, error: menuError },
                { data: mappingData, error: mappingError }
            ] = await Promise.all([
                supabase.rpc(
                    'cashier_retail_pos_menu_with_images'
                ),
                supabase
                    .from('menu_item_stock_mappings')
                    .select(
                        'sellable_menu_item_id, stock_menu_item_id, quantity_per_sale'
                    )
            ])

            if (menuError) throw menuError
            if (mappingError) throw mappingError

            const mappings = mappingData || []

            const visibleMenuIds = new Set(
                (menuData || []).map(item => item.menu_item_id)
            )

            const relevantMappings = mappings.filter(mapping =>
                visibleMenuIds.has(mapping.sellable_menu_item_id)
            )

            const stockItemIds = [
                ...new Set(
                    relevantMappings.map(
                        mapping => mapping.stock_menu_item_id
                    )
                )
            ]

            let stockItems = []

            if (stockItemIds.length > 0) {
                const { data, error: stockError } =
                    await supabase
                        .from('menu_items')
                        .select(
                            'id, name, current_quantity, active'
                        )
                        .in('id', stockItemIds)

                if (stockError) throw stockError

                stockItems = data || []
            }

            const stockMap = new Map(
                stockItems.map(stock => [stock.id, stock])
            )

            const mappingMap = new Map(
                relevantMappings.map(mapping => [
                    mapping.sellable_menu_item_id,
                    mapping
                ])
            )

            const enrichedMenu = (menuData || []).map(item => {
                const mapping = mappingMap.get(
                    item.menu_item_id
                )

                if (mapping) {
                    const stock = stockMap.get(
                        mapping.stock_menu_item_id
                    )

                    return {
                        ...item,
                        inventory_stock_item_id:
                            mapping.stock_menu_item_id,
                        inventory_stock_name:
                            stock?.name || item.item_name,
                        inventory_stock_quantity:
                            stock?.current_quantity == null
                                ? NaN
                                : Number(stock.current_quantity),
                        inventory_stock_verified: Boolean(
                            stock &&
                            stock.active &&
                            stock.current_quantity != null &&
                            Number.isFinite(
                                Number(stock.current_quantity)
                            )
                        ),
                        quantity_per_sale:
                            Number(mapping.quantity_per_sale || 1)
                    }
                }

                return {
                    ...item,
                    inventory_stock_item_id: item.menu_item_id,
                    inventory_stock_name: item.item_name,
                    inventory_stock_quantity:
                        item.current_quantity == null
                            ? NaN
                            : Number(item.current_quantity),
                    inventory_stock_verified:
                        item.current_quantity != null &&
                        Number.isFinite(
                            Number(item.current_quantity)
                        ),
                    quantity_per_sale: 1
                }
            })

            setMenuItems(enrichedMenu)

            setCategories([
                'All',
                ...new Set(
                    enrichedMenu
                        .map(item => item.category_name)
                        .filter(Boolean)
                )
            ])
        } catch (err) {
            console.error(
                'POS menu loading failed:',
                err
            )

            setError(
                `Could not load POS menu and shared stock: ${err.message}`
            )

            setMenuItems([])
        } finally {
            setLoading(false)
        }
    }

    // =========================================================
    // LOAD CENTRAL CURRENCY SETTINGS
    // =========================================================

    async function loadBusinessName() {
        setSettingsLoaded(false)

        try {
            const { data, error } = await supabase
                .from('canteen_settings')
                .select(
                    'business_name, currency_code, exchange_rates_to_usd'
                )
                .eq('id', true)
                .maybeSingle()

            if (error) throw error

            if (!data) {
                throw new Error(
                    'Canteen settings could not be found.'
                )
            }

            if (data.business_name?.trim()) {
                setSavedBusinessName(
                    data.business_name.trim()
                )
            }

            const configuredCurrency =
                String(data.currency_code || 'USD').toUpperCase()

            if (
                !SUPPORTED_CURRENCIES.includes(configuredCurrency)
            ) {
                throw new Error(
                    `Unsupported business currency: ${configuredCurrency}`
                )
            }

            const rawRates = data.exchange_rates_to_usd

            if (
                !rawRates ||
                typeof rawRates !== 'object' ||
                Array.isArray(rawRates)
            ) {
                throw new Error(
                    'Central exchange-rate configuration is missing or invalid.'
                )
            }

            const cleanedRates = {}

            SUPPORTED_CURRENCIES.forEach(currency => {
                if (
                    Object.prototype.hasOwnProperty.call(
                        rawRates,
                        currency
                    )
                ) {
                    const rate = Number(rawRates[currency])

                    if (Number.isFinite(rate) && rate > 0) {
                        cleanedRates[currency] = rate
                    }
                }
            })

            setSettingsCurrency(configuredCurrency)
            setExchangeRates(cleanedRates)
            setSaleCurrencyCode(configuredCurrency)

            setSettingsLoaded(true)
        } catch (err) {
            console.error(
                'Business settings loading failed:',
                err
            )

            setExchangeRates({})
            setSettingsLoaded(false)

            setError(
                `Currency settings could not load: ${err.message}`
            )
        }
    }

    // =========================================================
    // SALES HISTORY
    // =========================================================

    async function loadSalesHistory() {
        setLoadingHistory(true)

        try {
            const {
                data: sessionData,
                error: sessionError
            } = await supabase.auth.getSession()

            if (sessionError) throw sessionError

            const session = sessionData?.session
            const cashierId = session?.user?.id

            if (!cashierId) {
                throw new Error(
                    'No authenticated cashier session found. Please sign in again.'
                )
            }

            const { data, error } = await supabase.rpc(
                'cashier_pos_sales_history_v2',
                { p_limit: 100 }
            )

            if (error) throw error

            setSalesHistory(data || [])
        } catch (err) {
            console.error(
                'RECENT SALES LOADING FAILED:',
                err
            )

            setSalesHistory([])

            setError(
                `Recent Sales could not load: ${err.message}`
            )
        } finally {
            setLoadingHistory(false)
        }
    }

    // =========================================================
    // MENU FILTERING AND STOCK-BASED SORTING
    // =========================================================

    const filteredItems = menuItems.filter(item => {
        const matchesSearch = (item.item_name || '')
            .toLowerCase()
            .includes(search.toLowerCase())

        const matchesCategory =
            activeCategory === 'All' ||
            item.category_name === activeCategory

        return matchesSearch && matchesCategory
    })

    // Calculate how many complete portions can be sold
    // using the currently recorded stock quantity.
    function getAvailableMenuQuantity(item) {
        if (item.inventory_stock_verified === false) {
            return -1
        }

        const stockQuantity = Number(
            item.inventory_stock_quantity ??
            item.current_quantity
        )

        const quantityPerSale = Number(
            item.quantity_per_sale || 1
        )

        if (
            !Number.isFinite(stockQuantity) ||
            stockQuantity < 0 ||
            !Number.isFinite(quantityPerSale) ||
            quantityPerSale <= 0
        ) {
            return -1
        }

        return Math.floor(stockQuantity / quantityPerSale)
    }

    // Sort highest available quantity to lowest.
    // Items with unavailable/unverified stock appear last.
    // Equal quantities retain their original menu order.
    const sortedFilteredItems = filteredItems
        .map((item, index) => ({ item, index }))
        .sort((a, b) => {
            const quantityA = getAvailableMenuQuantity(a.item)
            const quantityB = getAvailableMenuQuantity(b.item)

            if (quantityA < 0 && quantityB >= 0) return 1
            if (quantityB < 0 && quantityA >= 0) return -1

            if (quantityA < 0 && quantityB < 0) {
                return a.index - b.index
            }

            return (
                quantityB - quantityA ||
                a.index - b.index
            )
        })
        .map(entry => entry.item)

    // =========================================================
    // CART MANAGEMENT
    // =========================================================

    function addToCart(item) {
        setCart(previous => {
            const existing = previous.find(
                row => row.menu_item_id === item.menu_item_id
            )

            if (existing) {
                return previous.map(row =>
                    row.menu_item_id === item.menu_item_id
                        ? {
                            ...row,
                            quantity: row.quantity + 1
                        }
                        : row
                )
            }

            return [
                ...previous,
                { ...item, quantity: 1 }
            ]
        })
    }

    function updateQuantity(menuItemId, change) {
        setCart(previous =>
            previous
                .map(item => {
                    if (item.menu_item_id !== menuItemId) {
                        return item
                    }

                    return {
                        ...item,
                        quantity: Math.max(
                            0,
                            item.quantity + change
                        )
                    }
                })
                .filter(item => item.quantity > 0)
        )
    }

    function removeFromCart(menuItemId) {
        setCart(previous =>
            previous.filter(
                item => item.menu_item_id !== menuItemId
            )
        )
    }

    // =========================================================
    // CURRENCY SELECTION
    // =========================================================

    function handleSaleCurrencyChange(nextCurrency) {
        if (!SUPPORTED_CURRENCIES.includes(nextCurrency)) {
            return
        }

        setSaleCurrencyCode(nextCurrency)
        setAmountPaid('')
        setError('')
    }

    // =========================================================
    // CHECKOUT
    // =========================================================

    async function handleCheckout() {
        if (processing) return

        setError('')
        setSuccessMessage('')

        if (!settingsLoaded) {
            setError(
                'Currency settings are still loading. Please wait and try again.'
            )
            return
        }

        if (!cart.length) {
            setError('Please add items to the cart.')
            return
        }

        if (!fxConfigurationValid) {
            setError(
                `A valid central exchange rate for ${saleCurrencyCode} is not configured. Ask the Owner or Manager to update exchange rates in Settings.`
            )
            return
        }

        const paid = Number(amountPaid)

        if (
            !Number.isFinite(paid) ||
            paid < total
        ) {
            setError(
                'Amount paid must be at least the total sale amount.'
            )
            return
        }

        if (
            paymentMethod !== 'cash' &&
            roundMoney(paid) !== total
        ) {
            setError(
                'Mobile money and bank/card payments must equal the exact sale total.'
            )
            return
        }

        const stockRequirements = new Map()

        cart.forEach(item => {
            const stockItemId =
                item.inventory_stock_item_id ||
                item.menu_item_id

            if (
                item.inventory_stock_verified === false ||
                !Number.isFinite(
                    Number(item.inventory_stock_quantity)
                )
            ) {
                stockRequirements.set(stockItemId, {
                    name:
                        item.inventory_stock_name ||
                        item.item_name,
                    required: Number(item.quantity),
                    available: NaN
                })

                return
            }

            const stockName =
                item.inventory_stock_name ||
                item.item_name

            const quantityPerSale =
                Number(item.quantity_per_sale || 1)

            const requiredQuantity =
                Number(item.quantity) * quantityPerSale

            const rawAvailableQuantity =
                item.inventory_stock_quantity ??
                item.current_quantity

            const availableQuantity =
                rawAvailableQuantity == null
                    ? NaN
                    : Number(rawAvailableQuantity)

            const existing =
                stockRequirements.get(stockItemId)

            if (existing) {
                if (
                    existing.available !== availableQuantity
                ) {
                    existing.available = NaN
                }

                existing.required += requiredQuantity
            } else {
                stockRequirements.set(stockItemId, {
                    name: stockName,
                    required: requiredQuantity,
                    available: availableQuantity
                })
            }
        })

        const missingStockItems =
            [...stockRequirements.values()].filter(
                item => !Number.isFinite(item.available)
            )

        if (missingStockItems.length > 0) {
            setError(
                `Could not verify stock quantities for: ${missingStockItems
                    .map(item => item.name)
                    .join(', ')
                }. Reload the POS menu before checkout.`
            )

            return
        }

        const overStockItems =
            [...stockRequirements.values()].filter(
                item => item.required > item.available
            )

        const physicallyConfirmed =
            overStockItems.length > 0

        if (physicallyConfirmed) {
            const shortageSummary = overStockItems
                .map(item => {
                    const shortage =
                        item.required - item.available

                    return (
                        `${item.name}: required ${item.required}, ` +
                        `recorded stock ${item.available}, ` +
                        `additional physical quantity confirmed ${shortage}`
                    )
                })
                .join('\n')

            const confirmed = window.confirm(
                `STOCK CONFIRMATION REQUIRED\n\n` +
                `The following shared stock quantities exceed recorded stock:\n\n` +
                `${shortageSummary}\n\n` +
                `Have you physically checked and confirmed that these products are available?\n\n` +
                `Only continue if you have verified the physical stock.`
            )

            if (!confirmed) return
        }

        if (!checkoutRequestId.current) {
            if (!globalThis.crypto?.randomUUID) {
                setError(
                    'Secure checkout request IDs are unavailable on this device.'
                )
                return
            }

            checkoutRequestId.current =
                crypto.randomUUID()
        }

        setProcessing(true)

        try {
            const { data, error: checkoutError } =
                await supabase.rpc(
                    'process_retail_pos_checkout_v2',
                    {
                        p_items: cart.map(item => ({
                            menu_item_id: item.menu_item_id,
                            quantity: item.quantity
                        })),

                        p_payment_method: paymentMethod,
                        p_amount_paid: paid,
                        p_checkout_request_id:
                            checkoutRequestId.current,
                        p_notes: null,
                        p_physical_stock_confirmed:
                            physicallyConfirmed,
                        p_currency_code: saleCurrencyCode
                    }
                )

            if (checkoutError) throw checkoutError

            const receipt =
                Array.isArray(data) ? data[0] : data

            if (
                !receipt?.sale_id ||
                !receipt?.receipt_number
            ) {
                throw new Error(
                    'The sale response was incomplete. Check Recent Sales before attempting another sale.'
                )
            }

            setLastReceipt(receipt)

            setSuccessMessage(
                `Sale completed successfully. Receipt: ${receipt.receipt_number}`
            )

            setCart([])
            setAmountPaid('')
            setPaymentMethod('cash')

            checkoutRequestId.current = null

            // Load the saved receipt.
            await loadReceipt(receipt.sale_id)

            // Automatic printing must not affect checkout success.
            if (
                Capacitor.isNativePlatform() &&
                printerConnected &&
                printerHashKey
            ) {
                try {
                    const {
                        data: savedReceipt,
                        error: receiptError
                    } = await supabase.rpc(
                        'cashier_get_pos_receipt_v2',
                        {
                            p_sale_id: receipt.sale_id
                        }
                    )

                    if (receiptError) throw receiptError

                    const rows = savedReceipt || []

                    if (!rows.length) {
                        throw new Error(
                            'Saved receipt details were not returned.'
                        )
                    }

                    const receiptText =
                        buildReceiptPrintText(
                            rows,
                            {
                                ...rows[0],
                                receipt_number:
                                    receipt.receipt_number
                            }
                        )

                    await EscPosPrinter.sendToPrinter({
                        hashKey: printerHashKey,
                        data: textToPrinterBytes(receiptText),
                        waitingTime: 3000
                    })

                    setPrinterMessage(
                        `Receipt ${receipt.receipt_number} printed successfully.`
                    )
                } catch (printError) {
                    setPrinterError(
                        `Sale saved, but automatic printing failed: ${printError.message}`
                    )
                }
            }

            try {
                await loadMenu()
            } catch (menuError) {
                console.error(
                    'Menu refresh failed:',
                    menuError
                )
            }

            try {
                await loadSalesHistory()
            } catch (historyError) {
                console.error(
                    'Sales history refresh failed:',
                    historyError
                )
            }
        } catch (err) {
            console.error('Checkout failed:', err)

            setError(
                err.message ||
                'Checkout failed. Please check Recent Sales.'
            )
        } finally {
            setProcessing(false)
        }
    }

    // =========================================================
    // RECEIPT DATA
    // =========================================================

    async function loadReceipt(saleId) {
        setLoadingReceipt(true)
        setError('')

        try {
            const { data, error: receiptError } =
                await supabase.rpc(
                    'cashier_get_pos_receipt_v2',
                    { p_sale_id: saleId }
                )

            if (receiptError) throw receiptError

            setReceiptDetails(data || [])

            if (!data?.length) {
                setError(
                    'Receipt details were not returned.'
                )
            }
        } catch (err) {
            console.error(
                'Receipt loading failed:',
                err
            )

            setReceiptDetails([])

            setError(
                `Receipt could not be loaded: ${err.message}`
            )
        } finally {
            setLoadingReceipt(false)
        }
    }

    async function handleReprint(sale) {
        setLastReceipt({
            sale_id: sale.sale_id,
            receipt_number: sale.receipt_number
        })

        await loadReceipt(sale.sale_id)
    }

    // =========================================================
    // ONLINE ORDER LOOKUP AND COLLECTION
    // =========================================================

    function normalizePhone(value) {
        return String(value || '').replace(/\\D/g, '')
    }

    async function lookupOnlineOrder() {
        if (onlineLookupLoading || processing) return

        setError('')
        setSuccessMessage('')

        const reference = onlineOrderReference.trim().toUpperCase()

        if (!reference) {
            setError('Enter the online order reference.')
            return
        }

        setOnlineLookupLoading(true)
        setOnlineOrder(null)
        setOnlineOrderItems([])
        setOnlineAmountPaid('')
        onlineCheckoutRequestId.current = null

        try {
            const { data: order, error: orderError } = await supabase
                .from('online_orders')
                .select(`
                    id,
                    order_reference,
                    customer_name,
                    customer_phone,
                    order_status,
                    payment_status,
                    currency_code,
                    total_amount,
                    reservation_expires_at,
                    expected_collection_at,
                    sale_id
                `)
                .eq('order_reference', reference)
                .maybeSingle()

            if (orderError) throw orderError

            if (!order) {
                throw new Error('No online order was found with that reference.')
            }

            const suppliedPhone = normalizePhone(onlineOrderPhone)
            if (
                suppliedPhone &&
                suppliedPhone !== normalizePhone(order.customer_phone)
            ) {
                throw new Error('The phone number does not match this online order.')
            }

            const { data: items, error: itemsError } = await supabase
                .from('online_order_items')
                .select(`
                    id,
                    item_name,
                    item_unit,
                    quantity,
                    unit_price,
                    line_total
                `)
                .eq('online_order_id', order.id)
                .order('created_at', { ascending: true })

            if (itemsError) throw itemsError

            if (!items?.length) {
                throw new Error('The order was found, but its saved item details are unavailable.')
            }

            setOnlineOrder(order)
            setOnlineOrderItems(items)
            setOnlinePaymentMethod('cash')
            setOnlineAmountPaid(String(Number(order.total_amount || 0)))

            if (
                order.order_status !== 'ready' ||
                order.payment_status !== 'unpaid' ||
                order.sale_id
            ) {
                setError(
                    `Order ${order.order_reference} is not available for collection. ` +
                    `Current status: ${order.order_status || 'unknown'} / ` +
                    `${order.payment_status || 'unknown'}.`
                )
            }
        } catch (err) {
            console.error('Online order lookup failed:', err)
            setError(err.message || 'Could not retrieve the online order.')
        } finally {
            setOnlineLookupLoading(false)
        }
    }

    async function handleOnlineOrderCollection() {
        if (processing) return

        setError('')
        setSuccessMessage('')

        if (!onlineOrder?.id || !onlineOrderItems.length) {
            setError('Look up an online order before processing collection.')
            return
        }

        if (
            onlineOrder.order_status !== 'ready' ||
            onlineOrder.payment_status !== 'unpaid' ||
            onlineOrder.sale_id
        ) {
            setError('Only ready, unpaid online orders can be collected.')
            return
        }

        const orderTotal = roundMoney(onlineOrder.total_amount)
        const paid = Number(onlineAmountPaid)

        if (!Number.isFinite(paid) || paid < orderTotal) {
            setError('Amount received must be at least the saved online-order total.')
            return
        }

        if (
            onlinePaymentMethod !== 'cash' &&
            roundMoney(paid) !== orderTotal
        ) {
            setError('Mobile money and bank/card payments must equal the exact order total.')
            return
        }

        if (!onlineCheckoutRequestId.current) {
            if (!globalThis.crypto?.randomUUID) {
                setError('Secure checkout request IDs are unavailable on this device.')
                return
            }
            onlineCheckoutRequestId.current = crypto.randomUUID()
        }

        setProcessing(true)

        try {
            const { data, error: collectionError } = await supabase.rpc(
                'process_online_order_collection_v1',
                {
                    p_order_id: onlineOrder.id,
                    p_payment_method: onlinePaymentMethod,
                    p_amount_paid: paid,
                    p_checkout_request_id: onlineCheckoutRequestId.current,
                    p_notes: `Online order ${onlineOrder.order_reference}`
                }
            )

            if (collectionError) throw collectionError

            const result = Array.isArray(data) ? data[0] : data

            if (!result?.sale_id || !result?.receipt_number) {
                throw new Error(
                    'The collection response was incomplete. Check Recent Sales and the online order before retrying.'
                )
            }

            setLastReceipt(result)
            setSuccessMessage(
                `Online order ${onlineOrder.order_reference} paid and collected successfully. ` +
                `Receipt: ${result.receipt_number}`
            )

            setOnlineOrder(previous => previous
                ? {
                    ...previous,
                    order_status: 'collected',
                    payment_status: 'paid',
                    sale_id: result.sale_id
                }
                : previous
            )
            setOnlineAmountPaid('')
            onlineCheckoutRequestId.current = null

            await loadReceipt(result.sale_id)

            // Printing is best-effort; a printer problem must not undo a saved collection.
            if (
                Capacitor.isNativePlatform() &&
                printerConnected &&
                printerHashKey
            ) {
                try {
                    const {
                        data: savedReceipt,
                        error: receiptError
                    } = await supabase.rpc(
                        'cashier_get_pos_receipt_v2',
                        { p_sale_id: result.sale_id }
                    )

                    if (receiptError) throw receiptError

                    const rows = savedReceipt || []
                    if (!rows.length) {
                        throw new Error('Saved receipt details were not returned.')
                    }

                    const receiptText = buildReceiptPrintText(
                        rows,
                        {
                            ...rows[0],
                            receipt_number: result.receipt_number
                        }
                    )

                    await EscPosPrinter.sendToPrinter({
                        hashKey: printerHashKey,
                        data: textToPrinterBytes(receiptText),
                        waitingTime: 3000
                    })

                    setPrinterMessage(
                        `Receipt ${result.receipt_number} printed successfully.`
                    )
                } catch (printError) {
                    setPrinterError(
                        `Collection saved, but automatic printing failed: ${printError.message}`
                    )
                }
            }

            await Promise.all([
                loadMenu(),
                loadSalesHistory()
            ])
        } catch (err) {
            console.error('Online order collection failed:', err)
            setError(
                err.message ||
                'Online order collection failed. Check the order and Recent Sales before retrying.'
            )
        } finally {
            setProcessing(false)
        }
    }

    // =========================================================
    // RENDER
    // =========================================================

    return (
        <div className="page-content cashier-pos-page">
            <style>{`
        .cashier-pos-page .cashier-welcome-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 16px;
            margin-bottom: 20px;
        }

        .cashier-pos-page .cashier-zimbabwe-clock {
            background: linear-gradient(135deg, #123a63, #176b45);
            color: #ffffff;
            padding: 14px 20px;
            border-radius: 12px;
            min-width: 235px;
            box-shadow: 0 5px 15px rgba(18, 58, 99, 0.15);
        }

        .cashier-pos-page .cashier-clock-label {
            display: flex;
            align-items: center;
            gap: 7px;
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 1px;
            color: #d1fae5;
        }

        .cashier-pos-page .cashier-clock-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #4ade80;
            box-shadow: 0 0 8px #4ade80;
        }

        .cashier-pos-page .cashier-clock-time {
            font-size: 30px;
            font-weight: 900;
            letter-spacing: 2px;
            line-height: 1.4;
            font-variant-numeric: tabular-nums;
        }

        .cashier-pos-page .cashier-clock-date {
            font-size: 12px;
            color: #e2e8f0;
            margin-top: 3px;
        }

        .cashier-pos-page {
            min-width: 0;
            width: 100%;
        }

        .cashier-pos-page,
        .cashier-pos-page * {
            box-sizing: border-box;
        }

        .cashier-pos-page button,
        .cashier-pos-page select,
        .cashier-pos-page input {
            min-height: 42px;
        }

        .cashier-pos-page input,
        .cashier-pos-page select {
            max-width: 100%;
            font-size: 16px;
        }

        .cashier-pos-page .cashier-product-grid {
            display: grid;
            grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
            gap: 6px;
        }

        .cashier-pos-page .cashier-product-image {
            width: 100%;
            aspect-ratio: 16 / 9;
            overflow: hidden;
            border-radius: 8px;
            background: #f1f5f9;
            margin-bottom: 9px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .cashier-pos-page .cashier-product-image img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }

        .cashier-pos-page .cashier-product-image-placeholder {
            color: #94a3b8;
            font-size: 11px;
            text-align: center;
        }

        .cashier-pos-page .cashier-product-card strong {
            display: block;
            margin-bottom: 4px;
        }

        .cashier-pos-page .cashier-category-list {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }

        .cashier-pos-page .cashier-cart-row {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) auto auto;
            align-items: center;
            gap: 10px !important;
        }

        .cashier-pos-page .cashier-cart-row button {
            min-width: 42px;
            min-height: 42px;
            padding: 8px;
        }

        .cashier-pos-page .cashier-payment-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }

        .cashier-pos-page .cashier-payment-actions button {
            min-height: 46px;
        }

        .cashier-pos-page .cashier-checkout-button {
            width: 100%;
            min-height: 50px;
            font-size: 16px;
        }

        .cashier-pos-page .cashier-table-wrap {
            width: 100%;
            max-width: 100%;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
        }

        @media (max-width: 600px) {
            .cashier-pos-page {
                padding-left: 10px !important;
                padding-right: 10px !important;
            }

            .cashier-pos-page .cashier-welcome-header {
                align-items: stretch;
            }

            .cashier-pos-page .cashier-zimbabwe-clock {
                width: 100%;
                min-width: 0;
            }

            .cashier-pos-page .cashier-clock-time {
                font-size: 27px;
            }

            .cashier-pos-page .welcome-row h1 {
                font-size: 24px;
            }

            .cashier-pos-page .welcome-row p {
                font-size: 13px;
            }

            .cashier-pos-page .cashier-mobile-panel {
                padding: 12px !important;
                margin-top: 12px !important;
            }

            .cashier-pos-page .cashier-printer-panel {
                padding: 12px !important;
            }

            .cashier-pos-page .cashier-category-list {
                flex-wrap: nowrap;
                overflow-x: auto;
                padding: 2px 0 8px;
                scrollbar-width: thin;
            }

            .cashier-pos-page .cashier-category-list button {
                flex: 0 0 auto;
                min-height: 42px;
                white-space: nowrap;
            }

            .cashier-pos-page .cashier-product-grid {
                grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
                gap: 4px;
            }

            .cashier-pos-page .cashier-product-card {
                min-width: 0;
                min-height: 110px;
                padding: 5px 3px !important;
                overflow-wrap: anywhere;
                text-align: center !important;
                border-radius: 7px !important;
            }

            .cashier-pos-page .cashier-product-image {
                aspect-ratio: 4 / 3;
                margin-bottom: 5px;
                border-radius: 5px;
            }

            .cashier-pos-page .cashier-product-image-placeholder {
                font-size: 8px;
            }

            .cashier-pos-page .cashier-product-card strong {
                display: block;
                font-size: 10px;
                line-height: 1.2;
            }

            .cashier-pos-page .cashier-product-card > div {
                font-size: 8px !important;
                line-height: 1.15;
                margin-top: 2px;
            }

            .cashier-pos-page .cashier-product-card svg {
                width: 12px;
                height: 12px;
            }

            .cashier-pos-page .cashier-cart-row {
                grid-template-columns: minmax(0, 1fr) auto;
                gap: 6px 8px !important;
            }

            .cashier-pos-page .cashier-cart-row > div:first-child {
                min-width: 0;
            }

            .cashier-pos-page .cashier-cart-row > div:nth-child(2) {
                grid-column: 2;
            }

            .cashier-pos-page .cashier-cart-row > strong {
                grid-column: 1 / -1;
                text-align: right;
            }

            .cashier-pos-page .cashier-payment-actions button {
                flex: 1 1 calc(50% - 8px);
                justify-content: center;
                padding: 10px 8px !important;
                font-size: 13px;
            }

            .cashier-pos-page .cashier-checkout-button {
                position: sticky;
                bottom: 8px;
                z-index: 3;
            }

            .cashier-pos-page .cashier-printer-panel button {
                min-height: 44px;
            }

            .cashier-pos-page .cash-pos-receipt {
                padding: 14px !important;
            }

            .cashier-pos-page table {
                min-width: 560px;
            }
        }

        @media (max-width: 360px) {
            .cashier-pos-page .cashier-product-grid {
                grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
                gap: 3px;
            }

            .cashier-pos-page .cashier-product-card {
                min-height: 110px;
                padding: 4px 2px !important;
            }

            .cashier-pos-page .cashier-product-card strong {
                font-size: 9px;
            }

            .cashier-pos-page .cashier-cart-row button {
                min-width: 38px;
                min-height: 40px;
            }
        }

        @media print {
            @page {
                size: auto;
                margin: 2mm;
            }

            body * {
                visibility: hidden !important;
            }

            .cashier-pos-page .cash-pos-receipt,
            .cashier-pos-page .cash-pos-receipt * {
                visibility: visible !important;
            }

            .cashier-pos-page .cash-pos-receipt {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                max-width: 74mm !important;
                margin: 0 !important;
                padding: 2mm !important;
                border: none !important;
                box-shadow: none !important;
                background: white !important;
                color: black !important;
                overflow: visible !important;
            }

            .cashier-pos-page .cash-pos-receipt table {
                width: 100% !important;
                min-width: 0 !important;
                table-layout: fixed !important;
                font-size: 9px !important;
            }

            .cashier-pos-page .cash-pos-receipt th,
            .cashier-pos-page .cash-pos-receipt td {
                padding: 5px 2px !important;
                overflow-wrap: anywhere !important;
            }

            .cashier-pos-page .receipt-print-actions {
                display: none !important;
            }
        }
    `}</style>

            {/* Keep the rest of your existing POS dashboard JSX here.
        Replace only the existing welcome-row with the updated header below. */}

            <div className="welcome-row cashier-welcome-header">
                <div>
                    <div className="eyebrow">SALES / POINT OF SALE</div>
                    <h1>Cashier POS</h1>
                    <p>{displayBusinessName} · Quick sales and checkout</p>
                </div>

                <div className="cashier-zimbabwe-clock">
                    <div className="cashier-clock-label">
                        <span className="cashier-clock-dot" />
                        ZIMBABWE TIME · CAT (UTC+2)
                    </div>

                    <div className="cashier-clock-time">
                        {formatZimbabweTime(currentDate)}
                    </div>

                    <div className="cashier-clock-date">
                        {formatZimbabweDate(currentDate)}
                    </div>
                </div>
            </div>

            {/* PRINTER PANEL */}

            <div
                className="cashier-printer-panel"
                style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '16px',
                    marginBottom: '20px'
                }}
            >
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px'
                }}>
                    <div>
                        <h3 style={{
                            margin: 0,
                            fontSize: '16px',
                            color: '#162b42'
                        }}>
                            Thermal Printer
                        </h3>

                        <p style={{
                            margin: '5px 0 0',
                            fontSize: '13px',
                            color: '#64748b'
                        }}>
                            {printerConnected
                                ? 'Printer connected'
                                : 'No printer connected'}
                        </p>
                    </div>

                    <span style={{
                        padding: '6px 10px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: printerConnected ? '#166534' : '#92400e',
                        background: printerConnected ? '#dcfce7' : '#fef3c7'
                    }}>
                        {printerConnected ? 'Connected' : 'Disconnected'}
                    </span>
                </div>

                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '10px',
                    marginTop: '14px'
                }}>
                    <button
                        type="button"
                        onClick={() => handlePrinterTypeChange('bluetooth')}
                        disabled={printerLoading || printerConnected}
                        style={{
                            padding: '9px 13px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            background: printerType === 'bluetooth' ? '#eaf2ff' : '#fff',
                            color: '#162b42',
                            cursor: 'pointer'
                        }}
                    >
                        Bluetooth
                    </button>

                    <button
                        type="button"
                        onClick={() => handlePrinterTypeChange('usb')}
                        disabled={printerLoading || printerConnected}
                        style={{
                            padding: '9px 13px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            background: printerType === 'usb' ? '#eaf2ff' : '#fff',
                            color: '#162b42',
                            cursor: 'pointer'
                        }}
                    >
                        USB
                    </button>

                    <button
                        type="button"
                        onClick={discoverPrinters}
                        disabled={printerLoading || printerConnected}
                        style={{
                            padding: '9px 13px',
                            border: 'none',
                            borderRadius: '8px',
                            background: '#123a63',
                            color: '#fff',
                            cursor: printerLoading || printerConnected
                                ? 'not-allowed'
                                : 'pointer'
                        }}
                    >
                        {printerLoading ? 'Please wait...' : 'Find Printers'}
                    </button>
                </div>

                {printerDevices.length > 0 && !printerConnected && (
                    <div style={{ marginTop: '14px' }}>
                        <label style={{
                            display: 'block',
                            marginBottom: '7px',
                            fontSize: '13px',
                            fontWeight: 600,
                            color: '#334155'
                        }}>
                            Select Printer
                        </label>

                        <select
                            value={selectedPrinterAddress}
                            onChange={e => setSelectedPrinterAddress(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '11px',
                                border: '1px solid #cbd5e1',
                                borderRadius: '8px',
                                background: '#fff'
                            }}
                        >
                            <option value="">Choose a printer</option>

                            {printerDevices.map((device, index) => {
                                const address = device.address || device.id

                                return (
                                    <option
                                        key={address || index}
                                        value={address}
                                    >
                                        {device.name ||
                                            device.deviceName ||
                                            address ||
                                            `Printer ${index + 1}`}
                                    </option>
                                )
                            })}
                        </select>

                        <button
                            type="button"
                            onClick={connectPrinter}
                            disabled={printerLoading || !selectedPrinterAddress}
                            style={{
                                marginTop: '10px',
                                padding: '10px 15px',
                                border: 'none',
                                borderRadius: '8px',
                                background: '#176b45',
                                color: '#fff',
                                cursor: 'pointer'
                            }}
                        >
                            Connect Printer
                        </button>
                    </div>
                )}

                {printerConnected && (
                    <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '10px',
                        marginTop: '14px'
                    }}>
                        <button
                            type="button"
                            onClick={testPrinter}
                            disabled={printerLoading}
                            style={{
                                padding: '10px 14px',
                                border: 'none',
                                borderRadius: '8px',
                                background: '#176b45',
                                color: '#fff',
                                cursor: 'pointer'
                            }}
                        >
                            {printerLoading ? 'Please wait...' : 'Test Print'}
                        </button>

                        <button
                            type="button"
                            onClick={disconnectPrinter}
                            disabled={printerLoading}
                            style={{
                                padding: '10px 14px',
                                border: '1px solid #dc2626',
                                borderRadius: '8px',
                                background: '#fff',
                                color: '#b91c1c',
                                cursor: 'pointer'
                            }}
                        >
                            {printerLoading ? 'Please wait...' : 'Disconnect'}
                        </button>
                    </div>
                )}

                {printerMessage && (
                    <p style={{
                        color: '#176b45',
                        fontSize: '13px',
                        marginBottom: 0
                    }}>
                        {printerMessage}
                    </p>
                )}

                {printerError && (
                    <p style={{
                        color: '#b42318',
                        fontSize: '13px',
                        marginBottom: 0
                    }}>
                        {printerError}
                    </p>
                )}
            </div>

            {
                error && (
                    <div className="panel" style={{
                        padding: 16,
                        color: '#b42318'
                    }}>
                        {error}
                    </div>
                )
            }

            {
                successMessage && (
                    <div
                        className="panel"
                        style={{
                            padding: 16,
                            marginBottom: 16,
                            color: '#176b45',
                            background: '#ecfdf3',
                            border: '1px solid #bbf7d0'
                        }}
                    >
                        {successMessage}
                    </div>
                )
            }

            {/* ONLINE ORDER COLLECTION */}

            <div
                className="panel cashier-mobile-panel"
                style={{
                    padding: 20,
                    marginTop: 20,
                    border: '1px solid #bfdbfe'
                }}
            >
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 8
                }}>
                    <div>
                        <h2 style={{ margin: 0 }}>Online Order Collection</h2>
                        <p style={{
                            margin: '5px 0 12px',
                            color: '#64748b',
                            fontSize: 13
                        }}>
                            Find a ready online order, receive payment and complete collection.
                        </p>
                    </div>
                    <span style={{
                        padding: '6px 10px',
                        borderRadius: 20,
                        background: '#eff6ff',
                        color: '#1d4ed8',
                        fontSize: 12,
                        fontWeight: 700
                    }}>
                        Saved order prices
                    </span>
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
                    gap: 10
                }}>
                    <label style={{
                        display: 'grid',
                        gap: 5,
                        fontSize: 13,
                        fontWeight: 700
                    }}>
                        Order reference
                        <input
                            value={onlineOrderReference}
                            onChange={event => setOnlineOrderReference(event.target.value)}
                            placeholder="e.g. MBC-20261115-AB12CD34"
                            disabled={onlineLookupLoading || processing}
                            autoComplete="off"
                        />
                    </label>

                    <label style={{
                        display: 'grid',
                        gap: 5,
                        fontSize: 13,
                        fontWeight: 700
                    }}>
                        Customer phone (optional verification)
                        <input
                            value={onlineOrderPhone}
                            onChange={event => setOnlineOrderPhone(event.target.value)}
                            placeholder="Phone used when ordering"
                            disabled={onlineLookupLoading || processing}
                            autoComplete="tel"
                        />
                    </label>
                </div>

                <div style={{
                    display: 'flex',
                    gap: 8,
                    flexWrap: 'wrap',
                    marginTop: 12
                }}>
                    <button
                        type="button"
                        className="button button-primary"
                        onClick={lookupOnlineOrder}
                        disabled={onlineLookupLoading || processing}
                    >
                        <Search size={16} />
                        {onlineLookupLoading ? 'Searching...' : 'Find Online Order'}
                    </button>

                    <button
                        type="button"
                        className="button button-light"
                        onClick={() => {
                            setOnlineOrder(null)
                            setOnlineOrderItems([])
                            setOnlineOrderReference('')
                            setOnlineOrderPhone('')
                            setOnlineAmountPaid('')
                            setError('')
                            onlineCheckoutRequestId.current = null
                        }}
                        disabled={onlineLookupLoading || processing}
                    >
                        Clear
                    </button>
                </div>

                {onlineOrder && (
                    <div style={{
                        marginTop: 16,
                        padding: 14,
                        borderRadius: 10,
                        border: '1px solid #e2e8f0',
                        background: '#f8fafc'
                    }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: 10,
                            flexWrap: 'wrap'
                        }}>
                            <div>
                                <strong style={{ fontSize: 16 }}>
                                    {onlineOrder.order_reference}
                                </strong>
                                <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>
                                    {onlineOrder.customer_name} · {onlineOrder.customer_phone}
                                </div>
                                {onlineOrder.expected_collection_at && (
                                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                                        Expected collection:{' '}
                                        {new Date(onlineOrder.expected_collection_at).toLocaleString(
                                            'en-GB',
                                            { timeZone: 'Africa/Harare' }
                                        )} CAT
                                    </div>
                                )}
                            </div>

                            <div style={{
                                display: 'flex',
                                gap: 6,
                                flexWrap: 'wrap'
                            }}>
                                <span style={{
                                    padding: '5px 8px',
                                    borderRadius: 16,
                                    background: onlineOrder.order_status === 'ready' ? '#dcfce7' : '#fef3c7',
                                    color: onlineOrder.order_status === 'ready' ? '#166534' : '#92400e',
                                    fontSize: 11,
                                    fontWeight: 800
                                }}>
                                    {String(onlineOrder.order_status || '').toUpperCase()}
                                </span>
                                <span style={{
                                    padding: '5px 8px',
                                    borderRadius: 16,
                                    background: onlineOrder.payment_status === 'paid' ? '#dcfce7' : '#f1f5f9',
                                    color: onlineOrder.payment_status === 'paid' ? '#166534' : '#475569',
                                    fontSize: 11,
                                    fontWeight: 800
                                }}>
                                    {String(onlineOrder.payment_status || '').toUpperCase()}
                                </span>
                            </div>
                        </div>

                        <div style={{ marginTop: 12 }}>
                            {onlineOrderItems.map(item => (
                                <div
                                    key={item.id}
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'minmax(0, 1fr) auto',
                                        gap: 10,
                                        padding: '8px 0',
                                        borderBottom: '1px solid #e2e8f0',
                                        fontSize: 13
                                    }}
                                >
                                    <div>
                                        <strong>{item.item_name}</strong>
                                        <div style={{ color: '#64748b' }}>
                                            {item.quantity} {item.item_unit || ''} × {formatMoney(
                                                item.unit_price,
                                                onlineOrder.currency_code || 'USD'
                                            )}
                                        </div>
                                    </div>
                                    <strong>
                                        {formatMoney(
                                            item.line_total,
                                            onlineOrder.currency_code || 'USD'
                                        )}
                                    </strong>
                                </div>
                            ))}
                        </div>

                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 10,
                            marginTop: 12,
                            fontSize: 18,
                            fontWeight: 900
                        }}>
                            <span>ORDER TOTAL</span>
                            <span>
                                {formatMoney(
                                    onlineOrder.total_amount,
                                    onlineOrder.currency_code || 'USD'
                                )}
                            </span>
                        </div>

                        {onlineOrder.order_status === 'ready' &&
                            onlineOrder.payment_status === 'unpaid' &&
                            !onlineOrder.sale_id && (
                                <>
                                    <div style={{
                                        display: 'flex',
                                        gap: 8,
                                        flexWrap: 'wrap',
                                        marginTop: 16
                                    }}>
                                        {[
                                            { value: 'cash', label: 'Cash', icon: <Banknote size={16} /> },
                                            { value: 'mobile_money', label: 'Mobile Money', icon: <Smartphone size={16} /> },
                                            { value: 'bank_card', label: 'Bank / Card', icon: <CreditCard size={16} /> }
                                        ].map(method => (
                                            <button
                                                key={method.value}
                                                type="button"
                                                onClick={() => setOnlinePaymentMethod(method.value)}
                                                disabled={processing}
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: 6,
                                                    padding: '10px 12px',
                                                    borderRadius: 8,
                                                    border: onlinePaymentMethod === method.value
                                                        ? '2px solid #28785f'
                                                        : '1px solid #cbd5e1',
                                                    background: onlinePaymentMethod === method.value
                                                        ? '#eaf3ee'
                                                        : '#fff',
                                                    color: onlinePaymentMethod === method.value
                                                        ? '#176b45'
                                                        : '#475569',
                                                    fontWeight: 700
                                                }}
                                            >
                                                {method.icon}{method.label}
                                            </button>
                                        ))}
                                    </div>

                                    <label style={{
                                        display: 'grid',
                                        gap: 5,
                                        marginTop: 12,
                                        fontSize: 13,
                                        fontWeight: 700
                                    }}>
                                        Amount received ({onlineOrder.currency_code})
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={onlineAmountPaid}
                                            onChange={event => setOnlineAmountPaid(event.target.value)}
                                            disabled={processing}
                                        />
                                    </label>

                                    <p style={{
                                        margin: '7px 0 12px',
                                        color: '#64748b',
                                        fontSize: 12
                                    }}>
                                        Change due: {formatMoney(
                                            Math.max(0, Number(onlineAmountPaid || 0) - Number(onlineOrder.total_amount)),
                                            onlineOrder.currency_code || 'USD'
                                        )}
                                    </p>

                                    <button
                                        type="button"
                                        className="button button-primary cashier-checkout-button"
                                        onClick={handleOnlineOrderCollection}
                                        disabled={processing}
                                    >
                                        <ReceiptText size={17} />
                                        {processing
                                            ? 'Processing Collection...'
                                            : 'Confirm Payment & Collection'}
                                    </button>
                                </>
                            )}

                        {onlineOrder.order_status === 'collected' &&
                            onlineOrder.payment_status === 'paid' && (
                                <p style={{
                                    marginTop: 12,
                                    color: '#166534',
                                    fontWeight: 700
                                }}>
                                    This order is paid and collected.
                                    {onlineOrder.sale_id ? ' Its POS receipt is available in Recent Sales.' : ''}
                                </p>
                            )}
                    </div>
                )}
            </div>

            {/* CURRENT SALE */}

            <div
                className="panel cashier-mobile-panel"
                style={{ padding: 20, marginTop: 20 }}
            >
                <h2>
                    <ShoppingCart size={20} /> Current Sale
                </h2>

                {/* CENTRAL CURRENCY SELECTION */}

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
                    gap: 10,
                    margin: '12px 0 16px'
                }}>
                    <label style={{
                        display: 'grid',
                        gap: 5,
                        fontSize: 13,
                        fontWeight: 700
                    }}>
                        Sale currency

                        <select
                            value={saleCurrencyCode}
                            disabled={processing || !settingsLoaded}
                            onChange={event =>
                                handleSaleCurrencyChange(event.target.value)
                            }
                            style={{
                                width: '100%',
                                padding: 10,
                                border: '1px solid #cbd5e1',
                                borderRadius: 8,
                                background: '#fff'
                            }}
                        >
                            <option value="USD">USD — US Dollar</option>
                            <option value="ZAR">ZAR — South African Rand</option>
                            <option value="ZWG">ZWG — Zimbabwe Gold</option>
                        </select>
                    </label>

                    <div style={{
                        display: 'grid',
                        gap: 5,
                        fontSize: 13,
                        fontWeight: 700
                    }}>
                        Central exchange rate

                        <div style={{
                            padding: 11,
                            border: '1px solid #cbd5e1',
                            borderRadius: 8,
                            background: '#f8fafc',
                            fontWeight: 500
                        }}>
                            {!settingsLoaded
                                ? 'Loading settings...'
                                : saleRateValid
                                    ? `1 ${saleCurrencyCode} = ${selectedCurrencyRate} USD`
                                    : `No ${saleCurrencyCode} rate configured`}
                        </div>
                    </div>
                </div>

                <p style={{
                    fontSize: 12,
                    color: '#64748b',
                    margin: '-5px 0 14px'
                }}>
                    Menu prices are stored in {settingsCurrency}.
                    The POS automatically converts them using the centrally
                    configured exchange rates. Exchange rates cannot be
                    manually changed at checkout.
                </p>

                {!settingsLoaded && (
                    <div style={{
                        padding: 10,
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        borderRadius: 8,
                        color: '#1d4ed8',
                        fontSize: 13,
                        marginBottom: 12
                    }}>
                        Loading central currency settings...
                    </div>
                )}

                {missingSaleCurrencyRate && (
                    <div style={{
                        padding: 10,
                        background: '#fff7ed',
                        border: '1px solid #fed7aa',
                        borderRadius: 8,
                        color: '#9a3412',
                        fontSize: 13,
                        marginBottom: 12
                    }}>
                        No central exchange rate is configured for {saleCurrencyCode}.
                        Please ask the Owner or Manager to configure this currency
                        in Settings. Checkout in this currency is disabled.
                    </div>
                )}

                {settingsLoaded && !baseRateValid && (
                    <div style={{
                        padding: 10,
                        background: '#fff7ed',
                        border: '1px solid #fed7aa',
                        borderRadius: 8,
                        color: '#9a3412',
                        fontSize: 13,
                        marginBottom: 12
                    }}>
                        The central exchange rate for the business currency
                        ({settingsCurrency}) is missing or invalid.
                        Checkout is disabled.
                    </div>
                )}

                {cart.length === 0 ? (
                    <p>
                        Your cart is empty. Select menu items to begin.
                    </p>
                ) : (
                    cart.map(item => (
                        <div
                            key={item.menu_item_id}
                            className="cashier-cart-row"
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: 12,
                                padding: '12px 0',
                                borderBottom: '1px solid #edf0eb'
                            }}
                        >
                            <div>
                                <strong>{item.item_name}</strong>

                                <div>
                                    {formatMoney(
                                        convertedMenuPrice(item),
                                        saleCurrencyCode
                                    )} each
                                </div>
                            </div>

                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8
                            }}>
                                <button
                                    onClick={() =>
                                        updateQuantity(item.menu_item_id, -1)
                                    }
                                >
                                    <Minus size={15} />
                                </button>

                                {item.quantity}

                                <button
                                    onClick={() =>
                                        updateQuantity(item.menu_item_id, 1)
                                    }
                                >
                                    <Plus size={15} />
                                </button>

                                <button
                                    onClick={() =>
                                        removeFromCart(item.menu_item_id)
                                    }
                                >
                                    <Trash2 size={15} />
                                </button>
                            </div>

                            <strong>
                                {formatMoney(
                                    getLineTotal(item),
                                    saleCurrencyCode
                                )}
                            </strong>
                        </div>
                    ))
                )}

                <h2 style={{
                    textAlign: 'right',
                    marginTop: 20
                }}>
                    TOTAL: {formatMoney(total, saleCurrencyCode)}
                </h2>

                {/* PAYMENT METHODS */}

                <div
                    style={{
                        display: 'flex',
                        gap: 10,
                        flexWrap: 'wrap',
                        marginTop: 16
                    }}
                    className="cashier-payment-actions"
                >
                    <button
                        type="button"
                        onClick={() => setPaymentMethod('cash')}
                        style={{
                            background: paymentMethod === 'cash' ? '#eaf3ee' : '#fff',
                            color: paymentMethod === 'cash' ? '#176b45' : '#64716a',
                            border: paymentMethod === 'cash'
                                ? '2px solid #28785f'
                                : '1px solid #dfe5df',
                            borderRadius: 9,
                            padding: '12px 18px',
                            fontWeight: 700,
                            cursor: 'pointer'
                        }}
                    >
                        <Banknote size={16} /> Cash
                    </button>

                    <button
                        type="button"
                        onClick={() => setPaymentMethod('mobile_money')}
                        style={{
                            background: paymentMethod === 'mobile_money' ? '#eaf3ee' : '#fff',
                            color: paymentMethod === 'mobile_money' ? '#176b45' : '#64716a',
                            border: paymentMethod === 'mobile_money'
                                ? '2px solid #28785f'
                                : '1px solid #dfe5df',
                            borderRadius: 9,
                            padding: '12px 18px',
                            fontWeight: 700,
                            cursor: 'pointer'
                        }}
                    >
                        <Smartphone size={16} /> Mobile Money
                    </button>

                    <button
                        type="button"
                        onClick={() => setPaymentMethod('bank_card')}
                        style={{
                            background: paymentMethod === 'bank_card' ? '#eaf3ee' : '#fff',
                            color: paymentMethod === 'bank_card' ? '#176b45' : '#64716a',
                            border: paymentMethod === 'bank_card'
                                ? '2px solid #28785f'
                                : '1px solid #dfe5df',
                            borderRadius: 9,
                            padding: '12px 18px',
                            fontWeight: 700,
                            cursor: 'pointer'
                        }}
                    >
                        <CreditCard size={16} /> Bank / Card
                    </button>
                </div>

                <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Amount paid"
                    value={amountPaid}
                    disabled={!fxConfigurationValid || processing}
                    onChange={event =>
                        setAmountPaid(event.target.value)
                    }
                />

                <p>
                    Change: {formatMoney(
                        Math.max(
                            0,
                            Number(amountPaid || 0) - total
                        ),
                        saleCurrencyCode
                    )}
                </p>

                <button
                    type="button"
                    className="button button-primary cashier-checkout-button"
                    disabled={
                        !cart.length ||
                        processing ||
                        !fxConfigurationValid
                    }
                    onClick={handleCheckout}
                >
                    <ReceiptText size={17} />

                    {processing
                        ? 'Processing Sale...'
                        : 'Checkout'}
                </button>
            </div>

            {/* MENU */}

            {
                loading ? (
                    <div className="panel" style={{ padding: 24 }}>
                        Loading menu...
                    </div>
                ) : (
                    <div
                        className="panel cashier-mobile-panel"
                        style={{ padding: 20 }}
                    >
                        <Search size={17} />

                        <input
                            placeholder="Search menu items..."
                            value={search}
                            onChange={event =>
                                setSearch(event.target.value)
                            }
                        />
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: 8,
                            marginTop: 10,
                            marginBottom: 10
                        }}>
                            <span style={{
                                fontSize: 12,
                                color: '#64748b'
                            }}>
                                {sortedFilteredItems.length} menu items
                            </span>

                            <span style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: '#176b45',
                                background: '#ecfdf3',
                                padding: '6px 10px',
                                borderRadius: 20
                            }}>
                                Highest stock first ↓
                            </span>
                        </div>
                        <div
                            className="cashier-category-list"
                            style={{
                                display: 'flex',
                                gap: 8,
                                flexWrap: 'wrap',
                                margin: '16px 0'
                            }}
                        >
                            {categories.map(category => (
                                <button
                                    key={category}
                                    type="button"
                                    onClick={() =>
                                        setActiveCategory(category)
                                    }
                                    className="button button-light"
                                    style={{
                                        background:
                                            activeCategory === category
                                                ? '#eaf3ee'
                                                : '#fff'
                                    }}
                                >
                                    {category}
                                </button>
                            ))}
                        </div>

                        <div
                            className="cashier-product-grid"
                            style={{
                                display: 'grid',
                                gridTemplateColumns:
                                    'repeat(auto-fill,minmax(180px,1fr))',
                                gap: 12
                            }}
                        >
                            {sortedFilteredItems.map(item => {
                                const priceConfigured =
                                    Number(item.selling_price) > 0

                                const stockAvailable = Number(
                                    item.inventory_stock_quantity ??
                                    item.current_quantity ??
                                    0
                                )

                                const saleReady = priceConfigured

                                let unavailableReason = ''

                                if (!priceConfigured) {
                                    unavailableReason =
                                        'Price not configured'
                                } else if (stockAvailable <= 0) {
                                    unavailableReason =
                                        'No recorded stock — physical confirmation required at checkout'
                                }

                                return (
                                    <button
                                        key={item.menu_item_id}
                                        type="button"
                                        disabled={!saleReady}
                                        onClick={() => addToCart(item)}
                                        className="panel cashier-product-card"
                                        title={unavailableReason}
                                        style={{
                                            padding: 12,
                                            textAlign: 'left',
                                            cursor: saleReady
                                                ? 'pointer'
                                                : 'not-allowed',
                                            opacity: saleReady ? 1 : 0.55,
                                            border: saleReady
                                                ? '1px solid #e2e8f0'
                                                : '1px solid #fca5a5',
                                            background: '#fff'
                                        }}
                                    >
                                        <div className="cashier-product-image">
                                            {item.image_url && (
                                                <img
                                                    src={item.image_url}
                                                    alt={item.item_name}
                                                    loading="lazy"
                                                    onError={event => {
                                                        event.currentTarget.style.display = 'none'

                                                        const placeholder =
                                                            event.currentTarget.parentElement?.querySelector(
                                                                '.cashier-product-image-placeholder'
                                                            )

                                                        if (placeholder) {
                                                            placeholder.style.display = 'flex'
                                                        }
                                                    }}
                                                />
                                            )}

                                            <div
                                                className="cashier-product-image-placeholder"
                                                style={{
                                                    display: item.image_url
                                                        ? 'none'
                                                        : 'flex'
                                                }}
                                            >
                                                No product photo
                                            </div>
                                        </div>

                                        <strong>{item.item_name}</strong>

                                        <div>{item.unit}</div>

                                        <strong>
                                            {formatMoney(
                                                convertedMenuPrice(item),
                                                saleCurrencyCode
                                            )}
                                        </strong>

                                        <div style={{
                                            fontSize: 12,
                                            color: '#64748b'
                                        }}>
                                            Shared stock ({item.inventory_stock_name}): {stockAvailable}
                                        </div>

                                        {!saleReady ? (
                                            <div style={{
                                                marginTop: 8,
                                                color: '#b42318',
                                                fontSize: 12,
                                                fontWeight: 700
                                            }}>
                                                {unavailableReason}
                                            </div>
                                        ) : (
                                            <Plus size={16} />
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                )
            }

            {/* RECEIPT */}

            {
                lastReceipt && (
                    <div
                        className="panel cash-pos-receipt"
                        style={{
                            padding: 20,
                            marginTop: 20,
                            width: '100%',
                            maxWidth: 420,
                            marginLeft: 'auto',
                            marginRight: 'auto',
                            background: '#fff',
                            color: '#111827',
                            border: '1px solid #e2e8f0',
                            fontFamily: 'Arial, sans-serif'
                        }}
                    >
                        {loadingReceipt ? (
                            <p>Loading receipt...</p>
                        ) : receiptDetails.length > 0 ? (
                            <>
                                {(() => {
                                    const receipt = receiptDetails[0]

                                    const receiptCurrency =
                                        receipt.currency_code || 'USD'

                                    const saleDate =
                                        new Date(receipt.sale_datetime)

                                    const dateText =
                                        saleDate.toLocaleDateString(
                                            'en-GB',
                                            {
                                                timeZone: 'Africa/Harare'
                                            }
                                        )

                                    const timeText =
                                        saleDate.toLocaleTimeString(
                                            'en-GB',
                                            {
                                                timeZone: 'Africa/Harare',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                                second: '2-digit'
                                            }
                                        )

                                    return (
                                        <>
                                            <div style={{
                                                textAlign: 'center',
                                                marginBottom: 18,
                                                fontWeight: 800
                                            }}>
                                                <h2 style={{
                                                    margin: '0 0 6px',
                                                    fontSize: 21,
                                                    fontWeight: 900,
                                                    letterSpacing: 0.5
                                                }}>
                                                    {displayBusinessName}
                                                </h2>

                                                <div style={{
                                                    fontSize: 14,
                                                    fontWeight: 900,
                                                    marginBottom: 8
                                                }}>
                                                    SALES RECEIPT
                                                </div>

                                                <strong style={{
                                                    fontSize: 13,
                                                    overflowWrap: 'anywhere',
                                                    fontWeight: 900
                                                }}>
                                                    Receipt No: {lastReceipt.receipt_number}
                                                </strong>
                                            </div>

                                            <hr style={{
                                                border: 0,
                                                borderTop: '1px dashed #64748b',
                                                margin: '12px 0'
                                            }} />

                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'auto 1fr',
                                                gap: '7px 12px',
                                                fontSize: 13,
                                                fontWeight: 700
                                            }}>
                                                <strong>Date</strong>
                                                <strong>{dateText}</strong>

                                                <strong>Time</strong>
                                                <strong>{timeText}</strong>

                                                <strong>Cashier</strong>
                                                <strong>{receipt.cashier_name || 'Cashier'}</strong>
                                            </div>

                                            <hr style={{
                                                border: 0,
                                                borderTop: '1px dashed #64748b',
                                                margin: '12px 0'
                                            }} />

                                            <div style={{
                                                fontWeight: 900,
                                                fontSize: 13,
                                                marginBottom: 8
                                            }}>
                                                ITEM DETAILS
                                            </div>

                                            <table style={{
                                                width: '100%',
                                                minWidth: 0,
                                                tableLayout: 'fixed',
                                                borderCollapse: 'collapse',
                                                fontSize: 11,
                                                fontWeight: 800
                                            }}>
                                                <colgroup>
                                                    <col style={{ width: '38%' }} />
                                                    <col style={{ width: '12%' }} />
                                                    <col style={{ width: '24%' }} />
                                                    <col style={{ width: '26%' }} />
                                                </colgroup>

                                                <thead>
                                                    <tr style={{
                                                        borderBottom: '1px solid #64748b',
                                                        fontWeight: 900
                                                    }}>
                                                        <th style={{
                                                            textAlign: 'left',
                                                            padding: '7px 2px',
                                                            overflowWrap: 'anywhere',
                                                            fontWeight: 900
                                                        }}>
                                                            Description
                                                        </th>

                                                        <th style={{
                                                            textAlign: 'center',
                                                            padding: '7px 2px',
                                                            fontWeight: 900
                                                        }}>
                                                            QTY
                                                        </th>

                                                        <th style={{
                                                            textAlign: 'right',
                                                            padding: '7px 2px',
                                                            fontWeight: 900
                                                        }}>
                                                            Unit Price
                                                        </th>

                                                        <th style={{
                                                            textAlign: 'right',
                                                            padding: '7px 2px',
                                                            fontWeight: 900
                                                        }}>
                                                            Amount
                                                        </th>
                                                    </tr>
                                                </thead>

                                                <tbody>
                                                    {receiptDetails.map((item, index) => (
                                                        <tr
                                                            key={`${item.sale_id}-${index}`}
                                                            style={{
                                                                borderBottom: '1px solid #e2e8f0',
                                                                fontWeight: 800
                                                            }}
                                                        >
                                                            <td style={{
                                                                textAlign: 'left',
                                                                padding: '9px 2px',
                                                                overflowWrap: 'anywhere',
                                                                verticalAlign: 'top',
                                                                fontWeight: 800
                                                            }}>
                                                                {item.item_name}
                                                            </td>

                                                            <td style={{
                                                                textAlign: 'center',
                                                                padding: '9px 2px',
                                                                verticalAlign: 'top',
                                                                fontWeight: 800
                                                            }}>
                                                                {item.quantity}
                                                            </td>

                                                            <td style={{
                                                                textAlign: 'right',
                                                                padding: '9px 2px',
                                                                overflowWrap: 'anywhere',
                                                                verticalAlign: 'top',
                                                                fontWeight: 800
                                                            }}>
                                                                {formatMoney(
                                                                    item.unit_price,
                                                                    receiptCurrency
                                                                )}
                                                            </td>

                                                            <td style={{
                                                                textAlign: 'right',
                                                                padding: '9px 2px',
                                                                overflowWrap: 'anywhere',
                                                                verticalAlign: 'top',
                                                                fontWeight: 800
                                                            }}>
                                                                {formatMoney(
                                                                    item.line_total,
                                                                    receiptCurrency
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>

                                            <hr style={{
                                                border: 0,
                                                borderTop: '1px dashed #64748b',
                                                margin: '12px 0'
                                            }} />

                                            <div style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                gap: 10,
                                                fontWeight: 900,
                                                fontSize: 16
                                            }}>
                                                <strong>TOTAL</strong>

                                                <strong>
                                                    {formatMoney(
                                                        receipt.total_amount,
                                                        receiptCurrency
                                                    )}
                                                </strong>
                                            </div>

                                            <hr style={{
                                                border: 0,
                                                borderTop: '1px dashed #64748b',
                                                margin: '12px 0'
                                            }} />

                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: '1fr auto',
                                                gap: 9,
                                                fontSize: 13,
                                                fontWeight: 700
                                            }}>
                                                <strong>Payment method</strong>

                                                <strong style={{ textAlign: 'right' }}>
                                                    {(receipt.payment_method || '')
                                                        .replace('_', ' ')}
                                                </strong>

                                                <strong>Amount paid</strong>

                                                <strong style={{ textAlign: 'right' }}>
                                                    {formatMoney(
                                                        receipt.amount_paid,
                                                        receiptCurrency
                                                    )}
                                                </strong>

                                                <strong>Change</strong>

                                                <strong style={{ textAlign: 'right' }}>
                                                    {formatMoney(
                                                        receipt.change_amount,
                                                        receiptCurrency
                                                    )}
                                                </strong>
                                            </div>

                                            <hr style={{
                                                border: 0,
                                                borderTop: '1px dashed #64748b',
                                                margin: '14px 0'
                                            }} />

                                            <div style={{
                                                textAlign: 'center',
                                                marginTop: 16,
                                                lineHeight: 1.6,
                                                fontWeight: 800
                                            }}>
                                                <strong style={{
                                                    fontSize: 13,
                                                    fontWeight: 900
                                                }}>
                                                    THANK YOU FOR YOUR PURCHASE!
                                                </strong>

                                                <div style={{
                                                    fontSize: 12,
                                                    fontWeight: 800
                                                }}>
                                                    We appreciate your support.
                                                </div>

                                                <div style={{
                                                    fontSize: 12,
                                                    fontWeight: 900,
                                                    marginTop: 5
                                                }}>
                                                    GOOD FOOD. GREAT SERVICE. SEE YOU AGAIN!
                                                </div>
                                            </div>
                                        </>
                                    )
                                })()}

                                <div
                                    className="receipt-print-actions"
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'center',
                                        marginTop: 20
                                    }}
                                >
                                    <button
                                        type="button"
                                        className="button button-primary"
                                        disabled={
                                            loadingReceipt ||
                                            printerLoading ||
                                            receiptDetails.length === 0
                                        }
                                        onClick={printReceipt}
                                    >
                                        <ReceiptText size={16} />

                                        {printerLoading
                                            ? 'Printing...'
                                            : 'Print Receipt'}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <p>Receipt details are unavailable.</p>
                        )}
                    </div>
                )
            }

            {/* RECENT SALES */}

            <div
                className="panel cashier-mobile-panel"
                style={{ padding: 20, marginTop: 20 }}
            >
                <h2>
                    <ReceiptText size={20} />
                    Recent Sales
                </h2>

                {loadingHistory ? (
                    <p>Loading sales history...</p>
                ) : salesHistory.length === 0 ? (
                    <p>No sales recorded yet.</p>
                ) : (
                    <div
                        className="cashier-table-wrap"
                        style={{ overflowX: 'auto' }}
                    >
                        <table style={{
                            width: '100%',
                            borderCollapse: 'collapse'
                        }}>
                            <thead>
                                <tr>
                                    <th align="left">Receipt</th>
                                    <th align="left">Date</th>
                                    <th align="left">Payment</th>
                                    <th align="right">Total</th>
                                    <th align="left">Action</th>
                                </tr>
                            </thead>

                            <tbody>
                                {salesHistory.map(sale => (
                                    <tr key={sale.sale_id}>
                                        <td>{sale.receipt_number}</td>

                                        <td>
                                            {new Date(
                                                sale.sale_datetime
                                            ).toLocaleString(
                                                'en-GB',
                                                {
                                                    timeZone: 'Africa/Harare'
                                                }
                                            )}
                                        </td>

                                        <td>
                                            {(sale.payment_method || '')
                                                .replace('_', ' ')}
                                        </td>

                                        <td align="right">
                                            {formatMoney(
                                                sale.total_amount,
                                                sale.currency_code || 'USD'
                                            )}
                                        </td>

                                        <td>
                                            <button
                                                type="button"
                                                className="button button-light"
                                                onClick={() =>
                                                    handleReprint(sale)
                                                }
                                            >
                                                Reprint Receipt
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}