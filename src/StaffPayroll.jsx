
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Users,
    UserPlus,
    CalendarDays,
    CalendarPlus,
    Wallet,
    History,
    Search,
    RefreshCw,
    Pencil,
    UserX,
    CheckCircle2,
    Clock3,
    AlertCircle,
    Save,
    X,
    Banknote,
    ClipboardList,
    TrendingUp,
} from 'lucide-react';

import { supabase } from './supabase';
import { useCurrency } from './CurrencyContext';

const today = () => new Date().toISOString().slice(0, 10);

const EMPTY_STAFF = {
    full_name: '',
    phone_number: '',
    position: '',
    date_joined: today(),
    daily_salary_rate: '',
    status: 'active',
    notes: '',
};
const ATTENDANCE_OPTIONS = [
    { value: 'full_day', label: 'Full Day', credit: '1 day' },
    { value: 'half_day', label: 'Half Day', credit: '0.5 day' },
    { value: 'absent', label: 'Absent', credit: '0 days' },
    { value: 'off_day', label: 'Off Day', credit: '0 days' },
];

const PAYMENT_METHODS = [
    { value: 'cash', label: 'Cash' },
    { value: 'mobile_money', label: 'Mobile Money' },
    { value: 'bank_card', label: 'Bank / Card' },
];

const TABS = [
    { id: 'overview', label: 'Overview', icon: TrendingUp },
    { id: 'staff', label: 'Staff Members', icon: Users },
    { id: 'attendance', label: 'Attendance', icon: CalendarDays },
    { id: 'payroll', label: 'Payroll', icon: Wallet },
    { id: 'history', label: 'History', icon: History },
];

const formatDate = (value) => {
    if (!value) return '—';

    return new Date(`${value}T12:00:00`).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
};

const numberValue = (value) => Number(value || 0);

const getError = (error) =>
    error?.message || 'Something went wrong. Please try again.';

const statusLabel = (status) =>
    ATTENDANCE_OPTIONS.find((item) => item.value === status)?.label || status;

function StatCard({ title, value, subtitle, icon: Icon }) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-sm font-medium text-slate-500">{title}</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
                    {subtitle && (
                        <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
                    )}
                </div>
                <div className="rounded-lg bg-blue-50 p-3 text-blue-700">
                    <Icon size={21} />
                </div>
            </div>
        </div>
    );
}

function Field({ label, children, className = '' }) {
    return (
        <label className={`block ${className}`}>
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
                {label}
            </span>
            {children}
        </label>
    );
}

const inputClass =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

