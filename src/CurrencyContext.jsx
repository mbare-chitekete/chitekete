
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const CurrencyContext = createContext(null)

export const SUPPORTED_CURRENCIES = [
    { code: 'USD', name: 'US Dollar', symbol: '$' },
    { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
    { code: 'ZWG', name: 'Zimbabwe Gold', symbol: 'ZiG' }
]

const CURRENCY_SYMBOLS = {
    USD: '$',
    ZAR: 'R',
    ZWG: 'ZiG'
}

const SUPPORTED_CODES = SUPPORTED_CURRENCIES.map(
    currency => currency.code
)

// Formats an amount using the specified currency.
// Defaults to USD if no valid currency is supplied.
export function formatMoney(value, currency = 'USD') {
    const amount = Number(value) || 0
    const code = SUPPORTED_CODES.includes(currency) ? currency : 'USD'
    const symbol = CURRENCY_SYMBOLS[code]

    const formattedAmount = new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount)

    return `${symbol}${formattedAmount}`
}

export function CurrencyProvider({ children }) {
    const [currencyCode, setCurrencyCode] = useState('USD')
    const [loadingCurrency, setLoadingCurrency] = useState(true)

    async function refreshCurrency() {
        try {
            const { data, error } = await supabase
                .from('canteen_settings')
                .select('currency_code')
                .eq('id', true)
                .maybeSingle()

            if (error) throw error

            if (
                data?.currency_code &&
                SUPPORTED_CODES.includes(data.currency_code)
            ) {
                setCurrencyCode(data.currency_code)
            }
        } catch (error) {
            console.error(
                'Could not load currency:',
                error.message || error
            )
        }
    }

    useEffect(() => {
        let active = true

        async function loadCurrency() {
            try {
                const { data, error } = await supabase
                    .from('canteen_settings')
                    .select('currency_code')
                    .eq('id', true)
                    .maybeSingle()

                if (error) throw error

                if (
                    active &&
                    data?.currency_code &&
                    SUPPORTED_CODES.includes(data.currency_code)
                ) {
                    setCurrencyCode(data.currency_code)
                }
            } catch (error) {
                console.error(
                    'Could not load currency:',
                    error.message || error
                )
            } finally {
                if (active) setLoadingCurrency(false)
            }
        }

        loadCurrency()

        return () => {
            active = false
        }
    }, [])

    // Existing components continue using the Settings currency.
    function formatCurrency(value) {
        return formatMoney(value, currencyCode)
    }

    // Use this for sales, purchases, expenses and other
    // historical transactions with their own currency_code.
    function formatTransactionCurrency(value, transactionCurrency) {
        return formatMoney(value, transactionCurrency)
    }

    return (
        <CurrencyContext.Provider
            value={{
                currencyCode,
                currencySymbol: CURRENCY_SYMBOLS[currencyCode],
                formatCurrency,
                formatTransactionCurrency,
                formatMoney,
                refreshCurrency,
                loadingCurrency,
                supportedCurrencies: SUPPORTED_CURRENCIES
            }}
        >
            {children}
        </CurrencyContext.Provider>
    )
}

export function useCurrency() {
    const context = useContext(CurrencyContext)

    if (!context) {
        throw new Error('useCurrency must be used inside CurrencyProvider')
    }

    return context
}
