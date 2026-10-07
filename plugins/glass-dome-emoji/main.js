// SVG paths and material gradients follow the user's glass-emoji.html reference.
// Desktop Art owns the layer, animation and subscriptions; no native input is replaced.
/** @param {import('../../sdk/sdk').PluginAPI} api */
export async function activate(api) {
  const layer=api.createLayer('glass-dome-emoji');
  layer.style.pointerEvents='none';
  const abort=new AbortController();
  let stopped=false,animation,lastPaint,lastTime;
  api.lifecycle.onDispose(()=>{stopped=true;abort.abort();animation?.cancel();});
  const response=await fetch(new URL('./glass.svg',import.meta.url),{signal:abort.signal});
  if(!response.ok)throw new Error('Glass SVG could not be loaded');
  const text=await response.text();
  if(stopped)return;
  const parsed=new DOMParser().parseFromString(text,'image/svg+xml');
  if(parsed.querySelector('parsererror'))throw new Error('Invalid glass SVG');
  const svg=document.importNode(parsed.documentElement,true);
  const prefix=`${api.pluginId}-${crypto.randomUUID()}-`;
  for(const node of svg.querySelectorAll('[id]'))node.id=prefix+node.id;
  for(const node of svg.querySelectorAll('*'))for(const attr of [...node.attributes]){
    let value=attr.value.replace(/url\(#([^)]*)\)/g,(_,id)=>`url(#${prefix}${id})`);
    if(attr.localName==='href'&&value.startsWith('#'))value='#'+prefix+value.slice(1);
    if(value!==attr.value)node.setAttribute(attr.name,value);
  }
  svg.style.cssText='position:absolute;display:block;pointer-events:none;overflow:visible;background:transparent';
  layer.append(svg);
  const part=name=>svg.querySelector(`[data-part="${name}"]`);
  const face=part('face'),eyes=[part('eye-left'),part('eye-right')],pupils=[part('gaze-left'),part('gaze-right')];
  const brows=[part('brow-left'),part('brow-right')],mouth=part('mouth'),mouthShine=part('mouth-shine');
  const sockets=[part('socket-left'),part('socket-right')],mouthPose=part('mouth-pose');
  const cheeks=[...svg.querySelectorAll('[data-part="cheek"]')];
  const cheekShines=[part('cheek-shine-left'),part('cheek-shine-right')];
  const cheekTransforms=cheeks.map(node=>node.getAttribute('transform'));
  const eyeCenters=[[480,590],[754,537]],irisCenters=[[552,596],[807,542]];
  const browCenters=[[430,448],[724,366]],cheekCenters=[[442,700],[779,639]];
  const closedLids=eyeCenters.map(([x,y],i)=>{
    const node=document.createElementNS(svg.namespaceURI,'path'),halfWidth=i===0?104:80;
    node.dataset.part=i===0?'lid-left':'lid-right';
    node.setAttribute('d',`M${x-halfWidth} ${y+6} Q${x} ${y+32} ${x+halfWidth} ${y-8}`);
    node.setAttribute('fill','none');node.setAttribute('stroke',`url(#${prefix}brow)`);
    node.setAttribute('stroke-width','6');node.setAttribute('stroke-linecap','round');
    node.setAttribute('opacity','0');eyes[i].after(node);return node;
  });
  const browCommands=brows.map(node=>parsePath(node.getAttribute('d')));
  const edgeStops=[...svg.querySelector(`#${prefix}edge`).children],rimStops=[...svg.querySelector(`#${prefix}rim`).children];
  const originalColors=[edgeStops,rimStops].map(stops=>stops.map(node=>hexRgb(node.getAttribute('stop-color'))));
  const flowNodes=[...svg.querySelectorAll('[data-flow-light]')];
  const flowStops=flowNodes.map((_,i)=>[...svg.querySelector(`[data-flow-gradient="${i}"]`).children]);
  const defaults={centerX:.5,bottomGap:0,maxRadius:280,scale:1,fps:30,cursorReach:200};
  let settings=api.settings.get(defaults),W=0,H=0,left=0,top=0,renderScale=1,geometry='';
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const bounded=(n,fallback,a,b)=>Number.isFinite(n)?clamp(n,a,b):fallback;
  function resize(state=api.scene.snapshot()){
    const previousW=W,previousH=H;W=state.viewport.width;H=state.viewport.height;
    const rect=state.desktop?.rect??{x:0,y:0,width:W,height:H};
    const bottom=bounded(state.desktop?.bottomEdge,rect.y+rect.height,rect.y,rect.y+rect.height);
    const gap=bounded(settings.bottomGap,0,0,rect.height/4),available=Math.max(0,bottom-rect.y-gap);
    const width=Math.max(0,Math.min(rect.width*.62,rect.height*.76,bounded(settings.maxRadius,280,24,2000)*2)*bounded(settings.scale,1,.2,2));
    const finalWidth=Math.max(0,Math.min(width,rect.width-4,Math.max(0,(available-4)*884/576)));
    renderScale=finalWidth/884;
    const height=finalWidth*589/884;
    left=clamp(rect.x+rect.width*bounded(settings.centerX,.5,0,1)-finalWidth/2,rect.x+2,Math.max(rect.x+2,rect.x+rect.width-finalWidth-2));
    // y=798 includes the lower rim's solid stroke. Align the painted edge,
    // rather than the SVG viewBox's transparent margin, to the native boundary.
    top=Math.max(rect.y+2,bottom-gap-(798-222)*renderScale);
    svg.style.left=`${left}px`;svg.style.top=`${top}px`;svg.style.width=`${finalWidth}px`;svg.style.height=`${height}px`;
    svg.style.display=W&&H?'block':'none';
    if(api.capabilities?.customCursor && api.cursor){
      const reach=bounded(settings.cursorReach,200,0,600);
      const update=finalWidth&&W&&H?api.cursor.setRegion({asset:'lollipop.cur',shape:'dome',padding:reach,rect:{
        x:left+21*renderScale,y:top+18*renderScale,
        width:840*renderScale,height:558*renderScale,
      }}):api.cursor.clear();
      // Older hosts keep the existing expression animation. Cursor failures
      // must not unload the face or take ownership of desktop mouse input.
      void update.catch(error=>{if(!stopped)console.warn('Glass emoji cursor:',error);});
    }
    if(W!==previousW||H!==previousH){lastTime=undefined;lastPaint=undefined;}
  }
  api.scene.subscribe(state=>{
    const rect=state.desktop?.rect;
    const key=[state.viewport.width,state.viewport.height,rect?.x,rect?.y,rect?.width,rect?.height,state.desktop?.bottomEdge].join(':');
    if(key===geometry)return;geometry=key;resize(state);
  });
  api.events.on('settingsChanged',event=>{if(event.pluginId!==api.pluginId)return;settings=api.settings.get(defaults);resize();});
  const M={x:0,y:0,on:false,sp:0,last:0};
  function pointer(event){
    if(!renderScale||!Number.isFinite(event.x)||!Number.isFinite(event.y))return;
    const x=(event.x-left)/renderScale+105,y=(event.y-top)/renderScale+222;
    if(M.on)M.sp=Math.min(80,M.sp+Math.hypot(x-M.x,y-M.y)*renderScale*.5);
    M.x=x;M.y=y;M.on=true;M.last=performance.now()/1000;
  }
  api.events.on('pointerMove',pointer);
  api.events.on('pointerLeave',()=>{M.on=false;M.sp=0;});
  api.events.on('pointerDown',event=>{pointer(event);clk=.30;});
  const BASE={sm:.82,sk:.15,bL:.08,bR:.35,cL:.065,cR:.085,fu:0,lL:0,lR:0,wd:.10,bl:.08,sq:0,pd:1,tilt:-.075};
  const X={...BASE},ev={n:0,d:1,t:0,duration:1},gaze={x:.85,y:-.40,tx:.85,ty:-.40,next:1.8};
  const head={yaw:0,pitch:0,roll:0};
  let nextEv=1.5,blinkT=2.2,blinkP=-1,jit=[0,0],clk=0;
  const cx=600,cy=738,R=420;
  function frame(ms){
    if(stopped||!W||!H)return;
    const interval=1000/bounded(settings.fps,30,10,60);
    if(lastPaint!==undefined&&ms-lastPaint<interval-.5)return;
    lastPaint=ms;
    const t=ms/1000,dt=Math.min(.05,lastTime===undefined?0:t-lastTime);lastTime=t;
  // Each vignette coordinates a look, a brow response and a later mouth response.
  // Pointer attention is an additive influence, never a permanent facial pose.
  const T={...BASE};
  nextEv-=dt;
  if(nextEv<0){
    ev.n=(ev.n+1)%7;ev.d=Math.random()<.5?-1:1;
    ev.duration=2.15+Math.random()*.5;ev.t=ev.duration;nextEv=ev.duration+.25;
    const looks=[[1.2,-.55],[-1.25,-.20],[.9,-.65],[.2,.30],[-.95,-.45],[.65,-.80],[.05,-.15]];
    const look=looks[ev.n];gaze.tx=look[0]*ev.d;gaze.ty=look[1];gaze.next=.55;
    if(ev.n===5)blinkT=Math.min(blinkT,.10);
  }
  if(ev.t>0){
    ev.t-=dt;const d=ev.d,phase=1-ev.t/ev.duration;
    const envelope=offset=>Math.max(0,Math.min(1,(phase-offset)*9,(1-phase)*5));
    const e=envelope(.04),m=envelope(.13),h=envelope(.09);
    const pulse=Math.sin(Math.max(0,phase-.12)*Math.PI*2)*e;
    if(ev.n===0){ // Curious glance: one brow lifts before the grin arrives.
      T.bL=.05+.25*e;T.bR=.35+.80*e;T.wd=.1+.30*e;
      T.cL=.065-.035*e;T.cR=.085+.075*e;
      T.sm=.82+.28*m;T.sk=.45*d*m;T.tilt=-d*.13*h;
    }else if(ev.n===1){ // Side-eye -> playful half smile -> glance back.
      T.bL=.08+.72*e;T.bR=.35-.22*e;T.lR=.16*e;
      T.cL=.065+.095*e;T.cR=.085-.065*e;
      T.sk=-d*.78*m;T.sm=.82+.22*m;T.tilt=d*.08*h;
      if(phase>.48){gaze.tx=.7*d;gaze.ty=-.38;}
    }else if(ev.n===2){ // Delighted smile with lifted cheeks, not closed-eye sleepiness.
      T.sm=.82+.55*m;T.sq=.78*e;T.wd=.1-.16*e;
      T.cL=.065+.055*e;T.cR=.085+.045*e;
      T.bL=.08+.30*e;T.bR=.35+.40*e;T.bl=.08+.20*e;
      T.pd=1+.08*m;T.tilt=d*(.06+.025*pulse)*h;
    }else if(ev.n===3){ // A shy downward look followed by a peek upward.
      T.bL=.08+.15*e;T.bR=.35+.4*e;T.sk=d*.50*m;
      T.cL=.065+.025*e;T.cR=.085+.045*e;
      T.sm=.82+.23*m;T.bl=.08+.24*e;T.tilt=-d*.115*h;
      if(phase>.37){gaze.tx=1.05*d;gaze.ty=-.60;T.lL=.12*e;}
    }else if(ev.n===4){ // Thinking: opposite brow motions and a small tilted mouth.
      T.fu=-.85*e;T.bL=.08+.78*e;T.bR=.35-.42*e;
      T.cL=.065-.10*e;T.cR=.085+.045*e;
      T.sm=.82-.40*m;T.sk=d*.6*m;T.lR=.20*e;T.tilt=d*.15*h;
    }else if(ev.n===5){ // Double take, then relief and a smile.
      const surprise=Math.max(0,1-phase/.45)*e;
      T.wd=.1+.80*surprise;T.bL=.08+.85*surprise;T.bR=.35+.7*surprise;
      T.cL=.065+.070*surprise;T.cR=.085+.075*surprise;
      T.sm=.82-.55*surprise+.18*m;T.sk=.15*d*surprise;T.pd=1-.1*surprise;
      if(phase>.28){gaze.tx=-.7*d;gaze.ty=-.35;}
    }else{ // Soft acknowledgement: slight nod with a contented half smile.
      T.sm=.82+.25*m;T.sk=d*.28*m;T.bR=.35+.25*e;
      T.cL=.065+.025*e;T.cR=.085+.015*e;
      T.sq=.26*e;T.tilt=d*.045*pulse;
      gaze.ty=-.15+.22*Math.sin(phase*Math.PI*2);
    }
  }
  const active=M.on&&t-M.last<4.5;
  gaze.next-=dt;
  // Small gaze corrections are occasional, rather than jitter on every frame.
  if(gaze.next<0){jit=[(Math.random()-.5)*.8,(Math.random()-.5)*.8];gaze.next=.6+Math.random()*.9;}
  const desiredX=active?bounded((M.x-cx)/R,0,-3,3):gaze.tx;
  const desiredY=active?bounded((M.y-(cy-R*.38))/R,0,-2,2):gaze.ty;
  gaze.x+=(desiredX-gaze.x)*(1-Math.exp(-dt*23));
  gaze.y+=(desiredY-gaze.y)*(1-Math.exp(-dt*23));
  const fyc=cy-R*.38;
  M.sp*=Math.pow(.88,dt*60);
  if(active&&Math.hypot(M.x-cx,M.y-fyc)<R*.9){T.bl+=.09;T.sm+=.10;T.pd+=.045;}
  if(active&&M.sp>48){T.bL+=.25;T.bR+=.25;T.cL+=.025;T.cR+=.025;T.wd+=.3;T.sm-=.18;}
  if(clk>0){clk-=dt;T.lR=Math.max(T.lR,.98);T.sm+=.07;}
  for(const q in X){const speed=q==='lL'||q==='lR'?22:q==='sm'||q==='sk'?9:14;X[q]+=(T[q]-X[q])*(1-Math.exp(-dt*speed));}

  blinkT-=dt;if(blinkT<0&&blinkP<0)blinkP=0;
  if(blinkP>=0){blinkP+=dt/.23;if(blinkP>=1){blinkP=-1;blinkT=Math.random()<.16?.18:2.4+Math.random()*3;}}
  const bk=blinkP>=0?(blinkP<.38?Math.sin(blinkP/.38*Math.PI/2):Math.cos((blinkP-.38)/.62*Math.PI/2)):0;
    // Eyes acquire a target quickly. The face follows later, with restrained
    // yaw, pitch and roll; each feature then uses its own surface tangent.
    const follow=1-Math.exp(-dt*5.5);
    head.yaw+=(clamp((gaze.x-.85)*.11,-.22,.18)-head.yaw)*follow;
    head.pitch+=(clamp(-(gaze.y+.4)*.09,-.10,.12)-head.pitch)*follow;
    head.roll+=((X.tilt-BASE.tilt)*.85+Math.sin(t*.85)*.010-head.roll)*(1-Math.exp(-dt*6));
    render(t,bk);
  }
  function surface([x,y]){
    // Derivatives of a front-facing sphere give local foreshortening. Using
    // an affine tangent keeps the reference paths exactly intact at rest.
    const nx=(x-546)/420,ny=(665-y)/420,nz=Math.sqrt(Math.max(.16,1-nx*nx-ny*ny));
    const cp=Math.cos(head.pitch),sp=Math.sin(head.pitch),cy=Math.cos(head.yaw),sy=Math.sin(head.yaw);
    const rotate=([vx,vy,vz])=>{
      const py=vy*cp+vz*sp,pz=-vy*sp+vz*cp;
      return [vx*cy+pz*sy,py];
    };
    const p=rotate([nx,ny,nz]),east=rotate([1,0,-nx/nz]),down=rotate([0,-1,ny/nz]);
    const a=clamp(east[0],.70,1.20),b=clamp(-east[1],-.20,.20);
    const c=clamp(down[0],-.25,.25),d=clamp(-down[1],.70,1.20);
    const e=546+420*p[0]-a*x-c*y,f=665-420*p[1]-b*x-d*y;
    return `matrix(${a} ${b} ${c} ${d} ${e} ${f})`;
  }
  function render(t,blink){
    face.setAttribute('transform',`rotate(${head.roll*180/Math.PI} 546 665)`);
    const look=clamp(gaze.x/.85,-1,1),gy=clamp((gaze.y+.4)*38,-30,30)+jit[1];
    for(let i=0;i<2;i++){
      const center=eyeCenters[i],iris=irisCenters[i],pose=surface(center);
      const lid=Math.max(blink,i===0?X.lL:X.lR),open=Math.max(.025,(1-lid)*(1-X.sq*.28));
      const gx=(look-1)*(iris[0]-center[0])+jit[0];
      eyes[i].setAttribute('transform',`${pose} translate(${center[0]} ${center[1]}) scale(${1+X.sq*.015} ${open*(1+(X.wd-.1)*.16)}) translate(${-center[0]} ${-center[1]})`);
      eyes[i].setAttribute('opacity',clamp(open/.13,0,1));
      sockets[i].setAttribute('transform',pose);
      sockets[i].setAttribute('opacity',.45+.55*open);
      closedLids[i].setAttribute('transform',pose);
      closedLids[i].setAttribute('opacity',clamp((.15-open)/.10,0,1));
      pupils[i].setAttribute('transform',`translate(${gx} ${gy}) translate(${iris[0]} ${iris[1]}) scale(${clamp(X.pd,.85,1.12)}) translate(${-iris[0]} ${-iris[1]})`);
      const arch=i===0?X.cL-BASE.cL:X.cR-BASE.cR,lift=i===0?X.bL-BASE.bL:X.bR-BASE.bR;
      brows[i].setAttribute('transform',surface(browCenters[i]));
      brows[i].setAttribute('d',morphBrow(browCommands[i],i,arch*180,-lift*25,X.fu*11));
    }
    const skew=X.sk-BASE.sk,smile=X.sm-BASE.sm;
    const d=`M601 ${681+skew*9} Q${650+skew*5} ${698+smile*24} 683 ${658-skew*11}`;
    mouth.setAttribute('d',d);mouthShine.setAttribute('d',d);
    mouthPose.setAttribute('transform',surface([642,680]));
    for(let i=0;i<cheeks.length;i++){
      const pose=surface(cheekCenters[i]),lift=-X.sq*8;
      cheeks[i].setAttribute('transform',`${pose} translate(0 ${lift}) ${cheekTransforms[i]}`);
      cheeks[i].setAttribute('opacity',clamp(.86+X.bl*.23,.85,1));
      cheekShines[i].setAttribute('transform',`${pose} translate(0 ${lift})`);
    }
    // Keep the reference's warm transmitted light while subtle spectral light moves.
    const phase=t*.070;
    for(const [j,stops] of [edgeStops,rimStops].entries())for(let i=0;i<stops.length;i++){
      const rgb=palette(phase+i/stops.length+j*.19),base=originalColors[j][i],mix=j===0?.40:.26;
      stops[i].setAttribute('stop-color',`rgb(${base.map((v,k)=>Math.round(v*(1-mix)+rgb[k]*mix)).join(',')})`);
    }
    const locations=[[210,520],[887,510],[630,300]];
    for(let i=0;i<flowNodes.length;i++){
      const color=`rgb(${palette(phase+i*.31).join(',')})`;
      for(const stop of flowStops[i])stop.setAttribute('stop-color',color);
      flowNodes[i].setAttribute('cx',locations[i][0]+Math.sin(t*.33+i*2)*22);
      flowNodes[i].setAttribute('cy',locations[i][1]+Math.cos(t*.27+i)*18);
      flowNodes[i].setAttribute('opacity',.20+.04*Math.sin(t*.5+i));
    }
  }
  function run(){if(!stopped)animation=api.animation.start({duration:60000,onFrame:({time})=>frame(time),onComplete:run});}
  function visibility(){if(document.hidden)animation?.pause();else{lastTime=undefined;lastPaint=undefined;animation?.resume();}}
  document.addEventListener('visibilitychange',visibility);
  api.lifecycle.onDispose(()=>document.removeEventListener('visibilitychange',visibility));
  // A neutral frame already shows the exact reference proportions before motion.
  render(0,0);run();visibility();
}

function parsePath(d){return [...d.matchAll(/([MCZ])([^MCZ]*)/gi)].map(([,command,values])=>({command,values:values.trim().split(/[ ,]+/).filter(Boolean).map(Number)}));}
function morphBrow(commands,side,arch,lift,slope){
  const min=side===0?360:666,max=side===0?504:787,center=(min+max)/2;
  return commands.map(({command,values})=>command+values.map((v,i)=>{
    if(i%2===0)return v;
    const x=values[i-1],u=Math.max(0,Math.min(1,(x-min)/(max-min)));
    return (v+lift-arch*Math.sin(Math.PI*u)+slope*(x-center)/(max-min)).toFixed(2);
  }).join(' ')).join(' ');
}
function hexRgb(hex){return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));}
const COLORS=[[111,239,255],[112,154,255],[179,126,255],[255,149,229],[255,207,132],[151,255,208]];
function palette(phase){
  const p=((phase%1+1)%1)*COLORS.length,i=Math.floor(p),a=COLORS[i],b=COLORS[(i+1)%COLORS.length],k=(1-Math.cos((p-i)*Math.PI))/2;
  return a.map((v,j)=>Math.round(v+(b[j]-v)*k));
}
