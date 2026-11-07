
import { useEffect, useState } from 'react'
import { Utensils, LoaderCircle } from 'lucide-react'
import { supabase } from './supabase'
import Login from './Login'
import App from './App'
import { CurrencyProvider } from './CurrencyContext'

export default function AuthGate() {
    const [session, setSession] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let mounted = true

        const {
            data: { subscription }
        } = supabase.auth.onAuthStateChange((_event, newSession) => {
            if (!mounted) return

            setSession(newSession || null)
            setLoading(false)
        })

        async function loadSession() {
            try {
                const { data, error } = await supabase.auth.getSession()

                if (error) throw error

                if (mounted) {
                    setSession(data?.session || null)
                }
            } catch (error) {
                console.error('Session check failed:', error.message)

                if (mounted) {
                    setSession(null)
                }
            } finally {
                if (mounted) {
                    setLoading(false)
                }
            }
        }

        loadSession()

        return () => {
            mounted = false
            subscription.unsubscribe()
        }
    }, [])

    if (loading) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 16,
                background: '#f3f6fa',
                color: '#28785f',
                fontFamily: 'sans-serif'
            }}>
                <div style={{
                    width: 62,
                    height: 62,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: 18,
                    background: '#123a63',
                    color: '#fff'
                }}>
                    <Utensils size={29} />
                </div>

                <LoaderCircle
                    size={23}
                    style={{
                        animation: 'auth-spin 1s linear infinite'
                    }}
                />

                <div style={{
                    color: '#162b42',
                    fontSize: 14,
                    fontWeight: 700
                }}>
                    Checking account access...
                </div>

                <style>
                    {`
                        @keyframes auth-spin {
                            to { transform: rotate(360deg); }
                        }
                    `}
                </style>
            </div>
        )
    }

    return session ? (
        <CurrencyProvider>
            <App />
        </CurrencyProvider>
    ) : (
        <Login />
    )
}
