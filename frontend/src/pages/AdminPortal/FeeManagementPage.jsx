import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, Banknote, CalendarDays, Check, ChevronDown, ChevronRight,
  CircleAlert, CreditCard, Eye, FileText, Filter, GraduationCap, History, Info, Pencil, Plus,
  ReceiptText, RefreshCw, Save, Search, Settings, ShieldCheck, Tag, Trash2, Users, WalletCards, X,
} from 'lucide-react';
import { adminEndpoints, adminRequest, downloadAdminFeeReceipt } from './adminApi';
import ExportMenu from './ExportMenu';
import './fee-management.css';

const DEFAULT_FEE_TYPES = [
  {
    id: 1,
    title: 'Monthly Fee (TERM 3 )',
    priority: 100,
    status: 'Active',
    partial_fees: false,
    concession: false,
    is_transport_fee: false,
    refundable_deposit: false,
    created_at: '02-05-2026',
  },
  {
    id: 2,
    title: 'ADJUSTMENT FEE',
    priority: 100,
    status: 'Active',
    partial_fees: false,
    concession: false,
    is_transport_fee: false,
    refundable_deposit: false,
    created_at: '02-05-2026',
  },
  {
    id: 3,
    title: 'Activity Fees',
    priority: 100,
    status: 'Inactive',
    partial_fees: false,
    concession: false,
    is_transport_fee: false,
    refundable_deposit: false,
    created_at: '02-05-2026',
  },
  {
    id: 4,
    title: 'Lab Fees',
    priority: 100,
    status: 'Inactive',
    partial_fees: false,
    concession: false,
    is_transport_fee: false,
    refundable_deposit: false,
    created_at: '02-05-2026',
  },
  {
    id: 5,
    title: 'SUMMER CORSE',
    priority: 100,
    status: 'Active',
    partial_fees: false,
    concession: false,
    is_transport_fee: false,
    refundable_deposit: false,
    created_at: '23-05-2026',
  },
  {
    id: 6,
    title: 'LUCKY DRAW JUNE FEE',
    priority: 100,
    status: 'Active',
    partial_fees: false,
    concession: false,
    is_transport_fee: false,
    refundable_deposit: false,
    created_at: '08-06-2026',
  },
];

