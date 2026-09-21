import { Link } from 'react-router-dom';
import { avatarColor, type DashboardData } from '../useDashboardData';

export default function TeamsBlock({ data }: { data: DashboardData }) {
  const {
    teams,
    showTeamForm,
    teamName,
    creating,
    createError,
    setShowTeamForm,
    setTeamName,
    setCreateError,
    handleCreateTeam,
  } = data;
  return (
    <section id="teams" className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-givonic text-sm font-bold text-perrific-graphite">
          Tim saya <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 font-mono text-[11px] font-medium text-perrific-graphite/60">{teams.length}</span>
        </h2>
        <button
          type="button"
          onClick={() => {
            setShowTeamForm((v) => !v);
            setCreateError(null);
          }}
          className="font-givonic text-xs font-semibold text-perrific-violet hover:underline"
        >
          {showTeamForm ? 'Tutup' : '+ Baru'}
        </button>
      </div>

      {showTeamForm && (
        <form onSubmit={handleCreateTeam} className="mt-3 flex gap-2">
          <input
            autoFocus
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="Nama tim baru…"
            maxLength={60}
            className="min-w-0 flex-1 rounded-[10px] border border-perrific-line bg-white px-3 py-2 font-givonic text-sm text-perrific-graphite placeholder:text-perrific-graphite/40 focus:border-perrific-violet focus:outline-none focus:ring-2 focus:ring-perrific-violet/20"
          />
          <button
            type="submit"
            disabled={creating || !teamName.trim()}
            className="shrink-0 rounded-full bg-perrific-violet px-4 py-2 font-givonic text-xs font-semibold text-white hover:bg-[#E64D0A] disabled:cursor-not-allowed disabled:opacity-60 transition"
          >
            {creating ? '…' : 'Buat'}
          </button>
        </form>
      )}
      {createError && (
        <p role="alert" className="mt-2 font-givonic text-xs text-red-600">{createError}</p>
      )}

      {teams.length === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center">
          <p className="font-givonic text-sm text-perrific-graphite/60">Belum ada tim. Buat tim pertamamu</p>
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-gray-100">
          {teams.map((team) => (
            <li key={team.id}>
              <Link to={`/team/${team.id}`} className="group flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-gray-50">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] font-givonic text-sm font-bold text-white ${avatarColor(team.id)}`}>
                  {team.name.trim().charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-givonic text-sm font-semibold text-perrific-graphite">
                    {team.name}
                  </span>
                  <span className="block truncate font-givonic text-xs text-perrific-graphite/50">
                    {team.description || `${team.members?.length ?? 0} anggota`}
                    {team.description && ` · ${team.members?.length ?? 0} anggota`}
                  </span>
                </span>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0 text-perrific-graphite/30 transition group-hover:translate-x-0.5 group-hover:text-perrific-graphite/60">
                  <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
