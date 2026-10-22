import {rollD10,rollDamage,rangeDV,check,applyDamage,woundState,die} from './engine.js';
const clone=x=>structuredClone(x);
// Easy Mode p.22-23: patch = 1 minute, until end of day; treatment = 4h.
export const INJURY_RULES={
2:{patch:[],heal:[['surgery',17]],survival:1,disablesHand:true},
3:{patch:[],heal:[['surgery',17]],survival:1,disablesHand:true},
4:{patch:[['paramedic',15]],heal:[['surgery',15]],survival:1,move:-2},
5:{patch:[['paramedic',13]],heal:[['paramedic',15],['surgery',13]],moveDamage:5},
6:{patch:[['paramedic',13]],heal:[['paramedic',15],['surgery',13]],disablesHand:true},
7:{patch:[['firstAid',13],['paramedic',13]],heal:[],patchPermanent:true,moveDamage:5},
8:{patch:[['paramedic',13]],heal:[['paramedic',15],['surgery',13]],move:-4},
9:{patch:[['firstAid',13],['paramedic',13]],heal:[],patchPermanent:true,melee:-2},
10:{patch:[['paramedic',15]],heal:[['surgery',15]],survival:1,spine:true},
11:{patch:[['paramedic',13]],heal:[['surgery',15]],handAction:-4},
12:{patch:[],heal:[['surgery',17]],survival:1,move:-6,noDodge:true}
};
export function activeInjuries(a){return (a.injuries||[]).filter(i=>!i.healed && (i.patchedUntilDay==null || i.patchedUntilDay<(a.medicalDay||0)));}
export function medicalCheck(actor,skill,dv,rand){if(skill==='surgery'&&!actor.isMedtech)throw Error('Chirurgia jest dostępna wyłącznie dla Medyka');const rating=actor.skills?.[skill];if(!Number.isFinite(rating))throw Error(`Brak umiejętności: ${skill}`);return check((actor.stats.TECH||0)+rating+penalty(actor),dv,rand);}

