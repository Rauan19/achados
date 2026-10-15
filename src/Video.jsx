import {
  AbsoluteFill, Audio, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig,
} from 'remotion';
import {loadFont} from '@remotion/google-fonts/Montserrat';
import {CARDS, DESTAQUE, GRUPO, MENSAGENS, PERFIL} from './config';

const {fontFamily} = loadFont('normal', {weights: ['700', '800', '900'], subsets: ['latin']});

const AMARELO = '#FFE600';
const AZUL = '#2D3277';
const AZUL_ESCURO = '#121640';
const VERMELHO = '#FF2E3B';
const BRANCO = '#FFFFFF';
const FONTE = `${fontFamily}, "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
const CLAMP = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'};

// Linha do tempo sincronizada com a narração (public/voz.mp3), em frames (30fps)
const CENAS = {
  gancho: [0, 62], //       "Para de pagar caro!"
  preco: [62, 118], //      "Fone bluetooth de cento e noventa... por setenta e nove!"
  produtos: [180, 156], //  "Smartwatch, tênis, caixa de som... tudo com desconto absurdo"
  whatsapp: [336, 135], //  "Eu garimpo as melhores ofertas... no meu grupo"
  exclusivo: [471, 135], // "Cupom que some em minutos, erro de preço, frete grátis"
  cta: [606, 114], //       "Entra no grupo... É de graça!"
  fim: [720, 80], //        "Link na bio, ou comenta GRUPO!"
};
export const DURACAO = 800;

const reais = (v) => 'R$ ' + v.toFixed(2).replace('.', ',');
const desconto = (p) => Math.round((1 - p.por / p.de) * 100);

const Sfx = ({src, at = 0, volume = 1, dur = 60}) => (
  <Sequence from={at} durationInFrames={dur} layout="none">
    <Audio src={staticFile(`sfx/${src}.wav`)} volume={volume} />
  </Sequence>
);

// Texto digitando, com barulho de tecla por letra
const Typewriter = ({segments, start = 0, speed = 2, style, cursor = true, cursorColor = BRANCO, clickEvery = 1, volume = 0.35}) => {
  const frame = useCurrentFrame();
  const chars = segments.flatMap((s, si) => Array.from(s.t).map((ch) => ({ch, si})));
  const visiveis = Math.max(0, Math.min(chars.length, Math.floor((frame - start) / speed) + 1));
  const digitando = frame >= start && visiveis < chars.length;
  const piscando = Math.floor(frame / 8) % 2 === 0;
  const mostrados = chars.slice(0, visiveis);

  return (
    <div style={{whiteSpace: 'pre-wrap', ...style}}>
      {segments.map((s, si) => {
        const txt = mostrados.filter((c) => c.si === si).map((c) => c.ch).join('');
        return txt ? <span key={si} style={s.style}>{txt}</span> : null;
      })}
      {cursor && (digitando || piscando) && (
        <span style={{display: 'inline-block', width: '0.08em', height: '0.9em', background: cursorColor, marginLeft: '0.06em', verticalAlign: '-0.1em'}} />
      )}
      {chars.map((c, i) =>
        c.ch.trim() && i % clickEvery === 0
          ? <Sfx key={i} src={`click${i % 3}`} at={start + i * speed} volume={volume} dur={6} />
          : null,
      )}
    </div>
  );
};

const Flash = ({at, dur = 5, max = 0.6}) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [at, at + dur], [max, 0], CLAMP);
  return frame >= at ? <AbsoluteFill style={{background: BRANCO, opacity: o}} /> : null;
};

const Logo = ({size, style}) => (
  <div style={{width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, ...style}}>
    <Img src={staticFile('logo.webp')} style={{width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.08)'}} />
  </div>
);

const FotoProduto = ({p, tamanhoEmoji}) => (
  p.imagem
    ? <Img src={staticFile(p.imagem)} style={{width: '100%', height: '100%', objectFit: 'cover', display: 'block'}} />
    : <div style={{width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: tamanhoEmoji}}>{p.emoji}</div>
);

// ---------- 1. GANCHO ----------
const Gancho = () => {
  const frame = useCurrentFrame();
  const speed = 3; // "caro" bate junto com a fala (~1,8s)
  const texto = [{t: 'PARA DE\nPAGAR '}, {t: 'CARO'}];
  const fim = (Array.from(texto.map((s) => s.t).join('')).length - 1) * speed + 2;
  const bateu = frame >= fim;
  const tremor = bateu ? Math.sin(frame * 2.7) * interpolate(frame, [fim, fim + 9], [16, 0], CLAMP) : 0;
  const escala = interpolate(frame, [fim, fim + 3, fim + 9], [1, 1.28, 1.1], CLAMP);
  texto[1].style = {
    display: 'inline-block',
    color: bateu ? VERMELHO : BRANCO,
    transform: `translateX(${tremor}px) scale(${escala})`,
    textShadow: bateu ? `0 0 40px ${VERMELHO}99` : 'none',
  };

  return (
    <AbsoluteFill style={{background: '#000', justifyContent: 'center', alignItems: 'center'}}>
      <Typewriter
        segments={texto} speed={speed}
        style={{fontFamily: FONTE, fontWeight: 900, fontSize: 158, lineHeight: 1.05, color: BRANCO, textAlign: 'center', letterSpacing: -3}}
      />
      <Flash at={fim} max={0.35} />
      <Sfx src="boom" at={fim} volume={0.8} />
    </AbsoluteFill>
  );
};

// ---------- 2. PREÇO ----------
const NO_POR = 76; // "por setenta e nove" (~4,6s do vídeo)

const Preco = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = DESTAQUE;
  const entra = spring({frame, fps, config: {damping: 14}});
  const risco = interpolate(frame, [NO_POR - 4, NO_POR + 3], [0, 105], CLAMP);
  const novo = spring({frame: frame - NO_POR, fps, config: {damping: 9, stiffness: 180}});
  const selo = spring({frame: frame - (NO_POR + 22), fps, config: {damping: 10, stiffness: 160}});

  return (
    <AbsoluteFill style={{background: `radial-gradient(circle at 50% 45%, ${AZUL} 0%, ${AZUL_ESCURO} 75%)`, justifyContent: 'center', alignItems: 'center', fontFamily: FONTE, paddingBottom: 200}}>
      <div style={{position: 'relative', width: 640, height: 470, transform: `translateY(${(1 - entra) * -900}px) rotate(-3deg)`}}>
        <div style={{width: '100%', height: '100%', borderRadius: 44, overflow: 'hidden', border: `10px solid ${BRANCO}`, boxShadow: '0 24px 50px rgba(0,0,0,0.5)', background: '#F2F3F8'}}>
          <FotoProduto p={p} tamanhoEmoji={300} />
        </div>
        <div style={{position: 'absolute', bottom: -34, left: '50%', transform: 'translateX(-50%) rotate(3deg)', whiteSpace: 'nowrap', background: AMARELO, color: AZUL, fontWeight: 900, fontSize: 46, padding: '12px 36px', borderRadius: 100, boxShadow: '0 8px 20px rgba(0,0,0,0.3)'}}>
          {p.nome}
        </div>
        <div style={{position: 'absolute', top: -70, right: -90, width: 240, height: 240, borderRadius: '50%', background: VERMELHO, color: BRANCO, display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 900, fontSize: 82, transform: `scale(${selo}) rotate(${15 + (1 - selo) * -90}deg)`, boxShadow: '0 16px 40px rgba(0,0,0,0.45)'}}>
          -{desconto(p)}%
        </div>
      </div>

      <div style={{textAlign: 'center', marginTop: 90, opacity: entra * interpolate(frame, [NO_POR, NO_POR + 8], [1, 0.55], CLAMP)}}>
        <div style={{color: '#A6ACE0', fontWeight: 800, fontSize: 56}}>DE</div>
        <div style={{position: 'relative', display: 'inline-block', color: BRANCO, fontWeight: 800, fontSize: 124}}>
          {reais(p.de)}
          <div style={{position: 'absolute', left: '-2.5%', top: '50%', height: 16, width: `${risco}%`, background: VERMELHO, borderRadius: 8, transform: 'rotate(-7deg)', boxShadow: '0 4px 12px rgba(0,0,0,0.4)'}} />
        </div>
      </div>

      <div style={{textAlign: 'center', marginTop: 30, transform: `scale(${novo})`}}>
        <div style={{color: BRANCO, fontWeight: 800, fontSize: 58}}>POR APENAS</div>
        <div style={{color: AMARELO, fontWeight: 900, fontSize: 200, lineHeight: 1, letterSpacing: -4, textShadow: '0 12px 0 rgba(0,0,0,0.35)'}}>
          {reais(p.por)}
        </div>
      </div>

      <Sfx src="whoosh" at={3} volume={0.5} />
      <Sfx src="kaching" at={NO_POR} volume={0.6} />
      <Sfx src="pop" at={NO_POR + 22} volume={0.7} />
    </AbsoluteFill>
  );
};

// ---------- 3. PRODUTOS ----------
// smartwatch, tênis, caixa de som, e o último no "tudo com desconto absurdo"
const ENTRADA_CARD = [0, 18, 36, 89];
const ROTACAO = [-3, 2.5, -2, 3];

const Card = ({p, i}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const local = frame - ENTRADA_CARD[i];
  if (local < 0) return null;
  const lado = i % 2 === 0 ? 1 : -1;
  const s = spring({frame: local, fps, config: {damping: 13, stiffness: 160}});
  const atras = i < CARDS.length - 1 ? spring({frame: frame - ENTRADA_CARD[i + 1], fps, config: {damping: 20}}) : 0;
  const rot = ROTACAO[i % ROTACAO.length] + (1 - s) * 30 * lado;
  const seloS = spring({frame: local - 8, fps, config: {damping: 9}});

  return (
    <div style={{
      position: 'absolute', left: 'calc(50% - 430px)', top: 360, width: 800, height: 1060,
      background: BRANCO, borderRadius: 48, overflow: 'visible', boxShadow: '0 30px 60px rgba(0,0,0,0.25)',
      transform: `translateX(${(1 - s) * 1300 * lado}px) translateY(${-atras * 50}px) rotate(${rot}deg) scale(${1 - atras * 0.08})`,
      filter: `brightness(${1 - atras * 0.25})`,
    }}>
      <div style={{margin: 30, height: 600, borderRadius: 32, background: '#F2F3F8', overflow: 'hidden'}}>
        <FotoProduto p={p} tamanhoEmoji={380} />
      </div>
      <div style={{padding: '0 50px', fontFamily: FONTE}}>
        <div style={{fontWeight: 800, fontSize: 54, color: '#1C1C28', lineHeight: 1.1}}>{p.nome}</div>
        <div style={{fontWeight: 700, fontSize: 50, color: '#9A9AA8', textDecoration: 'line-through', marginTop: 8}}>{reais(p.de)}</div>
        <div style={{fontWeight: 900, fontSize: 124, color: AZUL, lineHeight: 1.05, letterSpacing: -3}}>{reais(p.por)}</div>
      </div>
      <div style={{position: 'absolute', top: -40, right: -40, width: 230, height: 230, borderRadius: '50%', background: VERMELHO, color: BRANCO, display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: FONTE, fontWeight: 900, fontSize: 76, transform: `scale(${seloS}) rotate(12deg)`, boxShadow: '0 10px 24px rgba(0,0,0,0.3)'}}>
        -{desconto(p)}%
      </div>
    </div>
  );
};

const Produtos = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const titulo = spring({frame, fps, config: {damping: 12}});
  return (
    <AbsoluteFill style={{
      background: `repeating-linear-gradient(45deg, ${AMARELO} 0 50px, #FFDA00 50px 100px)`,
      backgroundPosition: `${frame * 3}px 0`,
    }}>
      <div style={{position: 'absolute', top: 170, width: '100%', textAlign: 'center', fontFamily: FONTE, fontWeight: 900, fontSize: 96, color: AZUL, letterSpacing: -2, transform: `scale(${titulo})`}}>
        ACHADOS DE HOJE 🔥
      </div>
      {CARDS.map((p, i) => <Card key={i} p={p} i={i} />)}
      {CARDS.map((_, i) => <Sfx key={i} src="pop" at={ENTRADA_CARD[i]} volume={0.7} dur={10} />)}
    </AbsoluteFill>
  );
};

