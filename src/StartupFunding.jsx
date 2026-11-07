import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Wallet, PlusCircle, ArrowRightLeft, RefreshCw, ShieldCheck,
  AlertTriangle, CheckCircle2, Circle, CalendarDays, LockKeyhole
} from 'lucide-react'
import { supabase } from './supabase'

const CURRENCIES = ['USD', 'ZAR', 'ZWG']
const ALLOCATION_ACCOUNTS = [
  { value: 'till', label: 'Till cash' },
  { value: 'purchase_reserve', label: 'Purchase reserve' },
  { value: 'savings', label: 'Business savings' },
  { value: 'safe', label: 'Business safe' },
  { value: 'bank', label: 'Business bank' }
]
const SYMBOLS = { USD: '$', ZAR: 'R', ZWG: 'ZiG ' }
const styles = {
  page: { maxWidth: 1180, margin: '0 auto', padding: 24, color: '#162b42' },
  title: { fontSize: 25, fontWeight: 800, margin: 0 },
  subtitle: { fontSize: 13, color: '#718096', marginTop: 6, lineHeight: 1.6 },
  panel: { background: '#fff', border: '1px solid #e5ebf1', borderRadius: 13, padding: 20, marginBottom: 18 },
  panelTitle: { display: 'flex', alignItems: 'center', gap: 9, fontSize: 15, fontWeight: 800, margin: '0 0 6px' },
  hint: { fontSize: 12, color: '#718096', lineHeight: 1.55, margin: '0 0 17px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 13 },
  label: { display: 'block', fontSize: 12, fontWeight: 700, color: '#526477', marginBottom: 6 },
  input: { width: '100%', boxSizing: 'border-box', minHeight: 42, padding: '10px 11px', border: '1px solid #dce5ed', borderRadius: 8, fontSize: 13, color: '#162b42', background: '#fff' },
  button: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 0, borderRadius: 8, background: '#16734a', color: '#fff', padding: '11px 15px', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  secondary: { background: '#eef5f1', color: '#17633c' },
  message: { padding: '12px 14px', borderRadius: 8, background: '#eff8f2', color: '#17633c', fontSize: 13, marginBottom: 15 },
  error: { padding: '12px 14px', borderRadius: 8, background: '#fff0f0', color: '#a52b2b', fontSize: 13, marginBottom: 15 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { padding: '10px 9px', textAlign: 'left', color: '#718096', fontSize: 10, letterSpacing: '.6px', borderBottom: '1px solid #e8edf2' },
  td: { padding: '11px 9px', borderBottom: '1px solid #edf1f4' },
  muted: { color: '#718096', fontSize: 12 }
}

function money(amount, currency) {
  return `${SYMBOLS[currency] || ''}${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(amount || 0))}`
}

function todayInHarare() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Harare' }).format(new Date())
}

export default function StartupFunding() {
  const [startup, setStartup] = useState(null)
  const [summary, setSummary] = useState([])
  const [breakdown, setBreakdown] = useState([])
  const [openingBalances, setOpeningBalances] = useState([])
  const [readiness, setReadiness] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingContribution, setSavingContribution] = useState(false)
  const [savingAllocation, setSavingAllocation] = useState(false)
  const [activating, setActivating] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [contribution, setContribution] = useState({ amount: '', currency: 'USD', date: todayInHarare(), notes: '' })
  const [allocation, setAllocation] = useState({ account: 'till', amount: '', currency: 'USD', notes: '' })

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [startupResult, summaryResult, breakdownResult, balancesResult, readinessResult] = await Promise.all([
        supabase.from('business_startups').select('id,business_start_date,capital_type,status,notes,activated_at').eq('id', true).maybeSingle(),
        supabase.rpc('owner_get_startup_funding_summary'),
        supabase.rpc('owner_get_startup_allocation_breakdown'),
        supabase.rpc('owner_get_startup_opening_balances'),
        supabase.rpc('owner_get_startup_readiness')
      ])
      const failures = [startupResult, summaryResult, breakdownResult, balancesResult, readinessResult].filter(result => result.error)
      if (failures.length) throw new Error(failures.map(result => result.error.message).join(' | '))
      setStartup(startupResult.data || null)
      setSummary(summaryResult.data || [])
      setBreakdown(breakdownResult.data || [])
      setOpeningBalances(balancesResult.data || [])
      setReadiness(readinessResult.data || [])
    } catch (err) {
      setError(err.message || 'Could not load startup funding information.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const totalsByCurrency = useMemo(() => {
    const map = Object.fromEntries(CURRENCIES.map(code => [code, { contributed: 0, allocated: 0, unallocated: 0, status: 'NO_FUNDING' }]))
    summary.forEach(row => {
      if (map[row.currency_code]) map[row.currency_code] = {
        contributed: Number(row.contributed_amount || 0),
        allocated: Number(row.allocated_amount || 0),
        unallocated: Number(row.unallocated_amount || 0),
        status: row.funding_status || 'UNKNOWN'
      }
    })
    return map
  }, [summary])

  async function recordContribution(event) {
    event.preventDefault()
    setError(''); setMessage('')
    const amount = Number(contribution.amount)
    if (!Number.isFinite(amount) || amount <= 0) return setError('Enter a contribution amount greater than zero.')
    setSavingContribution(true)
    try {
      const { error: rpcError } = await supabase.rpc('owner_record_startup_contribution', {
        p_amount: amount,
        p_currency_code: contribution.currency,
        p_contribution_date: contribution.date,
        p_notes: contribution.notes.trim() || null
      })
      if (rpcError) throw rpcError
      setContribution(current => ({ ...current, amount: '', notes: '' }))
      setMessage('Owner capital contribution recorded.')
      await loadData()
    } catch (err) {
      setError(err.message || 'Could not record the contribution.')
    } finally { setSavingContribution(false) }
  }

  async function recordAllocation(event) {
    event.preventDefault()
    setError(''); setMessage('')
    const amount = Number(allocation.amount)
    if (!Number.isFinite(amount) || amount <= 0) return setError('Enter an allocation amount greater than zero.')
    setSavingAllocation(true)
    try {
      const { error: rpcError } = await supabase.rpc('owner_allocate_startup_capital', {
        p_account_code: allocation.account,
        p_amount: amount,
        p_currency_code: allocation.currency,
        p_notes: allocation.notes.trim() || null
      })
      if (rpcError) throw rpcError
      setAllocation(current => ({ ...current, amount: '', notes: '' }))
      setMessage('Startup capital allocation recorded.')
      await loadData()
    } catch (err) {
      setError(err.message || 'Could not allocate startup capital.')
    } finally { setSavingAllocation(false) }
  }

  async function activateStartup() {
    setError(''); setMessage('')
    const confirmed = window.confirm('Activate Mbare Chitekete startup now? This posts the opening balances and initializes the startup. Continue only if the funding and opening balances have been reviewed and are correct.')
    if (!confirmed) return
    setActivating(true)
    try {
      const { error: rpcError } = await supabase.rpc('owner_activate_canteen_startup')
      if (rpcError) throw rpcError
      setMessage('Startup activated successfully. Opening balances have been initialized.')
      await loadData()
    } catch (err) {
      setError(err.message || 'Startup activation was not completed.')
    } finally { setActivating(false) }
  }

  const isActive = startup?.status === 'active'
  if (loading) return <div style={styles.page}><div style={styles.panel}>Loading Owner startup funding...</div></div>

  return (
    <div style={styles.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap', marginBottom: 22 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: '#16734a', fontSize: 11, fontWeight: 800, letterSpacing: '.8px', marginBottom: 7 }}><Wallet size={16} /> OWNER ADMINISTRATION</div>
          <h1 style={styles.title}>Startup funding</h1>
          <p style={styles.subtitle}>Record Owner capital, allocate opening funds and review startup readiness before activation.</p>
        </div>
        <button type="button" style={{ ...styles.button, ...styles.secondary }} onClick={loadData}><RefreshCw size={15} /> Refresh</button>
      </div>

      {message && <div style={styles.message}><CheckCircle2 size={15} style={{ verticalAlign: 'middle', marginRight: 7 }} />{message}</div>}
      {error && <div style={styles.error}><AlertTriangle size={15} style={{ verticalAlign: 'middle', marginRight: 7 }} />{error}</div>}

      <section style={styles.panel}>
        <h2 style={styles.panelTitle}><CalendarDays size={18} color="#16734a" /> Startup profile</h2>
        <div style={styles.grid}>
          <div><div style={styles.label}>Business commencement date</div><strong>{startup?.business_start_date || 'Not configured'}</strong></div>
          <div><div style={styles.label}>Capital type</div><strong>{startup?.capital_type === 'owner_contribution' ? 'Owner capital contribution' : startup?.capital_type || 'Not configured'}</strong></div>
          <div><div style={styles.label}>Startup status</div><strong style={{ color: isActive ? '#16734a' : '#9a6700' }}>{startup?.status?.toUpperCase() || 'NOT FOUND'}</strong></div>
        </div>
        {isActive && <p style={{ ...styles.hint, margin: '14px 0 0' }}>Activated {startup?.activated_at ? new Date(startup.activated_at).toLocaleString() : ''}. Funding records are retained for audit.</p>}
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 13, marginBottom: 18 }}>
        {CURRENCIES.map(code => {
          const row = totalsByCurrency[code]
          return <div key={code} style={{ ...styles.panel, margin: 0, padding: 17 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#718096', letterSpacing: '.7px' }}>{code} FUNDING</div>
            <div style={{ fontSize: 22, fontWeight: 800, margin: '9px 0 12px' }}>{money(row.contributed, code)}</div>
            <div style={{ display: 'grid', gap: 6, fontSize: 12, color: '#64748b' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Allocated</span><strong>{money(row.allocated, code)}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Unallocated</span><strong>{money(row.unallocated, code)}</strong></div>
            </div>
            <div style={{ marginTop: 11, fontSize: 10, fontWeight: 800, color: row.status === 'FULLY_ALLOCATED' ? '#16734a' : '#8a6500' }}>{row.status.replaceAll('_', ' ')}</div>
          </div>
        })}
      </div>

      {!isActive && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 18 }}>
        <section style={styles.panel}>
          <h2 style={styles.panelTitle}><PlusCircle size={18} color="#16734a" /> Record Owner contribution</h2>
          <p style={styles.hint}>Enter capital actually contributed by the Owner. Record each currency separately and use the real contribution date.</p>
          <form onSubmit={recordContribution}>
            <div style={styles.grid}>
              <div><label style={styles.label}>Amount *</label><input style={styles.input} type="number" min="0.01" step="0.01" required value={contribution.amount} onChange={e => setContribution({ ...contribution, amount: e.target.value })} placeholder="0.00" /></div>
              <div><label style={styles.label}>Currency *</label><select style={styles.input} value={contribution.currency} onChange={e => setContribution({ ...contribution, currency: e.target.value })}>{CURRENCIES.map(code => <option key={code} value={code}>{code}</option>)}</select></div>
              <div><label style={styles.label}>Contribution date *</label><input style={styles.input} type="date" required value={contribution.date} onChange={e => setContribution({ ...contribution, date: e.target.value })} /></div>
              <div><label style={styles.label}>Notes</label><input style={styles.input} value={contribution.notes} onChange={e => setContribution({ ...contribution, notes: e.target.value })} placeholder="Optional reference" /></div>
            </div>
            <button type="submit" style={{ ...styles.button, marginTop: 16 }} disabled={savingContribution || !startup || startup.status !== 'draft'}>{savingContribution ? 'Recording...' : 'Record contribution'}</button>
          </form>
        </section>

        <section style={styles.panel}>
          <h2 style={styles.panelTitle}><ArrowRightLeft size={18} color="#16734a" /> Allocate startup capital</h2>
          <p style={styles.hint}>Allocate contributed funds to the actual opening location. The database validates available capital separately for each currency.</p>
          <form onSubmit={recordAllocation}>
            <div style={styles.grid}>
              <div><label style={styles.label}>Account *</label><select style={styles.input} value={allocation.account} onChange={e => setAllocation({ ...allocation, account: e.target.value })}>{ALLOCATION_ACCOUNTS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
              <div><label style={styles.label}>Amount *</label><input style={styles.input} type="number" min="0.01" step="0.01" required value={allocation.amount} onChange={e => setAllocation({ ...allocation, amount: e.target.value })} placeholder="0.00" /></div>
              <div><label style={styles.label}>Currency *</label><select style={styles.input} value={allocation.currency} onChange={e => setAllocation({ ...allocation, currency: e.target.value })}>{CURRENCIES.map(code => <option key={code} value={code}>{code}</option>)}</select></div>
              <div><label style={styles.label}>Notes</label><input style={styles.input} value={allocation.notes} onChange={e => setAllocation({ ...allocation, notes: e.target.value })} placeholder="Optional allocation note" /></div>
            </div>
            <button type="submit" style={{ ...styles.button, marginTop: 16 }} disabled={savingAllocation || !startup || startup.status !== 'draft'}>{savingAllocation ? 'Allocating...' : 'Allocate capital'}</button>
          </form>
        </section>
      </div>}

      <section style={styles.panel}>
        <h2 style={styles.panelTitle}><Wallet size={18} color="#16734a" /> Allocation breakdown</h2>
        {breakdown.length === 0 ? <p style={styles.muted}>No capital allocations have been recorded.</p> : <div style={{ overflowX: 'auto' }}><table style={styles.table}><thead><tr><th style={styles.th}>ACCOUNT</th><th style={styles.th}>CURRENCY</th><th style={styles.th}>ALLOCATED</th></tr></thead><tbody>{breakdown.map((row, index) => <tr key={`${row.account_code}-${row.currency_code}-${index}`}><td style={styles.td}>{ALLOCATION_ACCOUNTS.find(a => a.value === row.account_code)?.label || row.account_code}</td><td style={styles.td}>{row.currency_code}</td><td style={styles.td}>{money(row.allocated_amount, row.currency_code)}</td></tr>)}</tbody></table></div>}
      </section>

      <section style={styles.panel}>
        <h2 style={styles.panelTitle}><ShieldCheck size={18} color="#16734a" /> Startup readiness checks</h2>
        <p style={styles.hint}>These checks are generated by the Owner-only database readiness function. The database remains the authority for activation eligibility.</p>
        {readiness.length === 0 ? <p style={styles.muted}>No readiness results were returned.</p> : <div style={{ display: 'grid', gap: 10 }}>{readiness.map((check, index) => {
          const passed = ['PASS', 'READY', 'OK'].includes(String(check.status || '').toUpperCase())
          return <div key={`${check.check_name}-${index}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 12 }}>
            {passed ? <CheckCircle2 size={16} color="#16734a" /> : <Circle size={16} color="#b7791f" />}
            <div><strong>{check.check_name}</strong><div style={{ color: '#718096', marginTop: 3 }}>{check.details || check.status}</div></div>
            <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 800, color: passed ? '#16734a' : '#8a6500' }}>{check.status}</span>
          </div>
        })}</div>}
      </section>

      <section style={{ ...styles.panel, borderColor: '#e5d8b8' }}>
        <h2 style={styles.panelTitle}><LockKeyhole size={18} color="#9a6700" /> Opening balances and activation</h2>
        {openingBalances.length === 0 ? <p style={styles.hint}>No opening balances have been posted. This is expected until the startup is activated.</p> : <div style={{ overflowX: 'auto', marginBottom: 15 }}><table style={styles.table}><thead><tr><th style={styles.th}>ACCOUNT</th><th style={styles.th}>CURRENCY</th><th style={styles.th}>OPENING BALANCE</th></tr></thead><tbody>{openingBalances.map((row, index) => <tr key={`${row.account_code}-${row.currency_code}-${index}`}><td style={styles.td}>{row.account_code}</td><td style={styles.td}>{row.currency_code}</td><td style={styles.td}>{money(row.opening_amount, row.currency_code)}</td></tr>)}</tbody></table></div>}
        {isActive ? <div style={styles.message}>Startup is active. Activation is locked to prevent duplicate opening postings.</div> : <>
          <p style={styles.hint}>Activation is irreversible through this screen. Review actual contributions, allocations, readiness checks and opening balances first. The database performs its own final validation and prevents duplicate activation.</p>
          <button type="button" style={{ ...styles.button, background: '#8a6500' }} onClick={activateStartup} disabled={activating || !startup || startup.status !== 'draft'}>{activating ? 'Activating...' : 'Review and activate startup'}</button>
          <span style={{ ...styles.muted, marginLeft: 10 }}>No activation occurs without your confirmation.</span>
        </>}
      </section>
    </div>
  )
}
