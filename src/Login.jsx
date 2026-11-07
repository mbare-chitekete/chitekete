
import { useState } from 'react'
import {
    Utensils,
    LockKeyhole,
    Mail,
    Eye,
    EyeOff,
    ArrowRight,
    ShieldCheck
} from 'lucide-react'
import { supabase } from './supabase'

export default function Login() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    async function handleLogin(e) {
        e.preventDefault()

        if (loading) return

        setError('')
        setLoading(true)

        try {
            const { error: loginError } =
                await supabase.auth.signInWithPassword({
                    email: email.trim(),
                    password
                })

            if (loginError) throw loginError

            // AuthGate handles the authenticated session.
            // App checks the employee's assigned role.
        } catch (err) {
            setError(
                err.message === 'Invalid login credentials'
                    ? 'Incorrect email or password. Please try again.'
                    : err.message || 'Unable to sign in. Please try again.'
            )
        } finally {
            setLoading(false)
        }
    }

    const inputStyle = {
        width: '100%',
        boxSizing: 'border-box',
        padding: '14px 14px 14px 44px',
        border: '1px solid #dce4ec',
        borderRadius: 10,
        fontSize: 14,
        outline: 'none',
        background: '#fbfcfe',
        color: '#162b42'
    }

    return (
        <main style={{
            minHeight: '100vh',
            display: 'grid',
            placeItems: 'center',
            background: 'linear-gradient(135deg, #edf3f8, #f8fafc)',
            padding: 20,
            boxSizing: 'border-box'
        }}>
            <div style={{
                width: '100%',
                maxWidth: 440
            }}>
                <div style={{
                    textAlign: 'center',
                    marginBottom: 24
                }}>
                    <div style={{
                        width: 66,
                        height: 66,
                        display: 'grid',
                        placeItems: 'center',
                        margin: '0 auto 14px',
                        borderRadius: 19,
                        background: '#123a63',
                        color: '#fff',
                        boxShadow: '0 8px 22px #123a6330'
                    }}>
                        <Utensils size={30} />
                    </div>

                    <h1 style={{
                        color: '#162b42',
                        fontSize: 24,
                        fontWeight: 800,
                        margin: 0
                    }}>
                        Mbare Chitekete
                    </h1>

                    <p style={{
                        color: '#718096',
                        fontSize: 13,
                        marginTop: 6
                    }}>
                        Canteen Management System
                    </p>
                </div>

                <form
                    onSubmit={handleLogin}
                    style={{
                        background: '#fff',
                        padding: '32px 30px',
                        borderRadius: 18,
                        border: '1px solid #e5ebf1',
                        boxShadow: '0 15px 45px #162b4210'
                    }}
                >
                    <h2 style={{
                        color: '#162b42',
                        fontSize: 23,
                        fontWeight: 800,
                        margin: '0 0 7px'
                    }}>
                        Welcome back
                    </h2>

                    <p style={{
                        color: '#718096',
                        fontSize: 13,
                        margin: '0 0 27px'
                    }}>
                        Sign in to access your workspace.
                    </p>

                    <div style={{ marginBottom: 19 }}>
                        <label style={{
                            display: 'block',
                            marginBottom: 8,
                            fontSize: 13,
                            fontWeight: 700,
                            color: '#354b60'
                        }}>
                            Email address
                        </label>

                        <div style={{ position: 'relative' }}>
                            <Mail size={18} style={{
                                position: 'absolute',
                                left: 14,
                                top: 14,
                                color: '#8492a6'
                            }} />

                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="Enter your email"
                                autoComplete="username"
                                required
                                disabled={loading}
                                style={inputStyle}
                            />
                        </div>
                    </div>

                    <div style={{ marginBottom: 20 }}>
                        <label style={{
                            display: 'block',
                            marginBottom: 8,
                            fontSize: 13,
                            fontWeight: 700,
                            color: '#354b60'
                        }}>
                            Password
                        </label>

                        <div style={{ position: 'relative' }}>
                            <LockKeyhole size={18} style={{
                                position: 'absolute',
                                left: 14,
                                top: 14,
                                color: '#8492a6'
                            }} />

                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="Enter your password"
                                autoComplete="current-password"
                                required
                                disabled={loading}
                                style={{
                                    ...inputStyle,
                                    paddingRight: 46
                                }}
                            />

                            <button
                                type="button"
                                onClick={() => setShowPassword(value => !value)}
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                                style={{
                                    position: 'absolute',
                                    right: 12,
                                    top: 10,
                                    padding: 5,
                                    border: 0,
                                    background: 'transparent',
                                    color: '#8492a6',
                                    cursor: 'pointer'
                                }}
                            >
                                {showPassword
                                    ? <EyeOff size={19} />
                                    : <Eye size={19} />
                                }
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div
                            role="alert"
                            style={{
                                color: '#b42318',
                                background: '#fff1f0',
                                border: '1px solid #ffd5d2',
                                padding: 12,
                                borderRadius: 9,
                                fontSize: 13,
                                marginBottom: 17
                            }}
                        >
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 9,
                            padding: 14,
                            border: 0,
                            borderRadius: 10,
                            background: '#28785f',
                            color: '#fff',
                            fontWeight: 700,
                            fontSize: 14,
                            cursor: loading ? 'wait' : 'pointer',
                            opacity: loading ? 0.7 : 1
                        }}
                    >
                        {loading ? 'Signing in...' : 'Sign in'}
                        {!loading && <ArrowRight size={17} />}
                    </button>

                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 7,
                        marginTop: 23,
                        color: '#8492a6',
                        fontSize: 11
                    }}>
                        <ShieldCheck size={15} />
                        Secure role-based employee access
                    </div>
                </form>

                <p style={{
                    textAlign: 'center',
                    color: '#94a3b8',
                    fontSize: 11,
                    marginTop: 22
                }}>
                    © {new Date().getFullYear()} Mbare Chitekete
                </p>
            </div>
        </main>
    )
}
