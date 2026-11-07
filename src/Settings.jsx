
import { useEffect, useState } from 'react'
import {
    Settings as SettingsIcon,
    Building2,
    DollarSign,
    BellRing,
    Save,
    RefreshCw,
    Mail,
    Phone,
    MapPin,
    CheckCircle2
} from 'lucide-react'
import { supabase } from './supabase'
import { useCurrency } from './CurrencyContext'

const CURRENCIES = [
    { value: 'USD', label: 'US Dollar ($)', symbol: '$' },
    { value: 'ZAR', label: 'South African Rand (R)', symbol: 'R' },
    { value: 'ZWG', label: 'Zimbabwe Gold (ZiG)', symbol: 'ZiG' }
]

const EMPTY_SETTINGS = {
    business_name: 'Main Canteen',
    business_address: '',
    business_phone: '',
    business_email: '',
    currency_code: 'USD',
    low_stock_alert_enabled: true,
    default_sales_notes: ''
}

const styles = {
    page: { maxWidth: '1100px', margin: '0 auto', padding: '24px', color: '#162b42' },
    heading: { marginBottom: '22px' },
    title: { fontSize: '25px', fontWeight: 800, margin: 0 },
    subtitle: { fontSize: '13px', color: '#718096', marginTop: '6px' },
    panel: { background: '#fff', border: '1px solid #e5ebf1', borderRadius: '13px', padding: '21px', marginBottom: '18px' },
    panelTitle: { display: 'flex', alignItems: 'center', gap: '10px', fontSize: '16px', fontWeight: 800, marginBottom: '7px' },
    panelDescription: { fontSize: '12px', color: '#718096', margin: '0 0 19px' },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '16px' },
    label: { display: 'block', fontSize: '12px', fontWeight: 700, color: '#526477', marginBottom: '7px' },
    input: { width: '100%', boxSizing: 'border-box', padding: '11px 12px', border: '1px solid #dce5ed', borderRadius: '8px', fontSize: '13px', color: '#162b42', background: '#fff' },
    hint: { fontSize: '11px', color: '#8492a1', marginTop: '6px' },
    saveButton: { display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#16734a', color: '#fff', border: 0, borderRadius: '9px', padding: '12px 19px', fontWeight: 700, cursor: 'pointer' },
    message: { background: '#eff8f2', color: '#17633c', padding: '12px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' },
    error: { background: '#fff0f0', color: '#a52b2b', padding: '12px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' },
    notice: { background: '#f3f7fb', border: '1px solid #e1eaf2', borderRadius: '9px', padding: '13px', fontSize: '12px', color: '#526477', lineHeight: 1.6, marginTop: '15px' },
    toggleRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '15px', padding: '14px 0' },
    toggleText: { fontSize: '13px', fontWeight: 700 },
    toggleDescription: { fontSize: '12px', color: '#718096', marginTop: '5px' }
}

