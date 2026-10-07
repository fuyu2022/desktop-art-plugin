/** @param {import('../../../sdk/sdk').PluginAPI} api */
export async function activate(api) {
  const {rgba}=/** @type {typeof import('../vendor/color-utils.mjs')} */ (await api.dependencies.importLibrary('color-utils'));
  const layer=api.render.createLayer({backend:'2d'});
  api.scene.subscribe(state=>{
    layer.clear();const item=state.icons.find(icon=>icon.visible&&icon.hovered);
    if(!item)return;
    const context=layer.context;context.strokeStyle=rgba(65,170,215,.8);context.lineWidth=2;
    context.strokeRect(item.rect.x-4,item.rect.y-4,item.rect.width+8,item.rect.height+8);
  });
  // SDK owns this layer and subscription; they are released automatically.
}
