import test from 'node:test';import assert from 'node:assert/strict';import {rollD10,rollDamage,rangeDV,applyDamage,initialState,reduce,woundState} from '../public/engine.js';
const seq=(...values)=>{let i=0;return ()=>values[i++];};
test('explosion d10',()=>assert.deepEqual(rollD10(seq(.99,.99,.29)),{rolls:[10,10],value:20,kind:'explosion'}));
test('fumble d10',()=>assert.deepEqual(rollD10(seq(0,.69)),{rolls:[1,7],value:-6,kind:'fumble'}));
test('two sixes',()=>assert.deepEqual(rollDamage(3,seq(.99,.99,0)),{dice:[6,6,1],total:13,critical:true}));
test('distance DV',()=>{assert.equal(rangeDV('pistol',6),13);assert.equal(rangeDV('pistol',12),15);assert.equal(rangeDV('pistol',201),null);});
test('armor stops damage with no ablation',()=>{let e=initialState().player;let r=applyDamage(e,{dice:[1,2],total:3,critical:false},'body',()=>0);assert.equal(r.target.hp,35);assert.equal(r.target.armor.body,7);});
test('Easy Mode does not double head damage without extended rules',()=>{let e=initialState().player;let r=applyDamage(e,{dice:[6,5,3],total:14,critical:false},'head',()=>0);assert.equal(r.details.hpLost,7);assert.equal(r.target.armor.head,6);});
test('critical bonus bypasses SP even with no penetration',()=>{let e=initialState().player;e.armor.body=15;let r=applyDamage(e,{dice:[6,6],total:12,critical:true},'body',()=>0);assert.equal(r.details.hpLost,5);assert.equal(r.target.armor.body,15);assert.equal(r.target.injuries.length,1);});
test('reload conserves ammunition',()=>{let s=initialState();s.player.weapon.ammo=2;let r=reduce(s,{type:'RELOAD'});assert.equal(r.state.player.weapon.ammo,8);assert.equal(r.state.player.weapon.reserve,26);assert.equal(s.player.weapon.ammo,2);});
test('attack consumes one cartridge and deterministic hit',()=>{const r=reduce(initialState(),{type:'ATTACK'},()=>.5);assert.equal(r.state.player.weapon.ammo,7);assert.equal(r.event.test.success,true);assert.equal(r.state.enemies[0].hp,12);});

test('range shotgun 101-200 = 35',()=>assert.equal(rangeDV('shotgun',150),35));
test('severe wound applies at exactly half HP',()=>{let e=initialState().player;e.hp=10;e.maxHp=20;assert.equal(woundState(e),'Ciężko ranny');});
test('rest requires stabilization',()=>assert.throws(()=>reduce(initialState(),{type:'REST_DAY',confirmed:true}),/stabilizacja/));
