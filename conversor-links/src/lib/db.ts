import {neon} from '@neondatabase/serverless';

// Sem DATABASE_URL o app funciona normal, só não salva histórico
export const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;

export interface OfertaSalva {
  id: number;
  plataforma: string;
  titulo: string;
  preco_de: number | null;
  preco_por: number | null;
  parcelas: string;
  cupom: string;
  frete_gratis: boolean;
  chamada: string;
  link: string;
  mensagem: string;
  criado_em: string;
}

export async function listarOfertas(): Promise<OfertaSalva[]> {
  if (!sql) return [];
  const rows = await sql`select * from ofertas order by criado_em desc limit 50`;
  return rows.map((r) => ({
    ...(r as OfertaSalva),
    preco_de: r.preco_de === null ? null : Number(r.preco_de),
    preco_por: r.preco_por === null ? null : Number(r.preco_por),
    criado_em: new Date(r.criado_em as string).toISOString(),
  }));
}
