import type {Metadata, Viewport} from 'next';
import {Geist, Geist_Mono} from 'next/font/google';
import {Menu} from '@/components/Menu';
import './globals.css';

const geistSans = Geist({variable: '--font-geist-sans', subsets: ['latin']});
const geistMono = Geist_Mono({variable: '--font-geist-mono', subsets: ['latin']});

export const metadata: Metadata = {
  title: 'Conversor de Achadinhos',
  description: 'Transforma links do Mercado Livre e da Shopee em mensagens prontas pro grupo',
};

export const viewport: Viewport = {themeColor: '#FFE600'};

export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return (
    <html lang="pt-BR">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Menu />
        {children}
      </body>
    </html>
  );
}
