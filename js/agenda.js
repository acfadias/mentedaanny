// Agendas (pessoal + trabalho) via link secreto iCal, lidas pela função "agenda" do Supabase.
import * as S from './store.js';
import { ymd, addDias, minutos } from './rotina.js';

export const FONTES = { pessoal: 'Pessoal', trabalho: 'Trabalho' };
export const FONTES_APP = { trabalho: 'Trabalho', pessoal: 'Pessoal', faculdade: 'Faculdade' };
const CACHE = 'agenda-cache';
let carregando = null;

export function cache() { try { return JSON.parse(S.local(CACHE) || 'null') || { eventos: [], erros: {}, quando: 0 }; } catch { return { eventos: [], erros: {}, quando: 0 }; } }

const RX_LINK = /https?:\/\/(?:[\w-]+\.)?(?:meet\.google\.com|zoom\.us|teams\.microsoft\.com|teams\.live\.com|whereby\.com|webex\.com|jitsi\.org|meet\.jit\.si)[^\s<>"')\]]*/i;
const RX_URL = /https?:\/\/[^\s<>"')\]]+/i;

export function acharLink(ve, ev) {
  const conf = ve.getFirstPropertyValue('x-google-conference');
  if (conf) return String(conf);
  const textos = [ev.location, ve.getFirstPropertyValue('url'), ev.description].filter(Boolean).map(String);
  for (const t of textos) { const m = t.match(RX_LINK); if (m) return m[0]; }
  for (const t of textos) { const m = t.match(RX_URL); if (m && !/google\.com\/calendar|support\.google/.test(m[0])) return m[0]; }
  return null;
}

// Converte o texto .ics em eventos dentro da janela [ini, fim)
export function lerIcs(ICAL, texto, fonte, ini, fim) {
  const comp = new ICAL.Component(ICAL.parse(texto));
  comp.getAllSubcomponents('vtimezone').forEach(tz => { try { ICAL.TimezoneService.register(tz); } catch {} });
  const iniT = ICAL.Time.fromJSDate(ini, true), fimT = ICAL.Time.fromJSDate(fim, true);
  const todos = comp.getAllSubcomponents('vevent').map(v => [v, new ICAL.Event(v)]);
  const mestres = new Map();
  for (const [v, e] of todos) if (!e.isRecurrenceException()) mestres.set(e.uid, [v, e]);
  for (const [, e] of todos) if (e.isRecurrenceException() && mestres.has(e.uid)) mestres.get(e.uid)[1].relateException(e);
  const out = [];
  const add = (ve, item, s, f) => {
    if ((ve.getFirstPropertyValue('status') || '').toUpperCase() === 'CANCELLED') return;
    if (item.component.getFirstPropertyValue('status')?.toUpperCase?.() === 'CANCELLED') return;
    const a = s.toJSDate(), b = (f || s).toJSDate();
    out.push({ id: `${fonte}:${item.uid}:${a.getTime()}`, fonte, titulo: item.summary || '(sem título)', ini: a.getTime(), fim: b.getTime(), diaTodo: s.isDate, local: item.location || '', link: acharLink(item.component, item) });
  };
  for (const [ve, e] of mestres.values()) {
    if (e.isRecurring()) {
      const it = e.iterator(); let n, guarda = 0;
      while ((n = it.next()) && guarda++ < 20000) {
        if (n.compare(fimT) >= 0) break;
        const d = e.getOccurrenceDetails(n);
        if (d.endDate.compare(iniT) <= 0) continue;
        add(ve, d.item, d.startDate, d.endDate);
      }
    } else if (e.startDate && e.startDate.compare(fimT) < 0 && (e.endDate || e.startDate).compare(iniT) > 0) add(ve, e, e.startDate, e.endDate);
  }
  return out;
}

export async function atualizar() {
  if (carregando) return carregando;
  carregando = (async () => {
    const links = S.get('agendas', {});
    if (!links.pessoal && !links.trabalho) return cache();
    const res = await S.funcao('agenda');
    if (!res) return cache();
    const ICAL = (await import('https://cdn.jsdelivr.net/npm/ical.js@2.2.1/+esm')).default;
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const ini = addDias(hoje, -1), fim = addDias(hoje, 15);
    const eventos = [], erros = {};
    for (const f of Object.keys(FONTES)) {
      const r = res[f]; if (!r) continue;
      if (r.erro) { erros[f] = r.erro; continue; }
      try { eventos.push(...lerIcs(ICAL, r.ics, f, ini, fim)); } catch (e) { erros[f] = 'Não consegui ler esta agenda.'; console.warn(e); }
    }
    eventos.sort((a, b) => a.ini - b.ini);
    const c = { eventos, erros, quando: Date.now() };
    S.local(CACHE, JSON.stringify(c));
    return c;
  })().finally(() => { carregando = null; });
  return carregando;
}

const hm = d => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

// Compromissos criados direto no app (com repetição semanal opcional)
export function doApp(a) {
  const data = ymd(a);
  return S.get('compromissos', []).filter(c => c.data === data || (c.semanal && c.data <= data && new Date(c.data + 'T12:00').getDay() === a.getDay()))
    .map(c => { const [y, m, dd] = data.split('-').map(Number); const t = h => { const [hh, mm] = h.split(':').map(Number); return new Date(y, m - 1, dd, hh, mm).getTime(); };
      return { id: 'app:' + c.id + ':' + data, appId: c.id, fonte: c.fonte, titulo: c.titulo, ini: t(c.ini), fim: t(c.fim || c.ini), diaTodo: false, local: c.local || '', link: c.link || null, doApp: true }; });
}

// Eventos de um dia (com horário formatado)
export function doDia(d) {
  const a = new Date(d); a.setHours(0, 0, 0, 0); const b = addDias(a, 1);
  return [...cache().eventos, ...doApp(a)].sort((x, y) => x.ini - y.ini).filter(e => e.ini < b.getTime() && e.fim > a.getTime()).map(e => {
    const i = new Date(Math.max(e.ini, a.getTime())), f = new Date(Math.min(e.fim, b.getTime()));
    return { ...e, hora: e.diaTodo ? null : hm(i), horaFim: e.diaTodo ? null : (f.getTime() === b.getTime() ? '24:00' : hm(f)) };
  });
}

export const ocupados = d => doDia(d).filter(e => !e.diaTodo).map(e => [minutos(e.hora), minutos(e.horaFim), e]);

export function horasReuniao(d) {
  return ocupados(d).reduce((s, [a, b]) => s + (b - a), 0) / 60;
}

export const dataCache = () => ymd(new Date(cache().quando || 0));
