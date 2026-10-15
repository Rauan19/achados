// Conexão de UM número com o WhatsApp (Baileys, NÃO oficial). Sessão salva em ./sessoes/<nome>
import fs from 'node:fs';
import makeWASocket, {Browsers, BufferJSON, DisconnectReason, fetchLatestBaileysVersion, useMultiFileAuthState} from '@whiskeysockets/baileys';
import pino from 'pino';

let versao = null;

// ---------- mensagens enviadas (pra reenviar) ----------
// Quando alguém do grupo vê "aguardando mensagem", o celular dela pede a mensagem de novo.
// Guardamos as últimas enviadas em disco pra conseguir reenviar mesmo depois de reiniciar o bot.
const ARQUIVO_ENVIADAS = 'sessoes/enviadas.json';
const enviadas = new Map();
try {
  for (const [id, msg] of JSON.parse(fs.readFileSync(ARQUIVO_ENVIADAS, 'utf8'), BufferJSON.reviver)) enviadas.set(id, msg);
} catch {}
let salvarTimer = null;
export function guardarEnviada(msg) {
  if (!msg?.key?.id || !msg.message) return;
  enviadas.set(msg.key.id, msg.message);
  while (enviadas.size > 300) enviadas.delete(enviadas.keys().next().value);
  clearTimeout(salvarTimer);
  salvarTimer = setTimeout(() => {
    fs.mkdirSync('sessoes', {recursive: true});
    fs.writeFileSync(ARQUIVO_ENVIADAS, JSON.stringify([...enviadas], BufferJSON.replacer));
  }, 1000);
}

// ---------- cache dos grupos ----------
// A Baileys recomenda pra envio em grupo: evita buscar os participantes toda vez (e erros de entrega)
const grupos = new Map();
export function guardarGrupo(meta) {
  if (meta?.id) grupos.set(meta.id, meta);
}

/**
 * Liga o número e fica reconectando sozinho até ctl.parar() ser chamado.
 * cb.aoQr(qr) | cb.aoConectar(sock) | cb.aoCair({deslogado}) | cb.aoErro(erro)
 */
export function iniciarNumero(nome, cb) {
  const pasta = `sessoes/${nome}`;
  const ctl = {parado: false, sock: null};

  async function abrir() {
    const {state, saveCreds} = await useMultiFileAuthState(pasta);
    versao ??= (await fetchLatestBaileysVersion()).version;

    const sock = makeWASocket({
      version: versao,
      auth: state,
      logger: pino({level: 'silent'}),
      browser: Browsers.ubuntu('Chrome'),
      markOnlineOnConnect: false,
      syncFullHistory: false,
      getMessage: async (key) => enviadas.get(key.id),
      cachedGroupMetadata: async (jid) => grupos.get(jid),
    });
    ctl.sock = sock;

    sock.ev.on('creds.update', saveCreds);
    // Mudou algo no grupo (entrou/saiu gente): busca de novo na próxima vez
    sock.ev.on('groups.update', (lista) => lista.forEach((g) => grupos.delete(g.id)));
    sock.ev.on('group-participants.update', ({id}) => grupos.delete(id));

    sock.ev.on('connection.update', ({connection, lastDisconnect, qr}) => {
      if (ctl.parado) return;
      if (qr) cb.aoQr?.(qr);
      if (connection === 'open') cb.aoConectar?.(sock);
      if (connection === 'close') {
        const deslogado = lastDisconnect?.error?.output?.statusCode === DisconnectReason.loggedOut;
        if (deslogado) fs.rmSync(pasta, {recursive: true, force: true}); // vai pedir QR novo
        cb.aoCair?.({deslogado});
        setTimeout(() => !ctl.parado && abrir().catch((e) => cb.aoErro?.(e)), deslogado ? 2000 : 10_000);
      }
    });
  }

  abrir().catch((e) => cb.aoErro?.(e));

  ctl.parar = async ({logout = false} = {}) => {
    ctl.parado = true;
    try {
      if (logout) await ctl.sock?.logout();
      else ctl.sock?.end(undefined);
    } catch {}
    if (logout) fs.rmSync(pasta, {recursive: true, force: true});
  };
  return ctl;
}
