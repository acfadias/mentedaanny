import * as S from './store.js';
import { NOME } from './config.js';
import { itensDoDia, progresso, saudacao, dataLonga, ymd, deYmd, addDias, minutos, agoraMin, CASA, DIAS, DIAS_CURTO, MESES } from './rotina.js';
import { PLANO, ETAPAS, CURTA, doDia } from './devocional-plano.js';
import { FRASES, CATEGORIAS, AO_MARCAR, DIA_COMPLETO, DIA_DIFICIL, sortear } from './afirmacoes.js';
import { confeteEm, festa, toast } from './efeitos.js';

const $ = (s, el = document) => el.querySelector(s);
const app = $('#app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const uid = () => Math.random().toString(36).slice(2, 10);
const hojeStr = () => ymd(new Date());

let rota = 'hoje';
let devoSel = null;           // data selecionada no devocional
let filtroFrases = 'todas';
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

function cardFrase(salto = fraseExtra) {
  const f = fraseDoMomento(salto);
  const fav = S.get('afirmacoes', {}).favs?.includes(f.id);
  return `<section class="card frase">
    <p class="eyebrow" style="color:inherit;opacity:.7">Pra você, agora</p>
    <blockquote class="fade-swap" id="frase-txt">${esc(f.t)}</blockquote>
    <div class="meta"><span>${esc(CATEGORIAS[f.cat] || 'Minhas frases')}</span>
      <span class="acts"><button class="round ${fav ? 'fav' : ''}" data-act="fav" data-id="${f.id}" aria-label="Favoritar">${fav ? '♥' : '♡'}</button>
      <button class="round" data-act="outra-frase" aria-label="Outra frase">↻</button></span></div>
  </section>`;
}

// ---------- Componentes ----------
function anel(p, tam = 118) {
  const r = 52, c = 2 * Math.PI * r;
  return `<div class="ring ${p.total && p.ok === p.total ? 'full' : ''}" style="width:${tam}px;height:${tam}px" role="img" aria-label="${p.ok} de ${p.total} feitos">
    <svg viewBox="0 0 120 120"><circle class="trk" cx="60" cy="60" r="${r}" stroke-width="8"/><circle class="val" cx="60" cy="60" r="${r}" stroke-width="8" stroke-dasharray="${c}" stroke-dashoffset="${c}" data-off="${c * (1 - p.pct)}"/></svg>
    <div class="txt"><div><b>${p.ok}/${p.total}</b><span>feitos</span></div></div></div>`;
}

function linhaDoTempo(itens) {
  const agora = new Date();
  const am = agoraMin(agora);
  let html = '', marcou = false;
  const prox = itens.find(i => !i.feito && !i.opcional && minutos(i.hora) + 30 >= am);
  itens.forEach((it, idx) => {
    if (!marcou && minutos(it.hora) > am) {
      html += `<li class="now-line" aria-hidden="true"><time>${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}</time><i></i><span></span></li>`;
      marcou = true;
    }
    html += `<li class="ti ${it.feito ? 'feito' : ''} ${prox === it ? 'agora' : ''} a-${it.area}" style="animation-delay:${idx * 45}ms">
      <time>${it.hora}</time>
      <input type="checkbox" class="chk" data-check="${it.data}|${it.id}" ${it.feito ? 'checked' : ''} aria-label="${esc(it.titulo)}">
      <div class="body"><div class="t">${it.link ? `<a href="${it.link}" style="text-decoration:none">${esc(it.titulo)}</a>` : esc(it.titulo)}</div>
        ${(it.sub || it.tag || it.opcional) ? `<div class="sub">${it.tag ? `<span class="pill rose">${esc(it.tag)}</span>` : ''}${it.sub ? `<span>${esc(it.sub)}</span>` : ''}${it.opcional && !it.feito ? `<button class="x" data-act="pular" data-d="${it.data}" data-id="${it.id}" title="Deixar pra lá">deixar pra lá ×</button>` : ''}</div>` : ''}
      </div></li>`;
  });
  if (!marcou) html += `<li class="now-line" aria-hidden="true"><time>agora</time><i></i><span></span></li>`;
  return `<ol class="timeline">${html}</ol>`;
}

function cardProximo(itens, p) {
  const am = agoraMin();
  if (p.total && p.ok === p.total) return `<section class="card next"><div class="done-msg" style="flex:1"><p class="eyebrow">Dia completo</p><div class="big">${esc(sortear(DIA_COMPLETO))}</div></div></section>`;
  const pend = itens.filter(i => !i.feito && !i.opcional);
  const prox = pend.find(i => minutos(i.hora) + 30 >= am) || pend[pend.length - 1];
  if (!prox) return '';
  const dificil = new Date().getHours() >= 19 && p.pct < 0.4;
  return `<section class="card next">
    <input type="checkbox" class="chk" data-check="${prox.data}|${prox.id}" aria-label="Marcar ${esc(prox.titulo)}">
    <div style="min-width:0"><p class="eyebrow">Próximo passo · ${prox.hora}</p><div class="big">${esc(prox.titulo)}</div>
    ${dificil ? `<p style="margin:8px 0 0;opacity:.9;font-size:14px">${esc(sortear(DIA_DIFICIL))}</p>` : ''}</div></section>`;
}

function cardTop3(data) {
  const top = S.get('top3:' + data, () => [{ t: '' }, { t: '' }, { t: '' }]);
  return `<section class="card"><h2>3 prioridades <small>só três. o resto espera.</small></h2><ul class="list">
    ${top.map((p, i) => `<li class="li ${p.feito ? 'feito' : ''}"><span class="num3">${i + 1}</span>
      <input class="edit" data-top="${i}" data-k="top-${i}" value="${esc(p.t)}" placeholder="${['A coisa mais importante de hoje', 'Se der, isso', 'E isso, se sobrar energia'][i]}" enterkeyhint="done">
      <input type="checkbox" class="chk" data-topchk="${i}" ${p.feito ? 'checked' : ''} ${p.t ? '' : 'disabled'} aria-label="Concluir prioridade ${i + 1}"></li>`).join('')}
  </ul></section>`;
}

function cardCaixa() {
  const cx = S.get('caixa', []);
  return `<section class="card line"><h2>Caixa de entrada <small>jogue aqui, organize depois</small></h2>
    <form class="add" data-form="caixa"><input name="t" placeholder="Lembrei de uma coisa…" autocomplete="off" data-k="caixa-in" enterkeyhint="send"><button class="btn" aria-label="Adicionar">+</button></form>
    <ul class="list">${cx.length ? cx.map(c => `<li class="li"><span class="t">${esc(c.t)}</span>
      <button class="btn ghost sm" data-act="promover" data-id="${c.id}" title="Virar prioridade de hoje">↑ hoje</button>
      <button class="x" data-act="del-caixa" data-id="${c.id}" aria-label="Apagar">×</button></li>`).join('') : '<li class="empty">Nada aqui. Cabeça leve. 🌿</li>'}</ul></section>`;
}

// ---------- Telas ----------
function telaHoje() {
  const d = new Date(), data = ymd(d);
  const itens = itensDoDia(d);
  const top = S.get('top3:' + data, []);
  const p = progresso(itens, top);
  const bebe = S.get('config', {}).bebe;
  return `<div class="view">
    <div class="hero"><div><p class="eyebrow">${dataLonga(d)}</p><h1>${saudacao(d)},<br><em>${esc(NOME)}.</em></h1></div>
      <div class="hero-side">${bebe ? '<span class="bebe-badge">👶 Modo Bebê</span>' : ''}${anel(p)}</div></div>
    <div class="grid">
      <div class="c-7 stack">${cardProximo(itens, p)}<section class="card"><h2>Seu dia <small>${itens.filter(i => i.feito).length} de ${itens.length}</small></h2>${linhaDoTempo(itens)}</section></div>
      <div class="c-5 stack">${cardFrase()}${cardTop3(data)}${cardCaixa()}</div>
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
    ${bebe ? '<div class="banner">👶 Modo Bebê ligado: as tarefas da casa estão pausadas e não acumulam. Quem puder ajudar, ajuda. 🤍</div>' : ''}
    <div class="grid">
      <section class="card c-12"><h2>Semana <small>seg a sex · fim de semana livre</small></h2><div class="semana">
        ${dias.map(d => { const ds = ymd(d); const ch = S.get('checks:' + ds, {}); const ts = CASA.filter(t => t.dias.includes(d.getDay()));
          return `<div class="dia ${ds === hoje ? 'hoje' : ''}"><h3>${DIAS[d.getDay()]}</h3><div class="d">${d.getDate()} de ${MESES[d.getMonth()]}${ds === hoje ? ' · hoje' : ''}</div><div class="tasks">
          ${ts.map(t => `<label><input type="checkbox" class="chk" data-check="${ds}|${t.id}" ${ch[t.id] ? 'checked' : ''}><span>${t.icone} ${t.titulo}<br><small class="muted">${t.hora}</small></span></label>`).join('')}</div></div>`; }).join('')}
      </div></section>
      <section class="card c-7"><h2>Lista de compras <small>${compras.filter(c => !c.feito).length} itens</small></h2>
        <form class="add" data-form="compras"><input name="t" placeholder="Acabou o quê?" autocomplete="off" data-k="compras-in" enterkeyhint="send"><button class="btn">Adicionar</button></form>
        <div class="chips">${sugest.filter(s => !naLista.has(s.toLowerCase())).map(s => `<button class="chip" data-act="sugestao" data-t="${esc(s)}">+ ${esc(s)}</button>`).join('')}</div>
        <ul class="list" style="margin-top:10px">${compras.length ? compras.map(c => `<li class="li ${c.feito ? 'feito' : ''}"><input type="checkbox" class="chk" data-compra="${c.id}" ${c.feito ? 'checked' : ''} aria-label="${esc(c.t)}"><span class="t">${esc(c.t)}</span><button class="x" data-act="del-compra" data-id="${c.id}" aria-label="Apagar">×</button></li>`).join('') : '<li class="empty">Lista vazia. Geladeira feliz.</li>'}</ul>
        ${compras.some(c => c.feito) ? '<div class="row" style="margin-top:12px"><button class="btn ghost sm" data-act="limpar-compras">Limpar comprados</button></div>' : ''}
      </section>
      <section class="card line c-5"><h2>Como funciona</h2><div class="note">
        <p>🍽 <b>Louça</b> dia sim, dia não: seg, qua e sex.</p>
        <p>🧺 <b>Roupa</b> nos dias sem louça: ter e qui.</p>
        <p>🧹 <b>Chão</b> qua e sex — casa limpa antes do fim de semana.</p>
        <p>✓ <b>Cozinha e escritório</b> todo dia útil às 18h30, antes do jantar.</p>
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
    ${fim ? '<div class="banner">O plano de 2026 terminou. Peça um plano novo pra 2027 e ele aparece aqui. ✨</div>' : ''}
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
        <section class="card">${st ? `<p class="eyebrow">Feito ${st === 'curto' ? '(versão curta)' : ''}</p><p class="serif" style="font-size:24px;margin:0 0 12px">Que bom que você esteve aqui hoje. 🤍</p><button class="btn ghost sm" data-act="devo-desfazer">Desmarcar</button>`
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
  const filtros = { todas: 'Todas', favs: '♥ Favoritas', ...CATEGORIAS, minhas: 'Minhas' };
  return `<div class="view">
    <div class="hero"><div><p class="eyebrow">Palavras de afirmação</p><h1>Frases <em>pra você.</em></h1></div></div>
    <div class="grid" style="margin-bottom:22px"><div class="c-7">${cardFrase()}</div>
      <section class="card line c-5"><h2>Escreva a sua</h2><form class="add" data-form="frase"><input name="t" placeholder="Uma frase que te fortalece…" autocomplete="off" data-k="frase-in"><button class="btn">Salvar</button></form>
      <p class="note">Suas frases e favoritas aparecem mais vezes na tela Hoje e na geladeira.</p></section></div>
    <div class="chips" style="margin-bottom:18px">${Object.entries(filtros).map(([k, v]) => `<button class="chip ${filtroFrases === k ? 'on' : ''}" data-act="filtro" data-f="${k}">${v}</button>`).join('')}</div>
    <div class="frases-list">${lista.length ? lista.map((f, i) => `<article class="fcard" style="animation-delay:${Math.min(i, 20) * 25}ms"><p>${esc(f.t)}</p><div class="meta"><span>${esc(CATEGORIAS[f.cat] || 'Minha')}</span><span>
      ${f.cat === 'minhas' ? `<button class="x" data-act="del-frase" data-id="${f.id}" aria-label="Apagar">×</button>` : ''}
      <button class="heart ${af.favs?.includes(f.id) ? 'on' : ''}" data-act="fav" data-id="${f.id}" aria-label="Favoritar">${af.favs?.includes(f.id) ? '♥' : '♡'}</button></span></div></article>`).join('') : '<p class="empty">Nada aqui ainda.</p>'}</div>
  </div>`;
}

function telaAjustes() {
  const cfg = S.get('config', {});
  const tema = S.local('tema') || 'auto';
  const u = S.conta();
  let contaHtml;
  if (!S.temNuvem()) contaHtml = `<div class="banner">☁️ Falta colar a chave do Supabase em <code>js/config.js</code>. Até lá, tudo fica salvo só neste aparelho.</div>`;
  else if (u) contaHtml = `<div class="set"><div><b>Conectada</b><p>${esc(u.email)} · sincronizando entre aparelhos</p></div><button class="btn ghost sm" data-act="sair">Sair</button></div>`;
  else contaHtml = `<form class="form" data-form="login"><input type="email" name="email" placeholder="E-mail" autocomplete="email" required><input type="password" name="senha" placeholder="Senha" autocomplete="current-password" required minlength="6">
    <div class="row"><button class="btn" name="modo" value="entrar">Entrar</button><button class="btn ghost" name="modo" value="criar">Criar minha conta</button></div>
    <p class="note">Crie a conta uma única vez. Depois, bloqueie novos cadastros no Supabase para ninguém mais conseguir entrar.</p></form>`;
  return `<div class="view">
    <div class="hero"><div><p class="eyebrow">Do seu jeito</p><h1>Ajustes</h1></div></div>
    <div class="grid">
      <section class="card c-6"><h2>Modo Bebê 👶</h2><div class="set"><div><b>${cfg.bebe ? 'Ligado' : 'Desligado'}</b><p>Reduz tudo ao essencial: devocional curto, vitamina, água e descanso. Casa pausada, sem acumular.</p></div>
        <input type="checkbox" class="switch" data-act="bebe" ${cfg.bebe ? 'checked' : ''} aria-label="Modo Bebê"></div></section>
      <section class="card c-6"><h2>Tema</h2><div class="chips">${[['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Noturno']].map(([k, v]) => `<button class="chip ${tema === k ? 'on' : ''}" data-act="tema" data-t="${k}">${v}</button>`).join('')}</div>
        <p class="note">O automático segue o aparelho: claro de dia, noturno à noite.</p></section>
      <section class="card c-6"><h2>Modo Geladeira 🧊</h2><p class="note">Tela cheia para o iPad: relógio grande, próximo passo, checks e lista de compras. Escurece sozinha à noite.</p>
        <a class="btn" href="#geladeira">Abrir Modo Geladeira</a>
        <details class="note" style="margin-top:12px"><summary>Como deixar o iPad fixo na geladeira</summary><ol>
          <li>No Safari, abra o site → Compartilhar → <b>Adicionar à Tela de Início</b>.</li>
          <li>Abra pelo ícone e toque em <b>Abrir Modo Geladeira</b>. Toque uma vez na tela para mantê-la acesa.</li>
          <li>Ajustes do iPad → Tela e Brilho → <b>Bloqueio Automático: Nunca</b>, com o iPad na tomada.</li>
          <li>Opcional: Ajustes → Acessibilidade → <b>Acesso Guiado</b> para travar no app.</li></ol></details></section>
      <section class="card c-6"><h2>Lembretes no celular 🔔</h2><p class="note">Um arquivo com toda a rotina (devocional, casa, vitamina). Importe uma vez na sua agenda <b>pessoal</b> e o celular avisa sozinho.</p>
        <a class="btn" href="lembretes.ics" download>Baixar lembretes</a>
        <details class="note" style="margin-top:12px"><summary>Como importar</summary><ol>
          <li><b>iPhone/iPad:</b> toque no arquivo baixado → Adicionar todos → escolha a agenda pessoal.</li>
          <li><b>Google Agenda (computador):</b> Configurações → Importar e exportar → Importar → escolha a agenda pessoal. O Google usa o alerta padrão da agenda; deixe em “no horário do evento”.</li></ol></details>
        <div class="set"><div><b>Avisos com o app aberto</b><p>Notifica no horário de cada tarefa enquanto o site estiver aberto.</p></div><button class="btn ghost sm" data-act="notif">${'Notification' in window && Notification.permission === 'granted' ? 'Ativados ✓' : 'Ativar'}</button></div></section>
      <section class="card c-12"><h2>Conta e sincronização</h2>${contaHtml}</section>
    </div></div>`;
}

function telaGeladeira() {
  const d = new Date(), data = ymd(d);
  const itens = itensDoDia(d);
  const p = progresso(itens, S.get('top3:' + data, []));
  const compras = S.get('compras', []).filter(c => !c.feito);
  return `<div class="fr view">
    <a class="round fr-exit" href="#hoje" aria-label="Sair do Modo Geladeira">×</a>
    <div class="fr-left">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap"><div><div class="fr-clock" id="fr-clock">--:--</div><div class="fr-date">${dataLonga(d)}</div></div>${anel(p, 130)}</div>
      ${cardFrase()}
      ${cardProximo(itens, p)}
      <section class="card"><h2>Compras <small>${compras.length}</small></h2>
        <form class="add" data-form="compras"><input name="t" placeholder="Acabou o quê?" autocomplete="off" data-k="fr-compras"><button class="btn">+</button></form>
        <ul class="list">${compras.slice(0, 8).map(c => `<li class="li"><input type="checkbox" class="chk" data-compra="${c.id}"><span class="t">${esc(c.t)}</span></li>`).join('') || '<li class="empty">Nada faltando.</li>'}</ul></section>
    </div>
    <section class="card"><h2>Hoje</h2>${linhaDoTempo(itens)}</section>
    <div class="fr-dim" id="fr-dim"></div>
  </div>`;
}

const TELAS = { hoje: telaHoje, casa: telaCasa, devocional: telaDevocional, frases: telaFrases, ajustes: telaAjustes, geladeira: telaGeladeira };

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
  if (rota === 'geladeira') relogio();
}

function navegar() {
  const h = (location.hash || '#hoje').slice(1);
  rota = TELAS[h] ? h : 'hoje';
  document.body.classList.toggle('fridge', rota === 'geladeira');
  document.querySelectorAll('.tabs a').forEach(a => a.classList.toggle('on', a.dataset.tab === rota));
  render(true);
  scrollTo({ top: 0 });
  if (rota === 'geladeira') iniciarGeladeira(); else pararGeladeira();
}

// ---------- Ações ----------
function toggleCheck(data, id, marcado, el) {
  const antes = progresso(itensDoDia(new Date()), S.get('top3:' + hojeStr(), []));
  S.update('checks:' + data, {}, ch => { if (marcado) ch[id] = Date.now(); else delete ch[id]; });
  if (id === 'devocional') S.update('devo:' + data, null, v => marcado ? (v || (S.get('config', {}).bebe ? 'curto' : 'completo')) : null);
  if (marcado) celebrar(el, antes);
}

function celebrar(el, antes) {
  const depois = progresso(itensDoDia(new Date()), S.get('top3:' + hojeStr(), []));
  if (el) confeteEm(el, 22);
  if (depois.total && depois.ok === depois.total && antes.ok < antes.total) { setTimeout(festa, 250); toast(sortear(DIA_COMPLETO), 4200); }
  else toast(sortear(AO_MARCAR));
}

app.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.check) { const [d, id] = t.dataset.check.split('|'); toggleCheck(d, id, t.checked, t); }
  else if (t.dataset.topchk) {
    const antes = progresso(itensDoDia(new Date()), S.get('top3:' + hojeStr(), []));
    S.update('top3:' + hojeStr(), () => [{ t: '' }, { t: '' }, { t: '' }], top => { top[+t.dataset.topchk].feito = t.checked; });
    if (t.checked) celebrar(t, antes);
  }
  else if (t.dataset.compra) { S.update('compras', [], l => { const c = l.find(x => x.id === t.dataset.compra); if (c) c.feito = t.checked; }); if (t.checked) { confeteEm(t, 12); toast('Comprado! ✓'); } }
  else if (t.dataset.act === 'bebe') { S.update('config', {}, c => { c.bebe = t.checked; }); toast(t.checked ? 'Modo Bebê ligado. Só o essencial agora. 🤍' : 'Modo Bebê desligado. Rotina completa de volta.'); }
});

app.addEventListener('input', e => {
  const t = e.target;
  calado = true;
  if (t.dataset.top != null) S.update('top3:' + hojeStr(), () => [{ t: '' }, { t: '' }, { t: '' }], top => { top[+t.dataset.top].t = t.value; if (!t.value) top[+t.dataset.top].feito = false; });
  else if (t.dataset.diario) S.set('diario:' + t.dataset.diario, t.value);
  calado = false;
  if (t.dataset.top != null) { const c = t.parentElement.querySelector('[data-topchk]'); if (c) c.disabled = !t.value; }
});

app.addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target, tipo = f.dataset.form;
  const v = f.t?.value?.trim();
  if (tipo === 'caixa' && v) { S.update('caixa', [], l => { l.unshift({ id: uid(), t: v }); }); toast('Anotado. Pode esquecer, eu lembro. 🧠'); }
  if (tipo === 'compras' && v) { S.update('compras', [], l => { l.unshift({ id: uid(), t: v }); }); }
  if (tipo === 'frase' && v) { S.update('afirmacoes', { favs: [], minhas: [] }, a => { a.minhas = a.minhas || []; a.minhas.unshift({ id: 'm-' + uid(), t: v }); }); toast('Frase salva. 🤍'); }
  if (tipo === 'login') {
    const modo = e.submitter?.value || 'entrar';
    try {
      if (modo === 'criar') { const r = await S.criarConta(f.email.value, f.senha.value); toast(r.session ? 'Conta criada! 🎉' : 'Conta criada. Confirme pelo link no seu e-mail.', 5000); }
      else { await S.entrar(f.email.value, f.senha.value); toast('Bem-vinda de volta! ☁️'); }
      render();
    } catch (err) { toast('Não deu: ' + (err.message || err), 5000); }
    return;
  }
  const inp = f.querySelector('input[name="t"]'); if (inp) { inp.value = ''; inp.focus(); }
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
      S.update('top3:' + hojeStr(), () => [{ t: '' }, { t: '' }, { t: '' }], top => { const i = top.findIndex(p => !p.t?.trim()); if (i >= 0) { top[i] = { t: item.t }; ok = true; } });
      if (ok) { S.update('caixa', [], l => l.filter(x => x.id !== id)); toast('Virou prioridade de hoje.'); } else toast('As 3 prioridades já estão cheias. Conclua uma antes. 🙂');
      break;
    }
    case 'pular': S.update('checks:' + b.dataset.d, {}, ch => { ch['pulou:' + id] = Date.now(); }); toast('Deixado pra lá. Sem culpa. 🤍'); break;
    case 'sugestao': S.update('compras', [], l => { l.unshift({ id: uid(), t: b.dataset.t }); }); break;
    case 'del-compra': S.update('compras', [], l => l.filter(x => x.id !== id)); break;
    case 'limpar-compras': S.update('compras', [], l => l.filter(x => !x.feito)); toast('Lista limpinha.'); break;
    case 'devo-dia': devoSel = b.dataset.d; render(); $('.dbtn.sel')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }); break;
    case 'devo-ok': {
      S.set('devo:' + devoSel, b.dataset.v);
      const antes = progresso(itensDoDia(new Date()), S.get('top3:' + hojeStr(), []));
      S.update('checks:' + devoSel, {}, ch => { ch.devocional = Date.now(); });
      if (devoSel === hojeStr()) celebrar(b, antes); else { confeteEm(b, 22); toast('Marcado. 🤍'); }
      break;
    }
    case 'devo-desfazer': S.set('devo:' + devoSel, null); S.update('checks:' + devoSel, {}, ch => { delete ch.devocional; }); break;
    case 'timer': alternarTimer(); break;
    case 'timer-zerar': timer = { acum: 0, inicio: null }; pintarTimer(); break;
    case 'filtro': filtroFrases = b.dataset.f; render(true); break;
    case 'del-frase': S.update('afirmacoes', { favs: [], minhas: [] }, af => { af.minhas = (af.minhas || []).filter(m => m.id !== id); }); break;
    case 'tema': aplicarTema(b.dataset.t); render(); break;
    case 'sair': S.sair().then(() => render()); break;
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
  if (timer.inicio && s >= TOTAL) { timer.acum = TOTAL; timer.inicio = null; toast('Tempo concluído. Que bom que você esteve aqui. 🤍', 4000); }
  etapaAnterior = timer.inicio ? atual : -1;
}
setInterval(() => { if (timer.inicio) pintarTimer(); }, 1000);

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
  for (const it of itensDoDia(d)) {
    const chave = it.data + it.id + it.hora;
    if (!it.feito && minutos(it.hora) === am && !avisados.has(chave)) {
      avisados.add(chave);
      toast(`⏰ Agora: ${it.titulo}`, 6000);
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
addEventListener('hashchange', navegar);
navegar();
S.iniciarNuvem();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
