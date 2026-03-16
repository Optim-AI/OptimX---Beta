'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  Shield,
  LogOut,
  Power,
  PowerOff,
  BarChart3,
  CheckCircle,
  XCircle,
  RefreshCw,
  TrendingUp,
  Edit,
  X,
  Save,
  MessageSquare,
  Eye,
  Users,
  CreditCard,
  Settings,
  Ticket,
} from 'lucide-react';
import colors from '@/lib/ui/colors';

interface Plan {
  id: string;
  name: string;
  description: string | null;
  billingCycle: string;
  priceInr: number;
  imageCredits: number;
  videoCredits: number;
  isActive: boolean;
  displayOrder: number;
}

interface DashboardData {
  plansEnabled: boolean;
  statistics: {
    total: number;
    active: number;
    inactive: number;
  };
  plans: Plan[];
}

interface EditPlanData {
  name: string;
  description: string;
  priceInr: number;
  imageCredits: number;
  videoCredits: number;
  displayOrder: number;
}

interface ReportData {
  id: string;
  userId: string;
  type: string;
  message: string;
  pageUrl: string | null;
  images: string[] | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  userEmail: string | null;
  userFullName: string | null;
}

interface UserData {
  id: string;
  fullName: string | null;
  email: string | null;
  businessName: string | null;
  createdAt: string | null;
  plan: string;
  subscriptionStatus: string | null;
  imageCredits: number;
  videoCredits: number;
}

interface UserPayment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  paymentType: string;
  planName: string | null;
  metadata: any;
  createdAt: string;
  razorpayPaymentId: string | null;
}

interface VoucherData {
  id: string;
  userId: string;
  creditType: string;
  credits: number;
  status: string;
  expiresAt: string | null;
  redeemedAt: string | null;
  issuedBy: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  userEmail: string | null;
  userFullName: string | null;
}

