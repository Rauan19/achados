'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';

const ITENS = [
  {href: '/', nome: '🔗 Conversor'},
  {href: '/fila', nome: '📥 Fila'},
  {href: '/whatsapp', nome: '💬 WhatsApp'},
];

export function Menu() {
  const atual = usePathname();
  return (
    <nav className="sticky top-0 z-30 border-b border-black/5 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-2">
        {ITENS.map((i) => {
          const ativo = i.href === '/' ? atual === '/' : atual.startsWith(i.href);
          return (
            <Link
              key={i.href}
              href={i.href}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                ativo ? 'bg-[#FFE600] text-[#2D3277]' : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              {i.nome}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
