
import { useCallback, useEffect, useState } from 'react'
import {
    CheckCircle2,
    XCircle,
    RefreshCw,
    Utensils,
    Car,
    Users,
    CalendarDays,
    Clock3,
    LoaderCircle,
    FileText
} from 'lucide-react'
import { supabase } from './supabase'

const formatDate = value => {
    if (!value) return '—'

    return new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    })
}

const formatDateTime = value => {
    if (!value) return '—'

    return new Date(value).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Africa/Harare'
    })
}

const formatMoney = (amount, currency) => {
    if (amount === null || amount === undefined || amount === '') {
        return 'Not specified'
    }

    return `${Number(amount).toFixed(2)} ${currency || 'USD'}`
}

const statusStyle = status => {
    if (status === 'approved') return 'bg-green-100 text-green-700'
    if (status === 'rejected') return 'bg-red-100 text-red-700'
    return 'bg-amber-100 text-amber-700'
}

export default function OwnerBenefitReviews() {
    const [requests, setRequests] = useState([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [reviewing, setReviewing] = useState('')
    const [filter, setFilter] = useState('pending')
    const [approvedAmounts, setApprovedAmounts] = useState({})
    const [ownerNotes, setOwnerNotes] = useState({})
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')

    const loadRequests = useCallback(async (showRefresh = false) => {
        if (showRefresh) setRefreshing(true)
        else setLoading(true)

        setError('')

        try {
            const { data, error: requestError } = await supabase.rpc(
                'get_staff_benefit_requests'
            )

            if (requestError) throw requestError

            const rows = Array.isArray(data) ? data : []
            setRequests(rows)

            setApprovedAmounts(previous => {
                const next = { ...previous }

                rows.forEach(request => {
                    if (next[request.id] === undefined) {
                        next[request.id] =
                            request.approved_amount ??
                            request.requested_amount ??
                            ''
                    }
                })

                return next
            })

            setOwnerNotes(previous => {
                const next = { ...previous }

                rows.forEach(request => {
                    if (next[request.id] === undefined) {
                        next[request.id] = request.owner_notes || ''
                    }
                })

                return next
            })
        } catch (err) {
            console.error('Unable to load staff benefit requests:', err)
            setError(err.message || 'Unable to load staff benefit requests.')
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }, [])

    useEffect(() => {
        loadRequests()
    }, [loadRequests])

    const reviewRequest = async (request, decision) => {
        setMessage('')
        setError('')

        const notes = (ownerNotes[request.id] || '').trim()
        const amountValue = approvedAmounts[request.id]

        let approvedAmount = null

        if (decision === 'rejected' && !notes) {
            setError('Please provide a reason when rejecting a request.')
            return
        }

        if (decision === 'approved' && amountValue !== '' && amountValue !== null) {
            approvedAmount = Number(amountValue)

            if (!Number.isFinite(approvedAmount) || approvedAmount < 0) {
                setError('Enter a valid approved amount of zero or more.')
                return
            }
        }

        const type = String(request.request_type || 'benefit')
            .replaceAll('_', ' ')

        const confirmation = decision === 'approved'
            ? approvedAmount === null
                ? `Approve this ${type} request without an approved amount?`
                : `Approve this ${type} request for ${request.currency || 'USD'} ${approvedAmount.toFixed(2)}?`
            : 'Reject this staff benefit request?'

        if (!window.confirm(confirmation)) return

        setReviewing(request.id)

        try {
            const { error: reviewError } = await supabase.rpc(
                'owner_review_staff_benefit_request',
                {
                    p_request_id: request.id,
                    p_decision: decision,
                    p_approved_amount: decision === 'approved' ? approvedAmount : null,
                    p_owner_notes: notes
                }
            )

            if (reviewError) throw reviewError

            setMessage(
                decision === 'approved'
                    ? 'Staff benefit request approved successfully.'
                    : 'Staff benefit request rejected successfully.'
            )

            await loadRequests(true)
        } catch (err) {
            console.error('Unable to review staff benefit request:', err)
            setError(err.message || 'Unable to process this request.')
        } finally {
            setReviewing('')
        }
    }

    const pendingCount = requests.filter(x => x.status === 'pending').length
    const approvedCount = requests.filter(x => x.status === 'approved').length
    const rejectedCount = requests.filter(x => x.status === 'rejected').length

    const filteredRequests = requests.filter(request =>
        filter === 'all' || request.status === filter
    )

    if (loading) {
        return (
            <div className="flex min-h-[300px] items-center justify-center gap-3 text-gray-500">
                <LoaderCircle className="h-6 w-6 animate-spin" />
                Loading staff benefit requests...
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">
                        Staff Meals & Transport
                    </h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Review, approve or reject staff benefit requests submitted by management.
                    </p>
                </div>

                <button
                    onClick={() => loadRequests(true)}
                    disabled={refreshing}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                    <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            {message && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                    {message}
                </div>
            )}

            {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-medium text-amber-700">Pending requests</p>
                    <p className="mt-2 text-3xl font-bold text-amber-800">{pendingCount}</p>
                </div>

                <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                    <p className="text-sm font-medium text-green-700">Approved requests</p>
                    <p className="mt-2 text-3xl font-bold text-green-800">{approvedCount}</p>
                </div>

                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                    <p className="text-sm font-medium text-red-700">Rejected requests</p>
                    <p className="mt-2 text-3xl font-bold text-red-800">{rejectedCount}</p>
                </div>
            </div>

            <div className="flex flex-wrap gap-2">
                {[
                    ['pending', 'Pending'],
                    ['approved', 'Approved'],
                    ['rejected', 'Rejected'],
                    ['all', 'All requests']
                ].map(([value, label]) => (
                    <button
                        key={value}
                        onClick={() => setFilter(value)}
                        className={`rounded-lg px-4 py-2 text-sm font-medium ${filter === value
                                ? 'bg-blue-900 text-white'
                                : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {filteredRequests.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
                    <FileText className="mx-auto h-10 w-10 text-gray-300" />
                    <p className="mt-3 font-medium text-gray-700">No requests found</p>
                    <p className="mt-1 text-sm text-gray-500">
                        There are no requests in this category.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredRequests.map(request => {
                        const recipients = Array.isArray(request.recipients)
                            ? request.recipients
                            : []

                        const isMeal = request.request_type === 'staff_meal'
                        const isTeam = request.request_scope === 'team'
                        const isPending = request.status === 'pending'

                        return (
                            <div
                                key={request.id}
                                className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
                            >
                                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`rounded-lg p-3 ${isMeal
                                                ? 'bg-orange-50 text-orange-600'
                                                : 'bg-blue-50 text-blue-600'
                                            }`}>
                                            {isMeal
                                                ? <Utensils className="h-5 w-5" />
                                                : <Car className="h-5 w-5" />
                                            }
                                        </div>

                                        <div>
                                            <h2 className="font-semibold text-gray-800">
                                                {isMeal ? 'Staff Meal Request' : 'Transport Request'}
                                            </h2>
                                            <p className="text-xs text-gray-500">
                                                {isTeam ? 'Entire staff team' : 'Individual employee'}
                                            </p>
                                        </div>
                                    </div>

                                    <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusStyle(request.status)}`}>
                                        {request.status}
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 gap-5 p-4 lg:grid-cols-2">
                                    <div className="space-y-4">
                                        <div>
                                            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
                                                <Users className="h-4 w-4" />
                                                Recipients ({recipients.length})
                                            </p>

                                            {recipients.length > 0 ? (
                                                <div className="space-y-2 rounded-lg bg-gray-50 p-3">
                                                    {recipients.map((person, index) => (
                                                        <div
                                                            key={person.id || `${person.staff_member_id || 'staff'}-${index}`}
                                                            className="flex justify-between gap-3 text-sm"
                                                        >
                                                            <span className="font-medium text-gray-700">
                                                                {person.staff_name || 'Staff member'}
                                                            </span>
                                                            <span className="text-gray-500">
                                                                {person.position || ''}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-sm text-gray-500">
                                                    No recipient details available.
                                                </p>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="rounded-lg bg-gray-50 p-3">
                                                <p className="text-xs text-gray-500">Requested quantity</p>
                                                <p className="mt-1 font-semibold text-gray-800">
                                                    {request.requested_quantity ?? '—'}
                                                </p>
                                            </div>

                                            <div className="rounded-lg bg-gray-50 p-3">
                                                <p className="text-xs text-gray-500">Requested amount</p>
                                                <p className="mt-1 font-semibold text-gray-800">
                                                    {formatMoney(request.requested_amount, request.currency)}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="space-y-1 text-sm text-gray-600">
                                            {request.requested_for_date && (
                                                <p className="flex items-center gap-2">
                                                    <CalendarDays className="h-4 w-4" />
                                                    Requested date: {formatDate(request.requested_for_date)}
                                                </p>
                                            )}

                                            {(request.period_start_date || request.period_end_date) && (
                                                <p className="flex items-center gap-2">
                                                    <CalendarDays className="h-4 w-4" />
                                                    Period: {formatDate(request.period_start_date)} – {formatDate(request.period_end_date)}
                                                </p>
                                            )}

                                            <p className="flex items-center gap-2">
                                                <Clock3 className="h-4 w-4" />
                                                Submitted: {formatDateTime(request.created_at)}
                                            </p>
                                        </div>

                                        <div>
                                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                Reason
                                            </p>
                                            <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">
                                                {request.request_reason || 'No reason provided.'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        {isPending ? (
                                            <>
                                                <div>
                                                    <label className="mb-1 block text-sm font-medium text-gray-700">
                                                        Approved amount ({request.currency || 'USD'})
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={approvedAmounts[request.id] ?? ''}
                                                        onChange={event => setApprovedAmounts(previous => ({
                                                            ...previous,
                                                            [request.id]: event.target.value
                                                        }))}
                                                        placeholder="Leave blank if no amount applies"
                                                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                                    />
                                                    <p className="mt-1 text-xs text-gray-500">
                                                        You may approve a different amount from the amount requested.
                                                    </p>
                                                </div>

                                                <div>
                                                    <label className="mb-1 block text-sm font-medium text-gray-700">
                                                        Owner notes
                                                    </label>
                                                    <textarea
                                                        rows="3"
                                                        value={ownerNotes[request.id] ?? ''}
                                                        onChange={event => setOwnerNotes(previous => ({
                                                            ...previous,
                                                            [request.id]: event.target.value
                                                        }))}
                                                        placeholder="Add instructions or a reason for your decision..."
                                                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                                    />
                                                </div>

                                                <div className="flex flex-wrap gap-3">
                                                    <button
                                                        onClick={() => reviewRequest(request, 'approved')}
                                                        disabled={reviewing === request.id}
                                                        className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                                                    >
                                                        {reviewing === request.id
                                                            ? <LoaderCircle className="h-4 w-4 animate-spin" />
                                                            : <CheckCircle2 className="h-4 w-4" />
                                                        }
                                                        Approve
                                                    </button>

                                                    <button
                                                        onClick={() => reviewRequest(request, 'rejected')}
                                                        disabled={reviewing === request.id}
                                                        className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                                                    >
                                                        <XCircle className="h-4 w-4" />
                                                        Reject
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="space-y-3 rounded-lg bg-gray-50 p-4">
                                                <div>
                                                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                        Approved amount
                                                    </p>
                                                    <p className="mt-1 font-semibold text-gray-800">
                                                        {request.status === 'approved'
                                                            ? formatMoney(request.approved_amount, request.currency)
                                                            : 'Not approved'
                                                        }
                                                    </p>
                                                </div>

                                                <div>
                                                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                        Owner notes
                                                    </p>
                                                    <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">
                                                        {request.owner_notes || 'No notes added.'}
                                                    </p>
                                                </div>

                                                <div className="text-xs text-gray-500">
                                                    Reviewed: {formatDateTime(request.reviewed_at)}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
