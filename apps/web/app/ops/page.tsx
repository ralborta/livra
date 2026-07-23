'use client';

import { useState } from 'react';
import Link from 'next/link';
import { API_URL } from '@/lib/api';

export default function OpsPage() {
  const [orderId, setOrderId] = useState('');
  const [timeline, setTimeline] = useState<unknown>(null);
  const [error, setError] = useState('');

  async function load() {
    setError('');
    const res = await fetch(`${API_URL}/api/ops/orders/${orderId}/timeline`);
    if (!res.ok) {
      setError(await res.text());
      setTimeline(null);
      return;
    }
    setTimeline(await res.json());
  }

  async function transition(toStatus: string) {
    const res = await fetch(`${API_URL}/api/orders/${orderId}/transitions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toStatus, actor: 'ops' }),
    });
    if (!res.ok) {
      setError(await res.text());
      return;
    }
    await load();
  }

  return (
    <div className="shell">
      <header className="nav">
        <Link href="/" className="brand">
          Livra
        </Link>
        <nav className="nav-links">
          <Link href="/restaurant">Restaurante</Link>
        </nav>
      </header>
      <main className="panel">
        <h2>Operaciones</h2>
        <p style={{ color: 'var(--muted)' }}>
          Timeline unificada por pedido (`correlation_id` + eventos).
        </p>
        <div className="cta-row" style={{ marginTop: '1rem' }}>
          <input
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            placeholder="order id"
            style={{
              minWidth: '280px',
              padding: '0.7rem 0.8rem',
              borderRadius: '0.7rem',
              border: '1px solid var(--line)',
              background: 'rgba(0,0,0,0.25)',
              color: 'var(--ink)',
            }}
          />
          <button className="btn btn-primary" onClick={load}>
            Ver timeline
          </button>
          <button className="btn btn-ghost" onClick={() => transition('ACCEPTED')}>
            Aceptar
          </button>
          <button className="btn btn-ghost" onClick={() => transition('PREPARING')}>
            Preparar
          </button>
          <button className="btn btn-ghost" onClick={() => transition('READY')}>
            Listo
          </button>
        </div>
        {error ? <p style={{ color: '#ffb4a2' }}>{error}</p> : null}
        {timeline ? (
          <pre
            className="mono"
            style={{
              marginTop: '1.5rem',
              padding: '1rem',
              borderRadius: '1rem',
              border: '1px solid var(--line)',
              overflow: 'auto',
              background: 'rgba(0,0,0,0.28)',
            }}
          >
            {JSON.stringify(timeline, null, 2)}
          </pre>
        ) : null}
      </main>
    </div>
  );
}
