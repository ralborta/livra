import Link from 'next/link';
import { API_URL } from '@/lib/api';

type Props = { params: Promise<{ token: string }> };

export default async function TrackingPage({ params }: Props) {
  const { token } = await params;
  let data: {
    status?: string;
    orderStatus?: string;
    courierName?: string | null;
    lastLocation?: { lat: number; lng: number } | null;
  } | null = null;
  let error = '';

  try {
    const res = await fetch(`${API_URL}/api/tracking/${token}`, { cache: 'no-store' });
    if (!res.ok) error = await res.text();
    else data = await res.json();
  } catch (e) {
    error = String(e);
  }

  return (
    <div className="shell">
      <header className="nav">
        <Link href="/" className="brand">
          Livra
        </Link>
      </header>
      <main className="hero">
        <h1>Tracking</h1>
        {error ? (
          <p>{error}</p>
        ) : (
          <>
            <p>
              Estado entrega: <span className="status-pill">{data?.status}</span>
            </p>
            <p>Pedido: {data?.orderStatus}</p>
            <p>Repartidor: {data?.courierName || '—'}</p>
            {data?.lastLocation ? (
              <p className="mono">
                Última posición: {data.lastLocation.lat}, {data.lastLocation.lng}
              </p>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
