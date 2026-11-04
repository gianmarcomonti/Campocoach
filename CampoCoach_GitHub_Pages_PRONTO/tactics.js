/* CampoCoach tactical engine v4.2: training, match lineup and recent form. */
(function(root){
  'use strict';
  const POSITIONS = Object.freeze({
    POR:'Portiere', DC:'Difensore centrale', TD:'Terzino destro', TS:'Terzino sinistro',
    MEZ:'Mezzala', MED:'Mediano', TREQ:'Trequartista', ED:'Esterno destro', ES:'Esterno sinistro',
    PUN:'Punta', AD:'Ala destra', AS:'Ala sinistra'
  });
  const GROUPS = Object.freeze({
    POR:['POR'],DIF:['DC','TD','TS'],CEN:['MEZ','MED','TREQ','ED','ES'],ATT:['PUN','AD','AS']
  });
  const DEFAULTS = Object.freeze({POR:'POR',DIF:'DC',CEN:'MEZ',ATT:'PUN'});
  const FORMATION_LINES = Object.freeze({
    '4-3-3':[['TS','DC','DC','TD'],['MEZ','MED','MEZ'],['AS','PUN','AD']],
    '4-4-2':[['TS','DC','DC','TD'],['ES','MED','MEZ','ED'],['PUN','PUN']],
    '3-5-2':[['BRS','DC','BRD'],['ES','MEZ','MED','MEZ','ED'],['PUN','PUN']],
    '4-2-3-1':[['TS','DC','DC','TD'],['MED','MED'],['AS','TREQ','AD'],['PUN']],
    '3-4-3':[['BRS','DC','BRD'],['ES','MEZ','MED','ED'],['AS','PUN','AD']],
    '4-5-1':[['TS','DC','DC','TD'],['ES','MEZ','MED','MEZ','ED'],['PUN']],
    '5-3-2':[['TS','BRS','DC','BRD','TD'],['MEZ','MED','MEZ'],['PUN','PUN']]
  });
  // Training modules count outfield players only. A keeper, when selected, is
  // added as a separate slot for each team (e.g. 4-2-2 + POR = 9 players).
  const TRAINING_FORMATIONS = Object.freeze({
    '4-2-2':[['TS','DC','DC','TD'],['MED','MEZ'],['PUN','PUN']],
    '4-3-1':[['TS','DC','DC','TD'],['MEZ','MED','TREQ'],['PUN']],
    '3-3-2':[['BRS','DC','BRD'],['MEZ','MED','MEZ'],['PUN','PUN']],
    '3-2-3':[['BRS','DC','BRD'],['MED','MEZ'],['AS','PUN','AD']],
    '4-3-2':[['TS','DC','DC','TD'],['MEZ','MED','TREQ'],['PUN','PUN']],
    '4-2-3':[['TS','DC','DC','TD'],['MED','MEZ'],['AS','PUN','AD']],
    '3-3-3':[['BRS','DC','BRD'],['MEZ','MED','MEZ'],['AS','PUN','AD']],
    '3-4-2':[['BRS','DC','BRD'],['ES','MEZ','MED','ED'],['PUN','PUN']],
    // Fallbacks for groups with seven outfielders (e.g. 8v8 with a keeper).
    '4-2-1':[['TS','DC','DC','TD'],['MED','MEZ'],['PUN']],
    '3-3-1':[['BRS','DC','BRD'],['MEZ','MED','MEZ'],['PUN']],
    '4-1-1':[['TS','DC','DC','TD'],['MED'],['PUN']],
    '3-2-1':[['BRS','DC','BRD'],['MED','MEZ'],['PUN']]
  });
  const formationSize = name => (TRAINING_FORMATIONS[name]||[]).reduce((n,row)=>n+row.length,0);
  function trainingFormationsFor(size,defense){
    return Object.keys(TRAINING_FORMATIONS).filter(name=>name.startsWith(`${defense}-`) && formationSize(name)===size);
  }
  function trainingPlan(ids,allPlayers,{teams=2,cap=0,includeGoalkeepers=true}={}){
    const people=ids.map(id=>allPlayers.find(p=>p.id===id)).filter(Boolean).map(normalizePlayer)
      .filter(p=>includeGoalkeepers||p.primaryPosition!=='POR');
    const numberOfTeams=Math.min(4,Math.max(2,Number(teams)||2));
    const size=Math.min(Math.floor(people.length/numberOfTeams),Number(cap)>0?Number(cap):999);
    const keeperCount=people.filter(p=>p.primaryPosition==='POR').length;
    // If no keeper is present, do not invent a keeper slot.
    const keeperSeats=includeGoalkeepers&&keeperCount>0?1:0;
    return {people,numberOfTeams,size,outfieldSize:size-keeperSeats,keeperSeats,keeperCount,
      formats:trainingFormationsFor(size-keeperSeats,4).concat(trainingFormationsFor(size-keeperSeats,3))};
  }
  const SHORT = {POR:'POR',DC:'DC',TS:'TS',TD:'TD',BRS:'Braccetto SX',BRD:'Braccetto DX',MEZ:'Mezzala',MED:'Mediano',TREQ:'Trequartista',ED:'Est. destro',ES:'Est. sinistro',PUN:'Punta',AD:'Ala destra',AS:'Ala sinistra'};
  const ALTERNATIVES = {
    DC:{TD:175,TS:175,MED:225},
    TS:{DC:110,ES:100,AS:140,TD:190}, TD:{DC:110,ED:100,AD:140,TS:190},
    BRS:{TS:68,TD:195,ES:140,MED:205}, BRD:{TD:68,TS:195,ED:140,MED:205},
    MEZ:{MED:75,TREQ:70,ES:98,ED:98}, MED:{MEZ:78,DC:140,TREQ:118},
    TREQ:{MEZ:75,PUN:125,AD:105,AS:105},
    ES:{AS:55,TS:95,MEZ:105,ED:185}, ED:{AD:55,TD:95,MEZ:105,ES:185},
    PUN:{AD:78,AS:78,TREQ:95}, AD:{ED:55,PUN:85,AS:160}, AS:{ES:55,PUN:85,AD:160},
    POR:{}
  };
  function groupOf(position){return Object.keys(GROUPS).find(g=>GROUPS[g].includes(position)) || 'CEN';}
  function normalizePlayer(player){
    const primary = POSITIONS[player.primaryPosition] ? player.primaryPosition : DEFAULTS[player.role] || 'MEZ';
    const secondary = POSITIONS[player.secondaryPosition] && player.secondaryPosition!==primary ? player.secondaryPosition : '';
    return {...player,primaryPosition:primary,secondaryPosition:secondary,role:groupOf(primary)};
  }
  function positionCost(player,position){
    const p=normalizePlayer(player);
    if(position==='POR')return p.primaryPosition==='POR'?0:p.secondaryPosition==='POR'?42:850;
    if(p.primaryPosition==='POR')return p.secondaryPosition===position?42:850;
    const main = position==='BRS'||position==='BRD'?'DC':position;
    if(p.primaryPosition===main)return 0;
    if(p.secondaryPosition===main)return 42;
    const alt=ALTERNATIVES[position]||{};
    const first=alt[p.primaryPosition]??420;
    const second= p.secondaryPosition?Math.min(alt[p.secondaryPosition]??420,210):420;
    return Math.min(first,second);
  }
  function labelFor(position){return SHORT[position]||POSITIONS[position]||position;}
  function preferredQuality(player,slot){
    const p=normalizePlayer(player),primary=(slot==='BRS'||slot==='BRD')?'DC':slot;
    if(p.primaryPosition===primary)return 'Principale';
    if(p.secondaryPosition===primary)return 'Secondario';
    return 'Adattato';
  }
  function defenseSlots(defense){return defense===3?['BRS','DC','BRD']:['TS','DC','DC','TD'];}
  function midfieldSlots(count){
    return ({0:[],1:['MED'],2:['MEZ','MED'],3:['MEZ','MED','TREQ'],4:['ES','MEZ','MED','ED'],5:['ES','MEZ','MED','MEZ','ED']})[count]||Array.from({length:count},(_,i)=>i%2?'MEZ':'MED');
  }
  function attackSlots(count){return ({0:[],1:['PUN'],2:['PUN','PUN'],3:['AS','PUN','AD']})[count]||Array.from({length:count},(_,i)=>['AS','PUN','AD'][i%3]);}
  function trainingSlots(groupSize,defense,includeGoalkeepers,formation='auto',keeperSeats=(includeGoalkeepers?1:0)){
    const outfieldCount=groupSize-keeperSeats;
    const choices=trainingFormationsFor(outfieldCount,defense);
    const selected=formation!=='auto' ? formation : (choices[0]||'');
    let rows;
    if(selected && formationSize(selected)===outfieldCount && Number(selected[0])===Number(defense)){
      rows=TRAINING_FORMATIONS[selected];
    } else {
      // Small non-match groups keep the original adaptable role-based layout.
      const defenders=Math.min(Number(defense)===3?3:4,Math.max(0,outfieldCount-2));
      const available=outfieldCount-defenders;
      const attackers=available>=2?Math.max(1,Math.floor(available*.42)):available;
      const middle=available-attackers;
      const defensive=(Number(defense)===3?({0:[],1:['DC'],2:['DC','BRD'],3:['BRS','DC','BRD']}[defenders]):({0:[],1:['DC'],2:['DC','DC'],3:['TS','DC','TD'],4:['TS','DC','DC','TD']}[defenders]));
      rows=[defensive,midfieldSlots(middle),attackSlots(attackers)];
    }
    const slots=[];
    if(keeperSeats)slots.push({key:'POR',label:'Portiere',index:0,row:'POR'});
    rows.forEach((row,i)=>row.forEach(position=>slots.push({key:position,label:labelFor(position),index:slots.length,row:['DIF','CEN','ATT'][i]||'CEN'})));
    return slots;
  }
  function matchSlots(formation){
    const lines=FORMATION_LINES[formation]||FORMATION_LINES['4-3-3'];
    const y=lines.length===3?[72,47,20]:[74,57,38,17];
    const slots=[{id:'P',position:'POR',role:'POR',x:50,y:89,label:'POR'}];
    lines.forEach((line,lineIndex)=>line.forEach((position,i)=>{
      slots.push({id:`${lineIndex}-${i}`,position,role:groupOf(position==='BRS'||position==='BRD'?'DC':position),
        x:(i+1)*100/(line.length+1),y:y[lineIndex],label:labelFor(position)});
    }));
    return slots;
  }
  // Rectangular Hungarian algorithm: each slot gets a unique player, with optional empty slots.
  function minCostMatching(slots,players,restCounts={},options={}){
    const m=slots.length;
    if(!m)return [];
    const normalized=players.map(normalizePlayer);
    const n=Math.max(m,normalized.length);
    const cost=(i,j)=>{
      if(j>=normalized.length)return 2500+j*.0001;
      const p=normalized[j],slot=slots[i];
      const suitability=positionCost(p,slot.key||slot.position);
      // In a match, the assigned role retains a strong priority. The form score
      // discriminates players who are actually compatible with that position.
      const matchScore=options.matchScores?.[p.id];
      const quality=(Number(p.rating)||3)*2.8;
      const pastRest=Math.min(Number(restCounts[p.id])||0,12)*12;
      const tie=((i*23+j*11+i*j*7)%13)*.005;
      return matchScore!==undefined
        ? suitability*3-Math.max(0,Math.min(100,Number(matchScore)||0))+tie
        : suitability-quality-pastRest+tie;
    };
    const u=Array(m+1).fill(0),v=Array(n+1).fill(0),p=Array(n+1).fill(0),way=Array(n+1).fill(0);
    for(let i=1;i<=m;i++){
      p[0]=i;let j0=0;
      const minv=Array(n+1).fill(Infinity),used=Array(n+1).fill(false);
      do{
        used[j0]=true;
        const i0=p[j0];let delta=Infinity,j1=0;
        for(let j=1;j<=n;j++)if(!used[j]){
          const cur=cost(i0-1,j-1)-u[i0]-v[j];
          if(cur<minv[j]){minv[j]=cur;way[j]=j0;}
          if(minv[j]<delta){delta=minv[j];j1=j;}
        }
        for(let j=0;j<=n;j++){
          if(used[j]){u[p[j]]+=delta;v[j]-=delta;}
          else minv[j]-=delta;
        }
        j0=j1;
      }while(p[j0]!==0);
      do{const j1=way[j0];p[j0]=p[j1];j0=j1;}while(j0!==0);
    }
    const result=Array(m).fill(null);
    for(let j=1;j<=n;j++)if(p[j]>0 && j<=normalized.length)result[p[j]-1]=normalized[j-1];
    return result;
  }
  function distributeTraining(ids,allPlayers,{teams=2,cap=0,extra='jolly',defense=4,formation='auto',includeGoalkeepers=true,restCounts={}}={}){
    const roster=new Map(allPlayers.map(p=>{const normalized=normalizePlayer(p);return [p.id,normalized];}));
    const plan=trainingPlan(ids,allPlayers,{teams,cap,includeGoalkeepers});
    const available=plan.people;
    const nGroups=plan.numberOfTeams;
    if(available.length<nGroups*2)return {error:`Servono almeno ${nGroups*2} giocatori disponibili (portieri ${includeGoalkeepers?'inclusi':'esclusi'}).`};
    const size=plan.size;
    if(size<2)return {error:'Ogni squadra deve avere almeno due giocatori.'};
    const choices=trainingFormationsFor(plan.outfieldSize,defense);
    if(formation!=='auto' && (!choices.includes(formation)))return {error:`Il modulo ${formation} non corrisponde ai ${plan.outfieldSize} giocatori di movimento per squadra. Scegli un modulo adatto.`};
    const selected=formation==='auto'?(choices[0]||'libero'):formation;
    const perGroup=trainingSlots(size,defense,includeGoalkeepers,selected,plan.keeperSeats);
    const slots=Array.from({length:nGroups},(_,team)=>perGroup.map(slot=>({...slot,team}))).flat();
    const results=minCostMatching(slots,available,restCounts);
    const slotRows=Array.from({length:nGroups},()=>[]);
    results.forEach((player,index)=>{
      const slot=slots[index];
      slotRows[slot.team].push({key:slot.key,label:slot.label,row:slot.row,id:player?.id||null});
    });
    // Swap equally suitable assignments between teams to keep technical ratings balanced.
    const scoreTeam=g=>g.reduce((sum,x)=>sum+(roster.get(x.id)?.rating||0),0);
    const spread=()=>{const strengths=slotRows.map(scoreTeam);return Math.max(...strengths)-Math.min(...strengths);};
    for(let iter=0;iter<18;iter++){
      let best=null,bestGain=0;
      for(let a=0;a<nGroups;a++)for(let b=a+1;b<nGroups;b++){
        const sa=scoreTeam(slotRows[a]),sb=scoreTeam(slotRows[b]);
        for(let i=0;i<slotRows[a].length;i++)for(let j=0;j<slotRows[b].length;j++){
          const s1=slotRows[a][i],s2=slotRows[b][j],p1=roster.get(s1.id),p2=roster.get(s2.id);
          if(!p1||!p2)continue;
          const before=positionCost(p1,s1.key)+positionCost(p2,s2.key);
          const after=positionCost(p2,s1.key)+positionCost(p1,s2.key);
          if(after>before+10)continue;
          const newDiff=Math.abs((sa-p1.rating+p2.rating)-(sb-p2.rating+p1.rating));
          const gain=Math.abs(sa-sb)-newDiff-(after-before)*.1;
          if(gain>bestGain+.00001){bestGain=gain;best={a,b,i,j};}
        }
      }
      if(!best)break;
      const {a,b,i,j}=best;[slotRows[a][i].id,slotRows[b][j].id]=[slotRows[b][j].id,slotRows[a][i].id];
      if(spread()<=1)break;
    }
    const groups=slotRows.map(g=>g.filter(s=>s.id).map(s=>s.id));
    const used=new Set(groups.flat());
    const leftover=available.map(p=>p.id).filter(id=>!used.has(id));
    let joker=null;
    if(extra==='jolly' && nGroups===2 && leftover.length){
      const index=leftover.findIndex(id=>roster.get(id)?.role!=='POR');
      joker=leftover.splice(index>=0?index:0,1)[0];
    }
    return {groups,slotsByGroup:slotRows,joker,bench:leftover,available:available.map(p=>p.id),size,defense,formation:selected,goalkeeperSeats:plan.keeperSeats,outfieldSize:plan.outfieldSize,includeGoalkeepers};
  }
  // Match week: Monday 00:00 through the day before kick-off, never future dates.
  // The form uses only previous matches (last five within 45 days). Ratings
  // in the roster remain untouched; this is a temporary selection index.
  function matchFormMetrics(matchDate,players,attendanceCertified,matches){
    const day=/^\d{4}-\d{2}-\d{2}$/.test(matchDate||'')?matchDate:null;
    if(!day)return {weekStart:'',weekEnd:'',weekDates:[],recentMatches:[],byId:{}};
    const utc=Date.parse(`${day}T00:00:00Z`);
    const dow=new Date(utc).getUTCDay();
    const monday=new Date(utc-((dow+6)%7)*86400000).toISOString().slice(0,10);
    const prevDay=new Date(utc-86400000).toISOString().slice(0,10);
    const weekDates=Object.keys(attendanceCertified||{}).filter(d=>d>=monday&&d<day&&Array.isArray(attendanceCertified[d]?.ids)).sort();
    const cutoff=new Date(utc-45*86400000).toISOString().slice(0,10);
    const recentMatches=(matches||[]).filter(m=>m.date>=cutoff&&m.date<day&&(
      (m.events||[]).length || m.gf!==null&&m.gf!==undefined || m.ga!==null&&m.ga!==undefined
    )).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
    const byId={};
    for(const p of players||[]){
      const trainings=weekDates.filter(d=>attendanceCertified[d].ids.includes(p.id)).length;
      const goals=recentMatches.reduce((count,m)=>count+(m.events||[]).filter(e=>e.type==='gol'&&e.playerId===p.id).length,0);
      const assists=recentMatches.reduce((count,m)=>count+(m.events||[]).filter(e=>e.type==='assist'&&e.playerId===p.id || e.type==='gol'&&e.assistId===p.id).length,0);
      const technical=Math.max(1,Math.min(5,Number(p.rating)||3))*4;
      const attendance=weekDates.length?35*trainings/weekDates.length:0;
      const recent=Math.min(45,goals*12+assists*8);
      byId[p.id]={trainings,trainingsTotal:weekDates.length,goals,assists,
        technicalPoints:Math.round(technical*10)/10,
        attendancePoints:Math.round(attendance*10)/10,
        recentPoints:recent,
        formScore:Math.round((technical+attendance+recent)*10)/10};
    }
    return {weekStart:monday,weekEnd:prevDay,weekDates,recentMatches:recentMatches.map(m=>m.date),byId};
  }
  function makeMatchLineup(formation,players,matchScores={}){
    const slots=matchSlots(formation);
    const results=minCostMatching(slots.map(s=>({key:s.position})),players,{}, {matchScores});
    return results.map(p=>p?.id||null);
  }
  root.CampoCoachTactics={POSITIONS,GROUPS,DEFAULTS,FORMATION_LINES,TRAINING_FORMATIONS,trainingFormationsFor,trainingPlan,normalizePlayer,groupOf,positionCost,preferredQuality,trainingSlots,matchSlots,distributeTraining,makeMatchLineup,matchFormMetrics};
  if(typeof module!=='undefined'&&module.exports)module.exports=root.CampoCoachTactics;
})(typeof globalThis!=='undefined'?globalThis:this);