export default function Settings() {
    const { refreshCurrency } = useCurrency()
    const [settings, setSettings] = useState(EMPTY_SETTINGS)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState('')
    const [errorMessage, setErrorMessage] = useState('')


    async function loadSettings() {
        setLoading(true)
        setErrorMessage('')

        try {
            const { data, error } = await supabase
                .from('canteen_settings')
                .select('*')
                .eq('id', true)
                .maybeSingle()

            if (error) {
                setErrorMessage(error.message)
            } else if (data) {
                setSettings({
                    ...EMPTY_SETTINGS,
                    ...data,
                    business_name: data.business_name ?? EMPTY_SETTINGS.business_name,
                    business_address: data.business_address ?? '',
                    business_phone: data.business_phone ?? '',
                    business_email: data.business_email ?? '',
                    default_sales_notes: data.default_sales_notes ?? ''
                })
            }
        } catch (error) {
            setErrorMessage(error.message || 'Could not load settings.')
        } finally {
            setLoading(false)
        }
    }


    useEffect(() => {
        loadSettings()
    }, [])

    function updateField(field, value) {
        setSettings(current => ({
            ...current,
            [field]: value
        }))
    }

    async function saveSettings(event) {
        event.preventDefault()
        setSaving(true)
        setMessage('')
        setErrorMessage('')

        try {
            if (!(settings.business_name ?? '').trim()) {
                setErrorMessage('Please enter your canteen name.')
                return
            }
            const payload = {
                id: true,
                business_name: (settings.business_name ?? '').trim(),
                business_address: (settings.business_address ?? '').trim() || null,
                business_phone: (settings.business_phone ?? '').trim() || null,
                business_email: (settings.business_email ?? '').trim() || null,
                currency_code: settings.currency_code,
                low_stock_alert_enabled: settings.low_stock_alert_enabled,
                default_sales_notes: (settings.default_sales_notes ?? '').trim() || null,
                updated_at: new Date().toISOString()
            }

            const { error } = await supabase
                .from('canteen_settings')
                .upsert(payload, { onConflict: 'id' })

            if (error) {
                setErrorMessage(error.message)
            } else {
                await refreshCurrency()
                setMessage('Your settings have been saved successfully.')
                await loadSettings()
            }
        } catch (error) {
            setErrorMessage(error.message || 'Something went wrong while saving settings.')
        } finally {
            setSaving(false)
        }
    }


    const selectedCurrency = CURRENCIES.find(
        currency => currency.value === settings.currency_code
    )

    if (loading) {
        return (
            <div style={styles.page}>
                <p>Loading settings...</p>
            </div>
        )
    }

    return (
        <div style={styles.page}>
            <div style={styles.heading}>
                <h1 style={styles.title}>Settings</h1>
                <p style={styles.subtitle}>
                    Manage your canteen profile, currency and operating preferences.
                </p>
            </div>

            {message && <div style={styles.message}><CheckCircle2 size={15} style={{ verticalAlign: 'middle', marginRight: 7 }} />{message}</div>}
            {errorMessage && <div style={styles.error}>{errorMessage}</div>}

            <form onSubmit={saveSettings}>
                <section style={styles.panel}>
                    <div style={styles.panelTitle}>
                        <Building2 size={19} color="#16734a" />
                        Business Profile
                    </div>
                    <p style={styles.panelDescription}>
                        Enter your canteen's business and contact information.
                    </p>

                    <div style={styles.grid}>
                        <div>
                            <label style={styles.label}>Canteen / Business Name *</label>
                            <input
                                required
                                style={styles.input}
                                value={settings.business_name}
                                onChange={e => updateField('business_name', e.target.value)}
                                placeholder="Main Canteen"
                            />
                        </div>

                        <div>
                            <label style={styles.label}>Phone Number</label>
                            <div style={{ position: 'relative' }}>
                                <Phone size={15} style={{ position: 'absolute', left: 11, top: 12, color: '#8998a8' }} />
                                <input
                                    style={{ ...styles.input, paddingLeft: 34 }}
                                    value={settings.business_phone || ''}
                                    onChange={e => updateField('business_phone', e.target.value)}
                                    placeholder="Business phone"
                                />
                            </div>
                        </div>

                        <div>
                            <label style={styles.label}>Business Email</label>
                            <div style={{ position: 'relative' }}>
                                <Mail size={15} style={{ position: 'absolute', left: 11, top: 12, color: '#8998a8' }} />
                                <input
                                    type="email"
                                    style={{ ...styles.input, paddingLeft: 34 }}
                                    value={settings.business_email || ''}
                                    onChange={e => updateField('business_email', e.target.value)}
                                    placeholder="Business email"
                                />
                            </div>
                        </div>

                        <div>
                            <label style={styles.label}>Business Address</label>
                            <div style={{ position: 'relative' }}>
                                <MapPin size={15} style={{ position: 'absolute', left: 11, top: 12, color: '#8998a8' }} />
                                <input
                                    style={{ ...styles.input, paddingLeft: 34 }}
                                    value={settings.business_address || ''}
                                    onChange={e => updateField('business_address', e.target.value)}
                                    placeholder="Canteen address"
                                />
                            </div>
                        </div>
                    </div>
                </section>

                <section style={styles.panel}>
                    <div style={styles.panelTitle}>
                        <DollarSign size={19} color="#16734a" />
                        Currency Settings
                    </div>
                    <p style={styles.panelDescription}>
                        Choose the currency used to display financial amounts.
                    </p>

                    <div style={{ maxWidth: '420px' }}>
                        <label style={styles.label}>Default Currency</label>
                        <select
                            style={styles.input}
                            value={settings.currency_code}
                            onChange={e => updateField('currency_code', e.target.value)}
                        >
                            {CURRENCIES.map(currency => (
                                <option key={currency.value} value={currency.value}>
                                    {currency.label}
                                </option>
                            ))}
                        </select>

                        <p style={styles.hint}>
                            Current selection: {selectedCurrency?.label} ({selectedCurrency?.symbol})
                        </p>
                    </div>

                    <div style={styles.notice}>
                        Changing the currency changes the selected display preference only.
                        It does not convert previously recorded sales, purchases, expenses
                        or cash balances. Keep records in the currency in which they were
                        originally entered.
                    </div>
                </section>

                <section style={styles.panel}>
                    <div style={styles.panelTitle}>
                        <BellRing size={19} color="#16734a" />
                        Stock Alerts
                    </div>
                    <p style={styles.panelDescription}>
                        Control whether low-stock warnings should be enabled.
                    </p>

                    <div style={styles.toggleRow}>
                        <div>
                            <div style={styles.toggleText}>Enable low-stock alerts</div>
                            <div style={styles.toggleDescription}>
                                Show warnings when stock reaches its minimum quantity.
                            </div>
                        </div>

                        <input
                            type="checkbox"
                            checked={settings.low_stock_alert_enabled}
                            onChange={e => updateField('low_stock_alert_enabled', e.target.checked)}
                            style={{ width: 19, height: 19, accentColor: '#16734a', cursor: 'pointer' }}
                        />
                    </div>
                </section>

                <section style={styles.panel}>
                    <div style={styles.panelTitle}>
                        <SettingsIcon size={19} color="#16734a" />
                        Sales Preferences
                    </div>
                    <p style={styles.panelDescription}>
                        Add optional default notes for daily sales records.
                    </p>

                    <label style={styles.label}>Default Sales Notes</label>
                    <textarea
                        rows="3"
                        style={{ ...styles.input, resize: 'vertical' }}
                        value={settings.default_sales_notes || ''}
                        onChange={e => updateField('default_sales_notes', e.target.value)}
                        placeholder="Optional notes to use as a reminder when recording sales..."
                    />
                </section>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
                    <button type="button" style={{ ...styles.saveButton, background: '#fff', color: '#526477', border: '1px solid #dce5ed' }} onClick={loadSettings}>
                        <RefreshCw size={16} /> Reload Settings
                    </button>

                    <button type="submit" disabled={saving} style={{ ...styles.saveButton, opacity: saving ? 0.65 : 1 }}>
                        <Save size={16} /> {saving ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            </form>
        </div>
    )
}
