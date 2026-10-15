'use client';

import Link from 'next/link';
import QRCode from 'qrcode';
import {useCallback, useEffect, useState, useTransition} from 'react';
import {
  adicionarNumero,
  definirPausa,
  desconectarNumero,
  escolherGrupo,
  pedirAtualizacaoGrupos,
  salvarRitmo,
} from '@/app/whatsapp/actions';
import type {ConfigBot, EstadoWhats, GrupoWhats, NumeroWhats} from '@/lib/whatsapp';

const card = 'rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5';
const inputCls =
  'w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-[15px] outline-none focus:border-[#2D3277] focus:ring-2 focus:ring-[#2D3277]/15';

const STATUS: Record<NumeroWhats['status'], {texto: string; cor: string}> = {
  conectado: {texto: 'Conectado', cor: 'bg-green-100 text-green-800'},
  aguardando_qr: {texto: 'Aguardando QR', cor: 'bg-amber-100 text-amber-800'},
  iniciando: {texto: 'Iniciando…', cor: 'bg-neutral-100 text-neutral-600'},
  reconectando: {texto: 'Reconectando…', cor: 'bg-amber-100 text-amber-800'},
  desconectado: {texto: 'Desconectado', cor: 'bg-red-100 text-red-700'},
};

const telefoneBonito = (t: string) => {
  const m = t.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `+55 (${m[1]}) ${m[2]}-${m[3]}` : t ? `+${t}` : '';
};

function QrNaTela({texto}: {texto: string}) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    QRCode.toDataURL(texto, {width: 300, margin: 1}).then(setSrc).catch(() => setSrc(''));
  }, [texto]);
  /* eslint-disable-next-line @next/next/no-img-element */
  return src ? <img src={src} alt="QR code do WhatsApp" className="h-[240px] w-[240px] rounded-xl ring-1 ring-black/10" /> : null;
}

