import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Livra',
  description: 'Marketplace conversacional, pagos y última milla',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
