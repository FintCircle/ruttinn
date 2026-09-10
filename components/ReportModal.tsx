'use client';

import React, { useState } from 'react';
import { Flag, AlertTriangle, CheckCircle, ShieldAlert, Loader2 } from 'lucide-react';
import type { D1Rut } from '@/lib/d1-database';
import { useAuth } from '@/lib/auth-context';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  rut: D1Rut | null;
}

const REPORT_REASONS = [
  'Inappropriate or offensive speech',
  'Harassment or hate speech',
  'Spam or commercial advertisement',
  'Audio quality is unintelligible or silent',
  'Breaches community privacy or doxxing',
  'Other reason',
];

export function ReportModal({ isOpen, onClose, rut }: ReportModalProps) {
  const { token } = useAuth();
  const [selectedReason, setSelectedReason] = useState<string>(REPORT_REASONS[0]);
  const [details, setDetails] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !rut) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/ruts/${rut.id}/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reason: selectedReason,
          details,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to submit report');
      }

      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        onClose();
      }, 1600);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="report-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="report-modal-card"
        className="w-full max-w-md bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-zinc-100">Report Voice Rut</h2>
          </div>
          <button
            id="close-report-modal-btn"
            onClick={onClose}
            className="w-7 h-7 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 flex items-center justify-center text-xs"
          >
            ✕
          </button>
        </div>

        {submitted ? (
          <div className="p-8 text-center space-y-3">
            <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto" />
            <h3 className="text-sm font-semibold text-zinc-100">Report Received</h3>
            <p className="text-xs text-zinc-400">
              Thank you for helping keep Scruttin authentic, safe, and respectful.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div className="p-3 rounded-xl bg-zinc-850 border border-zinc-750 text-xs text-zinc-400">
              Reporting voice Rut by <strong className="text-zinc-200">{rut.author_name}</strong>
              <p className="text-[11px] text-zinc-500 truncate mt-0.5">&ldquo;{rut.caption}&rdquo;</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-300">Select Reason</label>
              <div className="space-y-1.5">
                {REPORT_REASONS.map((r) => (
                  <label
                    key={r}
                    className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                      selectedReason === r
                        ? 'bg-rose-500/10 border-rose-500/40 text-rose-200'
                        : 'bg-zinc-850/40 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name="reportReason"
                      value={r}
                      checked={selectedReason === r}
                      onChange={() => setSelectedReason(r)}
                      className="accent-rose-500"
                    />
                    <span>{r}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-400">Additional details (optional)</label>
              <textarea
                rows={2}
                placeholder="Help us understand the issue..."
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                className="w-full p-2.5 bg-zinc-850 border border-zinc-700 rounded-xl text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-rose-400 resize-none"
              />
            </div>

            {errorMsg && <p className="text-xs text-rose-400">{errorMsg}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-xs text-zinc-300 hover:bg-zinc-700 font-medium"
              >
                Cancel
              </button>
              <button
                id="submit-report-btn"
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Submit Report
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
