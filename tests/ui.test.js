import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(path,import.meta.url),'utf8');

test('combat controls and journal use separate workspace panels',async()=>{
 const html=await read('../public/index.html');
 assert.match(html,/id="combatPanel"/);
 assert.match(html,/id="journalPanel"[^>]*hidden/);
 assert.match(html,/id="log"[^>]*tabindex="0"/);
 assert.ok(html.indexOf('id="combatPanel"')<html.indexOf('id="journalPanel"'));
});

test('a ready campaign gives the player scenes, goals and prepared encounters',async()=>{
 const [campaigns,app,sw]=await Promise.all([read('../public/campaigns.js'),read('../public/app.js'),read('../public/sw.js')]);
 assert.match(campaigns,/Dług w Kabuki/);
 assert.match(campaigns,/Pokonaj strażnika/);
 assert.match(app,/Rozpocznij grę/);
 assert.match(app,/Ochroniarz 1/);
 assert.match(app,/Ochroniarz 2/);
 assert.match(app,/Rozpocznij gotową kampanię/);
 assert.match(app,/action\.hidden=!!stage\?\.complete/);
 assert.match(sw,/red-solo-v24-simplified-combat/);
 assert.match(sw,/campaigns\.js/);
});

test('journal owns scrolling and is not moved ahead of combat controls',async()=>{
 const [app,css]=await Promise.all([read('../public/app.js'),read('../public/style.css')]);
 assert.doesNotMatch(app,/mainPanel\.prepend/);
 assert.doesNotMatch(app,/\$\('medkit'\)\.onclick/);
 assert.match(app,/btn\.dataset\.go==='medkit'\)playerAct\('STABILIZE'\)/);
 assert.match(app,/box\.scrollTop/);
 assert.match(css,/\.journalPanel \.log\{[^}]*overflow-y:auto/);
 assert.match(css,/#main\{[^}]*overflow:hidden/);
});

test('combat starts once, NPC turns resolve automatically, and jargon is simplified',async()=>{
 const app=await read('../public/app.js');
 assert.match(app,/for\(const id of \['addEnemy','setCombat','enemyAttack','nextTurn'\]\)\$\(id\)\?\.remove\(\)/);
 assert.match(app,/scheduleCombatFlow\(\)/);
 assert.match(app,/Teraz działa: \$\{e\.actor\}/);
 assert.match(app,/strzela do \$\{e\.target\}, ale nie trafia/);
 assert.match(app,/Rusz o 4 m/);
 assert.match(app,/Schowaj się za osłoną/);
 assert.match(app,/Zakończ swoją turę/);
 assert.match(app,/startCombat'\)\.hidden=started/);
 assert.match(app,/const fireAndContinue=\(\)=>\{combatFlowTimer=null;baseCombatRun\('NPC'/);
 assert.match(app,/const currentEnemy=state\.enemies\.find\(item=>item\.id===actor\)/);
 assert.match(app,/const canFireAgain=turn\?\.actorId===actor/);
 assert.match(app,/playerCanAct=playerTurn&&!state\.combat\.turn\.majorUsed/);
});

