'use client';

import Link from 'next/link';
import {useMemo, useState, useTransition} from 'react';
import {aprovarProdutos, excluirProdutos, mudarStatus, salvarProduto} from '@/app/actions';
import {desconto} from '@/lib/mensagem';
import {formatarBRL} from '@/lib/parser';
import type {Produto, StatusProduto} from '@/lib/produtos';

const ABAS: {status: StatusProduto; nome: string}[] = [
  {status: 'novo', nome: 'Novos'},
  {status: 'aprovado', nome: 'Na fila do bot'},
  {status: 'enviado', nome: 'Enviados'},
  {status: 'descartado', nome: 'Descartados'},
  {status: 'erro', nome: 'Com erro'},
];

const inputCls =
  'w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[#2D3277] focus:ring-2 focus:ring-[#2D3277]/15';

function CardProduto({p, selecionado, alternar}: {p: Produto; selecionado: boolean; alternar: () => void}) {
  const [titulo, setTitulo] = useState(p.titulo);
  const [link, setLink] = useState(p.link_afiliado);
  const [pendente, start] = useTransition();
  const pct = desconto({precoDe: p.preco_de, precoPor: p.preco_por});
  const mudou = titulo !== p.titulo || link !== p.link_afiliado;

  return (
    <li className={`flex flex-col overflow-hidden rounded-2xl bg-white ring-1 transition ${selecionado ? 'ring-2 ring-[#2D3277]' : 'ring-black/5'}`}>
      <div className="relative aspect-[4/3] bg-neutral-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {p.imagem && <img src={p.imagem} alt="" className="h-full w-full object-contain p-2" loading="lazy" />}
        <label className="absolute left-2 top-2 grid h-8 w-8 cursor-pointer place-items-center rounded-lg bg-white/90 shadow">
          <input type="checkbox" checked={selecionado} onChange={alternar} className="h-4 w-4 accent-[#2D3277]" />
        </label>
        {pct !== null && <span className="absolute right-2 top-2 rounded-full bg-[#FF2E3B] px-2.5 py-1 text-xs font-extrabold text-white">-{pct}%</span>}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <textarea value={titulo} onChange={(e) => setTitulo(e.target.value)} rows={2} className={`${inputCls} resize-none font-semibold`} />
        <p className="text-sm">
          {p.preco_de && <s className="mr-2 text-neutral-400">{formatarBRL(p.preco_de)}</s>}
          {p.preco_por ? <b className="text-green-700">{formatarBRL(p.preco_por)}</b> : <span className="text-amber-700">sem preço</span>}
        </p>
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="Cole o link de afiliado"
          className={`${inputCls} ${link ? '' : 'border-amber-400 bg-amber-50'}`}
        />
        {p.erro && <p className="text-xs text-red-600">{p.erro}</p>}
        {p.enviado_em && (
          <p className="text-xs text-neutral-500">
            Enviado {new Date(p.enviado_em).toLocaleString('pt-BR', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'})}
            {p.enviado_por && ` pelo número ${p.enviado_por}`}
          </p>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1 text-xs font-semibold">
          <a href={p.url} target="_blank" rel="noreferrer" className="text-[#027EB5] underline">
            ver no ML
          </a>
          {mudou && (
            <button
              disabled={pendente}
              onClick={() => start(() => salvarProduto(p.id, {titulo, linkAfiliado: link}))}
              className="ml-auto rounded-lg bg-[#2D3277] px-3 py-1.5 text-white disabled:opacity-60"
            >
              {pendente ? 'Salvando…' : 'Salvar'}
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

export function Fila({
  produtos,
  contagem,
  status,
  bancoAtivo,
}: {
  produtos: Produto[];
  contagem: Record<StatusProduto, number>;
  status: StatusProduto;
  bancoAtivo: boolean;
}) {
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [descontoMin, setDescontoMin] = useState('');
  const [aviso, setAviso] = useState('');
  const [pendente, start] = useTransition();

  const visiveis = useMemo(() => {
    const min = Number(descontoMin) || 0;
    return produtos.filter((p) => (desconto({precoDe: p.preco_de, precoPor: p.preco_por}) ?? 0) >= min);
  }, [produtos, descontoMin]);

  const ids = [...selecionados];
  const alternar = (id: number) =>
    setSelecionados((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const todosMarcados = visiveis.length > 0 && visiveis.every((p) => selecionados.has(p.id));

  function acao(fn: () => Promise<unknown>, msg?: (r: unknown) => string) {
    start(async () => {
      const r = await fn();
      setSelecionados(new Set());
      if (msg) {
        setAviso(msg(r));
        setTimeout(() => setAviso(''), 3500);
      }
    });
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-28 pt-6">
      <header className="mb-5 flex flex-wrap items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-full bg-[#FFE600] text-2xl shadow-sm">📥</div>
        <div className="mr-auto">
          <h1 className="text-xl font-extrabold tracking-tight text-[#2D3277]">Fila de ofertas</h1>
          <p className="text-sm text-neutral-500">Produtos coletados pela extensão. Aprove os que o bot deve mandar no grupo.</p>
        </div>
      </header>

      {!bancoAtivo && (
        <p className="mb-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Configure o DATABASE_URL do Neon no .env.local e rode <code>npm run db:setup</code> pra usar a fila.
        </p>
      )}

      {status === 'novo' && produtos.some((p) => !p.link_afiliado) && (
        <div className="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
          <b>{produtos.filter((p) => !p.link_afiliado).length} produto(s) sem link de afiliado.</b> O bot só envia oferta com o{' '}
          <b>seu</b> link (pra você não perder a comissão). Cole o link (botão <b>Compartilhar</b> na Central de Afiliados) no campo
          amarelo do card, clique em <b>Salvar</b> e depois aprove.
        </div>
      )}

      <nav className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {ABAS.map((a) => (
          <Link
            key={a.status}
            href={`/fila?status=${a.status}`}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
              status === a.status ? 'bg-[#2D3277] text-white' : 'bg-white text-neutral-700 ring-1 ring-black/10 hover:bg-neutral-50'
            }`}
          >
            {a.nome} <span className="opacity-70">{contagem[a.status]}</span>
          </Link>
        ))}
      </nav>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-black/5">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={todosMarcados}
            onChange={() => setSelecionados(todosMarcados ? new Set() : new Set(visiveis.map((p) => p.id)))}
            className="h-4 w-4 accent-[#2D3277]"
          />
          Marcar todos ({visiveis.length})
        </label>
        <label className="flex items-center gap-2 text-sm">
          Desconto mínimo
          <input value={descontoMin} onChange={(e) => setDescontoMin(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="0" className={`${inputCls} w-16`} />%
        </label>
        <span className="ml-auto text-sm text-neutral-500">{ids.length} selecionado(s)</span>
      </div>

      {visiveis.length === 0 ? (
        <p className="rounded-2xl bg-white p-8 text-center text-sm text-neutral-500 ring-1 ring-black/5">
          {status === 'novo' ? 'Nenhum produto novo. Abra o painel de afiliados do ML e clique em “Coletar” na extensão.' : 'Nada por aqui.'}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visiveis.map((p) => (
            <CardProduto key={`${p.id}-${p.titulo}-${p.link_afiliado}`} p={p} selecionado={selecionados.has(p.id)} alternar={() => alternar(p.id)} />
          ))}
        </ul>
      )}

      {ids.length > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-40 mx-auto flex w-fit flex-wrap justify-center gap-2 rounded-2xl bg-[#111B21] p-2 shadow-xl">
          {status !== 'aprovado' && status !== 'enviado' && (
            <button
              disabled={pendente}
              onClick={() =>
                acao(
                  () => aprovarProdutos(ids),
                  (r) => {
                    const {aprovados, semLink} = r as {aprovados: number; semLink: number};
                    return `${aprovados} na fila do bot${semLink ? ` · ${semLink} sem link de afiliado (cole o link e aprove de novo)` : ''}`;
                  },
                )
              }
              className="rounded-xl bg-[#FFE600] px-4 py-2 text-sm font-extrabold text-[#2D3277] disabled:opacity-60"
            >
              ✅ Aprovar
            </button>
          )}
          {status !== 'novo' && (
            <button disabled={pendente} onClick={() => acao(() => mudarStatus(ids, 'novo'))} className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold text-white">
              ↩ Voltar pra novos
            </button>
          )}
          {status !== 'descartado' && (
            <button disabled={pendente} onClick={() => acao(() => mudarStatus(ids, 'descartado'))} className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold text-white">
              Descartar
            </button>
          )}
          {status === 'descartado' && (
            <button
              disabled={pendente}
              onClick={() => confirm(`Apagar ${ids.length} produto(s) de vez?`) && acao(() => excluirProdutos(ids))}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white"
            >
              Apagar
            </button>
          )}
        </div>
      )}

      {aviso && (
        <div className="fixed inset-x-0 top-4 z-50 mx-auto w-fit max-w-[90vw] rounded-full bg-[#111B21] px-5 py-3 text-center text-sm font-semibold text-white shadow-lg">
          {aviso}
        </div>
      )}
    </div>
  );
}
