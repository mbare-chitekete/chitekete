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
    CheckCircle2,
    Clock,
    ImagePlus,
    Facebook,
    Instagram,
    MessageCircle,
    Trash2,
    ExternalLink
} from 'lucide-react'
import { supabase } from './supabase'
import { useCurrency } from './CurrencyContext'

const CURRENCIES = [
    { value: 'USD', label: 'US Dollar ($)', symbol: '$' },
    { value: 'ZAR', label: 'South African Rand (R)', symbol: 'R' },
    { value: 'ZWG', label: 'Zimbabwe Gold (ZiG)', symbol: 'ZiG' }
]

const DAYS = [
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
    { value: 7, label: 'Sunday' }
]

const EMPTY_SETTINGS = {
    business_name: '',
    business_address: '',
    business_phone: '',
    business_email: '',
    business_mobile_1: '',
    business_mobile_2: '',
    business_whatsapp: '',
    instagram_url: '',
    facebook_url: '',
    google_maps_url: '',
    business_latitude: '',
    business_longitude: '',
    website_photo_1_url: '',
    website_photo_2_url: '',
    website_photo_3_url: '',
    opening_time: '',
    closing_time: '',
    opening_days: [1, 2, 3, 4, 5, 6, 7],
    currency_code: 'USD',
    fx_rate_to_usd: 1,
    low_stock_alert_enabled: true,
    default_sales_notes: ''
}

const PHOTO_SLOTS = [
    {
        field: 'website_photo_1_url',
        key: 'exterior',
        title: 'Canteen exterior',
        description: 'The outside of your canteen or its entrance.'
    },
    {
        field: 'website_photo_2_url',
        key: 'preparation',
        title: 'Kitchen and preparation area',
        description: 'Your food preparation and working space.'
    },
    {
        field: 'website_photo_3_url',
        key: 'serving',
        title: 'Serving and dining area',
        description: 'Your serving counter or customer seating area.'
    }
]

const styles = {
    page: {
        maxWidth: '1100px',
        margin: '0 auto',
        padding: '24px',
        color: '#162b42'
    },
    heading: { marginBottom: '22px' },
    title: { fontSize: '25px', fontWeight: 800, margin: 0 },
    subtitle: { fontSize: '13px', color: '#718096', marginTop: '6px' },
    panel: {
        background: '#fff',
        border: '1px solid #e5ebf1',
        borderRadius: '13px',
        padding: '21px',
        marginBottom: '18px'
    },
    panelTitle: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontSize: '16px',
        fontWeight: 800,
        marginBottom: '7px'
    },
    panelDescription: {
        fontSize: '12px',
        color: '#718096',
        margin: '0 0 19px'
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
        gap: '16px'
    },
    label: {
        display: 'block',
        fontSize: '12px',
        fontWeight: 700,
        color: '#526477',
        marginBottom: '7px'
    },
    input: {
        width: '100%',
        boxSizing: 'border-box',
        padding: '11px 12px',
        border: '1px solid #dce5ed',
        borderRadius: '8px',
        fontSize: '13px',
        color: '#162b42',
        background: '#fff'
    },
    hint: {
        fontSize: '11px',
        color: '#8492a1',
        marginTop: '6px',
        lineHeight: 1.5
    },
    saveButton: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        background: '#16734a',
        color: '#fff',
        border: 0,
        borderRadius: '9px',
        padding: '12px 19px',
        fontWeight: 700,
        cursor: 'pointer'
    },
    message: {
        background: '#eff8f2',
        color: '#17633c',
        padding: '12px 14px',
        borderRadius: '8px',
        fontSize: '13px',
        marginBottom: '16px'
    },
    error: {
        background: '#fff0f0',
        color: '#a52b2b',
        padding: '12px 14px',
        borderRadius: '8px',
        fontSize: '13px',
        marginBottom: '16px'
    },
    notice: {
        background: '#f3f7fb',
        border: '1px solid #e1eaf2',
        borderRadius: '9px',
        padding: '13px',
        fontSize: '12px',
        color: '#526477',
        lineHeight: 1.6,
        marginTop: '15px'
    },
    toggleRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '15px',
        padding: '14px 0'
    },
    toggleText: { fontSize: '13px', fontWeight: 700 },
    toggleDescription: {
        fontSize: '12px',
        color: '#718096',
        marginTop: '5px'
    },
    dayGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit,minmax(115px,1fr))',
        gap: '9px'
    },
    dayLabel: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        border: '1px solid #dce5ed',
        borderRadius: '8px',
        padding: '10px',
        fontSize: '12px',
        cursor: 'pointer'
    },
    photoCard: {
        border: '1px solid #e5ebf1',
        borderRadius: '10px',
        padding: '13px',
        minWidth: 0
    },
    photoPreview: {
        width: '100%',
        height: '165px',
        objectFit: 'cover',
        borderRadius: '8px',
        background: '#f1f5f9',
        marginBottom: '12px'
    }
}

