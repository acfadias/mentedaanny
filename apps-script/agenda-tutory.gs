// Mente da Anny — envia a agenda da Tutory para o app a cada 15 minutos.
// Cole em script.google.com (logada na conta da Tutory). Passo a passo em Ajustes → Agendas.

const URL_FUNCAO = 'https://xvlcbqyjzomzfnewuqpi.supabase.co/functions/v1/agenda-push';
const CODIGO = 'COLE_AQUI_O_CODIGO_DO_APP';

function enviarAgenda() {
  const ini = new Date(); ini.setDate(ini.getDate() - 8);
  const fim = new Date(); fim.setDate(fim.getDate() + 22);
  const eventos = [];
  let pageToken;
  do {
    const res = Calendar.Events.list('primary', { timeMin: ini.toISOString(), timeMax: fim.toISOString(), singleEvents: true, orderBy: 'startTime', maxResults: 250, pageToken: pageToken });
    for (const e of res.items || []) {
      if (e.status === 'cancelled' || e.eventType === 'workingLocation') continue;
      const eu = (e.attendees || []).find(a => a.self);
      if (eu && eu.responseStatus === 'declined') continue;
      const diaTodo = !!(e.start && e.start.date);
      const ini = diaTodo ? new Date(e.start.date + 'T00:00:00-03:00') : new Date(e.start.dateTime);
      const fim = diaTodo ? new Date(e.end.date + 'T00:00:00-03:00') : new Date(e.end.dateTime);
      const texto = [e.location, e.description].filter(Boolean).join(' ');
      const achado = texto.match(/https?:\/\/(?:[\w-]+\.)?(?:meet\.google\.com|zoom\.us|teams\.microsoft\.com)[^\s<>"')]*/i);
      eventos.push({ id: e.id, titulo: e.summary || '(sem título)', ini: ini.getTime(), fim: fim.getTime(), diaTodo: diaTodo, local: e.location || '', link: e.hangoutLink || (achado && achado[0]) || null });
    }
    pageToken = res.nextPageToken;
  } while (pageToken);

  const r = UrlFetchApp.fetch(URL_FUNCAO, { method: 'post', contentType: 'application/json', headers: { 'x-codigo': CODIGO }, payload: JSON.stringify({ fonte: 'trabalho', eventos: eventos }), muteHttpExceptions: true });
  Logger.log(r.getResponseCode() + ' ' + r.getContentText());
}

// Rode esta UMA vez: cria o envio automático a cada 15 minutos e já envia agora.
function instalar() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('enviarAgenda').timeBased().everyMinutes(15).create();
  enviarAgenda();
}
