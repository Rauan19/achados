'use client';

import {useMemo, useState, useTransition} from 'react';
import {excluirOferta, salvarOferta} from '@/app/actions';
import type {OfertaSalva} from '@/lib/db';
import {CHAMADAS, NOME_PLATAFORMA, desconto, montarMensagem, type Oferta} from '@/lib/mensagem';
import {detectarPlataforma, extrair, formatarBRL, lerPreco, type Plataforma} from '@/lib/parser';

interface Campos {
  chamada: string;
  titulo: string;
  de: string;
  por: string;
  parcelas: string;
  cupom: string;
  freteGratis: boolean;
  link: string;
}

const VAZIO: Campos = {chamada: CHAMADAS[0], titulo: '', de: '', por: '', parcelas: '', cupom: '', freteGratis: false, link: ''};

const precoParaCampo = (n: number | null) => (n ? n.toFixed(2).replace('.', ',') : '');

const COR_PLATAFORMA: Record<Plataforma, string> = {
  mercadolivre: 'bg-[#FFE600] text-[#2D3277]',
  shopee: 'bg-[#EE4D2D] text-white',
  outra: 'bg-neutral-200 text-neutral-700',
};

// *negrito* ~riscado~ _itálico_ igual ao WhatsApp (links ficam de fora da formatação)
function PreviewWhats({texto}: {texto: string}) {
  const partes = texto.split(/(https?:\/\/[^\s]+)/g);
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = partes
    .map((p, i) =>
      i % 2 === 1
        ? `<a href="${esc(p)}" target="_blank" rel="noreferrer" class="text-[#027EB5] underline break-all">${esc(p)}</a>`
        : esc(p)
            .replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>')
            .replace(/~([^~\n]+)~/g, '<s>$1</s>')
            .replace(/(^|\s)_([^_\n]+)_/g, '$1<em>$2</em>'),
    )
    .join('');
  return <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#111B21]" dangerouslySetInnerHTML={{__html: html}} />;
}

