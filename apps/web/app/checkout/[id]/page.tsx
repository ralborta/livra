'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { API_URL } from '@/lib/api';

export default function CheckoutPage() {
  const params = useParams<{ id: string }>();
  const [msg, setMsg] = useState('Simulá la aprobación del pago (sandbox).');

  async function approve() {
    const eventId = `evt_${Date.now()}`;
    const res = await fetch(`${API_URL}/api/webhooks/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-livra-signature':
          process.env.NEXT_PUBLIC_PAYMENTS_WEBHOOK_SECRET ||
          'dev-payments-secret',
      },
      body: JSON.stringify({
        eventId,
        orderId: params.id,
        status: 'approved',
        providerPaymentId: `mp_${eventId}`,
      }),
    });
    setMsg(res.ok ? 'Pago aprobado' : await res.text());
  }

  async function startCheckout() {
    const res = await fetch(`${API_URL}/api/orders/${params.id}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    setMsg(res.ok ? 'Checkout creado' : await res.text());
  }

  return (
    <div className="shell">
      <header className="nav">
        <Link href="/" className="brand">
          Livra
        </Link>
      </header>
      <main className="hero">
        <h1>Checkout</h1>
        <p>{msg}</p>
        <div className="cta-row">
          <button className="btn btn-ghost" onClick={startCheckout}>
            Emitir checkout
          </button>
          <button className="btn btn-primary" onClick={approve}>
            Simular pago aprobado
          </button>
        </div>
      </main>
    </div>
  );
}