// ---------- 4. WHATSAPP DO GRUPO ----------
const VERDE_WPP = '#008069';
const POR_MSG = 32;
const PRIMEIRA_MSG = 30;

const Mensagem = ({m, at}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame: frame - at, fps, config: {damping: 15, stiffness: 170}});
  if (frame < at) return null;
  const p = m.produto;
  return (
    <div style={{maxHeight: s * 760, flexShrink: 0, overflow: 'hidden'}}>
      <div style={{
        marginTop: 22, width: 590, background: BRANCO, borderRadius: '0 26px 26px 26px', padding: 12,
        boxShadow: '0 2px 3px rgba(0,0,0,0.13)', transformOrigin: 'left bottom', transform: `scale(${0.85 + 0.15 * s})`, opacity: s,
      }}>
        <div style={{fontWeight: 800, fontSize: 26, color: '#C2185B', padding: '2px 10px 10px'}}>~ {GRUPO}</div>
        <div style={{height: 270, borderRadius: 18, overflow: 'hidden', background: '#F2F3F8'}}>
          <FotoProduto p={p} tamanhoEmoji={200} />
        </div>
        <div style={{padding: '14px 12px 0', fontSize: 31, color: '#111B21', lineHeight: 1.35, fontWeight: 700}}>
          <div style={{fontWeight: 900}}>{m.titulo}</div>
          <div>{p.nome}</div>
          <div style={{color: '#8696A0', textDecoration: 'line-through'}}>De {reais(p.de)}</div>
          <div style={{color: '#1DA851', fontWeight: 900, fontSize: 46}}>✅ Por {reais(p.por)}</div>
          <div style={{color: '#027EB5', fontSize: 28}}>🔗 mercadolivre.com.br/…</div>
        </div>
        <div style={{textAlign: 'right', fontSize: 22, color: '#8696A0', padding: '2px 8px 0', fontWeight: 700}}>{m.hora}</div>
      </div>
    </div>
  );
};

