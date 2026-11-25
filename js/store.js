// Armazenamento: tudo fica no aparelho (localStorage) e, com login, sincroniza com o Supabase.
// Cada chave guarda { v: valor, t: momento da última alteração }. Na sincronização vence o mais recente.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const P = 'mda:';
const mem = new Map();
const ouvintes = new Set();
let sb = null, usuario = null, estado = 'local';

function lsGet(k) { try { return localStorage.getItem(P + k); } catch { return null; } }
function lsSet(k, v) { try { localStorage.setItem(P + k, v); } catch {} }
function lsKeys() {
  const out = [];
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(P + 'd:')) out.push(k.slice(P.length + 2)); } } catch {}
  return out;
}

function rec(k) {
  if (mem.has(k)) return mem.get(k);
  const raw = lsGet('d:' + k);
  let r = null;
  if (raw) { try { r = JSON.parse(raw); } catch {} }
  mem.set(k, r);
  return r;
}

export function get(k, padrao) {
  const r = rec(k);
  return r && r.v !== undefined ? r.v : (typeof padrao === 'function' ? padrao() : padrao);
}

export function set(k, v) {
  const r = { v, t: Date.now() };
  mem.set(k, r);
  lsSet('d:' + k, JSON.stringify(r));
  marcarPendente(k);
  avisar([k]);
  agendarEnvio();
}

export function update(k, padrao, fn) {
  const atual = structuredClone(get(k, padrao));
  const novo = fn(atual);
  set(k, novo === undefined ? atual : novo);
}

export function onChange(fn) { ouvintes.add(fn); return () => ouvintes.delete(fn); }
function avisar(chaves) { ouvintes.forEach(fn => { try { fn(chaves); } catch (e) { console.error(e); } }); }

// Preferências só deste aparelho (tema etc.)
export function local(k, v) {
  if (v === undefined) return lsGet(k);
  lsSet(k, v);
}

// ---------- Mesclagem de checks ----------
// Checks de aparelhos diferentes se somam (em vez de um substituir o outro).
// Desmarcar guarda um "apagado em" em _x, para a remoção também valer nos outros aparelhos.
const mesclavel = k => /^checks:/.test(k);
export function mesclar(a = {}, b = {}) {
  a = a || {}; b = b || {};
  const x = { ...(a._x || {}) };
  for (const [id, t] of Object.entries(b._x || {})) x[id] = Math.max(x[id] || 0, t);
  const out = {};
  for (const src of [a, b]) for (const [id, t] of Object.entries(src)) if (id !== '_x') out[id] = Math.max(Number(out[id]) || 0, Number(t) || 1);
  for (const [id, t] of Object.entries(x)) if (out[id] != null && t >= out[id]) delete out[id];
  if (Object.keys(x).length) out._x = x;
  return out;
}
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// Aplica um valor vindo da nuvem; devolve true se mudou algo aqui
function receber(chave, valor, t) {
  const loc = rec(chave);
  if (mesclavel(chave) && loc && loc.v && valor) {
    const m = mesclar(loc.v, valor);
    if (igual(m, loc.v) && loc.t >= t) return false;
    const novo = { v: m, t: Math.max(loc.t, t) };
    mem.set(chave, novo); lsSet('d:' + chave, JSON.stringify(novo));
    if (!igual(m, valor)) { novo.t = Date.now(); lsSet('d:' + chave, JSON.stringify(novo)); marcarPendente(chave); agendarEnvio(); }
    return true;
  }
  if (loc && t <= loc.t) return false;
  const r = { v: valor, t };
  mem.set(chave, r); lsSet('d:' + chave, JSON.stringify(r));
  return true;
}

// ---------- Sincronização ----------
function pendentes() { try { return JSON.parse(lsGet('_pend') || '[]'); } catch { return []; } }
function marcarPendente(k) { const p = new Set(pendentes()); p.add(k); lsSet('_pend', JSON.stringify([...p])); }

let timer = null;
function agendarEnvio() { if (!usuario) return; clearTimeout(timer); timer = setTimeout(enviar, 800); }

const statusFns = new Set();
export function onStatus(fn) { statusFns.add(fn); fn(estado, usuario); return () => statusFns.delete(fn); }
function status(s) { estado = s; statusFns.forEach(fn => fn(estado, usuario)); }

export const temNuvem = () => !!(SUPABASE_URL && SUPABASE_ANON_KEY);
export const conta = () => usuario;
export let ultimoErro = '', ultimaSync = 0;
export const pendentesQtd = () => pendentes().length;
// Confere se uma chave já está salva na nuvem (diagnóstico)
export async function naNuvem(chave) {
  if (!sb || !usuario) return { ok: false, msg: 'sem login' };
  await enviar();
  const { data, error } = await sb.from('dados').select('chave').eq('chave', chave).maybeSingle();
  if (error) return { ok: false, msg: error.message };
  return { ok: !!data, msg: data ? 'salvo' : 'não encontrado' };
}

