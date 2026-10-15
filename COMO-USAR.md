# Achadinhos: conversor + coletor + bot

```
extensao-ml/      → extensão do Chrome: rola a lista de produtos do ML e coleta as ofertas
conversor-links/  → sistema (Next.js + Neon): conversor de links + fila de aprovação
bot-whatsapp/     → bot (NÃO oficial) que manda as ofertas aprovadas no grupo
```

Fluxo: **extensão coleta → fila no sistema → você aprova → bot envia no grupo com intervalo**

---

## 1. Banco (Neon), uma vez só

1. Crie uma conta grátis em https://neon.tech e um projeto
2. Copie a connection string (botão **Connect**)
3. Cole em `conversor-links/.env.local` na linha `DATABASE_URL=`
4. Rode: `npm --prefix conversor-links run db:setup`

## 2. Sistema

```
npm --prefix conversor-links run dev
```
Abra http://localhost:3000 (conversor) e http://localhost:3000/fila (fila).

## 3. Extensão do Chrome

1. Chrome → `chrome://extensions` → ligue o **Modo do desenvolvedor**
2. **Carregar sem compactação** → escolha a pasta `extensao-ml`
3. Clique no ícone da extensão → ⚙️ Configurações:
   - Endereço: `http://localhost:3000`
   - Token: o valor de `EXTENSAO_TOKEN` que está em `conversor-links/.env.local`
4. Abra a lista de produtos no painel de afiliados do ML (ou qualquer lista/ofertas do ML) → **▶ Coletar**

Ela rola a página devagar, marca de amarelo o que coletou e manda pra fila.
Se o card já tiver o link de afiliado (meli.la / mercadolivre.com/sec), ele vem junto.
Se não tiver, cole o link na própria fila antes de aprovar.

## 4. WhatsApp (tudo pela tela)

> ⚠️ **API não oficial: existe risco de banimento do número.** Use **chips secundários**
> que sejam admins do grupo. Nunca use o seu número pessoal. Comece testando num grupo só seu.

1. Dê dois cliques no **INICIAR.bat** → ele liga o sistema + o bot e abre a página **WhatsApp**
2. **+ Adicionar número** → o QR aparece na tela → no celular do chip: WhatsApp → Aparelhos conectados → Conectar aparelho
3. Repita pro segundo chip
4. Em **Grupo de envio**, escolha o grupo (mostra se cada número está no grupo / é admin)
5. Ajuste o **Ritmo de envio** (intervalo, horário, limites) e salve
6. **▶ Ligar envios**

O bot manda as ofertas aprovadas na **Fila**, uma por vez, com foto, **revezando os números**,
no intervalo escolhido. Não lê nem responde ninguém. Se um número cair, o outro continua.
As janelas pretas que o INICIAR.bat abre (minimizadas) são o sistema rodando: não feche.