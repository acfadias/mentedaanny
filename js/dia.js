// Junta rotina + agendas + TCC e encaixa as tarefas quando algo se choca.
import * as S from './store.js';
import * as A from './agenda.js';
import { itensDoDia, ymd, deYmd, addDias, minutos, agoraMin, pad, feito } from './rotina.js';

const hm = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const util = d => d.getDay() >= 1 && d.getDay() <= 5;
const LIMITE = 22 * 60 + 30;

// ---------- TCC: 4 blocos de 1h por semana, à noite ----------
// Durante o expediente ela precisa estar disponível pro trabalho. Se sobrar janela livre, o app sugere adiantar.
export const TCC_BLOCOS = 4;
const NOITE_INI = 18 * 60 + 45, NOITE_FIM = 22 * 60 + 15;
const CANDIDATOS = []; for (let m = NOITE_INI; m + 60 <= NOITE_FIM; m += 15) CANDIDATOS.push(m);
export const segunda = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); const w = x.getDay(); return addDias(x, w === 0 ? -6 : 1 - w); };

// Horários da rotina que o TCC não deve atropelar (vitamina é rapidinha, dá pra tomar estudando)
function rotinaOcupada(dd) {
  return itensDoDia(dd, new Date(0)).filter(i => i.id !== 'vitamina' && i.id !== 'devocional' && !i.opcional).map(i => [minutos(i.hora), minutos(i.hora) + (i.dur || 15)]);
}
function livreEm(dd, m, outros = [], { noite = true } = {}) {
  const data = ymd(dd);
  if (noite && (m < NOITE_INI || m + 60 > NOITE_FIM)) return false;
  if (A.ocupados(dd).some(([a, b]) => m < b && m + 60 > a)) return false;
  if (noite && rotinaOcupada(dd).some(([a, b]) => m < b && m + 60 > a)) return false;
  return !outros.some(o => o.data === data && Math.abs(minutos(o.hora) - m) < 60);
}
function futuro(dd, m) { const hoje = ymd(new Date()), d = ymd(dd); return d > hoje || (d === hoje && m > agoraMin()); }

function acharSlot(seg, outros, depoisDe = null, preferDia = null) {
  const dias = [0, 1, 2, 3, 4].map(i => addDias(seg, i)).sort((a, b) => (ymd(b) === preferDia) - (ymd(a) === preferDia) || A.horasReuniao(a) - A.horasReuniao(b) || a - b);
  for (const max of [1, 2]) for (const dd of dias) {
    if (outros.filter(o => o.data === ymd(dd)).length >= max) continue;
    if (max === 1 && A.horasReuniao(dd) >= 5) continue; // dia cheio: só se não houver alternativa
    for (const m of CANDIDATOS) {
      if (depoisDe && `${ymd(dd)} ${hm(m)}` <= depoisDe) continue;
      if (futuro(dd, m) && livreEm(dd, m, outros)) return { data: ymd(dd), hora: hm(m) };
    }
  }
  return null;
}

// Janela livre no expediente de hoje (≥ 1h, fora de reuniões, rotinas fixas e almoço) para adiantar o TCC
export function janelaParaAdiantar() {
  const hoje = new Date(); if (!util(hoje)) return null;
  const plano = planoTcc(hoje);
  const bloco = plano.find(b => b.data === ymd(hoje) && !b.adiantado && !feito(b.data, b.id) && minutos(b.hora) >= NOITE_INI);
  if (!bloco) return null;
  const agora = Math.ceil(agoraMin() / 15) * 15;
  const ocup = [...A.ocupados(hoje).map(([a, b]) => [a, b]), [12 * 60, 13 * 60], ...itensDoDia(hoje).filter(i => i.area === 'trabalho').map(i => [minutos(i.hora), minutos(i.hora) + (i.dur || 15)])];
  for (let m = Math.max(agora, 10 * 60 + 30); m + 60 <= 18 * 60; m += 15) {
    if (!ocup.some(([a, b]) => m < b && m + 60 > a)) return { bloco, hora: hm(m) };
  }
  return null;
}
export function adiantarTcc(id, hora) {
  const k = 'tcc:' + ymd(segunda(new Date()));
  S.set(k, S.get(k, []).map(b => b.id === id ? { ...b, data: ymd(new Date()), hora, adiantado: true, remarcado: 'adiantado por você ✨' } : b));
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
      const dd = deYmd(b.data), m = minutos(b.hora);
      const outros = plano.filter((_, j) => j !== i);
      const perdido = b.data < hoje;
      const foraDaNoite = !b.adiantado && (m < NOITE_INI || m + 60 > NOITE_FIM);
      const choque = !perdido && futuro(dd, m) && !livreEm(dd, m, outros, { noite: !b.adiantado });
      if (!perdido && !choque && !(foraDaNoite && futuro(dd, m))) continue;
      const s = acharSlot(seg, outros, null, perdido ? null : b.data);
      if (!s) continue;
      mudou = true;
      const { adiantado, ...resto } = b;
      plano[i] = { ...resto, ...s, remarcado: perdido ? 'ficou pra trás — movi sem culpa' : foraDaNoite ? 'TCC agora fica à noite' : 'choque com a agenda' };
    }
  }
  if (mudou) salvarDepois(k, plano);
  return plano;
}

