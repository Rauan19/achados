// Recebe os produtos do content script e manda pro sistema (fica aqui por causa do CORS)

chrome.runtime.onMessage.addListener((msg, _sender, responder) => {
  if (msg?.tipo !== 'enviar') return;
  enviar(msg.produtos).then(responder);
  return true; // resposta assíncrona
});

async function enviar(produtos) {
  const {url, token} = await chrome.storage.sync.get({url: 'http://localhost:3000', token: ''});
  if (!token) return {erro: 'Configure o token na extensão'};
  try {
    const r = await fetch(`${url.replace(/\/+$/, '')}/api/produtos`, {
      method: 'POST',
      headers: {'content-type': 'application/json', 'x-token': token},
      body: JSON.stringify({produtos}),
    });
    const corpo = await r.json().catch(() => ({}));
    return r.ok ? corpo : {erro: corpo.erro || `Erro ${r.status}`};
  } catch (e) {
    return {erro: `Sistema fora do ar? (${e.message})`};
  }
}