async function enviar() {
  if (!sb || !usuario) return;
  const chaves = pendentes();
  if (!chaves.length) return;
  status('busy');
  // Marca com o horário do envio (não o da edição): assim nenhum aparelho deixa passar algo enviado com atraso
  const agora = Date.now();
  const linhas = chaves.map(k => { const r = rec(k); if (!r) return null; const t = Math.max(r.t, agora); if (t !== r.t) { r.t = t; lsSet('d:' + k, JSON.stringify(r)); } return { user_id: usuario.id, chave: k, valor: r.v ?? null, atualizado: t }; }).filter(Boolean);
  const { error } = await sb.from('dados').upsert(linhas, { onConflict: 'user_id,chave' });
  if (error) { console.warn('sync', error); ultimoErro = 'Envio: ' + (error.message || error.code); status('erro'); return; }
  const restantes = pendentes().filter(k => !chaves.includes(k) || rec(k)?.t > (linhas.find(l => l.chave === k)?.atualizado || 0));
  lsSet('_pend', JSON.stringify(restantes));
  ultimoErro = ''; ultimaSync = Date.now();
  status('on');
}

export async function puxar() {
  if (!sb || !usuario) return;
  status('busy');
  const desde = Number(lsGet('_puxado') || 0);
  // margem de 3 min: tolera relógios diferentes entre aparelhos e envios atrasados
  const { data, error } = await sb.from('dados').select('chave,valor,atualizado').gt('atualizado', Math.max(0, desde - 3 * 60000));
  if (error) { console.warn('pull', error); ultimoErro = 'Leitura: ' + (error.message || error.code); status('erro'); return; }
  const mudou = [];
  let max = desde;
  for (const row of data) {
    max = Math.max(max, Number(row.atualizado));
    if (receber(row.chave, row.valor, Number(row.atualizado))) mudou.push(row.chave);
  }
  lsSet('_puxado', String(max));
  if (mudou.length) avisar(mudou);
  await enviar();
  status('on');
}

export async function iniciarNuvem() {
  if (!temNuvem()) { status('local'); return; }
  try {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm');
    sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
    const { data } = await sb.auth.getSession();
    usuario = data.session?.user || null;
    sb.auth.onAuthStateChange((_e, s) => { const antes = usuario?.id; usuario = s?.user || null; if (usuario && usuario.id !== antes) { primeiraSync(); ligarTempoReal(); } status(usuario ? 'on' : 'deslogado'); });
    if (usuario) { lsSet('_puxado', '0'); await primeiraSync(); ligarTempoReal(); } else status('deslogado'); // ao abrir, busca tudo da conta
    addEventListener('online', () => puxar());
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') puxar(); });
  } catch (e) { console.warn('Supabase indisponível', e); status('erro'); }
}

// ---------- Tempo real: mudanças feitas em outro aparelho chegam na hora ----------
let canal = null;
export let tempoReal = 'desligado';
async function ligarTempoReal(privado = false) {
  if (!sb || !usuario) return;
  try { const { data } = await sb.auth.getSession(); if (data.session) await sb.realtime.setAuth(data.session.access_token); } catch {}
  if (canal) sb.removeChannel(canal);
  canal = sb.channel('dados-' + usuario.id, { config: { private: privado } })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dados', filter: `user_id=eq.${usuario.id}` }, ({ new: row }) => {
      if (!row?.chave) return;
      if (receber(row.chave, row.valor, Number(row.atualizado))) avisar([row.chave]);
    })
    .subscribe((st, err) => {
      if (st === 'SUBSCRIBED') tempoReal = 'ligado';
      else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') {
        if (!privado) { ligarTempoReal(true); return; } // projeto que só aceita canais privados
        tempoReal = 'indisponível' + (err?.message ? ` (${err.message})` : '');
      }
      status(estado);
    });
}

async function primeiraSync() {
  // Na primeira vez, envia o que já existia neste aparelho.
  if (!lsGet('_subiu:' + usuario.id)) {
    const p = new Set(pendentes()); lsKeys().forEach(k => p.add(k)); lsSet('_pend', JSON.stringify([...p]));
    lsSet('_subiu:' + usuario.id, '1');
  }
  await puxar();
}

export async function entrar(email, senha) {
  const { error } = await sb.auth.signInWithPassword({ email, password: senha });
  if (error) throw error;
}
export async function criarConta(email, senha) {
  const { data, error } = await sb.auth.signUp({ email, password: senha, options: { emailRedirectTo: location.href.split('#')[0] } });
  if (error) throw error;
  return data;
}
export async function funcao(nome) {
  if (!sb) throw new Error('Sem conexão com o Supabase agora.');
  if (!usuario) throw new Error('Entre na sua conta (Ajustes) para ler as agendas.');
  await enviar();
  const { data, error } = await sb.functions.invoke(nome, { method: 'POST', body: {} });
  if (error) {
    const status = error.context?.status;
    let detalhe = '';
    try { detalhe = (await error.context?.json?.())?.erro || ''; } catch {}
    const msg = error.name === 'FunctionsFetchError' || error.name === 'FunctionsRelayError'
      ? `Não consegui falar com a função “${nome}”. Confira se ela foi criada com esse nome exato e se “Verify JWT” está desligado.`
      : status === 404 ? `A função “${nome}” não foi encontrada no Supabase. Confira o nome (tudo minúsculo).`
      : status === 401 ? (detalhe || `O Supabase recusou o acesso (401). Desligue “Verify JWT” na função “${nome}” ou saia e entre de novo na conta.`)
      : `A função “${nome}” respondeu com erro${status ? ' ' + status : ''}${detalhe ? ': ' + detalhe : ''}.`;
    throw new Error(msg);
  }
  return data;
}
export async function sair() { await sb?.auth.signOut(); }
