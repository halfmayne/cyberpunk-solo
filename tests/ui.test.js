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

test('journal owns scrolling and is not moved ahead of combat controls',async()=>{
 const [app,css]=await Promise.all([read('../public/app.js'),read('../public/style.css')]);
 assert.doesNotMatch(app,/mainPanel\.prepend/);
 assert.match(app,/box\.scrollTop/);
 assert.match(css,/\.journalPanel \.log\{[^}]*overflow-y:auto/);
 assert.match(css,/#main\{[^}]*overflow:hidden/);
});
