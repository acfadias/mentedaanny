// Confete e avisos (toasts)
const reduz = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const cores = () => {
  const s = getComputedStyle(document.documentElement);
  return [s.getPropertyValue('--accent'), s.getPropertyValue('--fg'), '#E9D6BC', '#D08F8C', s.getPropertyValue('--ok')].map(c => c.trim()).filter(Boolean);
};

let parts = [], rodando = false, ctx = null;
function quadro() {
  const cv = document.getElementById('confete');
  if (!ctx) ctx = cv.getContext('2d');
  const dpr = devicePixelRatio || 1;
  if (cv.width !== innerWidth * dpr) { cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  parts = parts.filter(p => p.vida > 0);
  for (const p of parts) {
    p.vy += 0.18; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.vida -= 1;
    ctx.save(); ctx.globalAlpha = Math.min(1, p.vida / 30); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.cor;
    if (p.forma) ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); else { ctx.beginPath(); ctx.arc(0, 0, p.s / 2.4, 0, 6.3); ctx.fill(); }
    ctx.restore();
  }
  if (parts.length) requestAnimationFrame(quadro); else { rodando = false; ctx.clearRect(0, 0, innerWidth, innerHeight); }
}

export function confete(x = innerWidth / 2, y = innerHeight / 2, qtd = 26, forca = 7) {
  if (reduz()) return;
  const cs = cores();
  for (let i = 0; i < qtd; i++) {
    const a = Math.random() * Math.PI * 2, v = forca * (0.4 + Math.random() * 0.8);
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - forca * 0.6, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, s: 6 + Math.random() * 7, cor: cs[i % cs.length], forma: Math.random() > 0.4, vida: 70 + Math.random() * 40 });
  }
  if (!rodando) { rodando = true; requestAnimationFrame(quadro); }
}

export function festa() {
  if (reduz()) return;
  for (let i = 0; i < 5; i++) setTimeout(() => confete(innerWidth * (0.15 + Math.random() * 0.7), innerHeight * (0.25 + Math.random() * 0.3), 40, 10), i * 180);
}

export function confeteEm(el, qtd) {
  const r = el.getBoundingClientRect();
  confete(r.left + r.width / 2, r.top + r.height / 2, qtd);
}

export function toast(msg, ms = 2600) {
  const box = document.getElementById('toasts');
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  box.appendChild(t);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, ms);
}
