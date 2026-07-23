import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="shell">
      <header className="nav">
        <div className="brand">Livra</div>
        <nav className="nav-links">
          <Link href="/restaurant">Restaurante</Link>
          <Link href="/courier">Repartidor</Link>
          <Link href="/ops">Operaciones</Link>
        </nav>
      </header>

      <main>
        <section className="hero">
          <div className="brand">Livra</div>
          <h1>Pedí por WhatsApp. Seguilo hasta la puerta.</h1>
          <p>
            Marketplace conversacional con pagos, despacho y tracking. El
            restaurante opera sin fricción; el repartidor con PWA; vos con
            trazabilidad punta a punta.
          </p>
          <div className="cta-row">
            <Link className="btn btn-primary" href="/restaurant">
              Abrir panel restaurante
            </Link>
            <Link className="btn btn-ghost" href="/ops">
              Ver operaciones
            </Link>
          </div>
        </section>

        <section className="panel">
          <h2>Ciclo completo</h2>
          <div className="grid">
            <div className="tile">
              <h3>Conversación</h3>
              <p>WhatsApp como canal; el dominio manda el pedido.</p>
            </div>
            <div className="tile">
              <h3>Pago</h3>
              <p>Checkout idempotente y webhooks conciliados.</p>
            </div>
            <div className="tile">
              <h3>Última milla</h3>
              <p>Oferta, tracking temporal y código de entrega.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
