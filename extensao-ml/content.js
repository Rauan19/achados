// Injetado na aba do Mercado Livre quando você clica em "Coletar".
// Rola a página com calma, lê os cards de produto, clica em "Compartilhar" pra pegar o
// link de afiliado e manda em lotes pro sistema.

(async () => {
  if (window.__coletor?.rodando) return;
  const estado = (window.__coletor = {rodando: true});

  const cfg = await chrome.storage.sync.get({token: '', descontoMin: 20, maximo: 150, pausaMin: 2, pausaMax: 4, pegarLink: true});
  const progresso = {coletados: 0, enviados: 0, novos: 0, ignorados: 0, comLink: 0, semLink: 0, erro: '', rodando: true, pagina: location.href};

  // Lista que aparece no popup (continua da última coleta)
  const {coletados: lista = []} = await chrome.storage.local.get('coletados');
  const porId = new Map(lista.map((p) => [p.produtoId, p]));
  const vistosNestaRodada = new Set();
  let enviarAtivo = Boolean(cfg.token); // sem token (ou se o sistema der erro) só coleta e mostra na extensão
  let pegarLinkAtivo = cfg.pegarLink;
  let falhasSeguidas = 0;
  let ritmo = 1; // aumenta se o ML reclamar de muitos links seguidos

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.tipo === 'parar') estado.rodando = false;
  });

  const salvarProgresso = () => chrome.storage.local.set({progresso});
  const salvarLista = () => chrome.storage.local.set({coletados: [...porId.values()].sort((a, b) => b.coletadoEm - a.coletadoEm).slice(0, 500)});
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
  const aleatorio = (min, max) => (min + Math.random() * (max - min)) * 1000;
  const visivel = (el) => el && el.offsetParent !== null && el.getClientRects().length > 0;

  // ---------- leitura dos cards ----------

  const ID_RE = /MLB-?(\d{6,})/i;
  const AFILIADO_RE = /https?:\/\/(?:meli\.la\/[\w-]+|(?:www\.)?mercadolivre\.com(?:\.br)?\/(?:sec|social)\/[\w\-./?=&%]+)/i;
  const AFILIADO_RE_G = new RegExp(AFILIADO_RE.source, 'gi');

  // Preço no padrão do ML: <span class="andes-money-amount"> com __fraction e __cents
  function lerPreco(el) {
    const fracao = el.querySelector('.andes-money-amount__fraction')?.textContent?.replace(/\D/g, '');
    if (!fracao) return null;
    const centavos = (el.querySelector('.andes-money-amount__cents')?.textContent || '0').replace(/\D/g, '').padEnd(2, '0');
    return Number(fracao) + Number(centavos.slice(0, 2)) / 100;
  }

  function precosDoCard(card) {
    let de = null;
    let por = null;
    for (const el of card.querySelectorAll('.andes-money-amount')) {
      if (el.closest('[class*="installment"], [class*="parcel"]')) continue; // parcela não é preço
      const valor = lerPreco(el);
      if (!valor) continue;
      const anterior = el.className.includes('--previous') || el.closest('s, del, [class*="original"], [class*="previous"]');
      if (anterior) de ??= valor;
      else por ??= valor;
    }
    if (por === null) {
      const nums = [...card.innerText.matchAll(/R\$\s*([\d.]+(?:,\d{2})?)/g)].map((m) => Number(m[1].replace(/\./g, '').replace(',', '.')));
      if (nums.length) {
        por = Math.min(...nums);
        if (Math.max(...nums) > por) de = Math.max(...nums);
      }
    }
    if (de !== null && por !== null && de <= por) de = null;
    return {de, por};
  }

  // Sobe a partir do link do produto até achar o "card" (tem preço e imagem, e é de um produto só)
  function acharCard(link, id) {
    let el = link;
    for (let i = 0; i < 10 && el.parentElement; i++) {
      el = el.parentElement;
      const ids = new Set([...el.querySelectorAll('a[href*="MLB"]')].map((a) => a.href.match(ID_RE)?.[1]).filter(Boolean));
      if (ids.size > 1) return null; // subiu demais: já é a lista
      if (el.querySelector('.andes-money-amount, [class*="price"]') && el.querySelector('img') && ids.has(id)) return el;
    }
    return null;
  }

  function linkNoElemento(raiz) {
    for (const el of raiz.querySelectorAll('a[href], [data-url], [data-link], input, textarea')) {
      const v = el.href || el.dataset?.url || el.dataset?.link || el.value || '';
      const m = v.match(AFILIADO_RE);
      if (m) return m[0];
    }
    return (raiz.innerText || '').match(AFILIADO_RE)?.[0] || '';
  }

  function lerCard(card, link, id) {
    const titulo =
      card.querySelector('h2, h3, [class*="title"]')?.textContent?.trim() || link.getAttribute('title') || card.querySelector('img')?.alt || '';
    const {de, por} = precosDoCard(card);
    const img = card.querySelector('img');
    const imagem = img?.currentSrc || img?.src || img?.dataset?.src || '';
    const pctTexto = Number(card.innerText.match(/(\d{1,2})\s*%\s*OFF/i)?.[1] || 0);
    const url = new URL(link.href);
    return {
      produtoId: `MLB${id}`,
      origem: 'mercadolivre',
      titulo: titulo.replace(/\s+/g, ' ').slice(0, 300),
      precoDe: de,
      precoPor: por,
      imagem: imagem.startsWith('http') ? imagem : '',
      url: `${url.origin}${url.pathname}`,
      linkAfiliado: linkNoElemento(card),
      pct: de && por ? Math.round((1 - por / de) * 100) : pctTexto,
    };
  }

  // ---------- link de afiliado pelo botão "Compartilhar" ----------

  // Captura o que a página copiar pra área de transferência (o gancho roda no contexto da página)
  let ultimaCopia = {texto: '', quando: 0};
  window.addEventListener('message', (e) => {
    if (e.source === window && typeof e.data?.__achadinhosCopia === 'string') ultimaCopia = {texto: e.data.__achadinhosCopia, quando: Date.now()};
  });

  const TEXTO_BOTAO = (b) => `${b.textContent || ''} ${b.getAttribute('aria-label') || ''} ${b.title || ''}`.replace(/\s+/g, ' ').trim();
  function acharBotao(raiz, re) {
    return [...raiz.querySelectorAll('button, a, [role="button"]')].find((b) => visivel(b) && re.test(TEXTO_BOTAO(b)));
  }

  const SELETOR_JANELA = '[role="dialog"], [aria-modal="true"], .andes-modal, .andes-modal__container, .andes-tooltip, .andes-popper';
  function janelasAbertas() {
    const porSeletor = [...document.querySelectorAll(SELETOR_JANELA)].filter(visivel);
    if (porSeletor.length) return porSeletor;
    // Fallback: a janela "Compartilhe para ganhar dinheiro" achada pelo título
    const titulo = [...document.querySelectorAll('h1, h2, h3, p, span, div')].find(
      (el) => visivel(el) && el.children.length === 0 && /compartilhe para ganhar/i.test(el.textContent),
    );
    let j = titulo;
    for (let i = 0; j && i < 6 && !/copiar\s*link/i.test(j.textContent); i++) j = j.parentElement;
    return j ? [j] : [];
  }

  // Acha o elemento clicável que tem exatamente esse texto (ex.: "Copiar link")
  function acharPorTexto(raiz, re) {
    const alvo = [...raiz.querySelectorAll('button, a, [role="button"], span, p, div')].find(
      (el) => visivel(el) && re.test(TEXTO_BOTAO(el)) && TEXTO_BOTAO(el).length < 40,
    );
    return alvo ? alvo.closest('button, a, [role="button"]') || alvo : null;
  }
  function linksVisiveisNasJanelas() {
    const achados = new Set();
    for (const j of janelasAbertas()) {
      for (const el of j.querySelectorAll('input, textarea, a[href]')) (el.value || el.href || '').match(AFILIADO_RE_G)?.forEach((l) => achados.add(l));
      (j.innerText || '').match(AFILIADO_RE_G)?.forEach((l) => achados.add(l));
    }
    return achados;
  }

  async function fecharJanela() {
    for (const j of janelasAbertas()) {
      const fechar =
        j.querySelector('[aria-label*="echar" i], [aria-label*="close" i], [class*="close"]') ||
        (j.closest('.andes-modal') || j.parentElement)?.querySelector('[aria-label*="echar" i], [aria-label*="close" i], [class*="close"]');
      if (fechar && visivel(fechar)) fechar.click();
    }
    document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
    document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
    await esperar(300);
  }

  async function salvarDiagnostico(card, motivo) {
    const janelas = janelasAbertas().map((j) => j.outerHTML.slice(0, 3000)).join('\n\n---\n\n');
    const botoes = [...card.querySelectorAll('button, a, [role="button"]')].map(TEXTO_BOTAO).filter(Boolean).slice(0, 20);
    await chrome.storage.local.set({
      diagnostico: [
        `Motivo: ${motivo}`,
        `Página: ${location.href}`,
        `Botões no card: ${JSON.stringify(botoes)}`,
        `Última cópia capturada: ${ultimaCopia.texto.slice(0, 200)}`,
        '',
        '=== CARD ===',
        card.outerHTML.slice(0, 4000),
        '',
        '=== JANELAS ABERTAS ===',
        janelas || '(nenhuma)',
      ].join('\n'),
    });
  }

  // Aviso de erro do próprio ML (snackbar/toast)
  function erroDoMl() {
    return [...document.querySelectorAll('.andes-snackbar, [role="alert"], [class*="snackbar"], [class*="toast"]')].some(
      (el) => visivel(el) && /erro|tente novamente|algo deu errado|muitas|aguarde|indispon/i.test(el.textContent || ''),
    );
  }

  // O botão "Compartilhar" fica no rodapé do card (li.poly-card). O painel só desenha os cards que
  // estão na tela, então rola até o card antes e aceita o botão mesmo se a checagem de visível falhar.
  async function acharBotaoCompartilhar(card) {
    card.scrollIntoView({block: 'center'});
    await esperar(500);
    let el = card;
    for (let i = 0; i < 4 && el; i++) {
      const candidatos = [...el.querySelectorAll('button, a, [role="button"]')].filter((b) =>
        /^compartilhar$|compartilhar|gerar\s+link/i.test(TEXTO_BOTAO(b)),
      );
      const b = candidatos.find(visivel) || candidatos[0];
      if (b) return b;
      const ids = new Set([...(el.parentElement?.querySelectorAll('a[href*="MLB"]') ?? [])].map((a) => a.href.match(ID_RE)?.[1]).filter(Boolean));
      if (ids.size > 1) break; // não sobe pro card do vizinho
      el = el.parentElement;
    }
    return null;
  }

  // Fluxo do painel de afiliados: Compartilhar -> janela "Compartilhe para ganhar dinheiro" -> Copiar link
  async function pegarLinkAfiliado(card) {
    const botao = await acharBotaoCompartilhar(card);
    if (!botao) {
      await salvarDiagnostico(card, 'não achei o botão Compartilhar no card');
      return {link: ''};
    }
    const antes = linksVisiveisNasJanelas();
    const inicio = Date.now();
    botao.scrollIntoView({block: 'center'});
    await esperar(300);
    botao.click();

    let cliqueiCopiar = 0;
    for (let i = 0; i < 30; i++) {
      await esperar(200);

      // 1) a página copiou algo depois que clicamos: é o link de afiliado
      if (ultimaCopia.quando > inicio) {
        const link = ultimaCopia.texto.match(AFILIADO_RE)?.[0] || (cliqueiCopiar ? ultimaCopia.texto.trim().match(/^https?:\/\/\S+$/)?.[0] : '');
        if (link) {
          await fecharJanela();
          return {link};
        }
      }
      // 2) o link apareceu escrito em algum campo da janela
      const novo = [...linksVisiveisNasJanelas()].find((l) => !antes.has(l));
      if (novo) {
        await fecharJanela();
        return {link: novo};
      }
      // 4) o ML mostrou mensagem de erro (gerando link rápido demais)
      if (i > 2 && erroDoMl()) {
        await fecharJanela();
        return {link: '', erroMl: true};
      }
      // 3) janela aberta: clica em "Copiar link" (tenta de novo se demorar)
      if (cliqueiCopiar < 2 && (cliqueiCopiar === 0 || i % 10 === 0)) {
        for (const j of janelasAbertas()) {
          const copiar = acharPorTexto(j, /^copiar\s*link$/i);
          if (copiar) {
            copiar.click();
            cliqueiCopiar++;
            break;
          }
        }
      }
    }
    await salvarDiagnostico(card, cliqueiCopiar ? 'cliquei em Copiar link mas não capturei o link' : 'abri o Compartilhar mas não achei o "Copiar link"');
    await fecharJanela();
    return {link: ''};
  }

  // ---------- envio ----------

  let lote = [];
  async function enviarLote() {
    if (!lote.length || !enviarAtivo) return;
    const envio = lote.map(({pct, coletadoEm, ...p}) => p);
    lote = [];
    const r = await chrome.runtime.sendMessage({tipo: 'enviar', produtos: envio});
    if (r?.erro) {
      progresso.erro = `${r.erro}. Continuo coletando só na extensão.`;
      enviarAtivo = false;
    } else {
      progresso.enviados += envio.length;
      progresso.novos += r?.novos || 0;
      progresso.atualizados = (progresso.atualizados || 0) + (r?.atualizados || 0);
    }
    salvarProgresso();
  }

  async function processarVisiveis() {
    let algumNovo = false;
    for (const link of document.querySelectorAll('a[href*="MLB"]')) {
      if (!estado.rodando || progresso.coletados >= cfg.maximo) break;
      const id = link.href.match(ID_RE)?.[1];
      if (!id || vistosNestaRodada.has(id)) continue;
      const card = acharCard(link, id);
      if (!card) continue;
      vistosNestaRodada.add(id);
      algumNovo = true;

      const anterior = porId.get(`MLB${id}`);
      if (anterior?.linkAfiliado) continue; // já está completo

      const p = lerCard(card, link, id);
      if (!p.titulo || !p.precoPor) continue;
      if (p.pct < cfg.descontoMin) {
        progresso.ignorados++;
        continue;
      }

      if (!p.linkAfiliado && pegarLinkAtivo) {
        let r = await pegarLinkAfiliado(card);
        if (r.erroMl) {
          // O ML reclamou: espera, deixa o ritmo mais lento e tenta esse mesmo produto de novo
          ritmo = Math.min(ritmo * 1.5, 4);
          progresso.erro = 'O Mercado Livre pediu calma: esperando 40s e diminuindo o ritmo…';
          salvarProgresso();
          await esperar(40_000);
          progresso.erro = '';
          r = await pegarLinkAfiliado(card);
        }
        p.linkAfiliado = r.link;
        if (p.linkAfiliado) falhasSeguidas = 0;
        else if (++falhasSeguidas >= 5) {
          pegarLinkAtivo = false; // não fica clicando à toa: guarda o diagnóstico e segue só coletando
          progresso.erro = 'Não consegui pegar o link de afiliado. Clique em “Copiar diagnóstico” e mande pro suporte.';
        }
        await esperar(aleatorio(3 * ritmo, 6 * ritmo)); // 3–6s entre um Compartilhar e outro
      }

      if (p.linkAfiliado) progresso.comLink++;
      else progresso.semLink++;
      card.style.outline = `3px solid ${p.linkAfiliado ? '#22c55e' : '#FFE600'}`; // verde = com link, amarelo = sem
      porId.set(p.produtoId, {...anterior, ...p, coletadoEm: Date.now()});
      lote.push(p);
      progresso.coletados++;
      salvarProgresso();
      salvarLista();
      if (lote.length >= 5) await enviarLote();
    }
    return algumNovo;
  }

  function botaoCarregarMais() {
    return [...document.querySelectorAll('button, a[role="button"]')].find(
      (b) => /^(ver|carregar|mostrar)\s+mais/i.test(b.textContent.trim()) && visivel(b),
    );
  }

  // ---------- loop de rolagem ----------

  await chrome.storage.local.remove('diagnostico');
  salvarProgresso();
  let rodadasSemNovos = 0;
  while (estado.rodando && progresso.coletados < cfg.maximo) {
    const teveNovos = await processarVisiveis();
    rodadasSemNovos = teveNovos ? 0 : rodadasSemNovos + 1;

    if (rodadasSemNovos >= 4) {
      const mais = botaoCarregarMais();
      if (!mais) break; // chegou no fim da lista
      mais.click();
      rodadasSemNovos = 1;
    }
    window.scrollBy({top: window.innerHeight * 0.8, behavior: 'smooth'});
    await esperar(aleatorio(cfg.pausaMin, cfg.pausaMax));
  }

  await enviarLote();
  progresso.rodando = false;
  estado.rodando = false;
  salvarProgresso();
})();
