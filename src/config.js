// ============================================================
//  EDITE AQUI: tudo que muda de um vídeo pro outro
// ============================================================

// Seu @ do TikTok/Instagram
export const PERFIL = '@economiza_ai01';

// Nome do grupo (aparece no WhatsApp e no final)
export const GRUPO = 'Achadinhos do Mercado Livre';

// Produtos (use preços REAIS de achados que você já postou no grupo).
// Fotos ficam em public/produtos/. Sem foto? Deixe imagem: null que aparece o emoji.
// Fotos de exemplo: Unsplash (uso comercial grátis).
export const PRODUTOS = [
  {nome: 'Headphone Bluetooth', emoji: '🎧', imagem: 'produtos/fone.jpg', de: 189.9, por: 79.9},
  {nome: 'Smartwatch', emoji: '⌚', imagem: 'produtos/smartwatch.jpg', de: 399.9, por: 159.9},
  {nome: 'Tênis de Corrida', emoji: '👟', imagem: 'produtos/tenis.jpg', de: 349.9, por: 149.9},
  {nome: 'Caixa de Som Bluetooth', emoji: '🔊', imagem: 'produtos/caixasom.jpg', de: 299.9, por: 129.9},
  {nome: 'Garrafa Térmica Inox', emoji: '🧴', imagem: 'produtos/garrafa.jpg', de: 119.9, por: 49.9},
];

// Produto da cena "de R$ X por R$ Y" (logo depois do gancho)
export const DESTAQUE = PRODUTOS[0];

// Produtos dos cards "ACHADOS DE HOJE" (4 cards)
export const CARDS = [PRODUTOS[1], PRODUTOS[2], PRODUTOS[3], PRODUTOS[4]];

// Ofertas que chegam no WhatsApp do grupo (3 mensagens)
export const MENSAGENS = [
  {produto: PRODUTOS[2], titulo: '🔥 OFERTA IMPERDÍVEL', hora: '09:12'},
  {produto: PRODUTOS[0], titulo: '⚡ PREÇO DESPENCOU', hora: '09:14'},
  {produto: PRODUTOS[3], titulo: '🚨 CORRE QUE ACABA', hora: '09:15'},
];