const fighter=(s,id)=>id==='player'?s.player:s.enemies.find(e=>e.id===id);
const penalty=a=>a.hp<1?-4:a.hp<=a.maxHp/2?-2:0;
const movement=a=>Math.max(1,(a.stats.MOVE??5)-(a.hp<1?6:0)-activeInjuries(a).reduce((sum,i)=>sum+([4,8,12].includes(i.number)?({4:2,8:4,12:6}[i.number]):0),0));
const severe=a=>a.hp<1&&!a.dead;
export function migrate(src){const s=clone(src);s.version=3;for(const f of [s.player,...s.enemies]){f.injuries=(f.injuries||[]).map((i,n)=>({...i,id:i.id||`legacy-${f.id}-${n}-${i.number}`,healed:!!i.healed,patchedUntilDay:i.patchedUntilDay??null}));}s.enemies=s.enemies.map((e,i)=>({...e,id:e.id||`enemy-${i+1}`,dead:!!e.dead,medicalDay:e.medicalDay||0,stats:{MOVE:5,BODY:5,...e.stats},weapon:e.weapon||{name:'Pistolet',type:'pistol',damageDice:3,magazine:8,ammo:8,reserve:24,rateOfFire:2},stabilized:!!e.stabilized,survivalPenalty:e.survivalPenalty||0,cover:e.cover||null}));s.player={...s.player,dead:!!s.player.dead,medicalDay:s.player.medicalDay||0,survivalPenalty:s.player.survivalPenalty||0,cover:s.player.cover||null};s.combat={...s.combat,round:s.combat.round||0,order:s.combat.order||[],index:s.combat.index||0,turn:s.combat.turn||null,events:s.combat.events||[]};return s;}
function criticalPenalty(a){return activeInjuries(a).reduce((n,i)=>n+([2,3,4,10,12].includes(i.number)?1:0),0);}
export function survival(a,rand){if(!severe(a))return null;const threshold=(a.stats.BODY??5)-a.survivalPenalty-criticalPenalty(a);const value=die(10,rand);const success=value!==10&&value<threshold;a.survivalPenalty++;if(!success)a.dead=true;return {type:'SURVIVAL',actor:a.name,value,threshold,success,dead:!success};}
function startTurn(s,id,rand){const a=fighter(s,id);const events=[];if(!a||a.dead)return events;const test=survival(a,rand);if(test)events.push(test);if(!a.dead){const spine=activeInjuries(a).filter(i=>i.number===10&&i.spineTurns>0);for(const i of spine)i.spineTurns--;s.combat.turn={actorId:id,majorUsed:spine.length>0,moveSpent:0,attackCount:0,attackStarted:false,dodgePrepared:false};if(spine.length)events.push({type:'SPINE_STUN',actor:a.name});events.push({type:'TURN_START',actor:a.name,actorId:id,round:s.combat.round});}return events;}
export function beginCombat(input,rand){const s=migrate(input);if(s.combat.active&&s.combat.order.length&&s.combat.turn)throw Error('Walka już trwa');const participants=[s.player,...s.enemies].filter(a=>!a.dead);if(participants.length<2)throw Error('Potrzeba co najmniej dwóch uczestników');const initiatives=participants.map(a=>({id:a.id,value:a.stats.REF+die(10,rand),tie:[]}));let ties=true,guard=0;while(ties&&guard++<50){ties=false;const groups=new Map();for(const a of initiatives){if(!groups.has(a.value))groups.set(a.value,[]);groups.get(a.value).push(a);}for(const arr of groups.values())if(arr.length>1){ties=true;for(const a of arr){const f=fighter(s,a.id);const r=die(10,rand);a.tie.push(r);a.value=f.stats.REF+r;}}}if(ties)throw Error('Nie udało się rozstrzygnąć remisów inicjatywy');initiatives.sort((a,b)=>b.value-a.value);s.combat.active=true;s.combat.round=1;s.combat.index=0;s.combat.order=initiatives.map(a=>a.id);s.combat.turn=null;const events=[{type:'INITIATIVE',order:initiatives}];events.push(...startTurn(s,s.combat.order[0],rand));s.revision++;return {state:s,events};}
export function currentActor(s){return s.combat.turn?.actorId||null;}
export function nextTurn(input,rand){const s=migrate(input);if(!s.combat.order.length)throw Error('Najpierw rozpocznij walkę');const events=[];const id=s.combat.turn?.actorId;if(id){const a=fighter(s,id);const moved=s.combat.turn.moveSpent;if(a&&!a.dead&&moved>4&&activeInjuries(a).some(i=>[5,7].includes(i.number))) {const num=activeInjuries(a).filter(i=>[5,7].includes(i.number)).length;a.hp-=5*num;events.push({type:'MOVEMENT_INJURY',actor:a.name,lost:5*num});}}
let found=false;for(let i=0;i<s.combat.order.length;i++){s.combat.index++;if(s.combat.index>=s.combat.order.length){s.combat.index=0;s.combat.round++;}const next=fighter(s,s.combat.order[s.combat.index]);if(next&&!next.dead){events.push(...startTurn(s,next.id,rand));if(s.combat.turn){found=true;break;}}}if(!found){s.combat.active=false;s.combat.turn=null;events.push({type:'COMBAT_END'});}s.campaign.turn=s.combat.round;s.revision++;return {state:s,events};}
function requireTurn(s,id){const turn=s.combat.turn;if(!turn||turn.actorId!==id)throw Error('Nie jest to tura tej postaci');const a=fighter(s,id);if(!a||a.dead)throw Error('Postać nie żyje');return {turn,a};}
function requireMajor(t){if(t.majorUsed)throw Error('W tej turze wykorzystano już akcję');}
function injuryAdjust(a,kind){let val=0;if(kind==='melee'&&activeInjuries(a).some(i=>i.number===9))val-=2;return val;}
function resolveShot(s,attacker,defender,rand){if(attacker.weapon.ammo<=0)throw Error('Brak amunicji');const dv=rangeDV(attacker.weapon.type,s.combat.distance);if(dv==null)throw Error('Poza tabelą dystansu broni');attacker.weapon.ammo--;const skill=attacker.skills.handgun??0;const base=attacker.stats.REF+skill+penalty(attacker);const result=check(base,dv,rand);const ev={type:'SHOT',actor:attacker.name,target:defender.name,test:result,ammo:attacker.weapon.ammo};if(defender.cover?.hp>0){ev.cover={before:defender.cover.hp};if(result.success){const dmg=rollDamage(attacker.weapon.damageDice,rand);defender.cover.hp=Math.max(0,defender.cover.hp-dmg.total);ev.cover.damage=dmg.total;ev.cover.after=defender.cover.hp;}return ev;}
if(result.success){const damage=rollDamage(attacker.weapon.damageDice,rand);const resolved=applyDamage(defender,damage,'body',rand);Object.assign(defender,resolved.target);ev.damage=resolved.details;ev.damage.criticalExtra=(ev.damage.injury?[ev.damage.injury.number,ev.damage.injury.name]:null);ev.damage.hpAfterRaw=defender.hp;}return ev;}
export function act(input,action,rand){const s=migrate(input);const id=action.actorId||'player';const {turn,a}=requireTurn(s,id);const events=[];const type=action.type;const enemyIds=s.enemies.filter(e=>!e.dead).map(e=>e.id);
switch(type){
case 'MOVE':{const dist=Number(action.meters);if(!Number.isFinite(dist)||dist<0)throw Error('Nieprawidłowy ruch');const max=2*movement(a);if(turn.moveSpent+dist>max)throw Error(`Limit ruchu na turę: ${max} m`);turn.moveSpent+=dist;events.push({type:'MOVE',actor:a.name,meters:dist,spent:turn.moveSpent,max});break;}
case 'ATTACK':{const to=action.targetId||(id==='player'?s.combat.targetId:'player');const target=fighter(s,to);if(!target||target.dead||target.id===id)throw Error('Nieprawidłowy cel');if(id!=='player'&&to!=='player')throw Error('Ataki NPC na NPC nie są obsługiwane w tym widoku');if(id==='player'&&!enemyIds.includes(to))throw Error('Przeciwnik nie żyje');if(turn.majorUsed)throw Error('Akcja została wykorzystana');const rof=Math.max(1,Math.min(2,a.weapon.rateOfFire||1));if(turn.attackCount>=rof)throw Error('Limit LA na turę');if(a.weapon.ammo<1)throw Error('Brak amunicji');const shot=resolveShot(s,a,target,rand);events.push(shot);turn.attackStarted=true;turn.attackCount++;if(turn.attackCount>=rof)turn.majorUsed=true;break;}
case 'RELOAD':{requireMajor(turn);const w=a.weapon;const count=Math.min(w.magazine-w.ammo,w.reserve);if(count<=0)throw Error('Nie ma czego przeładować');w.ammo+=count;w.reserve-=count;turn.majorUsed=true;events.push({type:'RELOAD',actor:a.name,count,ammo:w.ammo});break;}
case 'STABILIZE':{requireMajor(turn);const target=fighter(s,action.targetId||id);if(!target||target.dead||target.hp>=target.maxHp)throw Error('Nie można stabilizować celu');const dv=target.hp<1?15:target.hp<=target.maxHp/2?13:10;const test=check(a.stats.TECH+(a.skills.firstAid||0)+penalty(a),dv,rand);if(test.success){target.stabilized=true;if(target.hp<1)target.hp=1;target.survivalPenalty=0;}turn.majorUsed=true;events.push({type:'STABILIZE',actor:a.name,target:target.name,test});break;}
case 'DODGE':{if(activeInjuries(a).some(i=>i.number===12))throw Error('Odcięta noga: nie możesz unikać ataków');requireMajor(turn);turn.dodgePrepared=true;turn.majorUsed=true;events.push({type:'DODGE',actor:a.name,note:'Uwaga: przygotowanie uniku jest opcją interfejsu. Easy Mode opisuje obronę w walce wręcz; nie stosuj tego jako automatycznej obrony przed pociskami.'});break;}
case 'PATCH':
case 'HEAL':{
 requireMajor(turn);
 const to=fighter(s,action.targetId||id);if(!to||to.dead)throw Error('Nieprawidłowy pacjent');
 if(type==='HEAL'&&to.id===id)throw Error('Nie można leczyć siebie samego (4 godziny)');
 const injury=to.injuries?.find(i=>i.id===action.injuryId&&!i.healed);if(!injury)throw Error('Nie znaleziono aktywnej rany');
 const rule=INJURY_RULES[injury.number];if(!rule)throw Error('Nieznany typ rany');
 const choices=type==='PATCH'?rule.patch:rule.heal;const choice=choices.find(([sk])=>sk===action.skill);
 if(!choice)throw Error('Ta metoda nie jest dozwolona dla tej rany');
 if(type==='PATCH'&&injury.patchedUntilDay!=null&&injury.patchedUntilDay>=(to.medicalDay||0))throw Error('Rana już załatana');
 const test=medicalCheck(a,choice[0],choice[1],rand);
 if(test.success){if(type==='HEAL'||rule.patchPermanent){injury.healed=true;}else injury.patchedUntilDay=to.medicalDay||0;}
 turn.majorUsed=true;
 events.push({type,actor:a.name,target:to.name,injury:injury.name,skill:choice[0],test,minutes:type==='PATCH'?1:240,success:test.success,permanent:!!(test.success&&(type==='HEAL'||rule.patchPermanent))});
 break;
}
case 'MEDKIT':{throw Error('Easy Mode nie określa automatycznego leczenia PŻ medykamentem. Wykonaj stabilizację lub odpoczynek.');}
case 'COVER':{if(a.cover?.hp>0)throw Error('Postać już jest za osłoną');const hp=Number(action.hp);if(![5,10,15,20,25,30].includes(hp))throw Error('Wybierz wytrzymałość osłony z tabeli');a.cover={hp,maxHp:hp};events.push({type:'COVER',actor:a.name,hp});break;}
case 'LEAVE_COVER':{a.cover=null;events.push({type:'LEAVE_COVER',actor:a.name});break;}
case 'END_ACTION':{turn.majorUsed=true;events.push({type:'END_ACTION',actor:a.name});break;}
default:throw Error('Nieznana akcja');}
s.revision++;return {state:s,events};}
export function eventText(e){switch(e.type){case 'INITIATIVE':return 'Inicjatywa: '+e.order.map(x=>`${x.id} ${x.value}`).join(' • ');case 'TURN_START':return `Runda ${e.round}: tura ${e.actor}.`;case 'SURVIVAL':return `${e.actor}: przeżywalność k10=${e.value}, próg <${e.threshold}: ${e.success?'żyje':'UMIERA'}.`;case 'SHOT':return `${e.actor} → ${e.target}: ${e.test.total} vs PT ${e.test.dv}: ${e.test.success?'TRAFIENIE':'PUDŁO'}.${e.cover?` Osłona ${e.cover.before}→${e.cover.after??e.cover.before}.`:''}${e.damage?` Obrażenia ${e.damage.rawDamage}; SP ${e.damage.spBefore}→${e.damage.spAfter}; utrata ${e.damage.hpLost} PW.${e.damage.injury?` Krytyk: ${e.damage.injury.name}.`:''}`:''}`;case 'MOVE':return `${e.actor}: ruch ${e.meters} m (${e.spent}/${e.max} m).`;case 'RELOAD':return `${e.actor}: +${e.count} nabojów, w magazynku ${e.ammo}.`;case 'PATCH':case 'HEAL':return `${e.actor}: ${e.type==='PATCH'?'łatanie':'leczenie'} (${e.injury}, ${e.skill}, PT ${e.test.dv}, wynik ${e.test.total}) — ${e.success?'sukces':'porażka'}. ${e.permanent?'Efekt usunięty trwale.':e.success?'Efekt wyciszony do końca dnia.':''}`;case 'STABILIZE':return `${e.actor} stabilizuje ${e.target}: ${e.test.total} vs PT ${e.test.dv} — ${e.test.success?'sukces':'porażka'}.`;case 'MOVEMENT_INJURY':return `${e.actor}: obrażenia od ruchu ${e.lost} PW.`;default:return `${e.actor||''}: ${e.type} ${e.note||''}`;}}