function StatusBadge({ status }) {
    const styles = {
        full_day: 'bg-green-100 text-green-800',
        half_day: 'bg-amber-100 text-amber-800',
        absent: 'bg-red-100 text-red-800',
        off_day: 'bg-slate-100 text-slate-700',
        leave: 'bg-purple-100 text-purple-800',
        active: 'bg-green-100 text-green-800',
        inactive: 'bg-slate-100 text-slate-600',
        open: 'bg-blue-100 text-blue-800',
        paid: 'bg-green-100 text-green-800',
    };

    return (
        <span
            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status] || 'bg-slate-100 text-slate-700'
                }`}
        >
            {statusLabel(status)}
        </span>
    );
}

export default function StaffPayroll({ userRole = '' }) {
    const { formatCurrency } = useCurrency();

    const [activeTab, setActiveTab] = useState('overview');
    const isOwner = userRole === 'owner';
    const isManager = userRole === 'manager';

    useEffect(() => {
        if (isManager) {
            setActiveTab('attendance');
        } else if (isOwner) {
            setActiveTab('overview');
        }
    }, [isManager, isOwner]);
    const [staff, setStaff] = useState([]);
    const [periods, setPeriods] = useState([]);
    const [attendance, setAttendance] = useState([]);
    const [payments, setPayments] = useState([]);
    const [payrollSummaries, setPayrollSummaries] = useState([]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const [search, setSearch] = useState('');
    const [attendanceDate, setAttendanceDate] = useState(today());
    const [historyStaffFilter, setHistoryStaffFilter] = useState('all');

    const [showStaffForm, setShowStaffForm] = useState(false);
    const [editingStaff, setEditingStaff] = useState(null);
    const [staffForm, setStaffForm] = useState(EMPTY_STAFF);
    const [employeeAccounts, setEmployeeAccounts] = useState([]);
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [accountsLoading, setAccountsLoading] = useState(false);

    const [attendanceEntries, setAttendanceEntries] = useState({});
    const [attendanceNotes, setAttendanceNotes] = useState({});

    const [showPeriodForm, setShowPeriodForm] = useState(false);
    const [periodForm, setPeriodForm] = useState({
        staff_member_id: '',
        period_start_date: today(),
        currency_code: 'USD',
    });

    const [paymentStaff, setPaymentStaff] = useState(null);
    const [paymentForm, setPaymentForm] = useState({
        payment_date: today(),
        amount_paid: '',
        payment_method: 'cash',
        notes: '',
    });

    const notifySuccess = (message) => {
        setSuccessMessage(message);
        setErrorMessage('');
    };

    const notifyError = (message) => {
        setErrorMessage(message);
        setSuccessMessage('');
    };

    const clearMessages = () => {
        setErrorMessage('');
        setSuccessMessage('');
    };
    const loadData = useCallback(async () => {
        setLoading(true);
        clearMessages();

        try {
            if (isManager && !isOwner) {
                const { data, error } = await supabase.rpc(
                    'manager_attendance_data'
                );

                if (error) throw error;

                setStaff(data?.staff || []);
                setPeriods(data?.periods || []);
                setAttendance(data?.attendance || []);

                // Managers must never load payroll or payment information.
                setPayments([]);
                setPayrollSummaries([]);

                return;
            }

            if (!isOwner) {
                throw new Error('You do not have permission to access Staff & Payroll.');
            }

            const [
                staffResult,
                periodsResult,
                attendanceResult,
                paymentsResult,
                summariesResult,
            ] = await Promise.all([
                supabase
                    .from('staff_members')
                    .select('*')
                    .order('full_name', { ascending: true }),

                supabase
                    .from('staff_payroll_periods')
                    .select('*')
                    .order('period_start_date', { ascending: false }),

                supabase
                    .from('staff_attendance')
                    .select('*')
                    .order('attendance_date', { ascending: false }),

                supabase
                    .from('staff_salary_payments')
                    .select('*')
                    .order('payment_date', { ascending: false }),

                supabase
                    .from('staff_payroll_summary')
                    .select('*'),
            ]);

            if (staffResult.error) throw staffResult.error;
            if (periodsResult.error) throw periodsResult.error;
            if (attendanceResult.error) throw attendanceResult.error;
            if (paymentsResult.error) throw paymentsResult.error;
            if (summariesResult.error) throw summariesResult.error;

            setStaff(staffResult.data || []);
            setPeriods(periodsResult.data || []);
            setAttendance(attendanceResult.data || []);
            setPayments(paymentsResult.data || []);
            setPayrollSummaries(summariesResult.data || []);

        } catch (error) {
            notifyError(getError(error));
        } finally {
            setLoading(false);
        }
    }, [isManager, isOwner]);

    useEffect(() => {
        if (!userRole) return;

        loadData();
    }, [loadData, userRole]);
    useEffect(() => {
        if (!isOwner) {
            setEmployeeAccounts([]);
            return;
        }

        let cancelled = false;

        const loadEmployeeAccounts = async () => {
            setAccountsLoading(true);

            try {
                const { data, error } = await supabase.rpc(
                    'get_employee_account_options'
                );

                if (error) throw error;

                if (!cancelled) {
                    setEmployeeAccounts(data || []);
                }
            } catch (error) {
                if (!cancelled) {
                    notifyError(getError(error));
                }
            } finally {
                if (!cancelled) {
                    setAccountsLoading(false);
                }
            }
        };

        loadEmployeeAccounts();

        return () => {
            cancelled = true;
        };
    }, [isOwner]);

    const activeStaff = useMemo(
        () => staff.filter((person) => person.status === 'active'),
        [staff]
    );

    const filteredStaff = useMemo(() => {
        const term = search.trim().toLowerCase();

        if (!term) return staff;

        return staff.filter((person) =>
            [
                person.full_name,
                person.position,
                person.phone_number,
            ].some((value) => String(value || '').toLowerCase().includes(term))
        );
    }, [staff, search]);

    const currentPeriodByStaff = useMemo(() => {
        const result = {};

        periods
            .filter((period) => period.status === 'open')
            .forEach((period) => {
                result[period.staff_member_id] = period;
            });

        return result;
    }, [periods]);

    const summaryByPeriod = useMemo(() => {
        const result = {};

        payrollSummaries.forEach((summary) => {
            result[summary.payroll_period_id] = summary;
        });

        return result;
    }, [payrollSummaries]);

    const attendanceForSelectedDate = useMemo(() => {
        const result = {};

        attendance
            .filter((entry) => entry.attendance_date === attendanceDate)
            .forEach((entry) => {
                result[entry.staff_member_id] = entry;
            });

        return result;
    }, [attendance, attendanceDate]);

    const currentPayrollRows = useMemo(() => {
        return activeStaff.map((person) => {
            const period = currentPeriodByStaff[person.id];
            const summary = period ? summaryByPeriod[period.id] : null;

            return {
                person,
                period,
                summary,
                payableDays: numberValue(summary?.payable_days),
                salaryDue: numberValue(summary?.salary_due),
                totalPaid: numberValue(summary?.total_paid),
                balanceDue: numberValue(summary?.balance_due),
            };
        });
    }, [activeStaff, currentPeriodByStaff, summaryByPeriod]);

    const totalOutstanding = currentPayrollRows.reduce(
        (sum, row) => sum + Math.max(0, row.balanceDue),
        0
    );

    const totalPaidThisMonth = payments
        .filter((payment) => {
            const paymentMonth = payment.payment_date?.slice(0, 7);
            return paymentMonth === today().slice(0, 7);
        })
        .reduce((sum, payment) => sum + numberValue(payment.amount_paid), 0);

    const todayAttendance = attendance.filter(
        (entry) => entry.attendance_date === today()
    );

    const presentToday = todayAttendance.filter((entry) =>
        ['full_day', 'half_day'].includes(entry.attendance_status)
    ).length;

    const openStaffForm = (person = null) => {
        clearMessages();
        setEditingStaff(person);
        setSelectedAccountId(person?.user_id || '');

        if (person) {
            setStaffForm({
                full_name: person.full_name || '',
                phone_number: person.phone_number || '',
                position: person.position || '',
                date_joined: person.date_joined || today(),
                daily_salary_rate: String(person.daily_salary_rate ?? ''),
                status: person.status || 'active',
                notes: person.notes || '',
            });
        } else {
            setStaffForm({ ...EMPTY_STAFF, date_joined: today() });
        }

        setShowStaffForm(true);
    };
    const saveStaff = async (event) => {
        event.preventDefault();
        clearMessages();

        if (
            !staffForm.full_name.trim() ||
            !staffForm.position.trim() ||
            !staffForm.date_joined ||
            staffForm.daily_salary_rate === ''
        ) {
            notifyError('Please complete all required staff details.');
            return;
        }

        const rate = Number(staffForm.daily_salary_rate);

        if (!Number.isFinite(rate) || rate < 0) {
            notifyError('Please enter a valid daily salary rate.');
            return;
        }

        setSaving(true);

        try {
            const { error } = await supabase.rpc(
                'owner_save_staff_member',
                {
                    p_staff_member_id: editingStaff?.id || null,
                    p_full_name: staffForm.full_name.trim(),
                    p_phone_number: staffForm.phone_number.trim() || null,
                    p_position: staffForm.position.trim(),
                    p_date_joined: staffForm.date_joined,
                    p_daily_salary_rate: rate,
                    p_status: staffForm.status,
                    p_notes: staffForm.notes.trim() || null,
                    p_user_id: selectedAccountId || null,
                }
            );

            if (error) throw error;

            setShowStaffForm(false);
            setEditingStaff(null);
            setStaffForm(EMPTY_STAFF);
            setSelectedAccountId('');

            notifySuccess(
                editingStaff
                    ? 'Staff member updated and login account linked successfully.'
                    : 'Staff member registered and login account linked successfully.'
            );

            await Promise.all([
                loadData(),
                (async () => {
                    const { data, error } = await supabase.rpc(
                        'get_employee_account_options'
                    );

                    if (error) throw error;
                    setEmployeeAccounts(data || []);
                })(),
            ]);
        } catch (error) {
            notifyError(getError(error));
        } finally {
            setSaving(false);
        }
    };
    const toggleStaffStatus = async (person) => {
        if (!isOwner) {
            notifyError('Only the owner can change staff employment status.');
            return;
        }

        const nextStatus = person.status === 'active' ? 'inactive' : 'active';

        const confirmed = window.confirm(
            `${nextStatus === 'inactive' ? 'Deactivate' : 'Reactivate'} ${person.full_name}?`
        );

        if (!confirmed) return;

        clearMessages();
        setSaving(true);

        try {
            const { error } = await supabase
                .from('staff_members')
                .update({ status: nextStatus })
                .eq('id', person.id);

            if (error) throw error;

            notifySuccess(
                nextStatus === 'inactive'
                    ? 'Staff member deactivated.'
                    : 'Staff member reactivated.'
            );

            await loadData();
        } catch (error) {
            notifyError(getError(error));
        } finally {
            setSaving(false);
        }
    };
    const saveAttendance = async (person) => {
        clearMessages();

        const period = currentPeriodByStaff[person.id];

        if (!period) {
            notifyError(
                `No open payroll period exists for ${person.full_name}.`
            );
            return;
        }

        if (attendanceDate < period.period_start_date) {
            notifyError(
                `Attendance date must be on or after ${formatDate(period.period_start_date)}.`
            );
            return;
        }

        if (attendanceDate > today()) {
            notifyError('Attendance cannot be recorded for a future date.');
            return;
        }

        const status =
            attendanceEntries[person.id] ||
            attendanceForSelectedDate[person.id]?.attendance_status;

        if (!status) {
            notifyError(`Select an attendance status for ${person.full_name}.`);
            return;
        }

        const existing = attendanceForSelectedDate[person.id];

        const notes =
            attendanceNotes[person.id] ??
            existing?.notes ??
            null;

        setSaving(true);

        try {
            if (isManager && !isOwner) {
                const { error } = await supabase.rpc(
                    'manager_save_attendance',
                    {
                        p_staff_member_id: person.id,
                        p_payroll_period_id: period.id,
                        p_attendance_date: attendanceDate,
                        p_attendance_status: status,
                        p_notes: notes,
                        p_attendance_id: existing?.id || null,
                    }
                );

                if (error) throw error;
            } else {
                const payload = {
                    staff_member_id: person.id,
                    payroll_period_id: period.id,
                    attendance_date: attendanceDate,
                    attendance_status: status,
                    notes,
                };

                const { error } = await supabase
                    .from('staff_attendance')
                    .upsert(payload, {
                        onConflict: 'staff_member_id,attendance_date',
                    });

                if (error) throw error;
            }

            notifySuccess(`Attendance saved for ${person.full_name}.`);
            await loadData();
        } catch (error) {
            notifyError(getError(error));
        } finally {
            setSaving(false);
        }
    };

    const saveAllAttendance = async () => {
        const entries = activeStaff
            .filter((person) => attendanceEntries[person.id])
            .map((person) => ({
                person,
                status: attendanceEntries[person.id],
            }));

        if (entries.length === 0) {
            notifyError('Select attendance statuses before saving.');
            return;
        }

        if (attendanceDate > today()) {
            notifyError('Attendance cannot be recorded for a future date.');
            return;
        }

        const invalidEntry = entries.find(({ person }) => {
            const period = currentPeriodByStaff[person.id];

            return (
                !period ||
                attendanceDate < period.period_start_date
            );
        });

        if (invalidEntry) {
            notifyError(
                `Check the open payroll period for ${invalidEntry.person.full_name}.`
            );
            return;
        }

        setSaving(true);
        clearMessages();

        try {
            const rows = entries.map(({ person, status }) => ({
                staff_member_id: person.id,
                payroll_period_id: currentPeriodByStaff[person.id].id,
                attendance_date: attendanceDate,
                attendance_status: status,
                notes: attendanceNotes[person.id] || null,
            }));

            if (isManager && !isOwner) {
                for (const row of rows) {
                    const existing =
                        attendanceForSelectedDate[row.staff_member_id];

                    const { error } = await supabase.rpc(
                        'manager_save_attendance',
                        {
                            p_staff_member_id: row.staff_member_id,
                            p_payroll_period_id: row.payroll_period_id,
                            p_attendance_date: row.attendance_date,
                            p_attendance_status: row.attendance_status,
                            p_notes: row.notes,
                            p_attendance_id: existing?.id || null,
                        }
                    );

                    if (error) throw error;
                }
            } else {
                const { error } = await supabase
                    .from('staff_attendance')
                    .upsert(rows, {
                        onConflict: 'staff_member_id,attendance_date',
                    });

                if (error) throw error;
            }

            notifySuccess(`Attendance saved for ${rows.length} staff member(s).`);
            setAttendanceEntries({});
            setAttendanceNotes({});
            await loadData();
        } catch (error) {
            notifyError(getError(error));
        } finally {
            setSaving(false);
        }
    };

    const openPaymentForm = (row) => {
        if (!row.period) {
            notifyError(`No open payroll period for ${row.person.full_name}.`);
            return;
        }

        if (row.balanceDue <= 0) {
            notifyError('There is no outstanding salary balance to pay.');
            return;
        }

        clearMessages();
        setPaymentStaff(row.person);
        setPaymentForm({
            payment_date: today(),
            amount_paid: row.balanceDue.toFixed(2),
            payment_method: 'cash',
            notes: '',
        });
    };

    const recordPayment = async (event) => {
        event.preventDefault();
        clearMessages();

        if (!paymentStaff) return;

        const amount = Number(paymentForm.amount_paid);

        if (!paymentForm.payment_date || !Number.isFinite(amount) || amount <= 0) {
            notifyError('Enter a valid payment date and amount.');
            return;
        }

        if (paymentForm.payment_date > today()) {
            notifyError('Payment date cannot be in the future.');
            return;
        }

        setSaving(true);

        try {
            const { error } = await supabase.rpc(
                'record_staff_salary_payment',
                {
                    p_staff_member_id: paymentStaff.id,
                    p_payment_date: paymentForm.payment_date,
                    p_amount_paid: amount,
                    p_payment_method: paymentForm.payment_method,
                    p_notes: paymentForm.notes.trim() || null,
                }
            );

            if (error) throw error;

            setPaymentStaff(null);
            setPaymentForm({
                payment_date: today(),
                amount_paid: '',
                payment_method: 'cash',
                notes: '',
            });

            notifySuccess('Salary payment recorded successfully.');

            window.dispatchEvent(new Event('refresh-canteen-dashboard'));

            await loadData();
        } catch (error) {
            notifyError(getError(error));
        } finally {
            setSaving(false);
        }
    };

    const openPayrollPeriodForm = () => {
        if (!isOwner) {
            notifyError('Only the owner can create payroll periods.');
            return;
        }

        const eligibleStaff = activeStaff.filter(
            (person) => !currentPeriodByStaff[person.id]
        );

        setPeriodForm({
            staff_member_id: eligibleStaff[0]?.id || '',
            period_start_date: today(),
            currency_code: 'USD',
        });
        clearMessages();
        setShowPeriodForm(true);
    };

    const createPayrollPeriod = async (event) => {
        event.preventDefault();
        clearMessages();

        if (!periodForm.staff_member_id || !periodForm.period_start_date) {
            notifyError('Select an employee and payroll start date.');
            return;
        }

        if (!['USD', 'ZAR', 'ZWG'].includes(periodForm.currency_code)) {
            notifyError('Select a valid payroll currency.');
            return;
        }

        if (currentPeriodByStaff[periodForm.staff_member_id]) {
            notifyError('This employee already has an open payroll period.');
            return;
        }

        setSaving(true);

        try {
            const { error } = await supabase.rpc(
                'owner_create_staff_payroll_period',
                {
                    p_staff_member_id: periodForm.staff_member_id,
                    p_period_start_date: periodForm.period_start_date,
                    p_currency_code: periodForm.currency_code,
                }
            );

            if (error) throw error;

            setShowPeriodForm(false);
            notifySuccess('Payroll period created successfully. Attendance can now be recorded.');
            await loadData();
        } catch (error) {
            notifyError(getError(error));
        } finally {
            setSaving(false);
        }
    };

    const filteredAttendanceHistory = useMemo(() => {
        return attendance.filter((entry) => {
            if (
                historyStaffFilter !== 'all' &&
                entry.staff_member_id !== historyStaffFilter
            ) {
                return false;
            }

            return true;
        });
    }, [attendance, historyStaffFilter]);

    const staffName = (staffId) =>
        staff.find((person) => person.id === staffId)?.full_name || 'Unknown staff';

    const staffPosition = (staffId) =>
        staff.find((person) => person.id === staffId)?.position || '—';

    const renderMessages = () => (
        <>
            {errorMessage && (
                <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    <AlertCircle size={18} className="mt-0.5 shrink-0" />
                    <span>{errorMessage}</span>
                </div>
            )}

            {successMessage && (
                <div className="mb-4 flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                    <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
                    <span>{successMessage}</span>
                </div>
            )}
        </>
    );

    const renderOverview = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    title="Active Staff"
                    value={activeStaff.length}
                    subtitle="Currently employed"
                    icon={Users}
                />

                <StatCard
                    title="Present Today"
                    value={presentToday}
                    subtitle="Full-day and half-day attendance"
                    icon={CalendarDays}
                />

                <StatCard
                    title="Outstanding Salary"
                    value={formatCurrency(totalOutstanding)}
                    subtitle="Across open payroll periods"
                    icon={Wallet}
                />

                <StatCard
                    title="Paid This Month"
                    value={formatCurrency(totalPaidThisMonth)}
                    subtitle="Recorded salary payments"
                    icon={Banknote}
                />
            </div>

            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5">
                    <div>
                        <h3 className="font-semibold text-slate-900">
                            Current Payroll Overview
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                            Accumulated attendance and salary for each active worker.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => setActiveTab('payroll')}
                        className="text-sm font-semibold text-blue-700 hover:text-blue-900"
                    >
                        View payroll
                    </button>
                </div>

                {currentPayrollRows.length === 0 ? (
                    <div className="p-8 text-center text-sm text-slate-500">
                        No active staff members have been registered yet.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[850px] text-left text-sm">
                            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                                <tr>
                                    <th className="px-5 py-3">Staff member</th>
                                    <th className="px-5 py-3">Period started</th>
                                    <th className="px-5 py-3">Payable days</th>
                                    <th className="px-5 py-3">Salary due</th>
                                    <th className="px-5 py-3">Paid</th>
                                    <th className="px-5 py-3">Balance</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {currentPayrollRows.map((row) => (
                                    <tr key={row.person.id}>
                                        <td className="px-5 py-3">
                                            <p className="font-semibold text-slate-900">
                                                {row.person.full_name}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                {row.person.position}
                                            </p>
                                        </td>
                                        <td className="px-5 py-3 text-slate-600">
                                            {formatDate(row.period?.period_start_date)}
                                        </td>
                                        <td className="px-5 py-3 font-medium">
                                            {row.payableDays.toFixed(1)}
                                        </td>
                                        <td className="px-5 py-3">
                                            {formatCurrency(row.salaryDue)}
                                        </td>
                                        <td className="px-5 py-3">
                                            {formatCurrency(row.totalPaid)}
                                        </td>
                                        <td className="px-5 py-3 font-semibold text-amber-700">
                                            {formatCurrency(Math.max(0, row.balanceDue))}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="rounded-xl border border-blue-100 bg-blue-50 p-5">
                <div className="flex items-start gap-3">
                    <ClipboardList className="mt-0.5 shrink-0 text-blue-700" size={21} />
                    <div>
                        <h3 className="font-semibold text-blue-900">
                            Attendance and salary rules
                        </h3>
                        <p className="mt-1 text-sm leading-6 text-blue-800">
                            Full day = 1 payable day. Half day = 0.5 payable day.
                            Absent, off day and leave = 0 payable days. A payroll period
                            closes automatically after its full salary balance is paid.
                            Historical records are retained.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderStaff = () => (
        <div className="space-y-5">
            <div className="flex flex-col justify-between gap-3 sm:flex-row">
                <div className="relative w-full sm:max-w-sm">
                    <Search
                        size={18}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search name, position or phone..."
                        className={`${inputClass} pl-10`}
                    />
                </div>

                <button
                    type="button"
                    onClick={() => openStaffForm()}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
                >
                    <UserPlus size={17} />
                    Add Staff Member
                </button>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                {filteredStaff.length === 0 ? (
                    <div className="p-10 text-center">
                        <Users className="mx-auto mb-3 text-slate-300" size={35} />
                        <p className="font-medium text-slate-700">
                            No staff members found.
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                            Register your first worker to get started.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[900px] text-left text-sm">
                            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                                <tr>
                                    <th className="px-5 py-3">Name</th>
                                    <th className="px-5 py-3">Position</th>
                                    <th className="px-5 py-3">Phone</th>
                                    <th className="px-5 py-3">Date Joined</th>
                                    <th className="px-5 py-3">Daily Rate</th>
                                    <th className="px-5 py-3">Status</th>
                                    <th className="px-5 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredStaff.map((person) => (
                                    <tr key={person.id}>
                                        <td className="px-5 py-3 font-semibold text-slate-900">
                                            {person.full_name}
                                        </td>
                                        <td className="px-5 py-3 text-slate-600">
                                            {person.position}
                                        </td>
                                        <td className="px-5 py-3 text-slate-600">
                                            {person.phone_number || '—'}
                                        </td>
                                        <td className="px-5 py-3 text-slate-600">
                                            {formatDate(person.date_joined)}
                                        </td>
                                        <td className="px-5 py-3 font-medium text-slate-900">
                                            {formatCurrency(numberValue(person.daily_salary_rate))}
                                        </td>
                                        <td className="px-5 py-3">
                                            <StatusBadge status={person.status} />
                                        </td>
                                        <td className="px-5 py-3">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => openStaffForm(person)}
                                                    title="Edit staff member"
                                                    className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                                                >
                                                    <Pencil size={16} />
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => toggleStaffStatus(person)}
                                                    title={
                                                        person.status === 'active'
                                                            ? 'Deactivate'
                                                            : 'Reactivate'
                                                    }
                                                    className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                                                >
                                                    <UserX size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );

    const renderAttendance = () => (
        <div className="space-y-5">
            <div className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-end">
                <Field label="Attendance date" className="w-full sm:max-w-xs">
                    <input
                        type="date"
                        value={attendanceDate}
                        max={today()}
                        onChange={(event) => {
                            setAttendanceDate(event.target.value);
                            setAttendanceEntries({});
                            setAttendanceNotes({});
                        }}
                        className={inputClass}
                    />
                </Field>

                <div className="text-sm text-slate-500">
                    {activeStaff.length} active staff member(s)
                </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                {activeStaff.length === 0 ? (
                    <div className="p-10 text-center text-sm text-slate-500">
                        Register active staff members before recording attendance.
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[850px] text-left text-sm">
                                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                                    <tr>
                                        <th className="px-5 py-3">Staff member</th>
                                        <th className="px-5 py-3">Position</th>
                                        <th className="px-5 py-3">Attendance status</th>
                                        <th className="px-5 py-3">Note</th>
                                        <th className="px-5 py-3">Saved status</th>
                                        <th className="px-5 py-3">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {activeStaff.map((person) => {
                                        const existing = attendanceForSelectedDate[person.id];
                                        const period = currentPeriodByStaff[person.id];

                                        return (
                                            <tr key={person.id}>
                                                <td className="px-5 py-3 font-semibold text-slate-900">
                                                    {person.full_name}
                                                </td>
                                                <td className="px-5 py-3 text-slate-600">
                                                    {person.position}
                                                </td>
                                                <td className="px-5 py-3">
                                                    <select
                                                        value={
                                                            attendanceEntries[person.id] ||
                                                            existing?.attendance_status ||
                                                            ''
                                                        }
                                                        onChange={(event) =>
                                                            setAttendanceEntries((current) => ({
                                                                ...current,
                                                                [person.id]: event.target.value,
                                                            }))
                                                        }
                                                        className={`${inputClass} min-w-[150px]`}
                                                        disabled={
                                                            !period ||
                                                            attendanceDate < period.period_start_date ||
                                                            attendanceDate > today()
                                                        }
                                                    >
                                                        <option value="">Select status</option>
                                                        {ATTENDANCE_OPTIONS.map((option) => (
                                                            <option
                                                                key={option.value}
                                                                value={option.value}
                                                            >
                                                                {option.label} ({option.credit})
                                                            </option>
                                                        ))}
                                                    </select>
                                                    {!period && (
                                                        <p className="mt-1 max-w-[190px] text-xs text-amber-700">
                                                            No open payroll period. The Owner must create one in the Payroll tab.
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="px-5 py-3">
                                                    <input
                                                        value={
                                                            attendanceNotes[person.id] ??
                                                            existing?.notes ??
                                                            ''
                                                        }
                                                        onChange={(event) =>
                                                            setAttendanceNotes((current) => ({
                                                                ...current,
                                                                [person.id]: event.target.value,
                                                            }))
                                                        }
                                                        placeholder="Optional note"
                                                        className={`${inputClass} min-w-[150px]`}
                                                    />
                                                </td>
                                                <td className="px-5 py-3">
                                                    {existing ? (
                                                        <StatusBadge status={existing.attendance_status} />
                                                    ) : (
                                                        <span className="text-xs text-slate-400">
                                                            Not recorded
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-3">
                                                    <button
                                                        type="button"
                                                        disabled={saving}
                                                        onClick={() => saveAttendance(person)}
                                                        className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                                                    >
                                                        Save
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 p-4">
                            <p className="text-xs text-slate-500">
                                Save individual entries or save all selected statuses.
                            </p>
                            <button
                                type="button"
                                onClick={saveAllAttendance}
                                disabled={saving}
                                className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                            >
                                <Save size={16} />
                                Save All Selected
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );

    const renderPayroll = () => (
        <div className="space-y-5">
            <div className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center">
                <div>
                    <h3 className="font-semibold text-slate-900">Payroll periods</h3>
                    <p className="mt-1 text-sm text-slate-500">
                        Open a separate payroll period for each employee whenever you decide to pay.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={openPayrollPeriodForm}
                    disabled={saving || activeStaff.length === 0 || activeStaff.every((person) => currentPeriodByStaff[person.id])}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <CalendarPlus size={17} />
                    Create Payroll Period
                </button>
            </div>

            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
                Salary due is calculated from recorded attendance in the current open
                payroll period. Full days count as 1 day and half days count as 0.5 day.
                A period closes automatically when its full outstanding balance is paid.
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                {currentPayrollRows.length === 0 ? (
                    <div className="p-10 text-center text-sm text-slate-500">
                        No active staff members are available for payroll.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[1100px] text-left text-sm">
                            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                                <tr>
                                    <th className="px-5 py-3">Staff member</th>
                                    <th className="px-5 py-3">Period started</th>
                                    <th className="px-5 py-3">Full days</th>
                                    <th className="px-5 py-3">Half days</th>
                                    <th className="px-5 py-3">Payable days</th>
                                    <th className="px-5 py-3">Salary due</th>
                                    <th className="px-5 py-3">Paid</th>
                                    <th className="px-5 py-3">Balance</th>
                                    <th className="px-5 py-3">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {currentPayrollRows.map((row) => (
                                    <tr key={row.person.id}>
                                        <td className="px-5 py-3">
                                            <p className="font-semibold text-slate-900">
                                                {row.person.full_name}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                {row.person.position}
                                            </p>
                                        </td>
                                        <td className="px-5 py-3 text-slate-600">
                                            {formatDate(row.period?.period_start_date)}
                                        </td>
                                        <td className="px-5 py-3">
                                            {numberValue(row.summary?.full_days)}
                                        </td>
                                        <td className="px-5 py-3">
                                            {numberValue(row.summary?.half_days)}
                                        </td>
                                        <td className="px-5 py-3 font-semibold">
                                            {row.payableDays.toFixed(1)}
                                        </td>
                                        <td className="px-5 py-3 font-medium">
                                            {formatCurrency(row.salaryDue)}
                                        </td>
                                        <td className="px-5 py-3">
                                            {formatCurrency(row.totalPaid)}
                                        </td>
                                        <td className="px-5 py-3 font-semibold text-amber-700">
                                            {formatCurrency(Math.max(0, row.balanceDue))}
                                        </td>
                                        <td className="px-5 py-3">
                                            <button
                                                type="button"
                                                disabled={!row.period || row.balanceDue <= 0 || saving}
                                                onClick={() => openPaymentForm(row)}
                                                className="whitespace-nowrap rounded-lg bg-green-700 px-3 py-2 text-xs font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-40"
                                            >
                                                Pay Salary
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );

    const renderHistory = () => (
        <div className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
                <Field label="Filter by staff member">
                    <select
                        value={historyStaffFilter}
                        onChange={(event) => setHistoryStaffFilter(event.target.value)}
                        className={`${inputClass} max-w-sm`}
                    >
                        <option value="all">All staff members</option>
                        {staff.map((person) => (
                            <option key={person.id} value={person.id}>
                                {person.full_name}
                            </option>
                        ))}
                    </select>
                </Field>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 p-5">
                    <h3 className="font-semibold text-slate-900">
                        Attendance History
                    </h3>
                </div>

                {filteredAttendanceHistory.length === 0 ? (
                    <p className="p-8 text-center text-sm text-slate-500">
                        No attendance records found.
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[750px] text-left text-sm">
                            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                                <tr>
                                    <th className="px-5 py-3">Date</th>
                                    <th className="px-5 py-3">Staff member</th>
                                    <th className="px-5 py-3">Position</th>
                                    <th className="px-5 py-3">Status</th>
                                    <th className="px-5 py-3">Daily rate saved</th>
                                    <th className="px-5 py-3">Notes</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredAttendanceHistory.map((entry) => (
                                    <tr key={entry.id}>
                                        <td className="px-5 py-3">
                                            {formatDate(entry.attendance_date)}
                                        </td>
                                        <td className="px-5 py-3 font-medium">
                                            {staffName(entry.staff_member_id)}
                                        </td>
                                        <td className="px-5 py-3 text-slate-600">
                                            {staffPosition(entry.staff_member_id)}
                                        </td>
                                        <td className="px-5 py-3">
                                            <StatusBadge status={entry.attendance_status} />
                                        </td>
                                        <td className="px-5 py-3">
                                            {formatCurrency(numberValue(entry.daily_rate_snapshot))}
                                        </td>
                                        <td className="px-5 py-3 text-slate-500">
                                            {entry.notes || '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 p-5">
                    <h3 className="font-semibold text-slate-900">
                        Salary Payment History
                    </h3>
                </div>

                {payments.length === 0 ? (
                    <p className="p-8 text-center text-sm text-slate-500">
                        No salary payments have been recorded yet.
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[850px] text-left text-sm">
                            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                                <tr>
                                    <th className="px-5 py-3">Payment date</th>
                                    <th className="px-5 py-3">Staff member</th>
                                    <th className="px-5 py-3">Amount due then</th>
                                    <th className="px-5 py-3">Amount paid</th>
                                    <th className="px-5 py-3">Method</th>
                                    <th className="px-5 py-3">Notes</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {payments
                                    .filter(
                                        (payment) =>
                                            historyStaffFilter === 'all' ||
                                            payment.staff_member_id === historyStaffFilter
                                    )
                                    .map((payment) => (
                                        <tr key={payment.id}>
                                            <td className="px-5 py-3">
                                                {formatDate(payment.payment_date)}
                                            </td>
                                            <td className="px-5 py-3 font-medium">
                                                {staffName(payment.staff_member_id)}
                                            </td>
                                            <td className="px-5 py-3">
                                                {formatCurrency(numberValue(payment.amount_due_at_payment))}
                                            </td>
                                            <td className="px-5 py-3 font-semibold text-green-700">
                                                {formatCurrency(numberValue(payment.amount_paid))}
                                            </td>
                                            <td className="px-5 py-3 text-slate-600">
                                                {PAYMENT_METHODS.find(
                                                    (method) => method.value === payment.payment_method
                                                )?.label || payment.payment_method}
                                            </td>
                                            <td className="px-5 py-3 text-slate-500">
                                                {payment.notes || '—'}
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 p-5">
                    <h3 className="font-semibold text-slate-900">
                        Payroll Period History
                    </h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px] text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                            <tr>
                                <th className="px-5 py-3">Staff member</th>
                                <th className="px-5 py-3">Period start</th>
                                <th className="px-5 py-3">Period end</th>
                                <th className="px-5 py-3">Status</th>
                                <th className="px-5 py-3">Salary due</th>
                                <th className="px-5 py-3">Paid</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {periods
                                .filter(
                                    (period) =>
                                        historyStaffFilter === 'all' ||
                                        period.staff_member_id === historyStaffFilter
                                )
                                .map((period) => {
                                    const summary = summaryByPeriod[period.id];

                                    return (
                                        <tr key={period.id}>
                                            <td className="px-5 py-3 font-medium">
                                                {staffName(period.staff_member_id)}
                                            </td>
                                            <td className="px-5 py-3">
                                                {formatDate(period.period_start_date)}
                                            </td>
                                            <td className="px-5 py-3">
                                                {formatDate(period.period_end_date)}
                                            </td>
                                            <td className="px-5 py-3">
                                                <StatusBadge status={period.status} />
                                            </td>
                                            <td className="px-5 py-3">
                                                {formatCurrency(numberValue(summary?.salary_due))}
                                            </td>
                                            <td className="px-5 py-3">
                                                {formatCurrency(numberValue(summary?.total_paid))}
                                            </td>
                                        </tr>
                                    );
                                })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
    if (!isOwner && !isManager) {
        return (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
                <h2 className="text-lg font-bold text-red-800">
                    Access Restricted
                </h2>
                <p className="mt-2 text-sm text-red-700">
                    You do not have permission to access Staff & Payroll.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">
                        Staff & Payroll
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                        Manage workers, daily attendance and salary payments.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={loadData}
                    disabled={loading}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            {renderMessages()}

            <div className="flex gap-2 overflow-x-auto border-b border-slate-200 pb-1">
                {TABS.filter((tab) => isOwner || tab.id === 'attendance').map((tab) => {
                    const Icon = tab.icon;

                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => {
                                setActiveTab(tab.id);
                                clearMessages();
                            }}
                            className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${activeTab === tab.id
                                ? 'border-blue-700 text-blue-700'
                                : 'border-transparent text-slate-500 hover:text-slate-800'
                                }`}
                        >
                            <Icon size={17} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {loading ? (
                <div className="flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white p-12 text-sm text-slate-500">
                    <RefreshCw size={18} className="animate-spin" />
                    Loading staff and payroll data...
                </div>
            ) : (
                <>
                    {activeTab === 'overview' && renderOverview()}
                    {activeTab === 'staff' && renderStaff()}
                    {activeTab === 'attendance' && renderAttendance()}
                    {activeTab === 'payroll' && renderPayroll()}
                    {activeTab === 'history' && renderHistory()}
                </>
            )}

            {/* STAFF REGISTRATION / EDIT FORM */}
            {showStaffForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4">
                    <div className="my-auto w-full max-w-2xl rounded-2xl bg-white shadow-xl">
                        <div className="flex items-center justify-between border-b border-slate-200 p-5">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">
                                    {editingStaff ? 'Edit Staff Member' : 'Register Staff Member'}
                                </h3>
                                <p className="mt-1 text-sm text-slate-500">
                                    Enter the worker's details and daily salary rate.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowStaffForm(false)}
                                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={saveStaff} className="space-y-4 p-5">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <Field label="Full name *">
                                    <input
                                        required
                                        value={staffForm.full_name}
                                        onChange={(event) =>
                                            setStaffForm({
                                                ...staffForm,
                                                full_name: event.target.value,
                                            })
                                        }
                                        className={inputClass}
                                        placeholder="Worker's full name"
                                    />
                                </Field>
                                {isOwner && (
                                    <div className="form-group">
                                        <label htmlFor="staff-account">
                                            Login Account
                                        </label>

                                        <select
                                            id="staff-account"
                                            value={selectedAccountId}
                                            onChange={(e) => setSelectedAccountId(e.target.value)}
                                            disabled={accountsLoading}
                                        >
                                            <option value="">No login account linked</option>

                                            {employeeAccounts.map((account) => {
                                                const linkedToAnotherStaff =
                                                    account.staff_member_id &&
                                                    account.staff_member_id !== editingStaff?.id;

                                                return (
                                                    <option
                                                        key={account.user_id}
                                                        value={account.user_id}
                                                        disabled={linkedToAnotherStaff || !account.is_active}
                                                    >
                                                        {account.email} — {account.role}
                                                        {linkedToAnotherStaff
                                                            ? ' (Already linked)'
                                                            : !account.is_active
                                                                ? ' (Inactive)'
                                                                : ''}
                                                    </option>
                                                );
                                            })}
                                        </select>

                                        <small>
                                            Link this staff record to an existing employee login.
                                            You can leave this blank if no account is available yet.
                                        </small>
                                    </div>
                                )}

                                <Field label="Position *">
                                    <input
                                        required
                                        value={staffForm.position}
                                        onChange={(event) =>
                                            setStaffForm({
                                                ...staffForm,
                                                position: event.target.value,
                                            })
                                        }
                                        className={inputClass}
                                        placeholder="e.g. Cashier, Store Assistant, Manager"
                                    />
                                </Field>

                                <Field label="Phone number">
                                    <input
                                        value={staffForm.phone_number}
                                        onChange={(event) =>
                                            setStaffForm({
                                                ...staffForm,
                                                phone_number: event.target.value,
                                            })
                                        }
                                        className={inputClass}
                                        placeholder="Phone number"
                                    />
                                </Field>

                                <Field label="Date joined *">
                                    <input
                                        type="date"
                                        required
                                        value={staffForm.date_joined}
                                        onChange={(event) =>
                                            setStaffForm({
                                                ...staffForm,
                                                date_joined: event.target.value,
                                            })
                                        }
                                        className={inputClass}
                                    />
                                </Field>

                                <Field label="Daily salary rate *">
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        step="0.01"
                                        value={staffForm.daily_salary_rate}
                                        onChange={(event) =>
                                            setStaffForm({
                                                ...staffForm,
                                                daily_salary_rate: event.target.value,
                                            })
                                        }
                                        className={inputClass}
                                        placeholder="Enter daily rate"
                                    />
                                </Field>

                                <Field label="Employment status">
                                    <select
                                        value={staffForm.status}
                                        onChange={(event) =>
                                            setStaffForm({
                                                ...staffForm,
                                                status: event.target.value,
                                            })
                                        }
                                        className={inputClass}
                                    >
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                    </select>
                                </Field>
                            </div>

                            <Field label="Notes">
                                <textarea
                                    rows={3}
                                    value={staffForm.notes}
                                    onChange={(event) =>
                                        setStaffForm({
                                            ...staffForm,
                                            notes: event.target.value,
                                        })
                                    }
                                    className={inputClass}
                                    placeholder="Additional information (optional)"
                                />
                            </Field>

                            {editingStaff && (
                                <p className="rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                                    Changing the daily rate affects new attendance records.
                                    Previously recorded attendance retains its saved rate.
                                </p>
                            )}

                            <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowStaffForm(false)}
                                    className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                                >
                                    <Save size={16} />
                                    {saving ? 'Saving...' : 'Save Staff Member'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* PAYROLL PERIOD CREATION FORM */}
            {showPeriodForm && isOwner && (
                <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4">
                    <div className="my-auto w-full max-w-lg rounded-2xl bg-white shadow-xl">
                        <div className="flex items-center justify-between border-b border-slate-200 p-5">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">
                                    Create Payroll Period
                                </h3>
                                <p className="mt-1 text-sm text-slate-500">
                                    Choose one employee, a start date and the payroll currency.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowPeriodForm(false)}
                                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={createPayrollPeriod} className="space-y-4 p-5">
                            <Field label="Employee *">
                                <select
                                    required
                                    value={periodForm.staff_member_id}
                                    onChange={(event) =>
                                        setPeriodForm({
                                            ...periodForm,
                                            staff_member_id: event.target.value,
                                        })
                                    }
                                    className={inputClass}
                                >
                                    <option value="">Select employee</option>
                                    {activeStaff
                                        .filter((person) => !currentPeriodByStaff[person.id])
                                        .map((person) => (
                                            <option key={person.id} value={person.id}>
                                                {person.full_name} — {person.position}
                                            </option>
                                        ))}
                                </select>
                                {activeStaff.every((person) => currentPeriodByStaff[person.id]) && (
                                    <p className="mt-1 text-xs text-amber-700">
                                        Every active employee already has an open payroll period.
                                    </p>
                                )}
                            </Field>

                            <Field label="Period start date *">
                                <input
                                    type="date"
                                    required
                                    max={today()}
                                    value={periodForm.period_start_date}
                                    onChange={(event) =>
                                        setPeriodForm({
                                            ...periodForm,
                                            period_start_date: event.target.value,
                                        })
                                    }
                                    className={inputClass}
                                />
                            </Field>

                            <Field label="Payroll currency *">
                                <select
                                    required
                                    value={periodForm.currency_code}
                                    onChange={(event) =>
                                        setPeriodForm({
                                            ...periodForm,
                                            currency_code: event.target.value,
                                        })
                                    }
                                    className={inputClass}
                                >
                                    <option value="USD">USD — US Dollar</option>
                                    <option value="ZAR">ZAR — South African Rand</option>
                                    <option value="ZWG">ZWG — Zimbabwe Gold</option>
                                </select>
                            </Field>

                            <p className="rounded-lg bg-blue-50 p-3 text-xs leading-5 text-blue-800">
                                The period stays open until the Owner completes the payroll payment and closes it.
                                Each employee can have one open period at a time. Different employees can have
                                open periods simultaneously.
                            </p>

                            <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowPeriodForm(false)}
                                    className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving || !activeStaff.some((person) => !currentPeriodByStaff[person.id])}
                                    className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                                >
                                    <Save size={16} />
                                    {saving ? 'Creating...' : 'Create Period'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* SALARY PAYMENT FORM */}
            {paymentStaff && (
                <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4">
                    <div className="my-auto w-full max-w-lg rounded-2xl bg-white shadow-xl">
                        <div className="flex items-center justify-between border-b border-slate-200 p-5">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">
                                    Record Salary Payment
                                </h3>
                                <p className="mt-1 text-sm text-slate-500">
                                    {paymentStaff.full_name} · {paymentStaff.position}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setPaymentStaff(null)}
                                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={recordPayment} className="space-y-4 p-5">
                            <Field label="Payment date *">
                                <input
                                    type="date"
                                    required
                                    max={today()}
                                    value={paymentForm.payment_date}
                                    onChange={(event) =>
                                        setPaymentForm({
                                            ...paymentForm,
                                            payment_date: event.target.value,
                                        })
                                    }
                                    className={inputClass}
                                />
                            </Field>

                            <Field label="Amount paid *">
                                <input
                                    type="number"
                                    required
                                    min="0.01"
                                    step="0.01"
                                    value={paymentForm.amount_paid}
                                    onChange={(event) =>
                                        setPaymentForm({
                                            ...paymentForm,
                                            amount_paid: event.target.value,
                                        })
                                    }
                                    className={inputClass}
                                />
                            </Field>

                            <Field label="Payment method *">
                                <select
                                    value={paymentForm.payment_method}
                                    onChange={(event) =>
                                        setPaymentForm({
                                            ...paymentForm,
                                            payment_method: event.target.value,
                                        })
                                    }
                                    className={inputClass}
                                >
                                    {PAYMENT_METHODS.map((method) => (
                                        <option key={method.value} value={method.value}>
                                            {method.label}
                                        </option>
                                    ))}
                                </select>
                            </Field>

                            <Field label="Notes">
                                <textarea
                                    rows={3}
                                    value={paymentForm.notes}
                                    onChange={(event) =>
                                        setPaymentForm({
                                            ...paymentForm,
                                            notes: event.target.value,
                                        })
                                    }
                                    className={inputClass}
                                    placeholder="Optional payment notes"
                                />
                            </Field>

                            <p className="rounded-lg bg-blue-50 p-3 text-xs leading-5 text-blue-800">
                                You can make a partial payment. The payroll period remains open
                                until the complete salary balance is paid. Once fully paid,
                                a new period starts on the following day.
                            </p>

                            <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setPaymentStaff(null)}
                                    className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="inline-flex items-center gap-2 rounded-lg bg-green-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-50"
                                >
                                    <Banknote size={16} />
                                    {saving ? 'Processing...' : 'Record Payment'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
