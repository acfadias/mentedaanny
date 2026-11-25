// Junta rotina + agendas + TCC e encaixa as tarefas quando algo se choca.
import * as S from './store.js';
import * as A from './agenda.js';
import { itensDoDia, ymd, deYmd, addDias, minutos, agoraMin, pad, feito } from './rotina.js';

const hm = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const util = d => d.getDay() >= 1 && d.getDay() <= 5;
const LIMITE = 22 * 60 + 30;

// ---------- TCC: 4 blocos de 1h por semana ----------
export const TCC_BLOCOS = 4;
const PREF = [17, 14, 16, 15, 10, 11, 9];
export const segunda = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); const w = x.getDay(); return addDias(x, w === 0 ? -6 : 1 - w); };

function livreTcc(dd, h, outros = []) {
  const m = h * 60, data = ymd(dd);
  if (m < 9 * 60 || m + 60 > 18 * 60) return false;
  if (m < 13 * 60 && m + 60 > 12 * 60) return false; // almoço
  if (A.ocupados(dd).some(([a, b]) => m < b && m + 60 > a)) return false;
  return !outros.some(o => o.data === data && Math.abs(minutos(o.hora) - m) < 60);
}
function futuro(dd, h) { const hoje = ymd(new Date()), d = ymd(dd); return d > hoje || (d === hoje && h * 60 > agoraMin()); }

function acharSlot(seg, outros, depoisDe = null) {
  const dias = [0, 1, 2, 3, 4].map(i => addDias(seg, i)).sort((a, b) => A.horasReuniao(a) - A.horasReuniao(b));
  for (const max of [1, 2]) for (const dd of dias) {
    if (outros.filter(o => o.data === ymd(dd)).length >= max) continue;
    if (max === 1 && A.horasReuniao(dd) >= 5) continue; // dia cheio: só se não houver alternativa
    for (const h of PREF) {
      if (depoisDe && (ymd(dd) + pad(h)) <= depoisDe) continue;
      if (futuro(dd, h) && livreTcc(dd, h, outros)) return { data: ymd(dd), hora: `${pad(h)}:00` };
    }
  }
  return null;
}

let salvarPendente = null;
function salvarDepois(k, v) { clearTimeout(salvarPendente); salvarPendente = setTimeout(() => S.set(k, v), 0); }

export function planoTcc(d = new Date()) {
  const seg = segunda(d), k = 'tcc:' + ymd(seg);
  let plano = S.get(k, null);
  const temLinks = (() => { const l = S.get('agendas', {}); return l.pessoal || l.trabalho; })();
  if (temLinks && !A.cache().quando) return plano || []; // espera a agenda carregar antes de planejar
  if (ymd(segunda(new Date())) !== ymd(seg)) return plano || []; // só planeja a semana atual
  let mudou = false;
  if (!plano) {
    plano = [];
    for (let i = 0; i < TCC_BLOCOS; i++) { const s = acharSlot(seg, plano); if (!s) break; plano.push({ id: 'tcc-' + i, ...s }); }
    mudou = true;
  } else {
    const hoje = ymd(new Date());
    plano = plano.map(x => ({ ...x }));
    for (let i = 0; i < plano.length; i++) {
      const b = plano[i];
      if (feito(b.data, b.id)) continue;
      const dd = deYmd(b.data), h = Number(b.hora.slice(0, 2));
      const outros = plano.filter((_, j) => j !== i);
      const perdido = b.data < hoje;
      const choque = !perdido && futuro(dd, h) && !livreTcc(dd, h, outros);
      if (!perdido && !choque) continue;
      const s = acharSlot(seg, outros);
      if (!s) continue;
      mudou = true;
      plano[i] = { ...b, ...s, remarcado: perdido ? 'ficou pra trás — movi sem culpa' : 'choque com a agenda' };
    }
  }
  if (mudou) salvarDepois(k, plano);
  return plano;
}

export function remarcarTcc(id) {
  const seg = segunda(new Date()), k = 'tcc:' + ymd(seg);
  const plano = S.get(k, []);
  const b = plano.find(x => x.id === id); if (!b) return null;
  const s = acharSlot(seg, plano.filter(o => o !== b), b.data + b.hora.slice(0, 2)) || acharSlot(seg, plano.filter(o => o !== b));
  if (!s) return null;
  S.set(k, plano.map(x => x === b ? { ...x, ...s, remarcado: 'remarcado por você' } : x));
  return s;
}

// ---------- Dia completo ----------
export function montarDia(d = new Date(), agora = new Date()) {
  const data = ymd(d);
  const bebe = !!S.get('config', {}).bebe;
  const itens = itensDoDia(d, agora);
  if (!bebe && util(d)) {
    for (const b of planoTcc(d).filter(b => b.data === data)) {
      itens.push({ id: b.id, data, area: 'estudo', titulo: '📚 TCC — bloco de 1h', hora: b.hora, dur: 60, sub: b.remarcado ? `Remarcado: ${b.remarcado}` : '2 Pomodoros de 25 min', link: '#faculdade', feito: feito(data, b.id) });
    }
  }
  const eventos = A.doDia(d);
  const ocup = eventos.filter(e => !e.diaTodo).map(e => ({ a: minutos(e.hora), b: minutos(e.horaFim), e }));
  const postos = [...ocup];
  const mudancas = [];
  itens.sort((a, b) => minutos(a.hora) - minutos(b.hora));
  for (const it of itens) {
    const dur = it.dur || 15;
    const choque = x => postos.find(p => x < p.b && x + dur > p.a);
    let ini = minutos(it.hora);
    const c = !it.feito && it.id !== 'vitamina' && !it.id.startsWith('tcc') ? choque(ini) : null;
    if (c) {
      let x = ini, cc;
      while (x + dur <= LIMITE && (cc = choque(x))) x = Math.max(x + 5, cc.b);
      if (x + dur <= LIMITE) {
        const de = it.hora; it.hora = hm(x); ini = x;
        const motivo = c.e ? c.e.titulo : 'outra tarefa';
        it.tag = 'remarcado'; it.sub = `Choque com “${motivo}” · era ${de}`;
        mudancas.push({ titulo: it.titulo, de, para: it.hora, motivo });
      } else it.conflito = c.e?.titulo;
    }
    postos.push({ a: ini, b: ini + dur });
  }
  itens.sort((a, b) => minutos(a.hora) - minutos(b.hora));
  return { data, itens, eventos, diaTodo: eventos.filter(e => e.diaTodo), comHora: eventos.filter(e => !e.diaTodo), mudancas, horasReuniao: A.horasReuniao(d) };
}
