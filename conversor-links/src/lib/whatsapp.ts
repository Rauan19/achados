import {sql} from './db';

export interface NumeroWhats {
  nome: string;
  status: 'iniciando' | 'aguardando_qr' | 'conectado' | 'reconectando' | 'desconectado';
  qr: string | null;
  telefone: string;
  erro: string;
  acao: string;
}

export interface GrupoWhats {
  id: string;
  nome: string;
  so_admins: boolean;
  membros: {numero: string; admin: boolean}[];
}

export interface ConfigBot {
  grupo_id: string;
  grupo_nome: string;
  pausado: boolean;
  intervalo_min: number;
  intervalo_max: number;
  hora_inicio: number;
  hora_fim: number;
  max_por_dia: number;
  max_por_numero: number;
  por_rodada: number;
}

export interface LogBot {
  id: number;
  criado_em: string;
  tipo: 'ok' | 'info' | 'aviso' | 'erro';
  texto: string;
}

export interface EstadoWhats {
  ativo: boolean; // tabelas existem e banco configurado
  botOnline: boolean;
  numeros: NumeroWhats[];
  grupos: GrupoWhats[];
  config: ConfigBot | null;
  logs: LogBot[];
  enviadosHoje: Record<string, number>;
  naFila: number;
}

const VAZIO: EstadoWhats = {ativo: false, botOnline: false, numeros: [], grupos: [], config: null, logs: [], enviadosHoje: {}, naFila: 0};

export async function lerEstado(): Promise<EstadoWhats> {
  if (!sql) return VAZIO;
  try {
    const tz = 'America/Sao_Paulo';
    const [numeros, grupos, [config], logs, enviados, [fila]] = await Promise.all([
      sql`select nome, status, qr, telefone, erro, acao from whatsapp_numeros order by nome`,
      sql`select id, nome, so_admins, membros from whatsapp_grupos order by nome`,
      sql`select *, (heartbeat_em > now() - interval '20 seconds') as bot_online from bot_config where id = 1`,
      sql`select id, criado_em, tipo, texto from bot_logs order by id desc limit 40`,
      sql`
        select coalesce(enviado_por, '?') as numero, count(*)::int as n from produtos
        where status = 'enviado' and enviado_em >= (date_trunc('day', now() at time zone ${tz}) at time zone ${tz})
        group by 1
      `,
      sql`select count(*)::int as n from produtos where status = 'aprovado'`,
    ]);
    return {
      ativo: true,
      botOnline: Boolean(config?.bot_online),
      numeros: numeros as NumeroWhats[],
      grupos: grupos as GrupoWhats[],
      config: (config as ConfigBot) ?? null,
      logs: logs.map((l) => ({...(l as LogBot), criado_em: new Date(l.criado_em as string).toISOString()})),
      enviadosHoje: Object.fromEntries(enviados.map((r) => [r.numero, r.n])),
      naFila: fila?.n ?? 0,
    };
  } catch {
    return VAZIO; // tabelas ainda não criadas
  }
}
