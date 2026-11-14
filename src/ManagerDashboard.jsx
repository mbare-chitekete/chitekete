
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  RefreshCw,
  Clock3,
  CheckCircle2,
  XCircle,
  CalendarDays,
  Users,
  FileText,
  Wallet,
  MessageSquare,
  LoaderCircle
} from 'lucide-react'
import { supabase } from './supabase'
import { useCurrency } from './CurrencyContext'

const CURRENCIES = ['USD', 'ZAR', 'ZWG']

const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Harare',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date())

const input = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  border: '1px solid #dce3eb',
  borderRadius: 9,
  fontSize: 14
}

const formatDate = value => {
  if (!value) return '—'

  const date = new Date(`${value}T12:00:00`)

  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Africa/Harare'
  })
}

const formatDateTime = value => {
  if (!value) return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Harare'
  })
}

const formatMoney = (amount, currency = 'USD') => {
  if (amount === null || amount === undefined || amount === '') {
    return 'Not specified'
  }

  const value = Number(amount)

  if (!Number.isFinite(value)) return 'Invalid amount'

  return `${currency} ${value.toFixed(2)}`
}

const getRequestType = type => {
  if (type === 'staff_meal') return 'Staff meal'
  if (type === 'transport') return 'Transport'

  return String(type || 'Benefit').replaceAll('_', ' ')
}

const statusStyle = status => {
  if (status === 'approved') {
    return 'bg-green-100 text-green-700'
  }

  if (status === 'rejected') {
    return 'bg-red-100 text-red-700'
  }

  return 'bg-amber-100 text-amber-700'
}

const statusLabel = status => {
  if (!status) return 'Unknown'

  return status.charAt(0).toUpperCase() + status.slice(1)
}

