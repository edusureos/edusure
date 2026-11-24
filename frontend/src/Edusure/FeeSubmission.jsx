import React, { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  CreditCard,
  Link2,
  QrCode,
} from 'lucide-react';
import './fee-submission.css';

const invoice = {
  title: 'Term 1 Tuition Fee',
  amount: 3500,
  id: 'EDU-2026-00142',
  dueDate: '30 June 2027',
  breakdown: [
    { label: 'Tuition fee', amount: 3000 },
    { label: 'Activity fee', amount: 300 },
    { label: 'Library fee', amount: 200 },
  ],
};

const paymentOptions = ['PhonePe', 'Google Pay', 'Paytm'];

export default function FeeSubmission({ onBack, submittedUtr, onSubmitUtr }) {
  const [utr, setUtr] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(event) {
    event.preventDefault();
    if (!/^\d{12}$/.test(utr)) {
      setError('Enter a 12-digit UTR number.');
      return;
    }

    onSubmitUtr(utr);
    setError('');
  }

  const isSubmitted = Boolean(submittedUtr);

  return (
    <main className="fee-submission-page">
      <header className="fee-submission-header">
        <button type="button" className="fee-back-button" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" />
          Back to dashboard
        </button>
        <div>
          <p className="fee-eyebrow"></p>
          <h1>Fee Management</h1>
        </div>
      </header>

      <div className="fee-submission-grid">
        <section className="fee-panel fee-invoice-panel" aria-labelledby="invoice-title">
          <div className="fee-panel-heading">
            <div className="fee-heading-icon">
              <CreditCard size={19} aria-hidden="true" />
            </div>
            <div>
              <h2 id="invoice-title">Pending invoice</h2>
              <p>Review the fee details before payment.</p>
            </div>
          </div>

          <div className="fee-invoice-summary">
            <div>
              <p className="fee-invoice-label">Invoice</p>
              <h3>{invoice.title}</h3>
            </div>
            <span className={`fee-status-badge${isSubmitted ? ' is-verifying' : ''}`}>
              {isSubmitted ? <Clock3 size={14} aria-hidden="true" /> : null}
              {isSubmitted ? 'Pending Verification' : 'Pending'}
            </span>
          </div>

          <div className="fee-invoice-meta">
            <div>
              <span>Invoice ID</span>
              <strong>{invoice.id}</strong>
            </div>
            <div>
              <span>Due date</span>
              <strong>{invoice.dueDate}</strong>
            </div>
          </div>

          <div className="fee-breakdown">
            <h4>Fee breakdown</h4>
            {invoice.breakdown.map((item) => (
              <div className="fee-breakdown-row" key={item.label}>
                <span>{item.label}</span>
                <span>₹{item.amount.toLocaleString('en-IN')}</span>
              </div>
            ))}
            <div className="fee-total-row">
              <strong>Total payable</strong>
              <strong>₹{invoice.amount.toLocaleString('en-IN')}</strong>
            </div>
          </div>

          {isSubmitted ? (
            <div className="fee-transaction" role="status">
              <CheckCircle2 size={18} aria-hidden="true" />
              <div>
                <strong>Submitted for verification</strong>
                <span>UTR number: {submittedUtr}</span>
              </div>
            </div>
          ) : null}
        </section>

        <section className="fee-panel fee-payment-panel" aria-labelledby="upi-title">
          <div className="fee-panel-heading">
            <div className="fee-heading-icon is-blue">
              <QrCode size={19} aria-hidden="true" />
            </div>
            <div>
              <h2 id="upi-title">UPI payment</h2>
              <p>UPI payment details will be available here.</p>
            </div>
          </div>

          <div className="fee-qr-placeholder">
            <div className="fee-qr-art" aria-hidden="true">
              <QrCode size={43} strokeWidth={1.35} />
              <span className="fee-qr-corner fee-qr-corner-top" />
              <span className="fee-qr-corner fee-qr-corner-bottom" />
            </div>
            <strong>Your UPI QR Code will appear here</strong>
          </div>

          <div className="fee-upi-options" aria-label="UPI payment app placeholders">
            {paymentOptions.map((option) => (
              <div className="fee-upi-option" key={option}>
                <span>{option}</span>
                <span className="fee-deeplink-placeholder">
                  <Link2 size={12} aria-hidden="true" />
                  Link placeholder
                </span>
              </div>
            ))}
          </div>

          <form className="fee-utr-form" onSubmit={handleSubmit} noValidate>
            <label htmlFor="utr-number">12-digit UTR / Transaction Reference Number</label>
            <input
              id="utr-number"
              name="utr"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              maxLength={12}
              placeholder="Enter 12-digit UTR"
              value={isSubmitted ? submittedUtr : utr}
              disabled={isSubmitted}
              onChange={(event) => {
                setUtr(event.target.value.replace(/\D/g, '').slice(0, 12));
                setError('');
              }}
              aria-describedby={error ? 'utr-error' : 'utr-instruction'}
              aria-invalid={Boolean(error)}
            />
            <p className="fee-utr-instruction" id="utr-instruction">
              Enter the UTR after completing the UPI payment.
            </p>
            {error ? <p className="fee-utr-error" id="utr-error">{error}</p> : null}
            <button type="submit" disabled={isSubmitted}>
              {isSubmitted ? 'Submitted for Verification' : 'Submit for Verification'}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