function Campo({label, children}: {label: string; children: React.ReactNode}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  'w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-[15px] outline-none transition focus:border-[#2D3277] focus:ring-2 focus:ring-[#2D3277]/15';

export function Conversor({historico, bancoAtivo}: {historico: OfertaSalva[]; bancoAtivo: boolean}) {
  const [texto, setTexto] = useState('');
  const [c, setC] = useState<Campos>(VAZIO);
  const [aviso, setAviso] = useState('');
  const [salvando, startTransition] = useTransition();

  const set = <K extends keyof Campos>(k: K, v: Campos[K]) => setC((old) => ({...old, [k]: v}));

  const oferta: Oferta = useMemo(
    () => ({
      chamada: c.chamada,
      titulo: c.titulo,
      precoDe: lerPreco(c.de),
      precoPor: lerPreco(c.por),
      parcelas: c.parcelas,
      cupom: c.cupom.trim().toUpperCase(),
      freteGratis: c.freteGratis,
      link: c.link.trim(),
      plataforma: c.link ? detectarPlataforma(c.link.trim()) : 'outra',
    }),
    [c],
  );
  const mensagem = useMemo(() => montarMensagem(oferta), [oferta]);
  const pct = desconto(oferta);

  function colar(novo: string) {
    setTexto(novo);
    if (!novo.trim()) return setC((old) => ({...VAZIO, chamada: old.chamada}));
    const e = extrair(novo);
    setC((old) => ({
      ...old,
      titulo: e.titulo,
      de: precoParaCampo(e.precoDe),
      por: precoParaCampo(e.precoPor),
      parcelas: e.parcelas,
      cupom: e.cupom,
      freteGratis: e.freteGratis,
      link: e.link,
    }));
  }

  function mostrarAviso(msg: string) {
    setAviso(msg);
    setTimeout(() => setAviso(''), 2200);
  }

  async function copiar(txt: string, salvar: boolean) {
    await navigator.clipboard.writeText(txt);
    if (salvar && bancoAtivo && oferta.link) {
      startTransition(async () => {
        const r = await salvarOferta(oferta);
        mostrarAviso(r.ok ? 'Copiado e salvo no histórico ✓' : `Copiado ✓ (não salvou: ${r.erro})`);
      });
    } else {
      mostrarAviso('Mensagem copiada ✓');
    }
  }

  function reusar(o: OfertaSalva) {
    setTexto('');
    setC({
      chamada: o.chamada || CHAMADAS[0],
      titulo: o.titulo,
      de: precoParaCampo(o.preco_de),
      por: precoParaCampo(o.preco_por),
      parcelas: o.parcelas,
      cupom: o.cupom,
      freteGratis: o.frete_gratis,
      link: o.link,
    });
    window.scrollTo({top: 0, behavior: 'smooth'});
  }

  const faltando = [!oferta.link && 'link', !oferta.precoPor && 'preço "por"', !oferta.titulo && 'nome'].filter(Boolean);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-6">
      <header className="mb-6 flex flex-wrap items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-full bg-[#FFE600] text-2xl shadow-sm">🛒</div>
        <div className="mr-auto">
          <h1 className="text-xl font-extrabold tracking-tight text-[#2D3277]">Conversor de Achadinhos</h1>
          <p className="text-sm text-neutral-500">Cola o link ou o texto do ML/Shopee e sai a mensagem pronta pro grupo</p>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ------- Entrada + ajustes ------- */}
        <section className="space-y-5 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <Campo label="1. Cole aqui o link ou o texto compartilhado">
            <textarea
              value={texto}
              onChange={(e) => colar(e.target.value)}
              rows={4}
              placeholder={'Ex.: Olha o que encontrei no Mercado Livre! Fone Bluetooth JBL de R$ 189,90 por R$ 79,90 https://meli.la/...'}
              className={`${inputCls} resize-y`}
            />
          </Campo>

          <div>
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-neutral-500">2. Confira e ajuste</span>
            <div className="mb-4 flex flex-wrap gap-2">
              {CHAMADAS.map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => set('chamada', ch)}
                  className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                    c.chamada === ch ? 'bg-[#2D3277] text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                  }`}
                >
                  {ch.replace(/\s\S+$/u, '')}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              <Campo label="Nome do produto">
                <input value={c.titulo} onChange={(e) => set('titulo', e.target.value)} className={inputCls} placeholder="Fone Bluetooth JBL Tune 520" />
              </Campo>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="De (R$)">
                  <input value={c.de} onChange={(e) => set('de', e.target.value)} inputMode="decimal" className={inputCls} placeholder="189,90" />
                </Campo>
                <Campo label="Por (R$)">
                  <input value={c.por} onChange={(e) => set('por', e.target.value)} inputMode="decimal" className={`${inputCls} font-bold`} placeholder="79,90" />
                </Campo>
              </div>
              {pct !== null && (
                <p className="text-sm font-semibold text-green-700">
                  {pct}% OFF · economia de {formatarBRL((oferta.precoDe ?? 0) - (oferta.precoPor ?? 0))}
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Parcelamento">
                  <input value={c.parcelas} onChange={(e) => set('parcelas', e.target.value)} className={inputCls} placeholder="10x de R$ 7,99 sem juros" />
                </Campo>
                <Campo label="Cupom">
                  <input value={c.cupom} onChange={(e) => set('cupom', e.target.value)} className={`${inputCls} uppercase`} placeholder="ACHADO10" />
                </Campo>
              </div>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-neutral-50 px-3 py-2.5">
                <input type="checkbox" checked={c.freteGratis} onChange={(e) => set('freteGratis', e.target.checked)} className="h-5 w-5 accent-[#2D3277]" />
                <span className="text-[15px] font-medium">🚚 Frete grátis</span>
              </label>
              <Campo label="Link (o seu de afiliado)">
                <div className="flex items-center gap-2">
                  <input value={c.link} onChange={(e) => set('link', e.target.value)} className={inputCls} placeholder="https://meli.la/..." />
                  {c.link && (
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${COR_PLATAFORMA[oferta.plataforma]}`}>
                      {NOME_PLATAFORMA[oferta.plataforma]}
                    </span>
                  )}
                </div>
              </Campo>
            </div>
          </div>
        </section>

        {/* ------- Prévia ------- */}
        <section className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-3xl bg-[#EFE7DE] p-4 shadow-sm ring-1 ring-black/5">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-600">
              <span className="h-2 w-2 rounded-full bg-[#25D366]" /> Prévia no WhatsApp
            </div>
            <div className="max-w-[440px] rounded-2xl rounded-tl-none bg-white p-3.5 shadow-sm">
              <PreviewWhats texto={mensagem} />
            </div>
          </div>

          {faltando.length > 0 && (
            <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">Falta preencher: {faltando.join(', ')}</p>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => copiar(mensagem, true)}
              disabled={salvando}
              className="rounded-2xl bg-[#FFE600] px-4 py-3.5 text-[15px] font-extrabold text-[#2D3277] shadow-sm transition hover:brightness-95 active:scale-[0.98] disabled:opacity-60"
            >
              {salvando ? 'Salvando…' : '📋 Copiar mensagem'}
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(mensagem)}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl bg-[#25D366] px-4 py-3.5 text-center text-[15px] font-extrabold text-white shadow-sm transition hover:brightness-95 active:scale-[0.98]"
            >
              Mandar no WhatsApp
            </a>
          </div>
          {!bancoAtivo && (
            <p className="mt-3 text-xs text-neutral-500">Histórico desligado: configure o DATABASE_URL do Neon no .env.local pra salvar as ofertas.</p>
          )}
        </section>
      </div>

      {/* ------- Histórico ------- */}
      {bancoAtivo && (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-extrabold text-[#2D3277]">Últimas ofertas</h2>
          {historico.length === 0 ? (
            <p className="rounded-2xl bg-white p-5 text-sm text-neutral-500 ring-1 ring-black/5">Nada ainda. Quando você copiar uma mensagem ela aparece aqui.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {historico.map((o) => (
                <li key={o.id} className="flex flex-col rounded-2xl bg-white p-4 ring-1 ring-black/5">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${COR_PLATAFORMA[(o.plataforma as Plataforma) ?? 'outra']}`}>
                      {NOME_PLATAFORMA[(o.plataforma as Plataforma) ?? 'outra']}
                    </span>
                    <time className="text-xs text-neutral-400">
                      {new Date(o.criado_em).toLocaleString('pt-BR', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'})}
                    </time>
                  </div>
                  <p className="line-clamp-2 font-semibold leading-snug">{o.titulo || 'Sem nome'}</p>
                  <p className="mt-1 text-sm">
                    {o.preco_de && <s className="mr-2 text-neutral-400">{formatarBRL(o.preco_de)}</s>}
                    {o.preco_por && <b className="text-green-700">{formatarBRL(o.preco_por)}</b>}
                  </p>
                  <div className="mt-3 flex gap-2 pt-1 text-sm font-semibold">
                    <button onClick={() => copiar(o.mensagem, false)} className="rounded-lg bg-neutral-100 px-3 py-1.5 hover:bg-neutral-200">Copiar</button>
                    <button onClick={() => reusar(o)} className="rounded-lg bg-neutral-100 px-3 py-1.5 hover:bg-neutral-200">Editar</button>
                    <button
                      onClick={() => confirm('Excluir essa oferta do histórico?') && startTransition(() => excluirOferta(o.id))}
                      className="ml-auto rounded-lg px-3 py-1.5 text-red-600 hover:bg-red-50"
                    >
                      Excluir
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {aviso && (
        <div className="fixed inset-x-0 bottom-6 z-50 mx-auto w-fit rounded-full bg-[#111B21] px-5 py-3 text-sm font-semibold text-white shadow-lg">
          {aviso}
        </div>
      )}
    </div>
  );
}