function getStoredFeeTypes() {
  try {
    const raw = localStorage.getItem('edusure_fee_types');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (err) {
    console.error('Failed to parse stored fee types:', err);
  }
  return DEFAULT_FEE_TYPES;
}

function saveStoredFeeTypes(types) {
  try {
    localStorage.setItem('edusure_fee_types', JSON.stringify(types));
  } catch (err) {
    console.error('Failed to save fee types to localStorage:', err);
  }
}

const EMPTY_LIST = Object.freeze([]);
const collectionMethods = [
  { value: 'CASH', label: 'Cash' },
  { value: 'DIRECT_UPI', label: 'UPI at counter' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
];

const features = [
  {
    id: 'types',
    title: 'Fee Type',
    description: 'Customise fee categories and their collection rules.',
    action: 'Manage fee types',
    icon: Tag,
  },
  {
    id: 'classes',
    title: 'Class Fee Structure',
    description: 'Review and manage the fee structure of each registered class.',
    action: 'View class fees',
    icon: GraduationCap,
  },
  {
    id: 'collector',
    title: 'Fee Collector',
    description: 'Manage individual fee schedules, collect payments, and review complete payment history.',
    action: 'Collect a fee',
    icon: Banknote,
  },
];

function messageFrom(error) {
  return error instanceof Error ? error.message : 'An unexpected error occurred.';
}

function money(value) {
  if (value === null || value === undefined || value === '') return '—';
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(amount)
    : '—';
}

function dateLabel(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function invoiceStatus(invoice) {
  if (['PAID', 'WAIVED', 'VERIFICATION_PENDING'].includes(invoice.status)) return invoice.status;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (Number(invoice.balance_due) > 0 && invoice.due_date && invoice.due_date < today) return 'OVERDUE';
  return invoice.status;
}

function statusLabel(status) {
  return ({
    PAID: 'Paid',
    PENDING: 'Pending',
    PARTIAL: 'Partially paid',
    VERIFICATION_PENDING: 'Verification pending',
    WAIVED: 'Waived',
    OVERDUE: 'Overdue',
    SUCCESS: 'Success',
    PENDING_VERIFICATION: 'Pending verification',
    REJECTED: 'Rejected',
    FAILED: 'Failed',
    INITIATED: 'Initiated',
  })[status] || status || '—';
}

function paymentMethodLabel(method) {
  return collectionMethods.find((item) => item.value === method)?.label || method || '—';
}

function paymentHistoryMetadata(transaction) {
  const details = [
    transaction.invoice_title,
    transaction.invoice_number,
    dateLabel(transaction.paid_at || transaction.created_at),
    transaction.utr_number ? `Ref ${transaction.utr_number}` : '',
    transaction.receipt_number ? `Receipt ${transaction.receipt_number}` : '',
    Number(transaction.convenience_fee) > 0 ? `Convenience fee ${money(transaction.convenience_fee)}` : '',
    Number(transaction.total_charged) > Number(transaction.amount) ? `Total charged ${money(transaction.total_charged)}` : '',
    transaction.gateway_order_id ? `Order ${transaction.gateway_order_id}` : '',
    transaction.gateway_payment_id ? `Payment ${transaction.gateway_payment_id}` : '',
    transaction.payer_upi_id ? `Payer ${transaction.payer_upi_id}` : '',
    transaction.remarks,
    transaction.verified_by ? `Verified by ${transaction.verified_by}` : '',
    `Transaction #${transaction.id}`,
  ];
  return details.filter(Boolean).join(' · ');
}

function parseFeeArrayResponse(response) {
  if (Array.isArray(response)) return { data: response, count: response.length };
  if (response && Array.isArray(response.results) && Number.isFinite(Number(response.count))) {
    return { data: response.results, count: Number(response.count) };
  }
  throw new Error('The server returned an invalid fee response.');
}

function useFeeArray(path, token) {
  const [resource, setResource] = useState(() => ({
    path,
    data: EMPTY_LIST,
    count: 0,
    loading: Boolean(token),
    error: null,
  }));

  useEffect(() => {
    let active = true;
    if (!token) return;
    adminRequest(path, token)
      .then((data) => {
        const parsed = parseFeeArrayResponse(data);
        if (active) setResource({ path, ...parsed, loading: false, error: null });
      })
      .catch((error) => {
        if (active) setResource((current) => ({ ...current, path, loading: false, error: messageFrom(error) }));
      });
    return () => { active = false; };
  }, [path, token]);

  const load = useCallback(async () => {
    if (!token) return;
    setResource((current) => ({ ...current, path, loading: true, error: null }));
    try {
      const parsed = parseFeeArrayResponse(await adminRequest(path, token));
      setResource({ path, ...parsed, loading: false, error: null });
    } catch (error) {
      setResource((current) => ({ ...current, path, loading: false, error: messageFrom(error) }));
    }
  }, [path, token]);

  return {
    data: resource.data,
    count: resource.path === path ? resource.count : 0,
    loading: resource.path !== path ? Boolean(token) : resource.loading,
    error: resource.path === path ? resource.error : null,
    load,
  };
}

function useFeeSummary(token) {
  const [resource, setResource] = useState({ token, data: null, loading: Boolean(token), error: null });

  useEffect(() => {
    let active = true;
    if (!token) return undefined;
    adminRequest(adminEndpoints.feeSummary, token)
      .then((data) => {
        if (!data || typeof data !== 'object') throw new Error('The server returned an invalid fee summary.');
        if (active) setResource({ token, data, loading: false, error: null });
      })
      .catch((error) => {
        if (active) setResource({ token, data: null, loading: false, error: messageFrom(error) });
      });
    return () => { active = false; };
  }, [token]);

  const load = useCallback(async () => {
    if (!token) return;
    setResource((current) => ({ token, data: current.token === token ? current.data : null, loading: true, error: null }));
    try {
      const data = await adminRequest(adminEndpoints.feeSummary, token);
      if (!data || typeof data !== 'object') throw new Error('The server returned an invalid fee summary.');
      setResource({ token, data, loading: false, error: null });
    } catch (error) {
      setResource({ token, data: null, loading: false, error: messageFrom(error) });
    }
  }, [token]);

  return {
    data: resource.token === token ? resource.data : null,
    loading: resource.token === token ? resource.loading : Boolean(token),
    error: resource.token === token ? resource.error : null,
    load,
  };
}

function LoadingState({ rows = 4 }) {
  return (
    <div className="fee-skeleton" role="status" aria-label="Loading fee data">
      {Array.from({ length: rows }, (_, index) => <span key={index} />)}
    </div>
  );
}

function ErrorState({ error, onRetry }) {
  return (
    <div className="fee-state fee-error" role="alert">
      <CircleAlert size={19} />
      <div><strong>Unable to load fee information</strong><p>{error}</p></div>
      {onRetry && <button type="button" className="fee-secondary-button" onClick={onRetry}>Try again</button>}
    </div>
  );
}

function EmptyState({ title, message, icon: Icon = FileText }) {
  return (
    <div className="fee-empty">
      <span><Icon size={20} /></span>
      <strong>{title}</strong>
      <p>{message}</p>
    </div>
  );
}

function LandingPage({ onNavigate }) {
  return (
    <div className="fee-feature-grid">
      {features.map(({ id, title, description, action, icon: Icon }) => (
        <button
          type="button"
          className={`adm-shortcut-card fee-feature-card fee-feature-${id}`}
          key={id}
          aria-label={`${action}: ${title}`}
          onClick={() => onNavigate(id)}
        >
          <span className="adm-shortcut-icon fee-feature-icon"><Icon size={19} strokeWidth={1.8} /></span>
          <span className="fee-feature-copy">
            <strong>{title}</strong>
            <small>{description}</small>
          </span>
          <span className="fee-feature-action">{action}</span>
          <ChevronRight size={17} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

function FeatureHeading({ title, description, onBack, action }) {
  return (
    <div className="fee-feature-heading">
      <div>
        <button type="button" className="fee-back-button" onClick={onBack}><ArrowLeft size={15} /> Fee Management</button>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

function FrequencyOptions() {
  return (
    <fieldset className="fee-frequency-options fee-field-wide" disabled>
      <legend>Payment frequency <span>Coming Soon</span></legend>
      <div>
        <label><input type="radio" name="frequency" value="monthly" /><span>Monthly</span></label>
        <label><input type="radio" name="frequency" value="quarterly" /><span>Quarterly</span></label>
        <label><input type="radio" name="frequency" value="half-yearly" /><span>Half-yearly</span></label>
        <label><input type="radio" name="frequency" value="yearly" /><span>Yearly</span></label>
      </div>
      <p>The existing API does not store payment frequency, so these options cannot be selected or saved yet.</p>
    </fieldset>
  );
}

function FeeTypeModal({ isOpen, onClose, onSave, editingItem = null }) {
  const [formData, setFormData] = useState(() => (editingItem ? {
    title: editingItem.title || '',
    priority: editingItem.priority !== undefined ? String(editingItem.priority) : '100',
    status: editingItem.status || 'Active',
    partial_fees: Boolean(editingItem.partial_fees),
    concession: Boolean(editingItem.concession),
    is_transport_fee: Boolean(editingItem.is_transport_fee),
    refundable_deposit: Boolean(editingItem.refundable_deposit),
  } : {
    title: '',
    priority: '100',
    status: 'Active',
    partial_fees: false,
    concession: false,
    is_transport_fee: false,
    refundable_deposit: false,
  }));
  const [error, setError] = useState('');

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanTitle = formData.title.trim();
    if (!cleanTitle) {
      setError('Please enter a title for the fee type.');
      return;
    }
    const today = new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date()).replace(/\//g, '-');

    const itemToSave = {
      id: editingItem ? editingItem.id : Date.now(),
      title: cleanTitle,
      priority: formData.priority ? Number(formData.priority) : 100,
      status: formData.status,
      partial_fees: formData.partial_fees,
      concession: formData.concession,
      is_transport_fee: formData.is_transport_fee,
      refundable_deposit: formData.refundable_deposit,
      created_at: editingItem?.created_at || today,
    };

    onSave(itemToSave);
  };

  return (
    <div
      className="fee-popup-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="fee-popup-modal" role="dialog" aria-modal="true" aria-label={editingItem ? 'Edit Fees Type' : 'Add Fees Type'}>
        <div className="fee-types-banner">
          <div className="fee-types-banner-title">
            <span className="fee-gear-icon-wrap">
              <Settings size={18} strokeWidth={2.4} />
            </span>
            <h2>{editingItem ? 'Edit Fees Type' : 'Add Fees Type'}</h2>
          </div>
          <button type="button" className="fee-types-btn" onClick={onClose}>
            <ArrowLeft size={13} />
            <span>Back</span>
          </button>
        </div>

        <form className="fee-popup-body" onSubmit={handleSubmit}>
          <div className="fee-popup-group">
            <label className="fee-popup-label" htmlFor="fee-type-title">Title</label>
            <input
              id="fee-type-title"
              type="text"
              className="fee-popup-input"
              value={formData.title}
              onChange={(e) => {
                setFormData({ ...formData, title: e.target.value });
                if (error) setError('');
              }}
              placeholder=""
              autoFocus
            />
            {error && <span className="fee-popup-error">{error}</span>}
          </div>

          <div className="fee-popup-group">
            <label className="fee-popup-label" htmlFor="fee-type-priority">Priority</label>
            <input
              id="fee-type-priority"
              type="number"
              className="fee-popup-input"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              placeholder="100"
            />
            <p className="fee-popup-helper">Lower numbers are paid first in Lump Sum mode (default 100).</p>
          </div>

          <div className="fee-popup-group">
            <label className="fee-popup-label" htmlFor="fee-type-status">Status</label>
            <div className="fee-popup-select-wrap">
              <select
                id="fee-type-status"
                className="fee-popup-select"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
              <ChevronDown size={16} className="fee-popup-select-arrow" />
            </div>
          </div>

          <div className="fee-popup-check-row">
            <label className="fee-popup-check-label">
              <input
                type="checkbox"
                className="fee-popup-checkbox"
                checked={formData.partial_fees}
                onChange={(e) => setFormData({ ...formData, partial_fees: e.target.checked })}
              />
              <span>Enable Partial Fees</span>
            </label>

            <label className="fee-popup-check-label">
              <input
                type="checkbox"
                className="fee-popup-checkbox"
                checked={formData.concession}
                onChange={(e) => setFormData({ ...formData, concession: e.target.checked })}
              />
              <span>Enable Concession</span>
            </label>

            <label className="fee-popup-check-label">
              <input
                type="checkbox"
                className="fee-popup-checkbox"
                checked={formData.is_transport_fee}
                onChange={(e) => setFormData({ ...formData, is_transport_fee: e.target.checked })}
              />
              <span>Is Transport Fee</span>
            </label>
          </div>

          <div className="fee-popup-single-check">
            <label className="fee-popup-check-label">
              <input
                type="checkbox"
                className="fee-popup-checkbox"
                checked={formData.refundable_deposit}
                onChange={(e) => setFormData({ ...formData, refundable_deposit: e.target.checked })}
              />
              <span>Refundable deposit</span>
            </label>
            <p className="fee-popup-helper">
              Money collected under this fee type can be returned later if the admission is cancelled.
            </p>
          </div>

          <div className="fee-popup-actions">
            <button type="submit" className="fee-popup-create-btn">
              {editingItem ? 'Save Changes' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FeeTypePage({ onBack, feeTypes = [], onSaveFeeType, initialOpenAdd = false }) {
  const [modalOpen, setModalOpen] = useState(initialOpenAdd);
  const [editingItem, setEditingItem] = useState(null);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setModalOpen(true);
  };

  const handleSave = (item) => {
    if (onSaveFeeType) onSaveFeeType(item);
    setModalOpen(false);
    setEditingItem(null);
  };

  return (
    <section className="fee-feature-page fee-types-page">
      <div className="fee-types-card">
        <div className="fee-types-banner">
          <div className="fee-types-banner-title">
            <span className="fee-gear-icon-wrap">
              <Settings size={19} strokeWidth={2.4} />
            </span>
            <div>
              <h2>Fees Types</h2>
              <span className="fee-types-banner-subtitle">Maximum Allowed: 25</span>
            </div>
          </div>
          <div className="fee-types-banner-actions">
            <button type="button" className="fee-types-btn" onClick={onBack}>
              <ArrowLeft size={13} />
              <span>Back</span>
            </button>
            <button type="button" className="fee-types-btn" onClick={handleOpenAdd}>
              <Plus size={13} />
              <span>Add more</span>
            </button>
          </div>
        </div>

        <div className="fee-types-body">
          <p className="fee-types-count">
            Showing 1-{feeTypes.length} of {feeTypes.length} items.
          </p>

          <div className="fee-types-table-wrap">
            <table className="fee-types-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Partial Fees</th>
                  <th>Concession</th>
                  <th>Created At</th>
                  <th style={{ width: '60px', textAlign: 'center' }}></th>
                </tr>
              </thead>
              <tbody>
                {feeTypes.map((item) => (
                  <tr key={item.id}>
                    <td className="fee-type-title-cell">{item.title}</td>
                    <td className={`fee-type-status-cell ${item.status === 'Inactive' ? 'fee-type-status-inactive' : ''}`}>{item.status || 'Active'}</td>
                    <td>
                      <span className={`fee-badge-pill ${item.partial_fees ? 'fee-badge-enabled' : 'fee-badge-disabled'}`}>
                        {item.partial_fees ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td>
                      <span className={`fee-badge-pill ${item.concession ? 'fee-badge-enabled' : 'fee-badge-disabled'}`}>
                        {item.concession ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td className="fee-type-date-cell">{item.created_at || '—'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="fee-edit-icon-btn"
                        onClick={() => handleOpenEdit(item)}
                        title={`Edit ${item.title}`}
                        aria-label={`Edit ${item.title}`}
                      >
                        <Pencil size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <FeeTypeModal
        key={editingItem ? `edit-${editingItem.id}` : (modalOpen ? 'add-open' : 'closed')}
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingItem(null);
        }}
        onSave={handleSave}
        editingItem={editingItem}
      />
    </section>
  );
}

function classKey(grade, section) {
  return `${String(grade || '').trim().toUpperCase()}|${String(section || '').trim().toUpperCase()}`;
}

function formatClassTitle(item) {
  const grade = String(item?.class_grade || '').trim();
  const section = String(item?.section || '').trim();
  if (!grade) return 'Class not specified';
  if (section && !grade.toUpperCase().includes(section.toUpperCase())) {
    return `${grade} ${section}`;
  }
  return grade;
}

const CLASS_GROUPS = [
  'Other Classes',
  'Primary (Classes 1 - 5)',
  'Middle (Classes 6 - 8)',
  'Secondary (Classes 9 - 10)',
  'Higher Secondary (Classes 11 - 12)',
  'Competitive / Coaching Batches',
];

function inferClassGroup(gradeStr) {
  const g = String(gradeStr || '').trim().toLowerCase();
  const numMatch = g.match(/\b([1-9]|1[0-2])\b/);
  if (numMatch) {
    const n = parseInt(numMatch[1], 10);
    if (n >= 1 && n <= 5) return 'Primary (Classes 1 - 5)';
    if (n >= 6 && n <= 8) return 'Middle (Classes 6 - 8)';
    if (n >= 9 && n <= 10) return 'Secondary (Classes 9 - 10)';
    if (n >= 11 && n <= 12) return 'Higher Secondary (Classes 11 - 12)';
  }
  if (g.includes('primary')) return 'Primary (Classes 1 - 5)';
  if (g.includes('middle')) return 'Middle (Classes 6 - 8)';
  if (g.includes('secondary')) return 'Secondary (Classes 9 - 10)';
  if (g.includes('jee') || g.includes('neet') || g.includes('coaching') || g.includes('batch') || g.includes('course')) {
    return 'Competitive / Coaching Batches';
  }
  return 'Other Classes';
}

const CUSTOM_CLASSES_KEY = 'edusure_custom_classes';

function getStoredCustomClasses() {
  try {
    const raw = localStorage.getItem(CUSTOM_CLASSES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error('Failed to parse custom classes:', err);
  }
  return [];
}

function saveStoredCustomClasses(classes) {
  try {
    localStorage.setItem(CUSTOM_CLASSES_KEY, JSON.stringify(classes));
  } catch (err) {
    console.error('Failed to save custom classes:', err);
  }
}

function ClassFeeStructureCard({
  classItem,
  structure,
  feeTypes = [],
  onAssignFee,
  onEditCategory,
  onViewDetails,
  onRemoveCategory,
  onCustomiseClass,
}) {
  const categories = structure?.categories || EMPTY_LIST;
  const activeTypes = (feeTypes || []).filter((ft) => ft.status !== 'Inactive');
  const denominator = activeTypes.length || feeTypes.length || 6;
  const assignedCount = categories.length;
  const remainingCount = Math.max(0, denominator - assignedCount);

  const title = formatClassTitle(classItem);

  return (
    <article className="fee-struct-card" data-class={title}>
      <header className="fee-struct-card-header">
        <div className="fee-struct-header-left">
          <span className="fee-struct-cap-icon">
            <GraduationCap size={18} strokeWidth={2.2} />
          </span>
          <div className="fee-struct-title-wrap">
            <h3 className="fee-struct-class-name" title={title}>{title}</h3>
          </div>
        </div>
        <div className="fee-struct-badge-set">
          {assignedCount}/{denominator} set
        </div>
      </header>

      <div className="fee-struct-card-body">
        {categories.length > 0 ? (
          <div className="fee-struct-category-list">
            {categories.map((cat, idx) => (
              <div className="fee-struct-cat-item" key={cat.id ?? `cat-${idx}`}>
                <div className="fee-struct-cat-info">
                  <div className="fee-struct-cat-title" title={cat.fee_type_title}>
                    {cat.fee_type_title}
                  </div>
                  <div className="fee-struct-cat-sub">
                    <span className="fee-struct-cat-amount">{money(cat.amount)}</span>
                    <span className="fee-struct-cat-freq">{cat.frequency || 'Monthly'}</span>
                  </div>
                </div>
                <div className="fee-struct-cat-actions">
                  <button
                    type="button"
                    className="fee-cat-icon-btn fee-cat-btn-edit"
                    title={`Edit ${cat.fee_type_title}`}
                    aria-label={`Edit ${cat.fee_type_title}`}
                    onClick={() => onEditCategory(classItem, structure, cat, idx)}
                  >
                    <Pencil size={12.5} />
                  </button>
                  <button
                    type="button"
                    className="fee-cat-icon-btn fee-cat-btn-view"
                    title={`View ${cat.fee_type_title}`}
                    aria-label={`View ${cat.fee_type_title}`}
                    onClick={() => onViewDetails(classItem, structure, cat)}
                  >
                    <Eye size={12.5} />
                  </button>
                  <button
                    type="button"
                    className="fee-cat-icon-btn fee-cat-btn-delete"
                    title={`Remove ${cat.fee_type_title}`}
                    aria-label={`Remove ${cat.fee_type_title}`}
                    onClick={() => onRemoveCategory(classItem, structure, cat, idx)}
                  >
                    <Trash2 size={12.5} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="fee-struct-empty-cat">
            <p>No fees configured yet</p>
          </div>
        )}
      </div>

      <footer className="fee-struct-card-footer">
        <button
          type="button"
          className="fee-assign-btn"
          disabled={remainingCount === 0}
          onClick={() => onAssignFee(classItem, structure)}
          title={remainingCount > 0 ? `Assign from ${remainingCount} remaining fee types` : 'All fees assigned'}
        >
          <Plus size={13} strokeWidth={2.6} />
          <span>Assign Fee</span>
          {remainingCount > 0 ? (
            <span className="fee-assign-count-badge">{remainingCount}</span>
          ) : (
            <span className="fee-assign-count-badge fee-assign-done">✓</span>
          )}
        </button>

        {onCustomiseClass && (
          <button
            type="button"
            className="fee-customise-class-link"
            title={`Customise details for ${title}`}
            onClick={() => onCustomiseClass(classItem, structure)}
          >
            Customise
          </button>
        )}
      </footer>
    </article>
  );
}

function AddCustomClassModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  editingItem = null,
}) {
  const [name, setName] = useState(() => editingItem?.class_grade || '');
  const [group, setGroup] = useState(() => editingItem?.group || 'Other Classes');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingItem) {
      setName(editingItem.class_grade || '');
      setGroup(editingItem.group || 'Other Classes');
    } else {
      setName('');
      setGroup('Other Classes');
    }
    setError('');
  }, [editingItem, isOpen]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError('Please enter a class / batch name.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await onSave({
        class_grade: cleanName,
        section: editingItem?.section || '',
        group: group || 'Other Classes',
      });
      onClose();
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fee-popup-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="fee-custom-class-modal" role="dialog" aria-modal="true" aria-label={editingItem ? 'Customise Class' : 'Add Custom Class'}>
        <div className="fee-custom-class-header">
          <h2>{editingItem ? 'Customise Class' : 'Add Custom Class'}</h2>
          <button type="button" className="fee-modal-round-close" onClick={onClose} aria-label="Close dialog">
            <X size={16} />
          </button>
        </div>

        <form className="fee-custom-class-body" onSubmit={handleSubmit}>
          <div className="fee-custom-class-notice">
            <Info size={17} className="fee-notice-icon" />
            <p>This class will be private to your institution — no other school will see it</p>
          </div>

          <div className="fee-popup-group">
            <label className="fee-popup-label" htmlFor="custom-class-name">Class / Batch Name *</label>
            <input
              id="custom-class-name"
              type="text"
              className="fee-popup-input"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError('');
              }}
              placeholder="e.g. Advanced Batch A, Foundation Year 1"
              autoFocus
            />
            {error && <span className="fee-popup-error">{error}</span>}
          </div>

          <div className="fee-popup-group">
            <label className="fee-popup-label" htmlFor="custom-class-group">Class Group</label>
            <div className="fee-popup-select-wrap">
              <select
                id="custom-class-group"
                className="fee-popup-select"
                value={group}
                onChange={(e) => setGroup(e.target.value)}
              >
                {CLASS_GROUPS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
              <ChevronDown size={16} className="fee-popup-select-arrow" />
            </div>
            <p className="fee-popup-helper">Choose a class group, or Other Classes to move ungrouped / unwanted batches</p>
          </div>

          <div className="fee-custom-class-actions">
            {editingItem && onDelete ? (
              <button
                type="button"
                className="fee-danger-outline-button"
                onClick={() => {
                  if (window.confirm(`Are you sure you want to remove Class "${name}"?`)) {
                    onDelete(editingItem);
                    onClose();
                  }
                }}
              >
                Remove Class
              </button>
            ) : <div />}
            <div className="fee-custom-class-actions-right">
              <button type="button" className="fee-modal-cancel-btn" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="fee-modal-save-btn" disabled={saving}>
                <Save size={14} />
                <span>{saving ? 'Saving…' : 'Save Class'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function AssignFeeCategoryModal({
  isOpen,
  classItem,
  structure,
  feeTypes = [],
  onClose,
  onSave,
}) {
  const assignedTypeIds = useMemo(() => {
    return new Set((structure?.categories || []).map((c) => Number(c.fee_type_id)));
  }, [structure]);

  const availableTypes = useMemo(() => {
    const unassigned = feeTypes.filter((ft) => !assignedTypeIds.has(Number(ft.id)));
    return unassigned.length > 0 ? unassigned : feeTypes;
  }, [feeTypes, assignedTypeIds]);

  const [selectedTypeId, setSelectedTypeId] = useState(() => (availableTypes[0]?.id ? String(availableTypes[0].id) : ''));
  const [amount, setAmount] = useState('2000');
  const [frequency, setFrequency] = useState('Monthly');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (availableTypes.length > 0 && (!selectedTypeId || !availableTypes.some((ft) => String(ft.id) === selectedTypeId))) {
      setSelectedTypeId(String(availableTypes[0].id));
    }
  }, [availableTypes, selectedTypeId]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen || !classItem) return null;

  const classTitle = formatClassTitle(classItem);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedTypeId) {
      setError('Please select a fee type.');
      return;
    }
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount < 0) {
      setError('Please enter a valid fee amount.');
      return;
    }
    const chosenType = feeTypes.find((ft) => String(ft.id) === String(selectedTypeId));
    setError('');
    setSaving(true);
    try {
      await onSave({
        classItem,
        structure,
        category: {
          fee_type_id: Number(selectedTypeId),
          fee_type_title: chosenType?.title || 'Fee',
          amount: String(numAmount),
          frequency: frequency || 'Monthly',
          position: structure?.categories?.length || 0,
          is_active: true,
        },
      });
      onClose();
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fee-popup-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="fee-custom-class-modal fee-assign-modal" role="dialog" aria-modal="true" aria-label={`Assign Fee to ${classTitle}`}>
        <div className="fee-custom-class-header">
          <h2>Assign Fee · {classTitle}</h2>
          <button type="button" className="fee-modal-round-close" onClick={onClose} aria-label="Close dialog">
            <X size={16} />
          </button>
        </div>

        <form className="fee-custom-class-body" onSubmit={handleSubmit}>
          <div className="fee-popup-group">
            <label className="fee-popup-label" htmlFor="assign-fee-type">Fee Type *</label>
            <div className="fee-popup-select-wrap">
              <select
                id="assign-fee-type"
                className="fee-popup-select"
                value={selectedTypeId}
                onChange={(e) => {
                  setSelectedTypeId(e.target.value);
                  if (error) setError('');
                }}
              >
                {availableTypes.map((ft) => (
                  <option key={ft.id} value={ft.id}>
                    {ft.title} {assignedTypeIds.has(Number(ft.id)) ? '(Already Assigned)' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="fee-popup-select-arrow" />
            </div>
            <p className="fee-popup-helper">Select from your configured Fee Types.</p>
          </div>

          <div className="fee-popup-group">
            <label className="fee-popup-label" htmlFor="assign-fee-amount">Amount (INR) *</label>
            <input
              id="assign-fee-amount"
              type="number"
              min="0"
              step="1"
              className="fee-popup-input"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                if (error) setError('');
              }}
              placeholder="e.g. 2000"
              required
            />
          </div>

          <div className="fee-popup-group">
            <label className="fee-popup-label" htmlFor="assign-fee-frequency">Frequency</label>
            <div className="fee-popup-select-wrap">
              <select
                id="assign-fee-frequency"
                className="fee-popup-select"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
              >
                <option value="Monthly">Monthly</option>
                <option value="Quarterly">Quarterly</option>
                <option value="Half-yearly">Half-yearly</option>
                <option value="Yearly">Yearly</option>
                <option value="One Time">One Time</option>
              </select>
              <ChevronDown size={16} className="fee-popup-select-arrow" />
            </div>
          </div>

          {error && <span className="fee-popup-error">{error}</span>}

          <div className="fee-custom-class-actions">
            <div />
            <div className="fee-custom-class-actions-right">
              <button type="button" className="fee-modal-cancel-btn" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="fee-modal-save-btn" disabled={saving}>
                <Plus size={14} />
                <span>{saving ? 'Assigning…' : 'Assign Fee'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditCategoryModal({
  isOpen,
  categoryData,
  feeTypes = [],
  onClose,
  onSave,
  onRemove,
}) {
  const { classItem, structure, category, index } = categoryData || {};
  const [amount, setAmount] = useState(() => (category?.amount ? String(category.amount) : '0'));
  const [frequency, setFrequency] = useState(() => category?.frequency || 'Monthly');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (category) {
      setAmount(String(category.amount ?? 0));
      setFrequency(category.frequency || 'Monthly');
    }
  }, [category]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen || !category) return null;

  const classTitle = formatClassTitle(classItem);

  async function handleSubmit(e) {
    e.preventDefault();
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount < 0) {
      setError('Please enter a valid fee amount.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await onSave({
        classItem,
        structure,
        index,
        category: {
          ...category,
          amount: String(numAmount),
          frequency,
        },
      });
      onClose();
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fee-popup-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="fee-custom-class-modal fee-assign-modal" role="dialog" aria-modal="true" aria-label={`Edit ${category.fee_type_title}`}>
        <div className="fee-custom-class-header">
          <h2>Edit Fee Category</h2>
          <button type="button" className="fee-modal-round-close" onClick={onClose} aria-label="Close dialog">
            <X size={16} />
          </button>
        </div>

        <form className="fee-custom-class-body" onSubmit={handleSubmit}>
          <div className="fee-cat-edit-summary">
            <strong>{category.fee_type_title}</strong>
            <span>{classTitle}</span>
          </div>

          <div className="fee-popup-group">
            <label className="fee-popup-label" htmlFor="edit-fee-amount">Amount (INR) *</label>
            <input
              id="edit-fee-amount"
              type="number"
              min="0"
              step="1"
              className="fee-popup-input"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                if (error) setError('');
              }}
              required
              autoFocus
            />
          </div>

          <div className="fee-popup-group">
            <label className="fee-popup-label" htmlFor="edit-fee-frequency">Frequency</label>
            <div className="fee-popup-select-wrap">
              <select
                id="edit-fee-frequency"
                className="fee-popup-select"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
              >
                <option value="Monthly">Monthly</option>
                <option value="Quarterly">Quarterly</option>
                <option value="Half-yearly">Half-yearly</option>
                <option value="Yearly">Yearly</option>
                <option value="One Time">One Time</option>
              </select>
              <ChevronDown size={16} className="fee-popup-select-arrow" />
            </div>
          </div>

          {error && <span className="fee-popup-error">{error}</span>}

          <div className="fee-custom-class-actions">
            <button
              type="button"
              className="fee-danger-outline-button"
              onClick={() => {
                if (window.confirm(`Remove "${category.fee_type_title}" from ${classTitle}?`)) {
                  onRemove(classItem, structure, category, index);
                  onClose();
                }
              }}
            >
              Remove Category
            </button>
            <div className="fee-custom-class-actions-right">
              <button type="button" className="fee-modal-cancel-btn" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="fee-modal-save-btn" disabled={saving}>
                <Save size={14} />
                <span>{saving ? 'Saving…' : 'Save Changes'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function ClassFeeDetailsModal({ details, feeTypes = [], onClose }) {
  const { classItem, structure } = details || {};
  const categories = structure?.categories || EMPTY_LIST;
  const title = formatClassTitle(classItem);
  const typeMap = useMemo(() => new Map(feeTypes.map((ft) => [Number(ft.id), ft])), [feeTypes]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  if (!details) return null;

  const totalFeeSum = categories.reduce((sum, c) => sum + Number(c.amount || 0), 0);

  return (
    <div
      className="fee-popup-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="fee-custom-class-modal fee-view-details-modal" role="dialog" aria-modal="true" aria-label={`Fee Details · ${title}`}>
        <div className="fee-custom-class-header">
          <h2>Fee Details · {title}</h2>
          <button type="button" className="fee-modal-round-close" onClick={onClose} aria-label="Close dialog">
            <X size={16} />
          </button>
        </div>

        <div className="fee-custom-class-body">
          <div className="fee-detail-stats-grid">
            <div className="fee-detail-stat-card">
              <span>Class</span>
              <strong>{title}</strong>
            </div>
            <div className="fee-detail-stat-card">
              <span>Section</span>
              <strong>{classItem.section || 'All Sections'}</strong>
            </div>
            <div className="fee-detail-stat-card">
              <span>Total Categories</span>
              <strong>{categories.length}</strong>
            </div>
            <div className="fee-detail-stat-card">
              <span>Total Fees</span>
              <strong>{money(totalFeeSum)}</strong>
            </div>
          </div>

          <div className="fee-detail-categories-title">Configured Fee Categories</div>

          {categories.length > 0 ? (
            <div className="fee-detail-categories-list">
              {categories.map((cat, idx) => {
                const ft = typeMap.get(Number(cat.fee_type_id));
                return (
                  <div className="fee-detail-cat-card" key={cat.id || idx}>
                    <div className="fee-detail-cat-header">
                      <strong>{cat.fee_type_title}</strong>
                      <span className="fee-detail-cat-amount">{money(cat.amount)} <small>({cat.frequency || 'Monthly'})</small></span>
                    </div>
                    {ft && (
                      <div className="fee-detail-cat-badges">
                        <span className={`fee-badge-pill ${ft.status === 'Active' ? 'fee-badge-enabled' : 'fee-badge-disabled'}`}>
                          {ft.status || 'Active'}
                        </span>
                        {ft.partial_fees && <span className="fee-badge-pill fee-badge-enabled">Partial Fees</span>}
                        {ft.concession && <span className="fee-badge-pill fee-badge-enabled">Concession</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="fee-struct-empty-cat">No fee categories configured for this class yet.</p>
          )}

          <div className="fee-custom-class-actions">
            <div />
            <button type="button" className="fee-modal-save-btn" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Dialog({ title, children, onClose }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="fee-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="fee-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="fee-modal-head"><h2>{title}</h2><button type="button" className="fee-close-button" aria-label="Close dialog" onClick={onClose}>×</button></div>
        <div className="fee-modal-body">{children}</div>
      </section>
    </div>
  );
}

function FeeScheduleDialog({ invoice, token, onClose, onSaved, onNotify }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const paymentLocked = Number(invoice?.payment_count || 0) > 0;

  async function save(event, saveAsDefault = false) {
    event.preventDefault();
    if (!invoice || !token) return;
    const form = new FormData(event.currentTarget.form || event.currentTarget);
    const startMonth = String(form.get('schedule_start_month') || '');
    const endMonth = String(form.get('schedule_end_month') || '');
    const latePenaltyEnabled = form.get('late_penalty_enabled') === 'on';
    const payload = {
      base_amount: String(form.get('base_amount') || invoice.base_amount),
      schedule_start_month: startMonth ? `${startMonth}-01` : null,
      schedule_end_month: endMonth ? `${endMonth}-01` : null,
      period_type: String(form.get('period_type') || 'ONE_TIME'),
      late_penalty_enabled: latePenaltyEnabled,
      late_fee_amount: latePenaltyEnabled ? String(form.get('late_fee_amount') || '0') : '0',
      penalty_period: String(form.get('penalty_period') || 'ONE_TIME'),
      due_day: String(form.get('due_day') || '') ? Number(form.get('due_day')) : null,
    };
    setSaving(true);
    setError('');
    try {
      const updated = await adminRequest(adminEndpoints.feeInvoiceDetail(invoice.id), token, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      if (saveAsDefault) {
        const result = await adminRequest(adminEndpoints.feeInvoiceSaveDefault(invoice.id), token, {
          method: 'POST',
        });
        onNotify('success', result?.detail || 'Fee defaults saved for future assignments.');
      } else {
        onNotify('success', 'Student fee schedule updated.');
      }
      onSaved(updated);
      onClose();
    } catch (saveError) {
      setError(messageFrom(saveError));
    } finally {
      setSaving(false);
    }
  }

  const title = invoice ? `Modify ${invoice.title}` : 'Fee schedule options';
  return (
    <Dialog title={title} onClose={onClose}>
      {!invoice ? (
        <EmptyState icon={CalendarDays} title="Select a student fee first." message="Open Edit on a student's fee record to update its schedule." />
      ) : (
        <form className="fee-form-grid fee-schedule-form" onSubmit={(event) => save(event)}>
          <p className="fee-selected-class fee-field-wide">{invoice.student_name} · {invoice.student_id} · Class {invoice.class_grade || '—'}{invoice.section ? ` · Section ${invoice.section}` : ''}</p>
          <div className="fee-schedule-section-title fee-field-wide"><CalendarDays size={14} />Schedule</div>
          <label className="fee-field"><span>Start month</span><input name="schedule_start_month" type="month" defaultValue={invoice.schedule_start_month?.slice(0, 7) || ''} /></label>
          <label className="fee-field"><span>End month</span><input name="schedule_end_month" type="month" defaultValue={invoice.schedule_end_month?.slice(0, 7) || ''} /></label>
          <div className="fee-schedule-section-title fee-field-wide"><WalletCards size={14} />Amount &amp; type</div>
          <label className="fee-field">
            <span>Amount (INR)</span>
            <input name="base_amount" type="number" min="0.01" step="0.01" defaultValue={invoice.base_amount} readOnly={paymentLocked} required />
            {paymentLocked && <small className="fee-field-hint">Locked because a payment has been recorded.</small>}
          </label>
          <label className="fee-field"><span>Period type</span><span className="fee-select-wrap"><select name="period_type" defaultValue={invoice.period_type || 'ONE_TIME'}><option value="ONE_TIME">One time</option><option value="MONTHLY">Monthly</option><option value="QUARTERLY">Quarterly</option><option value="HALF_YEARLY">Half-yearly</option><option value="YEARLY">Yearly</option></select><ChevronDown size={15} /></span></label>
          <div className="fee-schedule-section-title fee-field-wide"><ShieldCheck size={14} />Late penalty</div>
          <label className="fee-check-field fee-field-wide"><input name="late_penalty_enabled" type="checkbox" defaultChecked={Number(invoice.late_fee_amount) > 0} /><span>Enable late penalty</span></label>
          <label className="fee-field"><span>Penalty amount (INR)</span><input name="late_fee_amount" type="number" min="0" step="0.01" defaultValue={invoice.late_fee_amount || '0'} /></label>
          <label className="fee-field"><span>Penalty period</span><span className="fee-select-wrap"><select name="penalty_period" defaultValue={invoice.penalty_period || 'ONE_TIME'}><option value="ONE_TIME">One time</option><option value="PER_DAY">Per day</option><option value="PER_WEEK">Per week</option></select><ChevronDown size={15} /></span></label>
          <label className="fee-field fee-field-wide"><span>Due day of month</span><input name="due_day" type="number" min="1" max="31" defaultValue={invoice.due_day || ''} /></label>
          <div className="fee-capability-note fee-field-wide"><Info size={15} />Schedule defaults are saved for future fee assignments; this does not automatically generate recurring invoices.</div>
          {!invoice.fee_structure_id && <div className="fee-capability-note fee-field-wide"><Info size={15} />This invoice is not linked to a reusable fee structure. Save as Default is unavailable.</div>}
          {error && <div className="fee-inline-error fee-field-wide" role="alert"><CircleAlert size={15} />{error}</div>}
          <div className="fee-dialog-actions fee-field-wide">
            <button type="button" className="fee-secondary-button" onClick={onClose}>Cancel</button>
            {invoice.fee_structure_id && <button type="button" className="fee-secondary-button" disabled={saving} onClick={(event) => save(event, true)}><Save size={14} />Save as Default</button>}
            <button type="submit" className="fee-primary-button" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

function ClassFeeStructurePage({
  token,
  stats,
  statsLoading,
  statsError,
  onRefreshStats,
  onBack,
  onNotify,
  feeTypes = [],
}) {
  const structures = useFeeArray(adminEndpoints.feeClassStructures, token);
  const legacyStructures = useFeeArray(adminEndpoints.feeStructures, token);

  const [customClasses, setCustomClasses] = useState(getStoredCustomClasses);
  const [selectedGroup, setSelectedGroup] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [addClassOpen, setAddClassOpen] = useState(false);
  const [editingCustomClass, setEditingCustomClass] = useState(null);
  const [assignModalData, setAssignModalData] = useState(null);
  const [editCategoryData, setEditCategoryData] = useState(null);
  const [viewDetailsData, setViewDetailsData] = useState(null);
  const [legacyDialog, setLegacyDialog] = useState(null);

  const structureByKey = useMemo(() => {
    const map = new Map();
    (structures.data || []).forEach((s) => map.set(classKey(s.class_grade, s.section), s));
    return map;
  }, [structures.data]);

  // Combine classes: 1. Student records in DB, 2. Backend structures in DB, 3. Admin custom classes
  const classList = useMemo(() => {
    const entries = new Map();

    (Array.isArray(stats?.class_breakdown) ? stats.class_breakdown : []).forEach((c) => {
      const grade = String(c.class_grade || '').trim();
      const section = String(c.section || '').trim();
      if (!grade) return;
      const key = classKey(grade, section);
      entries.set(key, {
        class_grade: grade,
        section,
        students: Number(c.count ?? 0),
        group: inferClassGroup(grade),
        source: 'database',
      });
    });

    (structures.data || []).forEach((s) => {
      const grade = String(s.class_grade || '').trim();
      const section = String(s.section || '').trim();
      if (!grade) return;
      const key = classKey(grade, section);
      if (entries.has(key)) {
        const existing = entries.get(key);
        entries.set(key, { ...existing, structureId: s.id });
      } else {
        entries.set(key, {
          class_grade: grade,
          section,
          students: 0,
          group: inferClassGroup(grade),
          structureId: s.id,
          source: 'structure',
        });
      }
    });

    (customClasses || []).forEach((c) => {
      const grade = String(c.class_grade || '').trim();
      const section = String(c.section || '').trim();
      if (!grade) return;
      const key = classKey(grade, section);
      if (entries.has(key)) {
        const existing = entries.get(key);
        entries.set(key, {
          ...existing,
          group: c.group || existing.group || inferClassGroup(grade),
          isCustom: true,
        });
      } else {
        entries.set(key, {
          class_grade: grade,
          section,
          students: 0,
          group: c.group || inferClassGroup(grade),
          isCustom: true,
          source: 'custom',
        });
      }
    });

    return [...entries.values()].sort((a, b) => {
      return classKey(a.class_grade, a.section).localeCompare(classKey(b.class_grade, b.section), undefined, { numeric: true });
    });
  }, [stats?.class_breakdown, structures.data, customClasses]);

  const filteredClassList = useMemo(() => {
    return classList.filter((item) => {
      if (selectedGroup !== 'All') {
        const itemGroup = item.group || inferClassGroup(item.class_grade);
        if (itemGroup !== selectedGroup) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const title = formatClassTitle(item).toLowerCase();
        return title.includes(q) || (item.section && item.section.toLowerCase().includes(q));
      }
      return true;
    });
  }, [classList, selectedGroup, searchQuery]);

  const loadError = statsError || structures.error || legacyStructures.error;

  async function handleSaveCustomClass(classData) {
    const grade = String(classData.class_grade || '').trim();
    const section = String(classData.section || '').trim();
    const group = classData.group || 'Other Classes';
    const key = classKey(grade, section);

    const existingIndex = customClasses.findIndex((c) => classKey(c.class_grade, c.section) === key);
    let updated;
    if (existingIndex >= 0) {
      updated = [...customClasses];
      updated[existingIndex] = { class_grade: grade, section, group };
    } else {
      updated = [...customClasses, { class_grade: grade, section, group }];
    }
    setCustomClasses(updated);
    saveStoredCustomClasses(updated);

    if (token) {
      const existingStructure = structureByKey.get(key);
      if (!existingStructure) {
        try {
          await adminRequest(adminEndpoints.feeClassStructures, token, {
            method: 'POST',
            body: JSON.stringify({
              class_grade: grade,
              section,
              is_active: true,
              categories: [],
            }),
          });
          await structures.load();
        } catch (err) {
          console.warn('Backend structure auto-create:', err);
        }
      }
    }

    onNotify('success', `Class "${grade}" saved successfully.`);
  }

  async function handleDeleteCustomClass(classItem) {
    const key = classKey(classItem.class_grade, classItem.section);
    const structure = structureByKey.get(key);

    if (token && structure?.id) {
      try {
        await adminRequest(adminEndpoints.feeClassStructureDetail(structure.id), token, {
          method: 'DELETE',
        });
        await structures.load();
      } catch (err) {
        console.error('Failed to delete structure from backend:', err);
      }
    }

    const updated = customClasses.filter((c) => classKey(c.class_grade, c.section) !== key);
    setCustomClasses(updated);
    saveStoredCustomClasses(updated);

    onNotify('success', `Class "${formatClassTitle(classItem)}" removed.`);
  }

  async function handleSaveAssignFee({ classItem, structure, category }) {
    const existingCats = structure?.categories || [];
    const updatedCategories = [...existingCats, category];

    if (structure?.id) {
      await adminRequest(adminEndpoints.feeClassStructureDetail(structure.id), token, {
        method: 'PUT',
        body: JSON.stringify({
          class_grade: classItem.class_grade,
          section: classItem.section || '',
          is_active: true,
          categories: updatedCategories,
        }),
      });
    } else {
      await adminRequest(adminEndpoints.feeClassStructures, token, {
        method: 'POST',
        body: JSON.stringify({
          class_grade: classItem.class_grade,
          section: classItem.section || '',
          is_active: true,
          categories: updatedCategories,
        }),
      });
    }
    await structures.load();
    onNotify('success', `Assigned "${category.fee_type_title}" (${money(category.amount)}) to ${formatClassTitle(classItem)}.`);
  }

  async function handleSaveEditCategory({ classItem, structure, index, category }) {
    if (!structure?.id) return;
    const updatedCategories = (structure.categories || []).map((c, i) => (i === index ? category : c));

    await adminRequest(adminEndpoints.feeClassStructureDetail(structure.id), token, {
      method: 'PUT',
      body: JSON.stringify({
        class_grade: classItem.class_grade,
        section: classItem.section || '',
        is_active: true,
        categories: updatedCategories,
      }),
    });
    await structures.load();
    onNotify('success', `Updated "${category.fee_type_title}" to ${money(category.amount)}.`);
  }

  async function handleRemoveCategory(classItem, structure, category, index) {
    if (!structure?.id) return;
    const catTitle = category?.fee_type_title || 'fee category';
    if (!window.confirm(`Remove "${catTitle}" from ${formatClassTitle(classItem)}?`)) return;

    const updatedCategories = (structure.categories || []).filter((_, i) => i !== index);

    await adminRequest(adminEndpoints.feeClassStructureDetail(structure.id), token, {
      method: 'PUT',
      body: JSON.stringify({
        class_grade: classItem.class_grade,
        section: classItem.section || '',
        is_active: true,
        categories: updatedCategories,
      }),
    });
    await structures.load();
    onNotify('success', `Removed "${catTitle}" from ${formatClassTitle(classItem)}.`);
  }

  // Legacy structure functions
  async function createLegacyStructure(payload) {
    await adminRequest(adminEndpoints.feeStructures, token, { method: 'POST', body: JSON.stringify(payload) });
    onNotify('success', 'Fee structure created.');
    await legacyStructures.load();
  }

  async function assignFee(payload) {
    const result = await adminRequest(adminEndpoints.feeAssignInvoices, token, { method: 'POST', body: JSON.stringify(payload) });
    onNotify('success', result?.detail || 'Fee invoices assigned.');
    await legacyStructures.load();
  }

  if (!token) {
    return (
      <section className="fee-feature-page">
        <FeatureHeading title="Class Fee Structure" description="Review and manage the fee structure of each registered class." onBack={onBack} />
        <EmptyState title="Sign in to load fee information." message="This read-only preview does not load school records or show sample fee data." />
      </section>
    );
  }

  const pageAction = (
    <div className="fee-classes-actions">
      <button type="button" className="fee-struct-primary" onClick={() => setAddClassOpen(true)}>
        <Plus size={15} />
        <span>+ Add / Customise Class</span>
      </button>
      <button type="button" className="fee-struct-secondary" onClick={() => setLegacyDialog({ kind: 'create' })}>
        <Plus size={13} />
        <span>Add fee structure</span>
      </button>
    </div>
  );

  return (
    <section className="fee-feature-page fee-structures-page">
      <FeatureHeading
        title="Class Fee Structure"
        description="Review and manage the fee structure of each registered class."
        onBack={onBack}
        action={pageAction}
      />

      <div className="fee-classes-bar">
        <div className="fee-classes-bar-left">
          <span className="fee-total-classes-badge">
            <Check size={14} strokeWidth={2.5} />
            <span>Total classes selected: <strong>{classList.length}</strong></span>
          </span>

          <div className="fee-group-chips">
            {['All', ...CLASS_GROUPS].map((g) => (
              <button
                type="button"
                key={g}
                className={`fee-group-chip ${selectedGroup === g ? 'is-active' : ''}`}
                onClick={() => setSelectedGroup(g)}
              >
                {g === 'All' ? 'All Classes' : g.replace(/\s*\(Classes.*?\)/, '')}
              </button>
            ))}
          </div>
        </div>

        <div className="fee-classes-bar-right">
          <div className="fee-class-search-box">
            <Search size={14} />
            <input
              type="text"
              placeholder="Search classes…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery('')} aria-label="Clear search">
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      {statsLoading || structures.loading || legacyStructures.loading ? (
        <LoadingState rows={6} />
      ) : loadError ? (
        <ErrorState
          error={loadError}
          onRetry={() => {
            if (statsError) onRefreshStats();
            if (structures.error) structures.load();
            if (legacyStructures.error) legacyStructures.load();
          }}
        />
      ) : !classList.length ? (
        <EmptyState
          icon={Users}
          title="No classes registered yet"
          message="No registered classes found in the institution database. Click below to add your first class."
          action={
            <button type="button" className="fee-struct-primary" onClick={() => setAddClassOpen(true)}>
              <Plus size={14} />
              <span>Add / Customise Class</span>
            </button>
          }
        />
      ) : !filteredClassList.length ? (
        <div className="fee-empty fee-field-wide">
          <span><Filter size={20} /></span>
          <strong>No classes match the selected filter.</strong>
          <p>Try switching to "All Classes" or clear your search query.</p>
        </div>
      ) : (
        <div className="fee-struct-grid">
          {filteredClassList.map((classItem) => {
            const key = classKey(classItem.class_grade, classItem.section);
            const struct = structureByKey.get(key);
            return (
              <ClassFeeStructureCard
                key={key}
                classItem={classItem}
                structure={struct}
                feeTypes={feeTypes}
                onAssignFee={(c, s) => setAssignModalData({ classItem: c, structure: s })}
                onEditCategory={(c, s, cat, idx) => setEditCategoryData({ classItem: c, structure: s, category: cat, index: idx })}
                onViewDetails={(c, s, cat) => setViewDetailsData({ classItem: c, structure: s, category: cat })}
                onRemoveCategory={(c, s, cat, idx) => handleRemoveCategory(c, s, cat, idx)}
                onCustomiseClass={(c) => setEditingCustomClass(c)}
              />
            );
          })}
        </div>
      )}

      {/* Add / Customise Class Modal */}
      <AddCustomClassModal
        isOpen={addClassOpen || Boolean(editingCustomClass)}
        editingItem={editingCustomClass}
        onClose={() => {
          setAddClassOpen(false);
          setEditingCustomClass(null);
        }}
        onSave={handleSaveCustomClass}
        onDelete={handleDeleteCustomClass}
      />

      {/* Assign Fee Modal */}
      <AssignFeeCategoryModal
        isOpen={Boolean(assignModalData)}
        classItem={assignModalData?.classItem}
        structure={assignModalData?.structure}
        feeTypes={feeTypes}
        onClose={() => setAssignModalData(null)}
        onSave={handleSaveAssignFee}
      />

      {/* Edit Category Modal */}
      <EditCategoryModal
        isOpen={Boolean(editCategoryData)}
        categoryData={editCategoryData}
        feeTypes={feeTypes}
        onClose={() => setEditCategoryData(null)}
        onSave={handleSaveEditCategory}
        onRemove={handleRemoveCategory}
      />

      {/* View Fee Details Modal */}
      <ClassFeeDetailsModal
        details={viewDetailsData}
        feeTypes={feeTypes}
        onClose={() => setViewDetailsData(null)}
      />

      {/* Legacy modals */}
      {legacyDialog?.kind === 'assign' && (
        <AssignFeeForm
          classItem={legacyDialog.classItem}
          structures={legacyStructures.data}
          onCancel={() => setLegacyDialog(null)}
          onAssign={assignFee}
        />
      )}
      {legacyDialog?.kind === 'create' && (
        <FeeStructureForm
          classItem={null}
          feeTypes={feeTypes}
          onCancel={() => setLegacyDialog(null)}
          onSave={createLegacyStructure}
        />
      )}
    </section>
  );
}

function FeeStructureForm({ classItem, onCancel, onSave, feeTypes = [] }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      title: String(data.get('title') || '').trim(),
      description: String(data.get('description') || '').trim(),
      class_grade: String(data.get('class_grade') || '').trim(),
      amount: String(data.get('amount') || ''),
      late_fee: String(data.get('late_fee') || '0'),
      due_date: String(data.get('due_date') || ''),
      academic_year: String(data.get('academic_year') || '').trim(),
      is_active: data.get('is_active') === 'on',
    };
    if (!window.confirm(`Create the fee structure "${payload.title}"?`)) return;
    setSaving(true);
    setError('');
    try {
      await onSave(payload);
    } catch (saveError) {
      setError(messageFrom(saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog title="Add fee structure" onClose={onCancel}>
      <form className="fee-form-grid" onSubmit={submit}>
        <label className="fee-field">
          <span>Fee type / structure name</span>
          <input
            name="title"
            required
            maxLength={150}
            list="fee-structure-types-list"
            placeholder="Select or enter fee name"
          />
          <datalist id="fee-structure-types-list">
            {feeTypes.map((ft) => (
              <option key={ft.id} value={ft.title}>
                {ft.title} ({ft.status})
              </option>
            ))}
          </datalist>
        </label>
        <label className="fee-field"><span>Class</span><input name="class_grade" defaultValue={classItem?.class_grade || ''} maxLength={20} placeholder="Blank applies to all classes" /></label>
        <label className="fee-field"><span>Amount (INR)</span><input name="amount" type="number" min="0.01" step="0.01" required /></label>
        <label className="fee-field"><span>Late fee (INR)</span><input name="late_fee" type="number" min="0" step="0.01" defaultValue="0" /></label>
        <label className="fee-field"><span>Academic year</span><input name="academic_year" maxLength={20} required /></label>
        <label className="fee-field"><span>Due date</span><input name="due_date" type="date" required /></label>
        <FrequencyOptions />
        <label className="fee-field fee-field-wide"><span>Description</span><textarea name="description" rows="2" maxLength={2000} /></label>
        <label className="fee-check-field"><input name="is_active" type="checkbox" defaultChecked /><span>Active</span></label>
        {error && <div className="fee-inline-error fee-field-wide" role="alert"><CircleAlert size={15} />{error}</div>}
        <div className="fee-dialog-actions fee-field-wide">
          <button type="button" className="fee-secondary-button" onClick={onCancel}>Cancel</button>
          <button type="submit" className="fee-primary-button" disabled={saving}>{saving ? 'Saving…' : 'Create structure'}</button>
        </div>
      </form>
    </Dialog>
  );
}

function AssignFeeForm({ classItem, structures, onCancel, onAssign }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const grade = String(classItem?.class_grade || '').trim();
  const available = structures.filter((structure) => (
    structure.is_active !== false
    && (!String(structure.class_grade || '').trim() || String(structure.class_grade).trim() === grade)
  ));

  async function submit(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const structureId = String(data.get('fee_structure_id') || '');
    if (!structureId) {
      setError('Select a fee structure to assign.');
      return;
    }
    if (!window.confirm(`Assign this fee structure to ${grade ? `Class ${grade}` : 'the selected class'}${classItem?.section ? `, Section ${classItem.section}` : ''}?`)) return;

    setSaving(true);
    setError('');
    try {
      await onAssign({
        fee_structure_id: Number(structureId),
        class_grade: grade,
        section: classItem?.section || '',
        student_ids: [],
        discount_amount: String(data.get('discount_amount') || '0'),
      });
    } catch (assignError) {
      setError(messageFrom(assignError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog title="Assign fee to class" onClose={onCancel}>
      <form className="fee-form-grid" onSubmit={submit}>
        <div className="fee-selected-class fee-field-wide">
          <GraduationCap size={17} />
          <span>{grade ? `Class ${grade}` : 'Class not specified'}{classItem?.section ? ` · Section ${classItem.section}` : ''}</span>
        </div>
        {!available.length ? (
          <div className="fee-empty fee-field-wide">
            <span><WalletCards size={20} /></span>
            <strong>No applicable fee structures available.</strong>
            <p>Create a fee structure before assigning one to this class.</p>
          </div>
        ) : (
          <>
            <label className="fee-field fee-field-wide"><span>Fee structure</span><span className="fee-select-wrap"><select name="fee_structure_id" required defaultValue=""><option value="" disabled>Select a structure</option>{available.map((structure) => <option value={structure.id} key={structure.id}>{structure.title} · {money(structure.amount)}</option>)}</select><ChevronDown size={15} /></span></label>
            <label className="fee-field"><span>Discount per invoice (INR) <small>Optional</small></span><input name="discount_amount" type="number" min="0" step="0.01" defaultValue="0" /></label>
          </>
        )}
        {error && <div className="fee-inline-error fee-field-wide" role="alert"><CircleAlert size={15} />{error}</div>}
        <div className="fee-dialog-actions fee-field-wide">
          <button type="button" className="fee-secondary-button" onClick={onCancel}>Cancel</button>
          {available.length > 0 && <button type="submit" className="fee-primary-button" disabled={saving}>{saving ? 'Assigning…' : 'Assign fee'}</button>}
        </div>
      </form>
    </Dialog>
  );
}

function FeeCollectorPreviewPage({ onBack }) {
  const [showSchedule, setShowSchedule] = useState(false);
  return (
    <section className="fee-feature-page">
      <FeatureHeading
        title="Fee Collector"
        description="Collect fees using the school's actual student invoices."
        onBack={onBack}
        action={<button type="button" className="fee-secondary-button" onClick={() => setShowSchedule(true)}><CalendarDays size={14} />Fee schedule</button>}
      />
      <EmptyState icon={ReceiptText} title="No fee records available in this preview." message="Sign in to load real student invoices. This preview does not use sample students or payment data." />
      {showSchedule && <FeeScheduleDialog onClose={() => setShowSchedule(false)} />}
    </section>
  );
}

function PayAllDialog({ student, onClose, onPay }) {
  const outstandingInvoices = student.invoices.filter((invoice) => Number(invoice.balance_due) > 0);
  const totalOutstanding = outstandingInvoices.reduce((total, invoice) => total + Number(invoice.balance_due), 0);

  return (
    <Dialog title={`Outstanding fees · ${student.invoices[0]?.student_name || student.studentId}`} onClose={onClose}>
      <div className="fee-pay-all-dialog">
        <div className="fee-pay-all-summary"><span>{outstandingInvoices.length} unpaid invoices</span><strong>{money(totalOutstanding)} due</strong></div>
        {!outstandingInvoices.length ? (
          <EmptyState title="No outstanding fees." message="All invoices for this student are paid." />
        ) : outstandingInvoices.map((invoice) => (
          <article className="fee-pay-all-row" key={invoice.id}>
            <div><strong>{invoice.title}</strong><small>{invoice.invoice_number} · Due {dateLabel(invoice.due_date)}</small></div>
            <strong>{money(invoice.balance_due)}</strong>
            <button type="button" className="fee-primary-button" onClick={() => onPay(invoice)}><CreditCard size={13} />Collect</button>
          </article>
        ))}
        <p className="fee-capability-note"><Info size={15} />Each invoice is recorded separately so every payment retains its own receipt and history.</p>
      </div>
    </Dialog>
  );
}

function AssignStudentFeeDialog({
  student,
  structures,
  structuresLoading,
  structuresError,
  onRetryStructures,
  onClose,
  onAssign,
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const firstInvoice = student.invoices[0];
  const available = structures.filter((structure) => (
    structure.is_active !== false
    && (!String(structure.class_grade || '').trim()
      || String(structure.class_grade).trim() === String(firstInvoice.class_grade || '').trim())
  ));

  async function submit(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const structureId = Number(formData.get('fee_structure_id'));
    if (!structureId) {
      setError('Select a fee structure to assign.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onAssign({
        fee_structure_id: structureId,
        class_grade: firstInvoice.class_grade || '',
        section: firstInvoice.section || '',
        student_ids: [student.studentId],
        discount_amount: String(formData.get('discount_amount') || '0'),
      });
      onClose();
    } catch (assignError) {
      setError(messageFrom(assignError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog title={`Assign fee · ${firstInvoice.student_name || student.studentId}`} onClose={onClose}>
      <form className="fee-form-grid" onSubmit={submit}>
        <p className="fee-selected-class fee-field-wide">{firstInvoice.student_id} · Class {firstInvoice.class_grade || '—'}{firstInvoice.section ? ` · Section ${firstInvoice.section}` : ''}</p>
        {structuresLoading ? <LoadingState rows={2} /> : structuresError ? (
          <ErrorState error={structuresError} onRetry={onRetryStructures} />
        ) : !available.length ? (
          <EmptyState icon={WalletCards} title="No applicable fee structures." message="Create an active fee structure for this class before assigning it." />
        ) : (
          <>
            <label className="fee-field fee-field-wide"><span>Fee structure</span><span className="fee-select-wrap"><select name="fee_structure_id" required defaultValue=""><option value="" disabled>Select a structure</option>{available.map((structure) => <option value={structure.id} key={structure.id}>{structure.title} · {money(structure.amount)}</option>)}</select><ChevronDown size={15} /></span></label>
            <label className="fee-field"><span>Discount (INR) <small>Optional</small></span><input name="discount_amount" type="number" min="0" step="0.01" defaultValue="0" /></label>
          </>
        )}
        {error && <div className="fee-inline-error fee-field-wide" role="alert"><CircleAlert size={15} />{error}</div>}
        <div className="fee-dialog-actions fee-field-wide">
          <button type="button" className="fee-secondary-button" onClick={onClose}>Cancel</button>
          {available.length > 0 && !structuresLoading && !structuresError && <button type="submit" className="fee-primary-button" disabled={saving}>{saving ? 'Assigning…' : 'Assign fee'}</button>}
        </div>
      </form>
    </Dialog>
  );
}

function StudentFeeCard({ student, onHistory, onSchedule, onPayAll, onAssign }) {
  const firstInvoice = student.invoices[0];
  const billed = student.invoices.reduce((total, invoice) => total + Number(invoice.total_amount || 0), 0);
  const outstanding = student.invoices.reduce((total, invoice) => total + Number(invoice.balance_due || 0), 0);
  const paidPercent = billed > 0 ? Math.round(((billed - outstanding) / billed) * 100) : 0;
  const identityDetails = [
    firstInvoice.student_id,
    firstInvoice.admission_number ? `Adm. ${firstInvoice.admission_number}` : '',
    `Class ${firstInvoice.class_grade || '—'}${firstInvoice.section ? ` · ${firstInvoice.section}` : ''}`,
    firstInvoice.roll_number ? `Roll ${firstInvoice.roll_number}` : '',
    firstInvoice.father_name ? `F: ${firstInvoice.father_name}` : '',
    firstInvoice.registered_phone || '',
  ].filter(Boolean);

  return (
    <article className="fee-student-card">
      <header className="fee-student-card-head">
        <span className="fee-student-avatar">{(firstInvoice.student_name || firstInvoice.student_id || '?').slice(0, 1).toUpperCase()}</span>
        <div>
          <h3>{firstInvoice.student_name || 'Name not provided'}</h3>
          <p>{identityDetails.join(' · ')}</p>
        </div>
        <span className="fee-student-paid-percent">{paidPercent}% paid</span>
      </header>
      <div className="fee-student-invoice-grid">
        {student.invoices.map((invoice) => {
          const total = Number(invoice.total_amount || 0);
          const paid = Number(invoice.amount_paid || 0);
          const progress = total > 0 ? Math.min(100, (paid / total) * 100) : 0;
          return (
            <article className="fee-student-invoice" key={invoice.id}>
              <div className="fee-student-invoice-title">
                <strong>{invoice.title}</strong>
                <span className={`fee-status fee-status-${String(invoiceStatus(invoice) || '').toLowerCase()}`}>{statusLabel(invoiceStatus(invoice))}</span>
              </div>
              <div className="fee-progress-track" aria-label={`${Math.round(progress)}% paid`}><span style={{ width: `${progress}%` }} /></div>
              <div className="fee-student-invoice-balance">
                <span>{money(invoice.balance_due)} remaining</span>
                <small>Due {dateLabel(invoice.due_date)}</small>
              </div>
              <div className="fee-student-invoice-actions">
                <button type="button" className="fee-secondary-button" onClick={() => onSchedule(invoice)}><Pencil size={13} />Edit</button>
              </div>
            </article>
          );
        })}
      </div>
      <footer className="fee-student-card-footer">
        <div><span>{student.invoices.length} fee {student.invoices.length === 1 ? 'record' : 'records'}</span><strong>{money(outstanding)} remaining</strong></div>
        <div className="fee-student-card-actions">
          <button type="button" className="fee-secondary-button" onClick={() => onHistory(student)}><History size={13} />History</button>
          <button type="button" className="fee-primary-button" onClick={() => onPayAll(student)} disabled={outstanding <= 0}><CreditCard size={13} />Pay All</button>
          <button type="button" className="fee-secondary-button" onClick={() => onAssign(student)}><Plus size={13} />Assign</button>
        </div>
      </footer>
    </article>
  );
}

function FeeCollectorPage({ token, stats, onBack, onNotify }) {
  const [nameSearch, setNameSearch] = useState('');
  const [studentIdSearch, setStudentIdSearch] = useState('');
  const [phoneSearch, setPhoneSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [appliedNameSearch, setAppliedNameSearch] = useState('');
  const [appliedStudentIdSearch, setAppliedStudentIdSearch] = useState('');
  const [appliedPhoneSearch, setAppliedPhoneSearch] = useState('');
  const [appliedClassFilter, setAppliedClassFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState('');
  const [amount, setAmount] = useState('');
  const [amountInvoiceId, setAmountInvoiceId] = useState('');
  const [method, setMethod] = useState('CASH');
  const [reference, setReference] = useState('');
  const [collecting, setCollecting] = useState(false);
  const [receiptLoading, setReceiptLoading] = useState('');
  const [detailMode, setDetailMode] = useState(null);
  const [historyStudentId, setHistoryStudentId] = useState('');
  const [scheduleInvoice, setScheduleInvoice] = useState(null);
  const [payAllStudent, setPayAllStudent] = useState(null);
  const [assignStudent, setAssignStudent] = useState(null);
  const invoicePath = useMemo(() => {
    const params = new URLSearchParams();
    if (appliedNameSearch.trim()) params.set('full_name', appliedNameSearch.trim());
    if (appliedStudentIdSearch.trim()) params.set('student_id', appliedStudentIdSearch.trim());
    if (appliedPhoneSearch.trim()) params.set('phone', appliedPhoneSearch.trim());
    if (appliedClassFilter !== 'all') params.set('class_grade', appliedClassFilter);
    params.set('page', String(page));
    params.set('page_size', '20');
    const query = params.toString();
    return `${adminEndpoints.feeInvoices}?${query}`;
  }, [appliedClassFilter, appliedNameSearch, appliedPhoneSearch, appliedStudentIdSearch, page]);
  const invoices = useFeeArray(invoicePath, token);
  const transactionPath = historyStudentId
    ? `${adminEndpoints.feeTransactions}?student_id=${encodeURIComponent(historyStudentId)}`
    : `${adminEndpoints.feeTransactions}?student_id=__none__`;
  const transactions = useFeeArray(transactionPath, token);
  const structures = useFeeArray(adminEndpoints.feeStructures, token);
  const summary = useFeeSummary(token);

  const classGrades = useMemo(() => [...new Set(
    (Array.isArray(stats?.class_breakdown) ? stats.class_breakdown : [])
      .map((item) => String(item.class_grade || '').trim())
      .filter(Boolean),
  )].sort(), [stats]);
  const studentGroups = useMemo(() => {
    const groups = new Map();
    invoices.data.forEach((invoice) => {
      const key = String(invoice.student_id || invoice.id);
      if (!groups.has(key)) groups.set(key, { studentId: key, invoices: [] });
      groups.get(key).invoices.push(invoice);
    });
    return [...groups.values()];
  }, [invoices.data]);
  const selectedInvoiceId = invoices.data.some((invoice) => String(invoice.id) === selectedId)
    ? selectedId
    : String(invoices.data[0]?.id || '');
  const selectedInvoice = invoices.data.find((invoice) => String(invoice.id) === selectedInvoiceId);
  const payableAmount = amountInvoiceId === selectedInvoiceId
    ? amount
    : selectedInvoice ? String(selectedInvoice.balance_due) : '';
  const selectedTransactions = transactions.data
    .filter((transaction) => transaction.student_id === historyStudentId)
    .sort((first, second) => String(second.paid_at || second.created_at).localeCompare(String(first.paid_at || first.created_at)));
  const pageCount = Math.max(1, Math.ceil(invoices.count / 20));
  const firstShown = invoices.count ? ((page - 1) * 20) + 1 : 0;
  const lastShown = Math.min(page * 20, invoices.count);

  async function loadFilteredInvoicesForExport() {
    const params = new URLSearchParams();
    if (appliedNameSearch.trim()) params.set('full_name', appliedNameSearch.trim());
    if (appliedStudentIdSearch.trim()) params.set('student_id', appliedStudentIdSearch.trim());
    if (appliedPhoneSearch.trim()) params.set('phone', appliedPhoneSearch.trim());
    if (appliedClassFilter !== 'all') params.set('class_grade', appliedClassFilter);
    params.set('page_size', '50');

    let pageNumber = 1;
    let studentCount = 0;
    const allInvoices = [];
    do {
      params.set('page', String(pageNumber));
      const response = await adminRequest(`${adminEndpoints.feeInvoices}?${params}`, token);
      if (!Number.isInteger(response?.count) || !Array.isArray(response.results)) {
        throw new Error('The server returned an invalid fee export response.');
      }
      if (pageNumber === 1) studentCount = response.count;
      if (response.results.length === 0 && (pageNumber - 1) * 50 < studentCount) {
        throw new Error('Fee records could not be fully loaded for export.');
      }
      allInvoices.push(...response.results);
      pageNumber += 1;
    } while ((pageNumber - 1) * 50 < studentCount);

    return allInvoices.map((invoice) => ({
      student_name: invoice.student_name,
      student_id: invoice.student_id,
      admission_number: invoice.admission_number,
      phone: invoice.registered_phone,
      class: invoice.class_grade,
      section: invoice.section,
      fee: invoice.title,
      invoice_number: invoice.invoice_number,
      base_amount: invoice.base_amount,
      discount: invoice.discount_amount,
      late_fee: invoice.late_fee_amount,
      total_amount: invoice.total_amount,
      amount_paid: invoice.amount_paid,
      balance_due: invoice.balance_due,
      due_date: invoice.due_date,
      status: statusLabel(invoiceStatus(invoice)),
    }));
  }

  async function collect(event) {
    event.preventDefault();
    const numericAmount = Number(payableAmount);
    if (!selectedInvoice || !Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > Number(selectedInvoice.balance_due)) {
      onNotify('error', 'Enter a payment amount within the remaining invoice balance.');
      return;
    }
    if (!window.confirm(`Record ${money(numericAmount)} for ${selectedInvoice.student_name || selectedInvoice.student_id}?`)) return;

    setCollecting(true);
    try {
      const result = await adminRequest(adminEndpoints.feeCollectOffline, token, {
        method: 'POST',
        body: JSON.stringify({
          invoice_id: Number(selectedInvoice.id),
          amount: numericAmount.toFixed(2),
          payment_mode: method,
          utr_number: reference.trim(),
        }),
      });
      onNotify('success', result?.detail || 'Payment recorded.');
      setReference('');
      setAmount('');
      setAmountInvoiceId('');
      await Promise.all([invoices.load(), transactions.load(), summary.load()]);
    } catch (error) {
      onNotify('error', messageFrom(error));
    } finally {
      setCollecting(false);
    }
  }

  async function downloadReceipt(receiptNumber) {
    setReceiptLoading(receiptNumber);
    try {
      await downloadAdminFeeReceipt(receiptNumber, token);
    } catch (error) {
      onNotify('error', messageFrom(error));
    } finally {
      setReceiptLoading('');
    }
  }

  function applySearch(event) {
    event.preventDefault();
    setAppliedNameSearch(nameSearch.trim());
    setAppliedStudentIdSearch(studentIdSearch.trim());
    setAppliedPhoneSearch(phoneSearch.trim());
    setAppliedClassFilter(classFilter);
    setPage(1);
    closeDetails();
  }

  function closeDetails() {
    setDetailMode(null);
    setHistoryStudentId('');
  }

  function showInvoice(invoice, mode) {
    setSelectedId(String(invoice.id));
    setHistoryStudentId(String(invoice.student_id || ''));
    setDetailMode(mode);
    setAmountInvoiceId('');
    setAmount('');
  }

  function showStudentHistory(student) {
    setSelectedId(String(student.invoices[0]?.id || ''));
    setHistoryStudentId(student.studentId);
    setDetailMode('history');
  }

  async function assignFeeToStudent(payload) {
    const result = await adminRequest(adminEndpoints.feeAssignInvoices, token, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!result?.invoices_created) {
      throw new Error(result?.detail || 'This fee structure is already assigned to the student.');
    }
    onNotify('success', result.detail || 'Fee assigned to the student.');
    await Promise.all([invoices.load(), summary.load()]);
  }

  async function refreshEditedInvoice() {
    await Promise.all([invoices.load(), summary.load()]);
  }

  return (
    <section className="fee-feature-page">
      <FeatureHeading
        title="Fee Collector"
        description="Search student fee records, edit individual schedules, collect payments, and review complete payment history."
        onBack={onBack}
      />
      <div className="fee-collector-summary-grid">
        {summary.loading ? <LoadingState rows={3} /> : summary.error ? (
          <ErrorState error={summary.error} onRetry={() => summary.load()} />
        ) : [
          { label: 'Total fees amount', amount: summary.data?.total_billed, icon: WalletCards, tone: 'billed' },
          { label: 'Total collection', amount: summary.data?.total_collected, icon: Check, tone: 'collected' },
          { label: 'Remaining due', amount: summary.data?.total_pending, icon: CircleAlert, tone: 'remaining' },
        ].map(({ label, amount: total, icon: Icon, tone }) => (
          <article className={`fee-collector-summary-card is-${tone}`} key={label}>
            <span className="fee-summary-icon"><Icon size={16} /></span>
            <div><span>{label}</span><strong>{money(total)}</strong><small>School-wide summary</small></div>
          </article>
        ))}
      </div>
      <div className="fee-collector-stack">
        <section className="fee-collector-search">
          <div className="fee-collector-search-head"><div><h3>Student fee records</h3><p>Search by student name, admission number, phone, or class.</p></div><span>{invoices.loading ? '…' : invoices.count}</span></div>
          <form className="fee-collector-top-filters" onSubmit={applySearch}>
            <label className="fee-field"><span>Full name</span><input value={nameSearch} onChange={(event) => setNameSearch(event.target.value)} placeholder="Search student name" /></label>
            <label className="fee-field"><span>Username / Adm. No.</span><input value={studentIdSearch} onChange={(event) => setStudentIdSearch(event.target.value)} placeholder="Student ID or admission no." /></label>
            <label className="fee-field"><span>Phone</span><input value={phoneSearch} onChange={(event) => setPhoneSearch(event.target.value)} placeholder="Registered phone" inputMode="tel" /></label>
            <label className="fee-field"><span>Class</span><span className="fee-select-wrap"><select value={classFilter} onChange={(event) => setClassFilter(event.target.value)}><option value="all">All classes</option>{classGrades.map((grade) => <option value={grade} key={grade}>{grade}</option>)}</select><ChevronDown size={15} /></span></label>
            <div className="fee-collector-filter-actions">
              <button type="submit" className="fee-primary-button"><Search size={14} />Search</button>
              <button type="button" className="fee-secondary-button" onClick={() => { setNameSearch(''); setStudentIdSearch(''); setPhoneSearch(''); setClassFilter('all'); setAppliedNameSearch(''); setAppliedStudentIdSearch(''); setAppliedPhoneSearch(''); setAppliedClassFilter('all'); setPage(1); closeDetails(); }}>Reset</button>
            </div>
          </form>
          <div className="fee-collector-results-heading">
            <p>Showing {firstShown}–{lastShown} of {invoices.count} students</p>
            <ExportMenu rows={loadFilteredInvoicesForExport} title="Fee collector records" fileName="fee-collector-records" disabled={!invoices.count || invoices.loading} />
          </div>
          <div className="fee-invoice-list fee-student-list" aria-live="polite">
            {invoices.loading ? <LoadingState rows={4} /> : invoices.error ? <ErrorState error={invoices.error} onRetry={() => invoices.load()} /> : !invoices.data.length ? (
              appliedNameSearch || appliedStudentIdSearch || appliedPhoneSearch || appliedClassFilter !== 'all'
                ? <EmptyState title="No matching student fee records." message="Try a different search or class." />
                : <EmptyState title="No fee records available yet." message="Student invoices will appear here when the fee service returns records." />
            ) : studentGroups.map((student) => (
              <StudentFeeCard
                student={student}
                key={student.studentId}
                onHistory={showStudentHistory}
                onSchedule={setScheduleInvoice}
                onPayAll={setPayAllStudent}
                onAssign={setAssignStudent}
              />
            ))}
          </div>
          {pageCount > 1 && <nav className="fee-pagination" aria-label="Student fee record pages">
            <button type="button" className="fee-secondary-button" disabled={page <= 1 || invoices.loading} onClick={() => { setPage((current) => current - 1); closeDetails(); }}><ChevronRight size={14} className="fee-pagination-prev" />Previous</button>
            <span>Page {page} of {pageCount}</span>
            <button type="button" className="fee-secondary-button" disabled={page >= pageCount || invoices.loading} onClick={() => { setPage((current) => current + 1); closeDetails(); }}>Next<ChevronRight size={14} /></button>
          </nav>}
        </section>

        {detailMode && selectedInvoice && <section className="fee-collector-detail">
          <>
              <div className="fee-collector-detail-head">
                <h2>{detailMode === 'pay' ? 'Collect fee' : 'Complete student payment history'}</h2>
                <button type="button" className="fee-close-button" aria-label="Close invoice details" onClick={closeDetails}>×</button>
              </div>
              <div className="fee-student-heading">
                <span className="fee-student-avatar">{(selectedInvoice.student_name || selectedInvoice.student_id || '?').slice(0, 1).toUpperCase()}</span>
                <div><span className="fee-eyebrow">STUDENT</span><h3>{selectedInvoice.student_name || 'Name not provided'}</h3><p>{selectedInvoice.student_id} · Class {selectedInvoice.class_grade || '—'}{selectedInvoice.section ? ` · Section ${selectedInvoice.section}` : ''} · {selectedInvoice.registered_phone || 'Phone not provided'}</p></div>
                {detailMode === 'pay' && <span className={`fee-status fee-status-${String(invoiceStatus(selectedInvoice) || '').toLowerCase()}`}>{statusLabel(invoiceStatus(selectedInvoice))}</span>}
              </div>
              {detailMode === 'pay' && <div className="fee-invoice-summary-card">
                <div className="fee-invoice-title"><span><WalletCards size={17} /></span><div><strong>{selectedInvoice.title}</strong><small>{selectedInvoice.invoice_number} · Due {dateLabel(selectedInvoice.due_date)}</small></div></div>
                <div className="fee-amount-grid">
                  <div><span>Total fee</span><strong>{money(selectedInvoice.total_amount)}</strong></div>
                  <div><span>Previously paid</span><strong>{money(selectedInvoice.amount_paid)}</strong></div>
                  <div className="is-outstanding"><span>Remaining balance</span><strong>{money(selectedInvoice.balance_due)}</strong></div>
                </div>
                <div className="fee-breakdown-list">
                  <div><span>Base amount</span><span>{money(selectedInvoice.base_amount)}</span></div>
                  <div><span>Discount</span><span>− {money(selectedInvoice.discount_amount)}</span></div>
                  <div><span>Late fee</span><span>{money(selectedInvoice.late_fee_amount)}</span></div>
                </div>
              </div>}
              {detailMode === 'pay' && Number(selectedInvoice.balance_due) > 0 ? (
                <form className="fee-collect-form" onSubmit={collect}>
                  <h3>Record payment</h3>
                  <div className="fee-form-grid">
                    <label className="fee-field"><span>Payment amount (INR)</span><input type="number" min="0.01" max={selectedInvoice.balance_due} step="0.01" required value={payableAmount} onChange={(event) => { setAmountInvoiceId(selectedInvoiceId); setAmount(event.target.value); }} /></label>
                    <label className="fee-field"><span>Payment method</span><span className="fee-select-wrap"><select value={method} onChange={(event) => setMethod(event.target.value)}>{collectionMethods.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><ChevronDown size={15} /></span></label>
                    <label className="fee-field"><span>Transaction reference <small>Optional</small></span><input value={reference} onChange={(event) => setReference(event.target.value)} maxLength={50} /></label>
                    <div className="fee-field fee-payment-date"><span>Payment date</span><strong><CalendarDays size={14} />Set by the server when payment is recorded</strong></div>
                  </div>
                  <div className="fee-collect-footer"><span><ShieldCheck size={14} />Successful collections receive a server-generated receipt.</span><button type="submit" className="fee-primary-button" disabled={collecting}>{collecting ? <><RefreshCw size={14} className="fee-spin" />Recording…</> : <><Check size={14} />Record payment</>}</button></div>
                </form>
              ) : detailMode === 'pay' ? <div className="fee-capability-note"><Check size={15} />There is no outstanding balance on this invoice.</div> : null}
              <div className="fee-payment-history">
                <div className="fee-history-heading"><h3>Payment history</h3><span>{transactions.loading ? '…' : selectedTransactions.length}</span></div>
                {transactions.loading ? <LoadingState rows={2} /> : transactions.error ? <ErrorState error={transactions.error} onRetry={() => transactions.load()} /> : !selectedTransactions.length ? <p className="fee-history-empty">No payment transactions are available for this student.</p> : selectedTransactions.map((transaction) => (
                  <article className="fee-history-row" key={transaction.id}>
                    <span className="fee-history-icon"><CreditCard size={15} /></span>
                    <div><strong>{money(transaction.amount)} · {paymentMethodLabel(transaction.payment_mode)}</strong><small>{paymentHistoryMetadata(transaction)}</small></div>
                    <span className={`fee-status fee-status-${String(transaction.status || '').toLowerCase()}`}>{statusLabel(transaction.status)}</span>
                    {transaction.receipt_number && transaction.status === 'SUCCESS' && <button type="button" className="fee-link-button" disabled={receiptLoading === transaction.receipt_number} onClick={() => downloadReceipt(transaction.receipt_number)}>{receiptLoading === transaction.receipt_number ? 'Downloading…' : 'Receipt'}</button>}
                  </article>
                ))}
              </div>
          </>
        </section>}
      </div>
      {scheduleInvoice && <FeeScheduleDialog
        invoice={scheduleInvoice}
        token={token}
        onClose={() => setScheduleInvoice(null)}
        onSaved={refreshEditedInvoice}
        onNotify={onNotify}
      />}
      {payAllStudent && <PayAllDialog
        student={payAllStudent}
        onClose={() => setPayAllStudent(null)}
        onPay={(invoice) => { setPayAllStudent(null); showInvoice(invoice, 'pay'); }}
      />}
      {assignStudent && <AssignStudentFeeDialog
        student={assignStudent}
        structures={structures.data}
        structuresLoading={structures.loading}
        structuresError={structures.error}
        onRetryStructures={structures.load}
        onClose={() => setAssignStudent(null)}
        onAssign={assignFeeToStudent}
      />}
    </section>
  );
}

export default function FeeManagementPage({
  token,
  previewMode = false,
  stats,
  statsLoading,
  statsError,
  onRefreshStats,
}) {
  const [activeFeature, setActiveFeature] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [feeTypes, setFeeTypes] = useState(getStoredFeeTypes);
  const [openAddImmediately, setOpenAddImmediately] = useState(false);

  function notify(type, text) {
    setFeedback({ type, text });
  }

  function backToLanding() {
    setActiveFeature(null);
    setOpenAddImmediately(false);
    setFeedback(null);
  }

  const handleSaveFeeType = (item) => {
    setFeeTypes((prev) => {
      const existingIndex = prev.findIndex((f) => f.id === item.id);
      let updated;
      if (existingIndex >= 0) {
        updated = [...prev];
        updated[existingIndex] = item;
      } else {
        updated = [item, ...prev];
      }
      saveStoredFeeTypes(updated);
      return updated;
    });
    notify('success', `Fee type "${item.title}" saved successfully.`);
  };

  const activeDetails = features.find((feature) => feature.id === activeFeature);

  return (
    <section className="fee-module">
      {!activeFeature && (
        <div className="fee-module-heading">
          <div>
            <h1>Fee Management</h1>
            <p>Manage fee categories, class schedules, and student collections.</p>
          </div>
          <button
            type="button"
            className="fee-primary-button"
            onClick={() => {
              setFeedback(null);
              setOpenAddImmediately(true);
              setActiveFeature('types');
            }}
          >
            <Plus size={15} />
            Add fee type
          </button>
        </div>
      )}
      {feedback && <div className={`fee-feedback is-${feedback.type}`} role={feedback.type === 'error' ? 'alert' : 'status'}>{feedback.type === 'success' ? <Check size={15} /> : <CircleAlert size={15} />}<span>{feedback.text}</span><button type="button" aria-label="Dismiss notification" onClick={() => setFeedback(null)}>×</button></div>}
      {!activeFeature ? (
        <LandingPage
          onNavigate={(feature) => {
            setFeedback(null);
            setOpenAddImmediately(false);
            setActiveFeature(feature);
          }}
        />
      ) : activeFeature === 'types' ? (
        <FeeTypePage
          onBack={backToLanding}
          feeTypes={feeTypes}
          onSaveFeeType={handleSaveFeeType}
          initialOpenAdd={openAddImmediately}
        />
      ) : previewMode && activeFeature === 'collector' ? (
        <FeeCollectorPreviewPage onBack={backToLanding} />
      ) : previewMode || !token ? (
        <section className="fee-feature-page">
          <FeatureHeading title={activeDetails?.title || 'Fee Management'} description={activeDetails?.description || ''} onBack={backToLanding} />
          <EmptyState title="Sign in to load fee information." message="This read-only preview does not load school records or show sample fee data." />
        </section>
      ) : activeFeature === 'classes' ? (
        <ClassFeeStructurePage token={token} stats={stats} statsLoading={statsLoading} statsError={statsError} onRefreshStats={onRefreshStats} onBack={backToLanding} onNotify={notify} feeTypes={feeTypes} />
      ) : (
        <FeeCollectorPage token={token} stats={stats} onBack={backToLanding} onNotify={notify} />
      )}
    </section>
  );
}
