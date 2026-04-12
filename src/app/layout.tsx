import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Momentum Edge',
  description: 'Trading journal and momentum scoring',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
