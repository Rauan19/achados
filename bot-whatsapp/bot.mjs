// Bot de envio, controlado pela página /whatsapp do sistema (tudo passa pelo Neon).
// - liga/desliga números conforme a tela pede e publica o QR pra tela mostrar
// - manda as ofertas APROVADAS no grupo escolhido, revezando os números, com intervalo e limites
// - só envia: não lê nem responde mensagem de ninguém
import fs from 'node:fs';
import {neon} from '@neondatabase/serverless';
import {guardarEnviada, guardarGrupo, iniciarNumero} from './conexao.mjs';

// Ruído da criptografia ao receber mensagens ("Bad MAC", "Closing session"...): não afeta o envio
const RUIDO = /Bad MAC|Failed to decrypt|Session error|Closing (open )?session|SessionEntry|No matching sessions|Decrypted message with closed session/i;
for (const metodo of ['log', 'info', 'warn', 'error']) {
  const original = console[metodo].bind(console);
  console[metodo] = (...args) => {
    if (args.some((a) => RUIDO.test(String(a?.message ?? a)))) return;
    original(...args);
  };
}

// Só um bot por vez: dois bots com o mesmo número dessincronizam a sessão (causa do "Bad MAC")
const TRAVA = 'bot.lock';
try {
  const pid = Number(fs.readFileSync(TRAVA, 'utf8'));
  if (pid && pid !== process.pid) {
    process.kill(pid, 0); // lança erro se o processo não existe mais
    console.error(`\n✗ Já tem um bot rodando (processo ${pid}). Feche a outra janela do bot antes de abrir esta.\n`);
    process.exit(2);
  }
} catch {}
fs.writeFileSync(TRAVA, String(process.pid));
const liberarTrava = () => {
  try {
    if (fs.readFileSync(TRAVA, 'utf8') === String(process.pid)) fs.unlinkSync(TRAVA);
  } catch {}
};
process.on('exit', liberarTrava);
process.on('SIGINT', () => process.exit(0));

if (!process.env.DATABASE_URL) throw new Error('Faltou DATABASE_URL no .env');
const sql = neon(process.env.DATABASE_URL);

const tz = 'America/Sao_Paulo';
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const minutos = (m) => m * 60 * 1000;
const hora = () => Number(new Intl.DateTimeFormat('pt-BR', {hour: 'numeric', hour12: false, timeZone: tz}).format(new Date()));
const agora = () => new Date().toLocaleTimeString('pt-BR', {timeZone: tz});

async function log(tipo, texto) {
  console.log(`[${agora()}] ${texto}`);
  await sql`insert into bot_logs (tipo, texto) values (${tipo}, ${texto})`.catch(() => {});
}

// ---------------- números ----------------

/** nome -> {ctl, sock, online, telefone, lid} */
const instancias = new Map();

function iniciar(nome) {
  const inst = {ctl: null, sock: null, online: false, telefone: '', lid: ''};
  instancias.set(nome, inst);
  inst.ctl = iniciarNumero(nome, {
    aoQr: (qr) => sql`update whatsapp_numeros set status = 'aguardando_qr', qr = ${qr}, erro = '', atualizado_em = now() where nome = ${nome}`.catch(() => {}),
    aoConectar: async (sock) => {
      Object.assign(inst, {
        sock,
        online: true,
        telefone: sock.user?.id?.split(':')[0]?.split('@')[0] ?? '',
        lid: sock.user?.lid?.split(':')[0]?.split('@')[0] ?? '',
      });
      await sql`update whatsapp_numeros set status = 'conectado', qr = null, telefone = ${inst.telefone}, erro = '', atualizado_em = now() where nome = ${nome}`;
      await log('ok', `Número ${nome} conectado (+${inst.telefone})`);
      await atualizarGrupos().catch((e) => log('erro', `Erro ao ler grupos: ${e.message}`));
    },
    aoCair: async ({deslogado}) => {
      inst.online = false;
      const erro = deslogado ? 'A sessão foi encerrada no celular. Escaneie o QR de novo.' : '';
      await sql`update whatsapp_numeros set status = ${deslogado ? 'desconectado' : 'reconectando'}, qr = null, erro = ${erro}, atualizado_em = now() where nome = ${nome}`.catch(() => {});
      await log(deslogado ? 'erro' : 'aviso', deslogado ? `Número ${nome} foi desconectado pelo celular` : `Número ${nome} caiu, reconectando…`);
    },
    aoErro: (e) => log('erro', `Número ${nome}: ${e.message}`),
  });
}