const WhatsApp = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const celular = spring({frame, fps, config: {damping: 16, stiffness: 120}});
  const estilo = {fontFamily: FONTE, fontWeight: 900, fontSize: 76, lineHeight: 1.1, textAlign: 'center', letterSpacing: -2};

  return (
    <AbsoluteFill style={{background: `linear-gradient(180deg, ${AZUL_ESCURO} 0%, ${AZUL} 100%)`}}>
      <div style={{position: 'absolute', top: 160, width: '100%', padding: '0 70px'}}>
        <Typewriter
          segments={[{t: 'Eu garimpo e mando\n'}, {t: 'tudo no grupo 👇', style: {color: AMARELO}}]}
          speed={1} clickEvery={2} cursorColor={AMARELO} style={{...estilo, color: BRANCO}}
        />
      </div>

      <div style={{
        position: 'absolute', left: 120, top: 420, width: 780, height: 1260, borderRadius: 80, background: '#0B0B0F', padding: 18,
        boxShadow: '0 40px 80px rgba(0,0,0,0.55)', transform: `translateY(${(1 - celular) * 1500}px) rotate(${(1 - celular) * 8}deg)`,
      }}>
        <div style={{position: 'relative', width: '100%', height: '100%', borderRadius: 64, overflow: 'hidden', background: '#EFE7DE', fontFamily: FONTE}}>
          <div style={{position: 'absolute', top: 0, left: 0, right: 0, height: 170, background: VERDE_WPP, display: 'flex', alignItems: 'center', gap: 18, padding: '50px 24px 0'}}>
            <div style={{color: BRANCO, fontSize: 44, fontWeight: 700}}>←</div>
            <Logo size={86} />
            <div style={{minWidth: 0}}>
              <div style={{color: BRANCO, fontWeight: 800, fontSize: 31, whiteSpace: 'nowrap'}}>{GRUPO}</div>
              <div style={{color: 'rgba(255,255,255,0.8)', fontWeight: 700, fontSize: 26}}>Grupo · ofertas todo dia</div>
            </div>
          </div>

          <div style={{position: 'absolute', top: 170, bottom: 120, left: 0, right: 0, padding: '0 26px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', overflow: 'hidden'}}>
            {MENSAGENS.map((m, i) => <Mensagem key={i} m={m} at={PRIMEIRA_MSG + i * POR_MSG} />)}
          </div>

          <div style={{position: 'absolute', bottom: 22, left: 22, right: 22, height: 86, display: 'flex', gap: 14}}>
            <div style={{flex: 1, background: BRANCO, borderRadius: 43, display: 'flex', alignItems: 'center', padding: '0 30px', color: '#8696A0', fontSize: 32, fontWeight: 700}}>😊  Mensagem</div>
            <div style={{width: 86, height: 86, borderRadius: '50%', background: VERDE_WPP, display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: 40}}>🎤</div>
          </div>
        </div>
      </div>

      <Sfx src="whoosh" at={0} volume={0.45} />
      {MENSAGENS.map((_, i) => <Sfx key={i} src="notif" at={PRIMEIRA_MSG + i * POR_MSG} volume={0.5} dur={25} />)}
    </AbsoluteFill>
  );
};

