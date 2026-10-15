import {NextResponse} from 'next/server';
import {sql} from '@/lib/db';

// Recebe os produtos coletados pela extensão do Chrome (protegido pelo EXTENSAO_TOKEN)

interface ProdutoIn {
  produtoId: string;
  origem?: string;
  titulo: string;
  precoDe?: number | null;
  precoPor?: number | null;
  imagem?: string;
  url: string;
  linkAfiliado?: string;
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, x-token',
};

const preco = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null);
const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export async function OPTIONS() {
  return new NextResponse(null, {headers: cors});
}

export async function POST(req: Request) {
  const token = process.env.EXTENSAO_TOKEN;
  if (!token || req.headers.get('x-token') !== token) {
    return NextResponse.json({erro: 'Token inválido'}, {status: 401, headers: cors});
  }
  if (!sql) return NextResponse.json({erro: 'Banco não configurado'}, {status: 503, headers: cors});

  const body = await req.json().catch(() => null);
  const lista: ProdutoIn[] = Array.isArray(body?.produtos) ? body.produtos.slice(0, 100) : [];

  let novos = 0;
  let atualizados = 0;
  for (const p of lista) {
    const produtoId = texto(p.produtoId, 40);
    const titulo = texto(p.titulo, 300);
    const url = texto(p.url, 1000);
    if (!produtoId || !titulo || !/^https:\/\//.test(url)) continue;

    const link = texto(p.linkAfiliado, 1000);
    const [r] = await sql`
      insert into produtos (produto_id, origem, titulo, preco_de, preco_por, imagem, url, link_afiliado)
      values (${produtoId}, ${texto(p.origem, 20) || 'mercadolivre'}, ${titulo}, ${preco(p.precoDe)}, ${preco(p.precoPor)},
              ${texto(p.imagem, 1000)}, ${url}, ${link})
      on conflict (produto_id) do update set
        titulo = excluded.titulo,
        preco_de = excluded.preco_de,
        preco_por = excluded.preco_por,
        imagem = case when excluded.imagem <> '' then excluded.imagem else produtos.imagem end,
        url = excluded.url,
        link_afiliado = case when excluded.link_afiliado <> '' then excluded.link_afiliado else produtos.link_afiliado end,
        -- Coletou de novo um produto descartado/com erro e agora ele tem link: volta pra Novos
        status = case
          when produtos.status = 'erro' then 'novo'
          when produtos.status = 'descartado' and excluded.link_afiliado <> '' and produtos.link_afiliado = '' then 'novo'
          else produtos.status
        end,
        atualizado_em = now()
      returning (xmax = 0) as inserido
    `;
    if (r?.inserido) novos++;
    else atualizados++;
  }

  return NextResponse.json({novos, atualizados}, {headers: cors});
}
