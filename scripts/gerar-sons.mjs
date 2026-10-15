// Gera todos os efeitos sonoros e a batida de fundo do zero (sem direitos autorais).
// Uso: npm run sons
import fs from 'node:fs';
import path from 'node:path';

const SR = 44100;
const OUT = path.resolve('public/sfx');
fs.mkdirSync(OUT, {recursive: true});

// Aleatório com semente fixa: os sons saem sempre iguais
let seed = 42;
const rand = () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const noise = () => rand() * 2 - 1;

const gen = (dur, fn) => {
  const a = new Float32Array(Math.floor(dur * SR));
  for (let i = 0; i < a.length; i++) a[i] = fn(i / SR);
  return a;
};

const normalize = (a, peak) => {
  let m = 0;
  for (const v of a) m = Math.max(m, Math.abs(v));
  const k = m ? peak / m : 1;
  // fade-out curtinho no fim pra não estalar
  const fade = Math.min(a.length, Math.floor(0.004 * SR));
  for (let i = 0; i < a.length; i++) {
    a[i] *= k;
    const rest = a.length - i;
    if (rest < fade) a[i] *= rest / fade;
  }
  return a;
};

const writeWav = (name, s) => {
  const buf = Buffer.alloc(44 + s.length * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + s.length * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(s.length * 2, 40);
  for (let i = 0; i < s.length; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s[i])) * 32767), 44 + i * 2);
  }
  fs.writeFileSync(path.join(OUT, `${name}.wav`), buf);
  console.log(`  ✓ ${name}.wav`);
};

// ---------- Efeitos ----------

// Tecla de teclado mecânico (3 variações pra não soar robótico)
const click = (v) => {
  let prev = 0, ph = 0;
  const f = 1700 + v * 350;
  return normalize(gen(0.045, (t) => {
    const n = noise(); const hp = n - prev; prev = n;
    ph += (2 * Math.PI * f) / SR;
    return hp * Math.exp(-t * 220) * 0.6
      + Math.sin(ph) * Math.exp(-t * 350) * 0.35
      + Math.sin(2 * Math.PI * (150 + v * 20) * t) * Math.exp(-t * 90) * 0.4;
  }), 0.7);
};

const pop = () => {
  let ph = 0;
  return normalize(gen(0.16, (t) => {
    const f = 1000 * Math.exp(-t * 28) + 220;
    ph += (2 * Math.PI * f) / SR;
    return Math.sin(ph) * Math.exp(-t * 25) * Math.min(1, t * 800);
  }), 0.8);
};

const whoosh = () => {
  const d = 0.5;
  let y = 0, y2 = 0;
  return normalize(gen(d, (t) => {
    const e = Math.sin((Math.PI * t) / d) ** 2;
    const a = 1 - Math.exp((-2 * Math.PI * (300 + 5000 * e)) / SR);
    y += a * (noise() - y); y2 += a * (y - y2);
    return y2 * e;
  }), 0.7);
};

// "Ka-ching" de caixa registradora
const kaching = () => {
  const parts = [[2093, 1], [2637, 0.7], [3136, 0.5], [4186, 0.25], [5274, 0.15]];
  return normalize(gen(1.3, (t) => {
    let s = 0;
    const t1 = t - 0.05, t2 = t - 0.13;
    if (t1 > 0) for (const [f, g] of parts) s += Math.sin(2 * Math.PI * f * t1) * g * Math.exp(-t1 * (3 + f / 2000)) * Math.min(1, t1 * 2000);
    if (t2 > 0) for (const [f, g] of parts) s += 0.6 * Math.sin(2 * Math.PI * f * 1.26 * t2) * g * Math.exp(-t2 * (3.5 + f / 2000));
    const ka = noise() * Math.exp(-t * 80) * 0.8 + (t > 0.03 ? noise() * Math.exp(-(t - 0.03) * 90) * 0.5 : 0);
    return s * 0.5 + ka;
  }), 0.8);
};

const boom = () => {
  let ph = 0, y = 0;
  return normalize(gen(1.3, (t) => {
    const f = 38 + 110 * Math.exp(-t * 14);
    ph += (2 * Math.PI * f) / SR;
    y += 0.08 * (noise() - y);
    return Math.tanh(1.8 * (Math.sin(ph) * Math.exp(-t * 3) + y * 4 * Math.exp(-t * 25)));
  }), 0.9);
};

// "Plim" de notificação
const notif = () => {
  const tone = (t, f, start, dec) => {
    const td = t - start;
    if (td < 0) return 0;
    return (Math.sin(2 * Math.PI * f * td) + 0.25 * Math.sin(4 * Math.PI * f * td)) * Math.exp(-td * dec) * Math.min(1, td * 1500);
  };
  return normalize(gen(0.7, (t) => tone(t, 1318.5, 0, 14) + tone(t, 1975.5, 0.09, 7)), 0.6);
};

