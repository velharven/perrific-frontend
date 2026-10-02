import { Link } from 'react-router-dom';
import { useTableData } from './useTableData';
import TableGrid from './TableGrid';

const MAX_ROWS = 50;

// Tabel live tertanam di baris pointer halaman induk. Edit autosave sama,
// judul ikut baris pointer (tak diduplikasi di sini).
export default function EmbeddedTable({ noteId }: { noteId: string }) {
  const t = useTableData(noteId);

  if (t.loading) {
    return (
      <div className="animate-pulse space-y-2 py-2" aria-label="Memuat tabel">
        <div className="h-4 w-1/3 rounded bg-gray-200" />
        <div className="h-8 rounded-lg bg-gray-100" />
        <div className="h-8 rounded-lg bg-gray-100" />
      </div>
    );
  }

  if (t.loadError) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-5 text-center">
        <p className="font-manrope text-xs text-perrific-graphite/60">Tabel tak termuat.</p>
        <Link to={`/tables/${noteId}`} className="mt-1 inline-block font-manrope text-xs font-semibold text-perrific-violet hover:underline">
          Buka penuh →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <TableGrid t={{ ...t, rows: t.rows.slice(0, MAX_ROWS) }} tableId={noteId} hideToolbar />
      {t.rows.length > MAX_ROWS && (
        <Link
          to={`/tables/${noteId}`}
          className="block px-3 py-2 font-manrope text-xs text-perrific-graphite/50 hover:text-perrific-violet hover:underline"
        >
          +{t.rows.length - MAX_ROWS} lainnya — buka penuh →
        </Link>
      )}
    </div>
  );
}
