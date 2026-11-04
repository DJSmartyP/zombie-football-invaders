(()=>{
  const canvas=document.getElementById('game'),ctx=canvas.getContext('2d'),$=id=>document.getElementById(id);
  const W=900,H=600,player={x:450,y:538};
  const keys={left:false,right:false,shoot:false};
  const chars=[
    {id:'rookie',name:'Rookie',icon:'🏃',cost:0,ability:'Quick Feet',desc:'Move 10% faster.',speed:1.1,hearts:3,damage:1,cash:1,pierce:1,color:'#d9f76b'},
    {id:'keeper',name:'Keeper',icon:'🧤',cost:35,ability:'Last Stand',desc:'Start with 4 lives.',speed:1,hearts:4,damage:1,cash:1,pierce:1,color:'#76dbd5'},
    {id:'striker',name:'Striker',icon:'⚽',cost:90,ability:'Power Boot',desc:'Start with 2 damage.',speed:1,hearts:3,damage:2,cash:1,pierce:1,color:'#ffae72'},
    {id:'captain',name:'Captain',icon:'⭐',cost:200,ability:'Rally Cry',desc:'2 damage, 4 lives and 20% more match cash.',speed:1,hearts:4,damage:2,cash:1.2,pierce:1,color:'#f6dc68'},
    {id:'legend',name:'Legend',icon:'🏆',cost:400,ability:'Golden Ball',desc:'3 damage, 4 lives and balls pierce two zombies.',speed:1.05,hearts:4,damage:3,cash:1,pierce:2,color:'#f08add'}
  ];
  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
  const save=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch{}};
  let bank=Number(read('zfi-coins',0))||0,owned=read('zfi-owned',['rookie']),selected=read('zfi-character','rookie');
  if(!Array.isArray(owned))owned=['rookie'];if(!owned.includes('rookie'))owned.unshift('rookie');
  if(!owned.includes(selected))selected='rookie';
  let character=chars.find(c=>c.id===selected),state='menu',score=0,wave=1,lives=3,best=Number(read('zfi-best',0))||0;
  let cash=0,damageLevel=0,speedLevel=0,autoFire=false,zombies=[],balls=[],particles=[],cooldown=0,spawnTimer=0,remaining=0,last=0,shake=0,sound=false,raf=0,zombieId=0,lastReward=0;
  const overlay=$('overlay');
  function ui(){
    $('score').textContent=String(score).padStart(4,'0');$('wave').textContent=String(wave).padStart(2,'0');
    $('cash').textContent=String(cash);$('coins').textContent=String(bank);$('best').textContent=String(best).padStart(4,'0');
    $('lives').textContent=Array.from({length:character.hearts},(_,i)=>i<lives?'♥':'♡').join(' ');
  }
  function tone(freq,duration,type='sine',volume=.055){if(!sound)return;try{let a=window.audioCtx||(window.audioCtx=new (window.AudioContext||window.webkitAudioContext)()),o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.setValueAtTime(freq,a.currentTime);o.frequency.exponentialRampToValueAtTime(Math.max(70,freq*.55),a.currentTime+duration);g.gain.setValueAtTime(volume,a.currentTime);g.gain.exponentialRampToValueAtTime(.001,a.currentTime+duration);o.connect(g);g.connect(a.destination);o.start();o.stop(a.currentTime+duration)}catch{}}
  function show(mode,badge,title,description,content,button,help=''){
    state=mode;overlay.dataset.mode=mode;$('overlayBadge').textContent=badge;$('overlayTitle').innerHTML=title;
    $('overlayText').textContent=description;$('overlayContent').innerHTML=content;
    $('startButton').innerHTML=button+' <span>→</span>';$('overlayHelp').innerHTML=help;
    overlay.classList.remove('hidden');
  }
  function characterCards(){
    return '<div class="section-label">CHOOSE YOUR PLAYER · PERMANENT COIN UNLOCKS</div><div class="card-grid">'+chars.map(c=>{
      const unlocked=owned.includes(c.id),chosen=selected===c.id;
      return '<div class="character-card'+(chosen?' selected':'')+'"><span class="card-emoji">'+c.icon+'</span><strong>'+c.name+'</strong><small><b>'+c.ability+'</b><br>'+c.desc+'</small><button type="button" data-character="'+c.id+'"'+(chosen||!unlocked&&bank<c.cost?' disabled':'')+'>'+(chosen?'SELECTED':unlocked?'SELECT':'UNLOCK · '+c.cost+' 🪙')+'</button></div>';
    }).join('')+'</div><div class="bank-note">Your coins: '+bank+' 🪙 · Earn more when a game ends, based on completed waves.</div>';
  }
  function menu(){show('menu','THE FINAL WHISTLE CAN WAIT','THE DEAD ARE<br><em>ON THE PITCH.</em>','Defend your goal, earn match cash, and visit the upgrade shop after every wave.',characterCards(),'KICK OFF','MOVE ← → OR A / D <b>·</b> SPACE FIRES ONCE');}
  function gameOver(earned,cleared){
    show('over','FULL TIME','THEY GOT<br><em>THROUGH.</em>','You cleared '+cleared+' '+(cleared===1?'wave':'waves')+' and earned '+earned+' coins. Your best score is '+best+'.',characterCards(),'PLAY AGAIN','COINS = 8 × WAVES CLEARED + 3 × WAVES CLEARED²');
    tone(170,.5,'sawtooth');
  }
  function shop(){
    const damageCost=50+damageLevel*35,speedCost=65+speedLevel*45,autoCost=240;
    const offer=(id,icon,title,desc,cost,bought=false)=>'<div class="upgrade-card"><span class="upgrade-icon">'+icon+'</span><strong>'+title+'</strong><small>'+desc+'</small><button type="button" data-upgrade="'+id+'"'+(bought||cash<cost?' disabled':'')+'>'+(bought?'OWNED':cost+' MATCH CASH')+'</button></div>';
    const cards='<div class="shop-stats"><span>💵 '+cash+' MATCH CASH</span><span>⚽ '+(character.damage+damageLevel)+' DAMAGE</span></div><div class="shop-grid">'+
      offer('damage','💥','Stronger Ball','Add 1 damage to every shot. Level '+(damageLevel+1)+'.',damageCost)+
      offer('speed','👟','Faster Kicks','Shorter wait between shots. Level '+(speedLevel+1)+'.',speedCost)+
      offer('auto','⚡','Auto Fire','Hold Space or SHOOT to fire repeatedly.',autoCost,autoFire)+
      '</div><div class="bank-note">Match cash comes from zombie kills and resets each game. Coins unlock characters.</div>';
    show('shop','WAVE CLEARED','HALF TIME.<br><em>HIT THE SHOP.</em>','Wave '+wave+' complete. Spend match cash before the next wave.',cards,'NEXT WAVE','UPGRADES LAST FOR THIS GAME');
    tone(640,.25,'triangle');
  }
  function waveStart(){remaining=7+wave*3;spawnTimer=.45;ui()}
  function start(){
    character=chars.find(c=>c.id===selected)||chars[0];score=0;wave=1;lives=character.hearts;cash=0;damageLevel=0;speedLevel=0;autoFire=false;
    zombies=[];balls=[];particles=[];player.x=W/2;cooldown=0;keys.left=keys.right=keys.shoot=false;
    state='playing';overlay.classList.add('hidden');waveStart();tone(520,.25);
    if(!raf){last=performance.now();raf=requestAnimationFrame(loop)}
  }
  function end(){if(state==='over')return;let cleared=wave-1,earned=8*cleared+3*cleared*cleared;lastReward=earned;bank+=earned;save('zfi-coins',bank);ui();gameOver(earned,cleared)}
  function pause(){
    if(state==='playing')show('paused','PAUSED','HALF TIME.<br><em>TAKE A BREATH.</em>','The zombies will wait. For now.','','RESUME');
    else if(state==='paused'){state='playing';overlay.classList.add('hidden')}
  }
  function nextWave(){wave++;state='playing';overlay.classList.add('hidden');waveStart()}
  function buy(id){
    if(state!=='shop')return;
    const cost=id==='damage'?50+damageLevel*35:id==='speed'?65+speedLevel*45:240;
    if(cash<cost||id==='auto'&&autoFire)return;
    cash-=cost;if(id==='damage')damageLevel++;else if(id==='speed')speedLevel++;else if(id==='auto')autoFire=true;
    ui();shop();tone(780,.12,'triangle');
  }
  function choose(id){
    if(state!=='menu'&&state!=='over')return;
    const c=chars.find(x=>x.id===id);if(!c)return;
    if(!owned.includes(id)){if(bank<c.cost)return;bank-=c.cost;owned.push(id);save('zfi-coins',bank);save('zfi-owned',owned)}
    selected=id;character=c;save('zfi-character',selected);ui();
    if(state==='over')gameOver(lastReward,wave-1);else menu();
    tone(550,.12,'triangle');
  }
  function spawn(){
    let hp=1+Math.floor((wave-1)/2)+(wave>=4&&Math.random()<.28?1:0);
    zombies.push({id:++zombieId,x:65+Math.random()*(W-130),y:-38,r:21,hp,maxHp:hp,speed:42+wave*10+Math.random()*18,phase:Math.random()*6.28,flash:0});
    remaining--;
  }
  function fire(){
    if(cooldown>0||state!=='playing')return;
    balls.push({x:player.x,y:player.y-29,vy:-660,r:10,pierce:character.pierce,hitIds:[]});
    cooldown=Math.max(.09,.24-speedLevel*.035);tone(430,.075,'triangle',.035);
  }
  function burst(x,y,color,n=10){for(let i=0;i<n;i++){let a=Math.random()*Math.PI*2,s=35+Math.random()*135;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.3+Math.random()*.35,max:.65,color,r:2+Math.random()*4})}}
  function update(dt){
    if(state!=='playing')return;cooldown=Math.max(0,cooldown-dt);
    if(keys.left)player.x-=370*character.speed*dt;if(keys.right)player.x+=370*character.speed*dt;
    player.x=Math.max(40,Math.min(W-40,player.x));if(keys.shoot&&autoFire)fire();
    spawnTimer-=dt;if(remaining>0&&spawnTimer<=0){spawn();spawnTimer=Math.max(.28,.95-wave*.055)}
    for(const b of balls)b.y+=b.vy*dt;balls=balls.filter(b=>b.y>-20);
    for(const z of zombies){
      z.y+=z.speed*dt;z.x+=Math.sin(z.y*.018+z.phase)*26*dt;z.flash=Math.max(0,z.flash-dt);
      for(const b of balls){
        if(b.dead||b.hitIds.includes(z.id))continue;
        let dx=z.x-b.x,dy=z.y-b.y;
        if(dx*dx+dy*dy<(z.r+b.r)**2){
          b.hitIds.push(z.id);b.pierce--;if(b.pierce<=0)b.dead=true;
          z.hp-=character.damage+damageLevel;z.flash=.13;burst(b.x,b.y,'#eef7b2',6);tone(230,.08,'square',.025);
          if(z.hp<=0){z.dead=true;score+=10;cash+=Math.round(10*character.cash);shake=5;burst(z.x,z.y,'#9cdb71',15);tone(190,.13,'triangle');if(score>best){best=score;save('zfi-best',best)}ui()}
          break;
        }
      }
      if(z.y>H-70&&!z.dead){z.dead=true;lives--;shake=13;burst(z.x,H-65,'#e99b73',18);tone(115,.3,'sawtooth');ui();if(lives<=0)end()}
    }
    balls=balls.filter(b=>!b.dead);zombies=zombies.filter(z=>!z.dead);
    for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=180*dt;p.life-=dt}
    particles=particles.filter(p=>p.life>0);shake=Math.max(0,shake-30*dt);
    if(remaining===0&&zombies.length===0&&state==='playing')shop();
  }
  function pitch(){
    ctx.fillStyle='#267245';ctx.fillRect(0,0,W,H);
    for(let i=0;i<10;i++){ctx.fillStyle=i%2?'#2b7949':'#287346';ctx.fillRect(i*90,0,90,H)}
    ctx.strokeStyle='rgba(228,255,219,.5)';ctx.lineWidth=3;ctx.strokeRect(20,18,W-40,H-36);
    ctx.beginPath();ctx.moveTo(20,H/2);ctx.lineTo(W-20,H/2);ctx.arc(W/2,H/2,78,0,Math.PI*2);ctx.stroke();
    ctx.strokeRect(W/2-145,18,290,90);ctx.strokeRect(W/2-65,18,130,35);
    ctx.strokeRect(W/2-170,H-124,340,106);ctx.strokeRect(W/2-75,H-60,150,42);
    ctx.fillStyle='#eafad7';ctx.beginPath();ctx.arc(W/2,180,4,0,7);ctx.fill();
    ctx.fillStyle='#142c2a';ctx.fillRect(W/2-200,H-12,400,12);
    ctx.fillStyle='#e9f9cb';ctx.fillRect(W/2-155,H-14,310,5);
  }
  function zombie(z,t){
    ctx.save();ctx.translate(z.x,z.y);let gait=Math.sin(t*.008+z.phase)*3;
    ctx.fillStyle='#183b34';ctx.fillRect(-14,16,10,22+gait);ctx.fillRect(4,16,10,22-gait);
    ctx.fillStyle=z.maxHp>=3?'#8b5979':z.maxHp===2?'#73709e':'#5b7390';ctx.fillRect(-17,-3,34,26);
    ctx.fillStyle='#95c977';ctx.fillRect(-22,3,9,8);ctx.fillRect(13,3,9,8);
    ctx.fillStyle=z.flash?'#f2ffd1':'#a4d67e';ctx.beginPath();ctx.arc(0,-17,20,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#335b37';ctx.fillRect(-16,-34,32,7);
    ctx.fillStyle='#f8eb9e';ctx.fillRect(-11,-21,7,5);ctx.fillRect(4,-21,7,5);
    ctx.fillStyle='#21362c';ctx.fillRect(-9,-21,3,5);ctx.fillRect(6,-21,3,5);
    ctx.fillStyle='#537c4d';ctx.fillRect(-5,-8,10,3);
    if(z.maxHp>1){ctx.fillStyle='#f7f2c7';ctx.font='bold 13px Arial';ctx.textAlign='center';ctx.fillText(String(z.hp),0,-42)}
    ctx.restore();
  }
  function football(x,y,r){
    ctx.save();ctx.translate(x,y);ctx.fillStyle='#f7f9e7';ctx.beginPath();ctx.arc(0,0,r,0,7);ctx.fill();
    ctx.strokeStyle='#172d2c';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#172d2c';ctx.beginPath();
    for(let i=0;i<5;i++){let a=-Math.PI/2+i*Math.PI*2/5;ctx.lineTo(Math.cos(a)*r*.48,Math.sin(a)*r*.48)}
    ctx.closePath();ctx.fill();ctx.restore();
  }
  function striker(t){
    ctx.save();ctx.translate(player.x,player.y);let step=Math.sin(t*.012)*2;
    ctx.fillStyle='#153e37';ctx.fillRect(-16,16,11,25+step);ctx.fillRect(5,16,11,25-step);
    ctx.fillStyle=character.color;ctx.fillRect(-21,-12,42,35);
    ctx.fillStyle='#264a38';ctx.fillRect(-21,14,42,8);
    ctx.fillStyle='#e4ae80';ctx.fillRect(-26,-5,8,23);ctx.fillRect(18,-5,8,23);
    ctx.beginPath();ctx.arc(0,-20,17,0,7);ctx.fill();
    ctx.fillStyle='#16322d';ctx.beginPath();ctx.arc(0,-30,16,Math.PI,Math.PI*2);ctx.fill();ctx.fillRect(-16,-30,32,5);
    football(0,-44,7);ctx.restore();
  }
  function render(t){
    ctx.save();if(shake)ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);
    pitch();for(const z of zombies)zombie(z,t);for(const b of balls)football(b.x,b.y,b.r);striker(t);
    for(const p of particles){ctx.globalAlpha=Math.min(1,p.life/p.max);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,7);ctx.fill()}
    ctx.restore();
  }
  function loop(t){let dt=Math.min((t-last)/1000,.04);last=t;update(dt);render(t);raf=requestAnimationFrame(loop)}
  $('startButton').addEventListener('click',()=>{if(state==='paused')pause();else if(state==='shop')nextWave();else start()});
  $('overlayContent').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.character)choose(b.dataset.character);if(b.dataset.upgrade)buy(b.dataset.upgrade)});
  $('soundButton').addEventListener('click',()=>{sound=!sound;$('soundButton').innerHTML='♪ <span>'+(sound?'ON':'OFF')+'</span>';$('soundButton').setAttribute('aria-label','Turn sound '+(sound?'off':'on'));tone(550,.08)});
  window.addEventListener('keydown',e=>{
    if(['ArrowLeft','ArrowRight','Space','KeyA','KeyD','KeyP'].includes(e.code))e.preventDefault();
    if(e.code==='ArrowLeft'||e.code==='KeyA')keys.left=true;
    if(e.code==='ArrowRight'||e.code==='KeyD')keys.right=true;
    if(e.code==='Space'){keys.shoot=true;if(!e.repeat)fire()}
    if(e.code==='KeyP'&&!e.repeat)pause();
    if(e.code==='Enter'&&!e.repeat&&state==='menu')start();
  });
  window.addEventListener('keyup',e=>{if(e.code==='ArrowLeft'||e.code==='KeyA')keys.left=false;if(e.code==='ArrowRight'||e.code==='KeyD')keys.right=false;if(e.code==='Space')keys.shoot=false});
  window.addEventListener('blur',()=>{keys.left=keys.right=keys.shoot=false;if(state==='playing')pause()});
  canvas.addEventListener('pointermove',e=>{if(state==='playing'&&e.pointerType!=='touch'){let r=canvas.getBoundingClientRect();player.x=Math.max(40,Math.min(W-40,(e.clientX-r.left)*W/r.width))}});
  canvas.addEventListener('pointerdown',e=>{if(state==='playing'){let r=canvas.getBoundingClientRect();player.x=Math.max(40,Math.min(W-40,(e.clientX-r.left)*W/r.width));fire()}});
  for(const [id,key] of [['leftButton','left'],['rightButton','right'],['shootButton','shoot']]){
    let el=$(id);el.addEventListener('pointerdown',e=>{e.preventDefault();el.setPointerCapture(e.pointerId);keys[key]=true;if(key==='shoot')fire()});
    for(const ev of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(ev,()=>keys[key]=false);
  }
  ui();menu();render(0);
})();