export function remarcarTcc(id) {
  const seg = segunda(new Date()), k = 'tcc:' + ymd(seg);
  const plano = S.get(k, []);
  const b = plano.find(x => x.id === id); if (!b) return null;
  const s = acharSlot(seg, plano.filter(o => o !== b), `${b.data} ${b.hora}`) || acharSlot(seg, plano.filter(o => o !== b));
  if (!s) return null;
  S.set(k, plano.map(x => x === b ? { ...x, ...s, adiantado: false, remarcado: 'remarcado por você' } : x));
  return s;
}

// ---------- Dia completo ----------
export function montarDia(d = new Date(), agora = new Date()) {
  const data = ymd(d);
  const bebe = !!S.get('config', {}).bebe;
  const itens = itensDoDia(d, agora);
  if (!bebe && util(d)) {
    for (const b of planoTcc(d).filter(b => b.data === data)) {
      itens.push({ id: b.id, data, area: 'estudo', titulo: '📚 TCC — bloco de 1h', hora: b.hora, dur: 60, sub: b.remarcado ? (b.adiantado ? b.remarcado : `Remarcado: ${b.remarcado}`) : '2 Pomodoros de 25 min', link: '#faculdade', feito: feito(data, b.id) });
    }
  }
  const eventos = A.doDia(d);
  const ocup = eventos.filter(e => !e.diaTodo).map(e => ({ a: minutos(e.hora), b: minutos(e.horaFim), e }));
  const postos = [...ocup];
  const mudancas = [];
  itens.sort((a, b) => minutos(a.hora) - minutos(b.hora));
  for (const it of itens) {
    if (it.opcional) continue; // pendência de ontem não empurra o planejado de hoje
    const dur = it.dur || 15;
    const choque = x => postos.find(p => x < p.b && x + dur > p.a);
    let ini = minutos(it.hora);
    const c = !it.feito && !it.fixo && it.id !== 'vitamina' && !it.id.startsWith('tcc') ? choque(ini) : null;
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
    postos.push({ a: ini, b: ini + dur, e: { titulo: it.titulo.replace(/^[^\p{L}\d]+\s/u, '') } });
  }
  itens.sort((a, b) => minutos(a.hora) - minutos(b.hora));
  return { data, itens, eventos, diaTodo: eventos.filter(e => e.diaTodo), comHora: eventos.filter(e => !e.diaTodo), mudancas, horasReuniao: A.horasReuniao(d) };
}

// ---------- Pendências da semana ----------
// O que ficou pra trás de domingo até ontem (desde que o app começou a ser usado).
export function pendenciasSemana(hoje = new Date()) {
  const h0 = new Date(hoje); h0.setHours(0, 0, 0, 0);
  const inicio = S.get('inicio', ymd(h0));
  const ontemUtil = (() => { let x = addDias(h0, -1); while (!util(x)) x = addDias(x, -1); return ymd(x); })();
  const out = [];
  for (let d = addDias(h0, -h0.getDay()); d < h0; d = addDias(d, 1)) {
    const data = ymd(d);
    if (data < inicio) continue;
    const ch = S.get('checks:' + data, {});
    for (const it of itensDoDia(d, hoje)) {
      if (it.feito || it.opcional || ch['pulou:' + it.id]) continue;
      if (['vitamina', 'devocional', 'checkcasa', 'agua1', 'agua2', 'descanso'].includes(it.id)) continue;
      if (it.area === 'casa' && data === ontemUtil) continue; // já aparece hoje como "de ontem"
      out.push({ tipo: 'item', data, id: it.id, titulo: it.titulo, fonte: it.area === 'trabalho' ? 'trabalho' : 'pessoal', d });
    }
    S.get('top3:' + data, []).forEach((p, i) => { if (p.t?.trim() && !p.feito && !p.pulou) out.push({ tipo: 'top', data, i, titulo: p.t, fonte: p.fonte || 'pessoal', d }); });
  }
  return out;
}
