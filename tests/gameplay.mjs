import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const listeners = {};
const elements = new Map();
const noop = () => {};
const drawing = new Proxy({}, {get: () => noop, set: () => true});
function element(id) {
  if (!elements.has(id)) elements.set(id, {
    id, textContent:'', innerHTML:'', value:'Player', dataset:{}, disabled:false,
    classList:{add:noop,remove:noop}, addEventListener(type,fn){listeners[id+':'+type]=fn},
    getContext(){return drawing}, getBoundingClientRect(){return {left:0,width:900}}, setAttribute:noop
  });
  return elements.get(id);
}
const storage = new Map();
const sandbox = {
  document:{getElementById:element},
  window:{addEventListener(type,fn){listeners['window:'+type]=fn}},
  localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)},
  requestAnimationFrame:()=>1,performance:{now:()=>0},Math,console
};
const source=fs.readFileSync(new URL('../game.js',import.meta.url),'utf8').replace(
  'ui();menu();render(0);',
  'window.testApi={start,update,shop,buy,end,choose,nextWave,fire,activateFreeze,get:()=>({state,wave,lives,cash,bank,damageLevel,speedLevel,autoFire,splitShot,freezeCharges,powerCharges,shieldCharges,freezeTimer,balls,zombies}),setCash:n=>{cash=n},setWave:n=>{wave=n},setLives:n=>{lives=n}};ui();menu();render(0);'
);
vm.runInNewContext(source,sandbox);
const game=sandbox.window.testApi;
const key=(code,repeat=false)=>listeners['window:keydown']({code,repeat,preventDefault:noop});

assert.match(element('overlayContent').innerHTML,/class="player-avatar"/);
assert.match(element('overlayContent').innerHTML,/Shield ball/);
assert.match(element('overlayContent').innerHTML,/rarity-easy/);
assert.match(element('overlayContent').innerHTML,/LOCAL LEADERBOARD/);
assert.match(element('overlayContent').innerHTML,/Vertical stripes/);
listeners['overlayContent:change']({target:{id:'kitColor',value:'red'}});
listeners['overlayContent:change']({target:{id:'kitPattern',value:'stripes'}});
assert.equal(storage.get('zfi-kit-color'),'"red"');
assert.equal(storage.get('zfi-kit-pattern'),'"stripes"');
assert.match(element('overlayContent').innerHTML,/stroke="#fff5df" stroke-width="7"/);
element('playerName').value='Jamie';game.start();
key('Space');
assert.equal(game.get().balls.length,1);
assert.equal(game.get().balls[0].kind,'rookie');
game.update(.3);
key('Space',true);
assert.equal(game.get().balls.length,1,'holding Space does not repeat by default');

game.setCash(2000);game.shop();
assert.match(element('overlayContent').innerHTML,/Freeze Whistle/);
game.buy('damage');game.buy('speed');game.buy('split');game.buy('auto');
assert.equal(game.get().damageLevel,1);
assert.equal(game.get().speedLevel,1);
assert.equal(game.get().splitShot,true);
assert.equal(game.get().autoFire,true);
game.buy('freeze');game.buy('power');game.buy('shield');
assert.equal(game.get().freezeCharges,1);
assert.equal(game.get().powerCharges,1);
assert.equal(game.get().shieldCharges,1);
game.nextWave();
game.update(.3);
assert.ok(game.get().balls.length>=3,'Auto Fire shoots a split pair while held');
key('KeyQ');
assert.equal(game.get().freezeCharges,0);
assert.ok(game.get().freezeTimer>0);
game.update(.3);key('KeyE');
assert.equal(game.get().powerCharges,0);
assert.equal(game.get().balls.at(-1).kind,'charged');
assert.equal(game.get().balls.at(-1).damage,6);
assert.equal(game.get().balls.at(-1).pierce,3);
game.get().zombies.push({id:999,x:450,y:540,r:21,hp:1,maxHp:1,speed:0,phase:0,flash:0});
game.update(4);
assert.equal(game.get().lives,3,'a shield prevents a lost life');
assert.equal(game.get().shieldCharges,0);
game.setWave(4);game.end();
assert.equal(game.get().bank,56);
assert.match(element('overlayContent').innerHTML,/Jamie · W3/);
assert.match(storage.get('zfi-leaderboard'),/"name":"Jamie"/);
assert.match(element('overlayTitle').innerHTML,/GOAL/);
assert.equal(element('overlay').dataset.mode,'over');
game.choose('keeper');
assert.equal(game.get().bank,21);
game.start();
assert.equal(game.get().lives,4);
game.end();
assert.equal(game.get().bank,26,'a first-wave loss still earns five tokens');
assert.equal(storage.get('zfi-coins'),'26','tokens persist in browser storage');
console.log('gameplay checks passed');