/** Deixa os números rodando iguais ao que está na tela */
async function sincronizarNumeros() {
  const rows = await sql`select nome, acao from whatsapp_numeros`;
  const nomes = new Set(rows.map((r) => r.nome));

  for (const r of rows) {
    if (r.acao === 'desconectar') {
      const inst = instancias.get(r.nome);
      if (inst) await inst.ctl.parar({logout: true});
      else fs.rmSync(`sessoes/${r.nome}`, {recursive: true, force: true});
      instancias.delete(r.nome);
      await sql`delete from whatsapp_numeros where nome = ${r.nome}`;
      await log('info', `Número ${r.nome} desconectado e removido`);
      continue;
    }
    if (!instancias.has(r.nome)) iniciar(r.nome);
  }
  for (const [nome, inst] of instancias) {
    if (!nomes.has(nome)) {
      await inst.ctl.parar();
      instancias.delete(nome);
    }
  }
}

/** Lê os grupos de todos os números conectados e publica pra tela */
async function atualizarGrupos() {
  const online = [...instancias.entries()].filter(([, i]) => i.online);
  if (!online.length) return;
  const inicio = new Date();
  const grupos = new Map();

  for (const [nome, inst] of online) {
    const lista = Object.values(await inst.sock.groupFetchAllParticipating());
    for (const g of lista) {
      guardarGrupo(g);
      // Participante pode vir pelo telefone ou pelo LID (identificador novo do WhatsApp)
      const eu = g.participants.find((p) =>
        [p.id, p.phoneNumber, p.lid, p.jid].filter(Boolean).some((x) => {
          const id = String(x).split(':')[0].split('@')[0];
          return id === inst.telefone || (inst.lid && id === inst.lid);
        }),
      );
      const atual = grupos.get(g.id) ?? {nome: g.subject, soAdmins: Boolean(g.announce), membros: []};
      atual.membros.push({numero: nome, admin: Boolean(eu?.admin)});
      grupos.set(g.id, atual);
    }
  }

  for (const [id, g] of grupos) {
    await sql`
      insert into whatsapp_grupos (id, nome, so_admins, membros, atualizado_em)
      values (${id}, ${g.nome}, ${g.soAdmins}, ${JSON.stringify(g.membros)}::jsonb, now())
      on conflict (id) do update set nome = excluded.nome, so_admins = excluded.so_admins, membros = excluded.membros, atualizado_em = now()
    `;
  }
  await sql`delete from whatsapp_grupos where atualizado_em < ${inicio.toISOString()}`;
}

// ---------------- envio ----------------

let vez = 0;

async function enviadosHoje() {
  const rows = await sql`
    select coalesce(enviado_por, '?') as numero, count(*)::int as n from produtos
    where status = 'enviado'
      and enviado_em >= (date_trunc('day', now() at time zone ${tz}) at time zone ${tz})
    group by 1
  `;
  return {total: rows.reduce((s, r) => s + r.n, 0), porNumero: Object.fromEntries(rows.map((r) => [r.numero, r.n]))};
}

/** Próximo número (revezando) que está online, está no grupo e não bateu o limite */
async function escolherNumero(cfg, porNumero) {
  const [grupo] = await sql`select membros, so_admins from whatsapp_grupos where id = ${cfg.grupo_id}`;
  const podeEnviar = new Set(
    (grupo?.membros ?? []).filter((m) => !grupo.so_admins || m.admin).map((m) => m.numero),
  );
  const nomes = [...instancias.keys()].sort();
  for (let i = 0; i < nomes.length; i++) {
    const nome = nomes[(vez + i) % nomes.length];
    if (instancias.get(nome).online && podeEnviar.has(nome) && (porNumero[nome] ?? 0) < cfg.max_por_numero) {
      vez = (nomes.indexOf(nome) + 1) % nomes.length;
      return nome;
    }
  }
  return null;
}

async function enviar(nome, cfg, p) {
  const {sock} = instancias.get(nome);
  if (!cfg.grupo_id.endsWith('@g.us')) return; // nunca envia fora de grupo
  try {
    const enviada = p.imagem
      ? await sock.sendMessage(cfg.grupo_id, {image: {url: p.imagem}, caption: p.mensagem})
      : await sock.sendMessage(cfg.grupo_id, {text: p.mensagem});
    guardarEnviada(enviada);
    await sql`update produtos set status = 'enviado', enviado_em = now(), enviado_por = ${nome}, erro = '' where id = ${p.id}`;
    await log('ok', `Número ${nome} enviou: ${p.titulo.slice(0, 70)}`);
  } catch (e) {
    await sql`update produtos set status = 'erro', erro = ${`número ${nome}: ${String(e.message).slice(0, 280)}`} where id = ${p.id}`;
    await log('erro', `Número ${nome} falhou em "${p.titulo.slice(0, 40)}": ${e.message}`);
  }
}

let avisoParado = '';
async function avisarUmaVez(motivo) {
  if (avisoParado === motivo) return;
  avisoParado = motivo;
  await log('info', motivo);
}