// ---------- 5. EXCLUSIVIDADE ----------
// cada frase entra quando é falada
const FRASES_AT = [0, 9, 61, 80];

const Frase = ({children, at, estilo}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame: frame - at, fps, config: {damping: 11, stiffness: 220}});
  if (frame < at) return null;
  return (
    <div style={{transform: `scale(${interpolate(s, [0, 1], [2.6, 1])}) rotate(${(1 - s) * -8}deg)`, opacity: Math.min(1, s * 2), ...estilo}}>
      {children}
    </div>
  );
};

const Exclusivo = () => {
  const frame = useCurrentFrame();
  const tremor = interpolate(frame, [105, 133], [0, 12], CLAMP);
  const dx = Math.sin(frame * 3.1) * tremor;
  const dy = Math.cos(frame * 2.3) * tremor;
  const base = {fontFamily: FONTE, fontWeight: 900, letterSpacing: -2, textAlign: 'center', lineHeight: 1.05, whiteSpace: 'pre'};
  return (
    <AbsoluteFill style={{background: `radial-gradient(circle at 50% 50%, ${AZUL} 0%, #05061A 80%)`, justifyContent: 'center', alignItems: 'center', paddingBottom: 140}}>
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 56, transform: `translate(${dx}px, ${dy}px)`}}>
        <Frase at={FRASES_AT[0]} estilo={{...base, fontSize: 116, color: AMARELO, textShadow: `0 0 50px ${AMARELO}66`}}>OFERTAS{'\n'}IMPERDÍVEIS 🔥</Frase>
        <Frase at={FRASES_AT[1]} estilo={{...base, fontSize: 84, color: BRANCO}}>CUPOM QUE SOME{'\n'}EM MINUTOS ⏳</Frase>
        <Frase at={FRASES_AT[2]} estilo={{...base, fontSize: 84, color: AZUL, background: AMARELO, padding: '14px 40px', borderRadius: 24}}>ERRO DE PREÇO 👀</Frase>
        <Frase at={FRASES_AT[3]} estilo={{...base, fontSize: 92, color: BRANCO}}>FRETE GRÁTIS 🚚</Frase>
      </div>
      <Sfx src="riser" at={48} volume={0.45} dur={90} />
      {FRASES_AT.map((at) => <Sfx key={at} src="pop" at={at} volume={0.7} dur={10} />)}
    </AbsoluteFill>
  );
};

