import {sql} from './db';

export type StatusProduto = 'novo' | 'aprovado' | 'enviado' | 'descartado' | 'erro';
export const STATUS: StatusProduto[] = ['novo', 'aprovado', 'enviado', 'descartado', 'erro'];

export interface Produto {
  id: number;
  produto_id: string;
  origem: string;
  titulo: string;
  preco_de: number | null;
  preco_por: number | null;
  imagem: string;
  url: string;
  link_afiliado: string;
  status: StatusProduto;
  mensagem: string;
  erro: string;
  criado_em: string;
  enviado_em: string | null;
  enviado_por: string | null;
}

export async function listarProdutos(status: StatusProduto): Promise<Produto[]> {
  if (!sql) return [];
  const rows =
    status === 'enviado'
      ? await sql`select * from produtos where status = ${status} order by enviado_em desc limit 200`
      : await sql`select * from produtos where status = ${status} order by atualizado_em desc limit 200`;
  return rows.map((r) => ({
    ...(r as Produto),
    preco_de: r.preco_de === null ? null : Number(r.preco_de),
    preco_por: r.preco_por === null ? null : Number(r.preco_por),
    criado_em: new Date(r.criado_em as string).toISOString(),
    enviado_em: r.enviado_em ? new Date(r.enviado_em as string).toISOString() : null,
  }));
}

export async function contarPorStatus(): Promise<Record<StatusProduto, number>> {
  const base = {novo: 0, aprovado: 0, enviado: 0, descartado: 0, erro: 0};
  if (!sql) return base;
  const rows = await sql`select status, count(*)::int as n from produtos group by status`;
  for (const r of rows) base[r.status as StatusProduto] = r.n as number;
  return base;
}
