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

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [toggling, setToggling] = useState(false);
  const [togglingPlan, setTogglingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [username, setUsername] = useState('');

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
            <p>Oli AI Plan Management</p>
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
        }
      `}</style>
    </div>
  );
}
