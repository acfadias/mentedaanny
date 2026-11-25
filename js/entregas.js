// Entregas da faculdade: prazos com contagem regressiva e alertas que ficam mais fortes perto do fim.
import * as S from './store.js';
import * as A from './agenda.js';
import { addDias, ymd } from './rotina.js';

// Reconhece entregas: compromisso marcado como entrega, ou evento com cara de prazo
const RX = /entreg|prazo|atividade|avalia[çc]|prova|\bA[VP]\s?\d|simulado|question[aá]rio|f[oó]rum|portf[oó]lio|\bTCC\b|banca|relat[oó]rio|resenha/i;
const ehEntrega = e => e.entrega || (e.fonte === 'faculdade' && !/aula|orienta/i.test(e.titulo)) || RX.test(e.titulo || '');

const chave = e => `${(e.titulo || '').trim().toLowerCase()}|${e.ini}`;
export const feitas = () => S.get('entregas', {});
export function marcar(k, on) { S.update('entregas', {}, m => { if (on) m[k] = Date.now(); else delete m[k]; }); }

const DIA = 86400000;
export function listar(hoje = new Date()) {
  const h0 = new Date(hoje); h0.setHours(0, 0, 0, 0);
  const vistos = new Map(), f = feitas();
  const marcadas = new Set((S.get('compromissos', []) || []).filter(c => c.entrega).map(c => c.id));
  for (let i = -7; i <= 30; i++) {
    for (const e of A.doDia(addDias(h0, i))) {
      const ev = { ...e, entrega: e.entrega || marcadas.has(e.appId) };
      if (!ehEntrega(ev)) continue;
      const k = chave(ev);
      if (vistos.has(k)) continue;
      const ms = ev.diaTodo ? ev.ini + DIA - 60000 : ev.ini; // dia inteiro = até 23:59
      const dias = Math.floor((new Date(ms).setHours(0, 0, 0, 0) - h0) / DIA);
      const horas = (ms - hoje) / 3600000;
      const entregue = !!f[k];
      const nivel = entregue ? 'ok' : horas < 0 ? 'atrasada' : dias <= 1 ? 'urgente' : dias <= 3 ? 'atencao' : dias <= 7 ? 'aviso' : 'tranquilo';
      vistos.set(k, { k, titulo: ev.titulo, ms, dias, horas, nivel, entregue, link: ev.link, fonte: ev.fonte, data: ymd(new Date(ms)) });
    }
  }
  return [...vistos.values()].filter(x => !(x.entregue && x.horas < -48)).sort((a, b) => a.ms - b.ms);
}

export function quando(x) {
  if (x.entregue) return 'Entregue';
  if (x.horas < 0) { const d = Math.ceil(-x.horas / 24); return d <= 1 ? 'Venceu' : `Venceu há ${d} dias`; }
  if (x.horas < 1) return `Faltam ${Math.max(1, Math.round(x.horas * 60))} min`;
  if (x.dias === 0) return `Hoje · faltam ${Math.round(x.horas)}h`;
  if (x.dias === 1) return 'Amanhã';
  return `Faltam ${x.dias} dias`;
}
export const pendentes = () => listar().filter(x => !x.entregue && ['atrasada', 'urgente', 'atencao', 'aviso'].includes(x.nivel));
