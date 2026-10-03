import { Building2, Calendar, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import Avatar from '../ui/Avatar';
import type { ProjectProposal } from '../../types';

export type ProjectProposalCardProps = {
  proposal: ProjectProposal;
  isAdmin?: boolean;
  isProcessing?: boolean;
  onApprove?: (proposal: ProjectProposal) => void;
  onReject?: (proposal: ProjectProposal) => void;
};

function formatDate(isoString?: string | null): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export default function ProjectProposalCard({
  proposal,
  isAdmin = false,
  isProcessing = false,
  onApprove,
  onReject,
}: ProjectProposalCardProps) {
  const isPending = proposal.status === 'PENDING';
  const isApproved = proposal.status === 'APPROVED';
  const isRejected = proposal.status === 'REJECTED';

  const approvedProjectId = proposal.approvedProjectId ?? proposal.approvedProject?.id;
  const proposerName = proposal.createdBy?.name || 'Pengguna';

  return (
    <div className="flex flex-col gap-3.5 rounded-xl border border-gray-200/90 bg-white p-4 shadow-2xs transition hover:border-gray-300/80 sm:p-5">
      {/* Header: Title & Status Badge */}
      <div className="flex flex-wrap items-start justify-between gap-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-manrope text-sm font-bold text-perrific-graphite sm:text-base">
              {proposal.name}
            </h3>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${
                isApproved
                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                  : isRejected
                    ? 'border border-red-200 bg-red-50 text-red-600'
                    : 'border border-amber-200 bg-amber-50 text-amber-700'
              }`}
            >
              {isApproved ? 'Disetujui' : isRejected ? 'Ditolak' : 'Menunggu Approval'}
            </span>
          </div>

          {proposal.description && (
            <p className="mt-1 text-xs text-gray-600 sm:text-sm sm:leading-relaxed">
              {proposal.description}
            </p>
          )}
        </div>
      </div>

      {/* Proposer Profile & Meta Section */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3">
        {/* Proposer Info with Small Avatar on the Left (NO EMAIL) */}
        <div className="flex items-center gap-2.5">
          <Avatar
            src={proposal.createdBy?.avatarUrl}
            name={proposal.createdBy?.name}
            size={32}
            fallback="silhouette"
          />
          <div className="min-w-0">
            <p className="truncate font-manrope text-xs font-semibold text-gray-900 sm:text-sm">
              {proposerName}
            </p>
            <p className="text-[11px] text-gray-400">Pengusul Proyek</p>
          </div>
        </div>

        {/* Organization & Date Meta */}
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-500 sm:gap-4 sm:text-xs">
          <div className="flex items-center gap-1.5" title="Organisasi Pengusul">
            <Building2 size={13} className="shrink-0 text-gray-400" />
            <span className="font-medium text-gray-700">
              {proposal.organization?.name ?? '—'}
            </span>
          </div>

          <div className="flex items-center gap-1.5" title="Tanggal Pengajuan">
            <Calendar size={13} className="shrink-0 text-gray-400" />
            <span>{formatDate(proposal.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* Decision Details: Rejection Box */}
      {isRejected && (
        <div className="rounded-lg border border-red-200/90 bg-red-50/70 p-3 text-xs text-red-700">
          <div className="flex items-start gap-2">
            <AlertCircle size={15} className="mt-0.5 shrink-0 text-red-500" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-red-800">
                Alasan Penolakan: {proposal.rejectionReason || 'Tidak ada alasan khusus.'}
              </p>
              {(proposal.decidedBy?.name || proposal.decidedAt) && (
                <p className="mt-0.5 text-[11px] text-red-600/90">
                  Ditolak oleh <strong className="font-medium">{proposal.decidedBy?.name ?? 'Admin Tim'}</strong>
                  {proposal.decidedAt && ` pada ${formatDate(proposal.decidedAt)}`}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Decision Details: Approval Box & Link to Project */}
      {isApproved && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200/90 bg-emerald-50/70 p-3 text-xs text-emerald-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
            <div>
              <p className="font-semibold text-emerald-900">
                Usulan telah disetujui
                {proposal.decidedBy?.name && (
                  <> oleh <strong className="font-medium">{proposal.decidedBy.name}</strong></>
                )}
                {proposal.decidedAt && ` pada ${formatDate(proposal.decidedAt)}`}
              </p>
            </div>
          </div>

          {approvedProjectId && (
            <Link
              to={`/project/${approvedProjectId}`}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-2xs transition hover:bg-emerald-700"
            >
              <span>Buka Project</span>
              <ArrowRight size={12} />
            </Link>
          )}
        </div>
      )}

      {/* Admin Action Buttons (for PENDING status) */}
      {isPending && isAdmin && (
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-3">
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => onApprove?.(proposal)}
            className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-3.5 py-1.5 font-manrope text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            {isProcessing ? 'Memproses...' : 'Setujui'}
          </button>
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => onReject?.(proposal)}
            className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 px-3.5 py-1.5 font-manrope text-xs font-semibold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            Tolak
          </button>
        </div>
      )}
    </div>
  );
}
