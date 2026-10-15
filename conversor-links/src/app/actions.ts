'use server';

import {revalidatePath} from 'next/cache';
import {sql} from '@/lib/db';
import {CHAMADAS, montarMensagem, type Oferta} from '@/lib/mensagem';
import type {Plataforma} from '@/lib/parser';

export async function salvarOferta(o: Oferta) {
  if (!sql) return {ok: false, erro: 'Banco não configurado'};
  if (!o.link) return {ok: false, erro: 'Falta o link'};
  const mensagem = montarMensagem(o);
  await sql`
    insert into ofertas (plataforma, titulo, preco_de, preco_por, parcelas, cupom, frete_gratis, chamada, link, mensagem)
    values (${o.plataforma}, ${o.titulo}, ${o.precoDe}, ${o.precoPor}, ${o.parcelas}, ${o.cupom}, ${o.freteGratis}, ${o.chamada}, ${o.link}, ${mensagem})
  `;
  revalidatePath('/');
  return {ok: true};
}

export async function excluirOferta(id: number) {
  if (!sql) return;
  await sql`delete from ofertas where id = ${id}`;
  revalidatePath('/');
}

// ---------- Fila de produtos ----------

/** Aprova e já deixa a mensagem pronta pro bot (cada uma com uma chamada diferente) */
export async function aprovarProdutos(ids: number[]) {
  if (!sql || !ids.length) return {aprovados: 0, semLink: 0};
  const rows = await sql`select * from produtos where id = any(${ids})`;
  let aprovados = 0;
  let semLink = 0;
  for (const p of rows) {
    if (!p.link_afiliado) {
      semLink++;
      continue;
    }
    const mensagem = montarMensagem({
      chamada: CHAMADAS[Math.floor(Math.random() * CHAMADAS.length)],
      titulo: p.titulo,
      precoDe: p.preco_de === null ? null : Number(p.preco_de),
      precoPor: p.preco_por === null ? null : Number(p.preco_por),
      parcelas: '',
      cupom: '',
      freteGratis: false,
      link: p.link_afiliado,
      plataforma: (p.origem as Plataforma) || 'mercadolivre',
    });
    await sql`update produtos set status = 'aprovado', mensagem = ${mensagem}, erro = '', atualizado_em = now() where id = ${p.id}`;
    aprovados++;
  }
  revalidatePath('/fila');
  return {aprovados, semLink};
}

export async function mudarStatus(ids: number[], status: 'novo' | 'descartado') {
  if (!sql || !ids.length) return;
  await sql`update produtos set status = ${status}, atualizado_em = now() where id = any(${ids})`;
  revalidatePath('/fila');
}

export async function salvarProduto(id: number, campos: {titulo: string; linkAfiliado: string}) {
  if (!sql) return;
  await sql`update produtos set titulo = ${campos.titulo.trim()}, link_afiliado = ${campos.linkAfiliado.trim()}, atualizado_em = now() where id = ${id}`;
  revalidatePath('/fila');
}

export async function excluirProdutos(ids: number[]) {
  if (!sql || !ids.length) return;
  await sql`delete from produtos where id = any(${ids})`;
  revalidatePath('/fila');
}
