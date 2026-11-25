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

async function enviar() {
  if (!sb || !usuario) return;
  const chaves = pendentes();
  if (!chaves.length) return;
  status('busy');
  const linhas = chaves.map(k => { const r = rec(k); return r && { user_id: usuario.id, chave: k, valor: r.v ?? null, atualizado: r.t }; }).filter(Boolean);
  const { error } = await sb.from('dados').upsert(linhas, { onConflict: 'user_id,chave' });
  if (error) { console.warn('sync', error); status('erro'); return; }
  const restantes = pendentes().filter(k => !chaves.includes(k) || rec(k)?.t > (linhas.find(l => l.chave === k)?.atualizado || 0));
  lsSet('_pend', JSON.stringify(restantes));
  status('on');
}

export async function puxar() {
  if (!sb || !usuario) return;
  status('busy');
  const desde = Number(lsGet('_puxado') || 0);
  const { data, error } = await sb.from('dados').select('chave,valor,atualizado').gt('atualizado', desde);
  if (error) { console.warn('pull', error); status('erro'); return; }
  const mudou = [];
  let max = desde;
  for (const row of data) {
    max = Math.max(max, Number(row.atualizado));
    const loc = rec(row.chave);
    if (!loc || Number(row.atualizado) > loc.t) {
      const r = { v: row.valor, t: Number(row.atualizado) };
      mem.set(row.chave, r);
      lsSet('d:' + row.chave, JSON.stringify(r));
      mudou.push(row.chave);
    }
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
    sb.auth.onAuthStateChange((_e, s) => { const antes = usuario?.id; usuario = s?.user || null; if (usuario && usuario.id !== antes) primeiraSync(); status(usuario ? 'on' : 'deslogado'); });
    if (usuario) await primeiraSync(); else status('deslogado');
    addEventListener('online', () => puxar());
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') puxar(); });
  } catch (e) { console.warn('Supabase indisponível', e); status('erro'); }
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
export async function sair() { await sb?.auth.signOut(); }