export default function Settings() {
    const { refreshCurrency } = useCurrency()

    const [settings, setSettings] = useState(EMPTY_SETTINGS)
    const [photoFiles, setPhotoFiles] = useState({})
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

            if (error) throw error

            if (data) {
                setSettings({
                    ...EMPTY_SETTINGS,
                    ...data,
                    business_name: data.business_name ?? '',
                    business_address: data.business_address ?? '',
                    business_phone: data.business_phone ?? '',
                    business_email: data.business_email ?? '',
                    business_mobile_1: data.business_mobile_1 ?? '',
                    business_mobile_2: data.business_mobile_2 ?? '',
                    business_whatsapp: data.business_whatsapp ?? '',
                    instagram_url: data.instagram_url ?? '',
                    facebook_url: data.facebook_url ?? '',
                    google_maps_url: data.google_maps_url ?? '',
                    business_latitude: data.business_latitude ?? '',
                    business_longitude: data.business_longitude ?? '',
                    website_photo_1_url: data.website_photo_1_url ?? '',
                    website_photo_2_url: data.website_photo_2_url ?? '',
                    website_photo_3_url: data.website_photo_3_url ?? '',
                    opening_time: data.opening_time?.slice(0, 5) ?? '',
                    closing_time: data.closing_time?.slice(0, 5) ?? '',
                    opening_days: Array.isArray(data.opening_days)
                        ? data.opening_days
                        : EMPTY_SETTINGS.opening_days,
                    default_sales_notes: data.default_sales_notes ?? '',
                    fx_rate_to_usd:
                        data.fx_rate_to_usd == null
                            ? (data.currency_code === 'USD' ? 1 : '')
                            : String(data.fx_rate_to_usd)
                })
            }

            setPhotoFiles({})
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

    function toggleDay(day) {
        setSettings(current => {
            const selected = current.opening_days || []
            const next = selected.includes(day)
                ? selected.filter(value => value !== day)
                : [...selected, day]

            return {
                ...current,
                opening_days: next.sort((a, b) => a - b)
            }
        })
    }

    function selectPhoto(field, file) {
        if (!file) return

        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            setErrorMessage('Please select a JPG, PNG or WebP image.')
            return
        }

        if (file.size > 5 * 1024 * 1024) {
            setErrorMessage('Each photo must be 5 MB or smaller.')
            return
        }

        setErrorMessage('')
        setPhotoFiles(current => ({
            ...current,
            [field]: file
        }))
    }

    async function uploadPhoto(file, slotKey) {
        const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
        const path = `${slotKey}/${crypto.randomUUID()}.${extension}`

        const { error: uploadError } = await supabase.storage
            .from('canteen-website')
            .upload(path, file, {
                contentType: file.type,
                upsert: false
            })

        if (uploadError) throw uploadError

        const { data } = supabase.storage
            .from('canteen-website')
            .getPublicUrl(path)

        return data.publicUrl
    }

    async function saveSettings(event) {
        event.preventDefault()
        setSaving(true)
        setMessage('')
        setErrorMessage('')

        try {
            const businessName = (settings.business_name || '').trim()

            if (!businessName) {
                throw new Error('Please enter your canteen name.')
            }

            if (!settings.opening_time || !settings.closing_time) {
                throw new Error(
                    'Please configure both opening and closing times before saving.'
                )
            }

            if (settings.opening_time >= settings.closing_time) {
                throw new Error('Closing time must be later than opening time.')
            }

            if (!settings.opening_days?.length) {
                throw new Error('Select at least one operating day.')
            }

            const selectedRate = Number(settings.fx_rate_to_usd)

            if (
                settings.currency_code !== 'USD' &&
                (!Number.isFinite(selectedRate) || selectedRate <= 0)
            ) {
                throw new Error(
                    'Please enter a valid positive exchange rate for the selected currency.'
                )
            }

            const latitude =
                settings.business_latitude === ''
                    ? null
                    : Number(settings.business_latitude)

            const longitude =
                settings.business_longitude === ''
                    ? null
                    : Number(settings.business_longitude)

            if (
                latitude !== null &&
                (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)
            ) {
                throw new Error('Enter a valid latitude between -90 and 90.')
            }

            if (
                longitude !== null &&
                (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)
            ) {
                throw new Error('Enter a valid longitude between -180 and 180.')
            }

            const photoUrls = {}

            for (const slot of PHOTO_SLOTS) {
                const file = photoFiles[slot.field]
                if (file) {
                    photoUrls[slot.field] = await uploadPhoto(file, slot.key)
                }
            }

            const payload = {
                id: true,
                business_name: businessName,
                business_address: settings.business_address.trim() || null,
                business_phone: settings.business_phone.trim() || null,
                business_email: settings.business_email.trim() || null,
                business_mobile_1: settings.business_mobile_1.trim() || null,
                business_mobile_2: settings.business_mobile_2.trim() || null,
                business_whatsapp: settings.business_whatsapp.trim() || null,
                instagram_url: settings.instagram_url.trim() || null,
                facebook_url: settings.facebook_url.trim() || null,
                google_maps_url: settings.google_maps_url.trim() || null,
                business_latitude: latitude,
                business_longitude: longitude,
                website_photo_1_url:
                    photoUrls.website_photo_1_url ??
                    settings.website_photo_1_url ??
                    null,
                website_photo_2_url:
                    photoUrls.website_photo_2_url ??
                    settings.website_photo_2_url ??
                    null,
                website_photo_3_url:
                    photoUrls.website_photo_3_url ??
                    settings.website_photo_3_url ??
                    null,
                opening_time: settings.opening_time,
                closing_time: settings.closing_time,
                opening_days: settings.opening_days,
                currency_code: settings.currency_code,
                fx_rate_to_usd:
                    settings.currency_code === 'USD' ? 1 : selectedRate,
                low_stock_alert_enabled: settings.low_stock_alert_enabled,
                default_sales_notes:
                    settings.default_sales_notes.trim() || null,
                updated_at: new Date().toISOString()
            }

            const { error } = await supabase
                .from('canteen_settings')
                .upsert(payload, { onConflict: 'id' })

            if (error) throw error

            await refreshCurrency()
            setMessage('Your settings have been saved successfully.')
            await loadSettings()
        } catch (error) {
            setErrorMessage(
                error.message || 'Something went wrong while saving settings.'
            )
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
                    Manage your canteen profile, public ordering website,
                    opening hours, currency and operating preferences.
                </p>
            </div>

            {message && (
                <div style={styles.message}>
                    <CheckCircle2 size={15} style={{ verticalAlign: 'middle', marginRight: 7 }} />
                    {message}
                </div>
            )}

            {errorMessage && <div style={styles.error}>{errorMessage}</div>}

            <form onSubmit={saveSettings}>
                {/* BUSINESS PROFILE */}
                <section style={styles.panel}>
                    <div style={styles.panelTitle}>
                        <Building2 size={19} color="#16734a" />
                        Business Profile
                    </div>
                    <p style={styles.panelDescription}>
                        These details appear on your public ordering website
                        and business documents.
                    </p>

                    <div style={styles.grid}>
                        <div>
                            <label style={styles.label}>Business Name *</label>
                            <input
                                required
                                maxLength={120}
                                style={styles.input}
                                value={settings.business_name}
                                onChange={e => updateField('business_name', e.target.value)}
                                placeholder="Enter your business name"
                            />
                        </div>

                        <div>
                            <label style={styles.label}>Business Phone</label>
                            <input
                                style={styles.input}
                                value={settings.business_phone}
                                onChange={e => updateField('business_phone', e.target.value)}
                                placeholder="Business phone"
                            />
                        </div>

                        <div>
                            <label style={styles.label}>Business Email</label>
                            <input
                                type="email"
                                style={styles.input}
                                value={settings.business_email}
                                onChange={e => updateField('business_email', e.target.value)}
                                placeholder="Business email"
                            />
                        </div>

                        <div>
                            <label style={styles.label}>Business Address</label>
                            <input
                                style={styles.input}
                                value={settings.business_address}
                                onChange={e => updateField('business_address', e.target.value)}
                                placeholder="Canteen address"
                            />
                        </div>

                        <div>
                            <label style={styles.label}>Mobile Number 1</label>
                            <input
                                style={styles.input}
                                value={settings.business_mobile_1}
                                onChange={e => updateField('business_mobile_1', e.target.value)}
                                placeholder="First mobile number"
                            />
                        </div>

                        <div>
                            <label style={styles.label}>Mobile Number 2</label>
                            <input
                                style={styles.input}
                                value={settings.business_mobile_2}
                                onChange={e => updateField('business_mobile_2', e.target.value)}
                                placeholder="Second mobile number"
                            />
                        </div>

                        <div>
                            <label style={styles.label}>WhatsApp Number</label>
                            <div style={{ position: 'relative' }}>
                                <MessageCircle
                                    size={15}
                                    style={{ position: 'absolute', left: 11, top: 12, color: '#8998a8' }}
                                />
                                <input
                                    style={{ ...styles.input, paddingLeft: 34 }}
                                    value={settings.business_whatsapp}
                                    onChange={e => updateField('business_whatsapp', e.target.value)}
                                    placeholder="WhatsApp number with country code"
                                />
                            </div>
                            <p style={styles.hint}>
                                Use international format, for example +263...
                            </p>
                        </div>

                        <div>
                            <label style={styles.label}>Instagram URL</label>
                            <div style={{ position: 'relative' }}>
                                <Instagram
                                    size={15}
                                    style={{ position: 'absolute', left: 11, top: 12, color: '#8998a8' }}
                                />
                                <input
                                    style={{ ...styles.input, paddingLeft: 34 }}
                                    value={settings.instagram_url}
                                    onChange={e => updateField('instagram_url', e.target.value)}
                                    placeholder="https://instagram.com/..."
                                />
                            </div>
                        </div>

                        <div>
                            <label style={styles.label}>Facebook URL</label>
                            <div style={{ position: 'relative' }}>
                                <Facebook
                                    size={15}
                                    style={{ position: 'absolute', left: 11, top: 12, color: '#8998a8' }}
                                />
                                <input
                                    style={{ ...styles.input, paddingLeft: 34 }}
                                    value={settings.facebook_url}
                                    onChange={e => updateField('facebook_url', e.target.value)}
                                    placeholder="https://facebook.com/..."
                                />
                            </div>
                        </div>
                    </div>
                </section>

                {/* LOCATION */}
                <section style={styles.panel}>
                    <div style={styles.panelTitle}>
                        <MapPin size={19} color="#16734a" />
                        Canteen Location
                    </div>
                    <p style={styles.panelDescription}>
                        Add a Google Maps link or map coordinates to help
                        customers find your collection point.
                    </p>

                    <div style={styles.grid}>
                        <div>
                            <label style={styles.label}>Google Maps Link</label>
                            <input
                                type="url"
                                style={styles.input}
                                value={settings.google_maps_url}
                                onChange={e => updateField('google_maps_url', e.target.value)}
                                placeholder="https://maps.google.com/..."
                            />
                            {settings.google_maps_url && (
                                <p style={styles.hint}>
                                    <a
                                        href={settings.google_maps_url}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        <ExternalLink size={12} style={{ verticalAlign: 'middle' }} />
                                        {' '}Test map link
                                    </a>
                                </p>
                            )}
                        </div>

                        <div>
                            <label style={styles.label}>Latitude</label>
                            <input
                                type="number"
                                step="any"
                                style={styles.input}
                                value={settings.business_latitude}
                                onChange={e => updateField('business_latitude', e.target.value)}
                                placeholder="e.g. -17.8292"
                            />
                        </div>

                        <div>
                            <label style={styles.label}>Longitude</label>
                            <input
                                type="number"
                                step="any"
                                style={styles.input}
                                value={settings.business_longitude}
                                onChange={e => updateField('business_longitude', e.target.value)}
                                placeholder="e.g. 31.0522"
                            />
                        </div>
                    </div>
                </section>

                {/* OPENING HOURS */}
                <section style={styles.panel}>
                    <div style={styles.panelTitle}>
                        <Clock size={19} color="#16734a" />
                        Opening Hours & Collection
                    </div>
                    <p style={styles.panelDescription}>
                        Customers can select collection times only on operating
                        days and within these opening hours.
                    </p>

                    <div style={styles.grid}>
                        <div>
                            <label style={styles.label}>Opening Time *</label>
                            <input
                                required
                                type="time"
                                style={styles.input}
                                value={settings.opening_time}
                                onChange={e => updateField('opening_time', e.target.value)}
                            />
                        </div>

                        <div>
                            <label style={styles.label}>Closing Time *</label>
                            <input
                                required
                                type="time"
                                style={styles.input}
                                value={settings.closing_time}
                                onChange={e => updateField('closing_time', e.target.value)}
                            />
                        </div>
                    </div>

                    <div style={{ marginTop: 20 }}>
                        <label style={styles.label}>Operating Days *</label>
                        <div style={styles.dayGrid}>
                            {DAYS.map(day => (
                                <label key={day.value} style={styles.dayLabel}>
                                    <input
                                        type="checkbox"
                                        checked={settings.opening_days.includes(day.value)}
                                        onChange={() => toggleDay(day.value)}
                                        style={{ accentColor: '#16734a' }}
                                    />
                                    {day.label}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div style={styles.notice}>
                        All customer order and collection timestamps use
                        Africa/Harare time. Make sure these opening hours
                        reflect your actual collection schedule.
                    </div>
                </section>

                {/* WEBSITE PHOTOS */}
                <section style={styles.panel}>
                    <div style={styles.panelTitle}>
                        <ImagePlus size={19} color="#16734a" />
                        Public Website Photos
                    </div>
                    <p style={styles.panelDescription}>
                        Upload up to three photos to introduce your canteen
                        to customers. JPG, PNG and WebP images up to 5 MB each.
                    </p>

                    <div style={styles.grid}>
                        {PHOTO_SLOTS.map(slot => {
                            const currentUrl = settings[slot.field]
                            const selectedFile = photoFiles[slot.field]

                            return (
                                <div key={slot.field} style={styles.photoCard}>
                                    <strong style={{ fontSize: '13px' }}>
                                        {slot.title}
                                    </strong>
                                    <p style={styles.hint}>{slot.description}</p>

                                    {currentUrl ? (
                                        <img
                                            src={currentUrl}
                                            alt={slot.title}
                                            style={styles.photoPreview}
                                        />
                                    ) : (
                                        <div
                                            style={{
                                                ...styles.photoPreview,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: '#8492a1',
                                                fontSize: '12px'
                                            }}
                                        >
                                            No photo uploaded
                                        </div>
                                    )}

                                    <label style={styles.label}>
                                        {currentUrl ? 'Replace photo' : 'Upload photo'}
                                    </label>

                                    <input
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        style={{ ...styles.input, padding: '8px' }}
                                        onChange={e => selectPhoto(
                                            slot.field,
                                            e.target.files?.[0]
                                        )}
                                    />

                                    {selectedFile && (
                                        <p style={styles.hint}>
                                            Selected: {selectedFile.name}
                                        </p>
                                    )}

                                    {currentUrl && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                updateField(slot.field, '')
                                                setPhotoFiles(current => ({
                                                    ...current,
                                                    [slot.field]: null
                                                }))
                                            }}
                                            style={{
                                                marginTop: 10,
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 6,
                                                border: '1px solid #f0caca',
                                                background: '#fff7f7',
                                                color: '#a52b2b',
                                                borderRadius: 7,
                                                padding: '8px 10px',
                                                cursor: 'pointer',
                                                fontSize: 12
                                            }}
                                        >
                                            <Trash2 size={14} />
                                            Remove photo
                                        </button>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                    <div style={styles.notice}>
                        Photo uploads are stored in Supabase Storage. Replacing
                        a photo updates the website photo URL when you save.
                        Old replaced image files are not automatically deleted.
                    </div>
                </section>

                {/* CURRENCY */}
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
                            onChange={e => {
                                const nextCurrency = e.target.value

                                setSettings(current => ({
                                    ...current,
                                    currency_code: nextCurrency,
                                    fx_rate_to_usd:
                                        nextCurrency === 'USD'
                                            ? 1
                                            : (
                                                current.currency_code === nextCurrency
                                                    ? current.fx_rate_to_usd
                                                    : ''
                                            )
                                }))
                            }}
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

                    <div style={{ marginTop: 18, maxWidth: '420px' }}>
                        <label style={styles.label}>Exchange Rate to USD</label>
                        <input
                            type="number"
                            min="0.00000001"
                            step="any"
                            required={settings.currency_code !== 'USD'}
                            disabled={settings.currency_code === 'USD'}
                            style={{
                                ...styles.input,
                                background: settings.currency_code === 'USD'
                                    ? '#f1f5f9'
                                    : '#fff'
                            }}
                            value={settings.fx_rate_to_usd}
                            onChange={e => updateField('fx_rate_to_usd', e.target.value)}
                            placeholder="Enter USD value of one currency unit"
                        />
                        <p style={styles.hint}>
                            {settings.currency_code === 'USD'
                                ? 'USD exchange rate is fixed at 1.00000000.'
                                : `Enter how many USD one ${settings.currency_code} is worth. For example, 0.055 means 1 ${settings.currency_code} = 0.055 USD.`}
                        </p>
                    </div>

                    <div style={styles.notice}>
                        Menu selling prices are stored in your default Settings
                        currency. The system uses this exchange rate to convert
                        menu prices into USD and then into the currency selected
                        by the cashier. Inventory valuation remains in USD.
                        Changing the Settings currency or exchange rate will not
                        recalculate historical transactions or cash balances.
                    </div>
                </section>

                {/* STOCK ALERTS */}
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
                            <div style={styles.toggleText}>
                                Enable low-stock alerts
                            </div>
                            <div style={styles.toggleDescription}>
                                Show warnings when stock reaches its minimum quantity.
                            </div>
                        </div>

                        <input
                            type="checkbox"
                            checked={settings.low_stock_alert_enabled}
                            onChange={e => updateField(
                                'low_stock_alert_enabled',
                                e.target.checked
                            )}
                            style={{
                                width: 19,
                                height: 19,
                                accentColor: '#16734a',
                                cursor: 'pointer'
                            }}
                        />
                    </div>
                </section>

                {/* SALES PREFERENCES */}
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
                        value={settings.default_sales_notes}
                        onChange={e => updateField(
                            'default_sales_notes',
                            e.target.value
                        )}
                        placeholder="Optional notes to use as a reminder when recording sales..."
                    />
                </section>

                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: 10,
                        flexWrap: 'wrap'
                    }}
                >
                    <button
                        type="button"
                        style={{
                            ...styles.saveButton,
                            background: '#fff',
                            color: '#526477',
                            border: '1px solid #dce5ed'
                        }}
                        onClick={loadSettings}
                        disabled={saving}
                    >
                        <RefreshCw size={16} />
                        Reload Settings
                    </button>

                    <button
                        type="submit"
                        disabled={saving}
                        style={{
                            ...styles.saveButton,
                            opacity: saving ? 0.65 : 1
                        }}
                    >
                        <Save size={16} />
                        {saving ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            </form>
        </div>
    )
}