const PADRAO = {url: 'http://localhost:3000', token: '', descontoMin: 20, maximo: 150, pausaMin: 2, pausaMax: 4, pegarLink: true};
const CAMPOS = Object.keys(PADRAO).filter((k) => k !== 'pegarLink');
const $ = (id) => document.getElementById(id);
const brl = (v) => v.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});

async function carregar() {
  const cfg = await chrome.storage.sync.get(PADRAO);
  for (const k of CAMPOS) $(k).value = cfg[k];
  $('pegarLink').checked = cfg.pegarLink;
  const {progresso, coletados = [], diagnostico} = await chrome.storage.local.get(['progresso', 'coletados', 'diagnostico']);
  mostrarProgresso(progresso, cfg.token);
  mostrarLista(coletados);
  $('diag').style.display = diagnostico ? 'block' : 'none';
}

function mostrarProgresso(p, token) {
  if (!p) {
    if (!token) $('status').innerHTML += '<br><small>Sem token: os produtos ficam só aqui na extensão.</small>';
    return;
  }
  const linhas = [
    p.rodando ? '⏳ <b>Coletando…</b> (pode fechar esta janela)' : '✅ <b>Terminou</b>',
    `Coletados: <b>${p.coletados}</b> · Enviados pro sistema: <b>${p.enviados}</b>`,
    p.enviados ? `Na fila do sistema: <b>${p.novos}</b> novos · <b>${p.atualizados ?? 0}</b> atualizados` : '',
    p.coletados ? `🔗 Com link de afiliado: <b>${p.comLink ?? 0}</b> · Sem link: <b>${p.semLink ?? 0}</b>` : '',
    p.ignorados ? `Ignorados (desconto baixo): ${p.ignorados}` : '',
    p.erro ? `<span class="erro">⚠️ ${p.erro}</span>` : '',
  ];
  $('status').innerHTML = linhas.filter(Boolean).join('<br>');
  $('coletar').style.display = p.rodando ? 'none' : 'block';
  $('parar').style.display = p.rodando ? 'block' : 'none';
}

function mostrarLista(lista) {
  $('qtd').textContent = lista.length;
  const ul = $('lista');
  ul.replaceChildren();
  if (!lista.length) {
    const vazio = document.createElement('div');
    vazio.className = 'vazio';
    vazio.textContent = 'Nenhum produto ainda.';
    ul.append(vazio);
    return;
  }
  for (const p of lista) {
    const li = document.createElement('li');
    li.title = 'Abrir no Mercado Livre';
    li.onclick = () => chrome.tabs.create({url: p.linkAfiliado || p.url});

    const img = document.createElement('img');
    img.src = p.imagem || '';
    img.alt = '';

    const info = document.createElement('div');
    const nome = document.createElement('div');
    nome.className = 'nome';
    nome.textContent = p.titulo;

    const precos = document.createElement('div');
    precos.className = 'precos';
    if (p.precoDe) precos.append(Object.assign(document.createElement('s'), {textContent: brl(p.precoDe)}));
    if (p.precoPor) precos.append(Object.assign(document.createElement('b'), {textContent: brl(p.precoPor)}));
    if (p.pct) precos.append(Object.assign(document.createElement('span'), {className: 'pct', textContent: `-${p.pct}%`}));
    precos.append(
      Object.assign(document.createElement('span'), {
        className: p.linkAfiliado ? 'link-ok' : 'link-falta',
        textContent: p.linkAfiliado ? '🔗 link de afiliado' : 'sem link de afiliado',
      }),
    );

    info.append(nome, precos);
    li.append(img, info);
    ul.append(li);
  }
}

chrome.storage.onChanged.addListener(async (mud, area) => {
  if (area !== 'local') return;
  if (mud.progresso) mostrarProgresso(mud.progresso.newValue, (await chrome.storage.sync.get(PADRAO)).token);
  if (mud.coletados) mostrarLista(mud.coletados.newValue || []);
  if (mud.diagnostico) $('diag').style.display = mud.diagnostico.newValue ? 'block' : 'none';
});

