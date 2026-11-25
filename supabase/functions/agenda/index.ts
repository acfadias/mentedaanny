// Função "agenda" — lê os links secretos iCal salvos pela usuária e devolve o conteúdo das agendas.
// O navegador não consegue buscar o Google Agenda direto (bloqueio de CORS), por isso passa por aqui.
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '');
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const { data: u } = await sb.auth.getUser(token);
  if (!u?.user) return json({ erro: 'Entre na sua conta.' }, 401);

  const { data } = await sb.from('dados').select('valor').eq('chave', 'agendas').maybeSingle();
  const links = (data?.valor ?? {}) as Record<string, string>;
  const out: Record<string, unknown> = {};
  for (const nome of ['pessoal', 'trabalho']) {
    const link = links[nome];
    if (!link) continue;
    try {
      const url = new URL(link.trim().replace(/^webcal:/i, 'https:'));
      if (url.protocol !== 'https:' || !/(^|\.)(google\.com|googleusercontent\.com)$/.test(url.hostname)) throw new Error('Use o endereço secreto iCal do Google Agenda.');
      const r = await fetch(url, { headers: { 'User-Agent': 'mentedaanny-agenda' } });
      if (!r.ok) throw new Error(r.status === 404 ? 'Link não encontrado — gere um novo no Google Agenda.' : 'O Google respondeu ' + r.status);
      out[nome] = { ics: await r.text() };
    } catch (e) {
      out[nome] = { erro: e instanceof Error ? e.message : String(e) };
    }
  }
  return json(out);
});
