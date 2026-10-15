// Cria as tabelas no Neon. Uso: npm run db:setup  (precisa do DATABASE_URL no .env.local)
import {neon} from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  console.error('Faltou o DATABASE_URL no .env.local');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

// Histórico das mensagens geradas no conversor
await sql`
  create table if not exists ofertas (
    id serial primary key,
    plataforma text not null default 'outra',
    titulo text not null default '',
    preco_de numeric(10, 2),
    preco_por numeric(10, 2),
    parcelas text not null default '',
    cupom text not null default '',
    frete_gratis boolean not null default false,
    chamada text not null default '',
    link text not null,
    mensagem text not null,
    criado_em timestamptz not null default now()
  )
`;

// Fila: produtos coletados pela extensão -> aprovados -> enviados pelo bot
// status: novo | aprovado | enviado | descartado | erro
await sql`
  create table if not exists produtos (
    id serial primary key,
    produto_id text not null unique,
    origem text not null default 'mercadolivre',
    titulo text not null,
    preco_de numeric(10, 2),
    preco_por numeric(10, 2),
    imagem text not null default '',
    url text not null,
    link_afiliado text not null default '',
    status text not null default 'novo',
    mensagem text not null default '',
    erro text not null default '',
    criado_em timestamptz not null default now(),
    atualizado_em timestamptz not null default now(),
    enviado_em timestamptz
  )
`;
await sql`create index if not exists produtos_status_idx on produtos (status, atualizado_em)`;
await sql`alter table produtos add column if not exists enviado_por text`;

// ---------- Painel do WhatsApp (o bot lê e escreve aqui) ----------

// Números conectados. status: iniciando | aguardando_qr | conectado | reconectando | desconectado
await sql`
  create table if not exists whatsapp_numeros (
    nome text primary key,
    status text not null default 'iniciando',
    qr text,
    telefone text not null default '',
    erro text not null default '',
    acao text not null default '',
    criado_em timestamptz not null default now(),
    atualizado_em timestamptz not null default now()
  )
`;

// Grupos em que os números estão (membros = [{numero, admin}])
await sql`
  create table if not exists whatsapp_grupos (
    id text primary key,
    nome text not null,
    so_admins boolean not null default false,
    membros jsonb not null default '[]',
    atualizado_em timestamptz not null default now()
  )
`;

// Configuração do bot (uma linha só)
await sql`
  create table if not exists bot_config (
    id int primary key default 1 check (id = 1),
    grupo_id text not null default '',
    grupo_nome text not null default '',
    pausado boolean not null default true,
    intervalo_min int not null default 10,
    intervalo_max int not null default 25,
    hora_inicio int not null default 8,
    hora_fim int not null default 22,
    max_por_dia int not null default 30,
    max_por_numero int not null default 15,
    atualizar_grupos boolean not null default false,
    heartbeat_em timestamptz
  )
`;
await sql`insert into bot_config (id) values (1) on conflict do nothing`;
// Quantas ofertas manda em sequência antes de esperar o intervalo
await sql`alter table bot_config add column if not exists por_rodada int not null default 2`;

await sql`
  create table if not exists bot_logs (
    id serial primary key,
    criado_em timestamptz not null default now(),
    tipo text not null default 'info',
    texto text not null
  )
`;

console.log('✓ Tabelas prontas no Neon');