// Som subindo (tensão antes do CTA)
const riser = () => {
  const d = 2.9;
  let ph = 0, prev = 0;
  return normalize(gen(d, (t) => {
    const p = t / d;
    ph += (2 * Math.PI * 140 * Math.pow(9, p)) / SR;
    const saw = Math.sin(ph) + 0.5 * Math.sin(2 * ph) + 0.33 * Math.sin(3 * ph);
    const n = noise(); const hp = n - prev; prev = n;
    const env = p < 0.97 ? 1 : (1 - p) / 0.03;
    return (saw * 0.35 * p * p + hp * 0.35 * p * p * p) * env;
  }), 0.7);
};

// ---------- Batida de fundo (120 BPM = 1 batida a cada 15 frames do vídeo) ----------

const kick = () => {
  let ph = 0;
  return normalize(gen(0.4, (t) => {
    ph += (2 * Math.PI * (50 + 110 * Math.exp(-t * 30))) / SR;
    return Math.sin(ph) * Math.exp(-t * 7) + noise() * Math.exp(-t * 400) * 0.3;
  }), 1);
};

const clap = () => {
  let lo = 0, hi = 0;
  return normalize(gen(0.22, (t) => {
    const n = noise();
    hi += 0.35 * (n - hi); lo += 0.1 * (n - lo);
    const band = hi - lo;
    const env = t < 0.03 ? Math.exp(-(t % 0.01) * 300) : Math.exp(-(t - 0.03) * 28);
    return band * env;
  }), 1);
};

const hat = () => {
  let prev = 0;
  return normalize(gen(0.06, (t) => {
    const n = noise(); const hp = n - prev; prev = n;
    return hp * Math.exp(-t * 70);
  }), 1);
};

const bass = (f) => normalize(gen(0.28, (t) => {
  const s = Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(4 * Math.PI * f * t);
  return s * Math.exp(-t * 7) * Math.min(1, t * 300);
}), 1);

const pluck = (f) => normalize(gen(0.35, (t) => {
  const s = Math.sin(2 * Math.PI * f * t) + 0.4 * Math.sin(4 * Math.PI * f * t) + 0.15 * Math.sin(6 * Math.PI * f * t);
  return s * Math.exp(-t * 11) * Math.min(1, t * 600);
}), 1);

const beat = () => {
  // Tempos sincronizados com a narração: o drop cai no "Entra no grupo" (20,2s)
  const DURACAO = 26.7, INICIO = 2.2, DROP = 20.2, FIM = 26.2;
  const out = new Float32Array(Math.round(DURACAO * SR));
  const add = (s, at, g) => {
    const o = Math.floor(at * SR);
    for (let i = 0; i < s.length && o + i < out.length; i++) out[o + i] += s[i] * g;
  };
  const K = kick(), C = clap(), H = hat();
  // Lá menor – Fá – Dó – Sol (1 acorde a cada 2s)
  const acordes = [
    [110, [440, 523.25, 659.25]],
    [87.31, [349.23, 440, 523.25]],
    [130.81, [523.25, 659.25, 783.99]],
    [98, [392, 493.88, 587.33]],
  ];
  const B = 0.5;
  for (let k = 0; INICIO + k * B <= FIM; k++) { // grade de batidas começa depois do gancho
    const t = INICIO + k * B;
    if (t >= DROP - B && t < DROP) continue; // respiro antes do drop do CTA
    const drop = t >= DROP;
    const [bf, arp] = acordes[Math.floor((t - INICIO) / 2) % 4];
    add(K, t, 1);
    if (k % 2 === 1) add(C, t, 0.55);
    add(H, t + B / 2, 0.3);
    if (drop) { add(H, t + B / 4, 0.18); add(H, t + (3 * B) / 4, 0.18); }
    if (t + B / 2 < DROP - B || drop) add(bass(bf), t + B / 2, 0.6);
    if (t >= 7.5) {
      add(pluck(arp[k % 3]), t, 0.2);
      add(pluck(arp[(k + 1) % 3] * (k % 2 ? 1 : 2)), t + B / 2, 0.14);
    }
  }
  for (let i = 0; i < out.length; i++) out[i] = Math.tanh(out[i] * 1.2);
  return normalize(out, 0.85);
};

console.log('Gerando sons em public/sfx ...');
[0, 1, 2].forEach((v) => writeWav(`click${v}`, click(v)));
writeWav('pop', pop());
writeWav('whoosh', whoosh());
writeWav('kaching', kaching());
writeWav('boom', boom());
writeWav('notif', notif());
writeWav('riser', riser());
writeWav('beat', beat());
