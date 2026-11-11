(()=>{
  const canvas=document.getElementById('game'),ctx=canvas.getContext('2d'),$=id=>document.getElementById(id);
  const W=900,H=600,FIELD_LEFT=175,FIELD_RIGHT=725,player={x:450,y:538};
  const keys={left:false,right:false,shoot:false};
  const chars=[
    {id:'rookie',name:'Rookie',rarity:'easy',number:18,ballName:'Classic ball',cost:0,ability:'Quick Feet',desc:'Move 10% faster.',speed:1.1,hearts:3,damage:1,cash:1,pierce:1,color:'#d9f76b'},
    {id:'keeper',name:'Keeper',rarity:'medium',number:1,ballName:'Shield ball',cost:35,ability:'Last Stand',desc:'Start with 4 lives.',speed:1,hearts:4,damage:1,cash:1,pierce:1,color:'#76dbd5'},
    {id:'striker',name:'Striker',rarity:'hard',number:9,ballName:'Blaze ball',cost:90,ability:'Power Boot',desc:'Start with 2 damage.',speed:1,hearts:3,damage:2,cash:1,pierce:1,color:'#ffae72'},
    {id:'captain',name:'Captain',rarity:'insane',number:10,ballName:'Star ball',cost:200,ability:'Rally Cry',desc:'2 damage, 4 lives and 20% more match cash.',speed:1,hearts:4,damage:2,cash:1.2,pierce:1,color:'#f6dc68'},
    {id:'legend',name:'Legend',rarity:'grinder',number:7,ballName:'Lightning ball',cost:400,ability:'Golden Ball',desc:'3 damage, 4 lives and balls pierce two zombies.',speed:1.05,hearts:4,damage:3,cash:1,pierce:2,color:'#f08add'}
  ];
  const kitColors={lime:['Lime','#d9f76b','#173d32'],red:['Red','#e9454e','#fff5df'],blue:['Blue','#3487df','#f6fbff'],sky:['Sky blue','#65cbe5','#173d43'],yellow:['Yellow','#ffd64f','#2f341e'],green:['Green','#25a56c','#f5fff1'],white:['White','#f5f3e8','#243b35'],black:['Black','#27343b','#e9f5ed']};
  const kitPatterns={plain:'Plain',stripes:'Vertical stripes',hoops:'Hoops',halves:'Half and half'};
  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
  const save=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch{}};
  const escapeHtml=s=>String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  let bank=Number(read('zfi-coins',0))||0,owned=read('zfi-owned',['rookie']),selected=read('zfi-character','rookie');
  let playerName=String(read('zfi-player-name','Player')).trim().slice(0,16)||'Player';
  let leaderboard=read('zfi-leaderboard',[]);if(!Array.isArray(leaderboard))leaderboard=[];
  let kitColor=read('zfi-kit-color','lime'),kitPattern=read('zfi-kit-pattern','plain');
  if(!kitColors[kitColor])kitColor='lime';if(!kitPatterns[kitPattern])kitPattern='plain';
  if(!Array.isArray(owned))owned=['rookie'];if(!owned.includes('rookie'))owned.unshift('rookie');
  if(!owned.includes(selected))selected='rookie';
  let character=chars.find(c=>c.id===selected),state='menu',score=0,wave=1,lives=3,best=Number(read('zfi-best',0))||0;
  let cash=0,damageLevel=0,speedLevel=0,autoFire=false,splitShot=false,freezeCharges=0,powerCharges=0,shieldCharges=0,freezeTimer=0,healsThisShop=0;
  let zombies=[],balls=[],particles=[],cooldown=0,spawnTimer=0,remaining=0,last=0,shake=0,sound=false,raf=0,zombieId=0,lastReward=0;
  const overlay=$('overlay');
  function ui(){
    $('score').textContent=String(score).padStart(4,'0');$('wave').textContent=String(wave).padStart(2,'0');
    $('cash').textContent=String(cash);$('coins').textContent=String(bank);$('best').textContent=String(best).padStart(4,'0');
    $('lives').textContent=Array.from({length:character.hearts},(_,i)=>i<lives?'♥':'♡').join(' ');
    $('freezeCount').textContent=String(freezeCharges);$('powerCount').textContent=String(powerCharges);$('shieldCount').textContent=String(shieldCharges);
    $('freezeButton').disabled=state!=='playing'||freezeCharges===0||freezeTimer>0;
    $('powerButton').disabled=state!=='playing'||powerCharges===0;
  }
  function tone(freq,duration,type='sine',volume=.055){if(!sound)return;try{let a=window.audioCtx||(window.audioCtx=new (window.AudioContext||window.webkitAudioContext)()),o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.setValueAtTime(freq,a.currentTime);o.frequency.exponentialRampToValueAtTime(Math.max(70,freq*.55),a.currentTime+duration);g.gain.setValueAtTime(volume,a.currentTime);g.gain.exponentialRampToValueAtTime(.001,a.currentTime+duration);o.connect(g);g.connect(a.destination);o.start();o.stop(a.currentTime+duration)}catch{}}
  function show(mode,badge,title,description,content,button,help=''){
    state=mode;overlay.dataset.mode=mode;$('overlayBadge').textContent=badge;$('overlayTitle').innerHTML=title;
    $('overlayText').textContent=description;$('overlayContent').innerHTML=content;
    $('startButton').innerHTML=button+' <span>→</span>';$('overlayHelp').innerHTML=help;
    overlay.classList.remove('hidden');ui();
  }
  function avatarMarkup(c){
    const [,shirt,accent]=kitColors[kitColor],clip='kit-'+c.id;
    const shirtShape='M20 58L28 49H60L68 58L61 68L58 63V86H30V63L27 68Z';
    const pattern=kitPattern==='stripes'?'<path d="M35 48V86M47 48V86M59 48V86" stroke="'+accent+'" stroke-width="7" opacity=".85"/>':kitPattern==='hoops'?'<path d="M18 60H70M18 75H70" stroke="'+accent+'" stroke-width="8" opacity=".85"/>':kitPattern==='halves'?'<path d="M44 48H70V87H44Z" fill="'+accent+'"/>':'';
    const backdrop=c.id==='keeper'?'<path d="M13 17H75V51M26 17V44M44 17V40M62 17V44" fill="none" stroke="#b9f8e1" stroke-width="2" opacity=".55"/>':'<path d="M9 46H79M44 12V46" stroke="#b7dfad" stroke-width="2" opacity=".35"/>';
    const detail={
      rookie:'<path d="M34 54V82M54 54V82" stroke="#f6ffe8" stroke-width="3" opacity=".8"/>',
      keeper:'<rect x="10" y="59" width="12" height="12" rx="3" fill="#f7f7ec"/><rect x="66" y="59" width="12" height="12" rx="3" fill="#f7f7ec"/><path d="M11 62H21M67 62H77" stroke="#4c8b93" stroke-width="2"/>',
      striker:'<path d="M30 22H58" stroke="#fff0bb" stroke-width="4"/>',
      captain:'<rect x="17" y="57" width="11" height="10" rx="2" fill="#fff4d1"/><text x="22.5" y="65" text-anchor="middle" font-size="8" font-weight="900" fill="#443725">C</text>',
      legend:'<path d="M67 14L69 20L75 20L70 24L72 30L67 26L62 30L64 24L59 20L65 20Z" fill="#fff0a8"/><path d="M32 56L22 79M56 56L66 79" stroke="#fff0a8" stroke-width="3"/>'
    }[c.id];
    return '<svg class="player-avatar" viewBox="0 0 88 88" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'+
      '<rect x="2" y="2" width="84" height="84" rx="13" fill="#226746" stroke="#b4df88" stroke-width="3"/>'+backdrop+
      '<defs><clipPath id="'+clip+'"><path d="'+shirtShape+'"/></clipPath></defs><path d="'+shirtShape+'" fill="'+shirt+'" stroke="#19382f" stroke-width="2"/><g clip-path="url(#'+clip+')">'+pattern+'</g>'+
      '<circle cx="44" cy="31" r="15" fill="#dfad83"/><path d="M29 30Q29 13 45 15Q58 15 59 28L54 24Q44 27 30 24Z" fill="#24352c"/>'+
      '<circle cx="38" cy="32" r="1.8" fill="#26342c"/><circle cx="50" cy="32" r="1.8" fill="#26342c"/>'+
      '<path d="M39 39Q44 42 49 39" fill="none" stroke="#925e50" stroke-width="1.7"/>'+
      '<text x="44" y="75" text-anchor="middle" font-family="Arial,sans-serif" font-size="17" font-weight="900" fill="'+(kitColor==='black'||kitColor==='red'||kitColor==='blue'?'#fffef0':'#23402f')+'" stroke="'+(kitColor==='black'||kitColor==='red'||kitColor==='blue'?'#17352b':'#fffde8')+'" stroke-width=".7" paint-order="stroke">'+c.number+'</text>'+detail+
      '<circle cx="69" cy="69" r="14" fill="#fffdf0" stroke="#21382d" stroke-width="2"/>'+
      '<path d="M69 61L75 65L73 72L65 72L63 65Z" fill="#21382d"/><path d="M69 55V61M81 66L75 65M78 80L73 72M59 80L65 72M56 66L63 65" stroke="#21382d" stroke-width="1.5"/>'+
      '</svg>';
  }
  function characterCards(){
    const select=(id,options,current)=>'<select id="'+id+'" aria-label="'+(id==='kitColor'?'Shirt colour':'Shirt design')+'">'+Object.entries(options).map(([value,label])=>'<option value="'+value+'"'+(current===value?' selected':'')+'>'+label+'</option>').join('')+'</select>';
    const board=leaderboard.length?leaderboard.slice(0,5).map((row,i)=>'<span>'+(i+1)+'. '+escapeHtml(row.name)+' · W'+Number(row.waves||0)+' · '+Number(row.score||0)+'</span>').join(''):'<span>No scores yet. Play a match!</span>';
    return '<div class="player-setup"><label>PLAYER NAME <input id="playerName" type="text" maxlength="16" autocomplete="nickname" value="'+escapeHtml(playerName)+'"></label><div class="local-board"><b>LOCAL LEADERBOARD</b>'+board+'</div></div><div class="kit-picker"><span>DESIGN YOUR FOOTBALL SHIRT</span><label>COLOUR '+select('kitColor',Object.fromEntries(Object.entries(kitColors).map(([id,v])=>[id,v[0]])),kitColor)+'</label><label>DESIGN '+select('kitPattern',kitPatterns,kitPattern)+'</label></div><div class="section-label">CHOOSE YOUR PLAYER · PERMANENT TOKEN UNLOCKS</div><div class="card-grid">'+chars.map(c=>{
      const unlocked=owned.includes(c.id),chosen=selected===c.id;
      return '<div class="character-card rarity-'+c.rarity+(chosen?' selected':'')+'">'+avatarMarkup(c)+'<span class="rarity-label">'+c.rarity.toUpperCase()+'</span><strong>'+c.name+'</strong><span class="ball-name">'+c.ballName+'</span><small><b>'+c.ability+'</b><br>'+c.desc+'</small><button type="button" data-character="'+c.id+'"'+(chosen||!unlocked&&bank<c.cost?' disabled':'')+'>'+(chosen?'SELECTED':unlocked?'SELECT':'UNLOCK · '+c.cost+' TOKENS')+'</button></div>';
    }).join('')+'</div><div class="bank-note">Your tokens: '+bank+' · Earn tokens after each game. Unlocks and scores stay on this browser.</div>';
  }
  function menu(){show('menu','THE FINAL WHISTLE CAN WAIT','THE DEAD ARE<br><em>ON THE PITCH.</em>','Defend your goal, earn match cash, and visit the upgrade shop after every wave.',characterCards(),'KICK OFF','MOVE ← → OR A / D <b>·</b> SPACE FIRES ONCE');}
  function gameOver(earned,cleared){
    show('over','FULL TIME · GAME OVER','THE GOAL<br><em>HAS FALLEN.</em>',playerName+': you survived '+cleared+' '+(cleared===1?'wave':'waves')+'. You earned '+earned+' tokens. Best score: '+best+'. Choose a player and try again.',characterCards(),'PLAY AGAIN','TOKENS = 5 + 8 × WAVES CLEARED + 3 × WAVES CLEARED²');
    tone(170,.5,'sawtooth');
  }
  function upgradeCost(id){
    if(id==='damage')return 60+55*damageLevel;
    if(id==='speed')return 85+60*speedLevel;
    if(id==='heal')return 75+20*(wave-1)+30*healsThisShop;
    if(id==='split')return 190;
    if(id==='auto')return 320;
    if(id==='freeze')return 90+15*(wave-1)+20*freezeCharges;
    if(id==='power')return 85+15*(wave-1)+20*powerCharges;
    if(id==='shield')return 120+20*(wave-1)+25*shieldCharges;
    return Infinity;
  }
  function upgradeStatus(id){
    if(id==='damage'&&damageLevel>=4||id==='speed'&&speedLevel>=3)return 'MAXED';
    if(id==='heal'&&lives>=character.hearts)return 'FULL HEALTH';
    if(id==='split'&&splitShot||id==='auto'&&autoFire)return 'OWNED';
    if(id==='freeze'&&freezeCharges>=3||id==='power'&&powerCharges>=3||id==='shield'&&shieldCharges>=3)return 'FULL (3)';
    return '';
  }
  function shop(){
    const offer=(id,icon,title,desc)=>{
      const cost=upgradeCost(id),status=upgradeStatus(id);
      return '<div class="upgrade-card"><span class="upgrade-icon">'+icon+'</span><strong>'+title+'</strong><small>'+desc+'</small><button type="button" data-upgrade="'+id+'"'+(status||cash<cost?' disabled':'')+'>'+(status||cost+' MATCH CASH')+'</button></div>';
    };
    const cards='<div class="shop-stats"><span>💵 '+cash+' MATCH CASH</span><span>⚽ '+(character.damage+damageLevel)+' DAMAGE</span><span>🧟 NEXT HP '+(1+Math.floor(wave/2))+'+</span></div><div class="section-label">RUN UPGRADES</div><div class="shop-grid">'+
      offer('damage','💥','Stronger Ball','+1 damage. Tier '+damageLevel+'/4; higher tiers cost more.')+
      offer('speed','👟','Faster Kicks','Shoot sooner after each kick. Tier '+speedLevel+'/3.')+
      offer('split','⚽','Split Shot','Fire two footballs in a spread per kick.')+
      offer('auto','⚡','Auto Fire','Hold Space or SHOOT to fire repeatedly.')+
      '</div><div class="section-label">ONE-USE MATCH ITEMS · BUY UP TO 3 OF EACH</div><div class="shop-grid">'+
      offer('heal','❤️','First Aid','Restore 1 life now, up to your character limit.')+
      offer('freeze','❄️','Freeze Whistle','Press Q to stop zombies for 4 seconds. Held: '+freezeCharges+'.')+
      offer('power','☄️','Charged Ball','Press E for one heavy piercing shot. Held: '+powerCharges+'.')+
      offer('shield','🛡️','Goal Shield','Automatically blocks one zombie at your goal. Held: '+shieldCharges+'.')+
      '</div><div class="bank-note">Match cash comes from kills and resets each game. Tokens unlock characters permanently.</div>';
    show('shop','WAVE CLEARED','HALF TIME.<br><em>HIT THE SHOP.</em>','Wave '+wave+' complete. Spend match cash before the next wave.',cards,'NEXT WAVE','RUN UPGRADES LAST THIS GAME · MATCH ITEMS ARE CONSUMED');
    tone(640,.25,'triangle');
  }
  function waveStart(){remaining=7+wave*3;spawnTimer=.45;freezeTimer=0;ui()}
  function start(){
    const nameInput=$('playerName');if(nameInput){playerName=nameInput.value.trim().slice(0,16)||'Player';save('zfi-player-name',playerName)}
    character=chars.find(c=>c.id===selected)||chars[0];score=0;wave=1;lives=character.hearts;cash=0;damageLevel=0;speedLevel=0;autoFire=false;splitShot=false;
    freezeCharges=0;powerCharges=0;shieldCharges=0;freezeTimer=0;healsThisShop=0;
    zombies=[];balls=[];particles=[];player.x=W/2;cooldown=0;keys.left=keys.right=keys.shoot=false;
    state='playing';overlay.classList.add('hidden');waveStart();tone(520,.25);
    if(!raf){last=performance.now();raf=requestAnimationFrame(loop)}
  }
  function end(){if(state==='over')return;let cleared=wave-1,earned=5+8*cleared+3*cleared*cleared;lastReward=earned;bank+=earned;save('zfi-coins',bank);
    leaderboard.push({name:playerName,waves:cleared,score});leaderboard.sort((a,b)=>b.waves-a.waves||b.score-a.score);leaderboard=leaderboard.slice(0,5);save('zfi-leaderboard',leaderboard);ui();gameOver(earned,cleared)}
  function pause(){
    if(state==='playing')show('paused','PAUSED','HALF TIME.<br><em>TAKE A BREATH.</em>','The zombies will wait. For now.','','RESUME');
    else if(state==='paused'){state='playing';overlay.classList.add('hidden');ui()}
  }
  function nextWave(){wave++;state='playing';overlay.classList.add('hidden');waveStart()}
  function buy(id){
    if(state!=='shop')return;
    const cost=upgradeCost(id);
    if(cash<cost||upgradeStatus(id))return;
    cash-=cost;
    if(id==='damage')damageLevel++;
    else if(id==='speed')speedLevel++;
    else if(id==='split')splitShot=true;
    else if(id==='auto')autoFire=true;
    else if(id==='heal'){lives++;healsThisShop++}
    else if(id==='freeze')freezeCharges++;
    else if(id==='power')powerCharges++;
    else if(id==='shield')shieldCharges++;
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
    zombies.push({id:++zombieId,x:FIELD_LEFT+50+Math.random()*(FIELD_RIGHT-FIELD_LEFT-100),y:-38,r:21,hp,maxHp:hp,speed:42+wave*10+Math.random()*18,phase:Math.random()*6.28,flash:0});
    remaining--;
  }
  function fire(mode='normal'){
    if(state!=='playing'||mode!=='power'&&cooldown>0)return;
    if(mode==='power'&&powerCharges===0)return;
    if(mode==='power'){powerCharges--;ui()}
    const count=mode==='power'?1:splitShot?2:1;
    for(let i=0;i<count;i++)balls.push({x:player.x+(count===2?(i?10:-10):0),y:player.y-29,vx:count===2?(i?90:-90):0,vy:-660,r:mode==='power'?14:10,pierce:mode==='power'?Math.max(3,character.pierce):character.pierce,damage:character.damage+damageLevel+(mode==='power'?4:0),kind:mode==='power'?'charged':character.id,hitIds:[]});
    cooldown=Math.max(.10,.24-speedLevel*.035);tone(mode==='power'?720:430,.075,'triangle',.035);
  }
  function activateFreeze(){
    if(state!=='playing'||freezeCharges===0||freezeTimer>0)return;
    freezeCharges--;freezeTimer=4;ui();tone(950,.22,'sine');
    for(const z of zombies)burst(z.x,z.y,'#b9f6ff',7);
  }
  function burst(x,y,color,n=10){for(let i=0;i<n;i++){let a=Math.random()*Math.PI*2,s=35+Math.random()*135;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.3+Math.random()*.35,max:.65,color,r:2+Math.random()*4})}}
  function update(dt){
    if(state!=='playing')return;cooldown=Math.max(0,cooldown-dt);
    if(freezeTimer>0){freezeTimer=Math.max(0,freezeTimer-dt);if(freezeTimer===0)ui()}
    if(keys.left)player.x-=370*character.speed*dt;if(keys.right)player.x+=370*character.speed*dt;
    player.x=Math.max(FIELD_LEFT+30,Math.min(FIELD_RIGHT-30,player.x));if(keys.shoot&&autoFire)fire();
    spawnTimer-=dt;if(remaining>0&&spawnTimer<=0){spawn();spawnTimer=Math.max(.28,.95-wave*.055)}
    for(const b of balls){b.y+=b.vy*dt;b.x+=b.vx*dt}balls=balls.filter(b=>b.y>-20&&b.x>-20&&b.x<W+20);
    for(const z of zombies){
      if(freezeTimer===0){z.y+=z.speed*dt;z.x+=Math.sin(z.y*.018+z.phase)*26*dt}z.flash=Math.max(0,z.flash-dt);
      for(const b of balls){
        if(b.dead||b.hitIds.includes(z.id))continue;
        let dx=z.x-b.x,dy=z.y-b.y;
        if(dx*dx+dy*dy<(z.r+b.r)**2){
          b.hitIds.push(z.id);b.pierce--;if(b.pierce<=0)b.dead=true;
          z.hp-=b.damage;z.flash=.13;burst(b.x,b.y,b.kind==='charged'?'#fff1a5':'#eef7b2',6);tone(230,.08,'square',.025);
          if(z.hp<=0){z.dead=true;score+=10;cash+=Math.round(10*character.cash);shake=5;burst(z.x,z.y,'#9cdb71',15);tone(190,.13,'triangle');if(score>best){best=score;save('zfi-best',best)}ui()}
          break;
        }
      }
      if(z.y>H-70&&!z.dead){z.dead=true;shake=13;burst(z.x,H-65,shieldCharges?'#9defff':'#e95151',18);tone(115,.3,'sawtooth');if(shieldCharges)shieldCharges--;else lives--;ui();if(lives<=0)end()}
    }
    balls=balls.filter(b=>!b.dead);zombies=zombies.filter(z=>!z.dead);
    for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=180*dt;p.life-=dt}
    particles=particles.filter(p=>p.life>0);shake=Math.max(0,shake-30*dt);
    if(remaining===0&&zombies.length===0&&state==='playing'){healsThisShop=0;shop()}
  }
  function pitch(){
    ctx.fillStyle='#18392f';ctx.fillRect(0,0,W,H);
    for(let x=0;x<W;x+=25){ctx.fillStyle=x%50?'#214b38':'#1c4233';ctx.fillRect(x,0,12,H)}
    ctx.fillStyle='#267245';ctx.fillRect(FIELD_LEFT,0,FIELD_RIGHT-FIELD_LEFT,H);
    for(let y=0;y<H;y+=75){ctx.fillStyle=y%150?'#2b7949':'#287346';ctx.fillRect(FIELD_LEFT,y,FIELD_RIGHT-FIELD_LEFT,75)}
    ctx.strokeStyle='rgba(228,255,219,.72)';ctx.lineWidth=3;ctx.strokeRect(FIELD_LEFT+12,15,FIELD_RIGHT-FIELD_LEFT-24,H-30);
    ctx.beginPath();ctx.moveTo(FIELD_LEFT+12,H/2);ctx.lineTo(FIELD_RIGHT-12,H/2);ctx.arc(W/2,H/2,67,0,Math.PI*2);ctx.stroke();
    ctx.strokeRect(W/2-135,15,270,92);ctx.strokeRect(W/2-60,15,120,37);
    ctx.strokeRect(W/2-135,H-107,270,92);ctx.strokeRect(W/2-60,H-52,120,37);
    ctx.fillStyle='#eafad7';ctx.beginPath();ctx.arc(W/2,150,4,0,7);ctx.fill();ctx.beginPath();ctx.arc(W/2,H-150,4,0,7);ctx.fill();
    ctx.fillStyle='#142c2a';ctx.fillRect(W/2-130,H-12,260,12);
    ctx.fillStyle='#e9f9cb';ctx.fillRect(W/2-105,H-14,210,5);
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
  function football(x,y,r,kind='rookie'){
    ctx.save();ctx.translate(x,y);
    const colors={keeper:'#73e6ef',striker:'#ff923f',captain:'#ffdf58',legend:'#ee84ee',charged:'#fff1a4'};
    if(kind!=='rookie'){
      ctx.shadowColor=colors[kind]||'#ffffff';ctx.shadowBlur=kind==='charged'?25:15;
      ctx.fillStyle=colors[kind]||'#fff';ctx.beginPath();ctx.arc(0,0,r+3,0,7);ctx.fill();ctx.shadowBlur=0;
      if(kind==='striker'){ctx.fillStyle='#ff5b32';ctx.beginPath();ctx.moveTo(-r,-r*.6);ctx.lineTo(-r-14,3);ctx.lineTo(-r,6);ctx.fill()}
      if(kind==='legend'){ctx.strokeStyle='#ffe88c';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-r-12,-r);ctx.lineTo(-r-4,-r*.3);ctx.lineTo(-r-10,r);ctx.stroke()}
    }
    ctx.fillStyle='#f7f9e7';ctx.beginPath();ctx.arc(0,0,r,0,7);ctx.fill();
    ctx.strokeStyle=colors[kind]||'#172d2c';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle=colors[kind]||'#172d2c';ctx.beginPath();
    for(let i=0;i<5;i++){let a=-Math.PI/2+i*Math.PI*2/5;ctx.lineTo(Math.cos(a)*r*.48,Math.sin(a)*r*.48)}
    ctx.closePath();ctx.fill();
    if(kind==='keeper'){ctx.strokeStyle='#1f8f9a';ctx.lineWidth=2;ctx.strokeRect(-r*.6,-r*.6,r*1.2,r*1.2)}
    if(kind==='captain'){ctx.fillStyle='#71531c';ctx.font='bold '+Math.max(7,r)+'px Arial';ctx.textAlign='center';ctx.fillText('★',0,r*.3)}
    if(kind==='charged'){ctx.strokeStyle='#ffbd46';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,r+6,0,7);ctx.stroke()}
    ctx.restore();
  }
  function striker(t){
    ctx.save();ctx.translate(player.x,player.y);let step=Math.sin(t*.012)*2;
    ctx.fillStyle='#153e37';ctx.fillRect(-16,16,11,25+step);ctx.fillRect(5,16,11,25-step);
    const [,shirt,accent]=kitColors[kitColor];
    ctx.fillStyle=shirt;ctx.fillRect(-21,-12,42,35);
    ctx.save();ctx.beginPath();ctx.rect(-21,-12,42,35);ctx.clip();ctx.fillStyle=accent;
    if(kitPattern==='stripes')for(let x=-16;x<23;x+=12)ctx.fillRect(x,-12,6,35);
    if(kitPattern==='hoops'){ctx.fillRect(-21,-3,42,7);ctx.fillRect(-21,13,42,7)}
    if(kitPattern==='halves')ctx.fillRect(0,-12,21,35);
    ctx.restore();
    ctx.fillStyle=['black','red','blue'].includes(kitColor)?'#fffef0':'#224233';ctx.font='bold 19px Arial';ctx.textAlign='center';ctx.fillText(String(character.number),0,14);
    ctx.fillStyle='#264a38';ctx.fillRect(-21,14,42,8);
    ctx.fillStyle='#e4ae80';ctx.fillRect(-26,-5,8,23);ctx.fillRect(18,-5,8,23);
    if(character.id==='keeper'){ctx.fillStyle='#f5fbef';ctx.fillRect(-29,11,12,9);ctx.fillRect(17,11,12,9)}
    if(character.id==='captain'){ctx.fillStyle='#fff2bf';ctx.fillRect(-27,2,10,7)}
    if(character.id==='legend'){ctx.strokeStyle='#ffe6a0';ctx.lineWidth=3;ctx.strokeRect(-20,-11,40,32)}
    ctx.fillStyle='#e4ae80';
    ctx.beginPath();ctx.arc(0,-20,17,0,7);ctx.fill();
    ctx.fillStyle='#16322d';ctx.beginPath();ctx.arc(0,-30,16,Math.PI,Math.PI*2);ctx.fill();ctx.fillRect(-16,-30,32,5);
    if(character.id==='striker'){ctx.fillStyle='#fff0bb';ctx.fillRect(-15,-30,30,4)}
    if(character.id==='legend'){ctx.fillStyle='#fff0a8';ctx.font='bold 14px Arial';ctx.fillText('★',17,-30)}
    football(0,-44,7,character.id);ctx.restore();
  }
  function render(t){
    ctx.save();if(shake)ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);
    pitch();for(const z of zombies)zombie(z,t);for(const b of balls)football(b.x,b.y,b.r,b.kind);striker(t);
    if(freezeTimer>0){ctx.fillStyle='rgba(172,235,255,.13)';ctx.fillRect(0,0,W,H)}
    for(const p of particles){ctx.globalAlpha=Math.min(1,p.life/p.max);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,7);ctx.fill()}
    ctx.restore();
  }
  function loop(t){let dt=Math.min((t-last)/1000,.04);last=t;update(dt);render(t);raf=requestAnimationFrame(loop)}
  $('startButton').addEventListener('click',()=>{if(state==='paused')pause();else if(state==='shop')nextWave();else start()});
  $('overlayContent').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.character)choose(b.dataset.character);if(b.dataset.upgrade)buy(b.dataset.upgrade)});
  $('overlayContent').addEventListener('input',e=>{if(e.target.id==='playerName'){playerName=e.target.value.trim().slice(0,16)||'Player';save('zfi-player-name',playerName)}});
  $('overlayContent').addEventListener('change',e=>{
    if(state!=='menu'&&state!=='over')return;
    if(e.target.id==='kitColor'&&kitColors[e.target.value]){kitColor=e.target.value;save('zfi-kit-color',kitColor)}
    else if(e.target.id==='kitPattern'&&kitPatterns[e.target.value]){kitPattern=e.target.value;save('zfi-kit-pattern',kitPattern)}
    else return;
    $('overlayContent').innerHTML=characterCards();render(performance.now());
  });
  $('soundButton').addEventListener('click',()=>{sound=!sound;$('soundButton').innerHTML='♪ <span>'+(sound?'ON':'OFF')+'</span>';$('soundButton').setAttribute('aria-label','Turn sound '+(sound?'off':'on'));tone(550,.08)});
  window.addEventListener('keydown',e=>{
    if(['ArrowLeft','ArrowRight','Space','KeyA','KeyD','KeyP','KeyQ','KeyE'].includes(e.code))e.preventDefault();
    if(e.code==='ArrowLeft'||e.code==='KeyA')keys.left=true;
    if(e.code==='ArrowRight'||e.code==='KeyD')keys.right=true;
    if(e.code==='Space'){keys.shoot=true;if(!e.repeat)fire()}
    if(e.code==='KeyQ'&&!e.repeat)activateFreeze();
    if(e.code==='KeyE'&&!e.repeat)fire('power');
    if(e.code==='KeyP'&&!e.repeat)pause();
    if(e.code==='Enter'&&!e.repeat&&state==='menu')start();
  });
  window.addEventListener('keyup',e=>{if(e.code==='ArrowLeft'||e.code==='KeyA')keys.left=false;if(e.code==='ArrowRight'||e.code==='KeyD')keys.right=false;if(e.code==='Space')keys.shoot=false});
  window.addEventListener('blur',()=>{keys.left=keys.right=keys.shoot=false;if(state==='playing')pause()});
  canvas.addEventListener('pointermove',e=>{if(state==='playing'&&e.pointerType!=='touch'){let r=canvas.getBoundingClientRect();player.x=Math.max(FIELD_LEFT+30,Math.min(FIELD_RIGHT-30,(e.clientX-r.left)*W/r.width))}});
  canvas.addEventListener('pointerdown',e=>{if(state==='playing'){let r=canvas.getBoundingClientRect();player.x=Math.max(FIELD_LEFT+30,Math.min(FIELD_RIGHT-30,(e.clientX-r.left)*W/r.width));fire()}});
  $('freezeButton').addEventListener('click',activateFreeze);
  $('powerButton').addEventListener('click',()=>fire('power'));
  for(const [id,key] of [['leftButton','left'],['rightButton','right'],['shootButton','shoot']]){
    let el=$(id);el.addEventListener('pointerdown',e=>{e.preventDefault();el.setPointerCapture(e.pointerId);keys[key]=true;if(key==='shoot')fire()});
    for(const ev of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(ev,()=>keys[key]=false);
  }
  ui();menu();render(0);
})();