// ---------- 6. CTA ----------
const NO_GRATIS = 78; // "É de graça!"

const Cta = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const entra = spring({frame, fps, config: {damping: 10, stiffness: 200}});
  const pulso = 1 + 0.06 * Math.exp(-((frame % 15) / 15) * 6);
  const logo = spring({frame: frame - 4, fps, config: {damping: 11, stiffness: 160}});
  const carimbo = spring({frame: frame - NO_GRATIS, fps, config: {damping: 10, stiffness: 220}});
  const seta = Math.abs(Math.sin((frame / 15) * Math.PI)) * 40;

  return (
    <AbsoluteFill style={{background: AMARELO, justifyContent: 'center', alignItems: 'center', overflow: 'hidden'}}>
      <AbsoluteFill style={{
        background: `repeating-conic-gradient(from ${frame * 0.6}deg at 50% 45%, #FFF27A 0deg 10deg, ${AMARELO} 10deg 20deg)`,
        opacity: 0.8,
      }} />
      <Logo size={330} style={{position: 'absolute', top: 190, border: `8px solid ${AZUL}`, boxShadow: '0 20px 40px rgba(0,0,0,0.3)', transform: `scale(${logo}) rotate(${(1 - logo) * -40}deg)`}} />
      <div style={{textAlign: 'center', fontFamily: FONTE, color: AZUL, transform: `scale(${interpolate(entra, [0, 1], [2.2, 1]) * pulso})`, marginTop: 60}}>
        <div style={{fontWeight: 900, fontSize: 140, letterSpacing: -3, lineHeight: 1}}>ENTRA NO</div>
        <div style={{fontWeight: 900, fontSize: 270, letterSpacing: -8, lineHeight: 0.95}}>GRUPO</div>
      </div>
      <div style={{
        position: 'absolute', top: 1260, fontFamily: FONTE, fontWeight: 900, fontSize: 96, color: BRANCO, background: VERMELHO,
        padding: '18px 54px', borderRadius: 22, boxShadow: '0 14px 30px rgba(0,0,0,0.3)',
        transform: `rotate(-6deg) scale(${interpolate(carimbo, [0, 1], [3, 1])})`, opacity: Math.min(1, carimbo * 3),
      }}>
        É GRÁTIS
      </div>
      <div style={{position: 'absolute', top: 1450, fontSize: 140, transform: `translateY(${seta}px)`}}>👇</div>
      <Sfx src="boom" at={0} volume={0.9} />
      <Sfx src="pop" at={NO_GRATIS} volume={0.8} />
    </AbsoluteFill>
  );
};