export default function ManagerDashboard() {
  const { currencyCode } = useCurrency()

  const [businessName, setBusinessName] = useState('Canteen')

  const [staff, setStaff] = useState([])
  const [benefitRequests, setBenefitRequests] = useState([])

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [statusFilter, setStatusFilter] = useState('pending')

  const [benefit, setBenefit] = useState({
    request_type: 'staff_meal',
    request_scope: 'individual',
    staff_member_id: '',
    requested_for_date: today(),
    period_start_date: '',
    period_end_date: '',
    requested_quantity: '',
    requested_amount: '',
    currency: CURRENCIES.includes(currencyCode)
      ? currencyCode
      : 'USD',
    request_reason: ''
  })

  const updateBenefit = (field, value) => {
    setBenefit(previous => ({
      ...previous,
      [field]: value
    }))
  }

  // Load business name, available staff and this manager's requests.
  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    setError('')

    try {
      const [benefitResult, staffResult, settingsResult] =
        await Promise.all([
          supabase.rpc('get_staff_benefit_requests'),

          supabase.rpc('get_benefit_request_staff'),

          supabase
            .from('canteen_settings')
            .select('business_name')
            .eq('id', true)
            .maybeSingle()
        ])

      const failures = [
        benefitResult.error,
        staffResult.error
      ].filter(Boolean)

      if (failures.length) {
        setError(
          failures.map(item => item.message).join(' · ')
        )
      }

      setBenefitRequests(
        Array.isArray(benefitResult.data)
          ? benefitResult.data
          : []
      )

      setStaff(
        Array.isArray(staffResult.data)
          ? staffResult.data
          : []
      )

      if (settingsResult.error) {
        console.warn(
          'Unable to load business name:',
          settingsResult.error
        )
      } else {
        setBusinessName(
          settingsResult.data?.business_name?.trim() || 'Canteen'
        )
      }
    } catch (err) {
      console.error('Unable to load manager dashboard:', err)

      setError(
        err.message || 'Could not load staff benefit information.'
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Submit staff meal or transport request.
  async function submitBenefit(e) {
    e.preventDefault()

    setError('')
    setSuccess('')

    if (!benefit.request_reason.trim()) {
      setError('Please provide a reason for this request.')
      return
    }

    if (
      !['staff_meal', 'transport'].includes(benefit.request_type)
    ) {
      setError('Please select a valid request type.')
      return
    }

    if (
      !['individual', 'team'].includes(benefit.request_scope)
    ) {
      setError('Please select a valid request scope.')
      return
    }

    if (
      benefit.request_scope === 'individual' &&
      !benefit.staff_member_id
    ) {
      setError('Please select an employee.')
      return
    }

    if (
      benefit.request_type === 'transport' &&
      (!benefit.period_start_date || !benefit.period_end_date)
    ) {
      setError('Please provide the transport period.')
      return
    }

    if (
      benefit.request_type === 'staff_meal' &&
      !benefit.requested_for_date &&
      (!benefit.period_start_date || !benefit.period_end_date)
    ) {
      setError('Please provide a meal date or meal period.')
      return
    }

    if (
      benefit.period_start_date &&
      benefit.period_end_date &&
      benefit.period_end_date < benefit.period_start_date
    ) {
      setError(
        'The period end date cannot be before the start date.'
      )
      return
    }

    if (
      benefit.requested_quantity !== '' &&
      (
        !Number.isFinite(Number(benefit.requested_quantity)) ||
        Number(benefit.requested_quantity) <= 0
      )
    ) {
      setError('Requested quantity must be greater than zero.')
      return
    }

    if (
      benefit.requested_amount !== '' &&
      (
        !Number.isFinite(Number(benefit.requested_amount)) ||
        Number(benefit.requested_amount) < 0
      )
    ) {
      setError('Requested amount cannot be negative.')
      return
    }

    if (!CURRENCIES.includes(benefit.currency)) {
      setError('Please select a valid currency.')
      return
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

          p_requested_for_date:
            benefit.requested_for_date || null,

          p_period_start_date:
            benefit.period_start_date || null,

          p_period_end_date:
            benefit.period_end_date || null,

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

      if (submitError) throw submitError

      setSuccess(
        'Staff benefit request submitted successfully for Owner review.'
      )

      setBenefit({
        request_type: 'staff_meal',
        request_scope: 'individual',
        staff_member_id: '',
        requested_for_date: today(),
        period_start_date: '',
        period_end_date: '',
        requested_quantity: '',
        requested_amount: '',
        currency: CURRENCIES.includes(currencyCode)
          ? currencyCode
          : 'USD',
        request_reason: ''
      })

      // Refresh without hiding the dashboard.
      await load(true)

    } catch (err) {
      console.error(
        'Unable to submit staff benefit request:',
        err
      )

      setError(
        err.message || 'Could not submit the benefit request.'
      )
    } finally {
      setSaving(false)
    }
  }

  // Request statistics.
  const pendingBenefits = useMemo(
    () => benefitRequests.filter(
      request => request.status === 'pending'
    ).length,
    [benefitRequests]
  )

  const approvedBenefits = useMemo(
    () => benefitRequests.filter(
      request => request.status === 'approved'
    ).length,
    [benefitRequests]
  )

  const rejectedBenefits = useMemo(
    () => benefitRequests.filter(
      request => request.status === 'rejected'
    ).length,
    [benefitRequests]
  )

  const filteredRequests = useMemo(
    () => benefitRequests.filter(request =>
      statusFilter === 'all' ||
      request.status === statusFilter
    ),
    [benefitRequests, statusFilter]
  )

  const filterOptions = [
    {
      value: 'pending',
      label: 'Pending',
      count: pendingBenefits
    },
    {
      value: 'approved',
      label: 'Approved',
      count: approvedBenefits
    },
    {
      value: 'rejected',
      label: 'Rejected',
      count: rejectedBenefits
    },
    {
      value: 'all',
      label: 'All requests',
      count: benefitRequests.length
    }
  ]

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
          <div className="eyebrow">
            MANAGEMENT WORKSPACE
          </div>

          <h1>Manager Dashboard</h1>

          <p>
            Staff meal and transport requests, submissions and approval status.
          </p>
        </div>

        <div className="eyebrow">
          {businessName}
        </div>

        <button
          type="button"
          className="button button-light"
          onClick={() => load(true)}
          disabled={loading || refreshing || saving}
        >
          <RefreshCw
            size={16}
            className={refreshing ? 'animate-spin' : ''}
          />

          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Messages */}

      {error && (
        <div
          className="panel"
          style={{
            padding: 14,
            color: '#b42318'
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          className="panel"
          style={{
            padding: 14,
            color: '#176b45'
          }}
        >
          {success}
        </div>
      )}

      {/* Benefit statistics */}

      <div className="stats-grid">

        <div className="stat-card">
          <span>Pending staff benefits</span>
          <strong>{pendingBenefits}</strong>
        </div>

        <div className="stat-card">
          <span>Approved staff benefits</span>
          <strong>{approvedBenefits}</strong>
        </div>

        <div className="stat-card">
          <span>Rejected staff benefits</span>
          <strong>{rejectedBenefits}</strong>
        </div>

      </div>

      {/* Submit staff benefit request */}

      <section className="panel manager-panel">

        <div className="panel-heading">
          <div>
            <h3>
              Submit staff meals or transport request
            </h3>

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
              disabled={saving}
              onChange={e =>
                updateBenefit('request_type', e.target.value)
              }
            >
              <option value="staff_meal">
                Staff meal
              </option>

              <option value="transport">
                Transport
              </option>
            </select>
          </label>

          <label>
            Request scope

            <select
              style={input}
              value={benefit.request_scope}
              disabled={saving}
              onChange={e =>
                updateBenefit('request_scope', e.target.value)
              }
            >
              <option value="individual">
                Individual employee
              </option>

              <option value="team">
                Team
              </option>
            </select>
          </label>

          {benefit.request_scope === 'individual' && (
            <label>
              Employee

              <select
                style={input}
                required
                disabled={saving}
                value={benefit.staff_member_id}
                onChange={e =>
                  updateBenefit('staff_member_id', e.target.value)
                }
              >
                <option value="">
                  Select employee
                </option>

                {staff.map(person => (
                  <option
                    key={person.staff_member_id || person.id}
                    value={person.staff_member_id || person.id}
                  >
                    {person.employee_name ||
                      person.full_name ||
                      person.name ||
                      'Staff member'}
                  </option>
                ))}
              </select>
            </label>
          )}

          {benefit.request_type === 'staff_meal' && (
            <label>
              Meal date (optional if period is supplied)

              <input
                style={input}
                type="date"
                disabled={saving}
                value={benefit.requested_for_date}
                onChange={e =>
                  updateBenefit(
                    'requested_for_date',
                    e.target.value
                  )
                }
              />
            </label>
          )}

          <label>
            Period start (optional)

            <input
              style={input}
              type="date"
              disabled={saving}
              value={benefit.period_start_date}
              onChange={e =>
                updateBenefit(
                  'period_start_date',
                  e.target.value
                )
              }
            />
          </label>

          <label>
            Period end (optional)

            <input
              style={input}
              type="date"
              disabled={saving}
              value={benefit.period_end_date}
              onChange={e =>
                updateBenefit(
                  'period_end_date',
                  e.target.value
                )
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
              disabled={saving}
              value={benefit.requested_quantity}
              onChange={e =>
                updateBenefit(
                  'requested_quantity',
                  e.target.value
                )
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
              disabled={saving}
              value={benefit.requested_amount}
              onChange={e =>
                updateBenefit(
                  'requested_amount',
                  e.target.value
                )
              }
            />
          </label>

          <label>
            Currency

            <select
              style={input}
              disabled={saving}
              value={benefit.currency}
              onChange={e =>
                updateBenefit('currency', e.target.value)
              }
            >
              {CURRENCIES.map(currency => (
                <option
                  key={currency}
                  value={currency}
                >
                  {currency}
                </option>
              ))}
            </select>
          </label>

          <label className="manager-full-width">
            Reason

            <textarea
              style={input}
              rows="3"
              required
              disabled={saving}
              value={benefit.request_reason}
              onChange={e =>
                updateBenefit(
                  'request_reason',
                  e.target.value
                )
              }
              placeholder="Explain why this staff benefit is being requested..."
            />
          </label>

          <div className="manager-full-width">
            <button
              type="submit"
              className="button button-primary"
              disabled={saving}
            >
              {saving ? (
                <>
                  <LoaderCircle
                    size={16}
                    className="animate-spin"
                  />
                  Submitting...
                </>
              ) : (
                'Submit for Owner approval'
              )}
            </button>
          </div>

        </form>
      </section>

      {/* Staff benefit request status */}

      <section className="panel manager-panel manager-status-panel">

        <div className="panel-heading">
          <div>
            <h3>
              Staff benefit request status
            </h3>

            <p>
              Track your submitted requests and the Owner's decisions.
            </p>
          </div>
        </div>

        {/* Status filters */}

        <div
          className="flex flex-wrap gap-2"
          style={{ marginBottom: 16 }}
        >
          {filterOptions.map(option => (
            <button
              key={option.value}
              type="button"
              onClick={() => setStatusFilter(option.value)}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${statusFilter === option.value
                ? 'bg-blue-900 text-white'
                : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
            >
              {option.label}

              <span className="ml-2 text-xs opacity-75">
                {option.count}
              </span>
            </button>
          ))}
        </div>

        {/* Request list */}

        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-gray-500">
            <LoaderCircle
              size={18}
              className="animate-spin"
            />
            Loading benefit requests...
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center">
            <FileText
              size={32}
              className="mx-auto text-gray-400"
            />

            <p className="mt-3 font-medium text-gray-700">
              No {statusFilter === 'all' ? '' : statusFilter} requests found
            </p>

            <p className="mt-1 text-sm text-gray-500">
              Your requests will appear here when submitted.
            </p>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Scope</th>
                  <th>Requested for</th>
                  <th>Quantity</th>
                  <th>Requested amount</th>
                  <th>Approved amount</th>
                  <th>Status</th>
                  <th>Reason</th>
                  <th>Owner notes</th>
                  <th>Reviewed</th>
                </tr>
              </thead>

              <tbody>
                {filteredRequests.map(row => {
                  const currency = CURRENCIES.includes(row.currency)
                    ? row.currency
                    : 'USD'

                  const recipients = Array.isArray(row.recipients)
                    ? row.recipients
                    : []

                  const requestedFor = row.requested_for_date
                    ? formatDate(row.requested_for_date)
                    : row.period_start_date || row.period_end_date
                      ? `${formatDate(row.period_start_date)} – ${formatDate(row.period_end_date)}`
                      : '—'

                  return (
                    <tr key={row.id}>

                      <td>
                        <div className="font-medium capitalize">
                          {getRequestType(row.request_type)}
                        </div>

                        <div className="mt-1 text-xs text-gray-500">
                          Submitted {formatDateTime(row.created_at)}
                        </div>
                      </td>

                      <td>
                        <div className="capitalize">
                          {row.request_scope || 'individual'}
                        </div>

                        {row.request_scope === 'team' && (
                          <div className="mt-1 text-xs text-gray-500">
                            {recipients.length} active staff
                          </div>
                        )}
                      </td>

                      <td>
                        {requestedFor}
                      </td>

                      <td>
                        {row.requested_quantity ?? '—'}
                      </td>

                      <td>
                        {formatMoney(
                          row.requested_amount,
                          currency
                        )}
                      </td>

                      <td>
                        {row.status === 'approved'
                          ? formatMoney(
                            row.approved_amount,
                            currency
                          )
                          : '—'
                        }
                      </td>

                      <td>
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusStyle(row.status)}`}
                        >
                          {statusLabel(row.status)}
                        </span>
                      </td>

                      <td>
                        <div className="min-w-[150px] max-w-[230px] whitespace-pre-wrap">
                          {row.request_reason || '—'}
                        </div>
                      </td>

                      <td>
                        <div className="min-w-[150px] max-w-[230px] whitespace-pre-wrap">
                          {row.owner_notes || '—'}
                        </div>
                      </td>

                      <td>
                        {row.reviewed_at
                          ? formatDateTime(row.reviewed_at)
                          : '—'
                        }
                      </td>

                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

      </section>

      {/* Information */}

      <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
        <div className="flex items-start gap-3">
          <MessageSquare
            size={19}
            className="mt-0.5 shrink-0 text-blue-600"
          />

          <div>
            <p className="text-sm font-semibold text-blue-900">
              Staff benefit request information
            </p>

            <p className="mt-1 text-sm leading-relaxed text-blue-800">
              Managers can submit and track their own staff meal and transport requests.
              Only the Owner can approve or reject requests. Approval records the decision
              but does not automatically create an expense, payroll payment, cash transaction
              or financial journal entry.
            </p>
          </div>
        </div>
      </div>

    </div>
  )
}
