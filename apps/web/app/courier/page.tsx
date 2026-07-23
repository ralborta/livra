'use client';

import { useState } from 'react';
import Link from 'next/link';
import { API_URL } from '@/lib/api';

export default function CourierPage() {
  const [deliveryId, setDeliveryId] = useState('');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('Listo para aceptar viajes');

  async function assign() {
    const res = await fetch(`${API_URL}/api/deliveries/${deliveryId}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courierName: 'Moto Demo', courierPhone: '+54911' }),
    });
    setMsg(res.ok ? 'Viaje asignado' : await res.text());
  }

  async function ping() {
    const res = await fetch(`${API_URL}/api/deliveries/${deliveryId}/locations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: -34.6037, lng: -58.3816, accuracyM: 12 }),
    });
    setMsg(res.ok ? 'Posición enviada' : await res.text());
  }

  async function complete() {
    const res = await fetch(`${API_URL}/api/deliveries/${deliveryId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    setMsg(res.ok ? 'Entrega confirmada' : await res.text());
  }

  return (
    <div className="shell">
      <header className="nav">
        <Link href="/" className="brand">
          Livra
        </Link>
      </header>
      <main className="panel">
        <h2>PWA repartidor</h2>
        <p style={{ color: 'var(--muted)' }}>{msg}</p>
        <div className="grid" style={{ marginTop: '1rem' }}>
          <div className="tile">
            <input
              value={deliveryId}
              onChange={(e) => setDeliveryId(e.target.value)}
              placeholder="delivery id"
              style={inputStyle}
            />
            <div className="cta-row">
              <button className="btn btn-primary" onClick={assign}>
                Aceptar viaje
              </button>
              <button className="btn btn-ghost" onClick={ping}>
                Enviar ubicación
              </button>
            </div>
          </div>
          <div className="tile">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="código entrega"
              style={inputStyle}
            />
            <button className="btn btn-primary" onClick={complete}>
              Confirmar entrega
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.7rem 0.8rem',
  borderRadius: '0.7rem',
  border: '1px solid var(--line)',
  background: 'rgba(0,0,0,0.25)',
  color: 'var(--ink)',
  marginBottom: '0.8rem',
};
