import {migrate,beginCombat,nextTurn as combatNext,act as combatAct,currentActor} from './combat.js';
import {initialState,reduce,describe,woundState} from './engine.js';
import {campaigns,campaignById} from './campaigns.js';
const KEY='cyberpunk-red-solo-state-v3';let state;let busy=false;
const $=id=>document.getElementById(id);const format=(t)=>new Date(t).toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit'});
function validate(s){if(!s||![1,2,3].includes(s.version)||typeof s.revision!=='number'||!s.player||!Array.isArray(s.enemies)||!s.combat||!Array.isArray(s.journal)||!Array.isArray(s.pendingNarration))throw Error('Nieprawidłowy format zapisu');if(!Number.isInteger(s.player.hp)||s.player.hp<0||s.player.hp>s.player.maxHp||!['head','body'].every(k=>Number.isInteger(s.player.armor[k])&&s.player.armor[k]>=0)||!Number.isInteger(s.player.weapon.ammo)||s.player.weapon.ammo<0||s.player.weapon.ammo>s.player.weapon.magazine||s.journal.length>1000||s.pendingNarration.length>100)throw Error('Uszkodzone wartości stanu');return migrate(s);}
try{state=validate(JSON.parse(localStorage.getItem(KEY)||localStorage.getItem('cyberpunk-red-solo-state-v2')||localStorage.getItem('cyberpunk-red-solo-state-v1')));}catch{state=migrate(initialState());}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch{alert('Błąd zapisu danych. Wyeksportuj kampanię teraz.');}}
function entry(kind,text){state.journal.push({kind,text:String(text).slice(0,2600),at:new Date().toISOString()});if(state.journal.length>350)state.journal=state.journal.slice(-350);save();renderLog(true);}
function render(){const p=state.player;const t=state.enemies.find(e=>e.id===state.combat.targetId);$('playerName').textContent=p.name;$('hpText').textContent=`${p.hp} / ${p.maxHp}`;$('hpBar').style.width=`${p.hp/p.maxHp*100}%`;$('headSP').textContent=p.armor.head;$('bodySP').textContent=p.armor.body;$('ammo').textContent=`${p.weapon.ammo} / ${p.weapon.reserve}`;$('medkits').textContent=p.medkits;$('woundState').textContent=woundState(p).toUpperCase();$('location').textContent=state.campaign.location;$('turn').textContent=`RUNDA ${state.combat.round||0} • ${state.combat.turn?state.combat.turn.actorId:'START'}`;$('sceneTitle').textContent=state.campaign.title;$('sceneDescription').textContent=state.campaign.scene;$('targetName').textContent=t?.name||'BRAK CELU'; if($('enemySelect')){$('enemySelect').replaceChildren(...state.enemies.map(e=>{const o=document.createElement('option');o.value=e.id;o.textContent=`${e.name} • ${e.hp} PW${e.dead?' [MARTWY]':''}`;return o;}));$('enemySelect').value=state.combat.targetId;}$('turnInfo').textContent=state.combat.turn?`${state.combat.turn.actorId==='player'?'TWOJA TURA':('TURA '+(state.enemies.find(e=>e.id===state.combat.turn.actorId)?.name||'NPC'))} • Ataki ${state.combat.turn.attackCount}/${(state.combat.turn.actorId==='player'?state.player:state.enemies.find(e=>e.id===state.combat.turn.actorId))?.weapon?.rateOfFire||1} • Ruch ${state.combat.turn.moveSpent} m`:'Rozpocznij walkę, aby ustalić inicjatywę';;$('targetHp').textContent=t?`${t.hp}/${t.maxHp} PŻ • SP ${t.armor.body}`:'';$('distance').value=state.combat.distance;$('pending').hidden=state.pendingNarration.length===0;$('network').textContent=navigator.onLine?'● ONLINE / OFFLINE READY':'● OFFLINE';renderLog();}
function renderLog(follow=false){const box=$('log');const previous=box.scrollTop;const wasAtBottom=box.scrollTop+box.clientHeight>=box.scrollHeight-80;box.replaceChildren();const latest=state.journal.at(-1);$('liveKind').textContent=latest?.kind==='mechanic'?'SILNIK':latest?.kind==='narrative'?'MISTRZ GRY':latest?.kind==='error'?'BŁĄD':'SYSTEM';$('liveText').textContent=latest?.text||'Gotowość do akcji. Rozpocznij walkę.';$('liveText').parentElement.className='live '+(latest?.kind||'');$('journalCount').textContent=Math.min(state.journal.length,99);for(const e of state.journal.slice(-90)){const el=document.createElement('article');el.className=`entry ${['mechanic','narrative','error'].includes(e.kind)?e.kind:''}`;const top=document.createElement('small');top.textContent=`${e.kind==='mechanic'?'SILNIK':e.kind==='narrative'?'MISTRZ GRY':e.kind==='error'?'BŁĄD':'SYSTEM'} • ${format(e.at)}`;const p=document.createElement('p');p.textContent=e.text;el.append(top,p);box.append(el);}box.scrollTop=follow&&wasAtBottom?box.scrollHeight:previous;}
function showWorkspace(name){const journal=name==='journal';$('combatPanel').hidden=journal;$('journalPanel').hidden=!journal;$('combatTab').classList.toggle('active',!journal);$('journalTab').classList.toggle('active',journal);$('combatTab').setAttribute('aria-selected',String(!journal));$('journalTab').setAttribute('aria-selected',String(journal));if(journal)requestAnimationFrame(()=>$('log').scrollTop=$('log').scrollHeight);}
function mechanics(type,extra={}){try{const out=reduce(state,{type,...extra});state=out.state;entry('mechanic',friendlyMechanicText(out.event,describe(out.event)));save();render();if(['ATTACK','ENEMY_ATTACK','DODGE','RELOAD','MEDKIT','STABILIZE','REST_DAY','NEXT_TURN'].includes(type)){if(state.pendingNarration.length>70)state.pendingNarration.shift();state.pendingNarration.push({id:`${state.revision}-${Date.now()}`,event:out.event,scene:state.campaign.scene,location:state.campaign.location,character:{name:state.player.name,hp:state.player.hp,maxHp:state.player.maxHp},enemy:state.enemies.map(x=>({name:x.name,hp:x.hp})),turn:state.campaign.turn});save();render();narrate();}}catch(e){entry('error',friendlyError(e.message));}}
async function narrate(){if(busy||!navigator.onLine||!state.pendingNarration.length)return;busy=true;const item=state.pendingNarration[0];const secret=sessionStorage.getItem('proxySecret')||'';try{const resp=await fetch('/api/narrate',{method:'POST',headers:{'content-type':'application/json',...(secret?{'x-solo-secret':secret}:{})},body:JSON.stringify({event:item.event,scene:item.scene,location:item.location,character:item.character,enemy:item.enemy,turn:item.turn}),signal:AbortSignal.timeout(25000)});const result=await resp.json().catch(()=>({}));if(!resp.ok)throw Error(result.error||`Błąd API HTTP ${resp.status}`);if(!result.text||typeof result.text!=='string')throw Error('Pusta odpowiedź narratora');state.pendingNarration=state.pendingNarration.filter(x=>x.id!==item.id);entry('narrative',result.text);save();render();}catch(e){$('pending').hidden=false;$('pending').firstChild.textContent=`Narrator niedostępny (${e.message}). `;}finally{busy=false;if(state.pendingNarration.length&&state.pendingNarration[0].id!==item.id&&navigator.onLine)queueMicrotask(narrate);}}
function combatRun(action,fn){try{const out=fn();state=out.state;for(const e of out.events){entry('mechanic',friendlyCombatEvent(e));if(state.pendingNarration.length<70&&['SHOT','STABILIZE','SURVIVAL'].includes(e.type))state.pendingNarration.push({id:`${state.revision}-${Date.now()}-${Math.random()}`,event:e,scene:state.campaign.scene,location:state.campaign.location,character:{name:state.player.name,hp:state.player.hp},enemy:state.enemies.map(x=>({name:x.name,hp:x.hp})),turn:state.combat.round});}save();render();narrate();}catch(err){entry('error',friendlyError(err.message));}}
function playerAct(type,extra={}){combatRun(type,()=>combatAct(state,{type,actorId:'player',...extra}));}
$('startCombat').onclick=()=>combatRun('START',()=>beginCombat(state));
$('attack').onclick=()=>playerAct('ATTACK',{targetId:state.combat.targetId});
$('dodge').onclick=()=>playerAct('DODGE');$('reload').onclick=()=>playerAct('RELOAD');
$('moveBtn').onclick=()=>playerAct('MOVE',{meters:Number($('moveMeters').value)});
$('coverBtn').onclick=()=>playerAct('COVER',{hp:Number($('coverHp').value)});
$('leaveCover').onclick=()=>playerAct('LEAVE_COVER');
$('enemyAttack').onclick=()=>{const id=currentActor(state);if(!id||id==='player'){entry('error','Atak wroga możliwy wyłącznie w turze NPC');return;}combatRun('ENEMY',()=>combatAct(state,{type:'ATTACK',actorId:id,targetId:'player'}));};
$('nextTurn').onclick=()=>combatRun('NEXT',()=>combatNext(state));
$('enemySelect').onchange=e=>{state.combat.targetId=e.target.value;save();render();};
$('addEnemy').onclick=()=>{const count=state.enemies.length;if(count>=8){entry('error','Limit 8 wrogów');return;}const e=structuredClone(state.enemies[0]);e.id=`enemy-${Date.now()}`;e.name=`Scavenger ${count+1}`;e.hp=e.maxHp;e.dead=false;e.injuries=[];e.weapon.ammo=e.weapon.magazine;state.enemies.push(e);save();render();};
$('setCombat').onclick=()=>{const d=Number($('distance').value);if(!Number.isFinite(d)||d<0||d>800){entry('error','Dystans 0–800 m');return;}state.combat.distance=d;save();render();};
$('sendIntent').onclick=()=>{const value=$('intent').value.trim();if(!value)return;$('intent').value='';entry('system',`Deklaracja postaci (niewiążąca mechanicznie): ${value}`);if(state.pendingNarration.length>70)state.pendingNarration.shift();state.pendingNarration.push({id:`intent-${Date.now()}`,event:{type:'PLAYER_INTENT',intent:value,note:'Wyłącznie fikcja, bez zmiany stanu lub rzutu.'},scene:state.campaign.scene,location:state.campaign.location,character:{name:state.player.name,hp:state.player.hp,maxHp:state.player.maxHp},enemy:state.enemies.map(x=>({name:x.name,hp:x.hp})),turn:state.campaign.turn});save();render();narrate();};
$('combatTab').onclick=()=>showWorkspace('combat');$('journalTab').onclick=()=>showWorkspace('journal');$('menuBtn').onclick=()=>$('options').showModal();$('moreActions').onclick=()=>$('quickMenu').showModal();$('quickActions').addEventListener('click',e=>{const btn=e.target.closest('[data-go]');if(!btn)return;$('quickMenu').close();if(btn.dataset.go==='settings')$('options').showModal();else if(btn.dataset.go==='medkit')playerAct('STABILIZE');else if(btn.dataset.go==='endTurn')playerAct('END_ACTION');else $(btn.dataset.go)?.click();});const fontChoice=localStorage.getItem('red-solo-font')||'normal';document.body.classList.add('font-'+fontChoice);$('fontScale').value=fontChoice;$('fontScale').onchange=e=>{document.body.classList.remove('font-small','font-normal','font-large');document.body.classList.add('font-'+e.target.value);localStorage.setItem('red-solo-font',e.target.value);};$('proxySecret').value=sessionStorage.getItem('proxySecret')||'';$('proxySecret').onchange=e=>sessionStorage.setItem('proxySecret',e.target.value);
$('export').onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`red-solo-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);};
$('import').onchange=async(e)=>{const file=e.target.files[0];if(!file)return;try{if(file.size>1_000_000)throw Error('Plik jest za duży');const parsed=validate(JSON.parse(await file.text()));if(!confirm('Zastąpić bieżącą kampanię?'))return;state=parsed;save();render();$('options').close();}catch(err){alert(`Błąd importu: ${err.message}`);}finally{e.target.value='';}};
$('reset').onclick=()=>{if(!confirm('Nieodwracalnie rozpocząć nową kampanię? Wykonaj eksport, jeśli chcesz zachować obecną.'))return;state=migrate(initialState());save();render();$('options').close();};
$('healBtn').onclick=()=>{const actor=currentActor(state);if(!actor){entry('error','Rozpocznij walkę, by wykonać test');return;}const patient=state.player;const injuries=patient.injuries.filter(i=>!i.healed);if(!injuries.length){entry('error','Brak ran krytycznych postaci');return;}const info=injuries.map(i=>`${i.id} : ${i.name}`).join('\n');const injuryId=prompt(`Wpisz ID rany postaci do leczenia/łatania:\n${info}`,injuries[0].id);if(!injuryId)return;const type=confirm('OK = leczenie trwałe (4 godziny), Anuluj = łatanie (1 minuta)')?'HEAL':'PATCH';const skill=prompt('Umiejętność: firstAid, paramedic, surgery',type==='PATCH'?'firstAid':'paramedic');if(!skill)return;combatRun(type,()=>combatAct(state,{type,actorId:actor,targetId:'player',injuryId,skill}));$('options').close();};
$('medicalDay').onclick=()=>{if(!confirm('Minął pełny dzień? Zakończy to tymczasowe łatanie ran.'))return;state.player.medicalDay=(state.player.medicalDay||0)+1;for(const e of state.enemies)e.medicalDay=(e.medicalDay||0)+1;entry('mechanic','Minął dzień. Tymczasowe opatrunki tracą działanie.');render();$('options').close();};
$('stabilize').onclick=()=>{mechanics('STABILIZE');$('options').close();};$('rest').onclick=()=>{if(confirm('Czy postać została wcześniej ustabilizowana i odpoczywała pełną dobę?'))mechanics('REST_DAY',{confirmed:true});$('options').close();};
function createCampaignUI(){
 const campaignStyles=document.createElement('link');campaignStyles.rel='stylesheet';campaignStyles.href='/campaign.css';document.head.append(campaignStyles);
 const card=document.createElement('section');card.className='missionCard';card.innerHTML='<div class="missionKicker">GOTOWA KAMPANIA • BEZ PRZYGOTOWAŃ</div><h2 id="missionTitle"></h2><p id="missionObjective"></p><button id="missionAction" class="primary"></button><small id="missionHint" class="missionHint"></small>';
 $('combatPanel').prepend(card);
 const dialog=document.createElement('dialog');dialog.id='campaignDialog';dialog.innerHTML='<div class="modalTitle"><h2>NOWA GRA</h2><button class="iconButton" id="closeCampaign" aria-label="Zamknij">✕</button></div><article class="campaignChoice"><small>GOTOWA KAMPANIA • OK. 20–30 MIN</small><h3>Dług w Kabuki</h3><p>Odzyskaj skradziony pakiet danych. Gotowe sceny, przygotowani przeciwnicy i jasny cel w każdej chwili.</p><button id="startCampaign" class="primary">Rozpocznij grę</button></article><p class="tiny">Nie musisz tworzyć postaci ani wymyślać przeciwników. Gra zapisuje się automatycznie.</p>';
 document.body.append(dialog);$('closeCampaign').onclick=()=>dialog.close();
 $('startCampaign').onclick=()=>{if(state.revision>0&&!confirm('Rozpocząć nową grę? Bieżący zapis zostanie zastąpiony. Wcześniej możesz go wyeksportować w Opcjach.'))return;startCampaign(campaigns[0]);dialog.close();};
 $('missionAction').onclick=advanceCampaign;
 $('reset').onclick=()=>dialog.showModal();
 $('campaignActionBtn')?.addEventListener('click',()=>dialog.showModal());
 const optionsButton=document.createElement('button');optionsButton.id='campaignActionBtn';optionsButton.type='button';optionsButton.textContent='Nowa gra • gotowa kampania';optionsButton.onclick=()=>dialog.showModal();$('options').querySelector('.modalGrid').prepend(optionsButton);
 for(const id of ['addEnemy','setCombat','enemyAttack','nextTurn'])$(id)?.remove();
 for(const action of ['addEnemy','setCombat','enemyAttack','nextTurn','startCombat'])$('quickActions').querySelector(`[data-go="${action}"]`)?.remove();
 $('moveMeters').value='4';$('moveMeters').closest('label').hidden=true;$('coverHp').value='20';$('coverHp').closest('label').hidden=true;
 $('distance').closest('label').hidden=true;
 $('moveBtn').textContent='Ruch • 4 m';$('coverBtn').textContent='Schowaj się za osłoną';$('leaveCover').textContent='Opuść osłonę';
 $('combatPanel').querySelectorAll('.actionsLine.advanced')[1]?.setAttribute('hidden','');
 $('quickActions').querySelector('[data-go="moveBtn"]').textContent='↗ Rusz o 4 m';
 $('quickActions').querySelector('[data-go="coverBtn"]').textContent='▣ Schowaj się za osłoną';
 $('quickActions').querySelector('[data-go="leaveCover"]').textContent='⇥ Opuść osłonę';
 $('quickMenu').querySelector('.tiny').textContent='Ruch i osłona są dostępne w tym menu. Przeciwnicy wykonują swoje tury automatycznie.';
 $('options').querySelector('.tiny').textContent='Po rozpoczęciu walki tury przeciwników rozgrywają się automatycznie. Ruch i osłona są opcjonalne i dostępne w menu Więcej.';
 const endTurn=document.createElement('button');endTurn.type='button';endTurn.id='endTurnBtn';endTurn.dataset.go='endTurn';endTurn.textContent='✓ Zakończ swoją turę';$('quickActions').prepend(endTurn);
 return {card,dialog};
}
function startCampaign(definition){
 state=migrate(initialState());const first=definition.stages[0];state.player.name=definition.playerName;state.campaign={...state.campaign,id:definition.id,stage:0,title:definition.title,location:definition.location,scene:first.scene,turn:1};
 state.enemies[0].name='Strażnik magazynu';state.enemies[0].hp=state.enemies[0].maxHp=20;state.combat.targetId=state.enemies[0].id;state.journal=[];save();entry('system',`Przyjęto zlecenie: ${definition.title}. ${first.objective}`);render();
}
function advanceCampaign(){
 const def=campaignById(state.campaign.id);if(!state.campaign.id){campaignUI.dialog.showModal();return;}const stage=def.stages[state.campaign.stage];if(stage?.requiresClear&&state.enemies.some(enemy=>!enemy.dead&&enemy.hp>0)){entry('system','Najpierw oczyść drogę z przeciwników.');return;}
 if(state.campaign.stage===1){const template=initialState().enemies[0];state.enemies=[0,1].map((_,i)=>({...structuredClone(template),id:`kabuki-${i+1}`,name:i?'Ochroniarz 2':'Ochroniarz 1',dead:false}));state.combat.targetId=state.enemies[0].id;state.combat.active=false;state.combat.order=[];state.combat.turn=null;state.combat.index=0;state.combat.round=0;state.combat.distance=12;}
 state.campaign.stage=Math.min(state.campaign.stage+1,def.stages.length-1);const next=def.stages[state.campaign.stage];state.campaign.title=next.title;state.campaign.scene=next.scene;state.campaign.turn++;save();entry('system',next.objective);render();
}
function renderCampaign(){
 const def=state.campaign.id?campaignById(state.campaign.id):null;const stage=def?.stages[state.campaign.stage];$('missionTitle').textContent=stage?.title||'Chcesz po prostu zacząć grać?';$('missionObjective').textContent=stage?.objective||'Wybierz gotową misję. Postać, sceny i przeciwnicy będą już przygotowani.';
 const action=$('missionAction'),hint=$('missionHint');action.hidden=!!stage?.complete;action.textContent=stage?.action||(def?'':'Rozpocznij gotową kampanię');const blocked=!!stage?.requiresClear&&state.enemies.some(enemy=>!enemy.dead&&enemy.hp>0);action.disabled=blocked;hint.textContent=blocked?'Najpierw pokonaj przeciwników, a ten przycisk odblokuje kolejny etap.':stage?.complete?'':def?'':'Jedna misja jest już gotowa. Kolejne dodamy później.';
 if(stage?.complete){action.hidden=false;action.textContent='Rozpocznij nową grę';action.disabled=false;action.onclick=()=>campaignUI.dialog.showModal();}else action.onclick=advanceCampaign;
}
function friendlyCombatEvent(e){
 const result=e.test?.success;
 switch(e.type){
 case 'INITIATIVE':{const first=e.order[0]?.id;const name=first==='player'?state.player.name:state.enemies.find(enemy=>enemy.id===first)?.name||'przeciwnik';return `Walka rozpoczęta. Zaczyna ${first==='player'?'twoja postać':name}.`;}
 case 'TURN_START':return e.actorId==='player'?'Twoja tura.':`Teraz działa: ${e.actor}.`;
 case 'SHOT':if(e.cover)return result?`${e.actor} strzela do ${e.target}, ale pocisk trafia w osłonę.`:`${e.actor} strzela do ${e.target}, ale nie trafia.`;if(!result)return `${e.actor} strzela do ${e.target}, ale nie trafia.`;if(e.damage?.hpLost>0)return `${e.actor} trafia ${e.target}. Utrata ${e.damage.hpLost} PŻ${e.damage.injury?`. Poważna rana: ${e.damage.injury.name}.`:'.'}`;return `${e.actor} trafia ${e.target}, ale pancerz zatrzymuje obrażenia.`;
 case 'SURVIVAL':return e.success?`${e.actor} jest ciężko ranny, ale nadal walczy.`:`${e.actor} nie przeżywa ran.`;
 case 'MOVE':return `${e.actor} przesuwa się o ${e.meters} m.`;
 case 'RELOAD':return `${e.actor} przeładowuje broń. Nabojów w magazynku: ${e.ammo}.`;
 case 'STABILIZE':return `${e.test?.success?'Udało się':'Nie udało się'} ustabilizować ${e.target}.`;
 case 'PATCH':case 'HEAL':return `${e.test?.success?'Udało się':'Nie udało się'} opatrzyć rany: ${e.injury}.`;
 case 'MOVEMENT_INJURY':return `Rany utrudniają ruch. ${e.actor} traci ${e.lost} PŻ.`;
 case 'COVER':return `${e.actor} chowa się za osłoną.`;
 case 'LEAVE_COVER':return `${e.actor} wychodzi zza osłony.`;
 case 'DODGE':return `${e.actor} przygotowuje unik.`;
 case 'END_ACTION':return 'Kończysz swoją turę.';
 case 'COMBAT_END':return 'Walka dobiegła końca.';
 case 'SPINE_STUN':return `${e.actor} nie może działać w tej turze.`;
 default:return e.actor?`${e.actor}: ${e.type}.`:'Walka trwa.';
 }
}
function friendlyMechanicText(e,fallback){
 if(e.type==='ATTACK')return e.test.success?(e.damage?.hpLost>0?`Trafiasz ${e.target}. Utrata ${e.damage.hpLost} PŻ${e.damage.injury?`. Poważna rana: ${e.damage.injury.name}.`:'.'}`:`Trafiasz ${e.target}, ale pancerz zatrzymuje obrażenia.`):`Nie trafiasz ${e.target}.`;
 if(e.type==='ENEMY_ATTACK')return e.test.success?`Wróg trafia. Tracisz ${e.damage?.hpLost||0} PŻ.`:'Wróg strzela, ale nie trafia.';
 if(e.type==='DODGE')return 'Przygotowujesz unik.';
 if(e.type==='RELOAD')return `Przeładowujesz broń. Nabojów w magazynku: ${e.ammoAfter}.`;
 if(e.type==='STABILIZE')return `Stabilizacja: ${e.test.success?'udało się':'nie udało się'}.`;
 if(e.type==='REST_DAY')return `Odpoczywasz. Odzyskujesz ${e.hpGained} PŻ.`;
 if(e.type==='NEXT_TURN')return 'Twoja tura dobiegła końca.';
 return fallback;
}
function friendlyError(message){return ({'Walka już trwa':'Walka już się toczy.','Brak żywego celu':'Nie ma już aktywnego celu.','Nie jest to tura tej postaci':'Poczekaj na swoją turę.','Brak amunicji':'Nie masz amunicji. Przeładuj broń.','Nie ma czego przeładować':'Magazynek jest pełny albo skończyła się amunicja zapasowa.','Najpierw rozpocznij walkę':'Najpierw rozpocznij walkę.'})[message]||message;}
function refreshTarget(){const alive=state.enemies.filter(e=>!e.dead&&e.hp>0);const current=alive.find(e=>e.id===state.combat.targetId);if(!current&&alive[0])state.combat.targetId=alive[0].id;}
function renderCombatUI(){
 const started=!!(state.combat.active&&state.combat.order.length&&state.combat.turn);const playerTurn=started&&state.combat.turn.actorId==='player';const rof=state.player.weapon.rateOfFire||1;const playerCanAct=playerTurn&&!state.combat.turn.majorUsed&&state.combat.turn.attackCount<rof;const living=state.enemies.filter(e=>!e.dead&&e.hp>0);
 $('startCombat').hidden=started||!living.length;$('startCombat').parentElement.hidden=$('startCombat').hidden;
 $('enemySelect').closest('label').hidden=living.length<2;
 $('turnInfo').textContent=!started?'Gdy będziesz gotów, rozpocznij walkę.':playerCanAct?'Twoja tura. Wybierz działanie.':playerTurn?'Twoja akcja dobiegła końca. Kolej na przeciwnika…':`${state.enemies.find(e=>e.id===state.combat.turn.actorId)?.name||'Przeciwnik'} wykonuje ruch…`;
 $('turn').textContent=started?`RUNDA ${String(state.combat.round).padStart(2,'0')}`:'GOTOWOŚĆ';
 for(const id of ['attack','dodge','reload'])$(id).hidden=!playerCanAct;
 for(const action of ['moveBtn','coverBtn','leaveCover','endTurn','medkit']){const button=$('quickActions').querySelector(`[data-go="${action}"]`);if(button)button.hidden=!playerCanAct;}
}
function finishEncounterIfClear(){if(!state.combat.order.length||!state.enemies.length||state.enemies.some(e=>!e.dead&&e.hp>0))return false;state.combat.active=false;state.combat.turn=null;state.combat.order=[];state.combat.index=0;state.combat.round=0;save();entry('system','Wrogowie pokonani. Droga jest wolna.');render();return true;}
const baseCombatRun=combatRun;let combatFlowTimer=null,combatFlowBusy=false;
function scheduleCombatFlow(){
 if(combatFlowTimer||combatFlowBusy||!state.combat.active||!state.combat.turn||!state.combat.order.length)return;
 if(state.enemies.length&&state.enemies.every(e=>e.dead||e.hp<=0)){finishEncounterIfClear();return;}
 const turn=state.combat.turn;
 if(turn.actorId==='player'){
  const rate=state.player.weapon.rateOfFire||1;if(!turn.majorUsed&&turn.attackCount<rate)return;
  combatFlowTimer=setTimeout(()=>{combatFlowTimer=null;combatFlowBusy=true;baseCombatRun('NEXT',()=>combatNext(state));combatFlowBusy=false;finishEncounterIfClear();scheduleCombatFlow();},550);return;
 }
 combatFlowTimer=setTimeout(()=>{
  combatFlowTimer=null;const actor=currentActor(state),enemy=state.enemies.find(e=>e.id===actor);if(!enemy){combatFlowBusy=true;baseCombatRun('NEXT',()=>combatNext(state));combatFlowBusy=false;scheduleCombatFlow();return;}
  combatFlowBusy=true;entry('system',`${enemy.name} wykonuje swoją turę.`);
  const fireAndContinue=()=>{combatFlowTimer=null;baseCombatRun('NPC',()=>combatAct(state,{type:'ATTACK',actorId:actor,targetId:'player'}));const turn=state.combat.turn;const canFireAgain=turn?.actorId===actor&&!turn.majorUsed&&turn.attackCount<(enemy.weapon.rateOfFire||1)&&enemy.weapon.ammo>0&&state.player.hp>0;
   combatFlowTimer=setTimeout(()=>{combatFlowTimer=null;if(canFireAgain)fireAndContinue();else{if(state.combat.active&&state.combat.turn)baseCombatRun('NEXT',()=>combatNext(state));combatFlowBusy=false;finishEncounterIfClear();scheduleCombatFlow();}},550);
  };
  combatFlowTimer=setTimeout(fireAndContinue,500);
 },650);
}
combatRun=function(action,fn){baseCombatRun(action,fn);finishEncounterIfClear();scheduleCombatFlow();};
const campaignUI=createCampaignUI();const baseRender=render;render=()=>{refreshTarget();baseRender();renderCampaign();renderCombatUI();};const baseRenderLog=renderLog;renderLog=(follow=false)=>{baseRenderLog(follow);$('liveKind').textContent=$('liveKind').textContent==='SILNIK'?'GRA':$('liveKind').textContent;document.querySelectorAll('.entry small').forEach(item=>{if(item.textContent.startsWith('SILNIK'))item.textContent=item.textContent.replace('SILNIK','GRA');});};render();narrate();
if(!localStorage.getItem(KEY)&&!localStorage.getItem('cyberpunk-red-solo-state-v2')&&!localStorage.getItem('cyberpunk-red-solo-state-v1'))startCampaign(campaigns[0]);
scheduleCombatFlow();

