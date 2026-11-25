// Função "feed" — link de agenda (iCal) com tudo que a Anny cria no app.
// É assinado uma vez no Google Agenda / iPhone. Acesso só por um código secreto no link.
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

const chave = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}').default;
const sb = createClient(Deno.env.get('SUPABASE_URL')!, chave);

const FONTE = { trabalho: 'Trabalho', pessoal: 'Pessoal', faculdade: 'Faculdade' } as Record<string, string>;
const TRABALHO_FIXO = [
  { id: 'prospectar', titulo: 'Prospectar novos clientes', ini: '0900', fim: '1000' },
  { id: 'rotinaprosp', titulo: 'Rotina de prospecção', ini: '1000', fim: '1015' },
  { id: 'audios', titulo: 'Enviar os áudios', ini: '1015', fim: '1030' },
];

const esc = (s: string) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const enc = new TextEncoder();
function dobrar(linha: string) {
  const out: string[] = []; let cur = '';
  for (const ch of linha) { if (enc.encode(cur + ch).length > 74) { out.push(cur); cur = ' ' + ch; } else cur += ch; }
  out.push(cur); return out.join('\r\n');
}
const dt = (data: string, hora: string) => `${data.replace(/-/g, '')}T${hora.replace(':', '')}00`;
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');

function evento(o: { uid: string; titulo: string; ini: string; fim: string; rrule?: string; desc?: string; url?: string | null; alerta?: number }) {
  const L = ['BEGIN:VEVENT', `UID:${o.uid}@mentedaanny`, `DTSTAMP:${stamp}`, `DTSTART;TZID=America/Sao_Paulo:${o.ini}`, `DTEND;TZID=America/Sao_Paulo:${o.fim}`, `SUMMARY:${esc(o.titulo)}`];
  if (o.rrule) L.push(`RRULE:${o.rrule}`);
  if (o.desc || o.url) L.push(`DESCRIPTION:${esc([o.desc, o.url].filter(Boolean).join('\n'))}`);
  if (o.url) { L.push(`URL:${esc(o.url)}`); L.push(`LOCATION:${esc(o.url)}`); }
  if (o.alerta != null) L.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(o.titulo)}`, `TRIGGER:-PT${o.alerta}M`, 'END:VALARM');
  L.push('END:VEVENT');
  return L;
}

Deno.serve(async (req) => {
  const t = new URL(req.url).searchParams.get('t') ?? '';
  if (!/^[a-f0-9]{32,64}$/.test(t)) return new Response('Link inválido', { status: 404 });
  const { data: dono } = await sb.from('dados').select('user_id, valor').eq('chave', 'feed:' + t).maybeSingle();
  if (!dono?.valor) return new Response('Link inválido', { status: 404 });
  const uid = dono.user_id;

  const { data: comp } = await sb.from('dados').select('valor').eq('user_id', uid).eq('chave', 'compromissos').maybeSingle();
  const { data: tccs } = await sb.from('dados').select('chave, valor').eq('user_id', uid).like('chave', 'tcc:____-__-__');
  const { data: cfg } = await sb.from('dados').select('valor').eq('user_id', uid).eq('chave', 'config').maybeSingle();

  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mente da Anny//Feed//PT-BR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:Mente da Anny', 'X-WR-TIMEZONE:America/Sao_Paulo', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H',
    'BEGIN:VTIMEZONE', 'TZID:America/Sao_Paulo', 'BEGIN:STANDARD', 'DTSTART:19700101T000000', 'TZOFFSETFROM:-0300', 'TZOFFSETTO:-0300', 'TZNAME:-03', 'END:STANDARD', 'END:VTIMEZONE'];

  for (const c of (comp?.valor ?? []) as any[]) {
    if (!c?.data || !c?.ini) continue;
    const dia = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][new Date(c.data + 'T12:00:00').getDay()];
    L.push(...evento({ uid: 'comp-' + c.id, titulo: c.titulo, ini: dt(c.data, c.ini), fim: dt(c.data, c.fim || c.ini), rrule: c.semanal ? `FREQ=WEEKLY;BYDAY=${dia}` : undefined, desc: `Agenda: ${FONTE[c.fonte] ?? 'Pessoal'}`, url: c.link, alerta: 10 }));
  }
  for (const row of tccs ?? []) for (const b of (row.valor ?? []) as any[]) {
    const [h, m] = String(b.hora).split(':').map(Number); const f = h * 60 + m + 60;
    L.push(...evento({ uid: `${row.chave}-${b.id}`, titulo: 'TCC — bloco de 1h', ini: dt(b.data, b.hora), fim: dt(b.data, `${String(Math.floor(f / 60)).padStart(2, '0')}:${String(f % 60).padStart(2, '0')}`), desc: 'Agenda: Faculdade · 2 Pomodoros de 25 min', alerta: 5 }));
  }
  if (!(cfg?.valor as any)?.bebe) for (const r of TRABALHO_FIXO) {
    L.push(...evento({ uid: 'fixo-' + r.id, titulo: r.titulo, ini: `20261123T${r.ini}00`, fim: `20261123T${r.fim}00`, rrule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', desc: 'Agenda: Trabalho · rotina fixa', alerta: 0 }));
  }
  L.push('END:VCALENDAR');
  return new Response(L.map(dobrar).join('\r\n') + '\r\n', { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'no-cache, max-age=0' } });
});
