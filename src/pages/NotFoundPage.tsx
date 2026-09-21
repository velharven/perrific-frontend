import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 text-gray-600">
      <h1 className="text-4xl font-bold text-gray-800">404</h1>
      <p>Halaman tidak ditemukan.</p>
      <Link to="/" className="text-primary hover:underline">
        Kembali ke Dashboard
      </Link>
    </div>
  );
}
