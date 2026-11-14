
import { useCallback, useEffect, useMemo, useState } from 'react'
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
    FileText,
    MessageSquare,
    BadgeCheck,
    AlertCircle,
    UserRound,
    Wallet
} from 'lucide-react'
import { supabase } from './supabase'

const CURRENCIES = ['USD', 'ZAR', 'ZWG']

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

    const numericAmount = Number(amount)

    if (!Number.isFinite(numericAmount)) return 'Invalid amount'

    return `${numericAmount.toFixed(2)} ${currency}`
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

const getRequestType = type => {
    if (type === 'staff_meal') return 'Staff Meal'
    if (type === 'transport') return 'Transport'

    return String(type || 'Benefit').replaceAll('_', ' ')
}

const getErrorMessage = error => {
    const message = error?.message || ''

    if (message.includes('already been reviewed')) {
        return 'This request has already been reviewed. Refreshing the requests...'
    }

    if (message.includes('Benefit request not found')) {
        return 'This request could not be found. It may have been removed or is no longer available.'
    }

    if (message.includes('Only the Owner')) {
        return 'Only the Owner account can review staff benefit requests.'
    }

    return message || 'Unable to process this request.'
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
        if (showRefresh) {
            setRefreshing(true)
        } else {
            setLoading(true)
        }

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
                            request.approved_amount !== null &&
                                request.approved_amount !== undefined
                                ? String(request.approved_amount)
                                : request.requested_amount !== null &&
                                    request.requested_amount !== undefined
                                    ? String(request.requested_amount)
                                    : ''
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
            console.error(
                'Unable to load staff benefit requests:',
                err
            )

            setError(
                err.message || 'Unable to load staff benefit requests.'
            )
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }, [])

    useEffect(() => {
        loadRequests()
    }, [loadRequests])

    const reviewRequest = async (request, decision) => {
        if (reviewing) return

        setMessage('')
        setError('')

        if (!request?.id || request.status !== 'pending') {
            setError('Only pending requests can be reviewed.')
            return
        }

        const notes = (ownerNotes[request.id] || '').trim()
        const amountValue = approvedAmounts[request.id]

        let approvedAmount = null

        if (decision !== 'approved' && decision !== 'rejected') {
            setError('Invalid review decision.')
            return
        }

        if (decision === 'rejected' && !notes) {
            setError('Please provide a reason when rejecting a request.')
            return
        }

        if (
            decision === 'approved' &&
            amountValue !== '' &&
            amountValue !== null &&
            amountValue !== undefined
        ) {
            approvedAmount = Number(amountValue)

            if (
                !Number.isFinite(approvedAmount) ||
                approvedAmount < 0
            ) {
                setError('Enter a valid approved amount of zero or more.')
                return
            }
        }

        const currency = CURRENCIES.includes(request.currency)
            ? request.currency
            : 'USD'

        const type = getRequestType(request.request_type).toLowerCase()

        const confirmation = decision === 'approved'
            ? approvedAmount === null
                ? `Approve this ${type} request without specifying an approved amount?`
                : `Approve this ${type} request for ${currency} ${approvedAmount.toFixed(2)}?`
            : 'Reject this staff benefit request?'

        if (!window.confirm(confirmation)) return

        setReviewing(request.id)

        try {
            const { error: reviewError } = await supabase.rpc(
                'owner_review_staff_benefit_request',
                {
                    p_request_id: request.id,
                    p_decision: decision,
                    p_approved_amount:
                        decision === 'approved'
                            ? approvedAmount
                            : null,
                    p_owner_notes: notes || null
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
            console.error(
                'Unable to review staff benefit request:',
                err
            )

            setError(getErrorMessage(err))

            if (
                err.message?.includes('already been reviewed') ||
                err.message?.includes('Benefit request not found')
            ) {
                await loadRequests(true)
            }
        } finally {
            setReviewing('')
        }
    }

    const pendingCount = useMemo(
        () => requests.filter(request => request.status === 'pending').length,
        [requests]
    )

    const approvedCount = useMemo(
        () => requests.filter(request => request.status === 'approved').length,
        [requests]
    )

    const rejectedCount = useMemo(
        () => requests.filter(request => request.status === 'rejected').length,
        [requests]
    )

    const filteredRequests = useMemo(
        () => requests.filter(request =>
            filter === 'all' || request.status === filter
        ),
        [requests, filter]
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

            {/* Header */}

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
                    type="button"
                    onClick={() => loadRequests(true)}
                    disabled={refreshing || reviewing !== ''}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                    <RefreshCw
                        className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
                    />
                    Refresh
                </button>
            </div>

            {/* Messages */}

            {message && (
                <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    {message}
                </div>
            )}

            {error && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    {error}
                </div>
            )}

            {/* Statistics */}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-amber-700">
                            Pending requests
                        </p>
                        <Clock3 className="h-5 w-5 text-amber-600" />
                    </div>

                    <p className="mt-2 text-3xl font-bold text-amber-800">
                        {pendingCount}
                    </p>
                </div>

                <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-green-700">
                            Approved requests
                        </p>
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                    </div>

                    <p className="mt-2 text-3xl font-bold text-green-800">
                        {approvedCount}
                    </p>
                </div>

                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-red-700">
                            Rejected requests
                        </p>
                        <XCircle className="h-5 w-5 text-red-600" />
                    </div>

                    <p className="mt-2 text-3xl font-bold text-red-800">
                        {rejectedCount}
                    </p>
                </div>
            </div>

            {/* Filters */}

            <div className="flex flex-wrap gap-2">
                {[
                    ['pending', 'Pending'],
                    ['approved', 'Approved'],
                    ['rejected', 'Rejected'],
                    ['all', 'All requests']
                ].map(([value, label]) => (
                    <button
                        type="button"
                        key={value}
                        onClick={() => setFilter(value)}
                        className={`rounded-lg px-4 py-2 text-sm font-medium ${filter === value
                                ? 'bg-blue-900 text-white'
                                : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        {label}

                        <span className="ml-2 text-xs opacity-75">
                            {value === 'pending'
                                ? pendingCount
                                : value === 'approved'
                                    ? approvedCount
                                    : value === 'rejected'
                                        ? rejectedCount
                                        : requests.length
                            }
                        </span>
                    </button>
                ))}
            </div>

            {/* Requests */}

            {filteredRequests.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
                    <FileText className="mx-auto h-10 w-10 text-gray-300" />

                    <p className="mt-3 font-medium text-gray-700">
                        No requests found
                    </p>

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

                        const currency = CURRENCIES.includes(request.currency)
                            ? request.currency
                            : 'USD'

                        const isCurrentlyReviewing =
                            reviewing === request.id

                        return (
                            <div
                                key={request.id}
                                className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
                            >

                                {/* Request heading */}

                                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-4">
                                    <div className="flex items-center gap-3">

                                        <div
                                            className={`rounded-lg p-3 ${isMeal
                                                    ? 'bg-orange-50 text-orange-600'
                                                    : 'bg-blue-50 text-blue-600'
                                                }`}
                                        >
                                            {isMeal ? (
                                                <Utensils className="h-5 w-5" />
                                            ) : (
                                                <Car className="h-5 w-5" />
                                            )}
                                        </div>

                                        <div>
                                            <h2 className="font-semibold text-gray-800">
                                                {getRequestType(request.request_type)} Request
                                            </h2>

                                            <p className="text-xs text-gray-500">
                                                {isTeam
                                                    ? 'Entire staff team'
                                                    : 'Individual employee'
                                                }
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {isCurrentlyReviewing && (
                                            <span className="text-xs text-blue-600">
                                                Processing...
                                            </span>
                                        )}

                                        <span
                                            className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyle(request.status)}`}
                                        >
                                            {statusLabel(request.status)}
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-5 p-4 lg:grid-cols-2">

                                    {/* Left column */}

                                    <div className="space-y-4">

                                        {/* Recipients */}

                                        <div>
                                            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
                                                <Users className="h-4 w-4" />
                                                Recipients ({recipients.length})
                                            </p>

                                            {recipients.length > 0 ? (
                                                <div className="max-h-52 space-y-2 overflow-y-auto rounded-lg bg-gray-50 p-3">
                                                    {recipients.map((person, index) => (
                                                        <div
                                                            key={
                                                                person.id ||
                                                                `${person.staff_member_id || 'staff'}-${index}`
                                                            }
                                                            className="flex items-center justify-between gap-3 border-b border-gray-100 pb-2 last:border-0 last:pb-0"
                                                        >
                                                            <div className="flex min-w-0 items-center gap-2">
                                                                <UserRound className="h-4 w-4 shrink-0 text-gray-400" />

                                                                <span className="truncate text-sm font-medium text-gray-700">
                                                                    {person.staff_name || 'Staff member'}
                                                                </span>
                                                            </div>

                                                            <span className="shrink-0 text-xs text-gray-500">
                                                                {person.position || ''}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-500">
                                                    No recipient details available.
                                                </p>
                                            )}

                                            {isTeam && (
                                                <p className="mt-2 text-xs text-gray-500">
                                                    Team recipients reflect currently active staff members returned by the database.
                                                </p>
                                            )}
                                        </div>

                                        {/* Requested amounts */}

                                        <div className="grid grid-cols-2 gap-3">

                                            <div className="rounded-lg bg-gray-50 p-3">
                                                <p className="text-xs text-gray-500">
                                                    Requested quantity
                                                </p>

                                                <p className="mt-1 font-semibold text-gray-800">
                                                    {request.requested_quantity ?? '—'}
                                                </p>
                                            </div>

                                            <div className="rounded-lg bg-gray-50 p-3">
                                                <p className="text-xs text-gray-500">
                                                    Requested amount
                                                </p>

                                                <p className="mt-1 break-words font-semibold text-gray-800">
                                                    {formatMoney(
                                                        request.requested_amount,
                                                        currency
                                                    )}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Dates */}

                                        <div className="space-y-2 text-sm text-gray-600">

                                            {request.requested_for_date && (
                                                <p className="flex items-center gap-2">
                                                    <CalendarDays className="h-4 w-4 shrink-0" />
                                                    <span>
                                                        Requested date:{' '}
                                                        <strong className="font-medium text-gray-800">
                                                            {formatDate(request.requested_for_date)}
                                                        </strong>
                                                    </span>
                                                </p>
                                            )}

                                            {(request.period_start_date || request.period_end_date) && (
                                                <p className="flex items-center gap-2">
                                                    <CalendarDays className="h-4 w-4 shrink-0" />
                                                    <span>
                                                        Period:{' '}
                                                        <strong className="font-medium text-gray-800">
                                                            {formatDate(request.period_start_date)}
                                                            {' – '}
                                                            {formatDate(request.period_end_date)}
                                                        </strong>
                                                    </span>
                                                </p>
                                            )}

                                            <p className="flex items-center gap-2">
                                                <Clock3 className="h-4 w-4 shrink-0" />
                                                <span>
                                                    Submitted:{' '}
                                                    <strong className="font-medium text-gray-800">
                                                        {formatDateTime(request.created_at)}
                                                    </strong>
                                                </span>
                                            </p>
                                        </div>

                                        {/* Reason */}

                                        <div className="rounded-lg border border-gray-100 p-3">
                                            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                <MessageSquare className="h-4 w-4" />
                                                Request reason
                                            </p>

                                            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                                                {request.request_reason || 'No reason provided.'}
                                            </p>
                                        </div>

                                    </div>

                                    {/* Right column */}

                                    <div className="space-y-4">

                                        {isPending ? (
                                            <>

                                                {/* Approved amount */}

                                                <div>
                                                    <label
                                                        htmlFor={`approved-amount-${request.id}`}
                                                        className="mb-1 block text-sm font-medium text-gray-700"
                                                    >
                                                        Approved amount ({currency})
                                                    </label>

                                                    <div className="relative">
                                                        <Wallet className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

                                                        <input
                                                            id={`approved-amount-${request.id}`}
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            inputMode="decimal"
                                                            value={approvedAmounts[request.id] ?? ''}
                                                            onChange={event => {
                                                                setApprovedAmounts(previous => ({
                                                                    ...previous,
                                                                    [request.id]: event.target.value
                                                                }))
                                                            }}
                                                            disabled={reviewing !== ''}
                                                            placeholder="Enter approved amount"
                                                            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
                                                        />
                                                    </div>

                                                    <p className="mt-1 text-xs text-gray-500">
                                                        You may approve a different amount from the amount requested. Leave blank if no amount is being specified.
                                                    </p>
                                                </div>

                                                {/* Owner notes */}

                                                <div>
                                                    <label
                                                        htmlFor={`owner-notes-${request.id}`}
                                                        className="mb-1 block text-sm font-medium text-gray-700"
                                                    >
                                                        Owner notes
                                                        {request.status === 'pending' && (
                                                            <span className="ml-1 font-normal text-gray-400">
                                                                (required for rejection)
                                                            </span>
                                                        )}
                                                    </label>

                                                    <textarea
                                                        id={`owner-notes-${request.id}`}
                                                        rows="4"
                                                        value={ownerNotes[request.id] ?? ''}
                                                        onChange={event => {
                                                            setOwnerNotes(previous => ({
                                                                ...previous,
                                                                [request.id]: event.target.value
                                                            }))
                                                        }}
                                                        disabled={reviewing !== ''}
                                                        placeholder="Add instructions or a reason for your decision..."
                                                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
                                                    />
                                                </div>

                                                {/* Review buttons */}

                                                <div className="flex flex-wrap gap-3">

                                                    <button
                                                        type="button"
                                                        onClick={() => reviewRequest(request, 'approved')}
                                                        disabled={reviewing !== ''}
                                                        className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        {isCurrentlyReviewing ? (
                                                            <LoaderCircle className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <CheckCircle2 className="h-4 w-4" />
                                                        )}

                                                        Approve
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => reviewRequest(request, 'rejected')}
                                                        disabled={reviewing !== ''}
                                                        className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        <XCircle className="h-4 w-4" />
                                                        Reject
                                                    </button>

                                                </div>
                                            </>
                                        ) : (

                                            /* Completed review */

                                            <div className="space-y-4 rounded-lg bg-gray-50 p-4">

                                                <div>
                                                    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                        <BadgeCheck className="h-4 w-4" />
                                                        Review outcome
                                                    </p>

                                                    <p className="mt-2 font-semibold text-gray-800">
                                                        {request.status === 'approved'
                                                            ? 'Approved'
                                                            : 'Rejected'
                                                        }
                                                    </p>
                                                </div>

                                                <div>
                                                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                        Approved amount
                                                    </p>

                                                    <p className="mt-1 font-semibold text-gray-800">
                                                        {request.status === 'approved'
                                                            ? formatMoney(
                                                                request.approved_amount,
                                                                currency
                                                            )
                                                            : 'Not approved'
                                                        }
                                                    </p>
                                                </div>

                                                <div>
                                                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                        Owner notes
                                                    </p>

                                                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                                                        {request.owner_notes || 'No notes added.'}
                                                    </p>
                                                </div>

                                                <div className="border-t border-gray-200 pt-3">
                                                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                        Reviewed on
                                                    </p>

                                                    <p className="mt-1 text-sm text-gray-700">
                                                        {formatDateTime(request.reviewed_at)}
                                                    </p>
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

            {/* Footer information */}

            <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />

                    <div>
                        <p className="text-sm font-semibold text-blue-900">
                            Benefit approval information
                        </p>

                        <p className="mt-1 text-sm leading-relaxed text-blue-800">
                            Approving or rejecting a request records the Owner's decision only. It does not automatically create an expense, pay an employee, deduct cash, or post a financial journal entry. Any subsequent fulfilment or payment must follow the appropriate financial workflow.
                        </p>
                    </div>
                </div>
            </div>

        </div>
    )
}
