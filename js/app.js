import * as S from './store.js';
import { NOME } from './config.js';
import { progresso, saudacao, dataLonga, ymd, deYmd, addDias, minutos, agoraMin, CASA, DIAS, DIAS_CURTO, MESES } from './rotina.js';
import { PLANO, ETAPAS, CURTA, doDia } from './devocional-plano.js';
import { FRASES, CATEGORIAS, AO_MARCAR, DIA_COMPLETO, DIA_DIFICIL, sortear } from './afirmacoes.js';
import { confeteEm, festa, toast } from './efeitos.js';
import * as A from './agenda.js';
import * as F from './financas.js';
import { montarDia, planoTcc, remarcarTcc, segunda, TCC_BLOCOS, janelaParaAdiantar, adiantarTcc, pendenciasSemana } from './dia.js';

const $ = (s, el = document) => el.querySelector(s);
const app = $('#app');
const ICO_CORACAO = on => `<svg viewBox="0 0 24 24" width="16" height="16" fill="${on ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>`;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const uid = () => Math.random().toString(36).slice(2, 10);
const hojeStr = () => ymd(new Date());

let rota = 'hoje';
let devoSel = null;           // data selecionada no devocional
let filtroFrases = 'todas';
let semanaOffset = 0;
let finMes = null;            // mês aberto em Finanças
let finEditar = false;
let finAba = 'resumo';
let finCat = '';
let finPessoa = '';        // 0 = esta semana
let fraseExtra = 0;           // muda a frase quando ela toca em "outra"
let calado = false;           // evita re-render enquanto ela digita

// ---------- Frase do momento ----------
function fraseDoMomento(salto = 0) {
  const af = S.get('afirmacoes', { favs: [], minhas: [] });
  const h = new Date().getHours();
  const pref = h < 9 ? ['fe', 'mae'] : h < 18 ? ['foco', 'gentileza'] : ['cuidado', 'mae', 'fe'];
  const minhas = (af.minhas || []).map(m => ({ id: m.id, cat: 'minhas', t: m.t }));
  const pool = [];
  for (const f of [...FRASES, ...minhas]) {
    const peso = (af.favs?.includes(f.id) ? 3 : 1) + (pref.includes(f.cat) ? 1 : 0) + (f.cat === 'minhas' ? 2 : 0);
    for (let i = 0; i < peso; i++) pool.push(f);
  }
  const semente = Number(hojeStr().replace(/-/g, '')) * 31 + h * 7 + salto * 13;
  return pool[Math.abs(Math.sin(semente) * 1e6 | 0) % pool.length];
}

function cardFrase(salto = fraseExtra, anelHtml = '') {
  const f = fraseDoMomento(salto);
  const fav = S.get('afirmacoes', {}).favs?.includes(f.id);
  return `<section class="card frase ${anelHtml ? 'com-anel' : ''}">${anelHtml}<div class="frase-corpo">
    <p class="eyebrow" style="color:inherit;opacity:.7">Pra você, agora</p>
    <blockquote class="fade-swap" id="frase-txt">${esc(f.t)}</blockquote>
    <div class="meta"><span>${esc(CATEGORIAS[f.cat] || 'Minhas frases')}</span>
      <span class="acts"><button class="round ${fav ? 'fav' : ''}" data-act="fav" data-id="${f.id}" aria-label="Favoritar">${ICO_CORACAO(fav)}</button>
      <button class="round" data-act="outra-frase" aria-label="Outra frase">↻</button></span></div>
  </div></section>`;
}

// ---------- Componentes ----------
function anel(p, tam = 118) {
  const r = 52, c = 2 * Math.PI * r;
  return `<div class="ring ${p.total && p.ok === p.total ? 'full' : ''}" style="width:${tam}px;height:${tam}px" role="img" aria-label="${p.ok} de ${p.total} feitos">
    <svg viewBox="0 0 120 120"><circle class="trk" cx="60" cy="60" r="${r}" stroke-width="8"/><circle class="val" cx="60" cy="60" r="${r}" stroke-width="8" stroke-dasharray="${c}" stroke-dashoffset="${c}" data-off="${c * (1 - p.pct)}"/></svg>
    <div class="txt"><div><b>${p.ok}/${p.total}</b><span>feitos</span></div></div></div>`;
}

const FONTE_DE_AREA = { fe: 'pessoal', casa: 'pessoal', saude: 'pessoal', estudo: 'faculdade', trabalho: 'trabalho', financas: 'pessoal' };
const ORDEM_FONTES = ['pessoal', 'trabalho', 'faculdade'];
const proxFonte = f => ORDEM_FONTES[(ORDEM_FONTES.indexOf(f || 'pessoal') + 1) % ORDEM_FONTES.length];
const fonteBtn = (f, act, i) => `<button class="fdot f-${f || 'pessoal'}" data-act="${act}" data-i="${i}" title="${FONTE_NOME[f || 'pessoal']} — toque para trocar" aria-label="Agenda: ${FONTE_NOME[f || 'pessoal']}. Toque para trocar"></button>`;
const legenda = () => `<span class="legenda">${ORDEM_FONTES.map(f => `<span class="f-${f}"><span class="dotc"></span>${FONTE_NOME[f]}</span>`).join('')}</span>`;
const FONTE_NOME = { trabalho: 'Trabalho', pessoal: 'Pessoal', faculdade: 'Faculdade' };
function linkBtn(e, sm = true) {
  return e.link ? `<a class="btn rose ${sm ? 'sm' : ''} entrar" href="${esc(e.link)}" target="_blank" rel="noopener">Entrar ↗</a>` : '';
}
function evHtml(e, idx = 0) {
  const ck = e.ckId && e.data;
  return `<li class="ti ev f-${e.fonte} ${e.feito ? 'feito' : ''}" style="animation-delay:${idx * 45}ms"><time>${e.hora}</time>${ck ? `<input type="checkbox" class="chk" data-check="${e.data}|${esc(e.ckId)}" ${e.feito ? 'checked' : ''} aria-label="${esc(e.titulo)}">` : '<span class="evm" aria-hidden="true"></span>'}
    <div class="body"><div class="t">${esc(e.titulo)}</div><div class="sub"><span class="pill src">${FONTE_NOME[e.fonte] || e.fonte}</span><span>até ${e.horaFim}${e.local && !/^https?:/.test(e.local) ? ' · ' + esc(e.local) : ''}</span>${linkBtn(e)}${e.doApp ? `<button class="x" data-act="del-comp" data-id="${e.appId}" title="Apagar compromisso">×</button>` : btnOcultar(e)}</div></div></li>`;
}
const EVS = new Map(); // eventos na tela, para o botão de ocultar
function btnOcultar(e) { EVS.set(e.id, e); return `<button class="x ocultar" data-act="ocultar" data-id="${esc(e.id)}" title="Não mostrar no app" aria-label="Ocultar ${esc(e.titulo)}">×</button>`; }
function dialogoOcultar(e) {
  let dlg = document.getElementById('dlg-ocultar');
  if (!dlg) { dlg = document.createElement('dialog'); dlg.id = 'dlg-ocultar'; document.body.appendChild(dlg); }
  dlg.innerHTML = `<form method="dialog" class="form"><h2 class="serif" style="font-size:26px;margin:0">Ocultar do app?</h2>
    <p class="note" style="margin:0"><b>${esc(e.titulo)}</b><br>Continua no Google Agenda. Só deixa de aparecer aqui e de contar na organização do seu dia.</p>
    <div class="stack" style="gap:8px;margin-top:6px"><button class="btn" value="um">Ocultar só ${e.hora && e.ini ? 'neste dia' : 'este'}</button>
    ${e.recorrente ? `<button class="btn ghost" value="todos">Ocultar todos os “${esc(e.titulo)}”</button>` : ''}
    <button class="btn ghost" value="cancelar">Cancelar</button></div></form>`;
  dlg.onclose = () => { if (dlg.returnValue === 'um' || dlg.returnValue === 'todos') { A.ocultar(e, dlg.returnValue === 'todos'); toast('Ocultado. Dá pra trazer de volta em Ajustes → Agendas.', 4000); } };
  dlg.returnValue = ''; dlg.showModal();
}
function linhaDoTempo(dia) {
  const agora = new Date();
  const am = agoraMin(agora);
  const itens = dia.itens;
  const prox = itens.find(i => !i.feito && !i.opcional && minutos(i.hora) + 30 >= am);
  const todos = [...itens.map(i => ({ k: 'i', h: minutos(i.hora), v: i })), ...dia.comHora.map(e => ({ k: 'e', h: minutos(e.hora), v: e }))].sort((a, b) => a.h - b.h || (a.k === 'e' ? -1 : 1));
  let html = dia.diaTodo.length ? `<li class="allday">${dia.diaTodo.map(e => `<span class="pill f-${e.fonte}"><span class="dot"></span>${esc(e.titulo)}</span>`).join('')}</li>` : '';
  let marcou = false;
  todos.forEach(({ k, h, v: it }, idx) => {
    if (!marcou && h > am) { html += `<li class="now-line" aria-hidden="true"><time>${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}</time><i></i><span></span></li>`; marcou = true; }
    if (k === 'e') { html += evHtml(it, idx); return; }
    html += `<li class="ti ${it.feito ? 'feito' : ''} ${prox === it ? 'agora' : ''} a-${it.area} f-${it.fonte || FONTE_DE_AREA[it.area] || 'pessoal'}" style="animation-delay:${idx * 45}ms">
      <time>${it.hora}</time>
      <input type="checkbox" class="chk" data-check="${it.data}|${it.id}" ${it.feito ? 'checked' : ''} aria-label="${esc(it.titulo)}">
      <div class="body"><div class="t">${it.link ? `<a href="${it.link}" style="text-decoration:none">${esc(it.titulo)}</a>` : esc(it.titulo)}</div>
        ${(it.sub || it.tag || it.opcional || it.conflito) ? `<div class="sub">${it.tag ? `<span class="pill rose">${esc(it.tag)}</span>` : ''}${it.conflito ? `<span class="pill rose">choca com ${esc(it.conflito)}</span>` : ''}${it.sub ? `<span>${esc(it.sub)}</span>` : ''}${it.opcional && !it.feito ? `<button class="x" data-act="pular" data-d="${it.data}" data-id="${it.id}" title="Deixar pra lá">deixar pra lá ×</button>` : ''}</div>` : ''}
      </div></li>`;
  });
  if (!marcou) html += `<li class="now-line" aria-hidden="true"><time>agora</time><i></i><span></span></li>`;
  return `<ol class="timeline">${html}</ol>`;
}

function cardAgenda(dia) {
  const agora = Date.now();
  const e = dia.comHora.find(e => e.fim > agora && e.ini - agora < 60 * 60000);
  if (!e) return '';
  const min = Math.round((e.ini - agora) / 60000);
  return `<section class="card agora-ev f-${e.fonte}"><div style="min-width:0;flex:1"><p class="eyebrow">${min <= 0 ? 'Acontecendo agora' : `Em ${min} min`} · ${FONTE_NOME[e.fonte]}</p>
    <div class="big">${esc(e.titulo)}</div><p class="muted" style="margin:4px 0 0;font-size:14px">${e.hora}–${e.horaFim}</p></div>${linkBtn(e, false)}</section>`;
}

