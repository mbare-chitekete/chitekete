
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const CurrencyContext = createContext(null)

const CURRENCY_SYMBOLS = {
    USD: '$',
    ZAR: 'R',
    ZWG: 'ZiG'
}

export function CurrencyProvider({ children }) {
    const [currencyCode, setCurrencyCode] = useState('USD')
    const [loadingCurrency, setLoadingCurrency] = useState(true)

    async function refreshCurrency() {
        const { data, error } = await supabase
            .from('canteen_settings')
            .select('currency_code')
            .eq('id', true)
            .maybeSingle()

        if (error) {
            console.error('Could not load currency:', error.message)
            return
        }

        if (data?.currency_code && CURRENCY_SYMBOLS[data.currency_code]) {
            setCurrencyCode(data.currency_code)
        }
    }

    useEffect(() => {
        async function loadCurrency() {
            await refreshCurrency()
            setLoadingCurrency(false)
        }

        loadCurrency()
    }, [])

    function formatCurrency(value) {
        const amount = Number(value) || 0
        const symbol = CURRENCY_SYMBOLS[currencyCode] || '$'

        return `${symbol}${new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount)}`
    }

    return (
        <CurrencyContext.Provider
            value={{
                currencyCode,
                currencySymbol: CURRENCY_SYMBOLS[currencyCode],
                formatCurrency,
                refreshCurrency,
                loadingCurrency
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
