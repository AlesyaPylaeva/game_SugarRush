'use strict';
(() => {
const $=id=>document.getElementById(id), canvas=$('game'), ctx=canvas.getContext('2d');
const W=1200,H=650,FLOOR=535,CEIL=0,MIDDLE=325,KEY='sugar-rush-v1';
const defaults=()=>({best:0,wallet:0,gold:0,owned:['mint'],skin:'mint',duration:0,magnet:0,runs:0});
let data=defaults(),storageOK=true;
try{const d=JSON.parse(localStorage.getItem(KEY));if(d&&typeof d==='object'){for(const k of ['best','wallet','gold','duration','magnet','runs'])if(Number.isFinite(d[k])&&d[k]>=0)data[k]=Math.floor(d[k]);if(Array.isArray(d.owned))for(const [skin,cost] of Object.entries({berry:15,violet:25,peach:35}))if(d.owned.includes(skin))data.gold+=cost;data.duration=Math.min(3,data.duration);data.magnet=Math.min(3,data.magnet);data.owned=['mint',...(['night','strawberry'].filter(s=>Array.isArray(d.owned)&&d.owned.includes(s)))];if(data.owned.includes(d.skin))data.skin=d.skin;}}catch(e){storageOK=false;}
function save(){try{localStorage.setItem(KEY,JSON.stringify(data));}catch(e){storageOK=false;} $('wallet').textContent='🍬 '+data.wallet+'  🪙 '+data.gold;}
let state='menu',world,player,clock=0,last=0,acc=0,sound=false,audio,toastTimer;
const input={keys:new Set(),touchUp:false,touchDown:false};
function clearInput(){input.keys.clear();input.touchUp=false;input.touchDown=false;}
const scenery={};
if(typeof Image!=='undefined')for(const [key,src] of Object.entries({panorama:'assets/candy-journey.png',platform:'assets/world/platform.png',fork:'assets/world/fork-purple.png',shards:'assets/world/shards-purple.png',spikes:'assets/world/spikes-purple.png',bear:'assets/world/gummy-bear.png'})){const im=new Image();im.src=src;scenery[key]=im;}
const panorama=scenery.panorama;
const spriteSets={};
if(typeof Image!=='undefined')for(const [name,set] of Object.entries(window.SUGAR_SPRITES||{})){spriteSets[name]={height:set.height,frames:set.frames.map(src=>{const im=new Image();im.src=src;return im;})};}
const strawberrySets={};
if(typeof Image!=='undefined')for(const [name,set] of Object.entries(window.STRAWBERRY_SPRITES||{})){strawberrySets[name]={height:set.height,frames:set.frames.map(src=>{const im=new Image();im.src=src;return im;})};}
const nightSets={};
if(typeof Image!=='undefined')for(const [name,set] of Object.entries(window.NIGHT_SPRITES||{})){nightSets[name]={height:set.height,frames:set.frames.map(src=>{const im=new Image();im.src=src;return im;})};}
function outfitFilter(){return 'none';}
let shopTab='outfits';
const skins={mint:'#6bcbb8',strawberry:'#ea5973',night:'#6553a4'};
function toast(t){$('toast').textContent=t;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2300);}
function beep(freq=660){if(!sound)return;try{audio??=new (window.AudioContext||window.webkitAudioContext)();const o=audio.createOscillator(),g=audio.createGain();o.connect(g);g.connect(audio.destination);o.frequency.value=freq;g.gain.setValueAtTime(.04,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.13);o.start();o.stop(audio.currentTime+.14);}catch(e){}}
function reset(){clearInput();world={time:0,pop:0,shieldIntro:0,deathAt:0,x:0,speed:290,coins:0,gold:0,tokens:[],platforms:[{x:-100,w:1600},{x:1030,w:360,y:MIDDLE}],obstacles:[],enemies:[],shots:[],armed:false,shotCooldown:0,blasterAt:10000,candies:[],bonuses:[],particles:[],next:1500,bonusAt:1050,effects:{flight:0,shield:0,magnet:0},invuln:0};player={x:230,y:FLOOR-65,w:38,h:65,vy:0,jumps:0,ground:true,dropThrough:0};for(let i=0;i<6;i++)world.candies.push({x:1060+i*58,y:MIDDLE-45,type:i%5});world.tokens.push({x:1340,y:MIDDLE-120});}
function screen(kind){state=kind;$('hud').hidden=true;$('effects').hidden=true;$('shoot').hidden=true;const o=$('overlay');o.className=kind==='menu'?'menu':'center';let body='';
if(kind==='menu')body=`<h1>Sugar <em>Rush!</em></h1><div class="actions"><button class="primary" data-act="play">Играть →</button><button class="secondary" data-act="record">Мой рекорд</button><button class="secondary" data-act="shop">Магазин</button></div><p>Собирай сладости. Найди бластер и останови медведя!</p>`;
if(kind==='record')body=`<div class="tag">ТВОЯ СЛАДКАЯ ИСТОРИЯ</div><h2>Мой рекорд ✧</h2><div class="stats"><div><b>${data.best}</b><small>МЕТРОВ</small></div><div><b>${data.runs}</b><small>ЗАБЕГОВ</small></div></div><p>Каждый новый забег — шанс прыгнуть выше!</p><div class="actions"><button class="primary" data-act="play">Играть</button><button class="secondary" data-act="menu">В меню</button></div>`;
if(kind==='paused')body=`<div class="tag">МОЖНО ПЕРЕВЕСТИ ДУХ</div><h2>Сладкая пауза</h2><p>Твоё приключение подождёт.</p><div class="actions"><button class="primary" data-act="resume">Продолжить →</button><button class="secondary" data-act="quit">Завершить забег</button></div>`;
if(kind==='over')body=`<div class="tag">${world.newBest?'✦ НОВЫЙ РЕКОРД!':'ЕЩЁ ОДИН СЛАДКИЙ ЗАБЕГ?'}</div><h2>Вот это приключение!</h2><div class="stats"><div><b>${Math.floor(world.x/20)}</b><small>МЕТРОВ</small></div><div><b>+${world.coins}</b><small>ЛЕДЕНЦОВ</small></div><div><b>+${world.gold}</b><small>МОНЕТОК</small></div><div><b>${data.best}</b><small>РЕКОРД</small></div></div><p>Леденцы уже в кошельке. Выбери новый образ или попробуй снова!</p><div class="actions"><button class="primary" data-act="play">Ещё раз →</button><button class="secondary" data-act="shop">Магазин</button><button class="secondary" data-act="menu">В меню</button></div>`;
if(kind==='shop'){
 const outfits=['mint','strawberry','night'].map((s,i)=>`<div class="item"><div class="outfit-preview"><img src="${s==='strawberry'?'assets/strawberry/idle-0.png':s==='night'?'assets/night/idle-0.png':'assets/hero/idle-0.png'}" alt="${s==='strawberry'?'Клубничное платье с белыми оборками':'Героиня в выбранной цветовой палитре'}" style="filter:${outfitFilter(s)}" width="140" height="170"></div><h3>${['Мятная мечта','Клубничная фея','Ночная фея'][i]}</h3><p>${s==='strawberry'?'Клубничное платье, венок и красные ботинки':s==='night'?'Лиловое платье, бантик и лунный ободок':'Мятная толстовка и полосатые гольфы'}</p><button data-buy="${s}" ${data.skin===s?'disabled':''}>${data.skin===s?'Выбрано':data.owned.includes(s)?'Надеть':'🪙 '+[0,50,45][i]}</button></div>`).join('');
 const upgrades=['duration','magnet'].map((k,i)=>`<div class="item"><div class="icon">${i?'🧲':'✦'}</div><h3>${i?'Сильный магнит':'Дольше волшебство'}</h3><p>${i?'Радиус магнита +45':'Длительность бонусов +2 сек.'}<br>Уровень ${data[k]} / 3</p><button data-buy="${k}" ${data[k]>=3?'disabled':''}>${data[k]>=3?'Максимум':'🍬 '+(100+data[k]*100)}</button></div>`).join('');
 body=`<div class="tag">НАРЯДИСЬ ДЛЯ ПРИКЛЮЧЕНИЙ</div><h2>Сладкий бутик</h2><div class="shop-tabs" role="tablist" aria-label="Разделы магазина"><button role="tab" id="outfits-tab" aria-controls="shop-content" aria-selected="${shopTab==='outfits'}" data-tab="outfits">Наряды</button><button role="tab" id="upgrades-tab" aria-controls="shop-content" aria-selected="${shopTab==='upgrades'}" data-tab="upgrades">Улучшения</button></div><p>${shopTab==='outfits'?'Наряды за монетки · 🪙 '+data.gold:'Улучшения за леденцы · 🍬 '+data.wallet}</p><div class="shop" role="tabpanel" id="shop-content" aria-labelledby="${shopTab==='outfits'?'outfits-tab':'upgrades-tab'}">${shopTab==='outfits'?outfits:upgrades}</div><div class="actions"><button class="primary" data-act="play">Играть →</button><button class="secondary" data-act="menu">В меню</button></div>`;
}

o.innerHTML=`<div class="panel">${body}</div>`;save();}
function start(){reset();state='running';$('overlay').className='empty';$('overlay').innerHTML='';$('hud').hidden=false;$('effects').hidden=false;updateHud();}
function resume(){clearInput();state='running';$('overlay').className='empty';$('hud').hidden=false;$('effects').hidden=false;}
function end(){if(state!=='running'&&state!=='paused')return;const dist=Math.floor(world.x/20);world.deathAt=clock;world.deathElapsed=0;world.invuln=0;world.newBest=dist>data.best;data.best=Math.max(data.best,dist);data.runs++;save();state='dying';clearInput();player.y=Math.min(player.y,FLOOR-player.h);$('overlay').className='empty';$('overlay').innerHTML='';$('effects').hidden=true;$('shoot').hidden=true;beep(170);}
function updateDeath(dt){if(state!=='dying')return;world.deathElapsed+=dt;if(world.deathElapsed>=2)screen('over');}
function pause(){clearInput();if(state==='running')screen('paused');else if(state==='paused')resume();}
function jump(){if(state!=='running')return;if(world.effects.flight>0)return;if(player.jumps<2){player.vy=-(player.jumps===0?740:680);player.jumps++;player.animAt=world.time;player.ground=false;beep(450+player.jumps*160);}}
function down(){if(state==='running'){if(player.ground&&player.y+player.h<FLOOR-10){player.dropThrough=.25;player.y+=5;player.ground=false;}if(world.effects.flight<=0)player.vy=1000;}}
$('overlay').addEventListener('click',e=>{const tab=e.target.closest('[data-tab]')?.dataset.tab;if(tab&&['outfits','upgrades'].includes(tab)){shopTab=tab;screen('shop');$('overlay').querySelector?.(`[data-tab="${tab}"]`)?.focus();return;}const a=e.target.closest('[data-act]')?.dataset.act,b=e.target.closest('[data-buy]')?.dataset.buy;if(a){if(a==='play')start();else if(a==='resume')resume();else if(a==='quit')end();else screen(a);}if(b){if(skins[b]){if(data.owned.includes(b)){data.skin=b;}else{let cost={berry:15,violet:25,peach:35,night:45,strawberry:50}[b];if(data.gold<cost)return toast('Для этого скина нужны монетки 🪙');data.gold-=cost;data.owned.push(b);data.skin=b;}}else{if(data[b]>=3)return;let cost=100+data[b]*100;if(data.wallet<cost)return toast('Нужно ещё немного леденцов 🍬');data.wallet-=cost;data[b]++;}save();screen('shop');}});
$('shoot').onpointerdown=e=>{e.preventDefault();shoot();};
$('pause').onclick=pause;$('sound').onclick=()=>{sound=!sound;$('sound').textContent=sound?'♫':'♪';$('sound').setAttribute('aria-label',sound?'Выключить звук':'Включить звук');if(sound)beep();};
document.querySelector('.brand').onclick=e=>{e.preventDefault();if(state==='running')pause();else if(state!=='paused'&&state!=='dying')screen('menu');};
window.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','Space'].includes(e.code))e.preventDefault();input.keys.add(e.code);if(e.repeat)return;if(e.code==='Space'&&world.armed)shoot();else if(['ArrowUp','KeyW','Space'].includes(e.code))jump();if(['ArrowDown','KeyS'].includes(e.code))down();if(['Escape','KeyP'].includes(e.code))pause();});
window.addEventListener('keyup',e=>input.keys.delete(e.code));
$('jump').onpointerdown=e=>{e.preventDefault();input.touchUp=true;$('jump').setPointerCapture?.(e.pointerId);jump();};
$('down').onpointerdown=e=>{e.preventDefault();input.touchDown=true;$('down').setPointerCapture?.(e.pointerId);down();};
for(const id of ['jump','down'])for(const ev of ['pointerup','pointercancel','lostpointercapture'])$(id).addEventListener(ev,()=>{input[id==='jump'?'touchUp':'touchDown']=false;});document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();if(state==='running')pause();}});window.addEventListener('blur',()=>{clearInput();if(state==='running')pause();});
const rand=(a,b)=>a+Math.random()*(b-a);
function clearCoinSpot(x,y,coin){
 if(y<Math.max(130,CEIL+35)||y>FLOOR-30)return false;
 const intersects=(left,top,w,h,pad=34)=>x+pad>left&&x-pad<left+w&&y+pad>top&&y-pad<top+h;
 if(world.platforms.some(p=>intersects(p.x,p.y??FLOOR,p.w,(p.y??FLOOR)<FLOOR?60:155)))return false;
 if(world.obstacles.some(o=>intersects(o.x-(o.type===4?26:0),o.y,o.w+(o.type===4?52:0),o.h,42)))return false;
 if(world.bonuses.some(b=>!b.dead&&Math.hypot(x-b.x,y-b.y)<78))return false;
 if(world.candies.some(c=>!c.dead&&Math.hypot(x-c.x,y-c.y-8)<64))return false;
 if(world.tokens.some(c=>c!==coin&&!c.dead&&Math.hypot(x-c.x,y-c.y)<55))return false;
 return true;
}
function placeCoin(coin){
 if(clearCoinSpot(coin.x,coin.y,coin))return true;
 const ox=coin.x,oy=coin.y;
 for(const dx of [0,-70,70,-140,140,-220,220])for(const y of [oy-75,oy+75,FLOOR-65,MIDDLE-120,MIDDLE-55,CEIL+45]){
  if(clearCoinSpot(ox+dx,y,coin)){coin.x=ox+dx;coin.y=y;return true;}
 }
 // Do not leave an inaccessible coin hidden inside dense scenery.
 coin.dead=true;return false;
}
function generate(){let changed=false;while(world.next<world.x+W+600){
 changed=true;const group=Math.random()<.82?[rand(1050,1550)]:Array.from({length:Math.random()<.5?2:3},()=>rand(240,360));
 for(const len of group){
  const gap=len>600?rand(100,155):rand(65,100),start=world.next+gap;
  const inFlight=world.flightEnd&&start<world.flightEnd;
  world.platforms.push({x:start,w:len});
  const ox=start+rand(260,350);
  const clearAbove=!world.platforms.some(p=>p.y===MIDDLE&&ox+620>p.x&&ox-620<p.x+p.w);
  if(len>600&&!inFlight&&!world.armed&&clearAbove)world.obstacles.push({x:ox,y:FLOOR-90,w:68,h:90,type:start>2600&&Math.random()<.38?4:Math.floor(rand(0,3))});
  if(len>600){
   const pace=Math.min(620,world.speed+Math.max(0,start-world.x)/Math.max(290,world.speed)*2.2),span=pace*1.09;
   for(let i=0;i<7;i++)world.candies.push({x:start+65+i*span/6,y:FLOOR-42-200*4*(i/6)*(1-i/6),type:Math.floor(rand(0,5))});
  }else for(let i=0;i<3;i++)world.candies.push({x:start+30+i*(len-60)/2,y:FLOOR-52,type:i%5});
  // Upper routes begin after the lower jump and hazard, rather than covering them.
  if(len>600&&!inFlight&&!world.armed){
   let ux=start+950;
   const widths=Math.random()<.5?[rand(400,570)]:Array.from({length:Math.random()<.5?2:3},()=>rand(130,190));
   for(const width of widths){
    if(!world.platforms.some(p=>p.y===MIDDLE&&ux<p.x+p.w+90&&ux+width>p.x-90)){
     world.platforms.push({x:ux,w:width,y:MIDDLE});
     if(width>=300&&start>4000&&Math.random()<.35)world.obstacles.push({x:ux+width*.6,y:MIDDLE-85,w:62,h:85,type:4,upper:true});
     const n=Math.max(2,Math.floor(width/65));for(let i=0;i<n;i++){const cx=ux+25+i*(width-50)/(n-1),nearBear=world.obstacles.some(o=>o.upper&&Math.abs(cx-o.x-o.w/2)<110);world.candies.push({x:cx,y:MIDDLE-(nearBear?140:45),type:i%5});}
    }
    ux+=width+rand(65,95);
   }
  }
  if(Math.random()<.28)world.tokens.push({x:start+len*.7,y:FLOOR-85});
  world.next=start+len;
 }
}
if(!world.armed&&world.bonusAt<world.x+1100){changed=true;const types=['flight','shield','magnet'];world.bonuses.push({x:world.bonusAt,y:FLOOR-125,type:types[Math.floor(world.bonusAt/1200)%3]});world.bonusAt+=1200;}
if(!world.armed&&world.effects.flight<=0&&world.x+1100>=world.blasterAt&&!world.bonuses.some(b=>b.type==='blaster'&&!b.dead)){world.bonuses.push({x:Math.max(world.blasterAt,world.x+650),y:FLOOR-85,type:'blaster'});world.blasterAt+=10000;}
if(changed)for(const coin of world.tokens)if(!coin.dead)placeCoin(coin);
for(const k of ['platforms','obstacles','candies','bonuses','tokens'])world[k]=world[k].filter(o=>o.x+(o.w||30)>world.x-100&&!o.dead);}
function shoot(){
 if(state!=='running'||!world.armed||world.shotCooldown>0)return;
 world.shots.push({x:world.x+player.x+40,y:player.y+24,w:26,h:12});world.shotCooldown=.22;beep(1250);
}
function blasterEncounter(){
 if(world.armed||world.enemies.length)return;
 world.armed=true;world.shots=[];world.shotCooldown=0;
 world.effects.flight=0;world.flightEnd=0;world.obstacles=world.obstacles.filter(o=>!o.flightOnly);
 const px=world.x+player.x,end=px+2700;
 world.platforms=world.platforms.filter(p=>p.y!==MIDDLE||p.x+p.w<px||p.x>end);
 world.platforms.push({x:px-150,w:3000});
 world.obstacles=world.obstacles.filter(o=>o.x+o.w<px-50||o.x>end);
 world.bonuses=world.bonuses.filter(b=>b.type==='blaster'||b.x>end||b.x<px);
 player.y=FLOOR-player.h;player.vy=0;player.ground=true;player.jumps=0;
 for(let i=0;i<3;i++)world.enemies.push({x:px+1050+i*430,y:FLOOR-100,w:76,h:100,speed:145});
 for(const coin of world.tokens)if(!coin.dead&&coin.x>px&&coin.x<end){coin.y=FLOOR-170;placeCoin(coin);}
 toast('Бластер! Пробел — стрелять. Три медведя бегут навстречу!');
}
function updateCombat(dt){
 world.shotCooldown=Math.max(0,world.shotCooldown-dt);
 for(const enemy of world.enemies)enemy.x-=enemy.speed*dt;
 for(const shot of world.shots){
  const oldX=shot.x;shot.x+=1050*dt;
  for(const enemy of world.enemies)if(!enemy.dead&&!shot.dead&&oldX<=enemy.x+enemy.w&&shot.x+shot.w>=enemy.x&&shot.y+shot.h>=enemy.y&&shot.y<=enemy.y+enemy.h){
   enemy.dead=true;shot.dead=true;burst(enemy.x-world.x+enemy.w/2,enemy.y+40,'#a56be3',24);beep(750);toast('Попадание! Медведь исчез — продолжай стрелять!');
  }
 }
 const px=world.x+player.x;
 for(const enemy of world.enemies)if(!enemy.dead){
  if((enemy.x<px+player.w-5&&enemy.x+enemy.w>px+5&&player.y+player.h>enemy.y&&player.y-25<enemy.y+enemy.h)||enemy.x+enemy.w<px){end();return;}
 }
 const defeated=world.enemies.some(e=>e.dead);world.enemies=world.enemies.filter(e=>!e.dead);
 world.shots=world.shots.filter(s=>!s.dead&&s.x<world.x+W+100);
 if(defeated&&!world.enemies.length){world.armed=false;world.shots=[];world.blasterAt=world.x+8500;}
}
function flightCourse(){
 const px=world.x+player.x,duration=world.effects.flight;
 const finish=px+world.speed*(duration-1.25);world.flightEnd=finish+180;
 world.obstacles=world.obstacles.filter(o=>o.x<px+80||o.x>world.flightEnd);
 world.platforms=world.platforms.filter(p=>p.y!==MIDDLE||p.x+p.w<px||p.x>world.flightEnd);
 // A safe landing strip remains beneath the aerial course when the wings expire.
 world.platforms.push({x:px-80,w:world.flightEnd-px+850});
 world.candies=world.candies.filter(c=>c.x<px+200||c.x>world.flightEnd);
 world.bonuses.push({x:px+950,y:350,type:'magnet'},{x:px+1500,y:245,type:'shield'});
 let i=0;
 for(let x=px+480;x<finish;x+=430){
  const center=[250,350,245,345][i%4],top=center-100,bottom=center+100;
  world.obstacles.push({x,y:CEIL,w:62,h:top-CEIL,type:3,flightOnly:true},{x,y:bottom,w:62,h:FLOOR-bottom,type:3,flightOnly:true});
  for(let j=-1;j<=1;j++)world.candies.push({x:x+30+j*58,y:center,type:(i+j+6)%5});i++;
 }
 for(const coin of world.tokens)if(!coin.dead)placeCoin(coin);
}
function activate(type){if(type==='blaster'){blasterEncounter();return;}if(world.armed&&type==='flight')return;if(!['flight','shield','magnet'].includes(type))return;world.effects[type]=8+data.duration*2;if(type==='shield')world.shieldIntro=.65;if(type==='flight'){player.vy=0;player.y=300;player.jumps=0;flightCourse();}toast({flight:'🪽 Плавный полёт: держи ↑ или ↓ для смены высоты',shield:'◯ Жвачный пузырь защищает',magnet:'🧲 Магнит притягивает леденцы'}[type]);beep(900);}
function burst(x,y,color,n=12){for(let i=0;i<n;i++)world.particles.push({x,y,vx:rand(-130,130),vy:rand(-180,80),life:.65,color});}
function hit(){if(world.invuln>0)return;if(world.effects.shield>0){world.effects.shield=0;world.pop=.55;world.invuln=1.5;burst(player.x+20,player.y+25,'#f378bb',28);toast('Поп! Пузырь спас тебя');beep(220);}else end();}
function update(dt){world.time+=dt;player.dropThrough=Math.max(0,player.dropThrough-dt);world.pop=Math.max(0,world.pop-dt);world.shieldIntro=Math.max(0,world.shieldIntro-dt);const prevWorldX=world.x;world.x+=world.speed*dt;world.speed=Math.min(620,290+world.time*2.2);generate();world.invuln=Math.max(0,world.invuln-dt);for(const k in world.effects){const prev=world.effects[k];world.effects[k]=Math.max(0,prev-dt);if(k==='flight'&&prev>0&&world.effects[k]===0){world.obstacles=world.obstacles.filter(o=>!o.flightOnly);world.flightEnd=0;player.vy=0;player.jumps=0;}}

let flight=world.effects.flight>0,old=player.y;if(flight){
 const up=input.touchUp||['ArrowUp','KeyW',...(world.armed?[]:['Space'])].some(k=>input.keys.has(k));
 const dn=input.touchDown||['ArrowDown','KeyS'].some(k=>input.keys.has(k));
 const target=dn?260:up?-260:105;
 const change=850*dt;player.vy+=Math.max(-change,Math.min(change,target-player.vy));
}else player.vy+=1350*dt;player.y+=player.vy*dt;player.ground=false;
const head=flight?11:31;
// The sprite is taller than the original collision body; reserve space for its head.
if(player.y-head<CEIL){player.y=CEIL+head;player.vy=Math.max(0,player.vy);}
if(flight){player.y=Math.min(FLOOR-player.h-15,player.y);if(player.y===FLOOR-player.h-15)player.vy=Math.min(0,player.vy);}
const px=world.x+player.x,previousPx=prevWorldX+player.x;
for(const p of world.platforms){
 const y=p.y??FLOOR,bottom=y+(y<FLOOR?60:H-FLOOR);
 if(y<FLOOR&&player.dropThrough>0)continue;
 const overlaps=px+player.w-6>p.x&&px+6<p.x+p.w;
 if(overlaps&&player.vy>=0&&old+player.h<=y+2&&player.y+player.h>=y){
  player.y=y-player.h;player.vy=0;player.ground=true;player.jumps=0;
 }else if(overlaps&&player.vy<0&&old-head>=bottom-2&&player.y-head<bottom){
  player.y=bottom+head;player.vy=0;
 }else if(player.y+player.h>y+3&&player.y-head<bottom-3&&previousPx+player.w-6<=p.x&&px+player.w-6>p.x){
  // Forgiving ledge assistance keeps auto-running; never rewind the world.
  if(player.y+player.h<=y+55){player.y=y-player.h;player.vy=0;player.ground=true;player.jumps=0;}
  else if(y<FLOOR){player.y=bottom+head;player.vy=Math.max(0,player.vy);}
  else{hit();if(state!=='running')return;}
 }
}
if(player.y>H+80){if(world.effects.shield>0){hit();const next=world.platforms.find(p=>(p.y??FLOOR)===FLOOR&&p.x+p.w>px+50);if(next){world.x=Math.max(world.x,next.x-player.x+25);player.y=FLOOR-player.h;player.vy=-400;}}else end();}
updateCombat(dt);if(state!=='running')return;
for(const o of world.obstacles){if(o.flightOnly&&world.effects.flight<=0)continue;const x=o.x-world.x+(o.type===4?Math.sin(world.time*2.8+o.x)*24:0);if(x<player.x+player.w-7&&x+o.w>player.x+7&&player.y+player.h-4>o.y&&player.y+8<o.y+o.h){hit();if(state!=='running')return;}}
for(const c of world.candies){const x=c.x-world.x,dx=player.x+20-x,dy=player.y+25-c.y,d=Math.hypot(dx,dy);if(world.effects.magnet>0&&d<190+data.magnet*45){c.x+=dx*dt*7;c.y+=dy*dt*7;}if(d<44&&!c.dead){c.dead=true;world.coins+=5;data.wallet+=5;save();burst(x,c.y,'#ffb951',6);beep(1000);}}
for(const coin of world.tokens){
 const dx=player.x+20-(coin.x-world.x),dy=player.y+25-coin.y,d=Math.hypot(dx,dy);
 if(world.effects.magnet>0&&d<190+data.magnet*45){coin.x+=dx*dt*7;coin.y+=dy*dt*7;}
 if(!coin.dead&&d<38){coin.dead=true;world.gold++;data.gold++;save();burst(coin.x-world.x,coin.y,'#ffd16b',12);beep(1400);}
}
for(const b of world.bonuses)if(!b.dead&&Math.hypot(b.x-world.x-player.x-20,b.y-player.y-25)<55){b.dead=true;activate(b.type);}
world.particles=world.particles.filter(p=>p.life>0);for(const p of world.particles){p.x+=p.vx*dt-world.speed*dt*.4;p.y+=p.vy*dt;p.vy+=500*dt;p.life-=dt;}updateHud();}
function updateHud(){$('distance').textContent=Math.floor(world.x/20)+' м';$('coins').textContent=world.coins;$('gold').textContent=world.gold;$('shoot').hidden=!world.armed;$('effects').textContent=(world.armed?'БЛАСТЕР · ПРОБЕЛ — СТРЕЛЯТЬ  ':'')+Object.entries(world.effects).filter(([k,v])=>v>0).map(([k,v])=>({flight:'🪽 Полёт',shield:'◯ Щит',magnet:'🧲 Магнит'}[k])+' '+Math.ceil(v)+'с').join(' · ');}
function round(x,y,w,h,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
function ellipse(x,y,rx,ry,color){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();}
function line(x,y,x2,y2,color,width){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.stroke();}
const candyColors=[['#ec4f8c','#ffbcd6','#b94576'],['#39baa8','#c1fff1','#278e83'],['#9c70de','#e4d3ff','#734cb6'],['#f39b37','#ffe2a2','#c57624'],['#50a8e5','#d2f2ff','#387cb5']];
function candy(x,y,type=0,scale=1){
 const [dark,light,rim]=candyColors[type%candyColors.length];
 ctx.save();ctx.translate(x,y);ctx.rotate(-.39);ctx.scale(scale,scale);
 // The stick leans 22 degrees right, as in the user's spiral lollipop reference.
 line(1,12,1,41,'#c99149',10);line(0,12,0,39,'#ffcc7d',7);line(-2,16,-2,36,'#ffe1a0',2);
 ellipse(0,0,21,21,rim);
 const glaze=ctx.createRadialGradient(-7,-9,1,1,1,22);glaze.addColorStop(0,light);glaze.addColorStop(.65,dark);glaze.addColorStop(1,rim);
 ellipse(0,-1,19.5,19.5,glaze);
 ctx.save();ctx.beginPath();ctx.arc(0,-1,19,0,Math.PI*2);ctx.clip();
 ctx.strokeStyle=light;ctx.lineWidth=5;ctx.lineCap='round';ctx.beginPath();
 for(let a=0;a<=Math.PI*4.8;a+=.05){let r=a*1.35;let px=Math.cos(a)*r,py=-1+Math.sin(a)*r;if(a===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);}ctx.stroke();ctx.restore();
 ctx.globalAlpha=.5;ctx.strokeStyle='#fff7fb';ctx.lineWidth=2;ctx.beginPath();ctx.arc(-1,-2,16,3.5,4.75);ctx.stroke();ctx.restore();
}
function drawCoin(x,y){
 ctx.save();ctx.translate(x,y);const g=ctx.createRadialGradient(-6,-7,1,0,0,20);g.addColorStop(0,'#fff3b8');g.addColorStop(.55,'#ffd153');g.addColorStop(1,'#bf791f');ellipse(0,0,19,21,'#a9671d');ellipse(0,-1,16,18,g);ctx.strokeStyle='#fff0a4';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,-1,12,14,0,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#b87824';ctx.font='400 22px "Jonova Condensed", Arial';ctx.textAlign='center';ctx.fillText('✦',0,7);ctx.restore();
}
function drawNight(){
 const n=(1-Math.cos(world.time*Math.PI*2/150))/2;
 if(n<.01)return;
 ctx.fillStyle=`rgba(23,16,65,${n*.67})`;ctx.fillRect(0,0,W,H);
 ctx.save();ctx.globalAlpha=Math.max(0,(n-.45)/.55)*.8;
 for(let i=0;i<38;i++){const x=(i*173+57)%W,y=120+(i*71)%220;ellipse(x,y,i%3===0?1.8:1, i%3===0?1.8:1,'#ffeddf');}
 ellipse(1020,175,25,25,'#fff1ce');ellipse(1032,166,23,23,'#333054');ctx.restore();
}
function drawPlatform(p,scroll){
 const y=p.y??FLOOR,depth=y<FLOOR?60:155,x=p.x-scroll;if(x>W||x+p.w<0)return;
 const im=scenery.platform;
 if(im?.complete&&im.naturalWidth){
  // Preserve both rounded end caps and the entire height; only the centre repeats.
  const sw=im.naturalWidth,sh=im.naturalHeight,cap=Math.min(28,p.w/3),sourceCap=sw*.1;
  ctx.drawImage(im,0,0,sourceCap,sh,x,y,cap,depth);
  const start=x+cap,end=x+p.w-cap,tile=180;
  for(let xx=start;xx<end;xx+=tile){const width=Math.min(tile,end-xx);if(xx+width<0||xx>W)continue;ctx.drawImage(im,sourceCap,0,(sw-sourceCap*2)*width/tile,sh,xx,y,width,depth);}
  ctx.drawImage(im,sw-sourceCap,0,sourceCap,sh,x+p.w-cap,y,cap,depth);
 }else{
  const cake=ctx.createLinearGradient(0,y,0,y+depth);cake.addColorStop(0,'#f7afc0');cake.addColorStop(.35,'#dc7899');cake.addColorStop(.4,'#ffe2ce');cake.addColorStop(.55,'#fff0df');cake.addColorStop(.6,'#ee9ab0');cake.addColorStop(1,'#ce6686');round(x,y,p.w,depth,8,cake);round(x,y,p.w,15,7,'#f589b1');
 }
}
function drawObstacle(o,scroll){
 if(o.flightOnly&&world.effects.flight<=0)return;
 const x=o.x-scroll+(o.type===4?Math.sin(world.time*2.8+o.x)*24:0);if(x>W+50||x+o.w<0)return;
 if(o.type===3){
 const g=ctx.createLinearGradient(x,0,x+o.w,0);g.addColorStop(0,'#241033');g.addColorStop(.35,'#73528c');g.addColorStop(.7,'#3e1b59');g.addColorStop(1,'#1e0c30');round(x,o.y,o.w,o.h,7,g);
 for(let y=o.y+10;y<o.y+o.h;y+=25)line(x+8,y,x+o.w-8,y+3,'#b491cf',3);
 const edge=o.y===CEIL?o.y+o.h:o.y;line(x+4,edge,x+o.w-4,edge,'#f6d9ff',4);return;
 }
 const im=o.type===4?scenery.bear:scenery[['fork','shards','spikes'][o.type]];
 ellipse(x+o.w/2,o.y+o.h-2,o.w*.6,5,'#71354c25');
 if(im?.complete&&im.naturalWidth){const bob=o.type===4?Math.sin(world.time*11)*2:0;ctx.drawImage(im,x,o.y+bob,o.w,o.h-bob);}
 else{ctx.fillStyle='#35134e';ctx.strokeStyle='#fff0f4';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,FLOOR);for(let i=0;i<3;i++){ctx.lineTo(x+i*o.w/3+o.w/6,o.y);ctx.lineTo(x+(i+1)*o.w/3,FLOOR);}ctx.closePath();ctx.fill();ctx.stroke();}

}
function drawBonus(b,scroll){
 const x=b.x-scroll;if(x<-65||x>W+65)return;
 ctx.save();ctx.translate(x,b.y);ctx.scale(1.25,1.25);ctx.lineJoin='round';ctx.lineCap='round';
 const outlined=(path,fill,stroke)=>{path();ctx.strokeStyle='white';ctx.lineWidth=9;ctx.stroke();if(fill){ctx.fillStyle=fill;ctx.fill();}ctx.strokeStyle=stroke;ctx.lineWidth=2.5;ctx.stroke();};
 if(b.type==='blaster'){
  outlined(()=>{ctx.beginPath();ctx.roundRect(-28,-15,46,23,6);ctx.rect(12,-10,20,12);ctx.moveTo(-13,8);ctx.lineTo(-7,26);ctx.lineTo(6,26);ctx.lineTo(1,8);ctx.closePath();},'#8d69c4','#583a91');line(-20,-6,2,-6,'#b9fff0',5);ellipse(32,-4,5,7,'#b9fff0');
 }else if(b.type==='flight'){
  for(const side of [-1,1]){ctx.save();ctx.scale(side,1);outlined(()=>{ctx.beginPath();ctx.moveTo(0,15);ctx.bezierCurveTo(8,-10,21,-23,30,-25);ctx.bezierCurveTo(33,-11,23,7,8,17);ctx.closePath();},'#ffe9f6','#ce75a6');for(let i=0;i<3;i++)line(7+i*5,10-i*5,21+i*2,-5-i*5,'#e9a5c5',2);ctx.restore();}
 }else if(b.type==='shield'){
  outlined(()=>{ctx.beginPath();ctx.moveTo(0,-25);ctx.quadraticCurveTo(12,-20,23,-20);ctx.lineTo(21,3);ctx.quadraticCurveTo(17,20,0,28);ctx.quadraticCurveTo(-17,20,-21,3);ctx.lineTo(-23,-20);ctx.quadraticCurveTo(-12,-20,0,-25);ctx.closePath();},'#f6a4d0','#ce5c9c');line(-10,-9,-10,6,'#ffeaf5',4);line(-3,-1,2,6,'#fff5fc',3);line(2,6,11,-7,'#fff5fc',3);
 }else{
  outlined(()=>{ctx.beginPath();ctx.moveTo(-17,-18);ctx.lineTo(-17,3);ctx.bezierCurveTo(-17,27,17,27,17,3);ctx.lineTo(17,-18);},null,'#df6d9b');line(-17,-18,-17,-7,'#b9e7f0',7);line(17,-18,17,-7,'#b9e7f0',7);
 }
 ctx.restore();
}
function spriteHero(x,y,scale,preview){
 let name='run',index=0;
 if(preview){name='idle';index=Math.floor(clock*4)%4;}
 else if(state==='dying'||state==='over'){name='fall';index=Math.min(4,Math.floor((world.deathElapsed??0)*8));}
 else if(world.effects.flight>0){name='flight';index=Math.floor(world.time*10)%6;}
 else if(!player.ground){name=player.jumps>1?'double':'jump';index=Math.min(3,Math.floor((world.time-(player.animAt||0))*6));}
 else index=Math.floor(world.time*12)%6;
 const set=(data.skin==='strawberry'?strawberrySets[name]:data.skin==='night'?nightSets[name]:spriteSets[name]),im=set?.frames[index];
 if(!im||!im.complete||!im.naturalWidth)return false;
 const h=(name==='fall'?[96,96,96,76,48][index]:set.height)*scale,w=h*im.naturalWidth/im.naturalHeight;
 let top=y+65*scale-h;
 ctx.save();
 ctx.filter=outfitFilter(data.skin);
 ctx.drawImage(im,x+6*scale-w/2,top,w,h);
 ctx.restore();
 return true;
}
function drawBubble(x,y,scale){
 ctx.save();ctx.translate(x+6*scale,y+18*scale);const r=56*scale;
 const g=ctx.createRadialGradient(-r*.3,-r*.35,r*.08,0,0,r);g.addColorStop(0,'#fff4fc18');g.addColorStop(.65,'#ffb4dc32');g.addColorStop(.9,'#ef85bf55');g.addColorStop(1,'#f68acba8');
 ellipse(0,0,r,r,g);ctx.strokeStyle='#f5a4d3';ctx.lineWidth=3*scale;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.stroke();
 ctx.strokeStyle='#fff4fcce';ctx.lineWidth=4*scale;ctx.beginPath();ctx.arc(-2*scale,-2*scale,r*.82,3.7,4.8);ctx.stroke();ctx.restore();
}
function heroine(x,y,scale=1,preview=false){if(!preview&&world.effects.shield>0&&state!=='over'&&state!=='dying')drawBubble(x,y,scale);if(spriteHero(x,y,scale,preview))return;ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);const running=preview||player.ground,t=clock*13,swing=running?Math.sin(t)*15:9;const color=skins[data.skin];
// Flowing ponytail, candy clips, expressive face and articulated limbs.
ellipse(-14,5+Math.sin(clock*8)*3,19,27,'#583448');ellipse(-24,22,12,21,'#583448');line(-4,43,-8+swing,59,'#fff3df',9);line(13,43,17-swing,59,'#fff3df',9);line(-5,50,-6+swing*.6,53,'#cc7caa',4);line(15,50,16-swing*.6,53,'#cc7caa',4);line(-8+swing,61,2+swing,61,'#653c59',9);line(17-swing,61,27-swing,61,'#653c59',9);ctx.fillStyle='#754359';ctx.beginPath();ctx.moveTo(-10,34);ctx.lineTo(22,34);ctx.lineTo(27,47);ctx.lineTo(-15,47);ctx.fill();round(-12,9,37,29,10,color);line(-5,16,-13-swing*.5,31,color,10);line(20,16,30+swing*.4,27,color,9);ellipse(31+swing*.4,27,5,5,'#ffdcbe');ellipse(7,-9,22,24,'#ffdcbe');ellipse(23,-4,7,6,'#ffdcbe');ellipse(2,-24,22,12,'#583448');ellipse(-11,-12,10,19,'#583448');ellipse(15,-11,3,4,'#53384b');ellipse(16,-12,1,1.5,'white');ellipse(18,-1,5,3,'#f4a0a4');line(23,2,27,0,'#b66d77',2);round(-19,-26,8,6,2,'#ed81b5');round(-10,-29,7,5,2,'#ffd66b');round(-23,-16,6,5,2,'#99d9d0');
if(!preview&&world.effects.flight>0){ellipse(-19,20,24,10,'#fffdf5');ellipse(-22,11,21,8,'#fffdf5');}ctx.restore();}
function draw(){ctx.clearRect(0,0,W,H);const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#f4ddec');bg.addColorStop(.65,'#ffe8da');bg.addColorStop(1,'#ffdfcb');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);let scroll=state==='running'||state==='paused'||state==='dying'||state==='over'?world.x:clock*25;
// One continuous illustrated candy valley, scrolling more slowly than the track.
if(panorama?.complete&&panorama.naturalWidth){
 const ph=800,pw=panorama.naturalWidth*(ph/panorama.naturalHeight);
 const offset=((scroll*.12)%pw+pw)%pw;
 // Alternate mirrored tiles, so the visible edges always join without a hard seam.
 const tile=Math.floor(scroll*.12/pw);
 for(let j=0;j<3;j++){const x=j*pw-offset;ctx.save();if((tile+j)%2){ctx.translate(x+pw,-120);ctx.scale(-1,1);ctx.drawImage(panorama,0,0,pw,ph);}else ctx.drawImage(panorama,x,-120,pw,ph);ctx.restore();}
}else{
 ellipse(980,95,49,49,'#fff4d7');
 for(let i=0;i<8;i++){let x=((i*250-scroll*.2)%1800+1800)%1800-250;ellipse(x,470,165,205,i%2?'#eab4bf':'#d593a9');ellipse(x+80,500,150,160,'#c4d6be');}
}
drawNight();
const platforms=['running','paused','dying','over'].includes(state)?world.platforms:[{x:scroll-100,w:1600}];for(const p of platforms)drawPlatform(p,scroll);
if(['running','paused','dying','over'].includes(state)){

 for(const o of world.obstacles)drawObstacle(o,scroll);
 for(const enemy of world.enemies){const x=enemy.x-scroll,bob=Math.sin(world.time*15)*3,im=scenery.bear;if(im?.complete&&im.naturalWidth)ctx.drawImage(im,x,enemy.y+bob,enemy.w,enemy.h-bob);}
 for(const shot of world.shots){line(shot.x-scroll-14,shot.y,shot.x-scroll+20,shot.y,'#fff7fa',11);line(shot.x-scroll-10,shot.y,shot.x-scroll+18,shot.y,'#8af0d4',6);}
 if(world.armed){round(player.x+28,player.y+15,31,15,4,'#8d69c4');round(player.x+50,player.y+19,18,7,2,'#a9f7e8');}

for(const c of world.candies)if(!c.dead)candy(c.x-scroll,c.y,c.type);for(const b of world.bonuses)if(!b.dead)drawBonus(b,scroll);if(world.invuln<=0||Math.floor(clock*15)%2)heroine(player.x+12,player.y+0,1);for(const p of world.particles){ctx.globalAlpha=Math.max(0,p.life/.65);ellipse(p.x,p.y,4,4,p.color);}ctx.globalAlpha=1;for(const coin of world.tokens)if(!coin.dead)drawCoin(coin.x-scroll,coin.y);
}else{ellipse(907,FLOOR+4,75,12,'#a5737c25');heroine(895,365,2.5,true);candy(1080,320,0,1.5);candy(750,400,2,1.1);ctx.font='400 23px "Jonova Condensed", Arial';ctx.fillStyle='#fffaf2';ctx.fillText('✦',820,260);ctx.fillText('✧',1045,215);}}
function frame(t){const dt=Math.min(.05,(t-last)/1000||0);last=t;clock+=dt;if(state==='running'){acc+=dt;while(acc>=1/120&&state==='running'){update(1/120);acc-=1/120;}}else{acc=0;if(!document.hidden)updateDeath(dt);}draw();requestAnimationFrame(frame);}
reset();save();screen('menu');requestAnimationFrame(frame);
if(!storageOK)toast('Браузер ограничивает сохранение. Разреши локальные данные.');
// Read-only diagnostics for manual checks.
window.SugarRush={get state(){return state;},get progress(){return JSON.parse(JSON.stringify(data));}};
})();