$('salvar').onclick = async () => {
  const cfg = {};
  for (const k of CAMPOS) cfg[k] = ['url', 'token'].includes(k) ? $(k).value.trim() : Number($(k).value) || PADRAO[k];
  cfg.url = (cfg.url || PADRAO.url).replace(/\/+$/, '');
  if (cfg.pausaMax < cfg.pausaMin) cfg.pausaMax = cfg.pausaMin;
  cfg.pegarLink = $('pegarLink').checked;
  // Sistema na internet (Vercel/VPS): pede permissão pra extensão falar com esse endereço
  if (!cfg.url.startsWith('http://localhost')) {
    const ok = await chrome.permissions.request({origins: [`${new URL(cfg.url).origin}/*`]});
    if (!ok) return ($('status').innerHTML = '<span class="erro">Sem permissão pra acessar o sistema.</span>');
  }
  await chrome.storage.sync.set(cfg);
  $('status').textContent = 'Configurações salvas ✓';
  $('config').open = false;
};

$('coletar').onclick = async () => {
  const [aba] = await chrome.tabs.query({active: true, currentWindow: true});
  if (!aba?.url?.includes('mercadolivre.com.br')) {
    $('status').innerHTML = '<span class="erro">Abra uma página do Mercado Livre primeiro.</span>';
    return;
  }
  await chrome.storage.local.set({progresso: {coletados: 0, enviados: 0, novos: 0, ignorados: 0, comLink: 0, semLink: 0, erro: '', rodando: true}});
  $('diag').style.display = 'none';
  // Gancho no contexto da página pra capturar o link quando o site copia (botão "Copiar link")
  await chrome.scripting.executeScript({target: {tabId: aba.id}, files: ['gancho.js'], world: 'MAIN'});
  await chrome.scripting.executeScript({target: {tabId: aba.id}, files: ['content.js']});
};

$('diag').onclick = async () => {
  const {diagnostico} = await chrome.storage.local.get('diagnostico');
  if (!diagnostico) return;
  await navigator.clipboard.writeText(diagnostico);
  $('diag').textContent = '✓ Copiado! Cole na conversa com o suporte';
};

$('parar').onclick = async () => {
  const [aba] = await chrome.tabs.query({active: true, currentWindow: true});
  if (aba) chrome.tabs.sendMessage(aba.id, {tipo: 'parar'}).catch(() => {});
  const {progresso} = await chrome.storage.local.get('progresso');
  if (progresso) chrome.storage.local.set({progresso: {...progresso, rodando: false}});
};

$('abrirFila').onclick = async () => {
  const {url} = await chrome.storage.sync.get(PADRAO);
  chrome.tabs.create({url: `${url}/fila`});
};

$('limpar').onclick = async () => {
  if (!confirm('Limpar a lista da extensão? (o que já foi pra fila do sistema continua lá)')) return;
  await chrome.storage.local.set({coletados: [], progresso: null});
  $('status').textContent = 'Lista limpa.';
};

// Planilha pra abrir no Excel/Google Sheets
$('csv').onclick = async () => {
  const {coletados = []} = await chrome.storage.local.get('coletados');
  if (!coletados.length) return;
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const num = (v) => (v ? String(v).replace('.', ',') : '');
  const linhas = [
    ['Produto', 'De', 'Por', 'Desconto %', 'Link de afiliado', 'Link do produto', 'Imagem'].map(esc).join(';'),
    ...coletados.map((p) => [p.titulo, num(p.precoDe), num(p.precoPor), p.pct || '', p.linkAfiliado, p.url, p.imagem].map(esc).join(';')),
  ];
  const blob = new Blob(['﻿' + linhas.join('\n')], {type: 'text/csv;charset=utf-8'});
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: `achadinhos-${new Date().toISOString().slice(0, 10)}.csv`,
  });
  a.click();
};

carregar();
