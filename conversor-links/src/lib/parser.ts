// Lê o texto/link bagunçado que vem do Mercado Livre ou da Shopee e separa as partes.

export type Plataforma = 'mercadolivre' | 'shopee' | 'outra';

export interface Extraido {
  link: string;
  plataforma: Plataforma;
  titulo: string;
  precoDe: number | null;
  precoPor: number | null;
  parcelas: string;
  cupom: string;
  freteGratis: boolean;
}

const URL_RE = /https?:\/\/[^\s<>"']+/gi;
const PRECO_RE = /R\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)/gi;
const PARCELAS_RE = /(\d{1,2})\s*x\s*(?:de\s*)?R\$\s*([\d.]+(?:,\d{1,2})?)(\s*sem\s*juros)?/i;

// Frases que os apps colocam no texto compartilhado e não fazem parte do nome
const LIXO_INICIO = [
  /^(olha\s+(s[oó]\s+)?o\s+que\s+(eu\s+)?encontrei(\s+n[oa]\s+(mercado\s*livre|shopee))?\s*[!:.]*\s*)/i,
  /^(confira\s+(este|esse|isso|o\s+produto)?\s*(produto)?[!:.]?\s*)/i,
  /^(d[aá]\s+uma\s+olhada(\s+n(esse|este|isso))?[!:.]?\s*)/i,
  /^(veja\s+(s[oó]\s+)?(isso|este|esse)?[!:.]?\s*)/i,
  /^(achei|encontrei|aproveite|compre)\b[^:]*?:\s*/i,
];
const LIXO_FIM = [
  /\s*(n[ao]|pela|via)\s+(shopee|mercado\s*livre)\b.*$/i,
  /\s*compre\s+(j[aá]|agora|aqui|na\s+shopee)\b.*$/i,
  /\s*(por|a\s+partir\s+de|apenas|s[oó])\s*$/i,
  /[\s\-–|:!.,]+$/,
];

export function detectarPlataforma(url: string): Plataforma {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (/mercadoli(vre|bre)|meli\.la|mercadopago/.test(host)) return 'mercadolivre';
    if (/shopee|shope\.ee/.test(host)) return 'shopee';
  } catch {}
  return 'outra';
}

/** "1.299,90" -> 1299.9 | "79,9" -> 79.9 | "79.90" -> 79.9 */
export function lerPreco(txt: string): number | null {
  const limpo = txt.replace(/[R$\s]/g, '');
  if (!limpo) return null;
  let n: number;
  if (limpo.includes(',')) n = Number(limpo.replace(/\./g, '').replace(',', '.'));
  else if (/^\d{1,3}(\.\d{3})+$/.test(limpo)) n = Number(limpo.replace(/\./g, ''));
  else n = Number(limpo);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

// Tira o nome do produto da URL quando o texto não tem nome
function tituloDaUrl(url: string): string {
  try {
    const u = new URL(url);
    let slug = '';
    // produto.mercadolivre.com.br/MLB-123456-fone-bluetooth-jbl-_JM
    const ml = u.pathname.match(/MLB-?\d+-([^/]+?)(?:-_JM)?$/i);
    // www.mercadolivre.com.br/fone-bluetooth-jbl/p/MLB123
    const mlp = u.pathname.match(/^\/([^/]+)\/p\/MLB/i);
    // shopee.com.br/Fone-Bluetooth-XYZ-i.123.456
    const sh = u.pathname.match(/^\/(.+?)-i\.\d+\.\d+/);
    slug = (ml?.[1] || mlp?.[1] || sh?.[1] || '');
    if (!slug) return '';
    return decodeURIComponent(slug)
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
      .replace(/(^|\s)\S/g, (c) => c.toUpperCase());
  } catch {
    return '';
  }
}

function limparTitulo(linha: string): string {
  let t = linha.trim();
  for (const re of LIXO_INICIO) t = t.replace(re, '');
  // "Fone XYZ por R$ 49,90" -> "Fone XYZ"
  t = t.split(/\s+(?:por|de|a\s+partir\s+de)\s+R\$|\s*R\$/i)[0];
  for (let i = 0; i < 2; i++) for (const re of LIXO_FIM) t = t.replace(re, '');
  return t.replace(/^[\s"'“”*_~\-–|:!.,🔥⚡✅❌📦🛒]+/u, '').replace(/[*_~]+/g, '').trim();
}

export function extrair(texto: string): Extraido {
  const urls = (texto.match(URL_RE) || []).map((u) => u.replace(/[).,!?\]]+$/, ''));
  const link = urls.find((u) => detectarPlataforma(u) !== 'outra') || urls[0] || '';
  const plataforma = link ? detectarPlataforma(link) : 'outra';

  let resto = texto.replace(URL_RE, ' ');

  // Parcelamento ("10x de R$ 7,99 sem juros") sai antes pra não ser confundido com o preço
  let parcelas = '';
  const p = resto.match(PARCELAS_RE);
  if (p) {
    const valor = lerPreco(p[2]);
    if (valor) parcelas = `${p[1]}x de ${formatarBRL(valor)}${p[3] ? ' sem juros' : ''}`;
    resto = resto.replace(p[0], ' ');
  }

  const precos = [...resto.matchAll(PRECO_RE)].map((m) => lerPreco(m[1])).filter((n): n is number => n !== null);
  let precoPor: number | null = null;
  let precoDe: number | null = null;
  if (precos.length) {
    precoPor = Math.min(...precos);
    const maior = Math.max(...precos);
    if (maior > precoPor) precoDe = maior;
  }

  const cupom = (resto.match(/cupom\s*(?:de\s+desconto)?\s*[:\-]?\s*([A-Z0-9]{4,20})\b/i)?.[1] || '').toUpperCase();
  const freteGratis = /frete\s+gr[aá]tis/i.test(resto);

  const candidatas = resto
    .split(/\n+/)
    .map(limparTitulo)
    .filter((l) => /[a-zà-ú]{2,}/i.test(l) && l.split(/\s+/).length >= 2)
    .filter((l) => !/^(cupom|frete|parcel|link|pre[cç]o|de\s|por\s|economize|desconto)/i.test(l));
  const titulo = candidatas[0] || tituloDaUrl(link);

  return {link, plataforma, titulo, precoDe, precoPor, parcelas, cupom, freteGratis};
}

export function formatarBRL(v: number): string {
  return v.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}).replace(/ /g, ' ');
}
