/** @param {import('../../sdk/sdk').PluginAPI} api */
export function activate(api) {
  const active=new Map();let plays=0,stopped=false;
  api.lifecycle.onDispose(()=>{
    stopped=true;
    for(const slot of active.values())slot.cancel();
    if(window.desktopArtParticles===diagnostics)delete window.desktopArtParticles;
  });
  async function play(id) {
    const item=api.scene.getIcon(id);if(stopped||!item?.visible||active.has(id))return;
    const slot={cancel(){this.cancelled=true;this.animation?.cancel();}};active.set(id,slot);
    let layer,lease;
    try {
      const bitmap=await api.assets.getIcon(id),pixels=await api.assets.getPixels(id);
      if(slot.cancelled)return;
      lease=await api.render.acquire(id,{parts:'image'});
      if(slot.cancelled)return;
      layer=api.render.createLayer({iconId:id,clip:'none'});
      slot.layer=layer;
      const ctx=layer.context,points=[];
      for(let y=0;y<pixels.height;y+=3)for(let x=0;x<pixels.width;x+=3){const i=(y*pixels.width+x)*4,a=pixels.data[i+3];if(a<32)continue;
        const seed=Math.sin(x*12.9898+y*78.233)*43758.5453,random=seed-Math.floor(seed);
        points.push({x,y,a:a/255,color:`rgb(${pixels.data[i]},${pixels.data[i+1]},${pixels.data[i+2]})`,vx:(random-.5)*180,vy:-35-random*80});}
      const draw=progress=>{
        slot.progress=progress;
        const current=api.scene.getIcon(id);if(!current?.visible){slot.cancel();return;}
        const rect=current.rect;layer.clear();ctx.globalAlpha=Math.max(0,1-progress*3);ctx.drawImage(bitmap,rect.x,rect.y,rect.width,rect.height);
        if(progress>0)for(const p of points){ctx.globalAlpha=p.a*(1-progress);ctx.fillStyle=p.color;
          ctx.fillRect(rect.x+p.x*rect.width/pixels.width+p.vx*progress,rect.y+p.y*rect.height/pixels.height+p.vy*progress+140*progress*progress,3,3);}
        ctx.globalAlpha=1;
      };
      draw(0);await lease.commit();if(slot.cancelled)return;
      plays++;slot.animation=api.animation.start({duration:api.settings.get({duration:900}).duration,onFrame:({progress})=>draw(progress)});
      await slot.animation.done;
    } finally {layer?.dispose();await lease?.release();active.delete(id);}
  }
  api.events.on('hoverLeave',({iconId})=>void play(iconId).catch(console.error));
  api.events.on('pointerDown',()=>{for(const slot of active.values())slot.cancel();});
  api.events.on('visibilityChanged',({icon})=>{if(!icon.visible)active.get(icon.id)?.cancel();});
  // Diagnostic entry point; effects still run through the same public SDK.
  const diagnostics={play,get plays(){return plays;},get active(){return active.size;},
    snapshot(){return [...active.values()][0]?.layer?.canvas.toDataURL('image/png');}};
  window.desktopArtParticles=diagnostics;
}
