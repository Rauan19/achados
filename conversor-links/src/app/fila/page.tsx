import {Fila} from '@/components/Fila';
import {sql} from '@/lib/db';
import {STATUS, contarPorStatus, listarProdutos, type StatusProduto} from '@/lib/produtos';

export const dynamic = 'force-dynamic';

export default async function PaginaFila({searchParams}: {searchParams: Promise<{status?: string}>}) {
  const {status: s} = await searchParams;
  const status: StatusProduto = STATUS.includes(s as StatusProduto) ? (s as StatusProduto) : 'novo';
  const [produtos, contagem] = await Promise.all([
    listarProdutos(status).catch(() => []),
    contarPorStatus().catch(() => ({novo: 0, aprovado: 0, enviado: 0, descartado: 0, erro: 0})),
  ]);
  return <Fila produtos={produtos} contagem={contagem} status={status} bancoAtivo={sql !== null} />;
}
