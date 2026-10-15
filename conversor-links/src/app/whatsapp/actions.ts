'use server';

import {sql} from '@/lib/db';
import type {ConfigBot} from '@/lib/whatsapp';

// A tela só escreve no banco; o bot lê e executa em até ~3s

export async function adicionarNumero() {
  if (!sql) return;
  const rows = await sql`select nome from whatsapp_numeros`;
  const usados = new Set(rows.map((r) => Number(r.nome)));
  let n = 1;
  while (usados.has(n)) n++;
  await sql`insert into whatsapp_numeros (nome) values (${String(n)}) on conflict do nothing`;
}

export async function desconectarNumero(nome: string) {
  if (!sql) return;
  await sql`update whatsapp_numeros set acao = 'desconectar', atualizado_em = now() where nome = ${nome}`;
}

export async function escolherGrupo(id: string, nome: string) {
  if (!sql || !id.endsWith('@g.us')) return; // só aceita grupo
  // Só grupos que o bot realmente encontrou nos números conectados
  const [existe] = await sql`select id from whatsapp_grupos where id = ${id}`;
  if (!existe) return;
  await sql`update bot_config set grupo_id = ${id}, grupo_nome = ${nome} where id = 1`;
}

export async function pedirAtualizacaoGrupos() {
  if (!sql) return;
  await sql`update bot_config set atualizar_grupos = true where id = 1`;
}

export async function definirPausa(pausado: boolean) {
  if (!sql) return;
  await sql`update bot_config set pausado = ${pausado} where id = 1`;
}

const inteiro = (v: unknown, min: number, max: number, padrao: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : padrao;
};

export async function salvarRitmo(
  c: Pick<ConfigBot, 'intervalo_min' | 'intervalo_max' | 'hora_inicio' | 'hora_fim' | 'max_por_dia' | 'max_por_numero' | 'por_rodada'>,
) {
  if (!sql) return;
  const intervaloMin = inteiro(c.intervalo_min, 3, 240, 10);
  const intervaloMax = Math.max(intervaloMin, inteiro(c.intervalo_max, 3, 240, 25));
  const horaInicio = inteiro(c.hora_inicio, 0, 23, 8);
  const horaFim = Math.max(horaInicio + 1, inteiro(c.hora_fim, 1, 24, 22));
  await sql`
    update bot_config set
      intervalo_min = ${intervaloMin}, intervalo_max = ${intervaloMax},
      hora_inicio = ${horaInicio}, hora_fim = ${horaFim},
      max_por_dia = ${inteiro(c.max_por_dia, 1, 500, 30)}, max_por_numero = ${inteiro(c.max_por_numero, 1, 300, 15)},
      por_rodada = ${inteiro(c.por_rodada, 1, 5, 2)}
    where id = 1
  `;
}