function cardConvergencia(dia) {
  const amanha = montarDia(addDias(new Date(), 1));
  const linhas = [];
  if (dia.horasReuniao >= 4) linhas.push(`<li> <b>Dia cheio:</b> ${fmtH(dia.horasReuniao)} de compromissos. Foque no essencial e nas 3 prioridades.</li>`);
  for (const m of dia.mudancas) linhas.push(`<li>↪ <b>${esc(m.titulo)}</b> foi de ${m.de} pra <b>${m.para}</b> por causa de “${esc(m.motivo)}”.</li>`);
  const jan = janelaParaAdiantar();
  if (jan) linhas.push(`<li class="row" style="gap:10px"> <span style="flex:1;min-width:200px">Você tem uma <b>janela livre às ${jan.hora}</b> no expediente. Se o trabalho estiver tranquilo, dá pra adiantar o TCC de hoje à noite (${jan.bloco.hora}).</span><button class="btn sm" data-act="adiantar" data-id="${jan.bloco.id}" data-hora="${jan.hora}">Adiantar pra ${jan.hora}</button></li>`);
  if (amanha.horasReuniao >= 4) linhas.push(`<li> <b>Amanhã</b> tem ${fmtH(amanha.horasReuniao)} de compromissos. Que tal adiantar algo hoje?</li>`);
  if (!linhas.length) return '';
  return `<section class="card line conv"><h2>Convergências <small>eu reorganizei pra você</small></h2><ul class="note" style="margin:0;padding-left:0;list-style:none;display:flex;flex-direction:column;gap:8px">${linhas.join('')}</ul></section>`;
}
const fmtH = h => { const m = Math.round(h * 60); return m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}` : `${m} min`; };

function cardProximo(itens, p) {
  const am = agoraMin();
  if (p.total && p.ok === p.total) return `<section class="card next"><div class="done-msg" style="flex:1"><p class="eyebrow">Dia completo</p><div class="big">${esc(sortear(DIA_COMPLETO))}</div></div></section>`;
  const pend = itens.filter(i => !i.feito && !i.opcional);
  const prox = pend.find(i => minutos(i.hora) + 30 >= am) || pend[pend.length - 1];
  if (!prox) return '';
  const dificil = new Date().getHours() >= 19 && p.pct < 0.4;
  return `<section class="card next nf-${prox.fonte || FONTE_DE_AREA[prox.area] || 'pessoal'}">
    <input type="checkbox" class="chk" data-check="${prox.data}|${prox.id}" aria-label="Marcar ${esc(prox.titulo)}">
    <div style="min-width:0"><p class="eyebrow">Próximo passo · ${prox.hora}</p><div class="big">${esc(prox.titulo)}</div>
    ${dificil ? `<p style="margin:8px 0 0;opacity:.9;font-size:14px">${esc(sortear(DIA_DIFICIL))}</p>` : ''}</div></section>`;
}

function cardPendencias() {
  const pend = pendenciasSemana();
  if (!pend.length) return '';
  return `<section class="card line pend"><h2>Ficou pra trás <small>${pend.length} desta semana</small></h2>
    <p class="note" style="margin-top:0">Sem culpa: escolha o que ainda faz sentido. O resto, deixa pra lá.</p>
    <ul class="list">${pend.map(p => `<li class="li f-${p.fonte}"><span class="fdot f-${p.fonte}" style="cursor:default"></span>
      <span class="t">${esc(p.titulo)}<br><small class="muted">${DIAS[p.d.getDay()].toLowerCase()}, ${p.d.getDate()}</small></span>
      <span class="pend-acts"><button class="btn ghost sm" data-act="pend" data-v="feito" data-tipo="${p.tipo}" data-d="${p.data}" data-id="${p.id ?? ''}" data-i="${p.i ?? ''}" title="Já fiz">✓ fiz</button>
      <button class="btn ghost sm" data-act="pend" data-v="hoje" data-tipo="${p.tipo}" data-d="${p.data}" data-id="${p.id ?? ''}" data-i="${p.i ?? ''}" data-t="${esc(p.titulo)}" data-f="${p.fonte}" title="Trazer pra hoje">→ hoje</button>
      <button class="x" data-act="pend" data-v="pular" data-tipo="${p.tipo}" data-d="${p.data}" data-id="${p.id ?? ''}" data-i="${p.i ?? ''}" title="Deixar pra lá">×</button></span></li>`).join('')}</ul></section>`;
}

function cardTop3(data) {
  const top = S.get('top3:' + data, () => [{ t: '' }, { t: '' }, { t: '' }]);
  return `<section class="card"><h2>3 prioridades <small>só três. o resto espera.</small></h2><ul class="list">
    ${top.map((p, i) => `<li class="li f-${p.fonte || 'pessoal'} ${p.feito ? 'feito' : ''}"><span class="num3">${i + 1}</span>${fonteBtn(p.fonte, 'fonte-top', i)}
      <input class="edit" data-top="${i}" data-k="top-${i}" value="${esc(p.t)}" placeholder="${['A coisa mais importante de hoje', 'Se der, isso', 'E isso, se sobrar energia'][i]}" enterkeyhint="done">
      <input type="checkbox" class="chk" data-topchk="${i}" ${p.feito ? 'checked' : ''} ${p.t ? '' : 'disabled'} aria-label="Concluir prioridade ${i + 1}"></li>`).join('')}
  </ul></section>`;
}

function cardCaixa() {
  const cx = S.get('caixa', []);
  return `<section class="card line"><h2>Caixa de entrada <small>jogue aqui, organize depois</small></h2>
    <form class="add" data-form="caixa"><input name="t" placeholder="Lembrei de uma coisa…" autocomplete="off" data-k="caixa-in" enterkeyhint="send"><button class="btn" aria-label="Adicionar">+</button></form>
    <ul class="list">${cx.length ? cx.map((c, i) => `<li class="li f-${c.fonte || 'pessoal'}">${fonteBtn(c.fonte, 'fonte-caixa', i)}<span class="t">${esc(c.t)}</span>
      <button class="btn ghost sm" data-act="promover" data-id="${c.id}" title="Virar prioridade de hoje">↑ hoje</button>
      <button class="x" data-act="del-caixa" data-id="${c.id}" aria-label="Apagar">×</button></li>`).join('') : '<li class="empty">Nada aqui. Cabeça leve.</li>'}</ul></section>`;
}

// ---------- Telas ----------
function telaHoje() {
  const d = new Date(), data = ymd(d);
  const dia = montarDia(d), itens = dia.itens;
  const top = S.get('top3:' + data, []);
  const p = progresso(dia.contaveis, top);
  const bebe = S.get('config', {}).bebe;
  return `<div class="view">
    <div class="grid hoje-top">
      <div class="c-7 saud"><p class="eyebrow">${dataLonga(d)}${bebe ? ' · <span class="bebe-badge">Modo Bebê</span>' : ''}</p><h1>${saudacao(d)}, <em>${esc(NOME)}.</em></h1></div>
      <div class="c-5">${cardFrase(fraseExtra, anel(p, 112))}</div>
    </div>
    ${atalhos(dia)}
    ${(() => { const c = A.cache(), l = S.get('agendas', {}); const erro = c.erros?.geral || Object.values(c.erros || {})[0]; return (l.pessoal || l.trabalho) && erro ? `<a class="banner" href="#ajustes" style="text-decoration:none;margin-top:0">Suas agendas não estão aparecendo: ${esc(erro)} <b>Ver em Ajustes →</b></a>` : ''; })()}
    <div class="grid">
      <div class="c-7 stack">${cardAgenda(dia)}${cardProximo(itens, p)}${cardConvergencia(dia)}<section class="card"><h2>Seu dia <span class="row">${legenda()}<small>${dia.contaveis.filter(i => i.feito).length} de ${dia.contaveis.length} tarefas</small><button class="btn ghost sm" data-act="novo-comp">+ Compromisso</button></span></h2>${linhaDoTempo(dia)}</section></div>
      <div class="c-5 stack">${cardTop3(data)}${cardPendencias()}${cardCaixa()}</div>
    </div></div>`;
}

function semanaBase() {
  const d = new Date(); const dow = d.getDay();
  const seg = addDias(d, dow === 0 ? 1 : dow === 6 ? 2 : 1 - dow);
  return [0, 1, 2, 3, 4].map(i => addDias(seg, i));
}

function telaCasa() {
  const dias = semanaBase(), hoje = hojeStr();
  const compras = S.get('compras', []);
  const sugest = ['Leite', 'Pão', 'Ovos', 'Frutas', 'Café', 'Papel higiênico', 'Fraldas', 'Lenço umedecido', 'Detergente', 'Sabão de roupa'];
  const naLista = new Set(compras.filter(c => !c.feito).map(c => c.t.toLowerCase()));
  const bebe = S.get('config', {}).bebe;
  return `<div class="view">
    <div class="hero"><div><p class="eyebrow">Gestão da casa</p><h1>Casa <em>em paz.</em></h1></div></div>
    ${bebe ? '<div class="banner">Modo Bebê ligado: as tarefas da casa estão pausadas e não acumulam. Quem puder ajudar, ajuda.</div>' : ''}
    <div class="grid">
      <section class="card c-12"><h2>Semana <small>seg a sex · fim de semana livre</small></h2><div class="semana f-pessoal">
        ${dias.map(d => { const ds = ymd(d); const ch = S.get('checks:' + ds, {}); const ts = CASA.filter(t => t.dias.includes(d.getDay()));
          return `<div class="dia ${ds === hoje ? 'hoje' : ''}"><h3>${DIAS[d.getDay()]}</h3><div class="d">${d.getDate()} de ${MESES[d.getMonth()]}${ds === hoje ? ' · hoje' : ''}</div><div class="tasks">
          ${ts.map(t => `<label><input type="checkbox" class="chk" data-check="${ds}|${t.id}" ${ch[t.id] ? 'checked' : ''}><span>${t.titulo}<br><small class="muted">${t.hora}</small></span></label>`).join('')}</div></div>`; }).join('')}
      </div></section>
      <section class="card c-7"><h2>Lista de compras <small>${compras.filter(c => !c.feito).length} itens</small></h2>
        <form class="add" data-form="compras"><input name="t" placeholder="Acabou o quê?" autocomplete="off" data-k="compras-in" enterkeyhint="send"><button class="btn">Adicionar</button></form>
        <div class="chips">${sugest.filter(s => !naLista.has(s.toLowerCase())).map(s => `<button class="chip" data-act="sugestao" data-t="${esc(s)}">+ ${esc(s)}</button>`).join('')}</div>
        <ul class="list" style="margin-top:10px">${compras.length ? compras.map(c => `<li class="li f-pessoal ${c.feito ? 'feito' : ''}"><input type="checkbox" class="chk" data-compra="${c.id}" ${c.feito ? 'checked' : ''} aria-label="${esc(c.t)}"><span class="t">${esc(c.t)}</span><button class="x" data-act="del-compra" data-id="${c.id}" aria-label="Apagar">×</button></li>`).join('') : '<li class="empty">Lista vazia. Geladeira feliz.</li>'}</ul>
        ${compras.some(c => c.feito) ? '<div class="row" style="margin-top:12px"><button class="btn ghost sm" data-act="limpar-compras">Limpar comprados</button></div>' : ''}
      </section>
      <section class="card line c-5"><h2>Como funciona</h2><div class="note">
        <p> <b>Louça</b> dia sim, dia não: seg, qua e sex.</p>
        <p> <b>Roupa</b> nos dias sem louça: ter e qui.</p>
        <p> <b>Chão</b> qua e sex — casa limpa antes do fim de semana.</p>
        <p> <b>Área dos cachorros</b> junto com a roupa: ter e qui.</p>
        <p> <b>Garagem</b> toda sexta, na hora do almoço.</p>
        <p><b>Cozinha e escritório</b> todo dia útil às 18h30, antes do jantar.</p>
        <p>Se algo ficar pra trás, aparece no dia seguinte como <b>opcional</b>. Nada fica vermelho. Dá pra “deixar pra lá” sem culpa.</p>
      </div></section>
    </div></div>`;
}

function telaDevocional() {
  const hoje = hojeStr();
  if (!devoSel) devoSel = doDia(hoje) ? hoje : (hoje < PLANO[0].data ? PLANO[0].data : PLANO[PLANO.length - 1].data);
  const dia = doDia(devoSel);
  const st = S.get('devo:' + devoSel, null);
  const bebe = S.get('config', {}).bebe;
  const feitos = PLANO.filter(p => S.get('devo:' + p.data, null)).length;
  const fim = hoje > PLANO[PLANO.length - 1].data;
  return `<div class="view">
    <div class="hero devo-head"><div style="max-width:780px"><p class="eyebrow">${esc(dia.semana.tema)} · ${dataLonga(deYmd(dia.data))}</p><h1>${esc(dia.foco)}</h1><p class="verso">${esc(dia.semana.verso)}</p></div>
      <div class="hero-side">${anel({ ok: feitos, total: PLANO.length, pct: feitos / PLANO.length })}</div></div>
    ${fim ? '<div class="banner">O plano de 2026 terminou. Peça um plano novo pra 2027 e ele aparece aqui.</div>' : ''}
    <div class="dias" id="dias">${PLANO.map(p => { const s = S.get('devo:' + p.data, null); const d = deYmd(p.data);
      return `<button class="dbtn ${s ? (s === 'curto' ? 'curto' : 'feito') : ''} ${p.data === hoje ? 'hoje' : ''} ${p.data === devoSel ? 'sel' : ''}" data-act="devo-dia" data-d="${p.data}" aria-label="${dataLonga(d)}"><span>${DIAS_CURTO[d.getDay()]}</span><b>${d.getDate()}</b><i></i></button>`; }).join('')}</div>
    <div class="grid" style="margin-top:8px">
      <div class="c-7 stack">
        <section class="card"><h2>Leituras de hoje</h2><div class="leituras">
          <div><span>Leitura principal</span><b>${esc(dia.leitura)}</b></div>
          <div><span>Salmo de apoio</span><b>${esc(dia.salmo)}</b></div>
          <div><span>Foco</span><b style="font-size:20px">${esc(dia.foco)}</b></div></div></section>
        <section class="card"><h2>Diário</h2><p class="pergunta">${esc(dia.pergunta)}</p>
          <textarea data-diario="${dia.data}" data-k="diario" placeholder="Escreva aqui. Ninguém mais vê.">${esc(S.get('diario:' + dia.data, ''))}</textarea>
          <p class="note" style="margin:8px 0 0">Salvo automaticamente.</p></section>
      </div>
      <div class="c-5 stack">
        <section class="card line"><h2>Roteiro <small>25 min</small></h2>
          <div class="timer"><div class="clock" id="t-clock">25:00</div><div class="row"><button class="btn rose" data-act="timer">Começar</button><button class="btn ghost sm" data-act="timer-zerar">Zerar</button></div></div>
          <div class="bar"><i id="t-bar" style="width:0"></i></div>
          <ol class="etapas" id="etapas">${ETAPAS.map((e, i) => `<li class="etapa" data-i="${i}"><span class="n">${i + 1}</span><div><div class="tt">${e.t}</div><div class="dd">${e.d}</div></div><span class="min">${e.min} min</span></li>`).join('')}</ol>
        </section>
        <section class="card">${st ? `<p class="eyebrow">Feito ${st === 'curto' ? '(versão curta)' : ''}</p><p class="serif" style="font-size:24px;margin:0 0 12px">Que bom que você esteve aqui hoje.</p><button class="btn ghost sm" data-act="devo-desfazer">Desmarcar</button>`
          : `<p class="eyebrow">Concluir</p><div class="row"><button class="btn" data-act="devo-ok" data-v="completo">Concluí ✓</button><button class="btn ghost" data-act="devo-ok" data-v="curto">Fiz a versão curta</button></div><p class="note" style="margin:12px 0 0">${esc(CURTA)}${bebe ? ' Com o Modo Bebê, a versão curta é o padrão.' : ''}</p>`}</section>
      </div>
    </div></div>`;
}

function telaFrases() {
  const af = S.get('afirmacoes', { favs: [], minhas: [] });
  const minhas = (af.minhas || []).map(m => ({ ...m, cat: 'minhas' }));
  let lista = [...minhas, ...FRASES];
  if (filtroFrases === 'favs') lista = lista.filter(f => af.favs?.includes(f.id));
  else if (filtroFrases !== 'todas') lista = lista.filter(f => f.cat === filtroFrases);
  const filtros = { todas: 'Todas', favs: 'Favoritas', ...CATEGORIAS, minhas: 'Minhas' };
  return `<div class="view">
    <div class="hero"><div><p class="eyebrow">Palavras de afirmação</p><h1>Frases <em>pra você.</em></h1></div></div>
    <div class="grid" style="margin-bottom:22px"><div class="c-7">${cardFrase()}</div>
      <section class="card line c-5"><h2>Escreva a sua</h2><form class="add" data-form="frase"><input name="t" placeholder="Uma frase que te fortalece…" autocomplete="off" data-k="frase-in"><button class="btn">Salvar</button></form>
      <p class="note">Suas frases e favoritas aparecem mais vezes na tela Hoje e na geladeira.</p></section></div>
    <div class="chips" style="margin-bottom:18px">${Object.entries(filtros).map(([k, v]) => `<button class="chip ${filtroFrases === k ? 'on' : ''}" data-act="filtro" data-f="${k}">${v}</button>`).join('')}</div>
    <div class="frases-list">${lista.length ? lista.map((f, i) => `<article class="fcard" style="animation-delay:${Math.min(i, 20) * 25}ms"><p>${esc(f.t)}</p><div class="meta"><span>${esc(CATEGORIAS[f.cat] || 'Minha')}</span><span>
      ${f.cat === 'minhas' ? `<button class="x" data-act="del-frase" data-id="${f.id}" aria-label="Apagar">×</button>` : ''}
      <button class="heart ${af.favs?.includes(f.id) ? 'on' : ''}" data-act="fav" data-id="${f.id}" aria-label="Favoritar">${ICO_CORACAO(af.favs?.includes(f.id))}</button></span></div></article>`).join('') : '<p class="empty">Nada aqui ainda.</p>'}</div>
  </div>`;
}

function telaAjustes() {
  const cfg = S.get('config', {});
  const tema = S.local('tema') || 'auto';
  const u = S.conta();
  let contaHtml;
  if (!S.temNuvem()) contaHtml = `<div class="banner">Falta colar a chave do Supabase em <code>js/config.js</code>. Até lá, tudo fica salvo só neste aparelho.</div>`;
  else if (u) contaHtml = `<div class="set"><div><b>Conectada</b><p>${esc(u.email)} · ${S.ultimoErro ? `<span style="color:var(--accent)">não está sincronizando: ${esc(S.ultimoErro)}</span>` : S.pendentesQtd() ? `${S.pendentesQtd()} alterações esperando envio` : 'tudo sincronizado'}</p></div><button class="btn ghost sm" data-act="sair">Sair</button></div>`;
  else contaHtml = `<form class="form" data-form="login"><input type="email" name="email" placeholder="E-mail" autocomplete="email" required><input type="password" name="senha" placeholder="Senha" autocomplete="current-password" required minlength="6">
    <div class="row"><button class="btn" name="modo" value="entrar">Entrar</button><button class="btn ghost" name="modo" value="criar">Criar minha conta</button></div>
    <p class="note">Crie a conta uma única vez. Depois, bloqueie novos cadastros no Supabase para ninguém mais conseguir entrar.</p></form>`;
  return `<div class="view">
    <div class="hero"><div><p class="eyebrow">Do seu jeito</p><h1>Ajustes</h1></div></div>
    <div class="grid">
      <section class="card c-6"><h2>Modo Bebê</h2><div class="set"><div><b>${cfg.bebe ? 'Ligado' : 'Desligado'}</b><p>Reduz tudo ao essencial: devocional curto, vitamina, água e descanso. Casa pausada, sem acumular.</p></div>
        <input type="checkbox" class="switch" data-act="bebe" ${cfg.bebe ? 'checked' : ''} aria-label="Modo Bebê"></div></section>
      <section class="card c-6"><h2>Tema</h2><div class="chips">${[['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Noturno']].map(([k, v]) => `<button class="chip ${tema === k ? 'on' : ''}" data-act="tema" data-t="${k}">${v}</button>`).join('')}</div>
        <p class="note">O automático segue o aparelho: claro de dia, noturno à noite.</p></section>
      <section class="card c-6"><h2>Modo Geladeira</h2><p class="note">Tela cheia para o iPad: relógio grande, próximo passo, checks e lista de compras. Escurece sozinha à noite.</p>
        <a class="btn" href="#geladeira">Abrir Modo Geladeira</a>
        <details class="note" style="margin-top:12px"><summary>Como deixar o iPad fixo na geladeira</summary><ol>
          <li>No Safari, abra o site → Compartilhar → <b>Adicionar à Tela de Início</b>.</li>
          <li>Abra pelo ícone e toque em <b>Abrir Modo Geladeira</b>. Toque uma vez na tela para mantê-la acesa.</li>
          <li>Ajustes do iPad → Tela e Brilho → <b>Bloqueio Automático: Nunca</b>, com o iPad na tomada.</li>
          <li>Opcional: Ajustes → Acessibilidade → <b>Acesso Guiado</b> para travar no app.</li></ol></details></section>
      <section class="card c-6"><h2>Lembretes no celular</h2><p class="note">Um arquivo com toda a rotina (devocional, casa, vitamina). Importe uma vez na sua agenda <b>pessoal</b> e o celular avisa sozinho.</p>
        <a class="btn" href="lembretes.ics" download>Baixar lembretes</a>
        <details class="note" style="margin-top:12px"><summary>Como importar</summary><ol>
          <li><b>iPhone/iPad:</b> toque no arquivo baixado → Adicionar todos → escolha a agenda pessoal.</li>
          <li><b>Google Agenda (computador):</b> Configurações → Importar e exportar → Importar → escolha a agenda pessoal. O Google usa o alerta padrão da agenda; deixe em “no horário do evento”.</li></ol></details>
        <div class="set"><div><b>Avisos com o app aberto</b><p>Notifica no horário de cada tarefa enquanto o site estiver aberto.</p></div><button class="btn ghost sm" data-act="notif">${'Notification' in window && Notification.permission === 'granted' ? 'Ativados ✓' : 'Ativar'}</button></div></section>
      <section class="card c-6"><h2>Frases</h2><p class="note">Suas afirmações, favoritas e frases próprias.</p><a class="btn ghost" href="#frases">Abrir frases</a></section>
      ${cardAgendas()}
      ${cardFeed()}
      <section class="card c-12"><h2>Conta e sincronização</h2>${contaHtml}</section>
    </div></div>`;
}

function telaGeladeira() {
  const d = new Date(), data = ymd(d);
  const dia = montarDia(d), itens = dia.itens;
  const p = progresso(dia.contaveis, S.get('top3:' + data, []));
  const compras = S.get('compras', []).filter(c => !c.feito);
  return `<div class="fr view">
    <a class="round fr-exit" href="#hoje" aria-label="Sair do Modo Geladeira">×</a>
    <div class="fr-left">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap"><div><div class="fr-clock" id="fr-clock">--:--</div><div class="fr-date">${dataLonga(d)}</div></div>${anel(p, 130)}</div>
      ${cardAgenda(dia)}
      ${cardFrase()}
      ${cardProximo(itens, p)}
      <section class="card"><h2>Compras <small>${compras.length}</small></h2>
        <form class="add" data-form="compras"><input name="t" placeholder="Acabou o quê?" autocomplete="off" data-k="fr-compras"><button class="btn">+</button></form>
        <ul class="list">${compras.slice(0, 8).map(c => `<li class="li"><input type="checkbox" class="chk" data-compra="${c.id}"><span class="t">${esc(c.t)}</span></li>`).join('') || '<li class="empty">Nada faltando.</li>'}</ul></section>
    </div>
    <section class="card"><h2>Hoje</h2>${linhaDoTempo(dia)}</section>
    <div class="fr-dim" id="fr-dim"></div>
  </div>`;
}


function telaFaculdade() {
  const plano = planoTcc();
  const feitos = plano.filter(b => S.get('checks:' + b.data, {})[b.id]).length;
  const agora = new Date();
  const aulas = [0, 1, 2, 3, 4, 5, 6].flatMap(i => A.doDia(addDias(agora, i)).filter(e => e.fonte === 'faculdade' || /aula|tcc|faculdade|orienta/i.test(e.titulo)).map(e => ({ ...e, d: addDias(agora, i) })));
  const temLinks = (() => { const l = S.get('agendas', {}); return l.pessoal || l.trabalho; })();
  return `<div class="view">
    <div class="hero"><div><p class="eyebrow">EAD · reta final</p><h1>Faculdade <em>& TCC.</em></h1></div><div class="hero-side">${anel({ ok: feitos, total: TCC_BLOCOS, pct: feitos / TCC_BLOCOS })}</div></div>
    <div class="grid">
      <div class="c-7 stack">
        <section class="card"><h2>Blocos da semana <small>${feitos}h de ${TCC_BLOCOS}h</small></h2>
          ${plano.length ? `<ul class="list">${plano.map(b => { const d = deYmd(b.data); const ok = !!S.get('checks:' + b.data, {})[b.id]; return `<li class="li f-faculdade ${ok ? 'feito' : ''}">
            <input type="checkbox" class="chk" data-check="${b.data}|${b.id}" ${ok ? 'checked' : ''} aria-label="Bloco de TCC">
            <span class="t"><b>${DIAS[d.getDay()]}</b>, ${b.hora}–${String(+b.hora.slice(0, 2) + 1).padStart(2, '0')}:00${b.remarcado ? `<br><small class="muted">${esc(b.remarcado)}</small>` : ''}</span>
            ${ok ? '' : `<button class="btn ghost sm" data-act="remarcar-tcc" data-id="${b.id}">Remarcar</button>`}</li>`; }).join('')}</ul>`
          : `<p class="empty">${temLinks && !A.cache().quando ? 'Carregando suas agendas pra achar os horários livres…' : 'Os blocos da semana aparecem aqui.'}</p>`}
          <p class="note" style="margin:12px 0 0">Eu encaixo 4 blocos de 1h <b>à noite</b> (entre 18h45 e 22h15), sem atropelar a rotina da casa. Se sobrar janela livre no expediente, eu sugiro adiantar. Se aparecer uma reunião em cima ou um bloco ficar pra trás, eu remarco sozinha — sem culpa.</p></section>
        <section class="card line"><h2>Próximo passo do TCC</h2><p class="note" style="margin-top:0">Escreva a próxima ação bem pequena e concreta. Fica muito mais fácil começar.</p>
          <input class="campo" data-campo="tcc:proximo" data-k="tcc-prox" value="${esc(S.get('tcc:proximo', ''))}" placeholder="Ex.: reler o resumo do artigo 3 e anotar 3 ideias"></section>
        <section class="card"><h2>Aulas e compromissos <small>próximos 7 dias</small></h2>
          ${aulas.length ? `<ol class="timeline">${aulas.map((e, i) => evHtml({ ...e, hora: `${DIAS_CURTO[e.d.getDay()]} ${e.hora}` }, i)).join('')}</ol>` : '<p class="empty">Nenhuma aula na agenda. Use “+ Compromisso” → Faculdade para adicionar.</p>'}
          <div class="row" style="margin-top:10px"><button class="btn ghost sm" data-act="novo-comp" data-fonte="faculdade">+ Compromisso da faculdade</button></div></section>
      </div>
      <div class="c-5 stack">
        <section class="card line"><h2>Pomodoro <small>25 + 5</small></h2>
          <div class="timer"><div class="clock" id="p-clock">25:00</div><div class="row"><button class="btn rose" data-act="pomo">Começar</button><button class="btn ghost sm" data-act="pomo-zerar">Zerar</button></div></div>
          <div class="bar"><i id="p-bar" style="width:0"></i></div><p class="note" id="p-fase" style="margin:6px 0 0">Foco: 25 min. Celular longe, só uma aba aberta.</p></section>
        ${cardFrase()}
      </div>
    </div></div>`;
}

function telaTrabalho() {
  const hoje = new Date();
  const seg = segunda(hoje);
  const trab = d => A.doDia(d).filter(e => e.fonte === 'trabalho');
  const semana = [0, 1, 2, 3, 4].map(i => { const d = addDias(seg, i); const h = trab(d).filter(e => !e.diaTodo).reduce((s, e) => s + (e.fim - e.ini) / 3600000, 0); return { d, h }; });
  const max = Math.max(4, ...semana.map(x => x.h));
  const tarefas = S.get('trabalho:tarefas', []);
  const lista = d => { const evs = trab(d); return evs.length ? `<ol class="timeline">${evs.map((e, i) => e.diaTodo ? `<li class="allday"><span class="pill f-trabalho"><span class="dot"></span>${esc(e.titulo)}</span></li>` : evHtml(e, i)).join('')}</ol>` : '<p class="empty">Sem reuniões.</p>'; };
  return `<div class="view">
    <div class="hero"><div><p class="eyebrow">Tutory · 9h às 18h</p><h1>Trabalho <em>leve.</em></h1></div></div>
    <div class="grid">
      <div class="c-7 stack">
        <section class="card"><h2>Hoje <button class="btn ghost sm" data-act="novo-comp" data-fonte="trabalho">+ Compromisso</button></h2>${lista(hoje)}</section>
        <section class="card line"><h2>Amanhã <small>${dataLonga(addDias(hoje, 1))}</small></h2>${lista(addDias(hoje, 1))}</section>
      </div>
      <div class="c-5 stack">
        <section class="card"><h2>Semana <small>horas de reunião</small></h2><div class="carga">
          ${semana.map(({ d, h }) => `<div class="cg ${ymd(d) === ymd(hoje) ? 'hoje' : ''} ${h >= 5 ? 'cheio' : ''}"><span>${DIAS_CURTO[d.getDay()]}</span><div class="cg-bar"><i style="height:${Math.round(h / max * 100)}%"></i></div><b>${fmtH(h) || '0'}</b></div>`).join('')}
          </div><p class="note" style="margin:10px 0 0">Dias com 5h ou mais de reunião ficam em rosé: neles eu tiro os blocos de TCC e deixo só o essencial.</p></section>
        <section class="card line"><h2>Tarefas do trabalho <small>${tarefas.filter(t => !t.feito).length}</small></h2>
          <form class="add" data-form="trabalho"><input name="t" placeholder="Ex.: follow-up com lead X" autocomplete="off" data-k="trab-in"><button class="btn">+</button></form>
          <ul class="list">${tarefas.length ? tarefas.map(t => `<li class="li f-trabalho ${t.feito ? 'feito' : ''}"><input type="checkbox" class="chk" data-trab="${t.id}" ${t.feito ? 'checked' : ''}><span class="t">${esc(t.t)}</span>
            ${t.feito ? '' : `<button class="btn ghost sm" data-act="trab-hoje" data-id="${t.id}" title="Virar prioridade de hoje">↑ hoje</button>`}<button class="x" data-act="del-trab" data-id="${t.id}">×</button></li>`).join('') : '<li class="empty">Nada pendente.</li>'}</ul>
          ${tarefas.some(t => t.feito) ? '<button class="btn ghost sm" style="margin-top:10px" data-act="limpar-trab">Limpar feitas</button>' : ''}</section>
      </div>
    </div></div>`;
}

function cardAgendas() {
  const l = S.get('agendas', {});
  const c = A.cache();
  const push = A.enviados('trabalho'), pushTok = S.get('push-token', null);
  const minAtras = push ? Math.round((Date.now() - push.quando) / 60000) : 0;
  const linhaPush = push ? `<div class="set"><div><b><span class="dotc f-trabalho"></span>Trabalho (Tutory)</b><p>Conectada pelo Apps Script ✓ · ${push.eventos.length} eventos · atualizada ${minAtras < 1 ? 'agora' : `há ${minAtras} min`}${minAtras > 60 ? '. Faz tempo que não chega nada: confira o script.' : ''}</p></div><button class="btn ghost sm" data-act="gerar-push">Novo código</button></div>` : '';
  const instrPush = pushTok ? `<details class="note" ${push ? '' : 'open'} style="margin-top:6px"><summary>Conectar a agenda da Tutory pelo Apps Script</summary><ol>
      <li>Logada na conta <b>da Tutory</b>, abra <a href="https://script.google.com/home/projects/create" target="_blank" rel="noopener">script.google.com → Novo projeto</a>.</li>
      <li>Apague o que estiver lá e cole <a href="https://raw.githubusercontent.com/acfadias/mentedaanny/main/apps-script/agenda-tutory.gs" target="_blank" rel="noopener">este código</a> (Ctrl+A, Ctrl+C).</li>
      <li>Na linha <code>const CODIGO</code>, troque o texto pelo seu código: <input class="campo" readonly value="${esc(pushTok)}" onclick="this.select()" style="margin-top:6px"></li>
      <li>Na barra da esquerda, em <b>Serviços +</b>, adicione <b>Google Calendar API</b>.</li>
      <li>Salve, escolha a função <b>instalar</b> no topo e clique em <b>Executar</b>. Autorize quando o Google pedir.</li>
      <li>Pronto: a cada 15 min as reuniões chegam aqui, com o link do Meet.</li></ol>
      <div class="row" style="margin-top:8px"><button class="btn ghost sm" data-act="testar-push">Conferir se o código está salvo</button><button class="btn ghost sm" data-act="gerar-push">Gerar código novo</button></div>
      <p class="note" id="push-diag"></p></details>` : '';
  const linha = (k, nome) => k === 'trabalho' && push ? linhaPush + instrPush : `<div class="set"><div><b><span class="dotc f-${k}"></span>${nome}</b><p>${l[k] ? (/\/public\//.test(l[k]) ? 'Atenção: este é o endereço <b>público</b>. Remova e cole o <b>endereço secreto</b> no formato iCal.' : c.erros?.[k] ? 'Atenção: ' + esc(c.erros[k]) : c.contagem?.[k] != null ? `Conectada ✓ · ${c.contagem[k]} eventos entre a semana passada e as próximas 3 semanas` : c.erros?.geral ? 'Ainda não consegui ler (veja o aviso abaixo).' : 'Salva. Toque em “Atualizar agora”.') : 'Cole o endereço secreto iCal desta agenda.'}</p></div>
    ${l[k] ? `<button class="btn ghost sm" data-act="del-agenda" data-k="${k}">Remover</button>` : `<form class="add" data-form="agenda" data-k="${k}" style="margin:0;flex:1;max-width:340px"><input name="t" type="password" placeholder="https://calendar.google.com/…/basic.ics" autocomplete="off"><button class="btn sm">Salvar</button></form>`}</div>`;
  return `<section class="card c-12"><h2>Agendas <small>${c.quando ? 'atualizado às ' + new Date(c.quando).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}</small></h2>
    ${!S.conta() ? '<div class="banner">Entre na sua conta (abaixo) para conectar as agendas.</div>' : ''}
    ${linha('pessoal', 'Pessoal')}${linha('trabalho', 'Trabalho (Tutory)')}
    ${!push ? (pushTok ? instrPush : `<p class="note">A agenda da empresa não tem link secreto? <button class="btn ghost sm" data-act="gerar-push">Conectar pelo Apps Script</button></p>`) : ''}
    ${c.erros?.geral ? `<div class="banner" style="margin-top:12px">${esc(c.erros.geral)}</div>` : ''}
    ${(() => { const oc = A.ocultos(); const itens = [...Object.entries(oc.serie).map(([k, v]) => ({ k, tipo: 'serie', t: v.titulo, sub: 'todos' })), ...Object.entries(oc.inst).map(([k, v]) => ({ k, tipo: 'inst', t: v.titulo, sub: v.ini ? new Date(v.ini).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '' }))];
      return itens.length ? `<details class="note" style="margin-top:10px"><summary>Eventos ocultos (${itens.length})</summary><ul class="list">${itens.map(i => `<li class="li"><span class="t">${esc(i.t)} <small class="muted">· ${esc(i.sub)}</small></span><button class="btn ghost sm" data-act="mostrar-ev" data-tipo="${i.tipo}" data-id="${esc(i.k)}">Mostrar de novo</button></li>`).join('')}</ul></details>` : ''; })()}
    <div class="row" style="margin-top:12px"><button class="btn ghost sm" data-act="atualizar-agenda">Atualizar agora</button></div>
    <p class="note">Os links ficam guardados só na sua conta. As agendas são lidas a cada 30 min e quando você abre o app.</p></section>`;
}

const FEED_BASE = 'https://xvlcbqyjzomzfnewuqpi.supabase.co/functions/v1/feed?t=';
function cardFeed() {
  const tok = S.get('feed-token', null);
  const url = tok ? FEED_BASE + tok : '';
  return `<section class="card c-12"><h2>Levar o app pra sua agenda <small>assine uma vez só</small></h2>
    <p class="note" style="margin-top:0">Um link de agenda com tudo que você cria aqui: compromissos, blocos de TCC e rotinas do trabalho. Você assina uma vez e o que mudar no app aparece sozinho na agenda.</p>
    ${!S.conta() ? '<div class="banner">Entre na sua conta para gerar o link.</div>' : tok ? `<div class="row"><input class="campo" readonly value="${esc(url)}" style="flex:1;min-width:220px" onclick="this.select()"><button class="btn" data-act="copiar-feed">Copiar link</button></div>
      <details class="note" style="margin-top:12px" open><summary>Como assinar</summary><ol>
        <li><b>Google Agenda (computador, conta pessoal):</b> na esquerda, ao lado de “Outras agendas”, clique em <b>+</b> → <b>Do URL</b> → cole o link → <b>Adicionar agenda</b>. Depois escolha a cor rosé.</li>
        <li><b>iPhone/iPad (com alertas):</b> Ajustes → Calendário → Contas → Adicionar Conta → Outra → <b>Adicionar Calendário Assinado</b> → cole o link. Deixe “Remover Alertas” desligado.</li>
        <li>O Google atualiza agendas assinadas por conta própria (pode levar algumas horas). O iPhone permite escolher “a cada 15 min”.</li></ol></details>
      <div class="row" style="margin-top:10px"><button class="btn ghost sm" data-act="gerar-feed">Gerar link novo (o antigo para de funcionar)</button></div>`
    : '<button class="btn" data-act="gerar-feed">Gerar meu link de agenda</button>'}</section>`;
}

function dialogoCompromisso(fonte = 'trabalho', dataPadrao = null) {
  const d = new Date(); const h = String(Math.min(22, d.getHours() + 1)).padStart(2, '0');
  let dlg = document.getElementById('dlg-comp');
  if (!dlg) { dlg = document.createElement('dialog'); dlg.id = 'dlg-comp'; document.body.appendChild(dlg); }
  dlg.innerHTML = `<form class="form" data-form="comp" method="dialog">
    <h2 class="serif" style="font-size:28px;margin:0 0 4px">Novo compromisso</h2>
    <input name="titulo" placeholder="O quê? (reunião, aula, consulta…)" required autocomplete="off">
    <div class="chips" style="margin:0">${Object.entries(A.FONTES_APP).map(([k, v]) => `<label class="chip f-${k}"><input type="radio" name="fonte" value="${k}" ${k === fonte ? 'checked' : ''} class="sr"><span class="dotc"></span>${v}</label>`).join('')}</div>
    <div class="row"><input type="date" name="data" value="${dataPadrao || ymd(d)}" required style="flex:1.4"><input type="time" name="ini" value="${h}:00" required style="flex:1"><input type="time" name="fim" value="${h}:30" style="flex:1"></div>
    <input name="link" type="url" placeholder="Link da reunião/aula (opcional)" autocomplete="off">
    <label class="row note" style="cursor:pointer"><input type="checkbox" name="semanal" class="chk"> Repete toda semana</label>
    <div class="row" style="justify-content:flex-end;margin-top:6px"><button class="btn ghost" value="cancelar" formnovalidate>Cancelar</button><button class="btn" value="salvar">Salvar</button></div>
  </form>`;
  dlg.showModal();
  dlg.querySelector('[name="titulo"]').focus();
}

function telaSemana() {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const dom = addDias(hoje, -hoje.getDay() + semanaOffset * 7);
  const dias = [0, 1, 2, 3, 4, 5, 6].map(i => addDias(dom, i));
  const sab = dias[6];
  const titulo = semanaOffset === 0 ? 'Esta semana' : semanaOffset === 1 ? 'Próxima semana' : semanaOffset === -1 ? 'Semana passada' : `${dom.getDate()}/${dom.getMonth() + 1} a ${sab.getDate()}/${sab.getMonth() + 1}`;
  let totH = 0, totOk = 0, totT = 0;
  const cols = dias.map(d => {
    const dia = montarDia(d);
    const ds = ymd(d), ehHoje = ds === ymd(hoje), passou = d < hoje;
    const tarefas = dia.contaveis.filter(i => !i.opcional);
    const ok = tarefas.filter(i => i.feito).length;
    totH += dia.horasReuniao; totOk += ok; totT += tarefas.length;
    const linhas = [
      ...dia.comHora.map(e => ({ h: minutos(e.hora), html: `<li class="wk-ev f-${e.fonte} ${e.feito ? 'feito' : ''}"><time>${e.hora}</time><div><label class="wk-evck"><input type="checkbox" class="chk" data-check="${e.data}|${esc(e.ckId)}" ${e.feito ? 'checked' : ''} aria-label="${esc(e.titulo)}"><b>${esc(e.titulo)}</b></label>${e.link ? `<a class="wk-link" href="${esc(e.link)}" target="_blank" rel="noopener">Entrar ↗</a>` : ''}</div>${e.doApp ? '' : btnOcultar(e)}</li>` })),
      ...dia.itens.map(i => ({ h: minutos(i.hora), html: `<li class="wk-it f-${i.fonte || FONTE_DE_AREA[i.area] || 'pessoal'} ${i.feito ? 'feito' : ''}"><time>${i.hora}</time><label><input type="checkbox" class="chk" data-check="${i.data}|${i.id}" ${i.feito ? 'checked' : ''}><span>${esc(i.titulo)}${i.tag === 'remarcado' ? ' <i class="wk-tag">↪</i>' : ''}</span></label></li>` })),
    ].sort((a, b) => a.h - b.h).map(x => x.html).join('');
    return `<section class="wk-dia ${ehHoje ? 'hoje' : ''} ${passou ? 'passou' : ''} ${d.getDay() === 0 || d.getDay() === 6 ? 'fds' : ''}">
      <header><a href="${ehHoje ? '#hoje' : '#semana'}" class="wk-h"><span>${DIAS_CURTO[d.getDay()]}</span><b>${d.getDate()}</b></a>
        <div class="wk-meta">${dia.horasReuniao ? `<span class="pill ${dia.horasReuniao >= 5 ? 'rose' : ''}">${fmtH(dia.horasReuniao)}</span>` : ''}<span class="wk-prog" title="${ok} de ${tarefas.length} feitas"><i style="width:${tarefas.length ? ok / tarefas.length * 100 : 0}%"></i></span></div></header>
      ${dia.diaTodo.length ? `<div class="wk-allday">${dia.diaTodo.map(e => `<span class="pill f-${e.fonte}"><span class="dot"></span>${esc(e.titulo)}</span>`).join('')}</div>` : ''}
      <ol class="wk-list">${linhas || '<li class="empty">Livre</li>'}</ol>
      <button class="wk-add" data-act="novo-comp" data-data="${ds}" aria-label="Adicionar compromisso em ${DIAS[d.getDay()]}">+</button>
    </section>`;
  }).join('');
  return `<div class="view">
    <div class="hero"><div><p class="eyebrow">${dom.getDate()} de ${MESES[dom.getMonth()]} a ${sab.getDate()} de ${MESES[sab.getMonth()]}</p><h1>${titulo.replace(/semana/i, '<em>semana</em>')}</h1></div>
      <div class="hero-side"><div class="wk-nav"><button class="round" data-act="semana" data-v="-1" aria-label="Semana anterior">‹</button>${semanaOffset ? '<button class="btn ghost sm" data-act="semana" data-v="0">Hoje</button>' : ''}<button class="round" data-act="semana" data-v="1" aria-label="Próxima semana">›</button></div></div></div>
    <div class="wk-resumo">${legenda()}<span>${fmtH(totH) || '0 h'} de compromissos</span><span>${totOk} de ${totT} tarefas feitas</span></div>
    <div class="wk-grid">${cols}</div>
    ${semanaOffset === 0 ? `<div class="grid" style="margin-top:22px"><div class="c-6">${cardPendencias()}</div></div>` : ''}
  </div>`;
}

const ico = n => `<svg class="ic"><use href="#i-${n}"/></svg>`;
function atalhos(dia) {
  const agora = Date.now(), hoje = hojeStr();
  const trabEv = dia.comHora.filter(e => e.fonte === 'trabalho');
  const prox = trabEv.find(e => e.fim > agora);
  const tarefasT = S.get('trabalho:tarefas', []).filter(t => !t.feito).length;
  const plano = planoTcc(); const tccOk = plano.filter(b => S.get('checks:' + b.data, {})[b.id]).length;
  const tccHoje = plano.find(b => b.data === hoje && !S.get('checks:' + hoje, {})[b.id]);
  const casa = dia.itens.filter(i => i.area === 'casa' && !i.opcional); const casaOk = casa.filter(i => i.feito).length;
  const compras = S.get('compras', []).filter(c => !c.feito).length;
  const venc = F.vencendo(); const px = F.proxima();
  const devo = S.get('devo:' + hoje, null); const plDia = doDia(hoje);
  const favs = (S.get('afirmacoes', {}).favs || []).length;
  const t = (href, icone, nome, valor, sub, pct = null, alerta = false) => `<a class="atalho ${alerta ? 'alerta' : ''}" href="${href}">
    <span class="at-ic">${ico(icone)}</span><span class="at-nome">${nome}</span><b class="at-val">${valor}</b><span class="at-sub">${sub}</span>
    ${pct != null ? `<span class="at-bar"><i style="width:${Math.round(pct * 100)}%"></i></span>` : ''}</a>`;
  return `<nav class="atalhos" aria-label="Acesso rápido">
    ${t('#trabalho', 'trabalho', 'Trabalho', prox ? esc(prox.titulo) : trabEv.length ? 'Reuniões feitas' : 'Sem reuniões', prox ? `${prox.hora} · ${tarefasT} tarefas` : `${tarefasT} tarefas abertas`)}
    ${t('#financas', 'financas', 'Finanças', venc.length ? `${venc.length} pra pagar` : px ? esc(px.nome) : 'Tudo pago', venc.length ? F.brl(venc.reduce((a, v) => a + (v.valor || 0), 0)) : px ? `dia ${px.dia} · ${F.brl(F.valorNoMes(F.dados(), px, F.mesDe()))}` : 'neste mês', null, venc.length > 0)}
    ${t('#casa', 'casa', 'Casa', casa.length ? `${casaOk} de ${casa.length}` : 'Dia livre', `${compras} na lista de compras`, casa.length ? casaOk / casa.length : null)}
    ${t('#faculdade', 'faculdade', 'TCC', `${tccOk} de ${TCC_BLOCOS}h`, tccHoje ? `hoje às ${tccHoje.hora}` : 'nenhum bloco hoje', tccOk / TCC_BLOCOS)}
    ${t('#devocional', 'devocional', 'Devocional', devo ? 'Feito' : 'Pendente', plDia ? esc(plDia.foco) : 'plano do dia')}
    ${t('#frases', 'frases', 'Frases', `${favs} favoritas`, 'suas afirmações')}
  </nav>`;
}

const num = v => { const n = Number(String(v).trim().replace(/\s|R\$/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')); return isNaN(n) ? null : n; };
function telaFinancas() {
  const atual = F.mesDe();
  if (!finMes) finMes = atual < F.INICIO ? F.INICIO : atual;
  const f = F.dados(), r = F.resumo(f, finMes);
  const [y, mm] = finMes.split('-').map(Number);
  const diaHoje = new Date().getDate();
  const ehAtual = finMes === atual;
  const px = ehAtual ? F.proxima() : finMes > atual ? F.ativasNoMes(f, finMes).filter(c => c.dia && !F.pago(f, finMes, c.id)).sort((a, b) => a.dia - b.dia)[0] || null : null;
  const contas = [...r.contas].sort((a, b) => (a.dia || 99) - (b.dia || 99));
  const meses = Array.from({ length: 13 }, (_, i) => F.mesMais(finMes, i - 12)).filter(m => m >= F.PRIMEIRO);
  const tile = (rot, val, sub = '', cls = '') => `<div class="card fin-tile ${cls}"><p class="eyebrow">${rot}</p><b>${val}</b><span>${sub}</span></div>`;
  const bancoPill = b => `<span class="pill banco f-${F.corBanco(b)}">${esc(b)}</span>`;
  const pessoaPill = x => `<span class="pill pessoa p-${F.pessoaDe(x)}">${F.PESSOAS[F.pessoaDe(x)]}</span>`;
  const linhas = contas.map(c => {
    const v = F.valorNoMes(f, c, finMes), pg = F.pago(f, finMes, c.id);
    const atras = ehAtual && !pg && c.dia && Number(c.dia) < diaHoje;
    if (finEditar) return `<li class="fin-row editar"><input class="mini" data-fin="conta|${c.id}|nome" value="${esc(c.nome)}" aria-label="Nome">
      <select class="mini" data-fin="conta|${c.id}|banco" aria-label="Banco">${f.bancos.map(b => `<option ${b === c.banco ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select>
      <select class="mini" data-fin="conta|${c.id}|pessoa" aria-label="De quem">${Object.entries(F.PESSOAS).map(([k, v]) => `<option value="${k}" ${F.pessoaDe(c) === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <input class="mini n" data-fin="conta|${c.id}|dia" value="${c.dia ?? ''}" inputmode="numeric" placeholder="dia" aria-label="Dia do vencimento">
      <input class="mini n" data-fin="conta|${c.id}|valor" value="${c.valor ?? ''}" inputmode="decimal" aria-label="Valor previsto">
      <button class="x" data-act="del-conta" data-id="${c.id}" title="Excluir conta">×</button></li>`;
    return `<li class="fin-row f-${F.corBanco(c.banco)} ${pg ? 'feito' : ''} ${atras ? 'atrasada' : ''}">
      <input type="checkbox" class="chk" data-pago="${c.id}" ${pg ? 'checked' : ''} aria-label="Pago: ${esc(c.nome)}">
      <span class="fin-dia">${c.dia ? `dia ${c.dia}` : '—'}</span>
      <span class="t"><b>${esc(c.nome)}</b>${bancoPill(c.banco)}${pessoaPill(c)}${atras ? '<span class="pill rose">atrasada</span>' : ''}</span>
      <label class="fin-val"><span class="sr">Valor em ${F.nomeMes(finMes)}</span><input class="mini n" data-fin="hist|${c.id}|${finMes}" value="${v ?? ''}" inputmode="decimal" placeholder="${c.valor}"></label></li>`;
  }).join('');
  const maxB = Math.max(1, ...Object.values(r.bancos).map(b => b.total));
  const P = F.painel(f, finMes);
  const abas = { resumo: 'Resumo', fixas: 'Contas fixas', extras: 'Gastos extras', historico: 'Histórico' };
  const seg = `<div class="fin-abas" role="tablist">${Object.entries(abas).map(([k, v]) => `<button role="tab" aria-selected="${finAba === k}" class="${finAba === k ? 'on' : ''}" data-act="fin-aba" data-v="${k}">${v}</button>`).join('')}</div>`;
  let corpo = '';
  if (finAba === 'resumo') {
    const restaCaju = P.caju - P.extrasCaju;
    corpo = `<div class="grid fin-tiles">
      ${tile('Renda do casal', P.renda ? F.brl(P.renda) : '—', P.renda ? `você ${F.brl(P.rec.anny || 0)} · Irad ${F.brl(P.rec.irad || 0)}` : 'preencha abaixo')}
      ${tile('Gastos do mês', F.brl(P.gastos), `fixos ${F.brl(P.total)} · extras ${F.brl(P.extrasTotal)}`)}
      ${tile('Sobra', P.sobra != null ? F.brl(P.sobra) : '—', P.sobra != null ? `depois das caixinhas · ${Math.round(P.sobra / P.renda * 100)}% da renda` : 'precisa das rendas', P.sobra == null ? '' : P.sobra < 0 ? 'rose' : 'ok')}
      ${tile('Caju', P.caju ? F.brl(restaCaju) : '—', P.caju ? `restam de ${F.brl(P.caju)}` : 'saldo do benefício', P.caju && restaCaju < 0 ? 'rose' : '')}
    </div>
    <div class="grid" style="margin-top:clamp(14px,2vw,22px)">
      <section class="card c-12">${graficoDestino(P)}</section>
      <section class="card c-12">${graficoPessoas(P)}</section>
      <section class="card c-7"><h2>Evolução <small>renda e gastos por mês</small></h2>${graficoEvolucao(f, finMes)}</section>
      <section class="card line c-5"><h2>Análise do mês</h2><ul class="analise">${F.analise(f, finMes).map(a => `<li class="an-${a.tom}"><span class="an-dot" aria-hidden="true"></span><span>${esc(a.txt)}</span></li>`).join('')}</ul></section>
      <section class="card c-6"><h2>Rendas de ${F.nomeMes(finMes)} <small>muda todo mês com a comissão</small></h2>
        ${[['anny', 'Seu salário (com comissão)'], ['irad', 'Salário do Irad'], ['caju', 'Cartão Caju (benefício)']].map(([k, rot]) => `<label class="rec-row"><span>${rot}</span><input class="mini n" data-fin="rec|${k}|${finMes}" value="${P.rec[k] ?? ''}" inputmode="decimal" placeholder="0"></label>`).join('')}
        <p class="note" style="margin:10px 0 0">O Caju é separado: paga só o que você lançar como “Caju” nos gastos extras e não entra na sobra.</p></section>
      <section class="card line c-6"><h2>Caixinhas</h2>
        <div class="chips" style="margin:0 0 8px">${[['anny', '% do seu salário'], ['casal', '% da renda do casal']].map(([k, v]) => `<button class="chip ${(f.caixaBase || 'anny') === k ? 'on' : ''}" data-act="fin-base" data-v="${k}">${v}</button>`).join('')}</div>
        ${P.caixinhas.map((c, i) => `<div class="cx-row"><span>${esc(c.nome)}</span><span class="cx-pct"><input class="mini n" data-fin="pct|${i}" value="${c.pct}" inputmode="decimal" aria-label="Percentual ${esc(c.nome)}">%</span><b>${P.base ? F.brl(c.valor) : '—'}</b></div>`).join('')}
        <div class="cx-row sobra"><span>Total guardado</span><b>${F.brl(P.caixasTotal)}</b></div></section>
    </div>`;
  } else if (finAba === 'fixas') {
    corpo = `<div class="grid fin-tiles">
      ${tile('Total do mês', F.brl(r.total), `${r.contas.length} contas`)}
      ${tile('Já pago', F.brl(r.pago), `<span class="at-bar"><i style="width:${r.total ? r.pago / r.total * 100 : 0}%"></i></span>`, 'ok')}
      ${tile('Falta pagar', F.brl(r.falta), r.falta ? 'até o fim do mês' : 'tudo certo', r.falta ? 'rose' : '')}
      ${tile('Próximo vencimento', px ? esc(px.nome) : '—', px ? `dia ${px.dia} · ${F.brl(F.valorNoMes(f, px, finMes))}` : (finMes >= atual ? 'nada pendente' : ''))}
    </div>
    <div class="grid" style="margin-top:clamp(14px,2vw,22px)">
      <section class="card c-7"><h2>Contas de ${F.nomeMes(finMes)} <button class="btn ghost sm" data-act="fin-editar">${finEditar ? 'Concluir edição' : 'Editar contas'}</button></h2>
        ${finEditar ? '<p class="note" style="margin-top:0">Nome · banco · dia do vencimento · valor previsto. As mudanças valem para todos os meses.</p>' : '<p class="note" style="margin-top:0">Marque quando pagar. O valor do mês pode ser diferente do previsto: é só digitar.</p>'}
        <ul class="list fin-list">${linhas || '<li class="empty">Nenhuma conta neste mês.</li>'}</ul>
        <form class="fin-nova" data-form="conta-nova"><p class="eyebrow" style="margin:18px 0 8px">Nova conta</p>
          <div class="row"><input name="nome" class="mini" placeholder="Nome (ex.: Plano de saúde)" required style="flex:2;min-width:160px">
          <select name="banco" class="mini">${f.bancos.map(b => `<option>${esc(b)}</option>`).join('')}<option value="__novo">+ Outro banco…</option></select><input name="bancoNovo" class="mini banco-novo" placeholder="Nome do banco" hidden>
          <select name="pessoa" class="mini" aria-label="De quem">${Object.entries(F.PESSOAS).map(([k, v]) => `<option value="${k}" ${k === 'casal' ? 'selected' : ''}>${v}</option>`).join('')}</select>
          <input name="dia" class="mini n" placeholder="dia" inputmode="numeric" style="width:70px">
          <input name="valor" class="mini n" placeholder="valor" inputmode="decimal" required style="width:100px">
          <button class="btn sm">Adicionar</button></div></form>
      </section>
      <div class="c-5 stack">
        <section class="card"><h2>Necessário em banco <small>${F.nomeMes(finMes)}</small></h2>
          ${Object.entries(r.bancos).sort((a, b) => b[1].total - a[1].total).map(([b, v]) => `<div class="banco-row f-${F.corBanco(b)}"><div class="row" style="justify-content:space-between"><span>${bancoPill(b)}</span><b>${F.brl(v.total)}</b></div>
            <span class="banco-bar"><i style="width:${v.total / maxB * 100}%"></i><i class="pg" style="width:${(v.total - v.falta) / maxB * 100}%"></i></span><small class="muted">${v.falta ? `falta ${F.brl(v.falta)}` : 'tudo pago'}</small></div>`).join('') || '<p class="empty">Sem contas.</p>'}
          <div class="row" style="justify-content:space-between;border-top:1px solid var(--fg);padding-top:10px;margin-top:8px"><b>Total mensal</b><b class="serif" style="font-size:22px">${F.brl(r.total)}</b></div></section>
      </div>
    </div>`;
  } else if (finAba === 'extras') {
    const lista = P.extras.filter(e => (!finCat || (e.cat || 'Outros') === finCat) && (!finPessoa || F.pessoaDe(e) === finPessoa));
    const hoje = ymd(new Date());
    const dataPadrao = hoje.slice(0, 7) === finMes ? hoje : finMes + '-01';
    corpo = `<div class="grid">
      <section class="card c-7"><h2>Gastos extras de ${F.nomeMes(finMes)} <small>${F.brl(P.extrasTotal)}</small></h2>
        <form class="fin-nova extra-form" data-form="extra-novo">
          <div class="row"><input name="desc" class="mini" placeholder="O que foi? (ex.: farmácia)" required style="flex:2;min-width:170px"><input name="valor" class="mini n" placeholder="valor" inputmode="decimal" required style="width:100px"></div>
          <div class="row"><div class="pessoa-esc" role="radiogroup" aria-label="De quem é o gasto">${Object.entries(F.PESSOAS).map(([k, v]) => `<label class="chip p-${k}"><input type="radio" name="pessoa" value="${k}" class="sr" ${k === (finPessoa || 'anny') ? 'checked' : ''}>${v}</label>`).join('')}</div></div>
          <div class="row"><select name="cat" class="mini">${F.CATEGORIAS.map(c => `<option>${c}</option>`).join('')}</select>
            <select name="forma" class="mini">${Object.entries(F.FORMAS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
            <select name="banco" class="mini" aria-label="Banco ou cartão"><option value="">Banco/cartão</option>${f.bancos.map(b => `<option>${esc(b)}</option>`).join('')}<option value="__novo">+ Outro banco…</option></select><input name="bancoNovo" class="mini banco-novo" placeholder="Nome do banco" hidden>
            <label class="parc">em <input name="parcelas" class="mini n" value="1" inputmode="numeric" style="width:52px" aria-label="Parcelas">x</label>
            <input name="data" type="date" class="mini" value="${dataPadrao}">
            <button class="btn sm">Lançar</button></div></form>
        <div class="chips" style="margin:12px 0 0">${[['', 'Todos'], ...Object.entries(F.PESSOAS)].map(([k, v]) => `<button class="chip ${finPessoa === k ? 'on' : ''}" data-act="fin-pessoa" data-v="${k}">${v}${k ? ` · ${F.brl(P.extras.filter(e => F.pessoaDe(e) === k).reduce((s2, e) => s2 + e.valorMes, 0))}` : ''}</button>`).join('')}</div>
        ${finCat ? `<div class="banner" style="margin:12px 0 0">Mostrando só ${esc(finCat)} <button class="btn ghost sm" data-act="fin-cat" data-v="">Ver todos</button></div>` : ''}
        <ul class="list fin-list">${lista.map(e => `<li class="fin-row extra"><span class="fin-dia">${e.data.slice(8, 10)}/${e.data.slice(5, 7)}</span>
          <span class="t"><b>${esc(e.desc)}</b>${pessoaPill(e)}<span class="pill">${esc(e.cat || 'Outros')}</span><span class="pill ${e.forma === 'caju' ? 'f-faculdade banco' : ''}">${F.FORMAS[e.forma] || e.forma}${e.banco ? ' · ' + esc(e.banco) : ''}</span>${e.parcela ? `<span class="pill rose">${e.parcela}</span>` : ''}</span>
          <b class="ex-val">${F.brl(e.valorMes)}</b><button class="x" data-act="del-extra" data-id="${e.id}" title="Apagar">×</button></li>`).join('') || '<li class="empty">Nenhum gasto extra lançado neste mês.</li>'}</ul></section>
      <section class="card line c-5"><h2>Por categoria <small>toque para filtrar</small></h2>${graficoCategorias(P.porCat)}
        <div class="fin-formas">${Object.entries(F.FORMAS).map(([k, v]) => { const t = P.extras.filter(e => e.forma === k).reduce((s, e) => s + e.valorMes, 0); return t ? `<div class="cx-row"><span>${v}</span><span></span><b>${F.brl(t)}</b></div>` : ''; }).join('')}</div>
        ${F.parcelasFuturas(f, finMes) ? `<p class="note">Parcelas já comprometidas nos próximos meses: <b>${F.brl(F.parcelasFuturas(f, finMes))}</b></p>` : ''}</section>
    </div>`;
  } else {
    corpo = `<div class="grid">
      <section class="card c-12"><h2>Histórico <small>13 meses · toque num valor para corrigir</small></h2>
        <div class="fin-hist"><table><thead><tr><th>Conta</th><th>Banco</th><th>Dia</th>${meses.map(m => `<th class="${m === finMes ? 'sel' : ''}">${F.nomeMes(m)}</th>`).join('')}</tr></thead><tbody>
          ${[...f.contas].sort((a, b) => (a.dia || 0) - (b.dia || 0)).map(c => `<tr class="f-${F.corBanco(c.banco)}"><th>${esc(c.nome)}</th><td>${bancoPill(c.banco)}</td><td>${c.dia ?? '—'}</td>${meses.map(m => {
            const ativa = (!c.desde || c.desde <= m) && (!c.ate || c.ate >= m); if (!ativa) return '<td class="off"></td>';
            const v = F.valorNoMes(f, c, m), pg = F.pago(f, m, c.id);
            return `<td class="${pg ? 'pg' : m <= atual ? 'aberto' : ''} ${m === finMes ? 'sel' : ''}"><input data-fin="hist|${c.id}|${m}" value="${v ?? ''}" inputmode="decimal" aria-label="${esc(c.nome)} ${F.nomeMes(m)}"></td>`; }).join('')}</tr>`).join('')}
          </tbody><tfoot><tr><th colspan="3">Contas fixas</th>${meses.map(m => `<td class="${m === finMes ? 'sel' : ''}">${F.brl(F.resumo(f, m).total)}</td>`).join('')}</tr>
          <tr><th colspan="3">Gastos extras</th>${meses.map(m => `<td class="${m === finMes ? 'sel' : ''}">${F.brl(F.painel(f, m).extrasTotal)}</td>`).join('')}</tr>
          <tr><th colspan="3">Renda do casal</th>${meses.map(m => { const v = F.painel(f, m).renda; return `<td class="${m === finMes ? 'sel' : ''}">${v ? F.brl(v) : '—'}</td>`; }).join('')}</tr></tfoot></table></div>
        <p class="note" style="margin:10px 0 0"><span class="lg pg"></span> pago <span class="lg aberto"></span> em aberto</p></section>
    </div>`;
  }
  return `<div class="view">
    <div class="hero"><div><p class="eyebrow">Controle financeiro</p><h1>Finanças <em>em dia.</em></h1></div>
      <div class="hero-side"><div class="wk-nav"><button class="round" data-act="fin-mes" data-v="-1" aria-label="Mês anterior" ${finMes <= F.PRIMEIRO ? 'disabled style="opacity:.3"' : ''}>‹</button>
        <b class="fin-mes">${F.NOME_MES[mm - 1]} <span>${y}</span></b><button class="round" data-act="fin-mes" data-v="1" aria-label="Próximo mês">›</button>
        ${finMes === (atual < F.INICIO ? F.INICIO : atual) ? '' : '<button class="btn ghost sm" data-act="fin-mes" data-v="0">Voltar</button>'}</div></div></div>
    ${!f.contas.length ? '<div class="banner">Nenhuma conta ainda. Use o link de importação que te mandei no chat, ou adicione em Contas fixas.</div>' : ''}
    ${seg}
    ${corpo}
  </div>`;
}

// ---------- Gráficos de finanças ----------
const CH = ['fixos', 'extras', 'caixas', 'sobra'];
function graficoDestino(P) {
  const partes = [['fixos', 'Contas fixas', P.total, 'fixas'], ['extras', 'Gastos extras', P.extrasDinheiro, 'extras'], ['caixas', 'Caixinhas', P.caixasTotal, 'resumo'], ['sobra', 'Sobra', Math.max(0, P.sobra || 0), 'resumo']];
  const usado = partes.slice(0, 3).reduce((s, x) => s + x[2], 0);
  const total = Math.max(P.renda || 0, usado + Math.max(0, P.sobra || 0)) || 1;
  const pc = v => Math.round(v / (P.renda || total) * 100);
  return `<h2>Para onde vai a renda <small>${P.renda ? `renda do casal: ${F.brl(P.renda)}` : 'preencha as rendas para ver a sobra'}</small></h2>
    <div class="destino" role="img" aria-label="Divisão da renda: ${partes.map(p => `${p[1]} ${F.brl(p[2])}`).join(', ')}">
      ${partes.filter(p => p[2] > 0).map(p => `<button class="seg ch-${p[0]}" style="flex:${p[2] / total}" data-tip="${p[1]}: ${F.brl(p[2])}${P.renda ? ` · ${pc(p[2])}% da renda` : ''}" data-act="fin-aba" data-v="${p[3]}" aria-label="${p[1]} ${F.brl(p[2])}"></button>`).join('')}
      ${P.renda && usado > P.renda ? `<span class="destino-estouro" style="left:${P.renda / total * 100}%" data-tip="Até aqui é a renda. O que passa disso está no vermelho."></span>` : ''}
    </div>
    <ul class="destino-leg">${partes.map(p => `<li><span class="sw ch-${p[0]}"></span><span>${p[1]}</span><b>${F.brl(p[2])}</b>${P.renda ? `<small>${pc(p[2])}%</small>` : ''}</li>`).join('')}</ul>`;
}

function graficoEvolucao(f, mFim) {
  const meses = Array.from({ length: 6 }, (_, i) => F.mesMais(mFim, i - 5)).filter(m => m >= F.PRIMEIRO);
  const dados = meses.map(m => { const p = F.painel(f, m); return { m, fixos: p.total, extras: p.extrasTotal, renda: p.renda }; });
  const bruto = Math.max(1, ...dados.map(d => Math.max(d.fixos + d.extras, d.renda)));
  let max = bruto;
  const W = 560, H = 210, L = 46, B = 24, T = 10, bw = Math.min(46, (W - L) / dados.length * 0.5);
  const x = i => L + (W - L) / dados.length * (i + 0.5), y = v => T + (H - T - B) * (1 - v / max);
  const passo = Math.pow(10, Math.floor(Math.log10(max))) * (max / Math.pow(10, Math.floor(Math.log10(max))) > 5 ? 2 : 1);
  max = Math.ceil(bruto / passo) * passo;
  const grades = []; for (let v = 0; v <= max; v += passo) grades.push(v);
  const k = v => v >= 1000 ? (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil' : String(v);
  return `<ul class="destino-leg compacta"><li><span class="sw ch-fixos"></span>Fixos</li><li><span class="sw ch-extras"></span>Extras</li><li><span class="sw linha ch-sobra"></span>Renda</li></ul>
  <svg class="evo" viewBox="0 0 ${W} ${H}" role="img" aria-label="Renda e gastos dos últimos meses">
    ${grades.map(v => `<line class="grade" x1="${L}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/><text class="eixo" x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${k(v)}</text>`).join('')}
    ${dados.map((d, i) => { const yf = y(d.fixos), ye = y(d.fixos + d.extras), base = y(0);
      return `<g class="evo-col" data-tip="${F.nomeMes(d.m)}&#10;Fixos: ${F.brl(d.fixos)}&#10;Extras: ${F.brl(d.extras)}&#10;Renda: ${d.renda ? F.brl(d.renda) : 'não preenchida'}">
        <rect class="hit" x="${x(i) - (W - L) / dados.length / 2}" y="${T}" width="${(W - L) / dados.length}" height="${H - T - B}"/>
        ${d.fixos ? `<path class="ch-fixos" d="M${x(i) - bw / 2},${base} V${yf + (d.extras ? 0 : 4)} ${d.extras ? '' : `q0,-4 4,-4`} H${x(i) + bw / 2 - (d.extras ? 0 : 4)} ${d.extras ? '' : `q4,0 4,4`} V${base} Z"/>` : ''}
        ${d.extras ? `<path class="ch-extras" d="M${x(i) - bw / 2},${yf - 2} V${ye + 4} q0,-4 4,-4 H${x(i) + bw / 2 - 4} q4,0 4,4 V${yf - 2} Z"/>` : ''}
        ${d.renda ? `<line class="renda" x1="${x(i) - bw / 2 - 6}" x2="${x(i) + bw / 2 + 6}" y1="${y(d.renda)}" y2="${y(d.renda)}"/>` : ''}
        <text class="eixo ${d.m === mFim ? 'sel' : ''}" x="${x(i)}" y="${H - 6}" text-anchor="middle">${F.nomeMes(d.m)}</text></g>`; }).join('')}
  </svg>`;
}

function graficoPessoas(P) {
  const linhas = [['anny', 'Anny', P.rec.anny], ['irad', 'Irad', P.rec.irad], ['casal', 'Conjunto', null]];
  const max = Math.max(1, ...linhas.map(([k]) => P.porPessoa[k].fixos + P.porPessoa[k].extras));
  return `<h2>Por pessoa <small>contas fixas e extras de cada um</small></h2>
    <ul class="destino-leg compacta"><li><span class="sw ch-fixos"></span>Fixos</li><li><span class="sw ch-extras"></span>Extras</li></ul>
    <ul class="pessoas">${linhas.map(([k, nome, renda]) => { const v = P.porPessoa[k], tot = v.fixos + v.extras;
      const parte = k !== 'casal' && P.divisao ? P.divisao[k] : null;
      return `<li><button class="pes-nome p-${k}" data-act="fin-pessoa-ver" data-v="${k}" title="Ver gastos de ${nome}">${nome}</button>
        <span class="pes-bar">${v.fixos ? `<i class="ch-fixos" style="width:${v.fixos / max * 100}%" data-tip="${nome} · fixos: ${F.brl(v.fixos)}"></i>` : ''}${v.extras ? `<i class="ch-extras" style="width:${v.extras / max * 100}%" data-tip="${nome} · extras: ${F.brl(v.extras)}"></i>` : ''}</span>
        <b>${F.brl(tot)}</b>
        <small>${k === 'casal' ? (P.divisao ? `você ${F.brl(P.divisao.anny)} · Irad ${F.brl(P.divisao.irad)} (pela renda)` : 'preencha as rendas para dividir') : renda ? `renda ${F.brl(renda)}${parte != null ? ` · com a parte do conjunto: ${F.brl(tot + parte)} (${Math.round((tot + parte) / renda * 100)}% da renda)` : ''}` : 'renda não preenchida'}</small></li>`; }).join('')}</ul>`;
}

function graficoCategorias(porCat) {
  const itens = Object.entries(porCat).sort((a, b) => b[1] - a[1]);
  if (!itens.length) return '<p class="empty">Os gastos lançados aparecem aqui por categoria.</p>';
  const max = itens[0][1];
  return `<ul class="cat-bars">${itens.map(([c, v]) => `<li><button class="${finCat === c ? 'on' : ''}" data-act="fin-cat" data-v="${esc(c)}" data-tip="${esc(c)}: ${F.brl(v)}"><span>${esc(c)}</span><span class="cb"><i style="width:${v / max * 100}%"></i></span><b>${F.brl(v)}</b></button></li>`).join('')}</ul>`;
}

const TELAS = { hoje: telaHoje, semana: telaSemana, financas: telaFinancas, casa: telaCasa, faculdade: telaFaculdade, trabalho: telaTrabalho, devocional: telaDevocional, frases: telaFrases, ajustes: telaAjustes, geladeira: telaGeladeira };

// ---------- Render ----------
function render(anima = false) {
  const foco = document.activeElement;
  const k = foco?.dataset?.k, sel = k && 'selectionStart' in foco ? [foco.selectionStart, foco.selectionEnd] : null;
  const scroll = $('#dias')?.scrollLeft;
  const antes = [...app.querySelectorAll('.ring .val')].map(c => c.style.strokeDashoffset);
  app.innerHTML = TELAS[rota]();
  if (!anima) app.querySelectorAll('.view, .ti, .li, .fcard').forEach(el => el.style.animation = 'none');
  if (k) { const el = app.querySelector(`[data-k="${k}"]`); if (el) { el.focus({ preventScroll: true }); if (sel) try { el.setSelectionRange(...sel); } catch {} } }
  const aneis = [...app.querySelectorAll('.ring .val')];
  if (!anima) aneis.forEach((c, i) => { if (antes[i]) c.style.strokeDashoffset = antes[i]; });
  aneis.forEach(c => c.getBoundingClientRect());
  requestAnimationFrame(() => aneis.forEach(c => c.style.strokeDashoffset = c.dataset.off));
  if (rota === 'devocional') {
    const dias = $('#dias');
    if (anima) $('.dbtn.sel')?.scrollIntoView({ inline: 'center', block: 'nearest' }); else if (dias && scroll != null) dias.scrollLeft = scroll;
    pintarTimer();
  }
  if (rota === 'faculdade') pintarPomo();
  if (rota === 'financas' && anima) { const h = $('.fin-hist'); if (h) h.scrollLeft = h.scrollWidth; }
  if (rota === 'geladeira') relogio();
}

async function importarDoLink(cod) {
  try {
    const bin = Uint8Array.from(atob(cod.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const txt = await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
    const obj = JSON.parse(txt);
    if (confirm(`Importar ${obj.contas?.length || 0} contas e o histórico da sua planilha?`)) { F.importar(obj); toast('Planilha importada.', 4000); }
  } catch (e) { console.warn(e); toast('Não consegui ler o link de importação.', 4000); }
  location.hash = '#financas';
}

function navegar() {
  const bruto = (location.hash || '#hoje').slice(1);
  if (bruto.startsWith('importar=')) { importarDoLink(bruto.slice(9)); return; }
  const h = bruto;
  rota = TELAS[h] ? h : 'hoje';
  document.body.classList.toggle('fridge', rota === 'geladeira');
  document.querySelectorAll('[data-tab]').forEach(a => a.classList.toggle('on', a.dataset.tab === rota));
  const noMais = document.querySelector(`.mais-menu [data-tab="${rota}"]`);
  $('#mais-btn').classList.toggle('on', !!noMais);
  $('#mais-rot').textContent = noMais ? noMais.querySelector('span').textContent : 'Mais';
  fecharMais();
  render(true);
  scrollTo({ top: 0 });
  if (rota === 'geladeira') iniciarGeladeira(); else pararGeladeira();
}

// ---------- Ações ----------
function toggleCheck(data, id, marcado, el) {
  const antes = progresso(montarDia().contaveis, S.get('top3:' + hojeStr(), []));
  if (id.startsWith('conta:')) F.marcarPago(id.slice(6), marcado, data.slice(0, 7));
  else S.update('checks:' + data, {}, ch => { if (marcado) ch[id] = Date.now(); else delete ch[id]; });
  if (id === 'devocional') S.update('devo:' + data, null, v => marcado ? (v || (S.get('config', {}).bebe ? 'curto' : 'completo')) : null);
  if (marcado) celebrar(el, antes);
}

function celebrar(el, antes) {
  const depois = progresso(montarDia().contaveis, S.get('top3:' + hojeStr(), []));
  if (el) confeteEm(el, 22);
  if (depois.total && depois.ok === depois.total && antes.ok < antes.total) { setTimeout(festa, 250); toast(sortear(DIA_COMPLETO), 4200); }
  else toast(sortear(AO_MARCAR));
}

app.addEventListener('change', e => {
  const t = e.target;
  if (t.name === 'banco' && t.form) { const n = t.form.querySelector('[name="bancoNovo"]'); if (n) { n.hidden = t.value !== '__novo'; if (!n.hidden) n.focus(); } return; }
  if (t.dataset.check) { const [d, id] = t.dataset.check.split('|'); toggleCheck(d, id, t.checked, t); }
  else if (t.dataset.topchk) {
    const antes = progresso(montarDia().contaveis, S.get('top3:' + hojeStr(), []));
    S.update('top3:' + hojeStr(), () => [{ t: '' }, { t: '' }, { t: '' }], top => { top[+t.dataset.topchk].feito = t.checked; });
    if (t.checked) celebrar(t, antes);
  }
  else if (t.dataset.pago) { F.marcarPago(t.dataset.pago, t.checked, finMes || F.mesDe()); if (t.checked) { confeteEm(t, 14); toast('Conta paga. Uma preocupação a menos.'); } }
  else if (t.dataset.fin) salvarFin(t);
  else if (t.dataset.trab) { S.update('trabalho:tarefas', [], l => { const c = l.find(x => x.id === t.dataset.trab); if (c) c.feito = t.checked; }); if (t.checked) { confeteEm(t, 14); toast(sortear(AO_MARCAR)); } }
  else if (t.dataset.compra) { S.update('compras', [], l => { const c = l.find(x => x.id === t.dataset.compra); if (c) c.feito = t.checked; }); if (t.checked) { confeteEm(t, 12); toast('Comprado! ✓'); } }
  else if (t.dataset.act === 'bebe') { S.update('config', {}, c => { c.bebe = t.checked; }); toast(t.checked ? 'Modo Bebê ligado. Só o essencial agora.' : 'Modo Bebê desligado. Rotina completa de volta.'); }
});

function salvarFin(t) {
  const [tipo, a, b] = t.dataset.fin.split('|');
  F.salvar(f => {
    if (tipo === 'hist') { f.historico[b] = { ...(f.historico[b] || {}) }; const n = num(t.value); if (t.value.trim() === '' ) delete f.historico[b][a]; else if (n != null) f.historico[b][a] = n; }
    if (tipo === 'rec') { f.receitas[b] = { ...(f.receitas[b] || {}) }; const n = num(t.value); if (!t.value.trim() || n == null) delete f.receitas[b][a]; else f.receitas[b][a] = n; }
    if (tipo === 'liq') { const n = num(t.value); if (n == null || !t.value.trim()) delete f.liquido[a]; else f.liquido[a] = n; }
    if (tipo === 'pct') { const n = num(t.value); if (n != null) f.caixinhas[+a] = { ...f.caixinhas[+a], pct: n }; }
    if (tipo === 'conta') { const c = f.contas.find(x => x.id === a); if (!c) return; if (b === 'nome' || b === 'banco' || b === 'pessoa') c[b] = t.value.trim() || c[b]; else { const n = num(t.value); c[b] = t.value.trim() === '' ? null : n ?? c[b]; } }
  });
}

app.addEventListener('input', e => {
  const t = e.target;
  calado = true;
  if (t.dataset.top != null) S.update('top3:' + hojeStr(), () => [{ t: '' }, { t: '' }, { t: '' }], top => { top[+t.dataset.top].t = t.value; if (!t.value) top[+t.dataset.top].feito = false; });
  else if (t.dataset.diario) S.set('diario:' + t.dataset.diario, t.value);
  else if (t.dataset.campo) S.set(t.dataset.campo, t.value);
  calado = false;
  if (t.dataset.top != null) { const c = t.parentElement.querySelector('[data-topchk]'); if (c) c.disabled = !t.value; }
});

app.addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target, tipo = f.dataset.form;
  const v = f.t?.value?.trim();
  if (tipo === 'caixa' && v) { S.update('caixa', [], l => { l.unshift({ id: uid(), t: v }); }); toast('Anotado. Pode esquecer, eu lembro.'); }
  if (tipo === 'trabalho' && v) { S.update('trabalho:tarefas', [], l => { l.unshift({ id: uid(), t: v }); }); }
  if (tipo === 'agenda' && v) {
    if (!/^(https|webcal):\/\/.*google/i.test(v)) { toast('Esse não parece o endereço secreto iCal do Google.', 4000); return; }
    if (/\/public\//.test(v)) { toast('Esse é o endereço público. Use o “Endereço secreto no formato iCal”.', 6000); return; }
    S.update('agendas', {}, l => { l[f.dataset.k] = v; }); toast('Agenda salva. Carregando…'); setTimeout(recarregarAgenda, 1500); return;
  }
  if (tipo === 'extra-novo') {
    const valor = num(f.valor.value); if (!f.desc.value.trim() || valor == null) return;
    let banco = f.banco.value || null;
    if (banco === '__novo') { banco = f.bancoNovo.value.trim(); if (!banco) { f.bancoNovo.focus(); toast('Escreva o nome do banco.'); return; } }
    F.salvar(d => { d.extras = d.extras || []; if (banco && !d.bancos.includes(banco)) d.bancos.push(banco); d.extras.push({ id: uid(), desc: f.desc.value.trim(), pessoa: f.pessoa.value || 'anny', valor, cat: f.cat.value, forma: f.forma.value, banco, parcelas: Math.max(1, num(f.parcelas.value) || 1), data: f.data.value || ymd(new Date()) }); });
    toast('Gasto lançado.'); return;
  }
  if (tipo === 'conta-nova') {
    let banco = f.banco.value;
    if (banco === '__novo') { banco = f.bancoNovo.value.trim(); if (!banco) { f.bancoNovo.focus(); toast('Escreva o nome do banco.'); return; } }
    const valor = num(f.valor.value); if (!f.nome.value.trim() || valor == null) return;
    F.salvar(d => { if (!d.bancos.includes(banco)) d.bancos.push(banco); d.contas.push({ id: uid(), nome: f.nome.value.trim(), banco, pessoa: f.pessoa.value, dia: num(f.dia.value) || null, valor, desde: finMes }); });
    toast('Conta adicionada.'); return;
  }
  if (tipo === 'compras' && v) { S.update('compras', [], l => { l.unshift({ id: uid(), t: v }); }); }
  if (tipo === 'frase' && v) { S.update('afirmacoes', { favs: [], minhas: [] }, a => { a.minhas = a.minhas || []; a.minhas.unshift({ id: 'm-' + uid(), t: v }); }); toast('Frase salva.'); }
  if (tipo === 'login') {
    const modo = e.submitter?.value || 'entrar';
    try {
      if (modo === 'criar') { const r = await S.criarConta(f.email.value, f.senha.value); toast(r.session ? 'Conta criada!' : 'Conta criada. Confirme pelo link no seu e-mail.', 5000); }
      else { await S.entrar(f.email.value, f.senha.value); toast('Bem-vinda de volta!'); }
      render();
    } catch (err) {
      const m = String(err?.message || err);
      const txt = /Invalid login credentials/i.test(m) ? 'E-mail ou senha não conferem. Se ainda não criou a conta, use “Criar minha conta”.'
        : /Email not confirmed/i.test(m) ? 'Falta confirmar o e-mail: abra o link que o Supabase mandou pra você (veja o spam).'
        : /Signups not allowed|signup.*disabled/i.test(m) ? 'Novos cadastros estão bloqueados no Supabase. Crie o usuário em Authentication → Users → Add user.'
        : /reading 'auth'|null/i.test(m) ? 'Não consegui conectar ao Supabase. Recarregue a página e tente de novo.'
        : /rate limit/i.test(m) ? 'Muitas tentativas seguidas. Espere um minuto e tente de novo.'
        : 'Não deu: ' + m;
      const box = f.querySelector('.login-erro') || f.appendChild(Object.assign(document.createElement('p'), { className: 'login-erro banner' }));
      box.textContent = txt;
      toast(txt, 6000);
    }
    return;
  }
  const inp = f.querySelector('input[name="t"]'); if (inp) { inp.value = ''; inp.focus(); }
});

document.addEventListener('submit', e => {
  const f = e.target; if (f.dataset.form !== 'comp') return;
  if (e.submitter?.value !== 'salvar') return;
  const c = { id: uid(), titulo: f.titulo.value.trim(), fonte: f.fonte.value, data: f.data.value, ini: f.ini.value, fim: f.fim.value && f.fim.value > f.ini.value ? f.fim.value : f.ini.value, link: f.link.value.trim() || null, semanal: f.semanal.checked };
  if (!c.titulo || !c.data || !c.ini) return;
  S.update('compromissos', [], l => { l.push(c); });
  toast('Compromisso salvo. Eu reorganizo o resto em volta.');
});

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b || b.tagName === 'INPUT') return;
  const a = b.dataset.act, id = b.dataset.id;
  switch (a) {
    case 'fav': S.update('afirmacoes', { favs: [], minhas: [] }, af => { af.favs = af.favs || []; const i = af.favs.indexOf(id); if (i >= 0) af.favs.splice(i, 1); else { af.favs.push(id); confeteEm(b, 10); } }); break;
    case 'outra-frase': fraseExtra++; render(); break;
    case 'del-caixa': S.update('caixa', [], l => l.filter(x => x.id !== id)); break;
    case 'promover': {
      const item = S.get('caixa', []).find(x => x.id === id); if (!item) break;
      let ok = false;
      S.update('top3:' + hojeStr(), () => [{ t: '' }, { t: '' }, { t: '' }], top => { const i = top.findIndex(p => !p.t?.trim()); if (i >= 0) { top[i] = { t: item.t, fonte: item.fonte || 'pessoal' }; ok = true; } });
      if (ok) { S.update('caixa', [], l => l.filter(x => x.id !== id)); toast('Virou prioridade de hoje.'); } else toast('As 3 prioridades já estão cheias. Conclua uma antes.');
      break;
    }
    case 'pular': S.update('checks:' + b.dataset.d, {}, ch => { ch['pulou:' + id] = Date.now(); }); toast('Deixado pra lá. Sem culpa.'); break;
    case 'sugestao': S.update('compras', [], l => { l.unshift({ id: uid(), t: b.dataset.t }); }); break;
    case 'del-compra': S.update('compras', [], l => l.filter(x => x.id !== id)); break;
    case 'limpar-compras': S.update('compras', [], l => l.filter(x => !x.feito)); toast('Lista limpinha.'); break;
    case 'devo-dia': devoSel = b.dataset.d; render(); $('.dbtn.sel')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }); break;
    case 'devo-ok': {
      S.set('devo:' + devoSel, b.dataset.v);
      const antes = progresso(montarDia().contaveis, S.get('top3:' + hojeStr(), []));
      S.update('checks:' + devoSel, {}, ch => { ch.devocional = Date.now(); });
      if (devoSel === hojeStr()) celebrar(b, antes); else { confeteEm(b, 22); toast('Marcado.'); }
      break;
    }
    case 'devo-desfazer': S.set('devo:' + devoSel, null); S.update('checks:' + devoSel, {}, ch => { delete ch.devocional; }); break;
    case 'timer': alternarTimer(); break;
    case 'timer-zerar': timer = { acum: 0, inicio: null }; pintarTimer(); break;
    case 'filtro': filtroFrases = b.dataset.f; render(true); break;
    case 'del-frase': S.update('afirmacoes', { favs: [], minhas: [] }, af => { af.minhas = (af.minhas || []).filter(m => m.id !== id); }); break;
    case 'tema': aplicarTema(b.dataset.t); render(); break;
    case 'sair': S.sair().then(() => render()); break;
    case 'fonte-top': S.update('top3:' + hojeStr(), () => [{ t: '' }, { t: '' }, { t: '' }], top => { const p = top[+b.dataset.i]; p.fonte = proxFonte(p.fonte); }); break;
    case 'fonte-caixa': S.update('caixa', [], l => { const c = l[+b.dataset.i]; if (c) c.fonte = proxFonte(c.fonte); }); break;
    case 'adiantar': adiantarTcc(id, b.dataset.hora); confeteEm(b, 16); toast(`TCC adiantado pra ${b.dataset.hora}. Sua noite ficou livre!`, 4000); break;
    case 'pend': {
      const { v, tipo, d: data, i } = b.dataset;
      const marcar = fn => tipo === 'top' ? S.update('top3:' + data, [], t => { if (t[+i]) fn(t[+i]); }) : null;
      if (v === 'feito') { if (tipo === 'top') marcar(p => { p.feito = true; }); else S.update('checks:' + data, {}, ch => { ch[id] = Date.now(); }); confeteEm(b, 16); toast('Feito, mesmo que atrasado, conta!'); }
      if (v === 'pular') { if (tipo === 'top') marcar(p => { p.pulou = true; }); else S.update('checks:' + data, {}, ch => { ch['pulou:' + id] = Date.now(); }); toast('Deixado pra lá. Sem culpa.'); }
      if (v === 'hoje') {
        let foi = 'prioridade';
        S.update('top3:' + hojeStr(), () => [{ t: '' }, { t: '' }, { t: '' }], top => { const k = top.findIndex(p => !p.t?.trim()); if (k >= 0) top[k] = { t: b.dataset.t, fonte: b.dataset.f }; else foi = 'caixa'; });
        if (foi === 'caixa') S.update('caixa', [], l => { l.unshift({ id: uid(), t: b.dataset.t, fonte: b.dataset.f }); });
        if (tipo === 'top') marcar(p => { p.pulou = true; }); else S.update('checks:' + data, {}, ch => { ch['pulou:' + id] = Date.now(); });
        toast(foi === 'caixa' ? 'Prioridades cheias: coloquei na caixa de entrada.' : 'Trouxe pra hoje como prioridade.');
      }
      break;
    }
    case 'testar-push': {
      const el = $('#push-diag'); if (el) el.textContent = 'Conferindo…';
      S.naNuvem('push:' + S.get('push-token', '')).then(r => {
        const msg = r.ok ? 'Código salvo na sua conta ✓. Agora rode enviarAgenda no Apps Script.'
          : r.msg === 'sem login' ? 'Você não está logada neste aparelho. Entre na conta (abaixo) e confira de novo.'
          : r.msg === 'não encontrado' ? 'O código ainda não chegou à sua conta. Toque em “Gerar código novo” e confira de novo.'
          : 'O Supabase recusou: ' + r.msg + '. Me mande um print desta mensagem.';
        const e2 = $('#push-diag'); if (e2) e2.textContent = msg; toast(msg, 6000);
      });
      break;
    }
    case 'gerar-push': {
      const velho = S.get('push-token', null);
      if (velho && !confirm('Gerar um código novo? O script antigo para de funcionar até você trocar o código nele.')) break;
      const tok = Array.from(crypto.getRandomValues(new Uint8Array(20)), x => x.toString(16).padStart(2, '0')).join('');
      if (velho) S.set('push:' + velho, null);
      S.set('push:' + tok, { criado: Date.now() }); S.set('push-token', tok);
      toast('Código criado. Siga os passos logo abaixo.'); break;
    }
    case 'gerar-feed': {
      const velho = S.get('feed-token', null);
      if (velho && !confirm('Gerar um link novo? O link antigo para de funcionar e você vai precisar assinar de novo.')) break;
      const tok = Array.from(crypto.getRandomValues(new Uint8Array(20)), x => x.toString(16).padStart(2, '0')).join('');
      if (velho) S.set('feed:' + velho, null);
      S.set('feed:' + tok, { criado: Date.now() }); S.set('feed-token', tok);
      toast('Link criado! Agora é só assinar.'); break;
    }
    case 'copiar-feed': navigator.clipboard?.writeText(FEED_BASE + S.get('feed-token', '')).then(() => toast('Link copiado ✓'), () => toast('Selecione o link e copie.')); break;
    case 'fin-mes': { const atual = F.mesDe(); finMes = b.dataset.v === '0' ? (atual < F.INICIO ? F.INICIO : atual) : F.mesMais(finMes, Number(b.dataset.v)); if (finMes < F.PRIMEIRO) finMes = F.PRIMEIRO; render(true); break; }
    case 'fin-aba': finAba = b.dataset.v; render(true); break;
    case 'fin-cat': finCat = b.dataset.v; if (finAba !== 'extras') finAba = 'extras'; render(); break;
    case 'fin-pessoa-ver': finPessoa = b.dataset.v; finAba = 'extras'; render(true); break;
    case 'fin-pessoa': finPessoa = b.dataset.v; render(); break;
    case 'fin-base': F.salvar(d => { d.caixaBase = b.dataset.v; }); break;
    case 'del-extra': { const e = (F.dados().extras || []).find(x => x.id === id); if (e && confirm(`Apagar "${e.desc}"${Number(e.parcelas) > 1 ? ' e todas as parcelas' : ''}?`)) F.salvar(d => { d.extras = d.extras.filter(x => x.id !== id); }); break; }
    case 'fin-editar': finEditar = !finEditar; render(); break;
    case 'del-conta': {
      const f = F.dados(); const c = f.contas.find(x => x.id === id); if (!c) break;
      const temHist = Object.values(f.historico).some(h => h[id] != null);
      if (temHist) { if (!confirm(`Parar de contar "${c.nome}" a partir de ${F.nomeMes(finMes)}? O histórico fica guardado.`)) break; F.salvar(d => { const x = d.contas.find(y => y.id === id); x.ate = F.mesMais(finMes, -1); }); }
      else { if (!confirm(`Excluir "${c.nome}"?`)) break; F.salvar(d => { d.contas = d.contas.filter(y => y.id !== id); }); }
      toast('Conta removida.'); break;
    }
    case 'ocultar': { const ev = EVS.get(id); if (ev) dialogoOcultar(ev); break; }
    case 'mostrar-ev': A.mostrar(b.dataset.tipo, id); toast('Voltou a aparecer.'); break;
    case 'novo-comp': dialogoCompromisso(b.dataset.fonte, b.dataset.data); break;
    case 'semana': semanaOffset = b.dataset.v === '0' ? 0 : semanaOffset + Number(b.dataset.v); render(true); break;
    case 'del-comp': if (confirm('Apagar este compromisso?')) S.update('compromissos', [], l => l.filter(c => c.id !== id)); break;
    case 'remarcar-tcc': { const r = remarcarTcc(id); toast(r ? `Bloco remarcado pra ${DIAS[deYmd(r.data).getDay()].toLowerCase()}, ${r.hora}.` : 'Não achei outro horário livre esta semana.'); break; }
    case 'del-trab': S.update('trabalho:tarefas', [], l => l.filter(x => x.id !== id)); break;
    case 'limpar-trab': S.update('trabalho:tarefas', [], l => l.filter(x => !x.feito)); break;
    case 'trab-hoje': {
      const item = S.get('trabalho:tarefas', []).find(x => x.id === id); if (!item) break; let ok = false;
      S.update('top3:' + hojeStr(), () => [{ t: '' }, { t: '' }, { t: '' }], top => { const i = top.findIndex(p => !p.t?.trim()); if (i >= 0) { top[i] = { t: item.t, fonte: 'trabalho' }; ok = true; } });
      toast(ok ? 'Virou prioridade de hoje.' : 'As 3 prioridades já estão cheias.'); break;
    }
    case 'del-agenda': S.update('agendas', {}, l => { delete l[b.dataset.k]; }); setTimeout(recarregarAgenda, 1500); break;
    case 'atualizar-agenda': recarregarAgenda(true); break;
    case 'pomo': alternarPomo(); break;
    case 'pomo-zerar': pomo = { acum: 0, inicio: null, fase: 'foco' }; pintarPomo(); break;
    case 'notif': if ('Notification' in window) Notification.requestPermission().then(() => render()); else toast('Este navegador não suporta notificações.'); break;
  }
});

// ---------- Tema ----------
function aplicarTema(t) {
  S.local('tema', t);
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
}
$('#tema').addEventListener('click', () => {
  const escuro = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  aplicarTema(escuro ? 'light' : 'dark');
  if (rota === 'ajustes') render();
});

// ---------- Timer do devocional ----------
let timer = { acum: 0, inicio: null };
const TOTAL = ETAPAS.reduce((s, e) => s + e.min, 0) * 60;
const decorrido = () => Math.min(TOTAL, timer.acum + (timer.inicio ? (Date.now() - timer.inicio) / 1000 : 0));
function alternarTimer() {
  if (timer.inicio) { timer.acum = decorrido(); timer.inicio = null; }
  else { if (decorrido() >= TOTAL) timer.acum = 0; timer.inicio = Date.now(); }
  pintarTimer();
}
let etapaAnterior = -1;
function pintarTimer() {
  const clock = $('#t-clock'); if (!clock) return;
  const s = decorrido(), resto = Math.ceil(TOTAL - s);
  clock.textContent = `${String(Math.floor(resto / 60)).padStart(2, '0')}:${String(resto % 60).padStart(2, '0')}`;
  $('#t-bar').style.width = (s / TOTAL * 100) + '%';
  let acc = 0, atual = ETAPAS.length;
  ETAPAS.forEach((e, i) => { if (s >= acc && s < acc + e.min * 60 && atual === ETAPAS.length) atual = i; acc += e.min * 60; });
  document.querySelectorAll('.etapa').forEach((el, i) => { el.classList.toggle('atual', (timer.inicio || s > 0) && i === atual); el.classList.toggle('passou', i < atual && s > 0); });
  const btn = $('[data-act="timer"]'); if (btn) btn.textContent = timer.inicio ? 'Pausar' : (s > 0 && s < TOTAL ? 'Continuar' : 'Começar');
  if (timer.inicio && atual !== etapaAnterior && atual < ETAPAS.length && s > 1) toast(`Agora: ${ETAPAS[atual].t}`);
  if (timer.inicio && s >= TOTAL) { timer.acum = TOTAL; timer.inicio = null; toast('Tempo concluído. Que bom que você esteve aqui.', 4000); }
  etapaAnterior = timer.inicio ? atual : -1;
}
setInterval(() => { if (timer.inicio) pintarTimer(); }, 1000);

// ---------- Pomodoro ----------
let pomo = { acum: 0, inicio: null, fase: 'foco' };
const POMO = { foco: 25 * 60, pausa: 5 * 60 };
const pomoDec = () => Math.min(POMO[pomo.fase], pomo.acum + (pomo.inicio ? (Date.now() - pomo.inicio) / 1000 : 0));
function alternarPomo() { if (pomo.inicio) { pomo.acum = pomoDec(); pomo.inicio = null; } else pomo.inicio = Date.now(); pintarPomo(); }
function pintarPomo() {
  const s = pomoDec(), tot = POMO[pomo.fase];
  if (pomo.inicio && s >= tot) {
    const era = pomo.fase; pomo = { acum: 0, inicio: Date.now(), fase: era === 'foco' ? 'pausa' : 'foco' };
    toast(era === 'foco' ? 'Pomodoro feito! 5 min de pausa: água, alongar.' : 'Pausa acabou. Mais 25 min de foco?', 5000);
    if (era === 'foco') festa();
    return pintarPomo();
  }
  const el = $('#p-clock'); if (!el) return;
  const r = Math.ceil(tot - s);
  el.textContent = `${String(Math.floor(r / 60)).padStart(2, '0')}:${String(r % 60).padStart(2, '0')}`;
  $('#p-bar').style.width = (s / tot * 100) + '%';
  $('#p-fase').textContent = pomo.fase === 'foco' ? 'Foco: 25 min. Celular longe, só uma aba aberta.' : 'Pausa: levanta, bebe água, respira.';
  const btn = $('[data-act="pomo"]'); if (btn) btn.textContent = pomo.inicio ? 'Pausar' : (s > 0 ? 'Continuar' : 'Começar');
}
setInterval(() => { if (pomo.inicio) pintarPomo(); }, 1000);

// ---------- Agendas ----------
async function recarregarAgenda(manual = false) {
  try { await S.puxar(); await A.atualizar(); if (manual) toast('Agendas atualizadas.'); }
  catch (e) { console.warn(e); const c = A.cache(); c.erros = { ...(c.erros || {}), geral: e.message || 'Não consegui ler as agendas.' }; c.tentativa = Date.now(); S.local('agenda-cache', JSON.stringify(c)); if (manual) toast('Não consegui atualizar as agendas.', 4000); }
  const digitando = document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName) && document.activeElement.type !== 'checkbox';
  if (!digitando) render();
}
setInterval(recarregarAgenda, 30 * 60000);

// ---------- Geladeira ----------
let wake = null, frTimers = [];
function relogio() {
  const el = $('#fr-clock'); if (!el) return;
  const d = new Date(); el.textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const h = d.getHours(); const dim = $('#fr-dim'); if (dim) dim.style.opacity = (h >= 22 || h < 6) ? '.55' : '0';
}
async function manterAcesa() { try { if ('wakeLock' in navigator && !wake) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => wake = null); } } catch {} }
function iniciarGeladeira() {
  pararGeladeira();
  manterAcesa();
  document.addEventListener('pointerdown', manterAcesa);
  frTimers.push(setInterval(relogio, 5000));
  frTimers.push(setInterval(() => S.puxar(), 120000));
}
function pararGeladeira() {
  frTimers.forEach(clearInterval); frTimers = [];
  document.removeEventListener('pointerdown', manterAcesa);
  if (wake) { wake.release().catch(() => {}); wake = null; }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && rota === 'geladeira') manterAcesa(); });

// ---------- Avisos no horário ----------
const avisados = new Set();
let ultimoDia = hojeStr(), ultimaHora = new Date().getHours();
setInterval(() => {
  const d = new Date(), am = agoraMin(d);
  for (const it of montarDia(d).itens) {
    const chave = it.data + it.id + it.hora;
    if (!it.feito && minutos(it.hora) === am && !avisados.has(chave)) {
      avisados.add(chave);
      toast(`Agora: ${it.titulo}`, 6000);
      if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState !== 'visible') try { new Notification('Mente da Anny', { body: it.titulo, icon: 'icons/icon-192.png' }); } catch {}
    }
  }
  // Atualiza a tela a cada minuto (linha do "agora", devocional que vai pra noite, virada do dia)
  const digitando = document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName) && document.activeElement.type !== 'checkbox';
  if (hojeStr() !== ultimoDia) { ultimoDia = hojeStr(); devoSel = null; fraseExtra = 0; }
  if (d.getHours() !== ultimaHora) { ultimaHora = d.getHours(); fraseExtra = 0; }
  if ((rota === 'hoje' || rota === 'geladeira') && !digitando) render();
}, 60000);

// ---------- Sincronização ----------
S.onChange(() => { if (!calado) render(); });
S.onStatus((st) => {
  const el = $('#sync');
  el.className = 'sync ' + (st === 'on' ? 'on' : st === 'busy' ? 'busy' : '');
  el.title = { on: 'Sincronizado', busy: 'Sincronizando…', local: 'Salvo só neste aparelho', deslogado: 'Entre na conta para sincronizar', erro: 'Sem conexão — salvo neste aparelho' }[st] || '';
  const digitando = document.activeElement && document.activeElement.tagName === 'INPUT' && document.activeElement.type !== 'checkbox';
  if (rota === 'ajustes' && st !== 'busy' && !digitando) render();
});

if (!S.get('inicio', null)) S.set('inicio', hojeStr());
function fecharMais() { $('.mais')?.classList.remove('aberto'); $('#mais-btn')?.setAttribute('aria-expanded', 'false'); }
$('#mais-btn').addEventListener('click', e => { e.stopPropagation(); const m = $('.mais'); const ab = !m.classList.contains('aberto'); m.classList.toggle('aberto', ab); e.currentTarget.setAttribute('aria-expanded', String(ab)); });
document.addEventListener('click', e => { if (!e.target.closest('.mais')) fecharMais(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharMais(); });
// Dica flutuante dos gráficos ([data-tip]) — mouse e toque
const tip = document.createElement('div'); tip.id = 'tip'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip);
function mostrarTip(el, ev) {
  tip.innerHTML = esc(el.dataset.tip).replace(/\n|&#10;/g, '<br>'); tip.classList.add('on');
  const r = el.getBoundingClientRect(), px = ev?.clientX ?? r.left + r.width / 2, py = ev?.clientY ?? r.top;
  const w = tip.offsetWidth, h = tip.offsetHeight;
  tip.style.left = Math.min(innerWidth - w - 8, Math.max(8, px - w / 2)) + 'px';
  tip.style.top = Math.max(8, py - h - 14) + 'px';
}
document.addEventListener('pointermove', e => { const el = e.target.closest?.('[data-tip]'); if (el && e.pointerType === 'mouse') mostrarTip(el, e); else if (e.pointerType === 'mouse') tip.classList.remove('on'); });
document.addEventListener('pointerdown', e => { const el = e.target.closest?.('[data-tip]'); if (el && e.pointerType !== 'mouse') mostrarTip(el, e); else if (!el) tip.classList.remove('on'); });
document.addEventListener('focusin', e => { const el = e.target.closest?.('[data-tip]'); if (el) mostrarTip(el); });
addEventListener('scroll', () => tip.classList.remove('on'), { passive: true });
addEventListener('hashchange', navegar);
navegar();
S.iniciarNuvem().then(() => recarregarAgenda());
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
