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



export default function CashierPOS({ businessName, ownerEmail }) {
    const { formatCurrency } = useCurrency()

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
    const [printerType, setPrinterType] = useState('bluetooth')
    const [printerDevices, setPrinterDevices] = useState([])
    const [selectedPrinterAddress, setSelectedPrinterAddress] = useState('')
    const [printerHashKey, setPrinterHashKey] = useState('')
    const [printerConnected, setPrinterConnected] = useState(false)
    const [printerLoading, setPrinterLoading] = useState(false)
    const [printerError, setPrinterError] = useState('')
    const [printerMessage, setPrinterMessage] = useState('')
    async function discoverPrinters() {
        setPrinterLoading(true)
        setPrinterError('')
        setPrinterMessage('')
        setPrinterDevices([])
        setSelectedPrinterAddress('')

        try {
            if (!Capacitor.isNativePlatform()) {
                throw new Error('Thermal printer discovery is available in the Android app, not the web browser.')
            }

            if (printerType === 'bluetooth') {
                const enableResult = await EscPosPrinter.requestBluetoothEnable()

                if (!enableResult.value) {
                    throw new Error('Please enable Bluetooth to find printers.')
                }

                const result = await EscPosPrinter.getBluetoothPrinterDevices()
                setPrinterDevices(result.devices || [])

                if (!result.devices?.length) {
                    setPrinterMessage('No paired printer devices found. Pair your printer in Android Bluetooth settings first.')
                }
            } else {
                const result = await EscPosPrinter.getUsbPrinterDevices()
                setPrinterDevices(result.devices || [])

                if (!result.devices?.length) {
                    setPrinterMessage('No compatible USB printer found. Connect the printer to the Android device.')
                }
            }
        } catch (err) {
            setPrinterError(err.message || 'Could not discover printers.')
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
                const permission = await EscPosPrinter.requestUsbPermission({
                    address: selectedPrinterAddress
                })

                if (!permission.value) {
                    throw new Error('USB printer permission was not granted.')
                }
            }

            const result = await EscPosPrinter.createPrinter({
                connectionType: printerType,
                address: selectedPrinterAddress
            })

            newHashKey = result.value

            if (!newHashKey) {
                throw new Error('Could not create the printer connection.')
            }

            await EscPosPrinter.connectPrinter({
                hashKey: newHashKey
            })

            setPrinterHashKey(newHashKey)
            setPrinterConnected(true)
            setPrinterMessage('Printer connected successfully.')
        } catch (err) {
            if (newHashKey) {
                try {
                    await EscPosPrinter.disposePrinter({
                        hashKey: newHashKey
                    })
                } catch (disposeError) {
                    console.error('Printer cleanup failed:', disposeError)
                }
            }

            setPrinterHashKey('')
            setPrinterConnected(false)
            setPrinterError(err.message || 'Could not connect to the printer.')
        } finally {
            setPrinterLoading(false)
        }
    }
    async function disconnectPrinter() {
        if (!printerHashKey) return

        setPrinterLoading(true)
        setPrinterError('')
        setPrinterMessage('Disconnecting printer...')

        try {
            // Changing printerHashKey triggers the cleanup useEffect,
            // which disconnects and disposes the native printer connection.
            setPrinterHashKey('')
            setPrinterConnected(false)
            setSelectedPrinterAddress('')
            setPrinterMessage('Printer disconnected.')
        } catch (err) {
            setPrinterError(err.message || 'Could not disconnect the printer.')
        } finally {
            setPrinterLoading(false)
        }
    }
    function textToPrinterBytes(text) {
        return Array.from(new TextEncoder().encode(text))
    }

    async function testPrinter() {
        if (!printerConnected || !printerHashKey) {
            setPrinterError('Connect a printer before running a test print.')
            return
        }

        setPrinterLoading(true)
        setPrinterError('')
        setPrinterMessage('')

        try {
            const testText =
                '\x1B\x40' +
                '\x1B\x61\x01' +
                '\x1B\x45\x01' +
                'MBARE CHITEKETE\n' +
                '\x1B\x45\x00' +
                'PRINTER TEST\n' +
                '------------------------------\n' +
                'Printer connection successful.\n' +
                'Your POS printer is ready.\n\n\n' +
                '\x1D\x56\x00'

            await EscPosPrinter.sendToPrinter({
                hashKey: printerHashKey,
                data: textToPrinterBytes(testText),
                waitingTime: 3000
            })

            setPrinterMessage('Test receipt sent to the printer.')
        } catch (err) {
            setPrinterError(err.message || 'Test print failed.')
        } finally {
            setPrinterLoading(false)
        }
    }
    async function printReceipt() {
        if (!receiptDetails.length || !lastReceipt) {
            setError('Receipt details are not available.')
            return
        }

        // Use normal browser printing when running outside Android.
        if (!Capacitor.isNativePlatform()) {
            window.print()
            return
        }

        if (!printerConnected || !printerHashKey) {
            setError('Please connect a thermal printer before printing.')
            return
        }

        setPrinterLoading(true)
        setPrinterError('')
        setPrinterMessage('')

        try {
            const receipt = receiptDetails[0]
            const width = 32

            const center = text =>
                text.length >= width
                    ? text.slice(0, width)
                    : ' '.repeat(Math.floor((width - text.length) / 2)) + text

            const line = '-'.repeat(width)

            const leftRight = (left, right) => {
                const available = Math.max(1, width - left.length - right.length)
                return left + ' '.repeat(available) + right
            }

            const dateText = new Date(receipt.sale_datetime).toLocaleString(
                'en-GB',
                { timeZone: 'Africa/Harare' }
            )

            const rows = [
                '\x1B\x40',
                '\x1B\x61\x01',
                '\x1B\x45\x01',
                businessName || 'MBARE CHITEKETE CANTEEN',
                '\x1B\x45\x00',
                'SALES RECEIPT',
                '\n',
                '\x1B\x61\x00',
                `Receipt: ${lastReceipt.receipt_number}`,
                `Date: ${dateText}`,
                `Cashier: ${receipt.cashier_name || 'Cashier'}`,
                line
            ]

            receiptDetails.forEach(item => {
                rows.push(item.item_name)
                rows.push(
                    leftRight(
                        `${item.quantity} x ${formatCurrency(item.unit_price)}`,
                        formatCurrency(item.line_total)
                    )
                )
            })

            rows.push(
                line,
                '\x1B\x45\x01',
                leftRight('TOTAL', formatCurrency(receipt.total_amount)),
                '\x1B\x45\x00',
                line,
                `Payment: ${receipt.payment_method.replace('_', ' ')}`,
                `Paid: ${formatCurrency(receipt.amount_paid)}`,
                `Change: ${formatCurrency(receipt.change_amount)}`,
                '\n',
                center('Thank you for your purchase!'),
                '\n\n\n',
                '\x1D\x56\x00'
            )

            const receiptText = rows.join('\n')

            await EscPosPrinter.sendToPrinter({
                hashKey: printerHashKey,
                data: textToPrinterBytes(receiptText),
                waitingTime: 3000
            })

            setPrinterMessage(`Receipt ${lastReceipt.receipt_number} printed successfully.`)
        } catch (err) {
            setPrinterError(err.message || 'Could not print the receipt.')
        } finally {
            setPrinterLoading(false)
        }
    }
    useEffect(() => {
        loadMenu()
        loadSalesHistory()
    }, [])
    useEffect(() => {
        return () => {
            if (printerHashKey) {
                EscPosPrinter.disconnectPrinter({
                    hashKey: printerHashKey
                }).catch(err => {
                    console.error('Printer disconnect on POS exit failed:', err)
                }).finally(() => {
                    EscPosPrinter.disposePrinter({
                        hashKey: printerHashKey
                    }).catch(err => {
                        console.error('Printer cleanup on POS exit failed:', err)
                    })
                })
            }
        }
    }, [printerHashKey])
    async function loadMenu() {
        setLoading(true)
        setError('')

        try {
            // Fetch POS products and mappings independently.
            const [
                { data: menuData, error: menuError },
                { data: mappingData, error: mappingError }
            ] = await Promise.all([
                supabase.rpc('cashier_retail_pos_menu'),
                supabase
                    .from('menu_item_stock_mappings')
                    .select('sellable_menu_item_id, stock_menu_item_id, quantity_per_sale')
            ])

            if (menuError) throw menuError
            if (mappingError) throw mappingError

            const mappings = mappingData || []
            const visibleMenuIds = new Set(
                (menuData || []).map(item => item.menu_item_id)
            )

            // Keep only mappings belonging to visible POS products.
            const relevantMappings = mappings.filter(mapping =>
                visibleMenuIds.has(mapping.sellable_menu_item_id)
            )

            const stockItemIds = [
                ...new Set(
                    relevantMappings.map(mapping => mapping.stock_menu_item_id)
                )
            ]

            let stockItems = []

            if (stockItemIds.length > 0) {
                const { data, error: stockError } = await supabase
                    .from('menu_items')
                    .select('id, name, current_quantity, active')
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
                const mapping = mappingMap.get(item.menu_item_id)

                if (mapping) {
                    const stock = stockMap.get(mapping.stock_menu_item_id)

                    return {
                        ...item,
                        inventory_stock_item_id: mapping.stock_menu_item_id,
                        inventory_stock_name: stock?.name || item.item_name,
                        inventory_stock_quantity:
                            stock?.current_quantity == null
                                ? NaN
                                : Number(stock.current_quantity),
                        inventory_stock_verified: Boolean(
                            stock &&
                            stock.active &&
                            stock.current_quantity != null &&
                            Number.isFinite(Number(stock.current_quantity))
                        ),
                        quantity_per_sale: Number(mapping.quantity_per_sale || 1)
                    }
                }

                // Standalone products continue using their own stock.
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
                        Number.isFinite(Number(item.current_quantity)),
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
            console.error('POS menu loading failed:', err)
            setError(`Could not load POS menu and shared stock: ${err.message}`)
            setMenuItems([])
        } finally {
            setLoading(false)
        }
    }
    async function loadSalesHistory() {
        setLoadingHistory(true)

        try {
            // Confirm the current authenticated session.
            const { data: sessionData, error: sessionError } =
                await supabase.auth.getSession()

            if (sessionError) throw sessionError

            const session = sessionData?.session
            const cashierId = session?.user?.id

            console.log('POS SESSION:', session)
            console.log('AUTHENTICATED CASHIER ID:', cashierId)

            if (!cashierId) {
                throw new Error(
                    'No authenticated cashier session found. Please sign in again.'
                )
            }

            // Fetch saved sales belonging to this cashier.
            const { data, error } = await supabase.rpc(
                'cashier_pos_sales_history',
                { p_limit: 100 }
            )

            console.log('SALES HISTORY RPC ERROR:', error)
            console.log('SALES HISTORY RPC DATA:', data)
            console.log('SALES HISTORY COUNT:', data?.length ?? 0)

            if (error) throw error

            setSalesHistory(data || [])

        } catch (err) {
            console.error('RECENT SALES LOADING FAILED:', err)
            setSalesHistory([])
            setError(`Recent Sales could not load: ${err.message}`)
        } finally {
            setLoadingHistory(false)
        }
    }

    const filteredItems = menuItems.filter(item => {
        const matchesSearch = item.item_name
            .toLowerCase()
            .includes(search.toLowerCase())

        const matchesCategory =
            activeCategory === 'All' ||
            item.category_name === activeCategory

        return matchesSearch && matchesCategory
    })

    const total = cart.reduce(
        (sum, item) => sum + item.quantity * Number(item.selling_price),
        0
    )

    function addToCart(item) {
        setCart(previous => {
            const existing = previous.find(row => row.menu_item_id === item.menu_item_id)

            if (existing) {
                return previous.map(row =>
                    row.menu_item_id === item.menu_item_id
                        ? { ...row, quantity: row.quantity + 1 }
                        : row
                )
            }

            return [...previous, { ...item, quantity: 1 }]
        })
    }

    function updateQuantity(menuItemId, change) {
        setCart(previous =>
            previous
                .map(item => {
                    if (item.menu_item_id !== menuItemId) return item
                    return { ...item, quantity: Math.max(0, item.quantity + change) }
                })
                .filter(item => item.quantity > 0)
        )
    }

    function removeFromCart(menuItemId) {
        setCart(previous =>
            previous.filter(item => item.menu_item_id !== menuItemId)
        )
    }

    async function handleCheckout() {
        if (processing) return

        setError('')
        setSuccessMessage('')

        if (!cart.length) {
            setError('Please add items to the cart.')
            return
        }

        const paid = Number(amountPaid)

        if (!Number.isFinite(paid) || paid < total) {
            setError('Amount paid must be at least the total sale amount.')
            return
        }

        if (
            paymentMethod !== 'cash' &&
            Math.round(paid * 100) !== Math.round(total * 100)
        ) {
            setError('Mobile money and bank/card payments must equal the exact sale total.')
            return
        }

        // Aggregate the entire cart by canonical stock item.
        // Rice and Sadza variants therefore share one stock balance.
        const stockRequirements = new Map()

        cart.forEach(item => {
            const stockItemId =
                item.inventory_stock_item_id || item.menu_item_id
            if (
                item.inventory_stock_verified === false ||
                !Number.isFinite(Number(item.inventory_stock_quantity))
            ) {
                stockRequirements.set(stockItemId, {
                    name: item.inventory_stock_name || item.item_name,
                    required: Number(item.quantity),
                    available: NaN
                })
                return
            }

            const stockName =
                item.inventory_stock_name || item.item_name

            const quantityPerSale =
                Number(item.quantity_per_sale || 1)

            const requiredQuantity =
                Number(item.quantity) * quantityPerSale

            const rawAvailableQuantity =
                item.inventory_stock_quantity ?? item.current_quantity

            const availableQuantity =
                rawAvailableQuantity === null || rawAvailableQuantity === undefined
                    ? NaN
                    : Number(rawAvailableQuantity)

            const existing = stockRequirements.get(stockItemId)

            if (existing) {
                if (existing.available !== availableQuantity) {
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
        const missingStockItems = [...stockRequirements.values()]
            .filter(item => !Number.isFinite(item.available))

        if (missingStockItems.length > 0) {
            setError(
                `Could not verify stock quantities for: ${missingStockItems.map(item => item.name).join(', ')
                }. Reload the POS menu before checkout.`
            )
            return
        }
        const overStockItems = [...stockRequirements.values()]
            .filter(item => item.required > item.available)

        const physicallyConfirmed = overStockItems.length > 0

        if (physicallyConfirmed) {
            const shortageSummary = overStockItems.map(item => {
                const shortage = item.required - item.available

                return (
                    `${item.name}: required ${item.required}, ` +
                    `recorded stock ${item.available}, ` +
                    `additional physical quantity confirmed ${shortage}`
                )
            }).join('\n')

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
            checkoutRequestId.current = crypto.randomUUID()
        }

        setProcessing(true)

        try {
            const { data, error: checkoutError } = await supabase.rpc(
                'process_retail_pos_checkout',
                {
                    p_items: cart.map(item => ({
                        menu_item_id: item.menu_item_id,
                        quantity: item.quantity
                    })),
                    p_payment_method: paymentMethod,
                    p_amount_paid: paid,
                    p_checkout_request_id: checkoutRequestId.current,
                    p_notes: null,
                    p_physical_stock_confirmed: physicallyConfirmed
                }
            )

            if (checkoutError) {
                throw checkoutError
            }

            const receipt = Array.isArray(data) ? data[0] : data

            if (!receipt?.sale_id || !receipt?.receipt_number) {
                throw new Error(
                    'The sale response was incomplete. Do not submit another sale. Check Recent Sales before retrying.'
                )
            }

            // The database has confirmed that the sale was saved.
            setLastReceipt(receipt)
            setSuccessMessage(
                `Sale completed successfully. Receipt: ${receipt.receipt_number}`
            )

            // Clear the cart only after the database confirms the sale.
            setCart([])
            setAmountPaid('')
            setPaymentMethod('cash')
            checkoutRequestId.current = null

            // Load the saved receipt separately.
            try {
                await loadReceipt(receipt.sale_id)

                if (Capacitor.isNativePlatform() && printerConnected && printerHashKey) {
                    // Give React time to update receiptDetails before printing.
                    setTimeout(async () => {
                        try {
                            const { data: savedReceipt, error: receiptError } =
                                await supabase.rpc('cashier_get_pos_receipt', {
                                    p_sale_id: receipt.sale_id
                                })

                            if (receiptError) throw receiptError

                            const rows = savedReceipt || []

                            if (!rows.length) {
                                throw new Error('Saved receipt details were not returned.')
                            }

                            const first = rows[0]
                            const width = 32
                            const line = '-'.repeat(width)

                            const center = text =>
                                text.length >= width
                                    ? text.slice(0, width)
                                    : ' '.repeat(Math.floor((width - text.length) / 2)) + text

                            const leftRight = (left, right) =>
                                left + ' '.repeat(Math.max(1, width - left.length - right.length)) + right

                            const dateText = new Date(first.sale_datetime).toLocaleString(
                                'en-GB',
                                { timeZone: 'Africa/Harare' }
                            )

                            const receiptLines = [
                                '\x1B\x40',
                                '\x1B\x61\x01',
                                '\x1B\x45\x01',
                                businessName || 'MBARE CHITEKETE CANTEEN',
                                '\x1B\x45\x00',
                                'SALES RECEIPT',
                                '\n',
                                '\x1B\x61\x00',
                                `Receipt: ${first.receipt_number}`,
                                `Date: ${dateText}`,
                                `Cashier: ${first.cashier_name || 'Cashier'}`,
                                line
                            ]

                            rows.forEach(item => {
                                receiptLines.push(
                                    item.item_name,
                                    leftRight(
                                        `${item.quantity} x ${formatCurrency(item.unit_price)}`,
                                        formatCurrency(item.line_total)
                                    )
                                )
                            })

                            receiptLines.push(
                                line,
                                '\x1B\x45\x01',
                                leftRight('TOTAL', formatCurrency(first.total_amount)),
                                '\x1B\x45\x00',
                                line,
                                `Payment: ${first.payment_method.replace('_', ' ')}`,
                                `Paid: ${formatCurrency(first.amount_paid)}`,
                                `Change: ${formatCurrency(first.change_amount)}`,
                                '\n',
                                center('Thank you for your purchase!'),
                                '\n\n\n',
                                '\x1D\x56\x00'
                            )

                            await EscPosPrinter.sendToPrinter({
                                hashKey: printerHashKey,
                                data: textToPrinterBytes(receiptLines.join('\n')),
                                waitingTime: 3000
                            })

                            setPrinterMessage(`Receipt ${first.receipt_number} printed successfully.`)
                        } catch (printError) {
                            setPrinterError(
                                `Sale saved, but automatic printing failed: ${printError.message}`
                            )
                        }
                    }, 300)
                }
            } catch (receiptError) {
                console.error('Receipt loading failed:', receiptError)
                setError('Sale saved successfully, but the receipt could not be loaded. Use Recent Sales to reprint it.')
            }

            // Refresh the menu independently.
            try {
                await loadMenu()
            } catch (menuError) {
                console.error('Menu refresh failed:', menuError)
            }

            // Refresh sales history independently.
            try {
                await loadSalesHistory()
            } catch (historyError) {
                console.error('Sales history refresh failed:', historyError)
            }

        } catch (err) {
            setError(err.message || 'Checkout failed. Please try again.')
        } finally {
            setProcessing(false)
        }
    }

    async function loadReceipt(saleId) {
        setLoadingReceipt(true)
        setError('')

        const { data, error } = await supabase.rpc(
            'cashier_get_pos_receipt',
            { p_sale_id: saleId }
        )

        if (error) {
            setError(`Sale saved, but receipt could not be loaded: ${error.message}`)
            setReceiptDetails([])
        } else {
            setReceiptDetails(data || [])
        }

        setLoadingReceipt(false)
    }
    async function handleReprint(sale) {
        setLastReceipt({
            sale_id: sale.sale_id,
            receipt_number: sale.receipt_number
        })

        await loadReceipt(sale.sale_id)
    }
    return (
        <div className="page-content cashier-pos-page">
            <style>{`
                .cashier-pos-page { min-width: 0; width: 100%; }
                .cashier-pos-page, .cashier-pos-page * { box-sizing: border-box; }
                .cashier-pos-page button, .cashier-pos-page select, .cashier-pos-page input { min-height: 42px; }
                .cashier-pos-page input, .cashier-pos-page select { max-width: 100%; font-size: 16px; }
                .cashier-pos-page .cashier-product-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)) !important; gap: 6px; }
                .cashier-pos-page .cashier-category-list { display: flex; flex-wrap: wrap; gap: 8px; }
                .cashier-pos-page .cashier-cart-row { display: grid !important; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: 10px !important; }
                .cashier-pos-page .cashier-cart-row button { min-width: 42px; min-height: 42px; padding: 8px; }
                .cashier-pos-page .cashier-payment-actions { display: flex; flex-wrap: wrap; gap: 8px; }
                .cashier-pos-page .cashier-payment-actions button { min-height: 46px; }
                .cashier-pos-page .cashier-checkout-button { width: 100%; min-height: 50px; font-size: 16px; }
                .cashier-pos-page .cashier-table-wrap { width: 100%; max-width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
                @media (max-width: 600px) {
                    .cashier-pos-page { padding-left: 10px !important; padding-right: 10px !important; }
                    .cashier-pos-page .welcome-row h1 { font-size: 24px; }
                    .cashier-pos-page .welcome-row p { font-size: 13px; }
                    .cashier-pos-page .cashier-mobile-panel { padding: 12px !important; margin-top: 12px !important; }
                    .cashier-pos-page .cashier-printer-panel { padding: 12px !important; }
                    .cashier-pos-page .cashier-category-list { flex-wrap: nowrap; overflow-x: auto; padding: 2px 0 8px; scrollbar-width: thin; }
                    .cashier-pos-page .cashier-category-list button { flex: 0 0 auto; min-height: 42px; white-space: nowrap; }
                    .cashier-pos-page .cashier-product-grid { grid-template-columns: repeat(5, minmax(0, 1fr)) !important; gap: 4px; }
                    .cashier-pos-page .cashier-product-card { min-width: 0; min-height: 76px; padding: 5px 3px !important; overflow-wrap: anywhere; text-align: center !important; border-radius: 7px !important; }
                    .cashier-pos-page .cashier-product-card strong { display: block; font-size: 10px; line-height: 1.2; }
                    .cashier-pos-page .cashier-product-card > div { font-size: 8px !important; line-height: 1.15; margin-top: 2px; }
                    .cashier-pos-page .cashier-product-card svg { width: 12px; height: 12px; }
                    .cashier-pos-page .cashier-cart-row { grid-template-columns: minmax(0, 1fr) auto; gap: 6px 8px !important; }
                    .cashier-pos-page .cashier-cart-row > div:first-child { min-width: 0; }
                    .cashier-pos-page .cashier-cart-row > div:nth-child(2) { grid-column: 2; }
                    .cashier-pos-page .cashier-cart-row > strong { grid-column: 1 / -1; text-align: right; }
                    .cashier-pos-page .cashier-payment-actions button { flex: 1 1 calc(50% - 8px); justify-content: center; padding: 10px 8px !important; font-size: 13px; }
                    .cashier-pos-page .cashier-checkout-button { position: sticky; bottom: 8px; z-index: 3; }
                    .cashier-pos-page .cashier-printer-panel button { min-height: 44px; }
                    .cashier-pos-page .cash-pos-receipt { padding: 14px !important; }
                    .cashier-pos-page table { min-width: 560px; }
                }
                @media (max-width: 360px) {
                    .cashier-pos-page .cashier-product-grid { grid-template-columns: repeat(5, minmax(0, 1fr)) !important; gap: 3px; }
                    .cashier-pos-page .cashier-product-card { min-height: 68px; padding: 4px 2px !important; }
                    .cashier-pos-page .cashier-product-card strong { font-size: 9px; }
                    .cashier-pos-page .cashier-cart-row button { min-width: 38px; min-height: 40px; }
                }
            `}</style>
            <div className="welcome-row">
                <div>
                    <div className="eyebrow">SALES / POINT OF SALE</div>
                    <h1>Cashier POS</h1>
                    <p>{businessName} · Quick sales and checkout</p>
                </div>
            </div>


            <div className="cashier-printer-panel" style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '20px'
            }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px'
                }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '16px', color: '#162b42' }}>
                            Thermal Printer
                        </h3>
                        <p style={{ margin: '5px 0 0', fontSize: '13px', color: '#64748b' }}>
                            {printerConnected ? 'Printer connected' : 'No printer connected'}
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
                            borderRadius: '8px',
                            border: 'none',
                            background: '#123a63',
                            color: '#fff',
                            cursor: printerLoading || printerConnected ? 'not-allowed' : 'pointer'
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
                                    <option key={address || index} value={address}>
                                        {device.name || device.deviceName || address || `Printer ${index + 1}`}
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
                    <p style={{ color: '#176b45', fontSize: '13px', marginBottom: 0 }}>
                        {printerMessage}
                    </p>
                )}

                {printerError && (
                    <p style={{ color: '#b42318', fontSize: '13px', marginBottom: 0 }}>
                        {printerError}
                    </p>
                )}

                {!Capacitor.isNativePlatform() && (
                    <p style={{ color: '#64748b', fontSize: '12px', marginBottom: 0 }}>
                        Direct Bluetooth and USB printing is available in the Android app.
                        Browser printing remains available as a fallback.
                    </p>
                )}
            </div>


            {error && (
                <div className="panel" style={{ padding: 16, color: '#b42318' }}>
                    {error}
                </div>
            )}

            {successMessage && (
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
            )}


            <div className="panel cashier-mobile-panel" style={{ padding: 20, marginTop: 20 }}>
                <h2><ShoppingCart size={20} /> Current Sale</h2>

                {cart.length === 0 ? (
                    <p>Your cart is empty. Select menu items to begin.</p>
                ) : cart.map(item => (
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
                            <div>{formatCurrency(item.selling_price)} each</div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button onClick={() => updateQuantity(item.menu_item_id, -1)}>
                                <Minus size={15} />
                            </button>
                            {item.quantity}
                            <button onClick={() => updateQuantity(item.menu_item_id, 1)}>
                                <Plus size={15} />
                            </button>
                            <button onClick={() => removeFromCart(item.menu_item_id)}>
                                <Trash2 size={15} />
                            </button>
                        </div>

                        <strong>
                            {formatCurrency(item.quantity * Number(item.selling_price))}
                        </strong>
                    </div>
                ))}

                <h2 style={{ textAlign: 'right', marginTop: 20 }}>
                    TOTAL: {formatCurrency(total)}
                </h2>

                <div style={{
                    display: 'flex',
                    gap: 10,
                    flexWrap: 'wrap',
                    marginTop: 16
                }} className="cashier-payment-actions">
                    <button
                        type="button"
                        onClick={() => setPaymentMethod('cash')}
                        style={{
                            background: paymentMethod === 'cash' ? '#eaf3ee' : '#fff',
                            color: paymentMethod === 'cash' ? '#176b45' : '#64716a',
                            border: paymentMethod === 'cash' ? '2px solid #28785f' : '1px solid #dfe5df',
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
                            border: paymentMethod === 'mobile_money' ? '2px solid #28785f' : '1px solid #dfe5df',
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
                            border: paymentMethod === 'bank_card' ? '2px solid #28785f' : '1px solid #dfe5df',
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
                    onChange={event => setAmountPaid(event.target.value)}
                />

                <p>
                    Change: {formatCurrency(Math.max(0, Number(amountPaid || 0) - total))}
                </p>

                <button
                    type="button"
                    className="button button-primary cashier-checkout-button"
                    disabled={!cart.length || processing}
                    onClick={handleCheckout}
                >
                    <ReceiptText size={17} />
                    {processing ? 'Processing Sale...' : 'Checkout'}
                </button>
            </div>
            {loading ? (
                <div className="panel" style={{ padding: 24 }}>
                    Loading menu...
                </div>
            ) : (
                <div className="panel cashier-mobile-panel" style={{ padding: 20 }}>
                    <Search size={17} />
                    <input
                        placeholder="Search menu items..."
                        value={search}
                        onChange={event => setSearch(event.target.value)}
                    />

                    <div className="cashier-category-list" style={{
                        display: 'flex',
                        gap: 8,
                        flexWrap: 'wrap',
                        margin: '16px 0'
                    }}>
                        {categories.map(category => (
                            <button
                                key={category}
                                type="button"
                                onClick={() => setActiveCategory(category)}
                                className="button button-light"
                                style={{
                                    background: activeCategory === category ? '#eaf3ee' : '#fff'
                                }}
                            >
                                {category}
                            </button>
                        ))}
                    </div>

                    <div className="cashier-product-grid" style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))',
                        gap: 12
                    }}>
                        {filteredItems.map(item => {
                            const priceConfigured = Number(item.selling_price) > 0

                            const stockAvailable = Number(
                                item.inventory_stock_quantity ?? item.current_quantity ?? 0
                            )

                            const saleReady = priceConfigured

                            let unavailableReason = ''

                            if (!priceConfigured) {
                                unavailableReason = 'Price not configured'
                            } else if (stockAvailable <= 0) {
                                unavailableReason = 'No recorded stock — physical confirmation required at checkout'
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
                                        padding: 16,
                                        textAlign: 'left',
                                        cursor: saleReady ? 'pointer' : 'not-allowed',
                                        opacity: saleReady ? 1 : 0.55,
                                        border: saleReady
                                            ? '1px solid #e2e8f0'
                                            : '1px solid #fca5a5'
                                    }}
                                >
                                    <strong>{item.item_name}</strong>
                                    <div>{item.unit}</div>

                                    <strong>{formatCurrency(item.selling_price)}</strong>
                                    <div style={{ fontSize: 12, color: '#64748b' }}>
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
            )}

            {lastReceipt && (
                <div className="panel cash-pos-receipt" style={{
                    padding: 24,
                    marginTop: 20,
                    maxWidth: 480,
                    marginLeft: 'auto',
                    marginRight: 'auto'
                }}>
                    <div style={{ textAlign: 'center', marginBottom: 20 }}>
                        <h2>{businessName || 'Mbare Chitekete Canteen'}</h2>
                        <p>SALES RECEIPT</p>
                        <strong>{lastReceipt.receipt_number}</strong>
                    </div>

                    {loadingReceipt ? (
                        <p>Loading receipt...</p>
                    ) : receiptDetails.length > 0 ? (
                        <>
                            <p>
                                Date: {new Date(receiptDetails[0].sale_datetime)
                                    .toLocaleString('en-GB', {
                                        timeZone: 'Africa/Harare'
                                    })}
                            </p>
                            <p>Cashier: {receiptDetails[0].cashier_name}</p>

                            <hr />

                            {receiptDetails.map((item, index) => (
                                <div key={`${item.sale_id}-${index}`} style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    gap: 12,
                                    padding: '8px 0'
                                }}>
                                    <div>
                                        <strong>{item.item_name}</strong>
                                        <div>
                                            {item.quantity} × {formatCurrency(item.unit_price)}
                                        </div>
                                    </div>
                                    <strong>{formatCurrency(item.line_total)}</strong>
                                </div>
                            ))}

                            <hr />

                            <h2 style={{ textAlign: 'right' }}>
                                TOTAL: {formatCurrency(receiptDetails[0].total_amount)}
                            </h2>

                            <p>Payment: {receiptDetails[0].payment_method.replace('_', ' ')}</p>
                            <p>Amount paid: {formatCurrency(receiptDetails[0].amount_paid)}</p>
                            <p>Change: {formatCurrency(receiptDetails[0].change_amount)}</p>

                            <p style={{ textAlign: 'center', marginTop: 20 }}>
                                Thank you for your purchase!
                            </p>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'center',
                                gap: 10,
                                marginTop: 20
                            }}>
                                <button
                                    type="button"
                                    className="button button-primary"
                                    disabled={loadingReceipt || printerLoading || receiptDetails.length === 0}
                                    onClick={printReceipt}
                                >
                                    <ReceiptText size={16} />
                                    {loadingReceipt
                                        ? 'Loading Receipt...'
                                        : printerLoading
                                            ? 'Printing...'
                                            : 'Print Receipt'}
                                </button>
                            </div>
                        </>
                    ) : (
                        <p>Receipt details are unavailable.</p>
                    )}
                </div>
            )}
            <div className="panel cashier-mobile-panel" style={{ padding: 20, marginTop: 20 }}>
                <h2>
                    <ReceiptText size={20} />
                    Recent Sales
                </h2>

                {loadingHistory ? (
                    <p>Loading sales history...</p>
                ) : salesHistory.length === 0 ? (
                    <p>No sales recorded yet.</p>
                ) : (
                    <div className="cashier-table-wrap" style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
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
                                            {new Date(sale.sale_datetime).toLocaleString(
                                                'en-GB',
                                                { timeZone: 'Africa/Harare' }
                                            )}
                                        </td>
                                        <td>{sale.payment_method.replace('_', ' ')}</td>
                                        <td align="right">
                                            {formatCurrency(sale.total_amount)}
                                        </td>
                                        <td>
                                            <button
                                                type="button"
                                                className="button button-light"
                                                onClick={() => handleReprint(sale)}
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
