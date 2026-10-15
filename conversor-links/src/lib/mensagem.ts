import {formatarBRL, type Plataforma} from './parser';

export interface Oferta {
  chamada: string;
  titulo: string;
  precoDe: number | null;
  precoPor: number | null;
  parcelas: string;
  cupom: string;
  freteGratis: boolean;
  link: string;
  plataforma: Plataforma;
}

export const CHAMADAS = [
  '🔥 OFERTA IMPERDÍVEL 🔥',
  '⚡ PREÇO DESPENCOU ⚡',
  '🚨 CORRE QUE ACABA 🚨',
  '💥 ACHADINHO DO DIA 💥',
  '😱 PREÇO DE ERRO? 😱',
  '🛒 OLHA ESSE ACHADO 🛒',
];

export const NOME_PLATAFORMA: Record<Plataforma, string> = {
  mercadolivre: 'Mercado Livre',
  shopee: 'Shopee',
  outra: 'Loja',
};

export function desconto(o: Pick<Oferta, 'precoDe' | 'precoPor'>): number | null {
  if (!o.precoDe || !o.precoPor || o.precoDe <= o.precoPor) return null;
  return Math.round((1 - o.precoPor / o.precoDe) * 100);
}

/** Monta a mensagem no formato do WhatsApp (*negrito*, ~riscado~, _itálico_) */
export function montarMensagem(o: Oferta): string {
  const pct = desconto(o);
  const linhas: string[] = [`*${o.chamada}*`, ''];

  if (o.titulo) linhas.push(`📦 *${o.titulo.trim()}*`, '');

  if (o.precoDe && pct) linhas.push(`❌ ~De ${formatarBRL(o.precoDe)}~`);
  if (o.precoPor) linhas.push(`✅ *Por ${formatarBRL(o.precoPor)}*${pct ? ` _(${pct}% OFF)_` : ''}`);
  if (o.parcelas) linhas.push(`💳 ${o.parcelas}`);
  if (o.freteGratis) linhas.push('🚚 Frete grátis');
  if (o.cupom) linhas.push(`🎟️ Cupom: *${o.cupom}*`);

  if (o.link) linhas.push('', `🛒 Compre no ${NOME_PLATAFORMA[o.plataforma]}:`, o.link);
  linhas.push('', '_⚠️ Preço e estoque podem mudar a qualquer momento_');

  return linhas.join('\n').replace(/\n{3,}/g, '\n\n');
}
