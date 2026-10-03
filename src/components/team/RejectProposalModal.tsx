import { useState } from 'react';
import ModalShell from '@/components/ui/ModalShell';
import { AlertTriangle, X } from 'lucide-react';
import type { ProjectProposal } from '@/types';

interface RejectProposalModalProps {
  proposal: ProjectProposal | null;
  onClose: () => void;
  onConfirm: (reason?: string) => Promise<void> | void;
  submitting?: boolean;
}

export default function RejectProposalModal({
  proposal,
  onClose,
  onConfirm,
  submitting = false,
}: RejectProposalModalProps) {
  const [reason, setReason] = useState('');

  if (!proposal) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const trimmed = reason.trim();
    onConfirm(trimmed !== '' ? trimmed : undefined);
  }

  return (
    <ModalShell
      label="Tolak Usulan Project"
      onClose={submitting ? () => {} : onClose}
      maxWidthClass="max-w-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
            <AlertTriangle size={20} strokeWidth={2} aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-manrope text-base font-bold text-gray-900">
              Tolak Usulan Project
            </h2>
            <p className="font-manrope text-xs text-gray-500">
              Konfirmasi penolakan usulan
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          aria-label="Tutup modal"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50 cursor-pointer"
        >
          <X size={18} strokeWidth={1.8} />
        </button>
      </div>

      <div className="mt-4 rounded-xl border border-amber-200/80 bg-amber-50/60 p-3 text-xs text-amber-950">
        <p className="font-manrope font-semibold text-gray-900">
          Usulan: <span className="text-amber-900 font-bold">{proposal.name}</span>
        </p>
        <p className="mt-1 text-gray-600">
          Dari organisasi: <strong className="text-gray-800">{proposal.organization?.name ?? '—'}</strong>
          {proposal.createdBy?.name && (
            <> • Diajukan oleh: <strong className="text-gray-800">{proposal.createdBy.name}</strong></>
          )}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label
            htmlFor="reject-reason-input"
            className="block font-manrope text-xs font-semibold text-gray-700"
          >
            Alasan Penolakan <span className="font-normal text-gray-400">(opsional)</span>
          </label>
          <textarea
            id="reject-reason-input"
            rows={3}
            value={reason}
            disabled={submitting}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Tuliskan alasan penolakan usulan..."
            className="nice-scroll mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50/50 p-3 font-manrope text-sm text-gray-800 placeholder:text-gray-400 transition focus:border-red-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 disabled:opacity-50"
          />
          <p className="mt-1 font-manrope text-[11px] text-gray-400">
            Alasan penolakan akan dapat dibaca oleh pengurus organisasi terkait.
          </p>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-2.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 font-manrope text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 font-manrope text-xs font-semibold text-white shadow-xs transition hover:bg-red-700 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
          >
            {submitting && (
              <span
                aria-hidden="true"
                className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"
              />
            )}
            {submitting ? 'Menolak...' : 'Tolak Usulan'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