function CardNumero({n, enviados, maxPorNumero, botOnline, atualizar}: {
  n: NumeroWhats;
  enviados: number;
  maxPorNumero: number;
  botOnline: boolean;
  atualizar: () => void;
}) {
  const [pendente, start] = useTransition();
  const st = STATUS[n.status] ?? STATUS.iniciando;
  const saindo = n.acao === 'desconectar';

  return (
    <div className="rounded-2xl bg-neutral-50 p-4 ring-1 ring-black/5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-lg">📱</span>
        <b className="text-[#2D3277]">Número {n.nome}</b>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${saindo ? 'bg-neutral-200 text-neutral-600' : st.cor}`}>
          {saindo ? 'Desconectando…' : st.texto}
        </span>
        {n.telefone && <span className="text-sm text-neutral-500">{telefoneBonito(n.telefone)}</span>}
        <button
          disabled={pendente || saindo}
          onClick={() => confirm(`Desconectar o número ${n.nome}? Vai precisar escanear o QR de novo pra voltar.`) && start(async () => {
            await desconectarNumero(n.nome);
            atualizar();
          })}
          className="ml-auto rounded-lg px-2.5 py-1 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          Desconectar
        </button>
      </div>

      {n.status === 'conectado' && (
        <p className="mt-2 text-sm text-neutral-600">
          Enviou hoje: <b>{enviados}</b> de {maxPorNumero}
        </p>
      )}

      {n.status === 'aguardando_qr' && !botOnline && (
        <p className="mt-2 text-sm text-neutral-500">O bot está desligado: ligue o bot pra gerar um QR novo.</p>
      )}

      {n.status === 'aguardando_qr' && n.qr && !saindo && botOnline && (
        <div className="mt-3 flex flex-col items-center gap-3 sm:flex-row sm:items-start">
          <QrNaTela texto={n.qr} />
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-neutral-700">
            <li>Pegue o celular do chip <b>{n.nome}</b></li>
            <li>WhatsApp → <b>⋮</b> (ou Configurações) → <b>Aparelhos conectados</b></li>
            <li><b>Conectar aparelho</b> e aponte a câmera pro QR</li>
            <li className="text-neutral-500">O QR muda sozinho a cada ~20s, é normal</li>
          </ol>
        </div>
      )}

      {(n.status === 'iniciando' || n.status === 'reconectando') && !saindo && (
        <p className="mt-2 text-sm text-neutral-500">
          {botOnline ? 'Preparando a conexão… o QR aparece aqui em alguns segundos.' : 'O bot está desligado: abra o INICIAR.bat pra gerar o QR.'}
        </p>
      )}
      {n.erro && <p className="mt-2 text-sm font-medium text-red-600">{n.erro}</p>}
    </div>
  );
}

function OpcaoGrupo({g, selecionado, numeros, escolher}: {
  g: GrupoWhats;
  selecionado: boolean;
  numeros: NumeroWhats[];
  escolher: () => void;
}) {
  return (
    <button
      onClick={escolher}
      className={`w-full rounded-2xl p-3 text-left ring-1 transition ${selecionado ? 'bg-[#2D3277]/5 ring-2 ring-[#2D3277]' : 'bg-neutral-50 ring-black/5 hover:bg-neutral-100'}`}
    >
      <div className="flex items-center gap-2">
        <span className={`grid h-5 w-5 place-items-center rounded-full border-2 ${selecionado ? 'border-[#2D3277]' : 'border-neutral-300'}`}>
          {selecionado && <span className="h-2.5 w-2.5 rounded-full bg-[#2D3277]" />}
        </span>
        <b className="truncate">{g.nome}</b>
        {g.so_admins && <span className="shrink-0 rounded-full bg-neutral-200 px-2 py-0.5 text-[11px] font-bold text-neutral-600">só admins enviam</span>}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 pl-7">
        {numeros.map((n) => {
          const m = g.membros.find((x) => x.numero === n.nome);
          const pode = m && (!g.so_admins || m.admin);
          return (
            <span key={n.nome} className={`rounded-full px-2 py-0.5 text-xs font-semibold ${pode ? 'bg-green-100 text-green-800' : 'bg-red-50 text-red-700'}`}>
              Nº{n.nome} {!m ? '✗ não está no grupo' : m.admin ? '✓ admin' : g.so_admins ? '✗ não é admin' : '✓ membro'}
            </span>
          );
        })}
      </div>
    </button>
  );
}

type Ritmo = Pick<ConfigBot, 'intervalo_min' | 'intervalo_max' | 'hora_inicio' | 'hora_fim' | 'max_por_dia' | 'max_por_numero' | 'por_rodada'>;

function FormRitmo({config, atualizar}: {config: ConfigBot; atualizar: () => void}) {
  const [r, setR] = useState<Ritmo>(config);
  const [pendente, start] = useTransition();
  const [salvo, setSalvo] = useState(false);
  const set = (k: keyof Ritmo, v: string) => setR((o) => ({...o, [k]: Number(v.replace(/\D/g, '')) || 0}));

  const media = (r.intervalo_min + r.intervalo_max) / 2 || 1;
  const rodada = Math.max(1, r.por_rodada || 1);
  const porDiaNoRitmo = Math.floor(((r.hora_fim - r.hora_inicio) * 60) / media) * rodada;
  const estimativa = Math.max(0, Math.min(porDiaNoRitmo, r.max_por_dia));

  const campo = (k: keyof Ritmo, label: string, sufixo: string) => (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</span>
      <div className="flex items-center gap-2">
        <input value={r[k]} onChange={(e) => set(k, e.target.value)} inputMode="numeric" className={inputCls} />
        <span className="shrink-0 text-sm text-neutral-500">{sufixo}</span>
      </div>
    </label>
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">{campo('por_rodada', 'Ofertas por rodada (seguidas)', 'de 1 a 5')}</div>
        {campo('intervalo_min', 'Intervalo mínimo', 'min')}
        {campo('intervalo_max', 'Intervalo máximo', 'min')}
        {campo('hora_inicio', 'Começa às', 'h')}
        {campo('hora_fim', 'Para às', 'h')}
        {campo('max_por_dia', 'Máx. por dia (grupo)', '')}
        {campo('max_por_numero', 'Máx. por número', '')}
      </div>
      <p className="rounded-xl bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
        Nesse ritmo: <b>~{estimativa} ofertas por dia</b>.{' '}
        {rodada > 1 ? `${rodada} seguidas (com 20–50s entre elas), depois` : 'Uma oferta, depois'} espera {r.intervalo_min}–{r.intervalo_max} min, das{' '}
        {r.hora_inicio}h às {r.hora_fim}h.
        {porDiaNoRitmo > r.max_por_dia && <span className="text-amber-700"> Vai parar ao bater o limite de {r.max_por_dia} no dia.</span>}
      </p>
      <button
        disabled={pendente}
        onClick={() => start(async () => {
          await salvarRitmo(r);
          setSalvo(true);
          setTimeout(() => setSalvo(false), 2000);
          atualizar();
        })}
        className="w-full rounded-xl bg-[#2D3277] px-4 py-2.5 font-bold text-white disabled:opacity-60"
      >
        {pendente ? 'Salvando…' : salvo ? 'Salvo ✓' : 'Salvar ritmo'}
      </button>
    </div>
  );
}

const COR_LOG = {ok: 'bg-green-500', info: 'bg-neutral-400', aviso: 'bg-amber-500', erro: 'bg-red-500'};

export function PainelWhatsApp({inicial}: {inicial: EstadoWhats}) {
  const [e, setE] = useState(inicial);
  const [pendente, start] = useTransition();

  const atualizar = useCallback(async () => {
    try {
      const r = await fetch('/api/whatsapp/estado', {cache: 'no-store'});
      if (r.ok) setE(await r.json());
    } catch {}
  }, []);

  useEffect(() => {
    const t = setInterval(atualizar, 2000);
    return () => clearInterval(t);
  }, [atualizar]);

  if (!e.ativo || !e.config) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-6">
        <p className="rounded-2xl bg-amber-50 p-5 text-amber-800">
          O painel precisa do banco configurado. Rode <code>npm --prefix conversor-links run db:setup</code> e recarregue a página.
        </p>
      </div>
    );
  }

  const cfg = e.config;
  const conectados = e.numeros.filter((n) => n.status === 'conectado');
  const enviadosTotal = Object.values(e.enviadosHoje).reduce((a, b) => a + b, 0);
  const grupoSel = e.grupos.find((g) => g.id === cfg.grupo_id);
  const podemEnviar = grupoSel
    ? conectados.filter((n) => grupoSel.membros.some((m) => m.numero === n.nome && (!grupoSel.so_admins || m.admin)))
    : [];
  const motivoBloqueio = !e.botOnline
    ? 'Bot desligado'
    : !conectados.length
      ? 'Conecte pelo menos um número'
      : !cfg.grupo_id
        ? 'Escolha o grupo'
        : !podemEnviar.length
          ? 'Nenhum número conectado pode enviar nesse grupo'
          : '';
  const ultimo = e.logs[0];

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-6">
      <header className="mb-5 flex flex-wrap items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-full bg-[#25D366] text-2xl shadow-sm">💬</div>
        <div className="mr-auto">
          <h1 className="text-xl font-extrabold tracking-tight text-[#2D3277]">Envio no WhatsApp</h1>
          <p className="text-sm text-neutral-500">Conecte os números, escolha o grupo e ligue os envios</p>
        </div>
        <span className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${e.botOnline ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}`}>
          <span className={`h-2 w-2 rounded-full ${e.botOnline ? 'animate-pulse bg-green-500' : 'bg-red-500'}`} />
          {e.botOnline ? 'Bot ligado' : 'Bot desligado'}
        </span>
      </header>

      {!e.botOnline && (
        <div className="mb-5 rounded-2xl bg-red-50 p-4 text-sm text-red-800 ring-1 ring-red-200">
          <b>O bot não está rodando.</b> Dê dois cliques no arquivo <b>INICIAR.bat</b> (na pasta do projeto). Ele liga o sistema e o bot juntos.
        </div>
      )}

      {/* Barra de controle */}
      <section className={`${card} mb-5 flex flex-wrap items-center gap-4`}>
        <div className="w-full rounded-2xl bg-[#25D366]/10 px-4 py-3 text-sm ring-1 ring-[#25D366]/30">
          {grupoSel ? (
            <>
              🎯 Enviando <b>somente</b> para o grupo: <b className="text-base text-[#075E54]">{grupoSel.nome}</b>
            </>
          ) : (
            <span className="font-semibold text-amber-800">🎯 Nenhum grupo escolhido: o bot não envia nada até você escolher abaixo.</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href="/fila?status=aprovado" className="rounded-full bg-neutral-100 px-3 py-1.5 font-semibold hover:bg-neutral-200">
            📥 Na fila: <b>{e.naFila}</b>
          </Link>
          <span className="rounded-full bg-neutral-100 px-3 py-1.5 font-semibold">
            📤 Enviados hoje: <b>{enviadosTotal}</b> / {cfg.max_por_dia}
          </span>
          <span className="rounded-full bg-neutral-100 px-3 py-1.5 font-semibold">
            📱 Conectados: <b>{conectados.length}</b>
          </span>
        </div>
        <div className="ml-auto flex flex-col items-end gap-1">
          {cfg.pausado ? (
            <button
              disabled={pendente || Boolean(motivoBloqueio)}
              onClick={() => start(async () => {
                await definirPausa(false);
                await atualizar();
              })}
              className="rounded-2xl bg-[#25D366] px-6 py-3 text-[15px] font-extrabold text-white shadow-sm transition hover:brightness-95 disabled:bg-neutral-300"
            >
              ▶ Ligar envios
            </button>
          ) : (
            <button
              disabled={pendente}
              onClick={() => start(async () => {
                await definirPausa(true);
                await atualizar();
              })}
              className="rounded-2xl bg-[#FF2E3B] px-6 py-3 text-[15px] font-extrabold text-white shadow-sm transition hover:brightness-95"
            >
              ⏸ Pausar envios
            </button>
          )}
          <span className="text-xs text-neutral-500">
            {cfg.pausado ? motivoBloqueio || 'Envios pausados' : ultimo ? ultimo.texto : 'Enviando…'}
          </span>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          {/* Números */}
          <section className={card}>
            <div className="mb-3 flex items-center">
              <h2 className="mr-auto text-lg font-extrabold text-[#2D3277]">Números</h2>
              <button
                disabled={pendente}
                onClick={() => start(async () => {
                  await adicionarNumero();
                  await atualizar();
                })}
                className="rounded-xl bg-[#25D366] px-3.5 py-2 text-sm font-bold text-white hover:brightness-95"
              >
                + Adicionar número
              </button>
            </div>
            {e.numeros.length === 0 ? (
              <p className="rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-500">
                Nenhum número ainda. Clique em <b>+ Adicionar número</b> e escaneie o QR com o chip que vai enviar as ofertas.
                <br />
                <span className="text-amber-700">Use um chip secundário, nunca o seu número pessoal.</span>
              </p>
            ) : (
              <div className="space-y-3">
                {e.numeros.map((n) => (
                  <CardNumero
                    key={n.nome}
                    n={n}
                    enviados={e.enviadosHoje[n.nome] ?? 0}
                    maxPorNumero={cfg.max_por_numero}
                    botOnline={e.botOnline}
                    atualizar={atualizar}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Grupo */}
          <section className={card}>
            <div className="mb-3 flex items-center">
              <h2 className="mr-auto text-lg font-extrabold text-[#2D3277]">Grupo de envio</h2>
              <button
                disabled={pendente || !conectados.length}
                onClick={() => start(async () => {
                  await pedirAtualizacaoGrupos();
                  await atualizar();
                })}
                className="rounded-xl bg-neutral-100 px-3 py-2 text-sm font-semibold hover:bg-neutral-200 disabled:opacity-50"
              >
                ↻ Atualizar grupos
              </button>
            </div>
            {e.grupos.length === 0 ? (
              <p className="rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-500">
                {conectados.length ? 'Nenhum grupo encontrado. Coloque os números no grupo e clique em Atualizar grupos.' : 'Conecte um número pra ver os grupos dele.'}
              </p>
            ) : (
              <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                {e.grupos.map((g) => (
                  <OpcaoGrupo
                    key={g.id}
                    g={g}
                    selecionado={g.id === cfg.grupo_id}
                    numeros={e.numeros}
                    escolher={() => start(async () => {
                      await escolherGrupo(g.id, g.nome);
                      await atualizar();
                    })}
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-5">
          <section className={card}>
            <h2 className="mb-3 text-lg font-extrabold text-[#2D3277]">Ritmo de envio</h2>
            <FormRitmo config={cfg} atualizar={atualizar} />
          </section>

          <section className={card}>
            <h2 className="mb-3 text-lg font-extrabold text-[#2D3277]">Atividade</h2>
            {e.logs.length === 0 ? (
              <p className="text-sm text-neutral-500">Nada ainda.</p>
            ) : (
              <ul className="max-h-[380px] space-y-1.5 overflow-y-auto pr-1">
                {e.logs.map((l) => (
                  <li key={l.id} className="flex items-start gap-2 text-sm">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${COR_LOG[l.tipo] ?? COR_LOG.info}`} />
                    <time className="shrink-0 tabular-nums text-neutral-400">
                      {new Date(l.criado_em).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}
                    </time>
                    <span className="text-neutral-700">{l.texto}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