// ---------- 7. FECHAMENTO ----------
const Fim = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const logo = spring({frame, fps, config: {damping: 14}});
  const perfil = interpolate(frame, [50, 58], [0, 1], CLAMP);
  return (
    <AbsoluteFill style={{background: '#000', justifyContent: 'center', alignItems: 'center', fontFamily: FONTE, paddingBottom: 160}}>
      <Logo size={240} style={{position: 'absolute', top: 330, opacity: logo, transform: `scale(${0.6 + 0.4 * logo})`}} />
      <Typewriter
        segments={[{t: 'LINK NA BIO 🔗'}]} start={6} speed={2} cursor={frame < 36} cursorColor={AMARELO}
        style={{fontWeight: 900, fontSize: 112, color: AMARELO, letterSpacing: -3, textAlign: 'center'}}
      />
      <Typewriter
        segments={[{t: 'ou comenta '}, {t: 'GRUPO', style: {color: AMARELO}}, {t: ' 💬'}]} start={36} speed={1} clickEvery={2}
        style={{fontWeight: 800, fontSize: 80, color: BRANCO, textAlign: 'center', marginTop: 30, minHeight: 100}}
      />
      <div style={{position: 'absolute', top: 1230, fontWeight: 700, fontSize: 52, color: '#8A8A99', opacity: perfil}}>{PERFIL}</div>
    </AbsoluteFill>
  );
};

export const Video = ({comMusica, comVoz}) => (
  <AbsoluteFill style={{background: '#000'}}>
    <Sequence from={CENAS.gancho[0]} durationInFrames={CENAS.gancho[1]}><Gancho /></Sequence>
    <Sequence from={CENAS.preco[0]} durationInFrames={CENAS.preco[1]}><Preco /></Sequence>
    <Sequence from={CENAS.produtos[0]} durationInFrames={CENAS.produtos[1]}><Produtos /></Sequence>
    <Sequence from={CENAS.whatsapp[0]} durationInFrames={CENAS.whatsapp[1]}><WhatsApp /></Sequence>
    <Sequence from={CENAS.exclusivo[0]} durationInFrames={CENAS.exclusivo[1]}><Exclusivo /></Sequence>
    <Sequence from={CENAS.cta[0]} durationInFrames={CENAS.cta[1]}><Cta /></Sequence>
    <Sequence from={CENAS.fim[0]} durationInFrames={CENAS.fim[1]}><Fim /></Sequence>
    {comVoz && <Audio src={staticFile('voz.mp3')} volume={1} />}
    {comMusica && <Audio src={staticFile('sfx/beat.wav')} volume={comVoz ? 0.16 : 0.4} />}
  </AbsoluteFill>
);