async function loopEnvio() {
  while (true) {
    try {
      const [cfg] = await sql`select * from bot_config where id = 1`;
      if (cfg.pausado) {
        await avisarUmaVez('Envios pausados');
        await dormir(5000);
        continue;
      }
      if (!cfg.grupo_id) {
        await avisarUmaVez('Escolha o grupo de envio na tela');
        await dormir(5000);
        continue;
      }
      // Trava: só envia pra GRUPO (id termina em @g.us), nunca pra contato
      if (!cfg.grupo_id.endsWith('@g.us')) {
        await avisarUmaVez('Destino inválido: não é um grupo. Escolha o grupo de novo na tela.');
        await dormir(10_000);
        continue;
      }
      const h = hora();
      if (h < cfg.hora_inicio || h >= cfg.hora_fim) {
        await avisarUmaVez(`Fora do horário (${cfg.hora_inicio}h às ${cfg.hora_fim}h), aguardando`);
        await dormir(60_000);
        continue;
      }
      // Respeita o intervalo mesmo depois de reiniciar o bot (olha o último envio no banco)
      const [{ultimo}] = await sql`select max(enviado_em) as ultimo from produtos where status = 'enviado'`;
      const faltam = ultimo ? new Date(ultimo).getTime() + minutos(cfg.intervalo_min) - Date.now() : 0;
      if (faltam > 60_000) {
        await avisarUmaVez(`Aguardando o intervalo: próxima rodada em ~${Math.ceil(faltam / 60_000)} min`);
        await esperarIntervalo(Math.min(faltam, minutos(5)));
        continue;
      }

      // Rodada: manda N ofertas seguidas (20–50s entre elas) e depois espera o intervalo
      const tamanho = Math.max(1, cfg.por_rodada ?? 1);
      let enviadas = 0;
      for (let k = 0; k < tamanho; k++) {
        const resultado = await enviarUma(cfg);
        if (resultado !== 'ok') {
          if (enviadas === 0) await avisarUmaVez(resultado);
          break;
        }
        avisoParado = '';
        enviadas++;
        if (k < tamanho - 1 && (await esperarIntervalo((20 + Math.random() * 30) * 1000))) break; // pausaram no meio
      }
      if (!enviadas) {
        await dormir(15_000);
        continue;
      }
      const espera = cfg.intervalo_min + Math.random() * Math.max(0, cfg.intervalo_max - cfg.intervalo_min);
      await log('info', `Rodada com ${enviadas} oferta(s). Próxima rodada em ~${Math.round(espera)} min`);
      await esperarIntervalo(minutos(espera));
    } catch (e) {
      console.error(`[${agora()}] erro no envio: ${e.message}`);
      await dormir(30_000);
    }
  }
}

/** Manda UMA oferta (limite do dia, número da vez e próxima da fila). Devolve 'ok' ou o motivo de não ter mandado */
async function enviarUma(cfg) {
  const {total, porNumero} = await enviadosHoje();
  if (total >= cfg.max_por_dia) return `Limite do dia atingido (${cfg.max_por_dia}), volta amanhã`;
  const nome = await escolherNumero(cfg, porNumero);
  if (!nome) return 'Nenhum número disponível (conectado, no grupo e dentro do limite)';
  const [p] = await sql`
    select * from produtos
    where status = 'aprovado' and link_afiliado <> '' and mensagem <> ''
    order by atualizado_em asc limit 1
  `;
  if (!p) return 'Fila vazia: aprove ofertas na página Fila';
  await enviar(nome, cfg, p);
  return 'ok';
}

/** Espera o tempo, mas sai antes se pausarem na tela (devolve true se pausaram) */
async function esperarIntervalo(ms) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) {
    await dormir(Math.min(10_000, fim - Date.now()));
    const [cfg] = await sql`select pausado from bot_config where id = 1`.catch(() => [{}]);
    if (cfg?.pausado) return true;
  }
  return false;
}

// ---------------- supervisor ----------------

async function supervisor() {
  try {
    await sincronizarNumeros();
    const [cfg] = await sql`update bot_config set heartbeat_em = now() where id = 1 returning atualizar_grupos`;
    if (cfg?.atualizar_grupos) {
      await sql`update bot_config set atualizar_grupos = false where id = 1`;
      await atualizarGrupos();
      await log('info', 'Lista de grupos atualizada');
    }
  } catch (e) {
    console.error(`[${agora()}] supervisor: ${e.message}`);
  }
  setTimeout(supervisor, 3000);
}

// Erro inesperado não derruba o bot: registra na Atividade e segue
process.on('unhandledRejection', (e) => log('erro', `Erro inesperado: ${e?.message ?? e}`));
process.on('uncaughtException', (e) => log('erro', `Erro inesperado: ${e?.message ?? e}`));

try {
  await sql`select 1 from bot_config limit 1`;
} catch {
  throw new Error('Tabelas do painel não existem. Rode: npm --prefix conversor-links run db:setup');
}
await sql`delete from bot_logs where criado_em < now() - interval '7 days'`;
await sql`update whatsapp_numeros set status = 'iniciando', qr = null`;
await log('info', 'Bot iniciado');
supervisor();
loopEnvio();
