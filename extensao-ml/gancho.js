// Roda no contexto da PÁGINA (não da extensão): avisa a extensão quando o site copia algo,
// pra pegar o link de afiliado que o botão "Copiar link" coloca na área de transferência.
(() => {
  if (window.__ganchoAchadinhos) return;
  window.__ganchoAchadinhos = true;
  const avisar = (t) => t && window.postMessage({__achadinhosCopia: String(t)}, '*');

  const cb = navigator.clipboard;
  if (cb?.writeText) {
    const original = cb.writeText.bind(cb);
    cb.writeText = (t) => {
      avisar(t);
      return original(t);
    };
  }
  if (cb?.write) {
    const original = cb.write.bind(cb);
    cb.write = async (itens) => {
      try {
        for (const item of itens) if (item.types.includes('text/plain')) avisar(await (await item.getType('text/plain')).text());
      } catch {}
      return original(itens);
    };
  }
  // Cópia "antiga" (document.execCommand('copy') com o texto selecionado)
  window.addEventListener('copy', (e) => {
    const ativo = document.activeElement;
    const doCampo =
      ativo && /^(INPUT|TEXTAREA)$/.test(ativo.tagName) && ativo.selectionEnd > ativo.selectionStart
        ? ativo.value.slice(ativo.selectionStart, ativo.selectionEnd)
        : '';
    avisar(e.clipboardData?.getData('text/plain') || doCampo || String(window.getSelection() || ''));
  });
})();
