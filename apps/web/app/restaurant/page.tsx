'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { API_URL } from '@/lib/api';

type Tenant = {
  id: string;
  name: string;
  slug: string;
  branches: { id: string; name: string }[];
};

type Product = {
  id: string;
  name: string;
  priceCents: number;
  available: boolean;
};

export default function RestaurantPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [status, setStatus] = useState('Cargando…');
  const [name, setName] = useState('Demo Burger');
  const [slug, setSlug] = useState('demo-burger');

  async function loadTenants() {
    const res = await fetch(`${API_URL}/api/tenants`);
    if (!res.ok) throw new Error('No se pudo cargar tenants');
    const data = (await res.json()) as Tenant[];
    setTenants(data);
    if (data[0] && !selected) setSelected(data[0].id);
    setStatus('Listo');
  }

  async function loadProducts(tenantId: string) {
    if (!tenantId) return;
    const res = await fetch(`${API_URL}/api/catalog/products?tenantId=${tenantId}`);
    if (!res.ok) return;
    setProducts(await res.json());
  }

  useEffect(() => {
    loadTenants().catch((e) => setStatus(String(e.message || e)));
  }, []);

  useEffect(() => {
    loadProducts(selected).catch(() => undefined);
  }, [selected]);

  async function createTenant() {
    setStatus('Creando restaurante…');
    const res = await fetch(`${API_URL}/api/tenants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, slug }),
    });
    if (!res.ok) {
      setStatus(await res.text());
      return;
    }
    await loadTenants();
    setStatus('Restaurante creado');
  }

  async function addProduct() {
    if (!selected) return;
    setStatus('Agregando producto…');
    const res = await fetch(`${API_URL}/api/catalog/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: selected,
        name: 'Hamburguesa clásica',
        priceCents: 8500,
        description: 'Con papas',
      }),
    });
    if (!res.ok) {
      setStatus(await res.text());
      return;
    }
    await loadProducts(selected);
    setStatus('Producto agregado');
  }

  async function createDemoOrder() {
    if (!selected || !products[0]) {
      setStatus('Necesitás al menos un producto');
      return;
    }
    const p = products[0];
    const res = await fetch(`${API_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: selected,
        customerName: 'Cliente demo',
        customerPhone: '+5491100000000',
        address: 'Av. Demo 123',
        deliveryCents: 1500,
        items: [
          {
            productId: p.id,
            name: p.name,
            quantity: 1,
            unitCents: p.priceCents,
          },
        ],
      }),
    });
    if (!res.ok) {
      setStatus(await res.text());
      return;
    }
    const order = await res.json();
    setStatus(`Pedido creado: ${order.id}`);
  }

  return (
    <div className="shell">
      <header className="nav">
        <Link href="/" className="brand">
          Livra
        </Link>
        <nav className="nav-links">
          <Link href="/ops">Ops</Link>
          <Link href="/courier">Courier</Link>
        </nav>
      </header>
      <main className="panel">
        <h2>Panel restaurante</h2>
        <p className="mono" style={{ color: 'var(--muted)' }}>
          {status}
        </p>

        <div className="grid" style={{ marginTop: '1.5rem' }}>
          <div className="tile">
            <h3>Onboarding</h3>
            <p>Creá un tenant de prueba.</p>
            <div style={{ display: 'grid', gap: '0.5rem', marginTop: '0.8rem' }}>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre"
                style={inputStyle}
              />
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="slug"
                style={inputStyle}
              />
              <button className="btn btn-primary" onClick={createTenant}>
                Crear restaurante
              </button>
            </div>
          </div>

          <div className="tile">
            <h3>Catálogo</h3>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              style={inputStyle}
            >
              <option value="">Elegí tenant</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <div className="cta-row">
              <button className="btn btn-ghost" onClick={addProduct}>
                + Producto demo
              </button>
              <button className="btn btn-primary" onClick={createDemoOrder}>
                Crear pedido
              </button>
            </div>
            <ul style={{ marginTop: '1rem', paddingLeft: '1.1rem', color: 'var(--muted)' }}>
              {products.map((p) => (
                <li key={p.id}>
                  {p.name} · ${(p.priceCents / 100).toFixed(2)}
                </li>
              ))}
            </ul>
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
};
