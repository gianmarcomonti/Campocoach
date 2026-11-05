/* CampoCoach — app locale/offline, nessuna libreria o account richiesto. */
(() => {
  'use strict';
  const KEY = 'campocoach_data_v1';
  const TACTICS = window.CampoCoachTactics;
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const el = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const today = () => { const d = new Date(); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); return d.toISOString().slice(0,10); };
  const uid = () => (crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`);
  const defaultData = () => ({ version:9, players:[], attendance:{}, attendanceCertified:{}, sessions:[], matches:[] });
  const fmtDate = iso => {
    if (!iso) return '—';
    const d = new Date(`${iso}T12:00:00`);
    return Number.isNaN(+d) ? iso : d.toLocaleDateString('it-IT',{day:'numeric',month:'short',year:'numeric'});
  };
  const weekday = iso => {
    const d = new Date(`${iso}T12:00:00`);
    return Number.isNaN(+d) ? '' : d.toLocaleDateString('it-IT',{weekday:'long'});
  };
  const DATA_ROLES = {POR:'Portiere', DIF:'Difensore', CEN:'Centrocampista', ATT:'Attaccante'};
  const ROLE_ORDER = ['POR','DIF','CEN','ATT'];
  const POSITION_ORDER = ['POR','DC','TD','TS','MED','MEZ','TREQ','ED','ES','PUN','AD','AS'];
  const FORMATIONS = ['4-3-3','4-4-2','3-5-2','4-2-3-1','3-4-3','4-5-1','5-3-2'];
  const EVENTS = {gol:{title:'Gol',symbol:'⚽',short:'G'},assist:{title:'Assist',symbol:'🎯',short:'A'},autogol:{title:'Autogol',symbol:'🔴',short:'AG'},clean:{title:'Porta inviolata',symbol:'🧤',short:'CS'}};
  const DEMO = [
    ['Riccardo Moretti',1,'POR',4,'POR',''],['Davide Riva',12,'POR',3.5,'POR',''],
    ['Luca Bianchi',2,'DIF',4,'TS','DC'],['Marco Conti',3,'DIF',4,'DC',''],
    ['Stefano Greco',4,'DIF',3,'DC',''],['Andrea Costa',5,'DIF',3,'TD','DC'],
    ['Alessio Serra',6,'DIF',5,'DC',''],['Gabriele Neri',13,'DIF',2.5,'TD',''],
    ['Matteo Russo',8,'CEN',5,'MED','MEZ'],['Federico Villa',10,'CEN',4,'TREQ','MEZ'],
    ['Simone De Luca',14,'CEN',3,'MEZ','MED'],['Tommaso Romano',16,'CEN',3,'ES','AS'],
    ['Pietro Leone',18,'CEN',4,'ED','AD'],['Edoardo Ferri',20,'CEN',4,'MEZ','TREQ'],
    ['Nicolò Fontana',7,'ATT',5,'AS','PUN'],['Filippo Barbieri',9,'ATT',4,'PUN',''],
    ['Samuele Sala',11,'ATT',4,'AD','ED'],['Lorenzo Gallo',19,'ATT',3,'PUN','AD']
  ];

  function normalizeData(v){
    if(!v || !Array.isArray(v.players) || !Array.isArray(v.matches) || !Array.isArray(v.sessions) || !v.attendance || typeof v.attendance !== 'object' || Array.isArray(v.attendance)) return null;
    // Older saved versions registered attendance immediately. Treat those existing
    // entries as confirmed so an upgrade does not erase the coach's history.
    const legacy = !v.attendanceCertified || typeof v.attendanceCertified !== 'object' || Array.isArray(v.attendanceCertified);
    const certified = legacy
      ? Object.fromEntries(Object.entries(v.attendance).filter(([date,ids])=>Array.isArray(ids)).map(([date,ids])=>[date,{ids:[...new Set(ids)],confirmedAt:null,revision:1}]))
      : Object.fromEntries(Object.entries(v.attendanceCertified).filter(([date,record])=>record && Array.isArray(record.ids)).map(([date,record])=>[date,{ids:[...new Set(record.ids)],confirmedAt:record.confirmedAt||null,revision:Math.max(1,Number(record.revision)||1)}]));
    const validIds=new Set(v.players.filter(p=>!p.isDondo).map(p=>p.id));
    const matches=v.matches.map(m=>{
      const lineup=Array.from({length:11},(_,i)=>validIds.has(m.lineup?.[i])?m.lineup[i]:null);
      const previous=[...lineup,...(Array.isArray(m.benchIds)?m.benchIds:[]),...(m.events||[]).flatMap(e=>[e.playerId,e.assistId])];
      const rawCalled=Array.isArray(m.calledUpIds)?m.calledUpIds:previous;
      const calledUpIds=[...new Set(rawCalled.filter(id=>validIds.has(id)))];
      const confirmed=typeof m.callupsConfirmed==='boolean'?m.callupsConfirmed:calledUpIds.length>0;
      return {...m,lineup,calledUpIds,callupsConfirmed:confirmed,
        benchIds:calledUpIds.filter(id=>!lineup.includes(id))};
    });
    return {version:9,players:v.players.map(p=>TACTICS.normalizePlayer({...p,isDondo:p.isDondo===true,isFirstTeam:p.isFirstTeam===true})),attendance:v.attendance,attendanceCertified:certified,sessions:v.sessions,matches};
  }
  function load(){
    try {
      const data = normalizeData(JSON.parse(localStorage.getItem(KEY) || 'null'));
      if(data) return data;
    } catch(e){ console.warn('Archivio non leggibile',e); }
    return defaultData();
  }
  let state = load();
  let ui = { tab:'dashboard', date:today(), exercise:'partitella', teams:2, cap:0, extra:'jolly', includeGoalkeepers:true, defense:4, formation:'auto', current:null, selectedMatchId:null, editPlayerId:null, eventType:'gol', editingAttendance:false, editingMatchId:null, matchDraft:null, editingEventId:null, statsSort:{key:'trainings',dir:'desc'}, useDondo:false, dondoMode:'jolly', spondeCount:0 };
  const certifiedRecord = (date=ui.date) => state.attendanceCertified[date] || null;
  const certifiedIds = (date=ui.date) => (certifiedRecord(date)?.ids || []).filter(id=>!!person(id) && !person(id).isDondo);
  const isAttendanceEditable = () => !certifiedRecord() || ui.editingAttendance;
  const sameIds = (a,b) => a.length===b.length && a.every(id=>b.includes(id));
  // Save the migrated v1 register immediately, preserving previously tracked days.
  try { if(localStorage.getItem(KEY)) localStorage.setItem(KEY,JSON.stringify(state)); } catch(e){}
  let toastTimer;
  const person = id => state.players.find(p => p.id === id);
  const officialPlayers = () => state.players.filter(p=>!p.isDondo);
  const dondoPlayer = () => state.players.find(p=>p.isDondo) || null;
  const display = id => person(id)?.name || 'Giocatore non trovato';
  const orderPlayers = ps => [...ps].sort((a,b) => (ROLE_ORDER.indexOf(a.role)-ROLE_ORDER.indexOf(b.role)) || (a.number-b.number) || a.name.localeCompare(b.name));
  const save = () => { try {localStorage.setItem(KEY,JSON.stringify(state));return true;} catch(e){toast('Memoria piena: esporta un backup JSON');return false;} };
  function toast(text){
    const t=el('toast'); t.textContent=text; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove('show'),2900);
  }
  const pageHead=(tag,title,subtitle) => `<div class="page-heading"><div><div class="eyebrow">${tag}</div><h1>${title}</h1><p>${subtitle}</p></div></div>`;
  const optionsPositions = (selected='',allowBlank=false) => (allowBlank?'<option value="">Nessuno</option>':'') +
    Object.entries(TACTICS.GROUPS).map(([group,positions])=>`<optgroup label="${DATA_ROLES[group]}">${positions.map(pos=>`<option value="${pos}" ${selected===pos?'selected':''}>${TACTICS.POSITIONS[pos]}</option>`).join('')}</optgroup>`).join('');
  const positionName = (p) => TACTICS.POSITIONS[p?.primaryPosition] || DATA_ROLES[p?.role] || 'Ruolo non definito';
  const positionLine = (p) => `${positionName(p)}${p?.secondaryPosition?' · 2°: '+TACTICS.POSITIONS[p.secondaryPosition]:''}`;
  // Technical level accepts half-star increments; keep numeric values for team balancing.
  const ratingValue = value => Math.max(1,Math.min(5,Math.round((Number(value)||3)*2)/2));
  const ratingLabel = value => ratingValue(value).toLocaleString('it-IT',{minimumFractionDigits:1,maximumFractionDigits:1});
  function ratingStars(value,compact=false){
    const score=ratingValue(value);
    const units=Array.from({length:5},(_,i)=>{
      const part=score>=i+1?'full':score>=i+0.5?'half':'is-empty';
      return `<span class="rating-star ${part}" aria-hidden="true"></span>`;
    }).join('');
    return `<span class="rating-widget ${compact?'rating-compact':''}"><span class="rating-stars" role="img" aria-label="${ratingLabel(score)} stelle su 5">${units}</span><span class="rating-number">${ratingLabel(score)}/5</span></span>`;
  }
  const namedPlayer = p => `${esc(p.name)} <span class="hint">#${p.number} · ${p.role}</span>`;
  // Ogni modifica partita lavora su una COPIA temporanea. Lo storico viene aggiornato
  // solo quando il mister preme Salva modifiche.
  const persistedMatch = id => state.matches.find(m=>m.id===id);
  const editingMatch = () => !!(ui.matchDraft && ui.editingMatchId && ui.editingMatchId===ui.selectedMatchId);
  const matchById = () => {
    const stored=persistedMatch(ui.selectedMatchId) || state.matches[0];
    return stored && editingMatch() && stored.id===ui.editingMatchId ? ui.matchDraft : stored;
  };
  const saveMatchChange = () => editingMatch() ? true : save();
  function closeMatchEditor(ask=true){
    if(!ui.matchDraft)return true;
    const previous=persistedMatch(ui.editingMatchId);
    const dirty=previous && JSON.stringify(previous)!==JSON.stringify(ui.matchDraft);
    if(ask && dirty && !confirm('Hai modifiche alla partita non salvate. Vuoi annullarle?'))return false;
    ui.editingMatchId=null;
    ui.matchDraft=null;
    ui.editingEventId=null;
    return true;
  }
  function beginMatchEdit(id){
    if(!closeMatchEditor())return;
    const stored=persistedMatch(id);if(!stored)return;
    ui.selectedMatchId=stored.id;
    ui.matchDraft=JSON.parse(JSON.stringify(stored));
    ui.editingMatchId=stored.id;
    ui.editingEventId=null;
    renderMatches();
    toast('Modalità modifica attiva: salva alla fine');
  }
  function commitMatchEdit(){
    if(!editingMatch())return;
    const m=ui.matchDraft;
    // Leggi anche il campo su cui l'utente sta ancora scrivendo.
    const opponent=(el('matchOpponentEdit')?.value ?? m.opponent).trim();
    const date=el('matchDateEdit')?.value ?? m.date;
    const venue=el('matchVenueEdit')?.value ?? m.venue;
    if(!opponent || opponent.length>65 || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !['Casa','Trasferta'].includes(venue)){
      toast('Controlla avversario, data e campo');return;
    }
    m.opponent=opponent;m.date=date;m.venue=venue;
    cleanBench(m);
    const index=state.matches.findIndex(x=>x.id===m.id);
    if(index<0){toast('La partita non esiste più');closeMatchEditor(false);renderMatches();return;}
    const previous=state.matches[index];
    state.matches[index]=JSON.parse(JSON.stringify(m));
    if(!save()){state.matches[index]=previous;return;}
    closeMatchEditor(false);
    renderMatches();toast('Partita aggiornata e salvata ✓');
  }
  const presentIds = () => (state.attendance[ui.date] || []).filter(id=>!!person(id) && !person(id).isDondo);

  // Porta inviolata: il portiere DEVE occupare la maglia da portiere (slot 0)
  // e il risultato deve riportare zero gol subiti. I vecchi eventi manuali
  // senza risultato vengono conservati per compatibilità, mai duplicati.
  function hasCleanSheet(m,id){
    if(!person(id) || person(id).isDondo || person(id).primaryPosition!=='POR')return false;
    if(m.ga!==null && m.ga!==undefined && m.ga!=='')return Number(m.ga)===0 && m.lineup?.[0]===id;
    return (m.events||[]).some(e=>e.type==='clean' && e.playerId===id);
  }
  function playerMatchActions(id){
    const result=[];
    for(const m of state.matches){
      const events=[];
      for(const e of (m.events||[])){
        if(e.type==='gol' && e.playerId===id)events.push({type:'gol',minute:e.minute});
        if(e.type==='gol' && e.assistId===id)events.push({type:'assist',minute:e.minute});
        if(e.type==='assist' && e.playerId===id)events.push({type:'assist',minute:e.minute});
        if(e.type==='autogol' && e.playerId===id)events.push({type:'autogol',minute:e.minute});
      }
      if(hasCleanSheet(m,id))events.push({type:'clean',minute:null});
      if(events.length)result.push({match:m,events});
    }
    return result.sort((a,b)=>b.match.date.localeCompare(a.match.date));
  }
  function statsFor(id){
    if(person(id)?.isDondo)return {trainings:0,matches:0,gols:0,assists:0,ogs:0,cs:0};
    const trainings=Object.values(state.attendanceCertified).filter(v=>Array.isArray(v.ids) && v.ids.includes(id)).length;
    const matches=state.matches.filter(m=>m.lineup?.includes(id) || m.events?.some(e=>e.playerId===id || e.assistId===id)).length;
    let gols=0,assists=0,ogs=0,cs=0;
    for(const item of playerMatchActions(id))for(const action of item.events){
      if(action.type==='gol')gols++;
      if(action.type==='assist')assists++;
      if(action.type==='autogol')ogs++;
      if(action.type==='clean')cs++;
    }
    return {trainings,matches,gols,assists,ogs,cs};
  }
  const pOptions = (selected='',filter=null) => `<option value="">— Seleziona —</option>` + orderPlayers(officialPlayers().filter(p=>!filter||filter(p))).map(p=>`<option value="${esc(p.id)}" ${selected===p.id?'selected':''}>#${p.number} · ${esc(p.name)} (${p.primaryPosition||p.role})</option>`).join('');

  function openPlayerProfile(id){
    const p=person(id);if(!p || p.isDondo)return;
    const stats=statsFor(id);
    const days=Object.keys(state.attendanceCertified).sort((a,b)=>b.localeCompare(a));
    const trainedDays=days.filter(d=>certifiedIds(d).includes(id));
    const performances=playerMatchActions(id);
    el('modalTitle').textContent=`#${p.number} ${p.name}`;
    el('modalBody').innerHTML=`<div class="profile-sheet">
      <div class="profile-hero"><span class="profile-number">${p.number}</span><div><strong>${esc(p.name)}</strong><small>${esc(positionLine(p))}</small><div>${ratingStars(p.rating,true)}</div></div></div>
      <div class="profile-stats">
        <div><strong>${stats.matches}</strong><span>Partite</span></div><div><strong>${stats.trainings}</strong><span>Allen.</span></div>
        <div><strong>${stats.gols}</strong><span>⚽ Gol</span></div><div><strong>${stats.assists}</strong><span>🎯 Assist</span></div>
        <div><strong>${stats.ogs}</strong><span>Autogol</span></div><div><strong>${stats.cs}</strong><span>🧤 P. inv.</span></div>
      </div>
      <h4>Azioni decisive per avversario</h4>
      ${performances.length?performances.map(({match,events})=>`<div class="profile-performance"><div><strong>${esc(match.opponent)}</strong><small>${fmtDate(match.date)} · ${esc(match.venue||'Gara')} · ${score(match)}</small></div><div class="profile-actions">${events.map(e=>`<span class="profile-action">${EVENTS[e.type]?.symbol||'•'} ${EVENTS[e.type]?.title||esc(e.type)}${e.minute!==null&&e.minute!==undefined?` · ${e.minute}'`:''}</span>`).join('')}</div></div>`).join(''):'<p class="hint">Non ci sono ancora gol, assist o porte inviolate registrati per questo giocatore.</p>'}
      <h4>Allenamenti certificati</h4>
      ${trainedDays.length?`<p class="profile-training-days">${trainedDays.map(fmtDate).join(' · ')}</p>`:'<p class="hint">Nessun allenamento certificato.</p>'}
    </div>`;
    el('modal').hidden=false;document.body.style.overflow='hidden';
    el('modal').classList.add('profile-modal');
  }
  function renderDashboard(){
    const last=state.sessions[0], upcoming=[...state.matches].filter(m=>m.date>=today()).sort((a,b)=>a.date.localeCompare(b.date))[0];
    el('dashboard').innerHTML=`
      <div class="hero"><div class="eyebrow">IL TUO SPOGLIATOIO DIGITALE</div><h1>Più calcio.<br><em>Meno fogli sparsi.</em></h1><p>Convocazioni, presenze, squadre equilibrate e statistiche. Tutto a portata di mister.</p><button class="btn primary" data-go="training">Prepara l'allenamento →</button></div>
      <div class="metric-grid"><div class="metric"><div class="metric-num">${officialPlayers().length}</div><div class="metric-label">Giocatori in rosa</div></div><div class="metric"><div class="metric-num">${certifiedIds(today()).length}</div><div class="metric-label">Confermati oggi</div></div><div class="metric"><div class="metric-num">${state.matches.length}</div><div class="metric-label">Partite registrate</div></div></div>
      <div class="quick-actions" style="margin-bottom:16px"><button class="quick-card" data-go="roster"><span class="quick-icon">♙</span><strong>Gestisci la rosa</strong><small>Aggiungi giocatori, ruoli e livello.</small></button><button class="quick-card" data-go="matches"><span class="quick-icon">▦</span><strong>Prepara la gara</strong><small>Formazione sul campo ed eventi.</small></button></div>
      ${officialPlayers().length===0?`<div class="card"><div class="card-title"><h2>Inizia da qui</h2><span class="tag orange">Prima configurazione</span></div><p class="hint">Inserisci i tuoi giocatori oppure carica 18 nomi fittizi per provare subito l'app.</p><div class="button-row"><button class="btn primary" data-go="roster">Aggiungi giocatore</button><button class="btn secondary" data-action="demo">Prova con 18 giocatori</button></div></div>`:''}
      <div class="card"><div class="card-title"><h2>In evidenza</h2><span class="tag">La tua settimana</span></div><div class="stack"><div class="player-row"><div class="number-badge">◈</div><div class="person-info"><strong>Ultimo esercizio</strong><small>${last?`${esc(last.title)} · ${fmtDate(last.date)} · ${last.groups.length} squadre`:'Nessun esercizio salvato'}</small></div><button class="btn small secondary" data-go="training">Apri</button></div><div class="player-row"><div class="number-badge">▦</div><div class="person-info"><strong>Prossima partita</strong><small>${upcoming?`${fmtDate(upcoming.date)} · ${esc(upcoming.opponent)}`:'Nessuna partita futura in calendario'}</small></div><button class="btn small secondary" data-go="matches">Apri</button></div></div></div>`;
  }

  function renderRoster(){
    const editing = state.players.find(p=>p.id===ui.editPlayerId);
    const players = orderPlayers(state.players);
    el('roster').innerHTML=`
      ${pageHead('01 / LA TUA SQUADRA','Rosa giocatori','Per ogni giocatore scegli ruolo principale e ruolo secondario. Il sistema privilegia sempre il principale.')}
      <div class="two-col-desktop"><div class="card"><div class="card-title"><h2>${editing?'Modifica giocatore':'Nuovo giocatore'}</h2><span class="tag">${state.players.length} in rosa</span></div>
      <form id="playerForm" class="stack">
        <div class="form-group"><label for="pName">Nome e cognome</label><input id="pName" name="name" required maxlength="50" placeholder="Es. Mario Rossi" value="${esc(editing?.name||'')}"></div>
        <div class="form-group"><label for="pNum">Numero maglia</label><input id="pNum" name="number" type="number" min="0" max="99" required value="${editing?.number??''}" placeholder="10"></div>
        <div class="form-group"><label for="pPrimary">Ruolo principale (priorità massima)</label><select id="pPrimary" name="primaryPosition" required>${optionsPositions(editing?.primaryPosition||'MEZ')}</select></div>
        <div class="form-group"><label for="pSecondary">Ruolo secondario (facoltativo)</label><select id="pSecondary" name="secondaryPosition">${optionsPositions(editing?.secondaryPosition||'',true)}</select><div class="form-hint">Esempio: un terzino destro che può fare il centrale. Viene usato da centrale soltanto dopo i centrali di ruolo, ove possibile.</div></div>
        <div class="form-group"><label for="pRating">Valutazione tecnica (da 1 a 5, anche mezze stelle)</label><select id="pRating" name="rating">${Array.from({length:9},(_,i)=>1+i*0.5).map(v=>`<option value="${v}" ${v===ratingValue(editing?.rating??3)?'selected':''}>${ratingLabel(v)} stelle su 5</option>`).join('')}</select><div id="ratingPreview" class="rating-preview" aria-live="polite">${ratingStars(editing?.rating??3)}</div><div class="form-hint">Puoi scegliere anche 2,5, 3,5 o 4,5 stelle. Il valore serve per bilanciare il livello delle squadre, senza scavalcare il ruolo principale.</div></div>
        <label class="toggle-control" for="pIsFirstTeam"><input type="checkbox" id="pIsFirstTeam" ${editing?.isFirstTeam?'checked':''}><span><strong>Giocatore della prima squadra</strong><small>Le presenze reali restano nelle statistiche, ma non penalizzano la selezione per la partita: la regola 0/2 non si applica ai giocatori della Prima squadra. Puoi selezionarli rapidamente nelle convocazioni.</small></span></label>
        <label class="toggle-control" for="pIsDondo"><input type="checkbox" id="pIsDondo" ${editing?.isDondo?'checked':''}><span><strong>Questo giocatore è il Jolly Dondo</strong><small>Lo userai solo per completare le partitelle o come sponda nei possessi. Non entra in presenze, partite e statistiche ufficiali.</small></span></label>
        <div class="button-row"><button class="btn primary" type="submit">${editing?'Salva modifiche':'Aggiungi in rosa'}</button>${editing?'<button type="button" class="btn secondary" data-action="cancel-edit">Annulla</button>':''}</div>
      </form></div>
      <div class="card"><div class="card-title"><h2>Elenco giocatori</h2><span class="tag">${players.length}</span></div>${players.length?`<div class="player-list">${players.map(p=>`<div class="player-row"><div class="number-badge">${p.number}</div><div class="person-info"><strong>${esc(p.name)}${p.isDondo?' <span class="tag orange">JOLLY DONDO</span>':''}${p.isFirstTeam?' <span class="tag">PRIMA SQUADRA</span>':''}</strong><small>${esc(positionLine(p))}</small><div class="rating-in-list">${ratingStars(p.rating)}</div></div><div class="player-actions"><button type="button" class="icon-btn" aria-label="Modifica ${esc(p.name)}" data-action="edit-player" data-id="${esc(p.id)}">✎</button><button type="button" class="icon-btn" aria-label="Elimina ${esc(p.name)}" data-action="delete-player" data-id="${esc(p.id)}">✕</button></div></div>`).join('')}</div>`:`<div class="empty"><span class="empty-icon">⚽</span>La rosa è vuota. Inserisci il primo giocatore o usa la demo.</div><button class="btn secondary full" style="margin-top:12px" data-action="demo">Carica 18 giocatori di esempio</button>`}</div></div>
      <div class="card"><div class="card-title"><h2>Backup e trasferimento dati</h2><span class="tag orange">Solo su questo dispositivo</span></div><p class="hint">I dati sono salvati nel browser di questo telefono. Esporta una copia JSON: puoi importarla su un altro telefono o dopo aver reinstallato l'app.</p><div class="button-row"><button class="btn secondary" data-action="export">↓ Esporta backup</button><button class="btn ghost" data-action="choose-import">↑ Importa backup</button></div><input id="importInput" type="file" accept=".json,application/json" hidden><div class="warning-note" style="margin-top:14px">Non usare la cancellazione dei dati del browser senza prima aver esportato un backup. In questa versione non esiste sincronizzazione cloud.</div></div>`;
  }

  function recentRestCounts(){
    const count = Object.fromEntries(state.players.map(p=>[p.id,0]));
    for(const s of state.sessions||[])for(const id of s.bench||[]) if(id in count) count[id]++;
    return count;
  }
  // Dondo does not need a certified attendance and never changes official stats.
  // For possession exercises, sponde are removed from the team pool first.
  function trainingSelection(){
    const base=certifiedIds().filter(id=>ui.includeGoalkeepers || person(id)?.primaryPosition!=='POR');
    const dondo=ui.useDondo?dondoPlayer():null;
    const sponde=[];
    const selected=new Set();
    const requested=ui.exercise==='possesso'?Math.max(0,Math.min(12,Number(ui.spondeCount)||0)):0;
    if(requested>0 && dondo && ui.dondoMode==='jolly' && (ui.includeGoalkeepers||dondo.primaryPosition!=='POR')){
      sponde.push(dondo.id);selected.add(dondo.id);
    }
    // Prefer midfielders/attackers as possession-support players; keep keepers on the field.
    const candidates=base.filter(id=>person(id)?.primaryPosition!=='POR').sort((a,b)=>{
      const x=person(a),y=person(b);
      const rank=p=>p.role==='CEN'?0:p.role==='ATT'?1:2;
      return rank(x)-rank(y) || (Number(y.rating)||3)-(Number(x.rating)||3) || x.name.localeCompare(y.name);
    });
    for(const id of candidates){if(sponde.length>=requested)break;if(!selected.has(id)){sponde.push(id);selected.add(id);}}
    if(sponde.length<requested)return {teamIds:[],sponde,error:'Non ci sono abbastanza giocatori di movimento per tutte le sponde richieste.'};
    const teamIds=base.filter(id=>!selected.has(id));
    if(dondo && ui.dondoMode==='squadre' && (ui.includeGoalkeepers||dondo.primaryPosition!=='POR'))teamIds.push(dondo.id);
    return {teamIds,sponde,dondoJoker:dondo && ui.dondoMode==='jolly' && !selected.has(dondo.id)?dondo.id:null};
  }
  function generateGroups(){
    if(!certifiedRecord() || ui.editingAttendance){toast('Prima certifica le presenze');return;}
    if(ui.useDondo && !dondoPlayer()){toast('Registra prima il Jolly Dondo nella Rosa');return;}
    const ids=certifiedIds();
    const pool=trainingSelection();
    if(pool.error){toast(pool.error);return;}
    const selection=TACTICS.distributeTraining(pool.teamIds,state.players,{
      teams:ui.teams,cap:ui.cap,extra:ui.extra,defense:ui.defense,formation:ui.formation,
      includeGoalkeepers:ui.includeGoalkeepers,restCounts:recentRestCounts()
    });
    if(selection.error){toast(selection.error);return;}
    ui.current={date:ui.date,title:ui.exercise,groups:selection.groups,
      slotsByGroup:selection.slotsByGroup,joker:selection.joker,bench:selection.bench,
      present:ids.slice(),cap:ui.cap,extra:ui.extra,includeGoalkeepers:ui.includeGoalkeepers,
      defense:ui.defense,formation:selection.formation,goalkeeperSeats:selection.goalkeeperSeats,outfieldSize:selection.outfieldSize,
      sponde:pool.sponde, dondoJoker:pool.dondoJoker, useDondo:ui.useDondo, dondoMode:ui.dondoMode,
      createdAt:Date.now()};
    renderTraining();toast('Squadre e sponde generate!');
  }
  function renderTrainingTeam(c,i){
    const group=c.groups[i]||[];
    const name=String.fromCharCode(65+i);
    const assigned=c.slotsByGroup?.[i] || group.map(id=>({id,key:person(id)?.primaryPosition,label:person(id)?.primaryPosition,row:'CEN'}));
    const sections=[['ATT','ATTACCO'],['CEN','CENTROCAMPO'],['DIF','DIFESA'],['POR','PORTIERE']];
    const rowFor=slot=>slot.row || (slot.key==='POR'?'POR':['DC','TS','TD','BRS','BRD'].includes(slot.key)?'DIF':['PUN','AD','AS'].includes(slot.key)?'ATT':'CEN');
    return `<div class="team ${i%2?'team-b':''}">
      <div class="team-title"><strong>Squadra ${name}</strong><span class="team-score">${group.reduce((a,id)=>a+(person(id)?.rating||0),0)} pt</span></div>
      <div class="training-mini-pitch" aria-label="Modulo ${esc(c.formation||'libero')} della squadra ${name}">
      ${sections.map(([row,title])=>{
        const slots=assigned.filter(slot=>rowFor(slot)===row);
        if(!slots.length)return '';
        return `<div class="tactic-line"><div class="tactic-line-title">${title}</div><div class="tactic-players">${slots.map(slot=>{
          const p=person(slot.id);
          return `<div class="tactic-player"><span class="tactic-shirt ${row==='POR'?'keeper':''}">${p?.number??'?'}</span><strong>${esc(p?.name||'—')}</strong><small>${esc(slot.label||slot.key||'—')}</small><span class="tactic-quality">${p?TACTICS.preferredQuality(p,slot.key):'Vuoto'}</span></div>`;
        }).join('')}</div></div>`;
      }).join('')}
      </div></div>`;
  }
  function renderTraining(){
    const confirmed=certifiedRecord();
    const editable=isAttendanceEditable();
    const present=new Set(editable?presentIds():certifiedIds());
    const players=orderPlayers(officialPlayers());
    const c=ui.current && ui.current.date===ui.date && confirmed && !ui.editingAttendance ? ui.current : null;
    const labels={partitella:'Partitella',possesso:'Possesso palla',rondo:'Rondo / stazioni',personalizzato:'Personalizzato'};
    const certifiedDates=Object.keys(state.attendanceCertified).sort((a,b)=>b.localeCompare(a));
    const trainingDates=[...new Set([...Object.keys(state.attendance),...certifiedDates,...state.sessions.map(s=>s.date)])].filter(Boolean).sort((a,b)=>b.localeCompare(a));
    const canGenerate=!!confirmed && !ui.editingAttendance;
    const pool=trainingSelection();
    const eligible=pool.teamIds||[];
    const plan=TACTICS.trainingPlan(eligible,state.players,{teams:ui.teams,cap:ui.cap,includeGoalkeepers:ui.includeGoalkeepers});
    const formationOptions=TACTICS.trainingFormationsFor(plan.outfieldSize,ui.defense);
    const shownFormation=formationOptions.includes(ui.formation)?ui.formation:'auto';
    const suggestedFormation=formationOptions[0]||'assetto libero';
    const status=ui.editingAttendance?'MODIFICA IN CORSO':confirmed?'PRESENZE CERTIFICATE':'BOZZA DA CERTIFICARE';
    const statusColor=ui.editingAttendance?'orange':confirmed?'':'orange';
    el('training').innerHTML=`
      ${pageHead('02 / ALLENAMENTI','Presenze & squadre','1. Segna i presenti, 2. certifica, 3. genera le squadre. Puoi correggere le presenze in seguito.')}
      <div class="train-flow"><div class="train-step ${confirmed&&!ui.editingAttendance?'done':'active'}"><span>1</span><strong>Presenze</strong><small>${confirmed&&!ui.editingAttendance?'Confermate':'Da confermare'}</small></div><div class="train-step ${canGenerate?'active':'waiting'}"><span>2</span><strong>Squadre</strong><small>${canGenerate?'Pronte da generare':'In attesa'}</small></div><div class="train-step ${canGenerate?'active':'waiting'}"><span>3</span><strong>Salva</strong><small>Esercizio</small></div></div>
      <div class="two-col-desktop"><div class="card"><div class="card-title"><h2>1 · Presenze allenamento</h2><span class="tag ${statusColor}">${status}</span></div>
      <div class="form-group"><label for="trainingDate">Data allenamento</label><input type="date" id="trainingDate" value="${esc(ui.date)}"></div>
      <div class="statusline"><div class="train-counter"><span class="present-count">${present.size}</span><span class="hint">${confirmed&&!ui.editingAttendance?'confermati':'selezionati'} su ${players.length}</span></div><span class="tag">${Math.round(present.size/Math.max(1,players.length)*100)}%</span></div>
      ${confirmed&&!ui.editingAttendance?`<div class="cert-note"><strong>Presenze certificate</strong><span>La lista e' bloccata. Usa Modifica presenze per correggere errori e certificare di nuovo: le statistiche verranno aggiornate.</span></div>`:`<div class="draft-note">${ui.editingAttendance?'Stai correggendo le presenze. Le statistiche rimangono ferme alla conferma precedente finche non ricertifichi.':'Spunta chi partecipa. Fino alla certificazione nessuna presenza entra nelle statistiche e non puoi formare le squadre.'}</div>`}
      ${editable?`<div class="button-row" style="margin-bottom:14px"><button class="btn small secondary" data-action="all-present">Seleziona tutti</button><button class="btn small secondary" data-action="none-present">Deseleziona tutti</button></div>`:''}
      ${players.length?`<div class="player-list">${players.map(p=>`<label class="player-row attendance-row ${present.has(p.id)?'checked':''} ${!editable?'locked':''}" style="margin:0" for="att-${esc(p.id)}"><input id="att-${esc(p.id)}" type="checkbox" data-att-id="${esc(p.id)}" ${present.has(p.id)?'checked':''} ${!editable?'disabled':''}><div class="number-badge">${p.number}</div><div class="person-info"><strong>${esc(p.name)}</strong><small>${esc(p.primaryPosition||p.role)}${p.secondaryPosition?' / '+esc(p.secondaryPosition):''}</small><div class="rating-in-list">${ratingStars(p.rating,true)}</div></div></label>`).join('')}</div>`:'<div class="empty">Prima aggiungi i giocatori alla rosa.</div>'}
      <div class="attendance-actions">${confirmed&&!ui.editingAttendance?`<button class="btn secondary full" data-action="edit-attendance">Modifica presenze</button>`:`<button class="btn primary full" data-action="certify-attendance" ${players.length===0?'disabled':''}>${confirmed?'Conferma le correzioni':'Certifica presenze'}</button>${ui.editingAttendance?'<button class="btn ghost full" data-action="cancel-attendance-edit">Annulla modifiche</button>':''}`}${hasTrainingDate(ui.date)?`<button type="button" class="btn danger full" data-action="delete-training" data-date="${esc(ui.date)}">Elimina allenamento del ${fmtDate(ui.date)}</button>`:''}</div>
      </div>
      <div class="card"><div class="card-title"><h2>2 · Crea le squadre</h2><span class="tag ${canGenerate?'':'orange'}">${canGenerate?`${eligible.length} disponibili`:'Prima certifica'}</span></div>
      ${!canGenerate?`<div class="training-gate"><div class="gate-icon">&#10003;</div><strong>Conferma prima le presenze</strong><p>Solo i giocatori certificati per il ${fmtDate(ui.date)} saranno utilizzati nella generazione delle squadre.</p></div>`:`<div class="stack"><div class="form-group"><label for="exercise">Esercizio</label><select id="exercise"><option value="partitella" ${ui.exercise==='partitella'?'selected':''}>Partitella / gara</option><option value="possesso" ${ui.exercise==='possesso'?'selected':''}>Possesso (3 gruppi)</option><option value="rondo" ${ui.exercise==='rondo'?'selected':''}>Rondo / stazioni (4 gruppi)</option><option value="personalizzato" ${ui.exercise==='personalizzato'?'selected':''}>Personalizzato</option></select></div>
      <div class="two-col"><div class="form-group"><label for="teamCount">Numero squadre</label><select id="teamCount">${[2,3,4].map(v=>`<option value="${v}" ${ui.teams===v?'selected':''}>${v} squadre</option>`).join('')}</select></div><div class="form-group"><label for="teamCap">Max giocatori/squadra</label><input id="teamCap" type="number" min="0" max="30" value="${ui.cap}" placeholder="0"></div></div>
      <div class="form-hint">0 = dividi tutti i giocatori disponibili. Esempio: 18 = 9 contro 9; 17 = 8 contro 8 con jolly o riserva, quando non si escludono portieri.</div>
      <label class="toggle-control" for="includeGoalkeepers"><input type="checkbox" id="includeGoalkeepers" ${ui.includeGoalkeepers?'checked':''}><span><strong>Includi i portieri</strong><small>Disattiva per escludere tutti i portieri dalla creazione delle squadre, ma non dalle presenze certificate.</small></span></label>
      <div class="formation-settings"><strong>Jolly Dondo</strong>
      <label class="toggle-control" for="useDondo"><input type="checkbox" id="useDondo" ${ui.useDondo?'checked':''} ${dondoPlayer()?'':'disabled'}><span><strong>Attiva Jolly Dondo</strong><small>${dondoPlayer()?`${esc(dondoPlayer().name)} · ${esc(positionName(dondoPlayer()))} · ${ratingLabel(dondoPlayer().rating)} stelle. Non conta nelle statistiche.`:'Prima registra un giocatore come “Jolly Dondo” nella sezione Rosa.'}</small></span></label>
      ${ui.useDondo && dondoPlayer()?`<div class="form-group"><label for="dondoMode">Utilizzo di Dondo</label><select id="dondoMode"><option value="jolly" ${ui.dondoMode==='jolly'?'selected':''}>Jolly neutrale (o sponda nel possesso)</option><option value="squadre" ${ui.dondoMode==='squadre'?'selected':''}>Giocatore aggiuntivo per completare le squadre</option></select><div class="form-hint">Esempio: 17 presenti + Dondo nelle squadre = 9 contro 9. Con 16 presenti + Dondo jolly = 8 contro 8 più jolly.</div></div>`:''}
      ${ui.exercise==='possesso'?`<div class="form-group"><label for="spondeCount">Numero di sponde nel possesso</label><input id="spondeCount" type="number" min="0" max="12" value="${ui.spondeCount}"><div class="form-hint">Le sponde sono scelte fra i presenti certificati e mostrate a parte. Se Dondo è attivo come jolly, diventa la prima sponda.</div></div>`:''}
      ${pool.error?`<p class="warning-note">${esc(pool.error)}</p>`:''}</div>
      <div class="formation-settings"><strong>Modulo tattico per ogni squadra</strong>
      <p class="hint">${plan.size>0?`Con ${eligible.length} disponibili: <b>${plan.size} giocatori per squadra</b> (${plan.outfieldSize} di movimento${plan.keeperSeats?' + 1 portiere':''}).`:'Seleziona i giocatori per conoscere i moduli disponibili.'} I numeri del modulo <b>non comprendono il portiere</b>.</p>${plan.keeperSeats && plan.keeperCount<plan.numberOfTeams?`<p class="warning-note">Attenzione: ci sono solo ${plan.keeperCount} portieri certificati per ${plan.numberOfTeams} squadre. Potrebbe essere adattato un giocatore di movimento in porta.</p>`:''}
      <div class="form-group"><label for="defenseStyle">Linea difensiva</label><select id="defenseStyle"><option value="4" ${ui.defense===4?'selected':''}>Difesa a 4 · terzino SX, 2 centrali, terzino DX</option><option value="3" ${ui.defense===3?'selected':''}>Difesa a 3 · braccetto SX, centrale, braccetto DX</option></select></div>
      <div class="form-group"><label for="trainingFormation">Modulo delle squadre</label><select id="trainingFormation"><option value="auto" ${shownFormation==='auto'?'selected':''}>Automatico (${suggestedFormation})</option>${formationOptions.map(name=>`<option value="${name}" ${shownFormation===name?'selected':''}>${name} · ${name.split('-').join(' + ')}</option>`).join('')}</select>
      <div class="form-hint">${formationOptions.length?`Puoi scegliere ${formationOptions.join(' oppure ')}. Le due squadre useranno lo stesso modulo.`:`Per ${plan.outfieldSize} giocatori di movimento non è disponibile un modulo predefinito con difesa a ${ui.defense}: verrà usata una distribuzione adattata.`} Un difensore centrale di ruolo viene preferito a un terzino adattato; i ruoli secondari si usano quando necessario.</div></div>
      </div>
      <div class="form-group"><label for="extra">Come gestire i giocatori in piu'?</label><select id="extra"><option value="jolly" ${ui.extra==='jolly'?'selected':''}>Jolly (se ci sono 2 squadre)</option><option value="riposo" ${ui.extra==='riposo'?'selected':''}>Turno di riposo / riserva</option></select></div>
      <button class="btn primary full" data-action="generate" ${eligible.length<Math.max(2,ui.teams)*2?'disabled':''}>Genera squadre con il modulo</button></div>
      <p class="hint">Il generatore usa esclusivamente i confermati disponibili, dà priorità ai ruoli principali e poi ai secondari, e cerca di bilanciare il livello. Puoi sempre scambiare giocatori a mano.</p>`}</div></div>
      ${c?`<div class="card" id="generated"><div class="card-title"><h2>Squadre generate</h2><span class="tag">${c.groups.map(g=>g.length).join(' vs ')}</span></div><p class="hint" style="margin:0 0 14px"><strong>Modulo ${esc(c.formation||'libero')}</strong> · Difesa a ${c.defense||4} · ${c.outfieldSize??'—'} giocatori di movimento ${c.goalkeeperSeats?'+ portiere per squadra':''} · Portieri ${c.includeGoalkeepers===false?'esclusi':'inclusi'}.</p><div class="teams-grid">${c.groups.map((g,i)=>renderTrainingTeam(c,i)).join('')}</div>
       ${c.sponde?.length?`<div class="sponde-preview"><div class="sponde-heading"><span>◉ SPONDE DEL POSSESSO</span><strong>${c.sponde.length} spond${c.sponde.length===1?'a':'e'}</strong></div><div class="sponde-players">${c.sponde.map(id=>{const p=person(id);return `<div class="sponda-chip"><span class="sponda-number">${p?.number??'?'}</span><div><strong>${esc(p?.name||'Giocatore')}</strong><small>${esc(positionName(p))}${p?.isDondo?' · Jolly Dondo':''}</small></div></div>`;}).join('')}</div></div>`:''}
       <div class="special-list">${c.dondoJoker?`<div class="special"><strong>JOLLY DONDO:</strong> ${esc(display(c.dondoJoker))} · fuori dalle squadre, non contabilizzato</div>`:''}${c.joker?`<div class="special"><strong>JOLLY:</strong> ${esc(display(c.joker))} · gioca con entrambe le squadre</div>`:''}${c.bench.length?`<div class="special"><strong>A RIPOSO:</strong> ${c.bench.map(id=>esc(display(id))).join(', ')}</div>`:''}</div><p class="hint">Puoi rigenerare le squadre o scambiare due giocatori.</p><div class="two-col"><div class="form-group"><label for="swapA">Primo giocatore</label><select id="swapA">${c.groups.flat().map(id=>`<option value="${esc(id)}">${esc(display(id))}</option>`).join('')}</select></div><div class="form-group"><label for="swapB">Secondo giocatore</label><select id="swapB">${c.groups.flat().slice().reverse().map(id=>`<option value="${esc(id)}">${esc(display(id))}</option>`).join('')}</select></div></div><div class="button-row" style="margin-top:12px"><button class="btn secondary" data-action="swap">Scambia</button><button class="btn primary" data-action="save-session">Salva esercizio</button></div></div>`:''}
      <div class="card"><div class="card-title"><h2>Storico esercizi</h2><span class="tag">${state.sessions.length} salvati</span></div>${state.sessions.length?state.sessions.slice(0,12).map(s=>`<div class="session"><div><strong>${esc(labels[s.title]||s.title||'Esercizio')} · ${s.groups.map(g=>g.length).join(' vs ')}${s.formation?' · '+esc(s.formation):''}${s.sponde?.length?' · '+s.sponde.length+' sponde':''}${s.useDondo?' · Dondo':''}</strong><small>${fmtDate(s.date)} · ${s.present.length} presenti ${s.needsReview?'<span class="text-warn">· Presenze modificate: da rigenerare</span>':''}</small></div><div class="record-actions"><button class="btn small secondary" data-action="load-session" data-id="${esc(s.id)}">${s.needsReview?'Rigenera':'Vedi'}</button><button class="btn small danger" data-action="delete-session" data-id="${esc(s.id)}" aria-label="Elimina esercizio ${esc(labels[s.title]||s.title||'salvato')} del ${fmtDate(s.date)}">Elimina</button></div></div>`).join(''):'<div class="empty">Qui troverai le squadre salvate allenamento per allenamento.</div>'}</div>
      <div class="card"><div class="card-title"><h2>Registro allenamenti</h2><span class="tag">${certifiedDates.length} certificati</span></div>${trainingDates.length?trainingDates.slice(0,20).map(d=>`<div class="session"><div><strong>${fmtDate(d)}</strong><small>${certifiedRecord(d)?`${certifiedIds(d).length} presenti certificati`:'Bozza non certificata'} · ${state.sessions.filter(s=>s.date===d).length} esercizi salvati</small></div><div class="record-actions"><button class="btn small secondary" data-action="open-training" data-date="${esc(d)}">Apri / correggi</button><button class="btn small danger" data-action="delete-training" data-date="${esc(d)}" aria-label="Elimina allenamento del ${fmtDate(d)}">Elimina</button></div></div>`).join(''):'<div class="empty">Il registro sara visibile dopo il primo allenamento registrato.</div>'}<p class="hint">Eliminando una data vengono rimosse le presenze e tutti gli esercizi salvati di quel giorno.</p></div>`;
  }

  const formationSlots=formation=>TACTICS.matchSlots(formation);
  const certifiedDatesNewest=()=>Object.keys(state.attendanceCertified).sort((a,b)=>b.localeCompare(a));
  const metricsForMatch=m=>TACTICS.matchFormMetrics(m.date,state.players,state.attendanceCertified,state.matches.filter(x=>x.id!==m.id));
  // The coach must confirm the call-ups before generating an official line-up.
  // The first-team label exempts players from attendance-based penalties.
  function autoLineup(m){
    if(!m.callupsConfirmed || !(m.calledUpIds||[]).length)return Array(11).fill(null);
    const metrics=metricsForMatch(m);
    const players=m.calledUpIds.map(person).filter(p=>p&&!p.isDondo);
    const scores=Object.fromEntries(Object.entries(metrics.byId).map(([id,value])=>[id,value.formScore]));
    // With at least two certified training sessions in the week, prefer a
    // player who attended to an equally suited player with 0 attendances.
    // No blanket exclusion: allow 0/2 when no comparable role cover exists.
    return TACTICS.makeMatchLineup(m.formation,players,scores,{
      weekTrainings:metrics.weekDates.length,
      byId:metrics.byId
    });
  }
  function updateCallups(m,proposed){
    const next=[...new Set(proposed.filter(id=>person(id)&&!person(id).isDondo))];
    const previous=m.calledUpIds||[];
    if(sameIds(next,previous))return true;
    const removed=previous.filter(id=>!next.includes(id));
    const starters=removed.filter(id=>(m.lineup||[]).includes(id));
    const eventPeople=removed.filter(id=>(m.events||[]).some(e=>e.playerId===id||e.assistId===id));
    if((starters.length||eventPeople.length) && !confirm(`Stai togliendo ${removed.length} giocatori dai convocati, fra cui ${starters.length} titolari. Verranno tolti dalla formazione e dalla panchina.${eventPeople.length?' Verranno rimossi anche gli eventi (gol/assist) dei giocatori esclusi.':''} Continuare?`))return false;
    m.calledUpIds=next;
    m.callupsConfirmed=false;
    m.lineup=(m.lineup||Array(11).fill(null)).map(id=>next.includes(id)?id:null);
    if(eventPeople.length){
      const out=new Set(removed);
      m.events=(m.events||[]).filter(e=>!out.has(e.playerId)).map(e=>({...e,assistId:out.has(e.assistId)?null:e.assistId}));
    }
    cleanBench(m);
    saveMatchChange();
    return true;
  }
  function formSummary(p,m,metrics=metricsForMatch(m)){
    const v=metrics.byId[p.id]||{trainings:0,trainingsTotal:0,goals:0,assists:0,formScore:0};
    return `${p.isFirstTeam?'Prima squadra · ':`${v.trainings}/${v.trainingsTotal} allenamenti · `}⚽ ${v.goals} · 🎯 ${v.assists} · Forma ${Math.round(v.formScore)}/100`;
  }
  function cleanBench(m){
    m.calledUpIds=[...new Set((m.calledUpIds||[]).filter(id=>person(id)&&!person(id).isDondo))];
    const permitted=new Set(m.calledUpIds);
    m.lineup=(m.lineup||Array(11).fill(null)).map(id=>permitted.has(id)?id:null);
    const starting=new Set(m.lineup.filter(Boolean));
    m.benchIds=m.calledUpIds.filter(id=>!starting.has(id));
  }
  function renderPitch(m,editable=false){
    const slots=formationSlots(m.formation);
    return `<div class="pitch" aria-label="Campo da calcio con formazione ${esc(m.formation)}"><div class="pitch-midline"></div><div class="pitch-circle"></div><div class="pitch-box top"></div><div class="pitch-box bottom"></div>${slots.map((s,i)=>{
      const p=person(m.lineup?.[i]);
      return `<button type="button" class="pitch-slot" style="left:${s.x}%;top:${s.y}%" data-action="assign-slot" data-index="${i}" ${editable?'':'disabled'} aria-label="${esc(s.role)}: ${esc(p?.name||'seleziona giocatore')}"><span class="pitch-shirt ${s.role==='POR'?'keeper':''} ${!p?'empty-shirt':''}">${p?p.number:'+'}</span><span class="pitch-name">${p?esc(p.name.split(' ').slice(-1)[0]):s.role+' +'}</span></button>`;
    }).join('')}</div>`;
  }
  const score = m => `${m.gf??'–'} : ${m.ga??'–'}`;
  function renderMatchDetail(m){
    cleanBench(m);
    const editing=editingMatch();
    const lined=m.lineup.filter(Boolean);
    const metrics=metricsForMatch(m);
    const callups=orderPlayers(officialPlayers()).sort((a,b)=>Number(b.isFirstTeam)-Number(a.isFirstTeam));
    const selected=callups.filter(p=>m.calledUpIds.includes(p.id));
    const selectedBench=selected.filter(p=>!lined.includes(p.id));
    const fromMatch=m.events||[];
    const currentEvent=editing ? fromMatch.find(e=>e.id===ui.editingEventId) : null;
    const weekDetail=metrics.weekDates.length?metrics.weekDates.map(fmtDate).join(' · '):'Nessun allenamento certificato prima della partita';
    const controls=editing?`<div class="match-edit-banner" role="status"><div><strong>✎ Stai modificando questa partita</strong><small>Convocati, formazione, panchina e tabellino saranno salvati insieme.</small></div><div class="match-edit-buttons"><button type="button" class="btn primary" data-action="save-match-edit">✓ Salva modifiche</button><button type="button" class="btn secondary" data-action="cancel-match-edit">Annulla</button></div></div>`:
      `<div class="match-view-banner"><div><strong>Partita salvata</strong><small>Puoi modificare convocati e formazione quando vuoi.</small></div><button type="button" class="btn primary" data-action="edit-match" data-id="${esc(m.id)}">✎ Modifica partita</button></div>`;
    const details=editing?`<div class="form-group" style="margin-bottom:12px"><label for="matchOpponentEdit">Avversario</label><input id="matchOpponentEdit" maxlength="65" required value="${esc(m.opponent)}" placeholder="Nome avversario"></div>
      <div class="two-col"><div><label for="matchDateEdit">Data della partita</label><input type="date" id="matchDateEdit" value="${esc(m.date)}" required></div><div><label for="matchVenueEdit">Campo</label><select id="matchVenueEdit"><option value="Casa" ${m.venue==='Casa'?'selected':''}>Casa</option><option value="Trasferta" ${m.venue==='Trasferta'?'selected':''}>Trasferta</option></select></div></div>
      `:
      `<div class="match-info-strip"><span>📅 ${fmtDate(m.date)} · ${weekday(m.date)}</span><span>📍 ${esc(m.venue)}</span><span>⚽ ${esc(m.formation)}</span></div>`;
    const callupsBlock=editing?`<div class="match-step"><span class="match-step-num">1</span><div><strong>Convocati della partita</strong><small>Seleziona prima i giocatori disponibili, poi conferma. Solo loro potranno diventare titolari o riserve.</small></div><span class="tag">${selected.length} convocati</span></div>
      <div class="button-row callups-actions"><button type="button" class="btn secondary small" data-action="callup-all">Convoca tutti</button><button type="button" class="btn secondary small" data-action="callup-first">Solo Prima squadra</button><button type="button" class="btn ghost small" data-action="callup-none">Svuota</button></div>
      <div class="callups-chooser">${callups.length?callups.map(p=>`<label class="callup-select ${m.calledUpIds.includes(p.id)?'is-selected':''}"><input type="checkbox" data-callup-id="${esc(p.id)}" ${m.calledUpIds.includes(p.id)?'checked':''}><span class="callup-details"><strong>#${p.number} ${esc(p.name)} ${p.isFirstTeam?'<span class="tag">PRIMA SQUADRA</span>':''}</strong><small>${esc(positionLine(p))} · ${ratingLabel(p.rating)} ★ · ${esc(formSummary(p,m,metrics))}</small></span></label>`).join(''):'<p class="hint">Inserisci prima i giocatori nella Rosa.</p>'}</div>
      <div class="callups-confirm"><div><strong>${m.callupsConfirmed?'✓ Convocati confermati':'Convocati da confermare'}</strong><small>${selected.length} selezionati · ${selected.length>=11?'numero sufficiente per 11 titolari':'meno di 11 giocatori, la formazione potrà essere incompleta'}. Per la Prima squadra le presenze non penalizzano la scelta dei titolari (regola 0/2 esclusa).</small></div><button class="btn ${m.callupsConfirmed?'secondary':'primary'}" data-action="confirm-callups" ${selected.length?'':'disabled'}>${m.callupsConfirmed?'✓ Confermati':'Conferma convocati →'}</button></div>`:
      `<div class="match-step"><span class="match-step-num">1</span><div><strong>Convocati</strong><small>${selected.length} selezionati per questa gara</small></div><span class="tag">${m.callupsConfirmed?'Confermati':'Da confermare'}</span></div><div class="callups-summary">${selected.length?selected.map(p=>`<span class="bench-chip">#${p.number} ${esc(p.name)}${p.isFirstTeam?' · Prima squadra':''}</span>`).join(''):'Nessun convocato'}</div>`;
    const formSettings=editing?`<div class="match-step"><span class="match-step-num">2</span><div><strong>Scegli il modulo</strong></div></div>
      <div class="form-group" style="margin:12px 0"><label for="matchFormation">Modulo della partita</label><select id="matchFormation" ${!m.callupsConfirmed?'disabled':''}>${FORMATIONS.map(f=>`<option value="${f}" ${f===m.formation?'selected':''}>${f}</option>`).join('')}</select></div>
      <div class="button-row lineup-tools"><button class="btn primary small" data-action="auto-lineup" ${!m.callupsConfirmed||!m.calledUpIds.length?'disabled':''}>⚡ Genera formazione</button></div>`:'';
    const results=editing?`<div class="two-col"><div><label for="gf">Gol fatti</label><input id="gf" data-result="gf" type="number" min="0" max="99" value="${m.gf??''}" placeholder="–"></div><div><label for="ga">Gol subiti</label><input id="ga" data-result="ga" type="number" min="0" max="99" value="${m.ga??''}" placeholder="–"></div></div><div class="form-hint">Il risultato viene salvato insieme alla partita quando premi «Salva modifiche».</div>`:
      `<div class="match-result-readonly"><strong>${score(m)}</strong><small>Risultato registrato</small></div>`;
    const eventForm=editing?`<form id="eventForm" class="stack"><div class="two-col"><div><label for="eventType">Tipo evento</label><select id="eventType">${Object.entries(EVENTS).filter(([k])=>k!=='clean').map(([k,v])=>`<option value="${k}" ${ui.eventType===k?'selected':''}>${v.title}</option>`).join('')}</select></div><div><label for="eventMinute">Minuto (opzionale)</label><input id="eventMinute" type="number" min="0" max="130" placeholder="Es. 64" value="${currentEvent?.minute??''}"></div></div><div><label for="eventPlayer">Giocatore</label><select id="eventPlayer" required>${pOptions(currentEvent?.playerId||'',p=>m.calledUpIds.includes(p.id))}</select></div>${ui.eventType==='gol'?`<div><label for="eventAssist">Assist di (facoltativo)</label><select id="eventAssist">${pOptions(currentEvent?.assistId||'',p=>m.calledUpIds.includes(p.id))}</select><div class="form-hint">Se inserisci l'assist qui, non aggiungerlo una seconda volta come evento separato.</div></div>`:''}<div class="button-row"><button type="submit" class="btn primary" ${m.calledUpIds.length===0?'disabled':''}>${currentEvent?'✓ Aggiorna evento':'+ Registra evento'}</button>${currentEvent?'<button type="button" class="btn secondary" data-action="cancel-event-edit">Annulla evento</button>':''}</div></form>`:'';
    return `<div class="card">${controls}<div class="card-title"><h2>Formazione ${esc(m.formation)}</h2><span class="tag">${lined.length}/11 titolari</span></div><div class="scoreline"><div class="club">La tua squadra</div><div class="versus">${score(m)}</div><div class="club" style="text-align:right">${esc(m.opponent)}</div></div>
      ${details}
      ${callupsBlock}
      ${formSettings}
      <div class="match-step" style="margin-top:20px"><span class="match-step-num">3</span><div><strong>Titolari e panchina</strong><small>${editing?'Tocca le maglie per modificare i giocatori tra i convocati':'Formazione salvata'}</small></div></div>
      ${renderPitch(m,editing&&m.callupsConfirmed)}
      <div class="lineup-review"><div class="card-title"><h3>Riepilogo titolari</h3><span class="tag">Valutazione per la partita</span></div><div class="lineup-review-grid">${formationSlots(m.formation).map((slot,index)=>{const p=person(m.lineup?.[index]);return `<div class="lineup-review-item"><small>${esc(slot.label)}</small><strong>${p?esc(p.name):'Posto libero'}</strong><span>${p?esc(formSummary(p,m,metrics)):'—'}</span></div>`;}).join('')}</div></div>
      <div class="card-title" style="margin-top:20px"><h3>Panchina</h3><span class="tag">${selectedBench.length} riserve</span></div>
      <p class="hint">I convocati che non sono tra gli undici titolari vengono inseriti automaticamente in panchina. Puoi correggere la formazione toccando una maglia.</p>
      <div class="bench-summary"><strong>Riserve convocate</strong><div class="bench-grid">${selectedBench.length?selectedBench.map(p=>`<span class="bench-chip">#${p.number} ${esc(p.name)} · ${p.isFirstTeam?'Prima squadra':`${metrics.byId[p.id]?.trainings||0}/${metrics.weekDates.length} allen.`}</span>`).join(''):'<span class="hint">Nessuna riserva selezionata</span>'}</div></div>
      <hr class="section-divider"><div class="card-title"><h3>Risultato finale</h3><span class="tag">Facoltativo</span></div>${results}</div>
      <div class="card"><div class="card-title"><h2>Eventi partita</h2><span class="tag">${fromMatch.length} eventi</span></div><p class="hint">🧤 Porta inviolata automatica: se il portiere è titolare e i gol subiti sono 0, viene assegnata nelle statistiche senza inserire eventi manuali.</p>${m.ga===0&&m.lineup?.[0]&&person(m.lineup[0])?.primaryPosition==='POR'?`<div class="clean-auto">🧤 Porta inviolata a <strong>${esc(display(m.lineup[0]))}</strong> contro ${esc(m.opponent)} · ${fmtDate(m.date)}</div>`:''}${eventForm}
      ${fromMatch.length?`<hr class="section-divider"><div class="event-list">${fromMatch.map(e=>`<div class="event-item"><div class="event-emoji">${EVENTS[e.type]?.symbol||'•'}</div><div class="event-main"><strong>${EVENTS[e.type]?.title||e.type} · ${esc(display(e.playerId))}</strong><small>${e.minute!==null&&e.minute!==undefined?`${e.minute}' · `:''}${e.assistId?`Assist: ${esc(display(e.assistId))}`:'Evento registrato'}</small></div>${editing?`<div class="event-actions"><button class="btn small secondary" data-action="edit-event" data-id="${esc(e.id)}">Modifica</button><button class="icon-btn" aria-label="Rimuovi evento" data-action="delete-event" data-id="${esc(e.id)}">✕</button></div>`:''}</div>`).join('')}</div>`:'<div class="empty" style="margin-top:15px">Nessun gol, assist o altro evento registrato.</div>'}
      ${editing?`<div class="match-save-footer"><span>Modifiche non ancora salvate</span><button type="button" class="btn primary" data-action="save-match-edit">✓ Salva modifiche</button><button type="button" class="btn secondary" data-action="cancel-match-edit">Annulla</button></div>`:
        `<div class="button-row" style="margin-top:18px"><button class="btn primary" data-action="download-graphic">↓ Esporta grafica PNG</button><button class="btn secondary" data-action="edit-match" data-id="${esc(m.id)}">✎ Modifica partita</button><button class="btn danger" data-action="delete-match">Elimina partita</button></div>`}</div>`;
  }

  function renderMatches(){
    const sorted=[...state.matches].sort((a,b)=>b.date.localeCompare(a.date));
    const current=matchById();
    el('matches').innerHTML=`
      ${pageHead('03 / MATCH DAY','Partite & formazioni','Crea la partita, scegli e conferma i convocati, poi genera i migliori titolari e la panchina.')}
      <div class="match-grid"><div><div class="card"><div class="card-title"><h2>Nuova partita</h2><span class="tag">Calendario libero</span></div><form class="stack" id="matchForm"><div class="form-group"><label for="matchOpponent">Avversario</label><input id="matchOpponent" required maxlength="65" placeholder="Es. Atletico Centro"></div><div class="two-col"><div><label for="matchDate">Data</label><input id="matchDate" type="date" required value="${today()}"></div><div><label for="matchVenue">Campo</label><select id="matchVenue"><option value="Casa">Casa</option><option value="Trasferta">Trasferta</option></select></div></div><button type="submit" class="btn primary full">+ Crea partita</button></form></div>
      <div class="card"><div class="card-title"><h2>Calendario gare</h2><span class="tag">${sorted.length} partite</span></div>${sorted.length?`<div class="match-list">${sorted.map(m=>`<div class="match-entry"><button type="button" class="match-item ${m.id===current?.id?'active':''}" data-action="select-match" data-id="${esc(m.id)}"><b>${score(m)}</b><strong>${esc(m.opponent)}</strong><small>${fmtDate(m.date)} · ${esc(m.venue)} · ${esc(m.formation)}</small></button><div class="match-entry-actions"><button type="button" class="btn secondary small" data-action="edit-match" data-id="${esc(m.id)}">Modifica</button><button type="button" class="btn danger small match-delete" data-action="delete-match" data-id="${esc(m.id)}" aria-label="Elimina partita contro ${esc(m.opponent)} del ${fmtDate(m.date)}">Elimina</button></div></div>`).join('')}</div>`:'<div class="empty"><span class="empty-icon">🏟️</span>Non hai ancora inserito partite.</div>'}</div></div>
      <div>${current?renderMatchDetail(current):`<div class="card"><div class="field-banner"><span>IL CAMPO TI ASPETTA</span></div><p class="hint" style="margin:17px 0 0">Crea una partita per iniziare a comporre la tua formazione. Tocca le maglie sul campo per cambiare giocatore.</p></div>`}</div></div>`;
  }

  // The coach can sort every statistic with a single tap on its column title.
  // Keep this UI preference separate from the saved player/attendance data.
  const STAT_COLUMNS = [
    {key:'name',label:'Giocatore',title:'Nome giocatore'},
    {key:'rating',label:'Livello',title:'Valutazione tecnica (stelle)'},
    {key:'trainings',label:'Allen.',title:'Presenze agli allenamenti certificati'},
    {key:'percentage',label:'% Pres.',title:'Percentuale di presenze certificate'},
    {key:'matches',label:'Part.',title:'Partite disputate'},
    {key:'gols',label:'Gol',title:'Gol segnati'},
    {key:'assists',label:'Ast',title:'Assist'},
    {key:'ogs',label:'AG',title:'Autogol'},
    {key:'cs',label:'CS',title:'Porte inviolate'}
  ];
  function sortStats(key){
    if(!STAT_COLUMNS.some(column=>column.key===key))return;
    const current=ui.statsSort;
    ui.statsSort={key,dir:current.key===key?(current.dir==='desc'?'asc':'desc'):(key==='name'?'asc':'desc')};
    const horizontal=el('stats').querySelector('.table-scroll')?.scrollLeft||0;
    renderStats(horizontal);
  }
  function renderStats(horizontalScroll=null){
    const eventCount=state.matches.reduce((n,m)=>n+(m.events||[]).length,0);
    const days=Object.keys(state.attendanceCertified).sort((a,b)=>b.localeCompare(a));
    const avg=days.length?Math.round(days.reduce((sum,d)=>sum+certifiedIds(d).length,0)/days.length*10)/10:0;
    const records=officialPlayers().map(p=>{
      const v=statsFor(p.id);
      return {p,...v,rating:ratingValue(p.rating),name:p.name,percentage:days.length?v.trainings/days.length*100:0};
    });
    const selected=STAT_COLUMNS.find(c=>c.key===ui.statsSort.key)||STAT_COLUMNS[2];
    const direction=ui.statsSort.dir==='asc'?1:-1;
    records.sort((a,b)=>{
      const value=selected.key==='name'
        ? a.name.localeCompare(b.name,'it',{sensitivity:'base',numeric:true})
        : a[selected.key]-b[selected.key];
      return direction*value || a.name.localeCompare(b.name,'it',{sensitivity:'base',numeric:true}) || a.p.number-b.p.number;
    });
    const headers=STAT_COLUMNS.map(column=>{
      const active=ui.statsSort.key===column.key;
      const arrow=active?(ui.statsSort.dir==='asc'?'↑':'↓'):'↕';
      const ariaSort=active?(ui.statsSort.dir==='asc'?'ascending':'descending'):'none';
      return `<th scope="col" aria-sort="${ariaSort}"><button type="button" class="stat-sort ${active?'is-active':''}" data-action="sort-stats" data-key="${column.key}" title="${esc(column.title)}: ordina con un tocco" aria-label="Ordina per ${esc(column.title)}${active?(ui.statsSort.dir==='asc'?', attualmente crescente':', attualmente decrescente'):''}"><span>${column.label}</span><span class="stat-sort-arrow" aria-hidden="true">${arrow}</span></button></th>`;
    }).join('');
    el('stats').innerHTML=`
      ${pageHead('04 / STATISTICHE','Numeri della squadra','Tocca un giocatore per vedere gol, assist, porte inviolate e avversari.')}
      <div class="metric-grid"><div class="metric"><div class="metric-num">${days.length}</div><div class="metric-label">Allenamenti certificati</div></div><div class="metric"><div class="metric-num">${avg}</div><div class="metric-label">Media presenti</div></div><div class="metric"><div class="metric-num">${state.matches.length}</div><div class="metric-label">Partite registrate</div></div></div>
      <div class="card"><div class="card-title"><h2>Statistiche individuali</h2><span class="tag">${records.length} giocatori</span></div>${records.length?`<p class="stat-sort-hint">Tocca una colonna per ordinare. Tocca di nuovo per invertire: <strong>${esc(selected.title)} ${ui.statsSort.dir==='asc'?'↑ crescente':'↓ decrescente'}</strong>.</p><div class="table-scroll" tabindex="0" aria-label="Tabella statistiche scorrevole orizzontalmente"><table class="stat-table"><thead><tr>${headers}</tr></thead><tbody>${records.map(({p,...v})=>`<tr data-stat-id="${esc(p.id)}"><td><button type="button" class="player-stat-link" data-action="open-player-profile" data-id="${esc(p.id)}" aria-label="Apri statistiche di ${esc(p.name)}">#${p.number} ${esc(p.name)} <span aria-hidden="true">↗</span></button></td><td>${ratingStars(p.rating,true)}</td><td><strong class="text-lime">${v.trainings}</strong></td><td>${days.length?Math.round(v.percentage)+'%':'—'}</td><td>${v.matches}</td><td>${v.gols}</td><td>${v.assists}</td><td>${v.ogs}</td><td>${v.cs}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Inserisci dei giocatori e certifica gli allenamenti per vedere le statistiche.</div>'}<p class="hint">Allen. e % Pres. considerano soltanto le date certificate. Se correggi e ricertifichi una data, i totali si aggiornano automaticamente, senza raddoppi.</p></div>
      <div class="card"><div class="card-title"><h2>Presenze per allenamento</h2><span class="tag">Registro certificato</span></div>${days.length?days.slice(0,15).map(d=>`<div class="attendance-history"><div class="attendance-history-title"><strong>${fmtDate(d)}</strong><span class="pill">${certifiedIds(d).length} presenti</span></div><p>${certifiedIds(d).length?orderPlayers(state.players.filter(p=>certifiedIds(d).includes(p.id))).map(p=>esc(p.name)).join(' · '):'Nessun giocatore presente'}</p><div class="record-actions"><button class="btn small secondary" data-action="open-training" data-date="${esc(d)}">Visualizza / correggi</button><button class="btn small danger" data-action="delete-training" data-date="${esc(d)}" aria-label="Elimina allenamento del ${fmtDate(d)}">Elimina</button></div></div>`).join(''):'<div class="empty">Nessun allenamento certificato. Vai su Training, segna le presenze e certifica.</div>'}</div>
      <div class="card"><div class="card-title"><h2>Legenda</h2><span class="tag">Calcolo</span></div><p class="hint">Gol e assist vengono dai tabellini delle partite. La porta inviolata si assegna automaticamente al portiere titolare quando il risultato registra zero gol subiti. Le presenze negli allenamenti sono indipendenti dal salvataggio degli esercizi.</p></div>`;
    if(horizontalScroll!==null){const scroller=el('stats').querySelector('.table-scroll');if(scroller)scroller.scrollLeft=horizontalScroll;}
  }

  const RENDERS={dashboard:renderDashboard,training:renderTraining,matches:renderMatches,roster:renderRoster,stats:renderStats};
  function render(tab=ui.tab){
    RENDERS[tab]();
  }
  function navigate(tab){
    if(!RENDERS[tab])return;
    if(ui.tab==='matches' && tab!=='matches' && !closeMatchEditor())return;
    ui.tab=tab;
    $$('.tab-page').forEach(p=>p.hidden=p.id!==tab);
    $$('.nav-item').forEach(b=>{const active=b.dataset.tab===tab;b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
    render(tab); window.scrollTo({top:0,behavior:'instant'});
  }
  function demo(){
    if(state.players.length && !confirm('Aggiungere 18 giocatori fittizi alla rosa esistente?'))return;
    state.players.push(...DEMO.map(([name,number,role,rating,primaryPosition,secondaryPosition])=>TACTICS.normalizePlayer({id:uid(),name,number,role,rating,primaryPosition,secondaryPosition})));
    save();render(ui.tab);toast('Rosa demo caricata (18 giocatori)');
  }
  function playerFormSubmit(){
    const name=el('pName')?.value.trim(),number=Number(el('pNum')?.value),
      primaryPosition=el('pPrimary')?.value,secondaryPosition=el('pSecondary')?.value||'',rating=Number(el('pRating')?.value),isDondo=!!el('pIsDondo')?.checked,isFirstTeam=!!el('pIsFirstTeam')?.checked;
    if(!name||name.length>50||!Number.isInteger(number)||number<0||number>99||
      !TACTICS.POSITIONS[primaryPosition]||(secondaryPosition&&!TACTICS.POSITIONS[secondaryPosition])||
      !Number.isFinite(rating)||rating<1||rating>5||!Number.isInteger(rating*2)){toast('Controlla i dati del giocatore');return;}
    if(secondaryPosition===primaryPosition){toast('Il ruolo secondario deve essere diverso dal principale');return;}
    if(state.players.some(p=>p.number===number&&p.id!==ui.editPlayerId)){toast('Numero di maglia già assegnato');return;}
    if(isDondo && state.players.some(p=>p.isDondo && p.id!==ui.editPlayerId)){toast('C’è già un Jolly Dondo: modifica quel giocatore oppure togli prima il flag.');return;}
    const payload=TACTICS.normalizePlayer({name,number,rating,primaryPosition,secondaryPosition,isDondo,isFirstTeam});
    if(ui.editPlayerId){const p=person(ui.editPlayerId);if(p)Object.assign(p,payload);ui.editPlayerId=null;toast('Giocatore aggiornato');}
    else {state.players.push({...payload,id:uid()});toast('Giocatore aggiunto');}
    ui.current=null;save();renderRoster();
  }
  function deletePlayer(id){
    const p=person(id);if(!p)return;
    if(!confirm(`Eliminare ${p.name}? Anche le sue presenze e i suoi eventi storici saranno cancellati. Esporta un backup prima se vuoi conservarli.`))return;
    state.players=state.players.filter(p=>p.id!==id);
    for(const date in state.attendance)state.attendance[date]=state.attendance[date].filter(x=>x!==id);
    for(const date in state.attendanceCertified)state.attendanceCertified[date].ids=state.attendanceCertified[date].ids.filter(x=>x!==id);
    for(const m of state.matches){m.lineup=m.lineup.map(x=>x===id?null:x);m.calledUpIds=(m.calledUpIds||[]).filter(x=>x!==id);m.benchIds=(m.benchIds||[]).filter(x=>x!==id);m.events=m.events.filter(e=>e.playerId!==id).map(e=>({...e,assistId:e.assistId===id?null:e.assistId}));}
    state.sessions=state.sessions.map(s=>({...s,groups:s.groups.map(g=>g.filter(x=>x!==id)),present:s.present.filter(x=>x!==id),joker:s.joker===id?null:s.joker,dondoJoker:s.dondoJoker===id?null:s.dondoJoker,sponde:(s.sponde||[]).filter(x=>x!==id),bench:s.bench.filter(x=>x!==id)}));
    ui.current=null;ui.editPlayerId=null;save();renderRoster();toast('Giocatore eliminato');
  }
  function createMatch(){
    if(!closeMatchEditor())return;
    const opponent=el('matchOpponent')?.value.trim(),date=el('matchDate')?.value,venue=el('matchVenue')?.value,formation='4-3-3';
    if(!opponent||!date||!FORMATIONS.includes(formation)){toast('Inserisci avversario e data');return;}
    const m={id:uid(),opponent,date,venue,formation,lineup:Array(11).fill(null),calledUpIds:[],callupsConfirmed:false,benchIds:[],events:[],gf:null,ga:null};
    state.matches.unshift(m);ui.selectedMatchId=m.id;save();beginMatchEdit(m.id);toast('Partita creata: seleziona e conferma prima i convocati');
  }
  function addEvent(){
    const m=matchById();if(!m)return;
    const type=el('eventType')?.value,playerId=el('eventPlayer')?.value,minuteText=el('eventMinute')?.value,minute=minuteText===''?null:Number(minuteText),assistId=type==='gol'?(el('eventAssist')?.value||null):null;
    if(!EVENTS[type]||!person(playerId)||person(playerId).isDondo||!m.calledUpIds.includes(playerId)){toast('Seleziona un giocatore convocato');return;}
    if(type==='clean'&&person(playerId).primaryPosition!=='POR'){toast('La porta inviolata è riservata ai portieri');return;}
    if(minute!==null&&(!Number.isInteger(minute)||minute<0||minute>130)){toast('Il minuto deve essere da 0 a 130');return;}
    if(assistId===playerId){toast('Il marcatore non può assistere se stesso');return;}
    if(assistId&&!m.calledUpIds.includes(assistId)){toast('L’assist deve essere di un giocatore convocato');return;}
    if(type==='clean'&&m.ga!==null&&m.ga>0){toast('Risultato con gol subiti: non è possibile assegnare porta inviolata');return;}
    if(type==='clean'&&m.events.some(e=>e.type==='clean'&&e.playerId===playerId)){toast('Porta inviolata già registrata per questo portiere');return;}
    if(!editingMatch())return;
    const editingEvent=m.events.find(e=>e.id===ui.editingEventId);
    if(editingEvent)Object.assign(editingEvent,{type,playerId,minute,assistId});
    else m.events.push({id:uid(),type,playerId,minute,assistId});
    ui.editingEventId=null;saveMatchChange();renderMatches();toast(editingEvent?'Evento modificato (da salvare)':'Evento aggiunto (da salvare)');
  }
  function openModal(slotIndex){
    const m=matchById(),slot=formationSlots(m.formation)[slotIndex];if(!slot)return;
    const modal=el('modal');
    el('modalTitle').textContent=`${slot.label} · Seleziona giocatore`;
    const current=m.lineup[slotIndex];
    const metrics=metricsForMatch(m);
    const list=orderPlayers((m.calledUpIds||[]).map(person).filter(Boolean)).sort((a,b)=>
      (TACTICS.positionCost(a,slot.position)*3-(metrics.byId[a.id]?.formScore||0))-
      (TACTICS.positionCost(b,slot.position)*3-(metrics.byId[b.id]?.formScore||0)));
    el('modalBody').innerHTML=`<div class="modal-options"><div class="form-hint">Settimana ${fmtDate(metrics.weekStart)} – ${fmtDate(m.date)} · ${metrics.weekDates.length} allenamenti certificati</div><button class="modal-option" data-action="assign-player" data-index="${slotIndex}" data-id=""><strong>— Lascia libero questo posto</strong></button>${list.map(p=>`<button class="modal-option ${current===p.id?'selected':''}" data-action="assign-player" data-index="${slotIndex}" data-id="${esc(p.id)}"><strong>#${p.number} · ${esc(p.name)} ${current===p.id?'✓':''}</strong><small>${TACTICS.preferredQuality(p,slot.position)} · ${esc(positionLine(p))} · Livello ${ratingLabel(p.rating)}/5</small><small class="modal-form">${esc(formSummary(p,m,metrics))}${m.benchIds?.includes(p.id)?' · In panchina':''}</small></button>`).join('')}</div>`;
    modal.hidden=false;document.body.style.overflow='hidden';
  }
  function closeModal(){el('modal').hidden=true;el('modal').classList.remove('profile-modal');document.body.style.overflow='';}
  function chooseSlot(slotIndex,id){
    const m=matchById();if(!m||slotIndex<0||slotIndex>=11)return;
    const old=m.lineup[slotIndex];
    if(!m.callupsConfirmed)return;
    if(id && (!person(id)||person(id).isDondo||!m.calledUpIds.includes(id)))return;
    const other=id?m.lineup.indexOf(id):-1;
    if(other>=0&&other!==slotIndex)m.lineup[other]=old;
    m.lineup[slotIndex]=id||null;
    cleanBench(m);
    saveMatchChange();closeModal();renderMatches();
  }
  function saveSession(){
    const c=ui.current;
    if(!c || !certifiedRecord() || ui.editingAttendance || c.date!==ui.date || !sameIds(c.present,certifiedIds())){
      toast('Certifica le presenze e rigenera prima di salvare');return;
    }
    const rec=JSON.parse(JSON.stringify({...c,id:uid(),needsReview:false}));
    state.sessions.unshift(rec);save();renderTraining();toast('Esercizio salvato nello storico');
  }
  function updateAttendance(id,checked){
    if(!person(id) || person(id).isDondo || !isAttendanceEditable())return;
    const group=new Set(presentIds());if(checked)group.add(id);else group.delete(id);
    state.attendance[ui.date]=[...group];ui.current=null;save();renderTraining();
  }
  function certifyAttendance(){
    if(!state.players.length){toast('Inserisci prima i giocatori nella rosa');return;}
    const previous=certifiedRecord();
    const ids=presentIds();
    state.attendanceCertified[ui.date]={ids:[...ids],confirmedAt:new Date().toISOString(),revision:(previous?.revision||0)+1};
    if(previous && !sameIds(previous.ids,ids)){
      for(const sess of state.sessions) if(sess.date===ui.date) sess.needsReview=!sameIds(sess.present,ids);
    }
    ui.editingAttendance=false;
    ui.current=null;
    save();renderTraining();toast(previous?'Presenze aggiornate e ricertificate':'Presenze certificate: ora puoi creare le squadre');
  }
  function editAttendance(){
    const record=certifiedRecord();if(!record)return;
    state.attendance[ui.date]=[...record.ids];
    ui.current=null;ui.editingAttendance=true;save();renderTraining();toast('Presenze sbloccate: modifica e ricertifica');
  }
  function cancelAttendanceEdit(){
    const record=certifiedRecord();if(!record)return;
    state.attendance[ui.date]=[...record.ids];
    ui.editingAttendance=false;ui.current=null;save();renderTraining();toast('Correzioni annullate');
  }
  const hasTrainingDate = date => Object.prototype.hasOwnProperty.call(state.attendance,date) || Object.prototype.hasOwnProperty.call(state.attendanceCertified,date) || state.sessions.some(s=>s.date===date);
  function deleteTraining(date){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'') || !hasTrainingDate(date))return;
    const count=state.sessions.filter(s=>s.date===date).length;
    const question=`Eliminare DEFINITIVAMENTE l'allenamento del ${fmtDate(date)}?\n\nVerranno cancellati le presenze (anche certificate) e ${count} eserciz${count===1?'io':'i'} salvati di questa data. Le statistiche e la forma per le partite saranno ricalcolate. Le partite rimarranno salvate.`;
    if(!confirm(question))return;
    delete state.attendance[date];
    delete state.attendanceCertified[date];
    state.sessions=state.sessions.filter(s=>s.date!==date);
    if(ui.date===date){ui.editingAttendance=false;ui.current=null;}
    else if(ui.current?.date===date)ui.current=null;
    save();render(ui.tab);toast(`Allenamento del ${fmtDate(date)} eliminato`);
  }
  function deleteSession(id){
    const s=state.sessions.find(x=>x.id===id);if(!s)return;
    if(!confirm(`Eliminare solo l'esercizio del ${fmtDate(s.date)}? Le presenze certificate e le statistiche di quel giorno resteranno invariate.`))return;
    state.sessions=state.sessions.filter(x=>x.id!==id);
    if(ui.current?.id===id)ui.current=null;
    save();renderTraining();toast('Esercizio eliminato, presenze conservate');
  }
  function deleteMatch(id){
    const m=state.matches.find(x=>x.id===id);if(!m)return;
    if(!confirm(`Eliminare DEFINITIVAMENTE la partita del ${fmtDate(m.date)} contro ${m.opponent}?\n\nVerranno cancellati formazione, panchina, risultato, gol, assist, autogol e porte inviolate di questa partita. Le statistiche saranno aggiornate.`))return;
    if(ui.matchDraft && !closeMatchEditor())return;
    state.matches=state.matches.filter(x=>x.id!==id);
    if(ui.selectedMatchId===id)ui.selectedMatchId=state.matches[0]?.id||null;
    save();renderMatches();toast('Partita eliminata: statistiche aggiornate');
  }
  function switchTrainingDate(nextDate){
    if(ui.editingAttendance && !sameIds(presentIds(),certifiedIds()) && !confirm('Le correzioni non certificate saranno annullate. Cambiare data?')){
      renderTraining();return;
    }
    if(ui.editingAttendance) state.attendance[ui.date]=[...certifiedIds()];
    ui.date=nextDate||today();ui.current=null;ui.editingAttendance=false;save();renderTraining();
  }
  function exportBackup(){
    const contents=JSON.stringify(state,null,2);
    const blob=new Blob([contents],{type:'application/json'});
    downloadBlob(blob,`CampoCoach_backup_${today()}.json`);toast('Backup preparato');
  }
  function downloadBlob(blob,filename){
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);
  }
  function importBackup(input){
    const file=input.files?.[0];if(!file)return;
    if(file.size>5_000_000){toast('File troppo grande (max 5 MB)');input.value='';return;}
    const reader=new FileReader();
    reader.onload=()=>{
      try{
        const v=JSON.parse(reader.result);
        if(!v||!Array.isArray(v.players)||!Array.isArray(v.sessions)||!Array.isArray(v.matches)||typeof v.attendance!=='object'||!v.attendance)throw Error('Formato non valido');
        if(!confirm('Importare il backup e SOSTITUIRE tutti i dati attuali?'))return;
        state=normalizeData(v);if(!state)throw Error('Formato non valido');
        if(!save())return;ui.current=null;ui.selectedMatchId=null;ui.editPlayerId=null;ui.editingAttendance=false;ui.matchDraft=null;ui.editingMatchId=null;ui.editingEventId=null;render(ui.tab);toast('Backup importato correttamente');
      }catch(e){toast('Backup non valido o danneggiato');console.error(e);}
      finally{input.value='';}
    };reader.onerror=()=>toast('Non riesco a leggere il file');reader.readAsText(file);
  }

  function graphicPNG(){
    const m=matchById();if(!m)return;
    const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1620;
    const ctx=canvas.getContext('2d');if(!ctx){toast('Esportazione non disponibile');return;}
    const w=1080, slots=formationSlots(m.formation);
    ctx.fillStyle='#0a1717';ctx.fillRect(0,0,w,1620);
    const gradient=ctx.createLinearGradient(0,0,1080,270);gradient.addColorStop(0,'#214e3b');gradient.addColorStop(1,'#0c2827');ctx.fillStyle=gradient;ctx.fillRect(0,0,w,260);
    ctx.fillStyle='#d0ff64';ctx.font='900 29px Arial';ctx.textAlign='left';ctx.fillText('CAMPOCOACH  /  MATCH DAY',64,70);
    ctx.fillStyle='#ffffff';ctx.font='bold 51px Arial';ctx.fillText('LA TUA FORMAZIONE',64,145);
    ctx.fillStyle='#b6d7c8';ctx.font='28px Arial';ctx.fillText(`${fmtDate(m.date)} · ${m.venue} · ${m.formation}`,64,195);
    ctx.fillStyle='#e7ffe0';ctx.font='bold 34px Arial';ctx.fillText(`VS ${m.opponent.toUpperCase().slice(0,34)}`,64,237);
    const px=62,py=292,pw=956,ph=1000;
    for(let i=0;i<10;i++){ctx.fillStyle=i%2?'#165f42':'#1a704c';ctx.fillRect(px,py+i*(ph/10),pw,ph/10);}
    ctx.strokeStyle='#cfefc4aa';ctx.lineWidth=5;ctx.strokeRect(px+17,py+17,pw-34,ph-34);
    ctx.beginPath();ctx.moveTo(px+17,py+ph/2);ctx.lineTo(px+pw-17,py+ph/2);ctx.stroke();
    ctx.beginPath();ctx.arc(px+pw/2,py+ph/2,130,0,Math.PI*2);ctx.stroke();
    ctx.strokeRect(px+pw*.23,py+17,pw*.54,150);ctx.strokeRect(px+pw*.23,py+ph-167,pw*.54,150);
    const fit=(txt,max)=>{while(ctx.measureText(txt).width>max&&txt.length>2)txt=txt.slice(0,-2);return txt;};
    for(let i=0;i<slots.length;i++){
      const s=slots[i],p=person(m.lineup[i]),x=px+pw*s.x/100,y=py+ph*s.y/100;
      ctx.shadowBlur=18;ctx.shadowColor='#00170f99';ctx.fillStyle=s.role==='POR'?'#ffd687':'#d0ff64';ctx.beginPath();ctx.roundRect(x-36,y-38,72,65,15);ctx.fill();ctx.shadowBlur=0;
      ctx.fillStyle='#152d21';ctx.textAlign='center';ctx.font='900 29px Arial';ctx.fillText(p?.number??'+',x,y+5);
      const name=(p?.name||s.role).split(' ').slice(-1)[0].toUpperCase();ctx.font='bold 21px Arial';const label=fit(name,158);
      const box=Math.max(87,Math.min(172,ctx.measureText(label).width+24));ctx.fillStyle='#09281fdf';ctx.beginPath();ctx.roundRect(x-box/2,y+30,box,34,8);ctx.fill();
      ctx.fillStyle='#fff';ctx.fillText(label,x,y+55);
    }
    ctx.fillStyle='#122b28';ctx.fillRect(0,1320,1080,300);
    ctx.fillStyle='#d0ff64';ctx.font='900 27px Arial';ctx.textAlign='left';ctx.fillText('TABELLINO',64,1370);
    const counts={gol:0,assist:0,autogol:0,clean:0};(m.events||[]).forEach(e=>{if(e.type in counts)counts[e.type]++;if(e.type==='gol'&&e.assistId)counts.assist++;});
    ctx.fillStyle='#fff';ctx.font='bold 26px Arial';ctx.fillText(`RISULTATO  ${score(m)}     GOL  ${counts.gol}     ASSIST  ${counts.assist}`,64,1420);
    ctx.fillStyle='#accaba';ctx.font='22px Arial';ctx.fillText(`AUTOGOL  ${counts.autogol}        PORTE INVIOLATE  ${counts.clean}`,64,1460);
    ctx.fillStyle='#ddf1e2';ctx.font='22px Arial';
    const names=(m.events||[]).filter(e=>e.type==='gol').map(e=>display(e.playerId).split(' ').slice(-1)[0]).join(', ');
    ctx.fillText(`Marcatori: ${fit(names||'—',920)}`,64,1514);
    ctx.fillStyle='#789d8b';ctx.font='19px Arial';ctx.fillText('Grafica originale generata con CampoCoach',64,1576);
    canvas.toBlob(blob=>{if(blob){downloadBlob(blob,`CampoCoach_${m.date}_${m.opponent.replace(/[^a-z0-9]/gi,'_').slice(0,30)}.png`);toast('Grafica PNG pronta');}else toast('Esportazione fallita');},'image/png');
  }

  document.addEventListener('submit',event=>{
    const id=event.target.id;
    if(['playerForm','matchForm','eventForm'].includes(id)){
      event.preventDefault();
      if(id==='playerForm')playerFormSubmit();
      if(id==='matchForm')createMatch();
      if(id==='eventForm')addEvent();
    }
  });
  document.addEventListener('change',event=>{
    const target=event.target;
    if(target.id==='pRating'){const preview=el('ratingPreview');if(preview)preview.innerHTML=ratingStars(Number(target.value));return;}
    if(target.matches('[data-att-id]')){updateAttendance(target.dataset.attId,target.checked);return;}
    if(target.id==='trainingDate'){switchTrainingDate(target.value);return;}
    if(target.id==='exercise'){
      ui.exercise=target.value;
      const preset={partitella:[2,0],possesso:[3,0],rondo:[4,4],personalizzato:[2,0]}[ui.exercise];
      [ui.teams,ui.cap]=preset;ui.formation='auto';ui.spondeCount=ui.exercise==='possesso'?ui.spondeCount:0;ui.current=null;renderTraining();return;
    }
    if(target.id==='teamCount'){ui.teams=Number(target.value);ui.formation='auto';ui.current=null;renderTraining();return;}
    if(target.id==='teamCap'){ui.cap=Math.max(0,Math.min(30,Number(target.value)||0));ui.formation='auto';ui.current=null;renderTraining();return;}
    if(target.id==='extra'){ui.extra=target.value;ui.current=null;renderTraining();return;}
    if(target.id==='useDondo'){ui.useDondo=target.checked;ui.formation='auto';ui.current=null;renderTraining();return;}
    if(target.id==='dondoMode'){ui.dondoMode=target.value==='squadre'?'squadre':'jolly';ui.formation='auto';ui.current=null;renderTraining();return;}
    if(target.id==='spondeCount'){ui.spondeCount=Math.max(0,Math.min(12,Number(target.value)||0));ui.formation='auto';ui.current=null;renderTraining();return;}
    if(target.id==='includeGoalkeepers'){ui.includeGoalkeepers=target.checked;ui.formation='auto';ui.current=null;renderTraining();return;}
    if(target.id==='defenseStyle'){ui.defense=Number(target.value)===3?3:4;ui.formation='auto';ui.current=null;renderTraining();return;}
    if(target.id==='trainingFormation'){ui.formation=target.value;ui.current=null;renderTraining();return;}
    if(target.matches('[data-callup-id]')){
      const m=matchById();if(!editingMatch()||!m)return;
      const id=target.dataset.callupId;
      updateCallups(m,target.checked?[...m.calledUpIds,id]:m.calledUpIds.filter(x=>x!==id));
      renderMatches();return;
    }
    if(target.id==='eventType'){if(!editingMatch())return;ui.eventType=target.value;renderMatches();return;}
    if(target.id==='matchOpponentEdit'){const m=matchById();if(editingMatch()&&m)m.opponent=target.value.trim();return;}
    if(target.id==='matchVenueEdit'){const m=matchById();if(editingMatch()&&m){m.venue=target.value;renderMatches();}return;}
    if(target.id==='matchFormation'){const m=matchById();if(editingMatch()&&m){if(m.lineup.some(Boolean)&&!confirm('Cambiare modulo e svuotare i titolari? Potrai rigenerarli con il pulsante apposito.')){renderMatches();return;}m.formation=target.value;m.lineup=Array(11).fill(null);cleanBench(m);saveMatchChange();renderMatches();}return;}
    if(target.id==='matchDateEdit'){const m=matchById();if(editingMatch()&&m&&target.value){m.date=target.value;saveMatchChange();renderMatches();}return;}
    if(target.matches('[data-result]')){
      const m=matchById();if(!editingMatch()||!m)return;const num=target.value.trim()===''?null:Number(target.value);
      if(num!==null&&(!Number.isInteger(num)||num<0||num>99)){toast('Usa un numero da 0 a 99');renderMatches();return;}
      if(target.dataset.result==='ga'&&num!==null&&num>0&&m.events.some(e=>e.type==='clean')){
        if(!confirm('Sono segnate una o più porte inviolate. Rimuoverle per registrare gol subiti?')){renderMatches();return;}
        m.events=m.events.filter(e=>e.type!=='clean');
      }
      m[target.dataset.result]=num;saveMatchChange();
      const matchScore=el('matches')?.querySelector('.scoreline .versus');
      if(matchScore)matchScore.textContent=score(m);
      if(target.dataset.result==='ga'&&num!==null&&num>0)renderMatches();
      return;
    }
    if(target.id==='importInput')importBackup(target);
  });
  document.addEventListener('click',event=>{
    const nav=event.target.closest('[data-tab]');if(nav){navigate(nav.dataset.tab);return;}
    const go=event.target.closest('[data-go]');if(go){navigate(go.dataset.go);return;}
    const b=event.target.closest('[data-action]');if(!b)return;
    const a=b.dataset.action,id=b.dataset.id;
    if(a==='sort-stats')sortStats(b.dataset.key);
    else if(a==='open-player-profile')openPlayerProfile(id);
    else if(a==='demo')demo();
    else if(a==='cancel-edit'){ui.editPlayerId=null;renderRoster();}
    else if(a==='edit-player'){ui.editPlayerId=id;renderRoster();el('pName')?.focus();}
    else if(a==='delete-player')deletePlayer(id);
    else if(a==='all-present'){if(!isAttendanceEditable())return;state.attendance[ui.date]=officialPlayers().map(p=>p.id);ui.current=null;save();renderTraining();}
    else if(a==='none-present'){if(!isAttendanceEditable())return;state.attendance[ui.date]=[];ui.current=null;save();renderTraining();}
    else if(a==='certify-attendance')certifyAttendance();
    else if(a==='edit-attendance')editAttendance();
    else if(a==='cancel-attendance-edit')cancelAttendanceEdit();
    else if(a==='delete-training')deleteTraining(b.dataset.date);
    else if(a==='delete-session')deleteSession(id);
    else if(a==='open-training'){switchTrainingDate(b.dataset.date);navigate('training');}
    else if(a==='generate')generateGroups();
    else if(a==='save-session')saveSession();
    else if(a==='swap'){
      if(!ui.current)return;
      const id1=el('swapA')?.value,id2=el('swapB')?.value;
      let x=-1,y=-1;ui.current.groups.forEach((g,i)=>{if(g.includes(id1))x=i;if(g.includes(id2))y=i;});
      if(id1===id2||x<0||y<0||x===y){toast('Scegli due giocatori di squadre diverse');return;}
      const g1=ui.current.groups[x],g2=ui.current.groups[y];g1[g1.indexOf(id1)]=id2;g2[g2.indexOf(id2)]=id1;
      if(ui.current.slotsByGroup){const a=ui.current.slotsByGroup[x].find(s=>s.id===id1),z=ui.current.slotsByGroup[y].find(s=>s.id===id2);if(a&&z){a.id=id2;z.id=id1;}}
      renderTraining();toast('Giocatori scambiati');
    }
    else if(a==='load-session'){
      const s=state.sessions.find(x=>x.id===id);if(!s)return;
      if(s.needsReview || !sameIds(s.present,certifiedIds(s.date))){ui.date=s.date;ui.current=null;ui.editingAttendance=false;ui.teams=s.groups.length;ui.cap=s.cap||0;ui.extra=s.extra||'jolly';ui.includeGoalkeepers=s.includeGoalkeepers!==false;ui.defense=s.defense||4;ui.formation=s.formation||'auto';ui.exercise=s.title||'personalizzato';ui.useDondo=!!s.useDondo;ui.dondoMode=s.dondoMode||'jolly';ui.spondeCount=s.sponde?.length||0;renderTraining();toast('Presenze cambiate: rigenera le squadre');return;}
      ui.date=s.date;ui.editingAttendance=false;ui.current=JSON.parse(JSON.stringify(s));ui.teams=s.groups.length;ui.cap=s.cap||0;ui.extra=s.extra||'jolly';ui.includeGoalkeepers=s.includeGoalkeepers!==false;ui.defense=s.defense||4;ui.formation=s.formation||'auto';ui.exercise=s.title||'personalizzato';ui.useDondo=!!s.useDondo;ui.dondoMode=s.dondoMode||'jolly';ui.spondeCount=s.sponde?.length||0;renderTraining();setTimeout(()=>el('generated')?.scrollIntoView({behavior:'smooth',block:'start'}),0);
    }
    else if(a==='select-match'){if(id!==ui.selectedMatchId && !closeMatchEditor())return;ui.selectedMatchId=id;ui.eventType='gol';ui.editingEventId=null;renderMatches();}
    else if(a==='edit-match')beginMatchEdit(id);
    else if(a==='save-match-edit')commitMatchEdit();
    else if(a==='cancel-match-edit'){if(closeMatchEditor()){renderMatches();toast('Modifiche annullate: partita originale ripristinata');}}
    else if(a==='edit-event'){if(!editingMatch())return;const m=matchById(),evt=m?.events?.find(e=>e.id===id);if(!evt)return;ui.editingEventId=id;ui.eventType=evt.type;renderMatches();el('eventForm')?.scrollIntoView({behavior:'smooth',block:'center'});}
    else if(a==='cancel-event-edit'){ui.editingEventId=null;ui.eventType='gol';renderMatches();}
    else if(a==='assign-slot'){if(editingMatch()&&matchById()?.callupsConfirmed)openModal(Number(b.dataset.index));else toast('Conferma prima i convocati');}
    else if(a==='assign-player'){if(editingMatch())chooseSlot(Number(b.dataset.index),id||null);}
    else if(a==='callup-all'||a==='callup-first'||a==='callup-none'){
      const m=matchById();if(!editingMatch()||!m)return;
      const chosen=a==='callup-all'?officialPlayers().map(p=>p.id):a==='callup-first'?officialPlayers().filter(p=>p.isFirstTeam).map(p=>p.id):[];
      if(a==='callup-first'&&!chosen.length){toast('Non hai ancora contrassegnato giocatori della Prima squadra nella Rosa');return;}
      if(updateCallups(m,chosen)){renderMatches();toast('Convocati aggiornati: conferma la selezione');}
      else renderMatches();
    }
    else if(a==='confirm-callups'){
      const m=matchById();if(!editingMatch()||!m)return;
      if(!m.calledUpIds.length){toast('Seleziona prima almeno un convocato');return;}
      m.callupsConfirmed=true;cleanBench(m);saveMatchChange();renderMatches();
      toast(m.calledUpIds.length<11?'Convocati confermati: meno di 11, formazione parziale':'Convocati confermati: scegli modulo e genera formazione');
    }
    else if(a==='set-defense'){
      const m=matchById();if(!editingMatch()||!m)return;
      const desired=b.dataset.defense==='3'?'3-5-2':'4-3-3';
      if(m.formation===desired){toast('Assetto gia selezionato');return;}
      if(m.lineup.some(Boolean)&&!confirm('Cambiare difesa e svuotare i titolari? Potrai rigenerarli con il pulsante apposito.'))return;
      m.formation=desired;m.lineup=Array(11).fill(null);cleanBench(m);
      saveMatchChange();renderMatches();toast('Modulo aggiornato: premi Genera formazione');
    }
    else if(a==='auto-lineup'){
      const m=matchById();if(!editingMatch()||!m)return;
      if(!m.callupsConfirmed || !m.calledUpIds.length){toast('Seleziona e conferma prima i convocati');return;}
      if(m.lineup.some(Boolean)&&!confirm('Sostituire la formazione attuale con una nuova proposta?'))return;
      m.lineup=autoLineup(m);cleanBench(m);saveMatchChange();renderMatches();
      const count=m.lineup.filter(Boolean).length;
      toast(count<11?`Formazione proposta: ${count}/11, mancano convocati`:'Titolari scelti tra i convocati per ruolo, stelle e forma');
    }
    else if(a==='clear-lineup'){const m=matchById();if(editingMatch()&&m&&m.callupsConfirmed&&confirm('Rimuovere tutti i titolari da questa formazione?')){m.lineup=Array(11).fill(null);saveMatchChange();renderMatches();}}
    else if(a==='delete-event'){const m=matchById();if(editingMatch()&&m){m.events=m.events.filter(e=>e.id!==id);if(ui.editingEventId===id)ui.editingEventId=null;saveMatchChange();renderMatches();toast('Evento rimosso (da salvare)');}}
    else if(a==='delete-match')deleteMatch(id||matchById()?.id);
    else if(a==='download-graphic')graphicPNG();
    else if(a==='export')exportBackup();
    else if(a==='choose-import')el('importInput')?.click();
  });
  el('modalClose').addEventListener('click',closeModal);
  el('modal').addEventListener('click',event=>{if(event.target===el('modal'))closeModal();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!el('modal').hidden)closeModal();});
  window.addEventListener('beforeunload',event=>{
    if(ui.matchDraft && JSON.stringify(ui.matchDraft)!==JSON.stringify(persistedMatch(ui.editingMatchId))){
      event.preventDefault();event.returnValue='';
    }
  });
  el('todayLabel').textContent=new Date().toLocaleDateString('it-IT',{weekday:'short',day:'numeric',month:'short'});
  renderDashboard();
  if('serviceWorker' in navigator && /^https?:$/.test(location.protocol))navigator.serviceWorker.register('./sw.js').catch(console.warn);
})();
