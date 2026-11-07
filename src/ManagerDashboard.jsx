
import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { supabase } from './supabase'
import { useCurrency } from './CurrencyContext'

const today = () => new Date().toLocaleDateString('en-CA')

const input = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  border: '1px solid #dce3eb',
  borderRadius: 9,
  fontSize: 14
}

export default function ManagerDashboard() {
  const { currencyCode } = useCurrency()

  const [staff, setStaff] = useState([])
  const [benefitRequests, setBenefitRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [benefit, setBenefit] = useState({
    request_type: 'staff_meal',
    request_scope: 'individual',
    staff_member_id: '',
    requested_for_date: today(),
    period_start_date: '',
    period_end_date: '',
    requested_quantity: '',
    requested_amount: '',
    currency: currencyCode || 'USD',
    request_reason: ''
  })

  // Load staff and benefit requests
  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [b, s] = await Promise.all([
        supabase.rpc('get_staff_benefit_requests'),
        supabase.rpc('get_benefit_request_staff')
      ])

      const failures = [b.error, s.error].filter(Boolean)

      if (failures.length) {
        setError(failures.map(x => x.message).join(' · '))
      }

      setBenefitRequests(Array.isArray(b.data) ? b.data : [])
      setStaff(Array.isArray(s.data) ? s.data : [])
    } catch (err) {
      setError(err.message || 'Could not load staff benefit information.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Submit staff meal or transport request
  async function submitBenefit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!benefit.request_reason.trim()) {
      return setError('Please provide a reason for this request.')
    }

    if (
      benefit.request_scope === 'individual' &&
      !benefit.staff_member_id
    ) {
      return setError('Please select an employee.')
    }

    if (
      benefit.request_type === 'transport' &&
      (!benefit.period_start_date || !benefit.period_end_date)
    ) {
      return setError('Please provide the transport period.')
    }

    if (
      benefit.request_type === 'staff_meal' &&
      !benefit.requested_for_date &&
      (!benefit.period_start_date || !benefit.period_end_date)
    ) {
      return setError('Please provide a meal date or meal period.')
    }

    if (
      benefit.period_start_date &&
      benefit.period_end_date &&
      benefit.period_end_date < benefit.period_start_date
    ) {
      return setError('The period end date cannot be before the start date.')
    }

    if (
      benefit.requested_quantity !== '' &&
      (
        !Number.isFinite(Number(benefit.requested_quantity)) ||
        Number(benefit.requested_quantity) <= 0
      )
    ) {
      return setError('Requested quantity must be greater than zero.')
    }

    if (
      benefit.requested_amount !== '' &&
      (
        !Number.isFinite(Number(benefit.requested_amount)) ||
        Number(benefit.requested_amount) < 0
      )
    ) {
      return setError('Requested amount cannot be negative.')
    }

    setSaving(true)

    try {
      const { error: submitError } = await supabase.rpc(
        'submit_staff_benefit_request',
        {
          p_request_type: benefit.request_type,
          p_request_scope: benefit.request_scope,
          p_staff_member_id:
            benefit.request_scope === 'individual'
              ? benefit.staff_member_id
              : null,
          p_requested_for_date: benefit.requested_for_date || null,
          p_period_start_date: benefit.period_start_date || null,
          p_period_end_date: benefit.period_end_date || null,
          p_requested_quantity:
            benefit.requested_quantity !== ''
              ? Number(benefit.requested_quantity)
              : null,
          p_requested_amount:
            benefit.requested_amount !== ''
              ? Number(benefit.requested_amount)
              : null,
          p_currency: benefit.currency,
          p_request_reason: benefit.request_reason.trim()
        }
      )

      if (submitError) {
        throw submitError
      }

      setSuccess('Staff benefit request submitted for Owner review.')

      setBenefit({
        request_type: 'staff_meal',
        request_scope: 'individual',
        staff_member_id: '',
        requested_for_date: today(),
        period_start_date: '',
        period_end_date: '',
        requested_quantity: '',
        requested_amount: '',
        currency: currencyCode || 'USD',
        request_reason: ''
      })

      await load()
    } catch (err) {
      setError(err.message || 'Could not submit the benefit request.')
    } finally {
      setSaving(false)
    }
  }

  const pendingBenefits = benefitRequests.filter(
    x => x.status === 'pending'
  ).length

  return (
    <div
      className="page-content manager-dashboard"
      style={{
        display: 'grid',
        gap: 12,
        width: '100%',
        minWidth: 0,
        boxSizing: 'border-box'
      }}
    >
      {/* Dashboard heading */}
      <div className="welcome-row manager-welcome">
        <div>
          <div className="eyebrow">MANAGEMENT WORKSPACE</div>
          <h1>Manager Dashboard</h1>
          <p>Staff meal or transport requests and their approval status.</p>
        </div>

        <button
          className="button button-light"
          onClick={load}
          disabled={loading}
        >
          <RefreshCw size={16} />
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div
          className="panel"
          style={{ padding: 14, color: '#b42318' }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          className="panel"
          style={{ padding: 14, color: '#176b45' }}
        >
          {success}
        </div>
      )}

      {/* Pending benefits summary */}
      <div className="stats-grid">
        <div className="stat-card">
          <span>Pending staff benefits</span>
          <strong>{pendingBenefits}</strong>
        </div>
      </div>

      {/* Submit staff benefit request */}
      <section className="panel manager-panel">
        <div className="panel-heading">
          <div>
            <h3>Submit staff meals or transport request</h3>
            <p>
              Requests are sent to the Owner for approval.
              They do not directly change payroll or cash balances.
            </p>
          </div>
        </div>

        <form
          className="manager-benefit-form"
          onSubmit={submitBenefit}
        >
          <label>
            Request type
            <select
              style={input}
              value={benefit.request_type}
              onChange={e =>
                setBenefit({
                  ...benefit,
                  request_type: e.target.value
                })
              }
            >
              <option value="staff_meal">Staff meal</option>
              <option value="transport">Transport</option>
            </select>
          </label>

          <label>
            Request scope
            <select
              style={input}
              value={benefit.request_scope}
              onChange={e =>
                setBenefit({
                  ...benefit,
                  request_scope: e.target.value
                })
              }
            >
              <option value="individual">Individual employee</option>
              <option value="team">Team</option>
            </select>
          </label>

          {benefit.request_scope === 'individual' && (
            <label>
              Employee
              <select
                style={input}
                required
                value={benefit.staff_member_id}
                onChange={e =>
                  setBenefit({
                    ...benefit,
                    staff_member_id: e.target.value
                  })
                }
              >
                <option value="">Select employee</option>

                {staff.map(x => (
                  <option
                    key={x.staff_member_id || x.id}
                    value={x.staff_member_id || x.id}
                  >
                    {x.employee_name || x.full_name || x.name || 'Staff member'}
                  </option>
                ))}
              </select>
            </label>
          )}

          {benefit.request_type === 'staff_meal' && (
            <label>
              Meal date
              <input
                style={input}
                type="date"
                value={benefit.requested_for_date}
                onChange={e =>
                  setBenefit({
                    ...benefit,
                    requested_for_date: e.target.value
                  })
                }
              />
            </label>
          )}

          <label>
            Period start
            <input
              style={input}
              type="date"
              value={benefit.period_start_date}
              onChange={e =>
                setBenefit({
                  ...benefit,
                  period_start_date: e.target.value
                })
              }
            />
          </label>

          <label>
            Period end
            <input
              style={input}
              type="date"
              value={benefit.period_end_date}
              onChange={e =>
                setBenefit({
                  ...benefit,
                  period_end_date: e.target.value
                })
              }
            />
          </label>

          <label>
            Quantity (optional)
            <input
              style={input}
              type="number"
              min="0.001"
              step="0.001"
              value={benefit.requested_quantity}
              onChange={e =>
                setBenefit({
                  ...benefit,
                  requested_quantity: e.target.value
                })
              }
            />
          </label>

          <label>
            Requested amount (optional)
            <input
              style={input}
              type="number"
              min="0"
              step="0.01"
              value={benefit.requested_amount}
              onChange={e =>
                setBenefit({
                  ...benefit,
                  requested_amount: e.target.value
                })
              }
            />
          </label>

          <label>
            Currency
            <select
              style={input}
              value={benefit.currency}
              onChange={e =>
                setBenefit({
                  ...benefit,
                  currency: e.target.value
                })
              }
            >
              <option value="USD">USD</option>
              <option value="ZAR">ZAR</option>
              <option value="ZWG">ZWG</option>
            </select>
          </label>

          <label className="manager-full-width">
            Reason
            <textarea
              style={input}
              rows="3"
              required
              value={benefit.request_reason}
              onChange={e =>
                setBenefit({
                  ...benefit,
                  request_reason: e.target.value
                })
              }
            />
          </label>

          <div className="manager-full-width">
            <button
              className="button button-primary"
              disabled={saving}
            >
              {saving ? 'Submitting...' : 'Submit for Owner approval'}
            </button>
          </div>
        </form>
      </section>

      {/* Staff benefit request status */}
      <section className="panel manager-panel manager-status-panel">
        <div className="panel-heading">
          <div>
            <h3>Staff benefit request status</h3>
            <p>Track requests submitted by management.</p>
          </div>
        </div>

        {loading ? (
          <p>Loading benefit requests...</p>
        ) : !benefitRequests.length ? (
          <p>No staff benefit requests yet.</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Scope</th>
                  <th>Requested for</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Reason</th>
                </tr>
              </thead>

              <tbody>
                {benefitRequests.map(row => (
                  <tr key={row.id}>
                    <td>
                      {String(row.request_type || '').replaceAll('_', ' ')}
                    </td>

                    <td>{row.request_scope}</td>

                    <td>
                      {row.requested_for_date ||
                        `${row.period_start_date || '—'} – ${row.period_end_date || '—'}`}
                    </td>

                    <td>
                      {row.requested_amount == null
                        ? '—'
                        : `${row.currency || 'USD'} ${Number(row.requested_amount).toFixed(2)}`}
                    </td>

                    <td>{row.status}</td>

                    <td>{row.request_reason || row.reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