type ActiveSection = 'plans' | 'reports' | 'users' | 'settings' | 'vouchers';

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [toggling, setToggling] = useState(false);
  const [togglingPlan, setTogglingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [username, setUsername] = useState('');

  // Section toggle
  const [activeSection, setActiveSection] = useState<ActiveSection>('plans');

  // Edit modal state
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [editFormData, setEditFormData] = useState<EditPlanData>({
    name: '',
    description: '',
    priceInr: 0,
    imageCredits: 0,
    videoCredits: 0,
    displayOrder: 0,
  });
  const [saving, setSaving] = useState(false);

  // Reports state
  const [reportsData, setReportsData] = useState<ReportData[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ReportData | null>(null);
  const [updatingReportStatus, setUpdatingReportStatus] = useState(false);
  const [reportVouchers, setReportVouchers] = useState<VoucherData[]>([]);
  const [reportVouchersLoading, setReportVouchersLoading] = useState(false);

  // Users state
  const [usersData, setUsersData] = useState<UserData[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [userPayments, setUserPayments] = useState<UserPayment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  // Settings state
  const [imageRetentionDays, setImageRetentionDays] = useState<number>(7);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [creditPricing, setCreditPricing] = useState({ imageCreditPriceInr: 10, videoSecondPriceInr: 26 });
  const [savingCreditPricing, setSavingCreditPricing] = useState(false);

  // Vouchers state
  const [vouchersData, setVouchersData] = useState<VoucherData[]>([]);
  const [vouchersLoading, setVouchersLoading] = useState(false);
  const [showCreateVoucher, setShowCreateVoucher] = useState(false);
  const [createVoucherForm, setCreateVoucherForm] = useState({
    userId: '',
    creditType: 'image' as 'image' | 'video',
    credits: 10,
    expiresAt: '',
    note: '',
    reportId: '',
  });
  const [creatingVoucher, setCreatingVoucher] = useState(false);
  const [revokingVoucherId, setRevokingVoucherId] = useState<string | null>(null);

  useEffect(() => {
    // Check if admin is logged in
    const token = localStorage.getItem('admin_token');
    const adminUsername = localStorage.getItem('admin_username');

    if (!token) {
      router.replace('/admin/login');
      return;
    }

    setUsername(adminUsername || 'Admin');
    fetchDashboardData();
  }, [router]);

  useEffect(() => {
    if (activeSection === 'reports' && reportsData.length === 0) {
      fetchReports();
    }
    if (activeSection === 'users' && usersData.length === 0) {
      fetchUsers();
    }
    if (activeSection === 'settings') {
      fetchImageRetention();
      fetchCreditPricing();
    }
    if (activeSection === 'vouchers' && vouchersData.length === 0) {
      fetchVouchers();
    }
  }, [activeSection]);

  async function fetchDashboardData() {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/plans/status', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_username');
        router.replace('/admin/login');
        return;
      }

      const result = await response.json();

      if (!result.success) {
        setError(result.error || 'Failed to fetch data');
        return;
      }

      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  }

  async function fetchReports() {
    setReportsLoading(true);

    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/reports/list', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_username');
        router.replace('/admin/login');
        return;
      }

      const result = await response.json();

      if (!result.success) {
        setError(result.error || 'Failed to fetch reports');
        return;
      }

      setReportsData(result.reports);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch reports');
    } finally {
      setReportsLoading(false);
    }
  }

  async function fetchUsers() {
    setUsersLoading(true);

    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/users/list', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_username');
        router.replace('/admin/login');
        return;
      }

      const result = await response.json();

      if (!result.success) {
        setError(result.error || 'Failed to fetch users');
        return;
      }

      setUsersData(result.users);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch users');
    } finally {
      setUsersLoading(false);
    }
  }

  async function fetchUserPayments(userId: string) {
    setPaymentsLoading(true);
    setUserPayments([]);

    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`/api/admin/users/payments?userId=${userId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.error || 'Failed to fetch payments');
        return;
      }

      setUserPayments(result.payments);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch payments');
    } finally {
      setPaymentsLoading(false);
    }
  }

  function handleSelectUser(user: UserData) {
    setSelectedUser(user);
    fetchUserPayments(user.id);
  }

  async function fetchImageRetention() {
    setSettingsLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/settings/image-retention', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 401) {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_username');
        router.replace('/admin/login');
        return;
      }
      const result = await response.json();
      if (result.success) {
        setImageRetentionDays(result.image_retention_days);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch settings');
    } finally {
      setSettingsLoading(false);
    }
  }

  async function handleSaveImageRetention() {
    setSavingSettings(true);
    setError(null);
    setSuccess(null);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/settings/image-retention', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ days: imageRetentionDays }),
      });
      const result = await response.json();
      if (!result.success) {
        setError(result.error || 'Failed to save setting');
        return;
      }
      setSuccess(result.message);
    } catch (err: any) {
      setError(err.message || 'Failed to save setting');
    } finally {
      setSavingSettings(false);
    }
  }

  async function fetchCreditPricing() {
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/settings/credit-pricing', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 401) {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_username');
        router.replace('/admin/login');
        return;
      }
      const result = await response.json();
      if (result.success) {
        setCreditPricing({
          imageCreditPriceInr: result.imageCreditPriceInr,
          videoSecondPriceInr: result.videoSecondPriceInr,
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch credit pricing');
    }
  }

  async function handleSaveCreditPricing() {
    setSavingCreditPricing(true);
    setError(null);
    setSuccess(null);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/settings/credit-pricing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(creditPricing),
      });
      const result = await response.json();
      if (!result.success) {
        setError(result.error || 'Failed to save credit pricing');
        return;
      }
      setSuccess(result.message);
    } catch (err: any) {
      setError(err.message || 'Failed to save credit pricing');
    } finally {
      setSavingCreditPricing(false);
    }
  }

  async function fetchVouchers() {
    setVouchersLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/vouchers/list', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 401) {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_username');
        router.replace('/admin/login');
        return;
      }
      const result = await response.json();
      if (result.success) {
        setVouchersData(result.vouchers);
      } else {
        setError(result.error || 'Failed to fetch vouchers');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch vouchers');
    } finally {
      setVouchersLoading(false);
    }
  }

  async function handleCreateVoucher() {
    setCreatingVoucher(true);
    setError(null);
    setSuccess(null);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/vouchers/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: createVoucherForm.userId,
          creditType: createVoucherForm.creditType,
          credits: createVoucherForm.credits,
          expiresAt: createVoucherForm.expiresAt || undefined,
          note: createVoucherForm.note || undefined,
          reportId: createVoucherForm.reportId || undefined,
        }),
      });
      const result = await response.json();
      if (!result.success) {
        setError(result.error || 'Failed to create voucher');
        return;
      }
      setSuccess('Voucher created successfully');
      setShowCreateVoucher(false);
      const reportId = createVoucherForm.reportId;
      setCreateVoucherForm({ userId: '', creditType: 'image', credits: 10, expiresAt: '', note: '', reportId: '' });
      await fetchVouchers();
      // Refresh report vouchers if we came from a report
      if (reportId && selectedReport) {
        fetchReportVouchers(reportId);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create voucher');
    } finally {
      setCreatingVoucher(false);
    }
  }

  async function handleRevokeVoucher(voucherId: string) {
    setRevokingVoucherId(voucherId);
    setError(null);
    setSuccess(null);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/vouchers/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ voucherId }),
      });
      const result = await response.json();
      if (!result.success) {
        setError(result.error || 'Failed to revoke voucher');
        return;
      }
      setSuccess('Voucher revoked successfully');
      setVouchersData((prev) =>
        prev.map((v) => (v.id === voucherId ? { ...v, status: 'revoked', updatedAt: new Date().toISOString() } : v))
      );
    } catch (err: any) {
      setError(err.message || 'Failed to revoke voucher');
    } finally {
      setRevokingVoucherId(null);
    }
  }

  async function fetchReportVouchers(reportId: string) {
    setReportVouchersLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`/api/admin/vouchers/list?reportId=${reportId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (result.success) {
        setReportVouchers(result.vouchers);
      }
    } catch {
      // silently fail
    } finally {
      setReportVouchersLoading(false);
    }
  }

  async function handleIssueVoucherFromReport(report: ReportData) {
    if (usersData.length === 0) await fetchUsers();
    const noteText = `Issued for ${report.type} report: "${report.message.slice(0, 80)}${report.message.length > 80 ? '...' : ''}"`;
    setCreateVoucherForm({
      userId: report.userId,
      creditType: 'image',
      credits: 10,
      expiresAt: '',
      note: noteText,
      reportId: report.id,
    });
    setShowCreateVoucher(true);
  }

  function handleSelectReport(report: ReportData) {
    setSelectedReport(report);
    setReportVouchers([]);
    fetchReportVouchers(report.id);
  }

  async function handleUpdateReportStatus(reportId: string, status: string) {
    setUpdatingReportStatus(true);
    setError(null);
    setSuccess(null);

    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/reports/update-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reportId, status }),
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.error || 'Failed to update report status');
        return;
      }

      setSuccess(result.message);
      // Update local state
      setReportsData((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, status, updatedAt: new Date().toISOString() } : r))
      );
      if (selectedReport?.id === reportId) {
        setSelectedReport((prev) => prev ? { ...prev, status, updatedAt: new Date().toISOString() } : null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update report status');
    } finally {
      setUpdatingReportStatus(false);
    }
  }

  async function handleToggleAllPlans(enable: boolean) {
    setToggling(true);
    setError(null);
    setSuccess(null);

    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/plans/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ enable }),
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.error || 'Failed to toggle plans');
        return;
      }

      setSuccess(result.message);
      await fetchDashboardData();
    } catch (err: any) {
      setError(err.message || 'Failed to toggle plans');
    } finally {
      setToggling(false);
    }
  }

  async function handleToggleSinglePlan(planId: string, isActive: boolean) {
    setTogglingPlan(planId);
    setError(null);
    setSuccess(null);

    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/plans/toggle-single', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ planId, isActive }),
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.error || 'Failed to toggle plan');
        return;
      }

      setSuccess(result.message);
      await fetchDashboardData();
    } catch (err: any) {
      setError(err.message || 'Failed to toggle plan');
    } finally {
      setTogglingPlan(null);
    }
  }

  function handleEditClick(plan: Plan) {
    setEditingPlan(plan);
    setEditFormData({
      name: plan.name,
      description: plan.description || '',
      priceInr: plan.priceInr,
      imageCredits: plan.imageCredits,
      videoCredits: plan.videoCredits,
      displayOrder: plan.displayOrder,
    });
  }

  function handleCloseEditModal() {
    setEditingPlan(null);
    setEditFormData({
      name: '',
      description: '',
      priceInr: 0,
      imageCredits: 0,
      videoCredits: 0,
      displayOrder: 0,
    });
  }

  async function handleSavePlan() {
    if (!editingPlan) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/plans/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          planId: editingPlan.id,
          ...editFormData,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.error || 'Failed to update plan');
        return;
      }

      setSuccess(result.message);
      handleCloseEditModal();
      await fetchDashboardData();
    } catch (err: any) {
      setError(err.message || 'Failed to update plan');
    } finally {
      setSaving(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_username');
    router.push('/admin/login');
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'open':
        return { bg: '#fef3c7', color: '#92400e' };
      case 'reviewed':
        return { bg: '#dbeafe', color: '#1e40af' };
      case 'resolved':
        return { bg: '#d1fae5', color: '#065f46' };
      default:
        return { bg: '#f1f5f9', color: '#475569' };
    }
  }

  function getTypeColor(type: string) {
    return type === 'error'
      ? { bg: '#fef2f2', color: '#dc2626' }
      : { bg: '#f0fdf4', color: '#16a34a' };
  }

  const reportCounts = {
    total: reportsData.length,
    open: reportsData.filter((r) => r.status === 'open').length,
    reviewed: reportsData.filter((r) => r.status === 'reviewed').length,
    resolved: reportsData.filter((r) => r.status === 'resolved').length,
  };

  const voucherCounts = {
    total: vouchersData.length,
    active: vouchersData.filter((v) => v.status === 'active').length,
    redeemed: vouchersData.filter((v) => v.status === 'redeemed').length,
    revokedOrExpired: vouchersData.filter((v) => v.status === 'revoked' || v.status === 'expired').length,
  };

  if (loading) {
    return (
      <div className="page loading-page">
        <RefreshCw size={32} className="spin" />
        <p>Loading dashboard...</p>
        <style jsx>{`
          .loading-page {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 16px;
            background: #f8fafc;
            color: #64748b;
          }
          .spin {
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="page">
      {/* Header */}
      <div className="header">
        <div className="header-left">
          <Shield size={32} color={colors.primary} />
          <div>
            <h1>Admin Dashboard</h1>
            <p>SkalX AI Management</p>
          </div>
        </div>
        <div className="header-right">
          <span className="username">
            Welcome, <strong>{username}</strong>
          </span>
          <button className="logout-btn" onClick={handleLogout}>
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </div>

      <div className="container">
        {error && (
          <div className="error-msg">
            {error}
            <button onClick={() => setError(null)}>×</button>
          </div>
        )}

        {success && (
          <div className="success-msg">
            {success}
            <button onClick={() => setSuccess(null)}>×</button>
          </div>
        )}

        {/* Section Toggle */}
        <div className="section-toggle">
          <button
            className={`section-btn ${activeSection === 'plans' ? 'active' : ''}`}
            onClick={() => setActiveSection('plans')}
          >
            <BarChart3 size={18} />
            Plans
          </button>
          <button
            className={`section-btn ${activeSection === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveSection('reports')}
          >
            <MessageSquare size={18} />
            Reports
            {reportCounts.open > 0 && (
              <span className="badge">{reportCounts.open}</span>
            )}
          </button>
          <button
            className={`section-btn ${activeSection === 'users' ? 'active' : ''}`}
            onClick={() => setActiveSection('users')}
          >
            <Users size={18} />
            Users
          </button>
          <button
            className={`section-btn ${activeSection === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveSection('settings')}
          >
            <Settings size={18} />
            Settings
          </button>
          <button
            className={`section-btn ${activeSection === 'vouchers' ? 'active' : ''}`}
            onClick={() => setActiveSection('vouchers')}
          >
            <Ticket size={18} />
            Vouchers
          </button>
        </div>

        {activeSection === 'plans' && (
          <>
            {/* System Status Card */}
            <div className="status-card">
              <div className="status-header">
                <div className="status-icon">
                  {data?.plansEnabled ? (
                    <Power size={32} color="#10b981" />
                  ) : (
                    <PowerOff size={32} color="#f59e0b" />
                  )}
                </div>
                <div className="status-info">
                  <h2>Plan System Status</h2>
                  <div className={`status-badge ${data?.plansEnabled ? 'enabled' : 'disabled'}`}>
                    {data?.plansEnabled ? 'ENABLED' : 'DISABLED'}
                  </div>
                </div>
              </div>

              <div className="status-description">
                {data?.plansEnabled ? (
                  <>
                    <CheckCircle size={20} color="#10b981" />
                    <span>
                      Plans are <strong>enabled</strong>. New users must select a plan after signup.
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle size={20} color="#f59e0b" />
                    <span>
                      Plans are <strong>disabled</strong>. Users can signup with pay-as-you-go credits
                      only.
                    </span>
                  </>
                )}
              </div>

              <div className="toggle-section">
                <button
                  className={`toggle-btn ${data?.plansEnabled ? 'disable' : 'enable'}`}
                  onClick={() => handleToggleAllPlans(!data?.plansEnabled)}
                  disabled={toggling}
                >
                  {toggling ? (
                    <>
                      <RefreshCw size={18} className="spin" />
                      Processing...
                    </>
                  ) : data?.plansEnabled ? (
                    <>
                      <PowerOff size={18} />
                      Disable All Plans
                    </>
                  ) : (
                    <>
                      <Power size={18} />
                      Enable All Plans
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Statistics Cards */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon total">
                  <BarChart3 size={24} />
                </div>
                <div className="stat-content">
                  <div className="stat-value">{data?.statistics.total || 0}</div>
                  <div className="stat-label">Total Plans</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon active">
                  <CheckCircle size={24} />
                </div>
                <div className="stat-content">
                  <div className="stat-value">{data?.statistics.active || 0}</div>
                  <div className="stat-label">Active Plans</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon inactive">
                  <XCircle size={24} />
                </div>
                <div className="stat-content">
                  <div className="stat-value">{data?.statistics.inactive || 0}</div>
                  <div className="stat-label">Inactive Plans</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon mode">
                  <TrendingUp size={24} />
                </div>
                <div className="stat-content">
                  <div className="stat-value">{data?.plansEnabled ? 'Subscription' : 'Pay-as-you-go'}</div>
                  <div className="stat-label">Current Mode</div>
                </div>
              </div>
            </div>

            {/* Plans Table */}
            <div className="plans-card">
              <div className="plans-header">
                <h3>All Plans</h3>
                <button className="refresh-btn" onClick={fetchDashboardData}>
                  <RefreshCw size={16} />
                  Refresh
                </button>
              </div>

              {data?.plans && data.plans.length > 0 ? (
                <div className="table-wrapper">
                  <table className="plans-table">
                    <thead>
                      <tr>
                        <th>Plan Name</th>
                        <th>Billing Cycle</th>
                        <th>Price</th>
                        <th>Image Credits</th>
                        <th>Video Credits</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.plans.map((plan) => (
                        <tr key={plan.id}>
                          <td className="plan-name">{plan.name}</td>
                          <td>
                            <span className="billing-badge">{plan.billingCycle}</span>
                          </td>
                          <td className="price">₹{plan.priceInr}</td>
                          <td>{plan.imageCredits}</td>
                          <td>{plan.videoCredits}s</td>
                          <td>
                            <label className="toggle-switch">
                              <input
                                type="checkbox"
                                checked={plan.isActive}
                                onChange={(e) => handleToggleSinglePlan(plan.id, e.target.checked)}
                                disabled={togglingPlan === plan.id}
                              />
                              <span className="toggle-slider"></span>
                            </label>
                          </td>
                          <td>
                            <button
                              className="edit-btn"
                              onClick={() => handleEditClick(plan)}
                              title="Edit plan"
                            >
                              <Edit size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  <p>No plans found in database</p>
                </div>
              )}
            </div>
          </>
        )}

        {activeSection === 'reports' && (
          <>
            {/* Report Statistics */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon total">
                  <MessageSquare size={24} />
                </div>
                <div className="stat-content">
                  <div className="stat-value">{reportCounts.total}</div>
                  <div className="stat-label">Total Reports</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon inactive">
                  <XCircle size={24} />
                </div>
                <div className="stat-content">
                  <div className="stat-value">{reportCounts.open}</div>
                  <div className="stat-label">Open</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon mode">
                  <Eye size={24} />
                </div>
                <div className="stat-content">
                  <div className="stat-value">{reportCounts.reviewed}</div>
                  <div className="stat-label">Reviewed</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon active">
                  <CheckCircle size={24} />
                </div>
                <div className="stat-content">
                  <div className="stat-value">{reportCounts.resolved}</div>
                  <div className="stat-label">Resolved</div>
                </div>
              </div>
            </div>

            {/* Reports Table */}
            <div className="plans-card">
              <div className="plans-header">
                <h3>All Reports</h3>
                <button className="refresh-btn" onClick={fetchReports} disabled={reportsLoading}>
                  <RefreshCw size={16} className={reportsLoading ? 'spin' : ''} />
                  {reportsLoading ? 'Loading...' : 'Refresh'}
                </button>
              </div>

              {reportsLoading && reportsData.length === 0 ? (
                <div className="empty-state">
                  <RefreshCw size={24} className="spin" />
                  <p>Loading reports...</p>
                </div>
              ) : reportsData.length > 0 ? (
                <div className="table-wrapper">
                  <table className="plans-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>User</th>
                        <th>Type</th>
                        <th>Message</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportsData.map((report) => {
                        const statusColor = getStatusColor(report.status);
                        const typeColor = getTypeColor(report.type);
                        return (
                          <tr key={report.id} className="report-row" onClick={() => handleSelectReport(report)}>
                            <td style={{ whiteSpace: 'nowrap' }}>{formatDate(report.createdAt)}</td>
                            <td>
                              <span className="user-cell" title={report.userEmail || report.userId}>
                                {report.userFullName || report.userEmail || report.userId.slice(0, 8) + '...'}
                              </span>
                            </td>
                            <td>
                              <span
                                className="type-badge"
                                style={{ background: typeColor.bg, color: typeColor.color }}
                              >
                                {report.type}
                              </span>
                            </td>
                            <td className="message-cell">
                              {report.message.length > 80
                                ? report.message.slice(0, 80) + '...'
                                : report.message}
                            </td>
                            <td>
                              <span
                                className="report-status-badge"
                                style={{ background: statusColor.bg, color: statusColor.color }}
                              >
                                {report.status}
                              </span>
                            </td>
                            <td>
                              <button
                                className="edit-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectReport(report);
                                }}
                                title="View report"
                              >
                                <Eye size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  <p>No reports found</p>
                </div>
              )}
            </div>
          </>
        )}

        {activeSection === 'users' && (
          <>
            {/* User Statistics */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon total">
                  <Users size={24} />
                </div>
                <div className="stat-content">
                  <div className="stat-value">{usersData.length}</div>
                  <div className="stat-label">Total Users</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon active">
                  <CheckCircle size={24} />
                </div>
                <div className="stat-content">
                  <div className="stat-value">{usersData.filter((u) => u.subscriptionStatus === 'active' || u.subscriptionStatus === 'trialing').length}</div>
                  <div className="stat-label">Active Subscriptions</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon mode">
                  <CreditCard size={24} />
                </div>
                <div className="stat-content">
                  <div className="stat-value">{usersData.filter((u) => u.plan !== 'Pay-as-you-go').length}</div>
                  <div className="stat-label">On Plans</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon inactive">
                  <TrendingUp size={24} />
                </div>
                <div className="stat-content">
                  <div className="stat-value">{usersData.filter((u) => u.plan === 'Pay-as-you-go').length}</div>
                  <div className="stat-label">Pay-as-you-go</div>
                </div>
              </div>
            </div>

            {/* Users Table */}
            <div className="plans-card">
              <div className="plans-header">
                <h3>All Users</h3>
                <button className="refresh-btn" onClick={fetchUsers} disabled={usersLoading}>
                  <RefreshCw size={16} className={usersLoading ? 'spin' : ''} />
                  {usersLoading ? 'Loading...' : 'Refresh'}
                </button>
              </div>

              {usersLoading && usersData.length === 0 ? (
                <div className="empty-state">
                  <RefreshCw size={24} className="spin" />
                  <p>Loading users...</p>
                </div>
              ) : usersData.length > 0 ? (
                <div className="table-wrapper">
                  <table className="plans-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Business</th>
                        <th>Plan</th>
                        <th>Image Credits</th>
                        <th>Video Credits</th>
                        <th>Joined</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usersData.map((user) => (
                        <tr key={user.id} className="report-row" onClick={() => handleSelectUser(user)}>
                          <td className="plan-name">{user.fullName || '—'}</td>
                          <td>
                            <span className="user-cell" title={user.email || user.id}>
                              {user.email || user.id.slice(0, 8) + '...'}
                            </span>
                          </td>
                          <td>{user.businessName || '—'}</td>
                          <td>
                            <span className="billing-badge">{user.plan}</span>
                          </td>
                          <td>{user.imageCredits}</td>
                          <td>{user.videoCredits}s</td>
                          <td style={{ whiteSpace: 'nowrap' }}>{user.createdAt ? formatDate(user.createdAt) : '—'}</td>
                          <td>
                            <button
                              className="edit-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectUser(user);
                              }}
                              title="View payments"
                            >
                              <Eye size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  <p>No users found</p>
                </div>
              )}
            </div>
          </>
        )}

        {activeSection === 'settings' && (
          <>
            <div className="plans-card">
              <div className="plans-header">
                <h3>Image Retention</h3>
                <button className="refresh-btn" onClick={fetchImageRetention} disabled={settingsLoading}>
                  <RefreshCw size={16} className={settingsLoading ? 'spin' : ''} />
                  {settingsLoading ? 'Loading...' : 'Refresh'}
                </button>
              </div>

              <div style={{ maxWidth: '480px' }}>
                <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '20px', lineHeight: 1.6 }}>
                  Generated poster images in chat sessions are automatically removed after this many days.
                  Images saved to a user's library are exempt from deletion. Set to 0 to expire immediately on next load.
                </p>

                <div className="form-group">
                  <label>Retention period (days)</label>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <input
                      type="number"
                      min={0}
                      max={365}
                      value={imageRetentionDays}
                      onChange={(e) => setImageRetentionDays(parseInt(e.target.value) || 0)}
                      style={{ width: '120px' }}
                    />
                    <button
                      className="save-btn"
                      onClick={handleSaveImageRetention}
                      disabled={savingSettings}
                    >
                      {savingSettings ? (
                        <>
                          <RefreshCw size={16} className="spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save size={16} />
                          Save
                        </>
                      )}
                    </button>
                  </div>
                  <span className="help-text">
                    Default: 7 days. Range: 0–365. Set to 0 to remove images on next session load.
                  </span>
                </div>
              </div>
            </div>

            <div className="plans-card" style={{ marginTop: '24px' }}>
              <div className="plans-header">
                <h3>Credit Pricing</h3>
              </div>

              <div style={{ maxWidth: '480px' }}>
                <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '20px', lineHeight: 1.6 }}>
                  Set the per-unit price for image credits and video seconds. These prices are used on the Buy Credits page and for order calculations.
                </p>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label>Price per image credit (₹)</label>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={creditPricing.imageCreditPriceInr}
                      onChange={(e) =>
                        setCreditPricing((prev) => ({
                          ...prev,
                          imageCreditPriceInr: parseFloat(e.target.value) || 0,
                        }))
                      }
                      style={{ width: '120px' }}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label>Price per video second (₹)</label>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={creditPricing.videoSecondPriceInr}
                      onChange={(e) =>
                        setCreditPricing((prev) => ({
                          ...prev,
                          videoSecondPriceInr: parseFloat(e.target.value) || 0,
                        }))
                      }
                      style={{ width: '120px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <button
                    className="save-btn"
                    onClick={handleSaveCreditPricing}
                    disabled={savingCreditPricing}
                  >
                    {savingCreditPricing ? (
                      <>
                        <RefreshCw size={16} className="spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save size={16} />
                        Save
                      </>
                    )}
                  </button>
                </div>
                <span className="help-text">
                  Default: ₹10 per image credit, ₹26 per video second.
                </span>
              </div>
            </div>
          </>
        )}

        {activeSection === 'vouchers' && (
          <>
            {/* Voucher Statistics */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon total">
                  <Ticket size={24} />
                </div>
                <div className="stat-content">
                  <div className="stat-value">{voucherCounts.total}</div>
                  <div className="stat-label">Total Vouchers</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon active">
                  <CheckCircle size={24} />
                </div>
                <div className="stat-content">
                  <div className="stat-value">{voucherCounts.active}</div>
                  <div className="stat-label">Active</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon mode">
                  <CreditCard size={24} />
                </div>
                <div className="stat-content">
                  <div className="stat-value">{voucherCounts.redeemed}</div>
                  <div className="stat-label">Redeemed</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon inactive">
                  <XCircle size={24} />
                </div>
                <div className="stat-content">
                  <div className="stat-value">{voucherCounts.revokedOrExpired}</div>
                  <div className="stat-label">Revoked / Expired</div>
                </div>
              </div>
            </div>

            {/* Vouchers Table */}
            <div className="plans-card">
              <div className="plans-header">
                <h3>All Vouchers</h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="refresh-btn" onClick={fetchVouchers} disabled={vouchersLoading}>
                    <RefreshCw size={16} className={vouchersLoading ? 'spin' : ''} />
                    {vouchersLoading ? 'Loading...' : 'Refresh'}
                  </button>
                  <button className="save-btn" onClick={() => { if (usersData.length === 0) fetchUsers(); setShowCreateVoucher(true); }}>
                    <Ticket size={16} />
                    Create Voucher
                  </button>
                </div>
              </div>

              {vouchersLoading && vouchersData.length === 0 ? (
                <div className="empty-state">
                  <RefreshCw size={24} className="spin" />
                  <p>Loading vouchers...</p>
                </div>
              ) : vouchersData.length > 0 ? (
                <div className="table-wrapper">
                  <table className="plans-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>User</th>
                        <th>Type</th>
                        <th>Credits</th>
                        <th>Status</th>
                        <th>Expires</th>
                        <th>Issued By</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vouchersData.map((voucher) => {
                        const vStatusColor = voucher.status === 'active' ? { bg: '#d1fae5', color: '#065f46' }
                          : voucher.status === 'redeemed' ? { bg: '#dbeafe', color: '#1e40af' }
                          : voucher.status === 'revoked' ? { bg: '#fef2f2', color: '#dc2626' }
                          : { bg: '#fef3c7', color: '#92400e' };
                        return (
                          <tr key={voucher.id}>
                            <td style={{ whiteSpace: 'nowrap' }}>{formatDate(voucher.createdAt)}</td>
                            <td>
                              <span className="user-cell" title={voucher.userEmail || voucher.userId}>
                                {voucher.userFullName || voucher.userEmail || voucher.userId.slice(0, 8) + '...'}
                              </span>
                            </td>
                            <td>
                              <span className="billing-badge">{voucher.creditType}</span>
                            </td>
                            <td className="plan-name">
                              {voucher.credits}{voucher.creditType === 'video' ? 's' : ''}
                            </td>
                            <td>
                              <span
                                className="report-status-badge"
                                style={{ background: vStatusColor.bg, color: vStatusColor.color }}
                              >
                                {voucher.status}
                              </span>
                            </td>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              {voucher.expiresAt ? formatDate(voucher.expiresAt) : '—'}
                            </td>
                            <td>{voucher.issuedBy}</td>
                            <td>
                              {voucher.status === 'active' && (
                                <button
                                  className="edit-btn"
                                  onClick={() => handleRevokeVoucher(voucher.id)}
                                  disabled={revokingVoucherId === voucher.id}
                                  title="Revoke voucher"
                                  style={{ color: '#dc2626', borderColor: '#fecaca' }}
                                >
                                  {revokingVoucherId === voucher.id ? (
                                    <RefreshCw size={14} className="spin" />
                                  ) : (
                                    <XCircle size={16} />
                                  )}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  <p>No vouchers found</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Edit Plan Modal */}
      {editingPlan && (
        <div className="modal-overlay" onClick={handleCloseEditModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Plan: {editingPlan.name}</h3>
              <button className="close-btn" onClick={handleCloseEditModal}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Plan Name</label>
                  <input
                    type="text"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Billing Cycle</label>
                  <input
                    type="text"
                    value={editingPlan.billingCycle}
                    disabled
                    className="disabled"
                  />
                  <span className="help-text">Cannot be changed</span>
                </div>

                <div className="form-group">
                  <label>Price (₹)</label>
                  <input
                    type="number"
                    value={editFormData.priceInr}
                    onChange={(e) => setEditFormData({ ...editFormData, priceInr: parseInt(e.target.value) || 0 })}
                    min="0"
                  />
                </div>

                <div className="form-group">
                  <label>Display Order</label>
                  <input
                    type="number"
                    value={editFormData.displayOrder}
                    onChange={(e) => setEditFormData({ ...editFormData, displayOrder: parseInt(e.target.value) || 0 })}
                    min="0"
                  />
                </div>

                <div className="form-group">
                  <label>Image Credits</label>
                  <input
                    type="number"
                    value={editFormData.imageCredits}
                    onChange={(e) => setEditFormData({ ...editFormData, imageCredits: parseInt(e.target.value) || 0 })}
                    min="0"
                  />
                </div>

                <div className="form-group">
                  <label>Video Credits (seconds)</label>
                  <input
                    type="number"
                    value={editFormData.videoCredits}
                    onChange={(e) => setEditFormData({ ...editFormData, videoCredits: parseInt(e.target.value) || 0 })}
                    min="0"
                  />
                </div>
              </div>

              <div className="form-group full-width">
                <label>Description (optional)</label>
                <textarea
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  rows={3}
                  placeholder="Plan description..."
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="cancel-btn" onClick={handleCloseEditModal} disabled={saving}>
                Cancel
              </button>
              <button className="save-btn" onClick={handleSavePlan} disabled={saving}>
                {saving ? (
                  <>
                    <RefreshCw size={16} className="spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Detail Modal */}
      {selectedReport && (
        <div className="modal-overlay" onClick={() => setSelectedReport(null)}>
          <div className="modal-content report-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Report Details</h3>
              <button className="close-btn" onClick={() => setSelectedReport(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="report-detail-grid">
                <div className="report-detail-item">
                  <label>Type</label>
                  <span
                    className="type-badge"
                    style={{
                      background: getTypeColor(selectedReport.type).bg,
                      color: getTypeColor(selectedReport.type).color,
                    }}
                  >
                    {selectedReport.type}
                  </span>
                </div>

                <div className="report-detail-item">
                  <label>Status</label>
                  <select
                    className="status-select"
                    value={selectedReport.status}
                    onChange={(e) => handleUpdateReportStatus(selectedReport.id, e.target.value)}
                    disabled={updatingReportStatus}
                  >
                    <option value="open">Open</option>
                    <option value="reviewed">Reviewed</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>

                <div className="report-detail-item">
                  <label>User</label>
                  <span className="detail-value">
                    {selectedReport.userFullName || selectedReport.userEmail || selectedReport.userId}
                  </span>
                  {(selectedReport.userFullName && selectedReport.userEmail) && (
                    <span className="detail-sub-value">{selectedReport.userEmail}</span>
                  )}
                </div>

                <div className="report-detail-item">
                  <label>Date</label>
                  <span className="detail-value">{formatDate(selectedReport.createdAt)}</span>
                </div>
              </div>

              {selectedReport.pageUrl && (
                <div className="report-detail-item full-width">
                  <label>Page URL</label>
                  <span className="detail-value page-url">{selectedReport.pageUrl}</span>
                </div>
              )}

              <div className="report-detail-item full-width">
                <label>Message</label>
                <div className="report-message-box">{selectedReport.message}</div>
              </div>

              {selectedReport.images && selectedReport.images.length > 0 && (
                <div className="report-detail-item full-width">
                  <label>Attachments ({selectedReport.images.length})</label>
                  <div className="report-images-grid">
                    {selectedReport.images.map((img, idx) => (
                      <img
                        key={idx}
                        src={img}
                        alt={`Attachment ${idx + 1}`}
                        className="report-image"
                        onClick={() => window.open(img, '_blank')}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Vouchers issued for this report */}
              <div className="report-detail-item full-width" style={{ marginTop: '20px' }}>
                <label>Vouchers Issued</label>
                {reportVouchersLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 0', color: '#64748b', fontSize: '14px' }}>
                    <RefreshCw size={14} className="spin" />
                    Loading...
                  </div>
                ) : reportVouchers.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                    {reportVouchers.map((v) => {
                      const vColor = v.status === 'active' ? { bg: '#d1fae5', color: '#065f46' }
                        : v.status === 'redeemed' ? { bg: '#dbeafe', color: '#1e40af' }
                        : { bg: '#fef2f2', color: '#dc2626' };
                      return (
                        <div key={v.id} style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          padding: '10px 14px', borderRadius: '8px', background: '#f8fafc',
                          border: '1px solid #e2e8f0', fontSize: '14px',
                        }}>
                          <Ticket size={16} color="#64748b" />
                          <span style={{ fontWeight: 600 }}>
                            {v.credits}{v.creditType === 'video' ? 's' : ''} {v.creditType} credits
                          </span>
                          <span
                            className="report-status-badge"
                            style={{ background: vColor.bg, color: vColor.color }}
                          >
                            {v.status}
                          </span>
                          <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#94a3b8' }}>
                            {formatDate(v.createdAt)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p style={{ fontSize: '14px', color: '#94a3b8', margin: '4px 0 0' }}>No vouchers issued for this report</p>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="cancel-btn" onClick={() => setSelectedReport(null)}>
                Close
              </button>
              <button
                className="save-btn"
                onClick={() => handleIssueVoucherFromReport(selectedReport)}
              >
                <Ticket size={16} />
                Issue Voucher
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Detail / Payment History Modal */}
      {selectedUser && (
        <div className="modal-overlay" onClick={() => { setSelectedUser(null); setUserPayments([]); }}>
          <div className="modal-content report-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h3>User Details</h3>
              <button className="close-btn" onClick={() => { setSelectedUser(null); setUserPayments([]); }}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="report-detail-grid">
                <div className="report-detail-item">
                  <label>Name</label>
                  <span className="detail-value">{selectedUser.fullName || '—'}</span>
                </div>

                <div className="report-detail-item">
                  <label>Email</label>
                  <span className="detail-value">{selectedUser.email || '—'}</span>
                </div>

                <div className="report-detail-item">
                  <label>Business</label>
                  <span className="detail-value">{selectedUser.businessName || '—'}</span>
                </div>

                <div className="report-detail-item">
                  <label>Plan</label>
                  <span className="billing-badge">{selectedUser.plan}</span>
                </div>

                <div className="report-detail-item">
                  <label>Image Credits</label>
                  <span className="detail-value" style={{ fontWeight: 700 }}>{selectedUser.imageCredits}</span>
                </div>

                <div className="report-detail-item">
                  <label>Video Credits</label>
                  <span className="detail-value" style={{ fontWeight: 700 }}>{selectedUser.videoCredits}s</span>
                </div>

                <div className="report-detail-item">
                  <label>Joined</label>
                  <span className="detail-value">{selectedUser.createdAt ? formatDate(selectedUser.createdAt) : '—'}</span>
                </div>

                <div className="report-detail-item">
                  <label>User ID</label>
                  <span className="detail-value" style={{ fontSize: '12px', fontFamily: 'monospace' }}>{selectedUser.id}</span>
                </div>
              </div>

              {/* Payment History */}
              <div style={{ marginTop: '24px' }}>
                <h4 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', color: '#0f172a' }}>
                  Payment History
                </h4>

                {paymentsLoading ? (
                  <div className="empty-state" style={{ padding: '20px' }}>
                    <RefreshCw size={20} className="spin" />
                    <p>Loading payments...</p>
                  </div>
                ) : userPayments.length > 0 ? (
                  <div className="table-wrapper">
                    <table className="plans-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Type</th>
                          <th>Amount</th>
                          <th>Plan / Credits</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userPayments.map((payment) => {
                          const pStatusColor = payment.status === 'captured' ? { bg: '#d1fae5', color: '#065f46' }
                            : payment.status === 'failed' ? { bg: '#fef2f2', color: '#dc2626' }
                            : { bg: '#f1f5f9', color: '#475569' };
                          return (
                            <tr key={payment.id}>
                              <td style={{ whiteSpace: 'nowrap' }}>{formatDate(payment.createdAt)}</td>
                              <td>
                                <span className="billing-badge">
                                  {payment.paymentType === 'subscription' ? 'Subscription'
                                    : payment.paymentType === 'image_topup' ? 'Image Credits'
                                    : payment.paymentType === 'video_topup' ? 'Video Credits'
                                    : payment.paymentType}
                                </span>
                              </td>
                              <td className="price">
                                {payment.currency === 'INR' ? '₹' : payment.currency}{payment.amount}
                              </td>
                              <td>
                                {payment.planName || (payment.metadata as any)?.credits
                                  ? `${payment.planName || ''}${(payment.metadata as any)?.credits ? ` (${(payment.metadata as any).credits} credits)` : ''}`
                                  : '—'}
                              </td>
                              <td>
                                <span
                                  className="report-status-badge"
                                  style={{ background: pStatusColor.bg, color: pStatusColor.color }}
                                >
                                  {payment.status === 'captured' ? 'Complete' : payment.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-state" style={{ padding: '20px' }}>
                    <p>No payments found for this user</p>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="cancel-btn" onClick={() => { setSelectedUser(null); setUserPayments([]); }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Voucher Modal */}
      {showCreateVoucher && (
        <div className="modal-overlay" onClick={() => setShowCreateVoucher(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Voucher</h3>
              <button className="close-btn" onClick={() => setShowCreateVoucher(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>User</label>
                  <select
                    value={createVoucherForm.userId}
                    onChange={(e) => setCreateVoucherForm({ ...createVoucherForm, userId: e.target.value })}
                    style={{ padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '15px', color: '#0f172a', backgroundColor: 'white' }}
                  >
                    <option value="">Select a user...</option>
                    {usersData.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.fullName || user.email || user.id.slice(0, 8)} — {user.email || 'no email'}{user.businessName ? ` — ${user.businessName}` : ''}
                      </option>
                    ))}
                  </select>
                  {createVoucherForm.userId && (() => {
                    const selectedUser = usersData.find((u) => u.id === createVoucherForm.userId);
                    return selectedUser ? (
                      <div style={{ marginTop: '8px', padding: '10px 12px', background: '#f1f5f9', borderRadius: '8px', fontSize: '13px', color: '#334155', lineHeight: 1.6 }}>
                        <strong>{selectedUser.fullName || '—'}</strong>
                        {selectedUser.email && <span> · {selectedUser.email}</span>}
                        {selectedUser.businessName && <span> · {selectedUser.businessName}</span>}
                      </div>
                    ) : null;
                  })()}
                </div>

                <div className="form-group">
                  <label>Credit Type</label>
                  <select
                    value={createVoucherForm.creditType}
                    onChange={(e) => setCreateVoucherForm({ ...createVoucherForm, creditType: e.target.value as 'image' | 'video' })}
                    style={{ padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '15px', color: '#0f172a', backgroundColor: 'white' }}
                  >
                    <option value="image">Image</option>
                    <option value="video">Video</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Credits {createVoucherForm.creditType === 'video' ? '(seconds)' : ''}</label>
                  <input
                    type="number"
                    min={1}
                    value={createVoucherForm.credits}
                    onChange={(e) => setCreateVoucherForm({ ...createVoucherForm, credits: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Expiry Date (optional)</label>
                  <input
                    type="datetime-local"
                    value={createVoucherForm.expiresAt}
                    onChange={(e) => setCreateVoucherForm({ ...createVoucherForm, expiresAt: e.target.value })}
                  />
                  <span className="help-text">Leave empty for no expiry</span>
                </div>

                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Note (optional)</label>
                  <textarea
                    value={createVoucherForm.note}
                    onChange={(e) => setCreateVoucherForm({ ...createVoucherForm, note: e.target.value })}
                    rows={2}
                    placeholder="Reason for issuing this voucher..."
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="cancel-btn" onClick={() => setShowCreateVoucher(false)} disabled={creatingVoucher}>
                Cancel
              </button>
              <button
                className="save-btn"
                onClick={handleCreateVoucher}
                disabled={creatingVoucher || !createVoucherForm.userId || createVoucherForm.credits <= 0}
              >
                {creatingVoucher ? (
                  <>
                    <RefreshCw size={16} className="spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Ticket size={16} />
                    Create Voucher
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .page {
          min-height: 100vh;
          background: #f8fafc;
          font-family: Poppins, Inter, system-ui;
        }
        .header {
          background: white;
          border-bottom: 1px solid #e2e8f0;
          padding: 20px 40px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        }
        .header-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .header h1 {
          font-size: 24px;
          font-weight: 800;
          margin: 0;
          color: #0f172a;
        }
        .header p {
          font-size: 14px;
          color: #64748b;
          margin: 0;
        }
        .header-right {
          display: flex;
          align-items: center;
          gap: 20px;
        }
        .username {
          color: #64748b;
          font-size: 14px;
        }
        .username strong {
          color: #0f172a;
        }
        .logout-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          background: white;
          cursor: pointer;
          font-weight: 600;
          font-size: 14px;
          transition: all 200ms;
        }
        .logout-btn:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
        }
        .container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 40px 20px;
        }
        .error-msg {
          background: #fef2f2;
          color: #dc2626;
          padding: 16px;
          border-radius: 12px;
          margin-bottom: 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-weight: 600;
        }
        .success-msg {
          background: #f0fdf4;
          color: #16a34a;
          padding: 16px;
          border-radius: 12px;
          margin-bottom: 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-weight: 600;
        }
        .error-msg button,
        .success-msg button {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          padding: 0 8px;
        }

        /* Section Toggle */
        .section-toggle {
          display: flex;
          gap: 8px;
          margin-bottom: 32px;
          background: white;
          padding: 6px;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
          width: fit-content;
        }
        .section-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 24px;
          border-radius: 8px;
          border: none;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: all 200ms;
          background: transparent;
          color: #64748b;
          position: relative;
        }
        .section-btn.active {
          background: ${colors.primary};
          color: white;
        }
        .section-btn:not(.active):hover {
          background: #f1f5f9;
        }
        .badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 20px;
          height: 20px;
          padding: 0 6px;
          border-radius: 10px;
          font-size: 11px;
          font-weight: 700;
          background: #ef4444;
          color: white;
        }
        .section-btn.active .badge {
          background: white;
          color: ${colors.primary};
        }

        .status-card {
          background: white;
          border-radius: 16px;
          padding: 32px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
          margin-bottom: 32px;
        }
        .status-header {
          display: flex;
          align-items: center;
          gap: 20px;
          margin-bottom: 20px;
        }
        .status-icon {
          width: 64px;
          height: 64px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f8fafc;
        }
        .status-info h2 {
          font-size: 20px;
          font-weight: 700;
          margin: 0 0 8px 0;
          color: #0f172a;
        }
        .status-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.5px;
        }
        .status-badge.enabled {
          background: #d1fae5;
          color: #065f46;
        }
        .status-badge.disabled {
          background: #fef3c7;
          color: #92400e;
        }
        .status-description {
          display: flex;
          align-items: center;
          gap: 12px;
          background: #f8fafc;
          padding: 16px;
          border-radius: 12px;
          margin-bottom: 24px;
          font-size: 15px;
          color: #475569;
        }
        .toggle-section {
          display: flex;
          justify-content: center;
        }
        .toggle-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 32px;
          border-radius: 10px;
          border: none;
          font-weight: 700;
          font-size: 15px;
          cursor: pointer;
          transition: all 200ms;
        }
        .toggle-btn.enable {
          background: #10b981;
          color: white;
        }
        .toggle-btn.enable:hover:not(:disabled) {
          background: #059669;
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(16, 185, 129, 0.3);
        }
        .toggle-btn.disable {
          background: #f59e0b;
          color: white;
        }
        .toggle-btn.disable:hover:not(:disabled) {
          background: #d97706;
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(245, 158, 11, 0.3);
        }
        .toggle-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 20px;
          margin-bottom: 32px;
        }
        .stat-card {
          background: white;
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .stat-icon {
          width: 56px;
          height: 56px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }
        .stat-icon.total {
          background: ${colors.primary};
        }
        .stat-icon.active {
          background: #10b981;
        }
        .stat-icon.inactive {
          background: #f59e0b;
        }
        .stat-icon.mode {
          background: #8b5cf6;
        }
        .stat-value {
          font-size: 28px;
          font-weight: 800;
          color: #0f172a;
        }
        .stat-label {
          font-size: 13px;
          color: #64748b;
          font-weight: 500;
        }
        .plans-card {
          background: white;
          border-radius: 16px;
          padding: 32px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
        }
        .plans-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
        }
        .plans-header h3 {
          font-size: 20px;
          font-weight: 700;
          margin: 0;
          color: #0f172a;
        }
        .refresh-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          background: white;
          cursor: pointer;
          font-weight: 600;
          font-size: 14px;
          transition: all 200ms;
        }
        .refresh-btn:hover {
          background: #f8fafc;
          border-color: ${colors.primary};
          color: ${colors.primary};
        }
        .table-wrapper {
          overflow-x: auto;
        }
        .plans-table {
          width: 100%;
          border-collapse: collapse;
        }
        .plans-table th {
          text-align: left;
          padding: 12px;
          font-size: 13px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 2px solid #e2e8f0;
        }
        .plans-table td {
          padding: 16px 12px;
          border-bottom: 1px solid #f1f5f9;
          font-size: 15px;
          color: #0f172a;
        }
        .plan-name {
          font-weight: 600;
        }
        .price {
          font-weight: 700;
          color: ${colors.primary};
        }
        .billing-badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          background: #f1f5f9;
          color: #475569;
        }
        .empty-state {
          text-align: center;
          padding: 60px 20px;
          color: #94a3b8;
        }

        /* Report-specific styles */
        .report-row {
          cursor: pointer;
          transition: background 150ms;
        }
        .report-row:hover {
          background: #f8fafc;
        }
        .user-cell {
          font-size: 13px;
          color: #0f172a;
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          display: inline-block;
        }
        .type-badge {
          display: inline-block;
          padding: 3px 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          text-transform: capitalize;
        }
        .report-status-badge {
          display: inline-block;
          padding: 3px 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          text-transform: capitalize;
        }
        .message-cell {
          max-width: 300px;
          color: #475569;
          font-size: 14px;
        }

        /* Report Detail Modal */
        .report-modal {
          max-width: 700px;
        }
        .report-detail-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          margin-bottom: 16px;
        }
        .report-detail-item {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .report-detail-item.full-width {
          margin-top: 12px;
        }
        .report-detail-item label {
          font-size: 12px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .detail-value {
          font-size: 14px;
          color: #0f172a;
          word-break: break-all;
        }
        .detail-sub-value {
          font-size: 12px;
          color: #64748b;
        }
        .page-url {
          color: ${colors.primary};
        }
        .status-select {
          padding: 6px 10px;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          width: fit-content;
          color: #0f172a;
          background: white;
        }
        .status-select:focus {
          outline: none;
          border-color: ${colors.primary};
          box-shadow: 0 0 0 3px ${colors.primary}20;
        }
        .report-message-box {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 16px;
          font-size: 14px;
          color: #0f172a;
          white-space: pre-wrap;
          word-break: break-word;
          max-height: 200px;
          overflow-y: auto;
        }
        .report-images-grid {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }
        .report-image {
          width: 120px;
          height: 120px;
          object-fit: cover;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          cursor: pointer;
          transition: transform 200ms;
        }
        .report-image:hover {
          transform: scale(1.05);
        }

        /* Toggle Switch */
        .toggle-switch {
          position: relative;
          display: inline-block;
          width: 48px;
          height: 24px;
        }
        .toggle-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }
        .toggle-slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #cbd5e1;
          transition: 0.3s;
          border-radius: 24px;
        }
        .toggle-slider:before {
          position: absolute;
          content: "";
          height: 18px;
          width: 18px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: 0.3s;
          border-radius: 50%;
        }
        input:checked + .toggle-slider {
          background-color: #10b981;
        }
        input:checked + .toggle-slider:before {
          transform: translateX(24px);
        }
        input:disabled + .toggle-slider {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Edit Button */
        .edit-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 6px;
          border: 1px solid #e2e8f0;
          background: white;
          cursor: pointer;
          transition: all 200ms;
          color: #64748b;
        }
        .edit-btn:hover {
          background: ${colors.primary}10;
          border-color: ${colors.primary};
          color: ${colors.primary};
        }

        /* Modal */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }
        .modal-content {
          background: white;
          border-radius: 16px;
          width: 100%;
          max-width: 600px;
          max-height: 90vh;
          overflow-y: auto;
          color: #0f172a;
        }
        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 24px;
          border-bottom: 1px solid #e2e8f0;
        }
        .modal-header h3 {
          margin: 0;
          font-size: 20px;
          font-weight: 700;
          color: #0f172a;
        }
        .close-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          border-radius: 6px;
          color: #64748b;
          transition: all 200ms;
        }
        .close-btn:hover {
          background: #f1f5f9;
        }
        .modal-body {
          padding: 24px;
        }
        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          margin-bottom: 16px;
        }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .form-group.full-width {
          grid-column: 1 / -1;
        }
        .form-group label {
          font-size: 14px;
          font-weight: 600;
          color: #0f172a;
        }
        .form-group input,
        .form-group textarea {
          padding: 10px 12px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 15px;
          color: #0f172a;
          background: white;
          transition: all 200ms;
        }
        .form-group input:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: ${colors.primary};
          box-shadow: 0 0 0 3px ${colors.primary}20;
        }
        .form-group input.disabled {
          background: #f8fafc;
          color: #94a3b8;
          cursor: not-allowed;
        }
        .help-text {
          font-size: 12px;
          color: #94a3b8;
        }
        .modal-footer {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          padding: 24px;
          border-top: 1px solid #e2e8f0;
        }
        .cancel-btn,
        .save-btn {
          padding: 10px 20px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: all 200ms;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .cancel-btn {
          background: white;
          border: 1px solid #e2e8f0;
          color: #64748b;
        }
        .cancel-btn:hover:not(:disabled) {
          background: #f8fafc;
        }
        .save-btn {
          background: ${colors.primary};
          border: none;
          color: white;
        }
        .save-btn:hover:not(:disabled) {
          background: ${colors.primaryHover || '#0073e6'};
          transform: translateY(-2px);
        }
        .cancel-btn:disabled,
        .save-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        @media (max-width: 768px) {
          .header {
            flex-direction: column;
            gap: 16px;
            padding: 20px;
          }
          .stats-grid {
            grid-template-columns: 1fr;
          }
          .form-grid {
            grid-template-columns: 1fr;
          }
          .report-detail-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
