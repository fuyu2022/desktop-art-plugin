// Edit this file under %LOCALAPPDATA%/DesktopArt/canvas/plugins/hello-desktop.
// Save to hot reload this plugin. New plugins declare metadata in plugin.json.
export function activate(api) {
  const layer = api.createLayer('hello-desktop');
  const style = document.createElement('link');
  style.rel = 'stylesheet';
  style.href = new URL(`./style.css?v=${Date.now()}`, import.meta.url).href;
  document.head.append(style);
  api.lifecycle.onDispose(()=>style.remove());

  const badge = document.createElement('div');
  badge.className = 'desktop-art-canvas-badge';
  badge.textContent = 'Desktop Art · JS 画布';
  layer.append(badge);

  // Box outlines belong to the synchronously moved native visual layer.
  // Drawing another outline from asynchronous canvas state trails the box.
}
