# Desktop Art 视觉插件 SDK v2

当前 SDK 为 2.3.0。完整配置标准见 [插件规范](PLUGIN_SPEC.md)，全部公开接口的参数、返回值与错误见 [接口参考](PLUGIN_API.md)。本文聚焦视觉坐标、素材与绘制接管。

SDK 提供真实 Shell 图标的场景数据与透明素材，支持 Canvas 2D、WebGL2、自定义着色器、图标/名称/整盒绘制接管、事件和动画。图标的点击、选择、右键、文件操作与拖放仍由原生 Shell 处理；绘制接管只改变显示。

## 安装与入口

在 `%LOCALAPPDATA%\DesktopArt\canvas\plugins\my-effect` 放置 `plugin.json` 与配置指定的入口，在盒子或托盘菜单“JS 画布”中启用画布。右键托盘“插件管理…”可单独加载、卸载、重新加载和删除；卸载状态在重启后保留。插件文件变化约 250ms 后更新对应插件及其依赖方，无关插件继续运行。旧版本的绘制接管由宿主先解除，旧版本的迟到请求不能再次接管图标。

`plugin.json`：

```json
{
  "manifestVersion": 1, "id": "my-effect", "name": "图标特效",
  "version": "1.0.0", "author": "Your name",
  "dependencies": {"plugins": {}, "libraries": {}},
  "entry": "main.js", "updateUrl": null,
  "sdkVersion": 2, "surface": "foreground"
}
```

`main.js`：

```js
/** @param {import('../../host/sdk').PluginAPI} api */
export function activate(api) {
  const layer = api.render.createLayer({ backend: '2d' });
  const animation = api.animation.start({
    duration: 1000,
    onFrame({ progress, state }) {
      layer.clear();
      const item = state.icons.find(icon => icon.visible);
      if (!item) return;
      const ctx = layer.context;
      ctx.strokeStyle = `rgba(0,180,255,${1 - progress})`;
      ctx.beginPath();
      ctx.arc(item.rect.x + item.rect.width / 2,
              item.rect.y + item.rect.height / 2, 30 + 40 * progress, 0, Math.PI * 2);
      ctx.stroke();
    }
  });
  api.lifecycle.onDispose(() => animation.cancel());
}
```

可选导出 `dispose()`；热重载、页面退出和手动卸载时调用。模块内的初始化放入 `activate()`，将自建 Worker、定时器、外部库等资源登记到 `api.lifecycle.onDispose()`。SDK 自己创建的层、订阅、动画、图片和接管自动清理。

类型声明在 [sdk.d.ts](../sdk/sdk.d.ts)，运行后也复制到 `canvas/host/sdk.d.ts`，配置 schema 为 `canvas/host/plugin.schema.json`。目录名使用英文字母、数字、`-`、`_`，最多 64 字符。没有 manifest 的旧插件默认进入背景层，保留 `api.createLayer()`、`api.onState()` 和 `api.state`，但不认定为符合新规范的插件。

## 前景与背景

| manifest.surface | 位置与用途 |
| --- | --- |
| `background` | 壁纸上方、Shell 与盒子下方，适合背景、光晕等 |
| `foreground` | Shell 与盒子上方，适合粒子、拖尾和替换图像；允许绘制接管 |
| `both` | 在两个宿主分别调用 `activate()`，通过 `api.surface` 选择各自绘制内容 |

整个桌面共用一个背景 WebView2 和一个前景 WebView2，不为每个图标或盒子创建浏览器实例。两个页面的 JS 对象互不共享；同插件 ID 的设置通过同来源 localStorage 保存。每个绘制层处于所属页面的 surface 内，`zIndex` 只调整这个 surface 的插件层顺序；跨 surface 绘制使用 `both` 并分别创建层。

前景窗口设为透明输入穿透，Chromium 输入窗口保持在屏幕外。插件通过宿主事件观察交互，HTML 控件不会接管桌面鼠标。原“打开画布开发者工具”调试背景；“打开前景特效开发者工具”调试前景。

## 场景与坐标

`api.scene.snapshot()` 返回只读最新快照；`api.scene.subscribe(fn)` / `api.onState(fn)` 立即调用一次，并返回取消订阅函数。

快照含 `version`、单调 `revision`、宿主毫秒时间 `time`、`viewport`、`screenOrigin`、`surface`、`boxes`、`icons`。

- 图标有不暴露路径的稳定 `id`、`boxId`、`name`、图片 `rect`、文字 `labelRect`、可见内容裁剪 `clip`、`visible`、`selected`、`hovered`、`dragging`、`labelVisible`、`imageUrl`、原图尺寸和绘制接管状态。
- 盒子有 `id`、位置、尺寸、成员数、折叠状态、滚动位置、标题栏方向/显示/对齐和拖动状态。自动隐藏的盒子从可见盒子集合移除；图标仍可报告为不可见。
- 图标 ID 由 Shell 身份产生，普通移动、滚动、换盒及重启保持一致；重命名或更换 Shell 身份可能改变 ID。索引、原生 HWND 和文件路径不作为插件句柄。
- SDK 坐标以整个虚拟桌面的左上角为零点，是原生物理像素。宿主将 WebView2 rasterization scale 固定为 1，画布中的一个 CSS 像素对应一个 SDK 像素，不再乘 `devicePixelRatio`。
- `api.scene.screenToCanvas(point)` 与 `canvasToScreen(point)` 处理虚拟屏幕负坐标。使用场景中的实际 `rect`、`clip`，不要自己推算 Shell 的格子和滚动偏移。
- 几何更新合并推送，通常约 33ms 一次；动画由浏览器本地帧循环运行，不需要每帧跨原生桥传送像素。多显示器、DPI 切换与 Explorer 重启仍需在目标机器验证。

## 素材

| 接口 | 返回 |
| --- | --- |
| `await api.assets.getIcon(id)` | `ImageBitmap`，来自真实系统图像列表，保留透明度、覆盖标记与当前圆角 |
| `await api.assets.getPixels(id)` | `ImageData`，适合按不透明像素生成粒子 |
| `await api.assets.getLabel(id)` | 当前原生字体、换行与名称显示规则的文字位图；名称不可见时拒绝请求 |
| `await api.render.getSceneTexture(boxId)` | `{bitmap, url, padding}`，当前盒子显示位图；玻璃模式含外围阴影，`padding` 为外扩像素 |

PNG 导出将原生预乘 BGRA 转换为 straight alpha，避免透明边缘变暗。纹理按内容缓存，每个宿主会话最多登记 4096 张；它们由宿主本地资源地址读取。`ImageBitmap` 由 SDK 缓存并在插件卸载时关闭，插件不要自行 `close()` 共享素材。

名称纹理提供原生字体的白色文字绘制，不包含按壁纸采样的差值/自适应文字效果；需要完全相同的当前盒子外观时使用盒子合成纹理。合成纹理是请求时的快照，包含盒子的图标、标题和当前边框等显示内容，不含底下的壁纸或其他应用，也不包含独立越界悬停层。宿主底层截图接口保留此边界。

## 绘制层

```js
const layer = api.render.createLayer({
  backend: 'webgl2', // 或 '2d'
  iconId: 'icon-...', // 可选，跟踪目标的可见性
  // boxId: 1,       // 可选，跟踪盒子可见性
  clip: 'none',      // 'box' 限制在目标盒子内；'none' 允许越界到整个桌面
  zIndex: 10
});
```

返回 `element`、`canvas`、`context`、`clear()`、`dispose()`。画布尺寸自动跟随虚拟桌面。插件在每帧读取最新图标/盒子坐标以跟随移动；绑定目标主要负责可见性和裁剪。盒子边框继续由原生层同步移动，异步插件背景不作为原生边框替代。

Canvas 和 WebGL 的绘制操作自由开放；可使用 shader、纹理、缓冲和第三方渲染库。WebGL2 上下文创建失败会抛错，插件可回退到 Canvas 2D。上下文随层销毁，避免残留 GPU 资源。

## 两阶段绘制接管

```js
const bitmap = await api.assets.getIcon(iconId);
const lease = await api.render.acquire(iconId, { parts: 'image' });
const layer = api.render.createLayer({ iconId });
try {
  const rect = api.scene.getIcon(iconId).rect;
  layer.context.drawImage(bitmap, rect.x, rect.y, rect.width, rect.height);
  await lease.commit();
  // 此时宿主停止画原图。插件可继续画碎片、粒子、变形图像等。
  await api.animation.start({ duration: 700, onFrame(frame) { /* 自定义绘制 */ } }).done;
} finally {
  layer.dispose();
  await lease.release();
}
```

- `parts` 为 `image`、`label`、`icon`（图片与名称）或 `box`。整盒目标使用 `box-1` 这样的 ID，并设置 `{parts:'box'}`。
- `acquire()` 预留接管但保留原有显示；画好插件首帧后调用 `commit()`，SDK 等待浏览器帧提交机会再请求原生停止绘制。跨 WebView2 与原生层不保证硬件级同一帧原子切换。
- 同一部分只有一个接管者；图片与名称可分别接管，整盒接管与盒内图标接管互斥。
- `release()` 恢复原有绘制；插件退出、异常、热重载、目标不可见或消失会清理接管。原生端每次心跳延长 15 秒租期，SDK 每 4 秒续期；失联后恢复原图并隐藏/重载冻结的前景页面。浏览器进程失败也恢复原图。
- 接管不删除图标、不改变格位、选中或 Shell 输入。绘制层穿透输入；移动图像的视觉位置不会移动原生点击区域。

## 事件、动画和设置

`api.events.on(type, listener)` 返回取消订阅函数。

- 原生输入观察：`pointerMove`、`pointerLeave`、`pointerDown`、`click`、`doubleClick`、`wheel`。包含 `iconId`、`boxId`、画布坐标，滚轮含 `delta`。
- 场景变化：`hoverEnter`、`hoverLeave`、`selectionChanged`、`visibilityChanged`、`iconAdded`、`iconRemoved`、`iconMoved`、`boxShown`、`boxHidden`、`boxMoved`、`boxResized`、`boxFolded`、`scroll`、`dragStart`、`dragEnd`。场景变化事件随合并快照产生，短于推送间隔的中间状态可能合并。
- `api.animation.start({duration, from, to, easing, onFrame, onComplete})` 返回 `done` Promise 与 `cancel()`、`pause()`、`resume()`、`reverse()`。帧参数含时间、帧间隔、进度和最新场景；只在动画期间申请帧，结束后停止。
- `api.settings.get(defaults)` / `set(object)` 独立持久化每个插件的 JSON 设置。`settingsChanged` 在当前页面通知变更。
- `api.lifecycle.onDispose(cleanup)` 登记自建资源清理。`api.dispose()` 清理 SDK 资源；前景开发者工具中 `desktopArtHost.unload('my-effect')` 可卸载当前页面的插件。

当前 JS 插件是用户信任的本地代码，共用各自 surface 的页面与来源，SDK 不提供插件之间的安全隔离。插件的 CPU/GPU 绘制仍需作者控制；SDK 版本化和资源归属用于兼容与清理。

## 粒子示例与验证

独立 `desktop-art-plugin` 仓库中的 `plugins/particle-dissolve` 是完整示例：读取真实 RGBA 图标，按透明像素生成粒子，准备首帧、接管、动画、释放；离开图标时播放，点击或目标隐藏时取消。示例不会自动安装到用户桌面。

将 `desktop-art-plugin/plugins/particle-dissolve` 复制到插件目录即可加载。在前景开发者工具可执行：

```js
const id = desktopArt.state.icons.find(icon => icon.visible && icon.boxId !== 0).id;
await desktopArtParticles.play(id);
```

验证入口：

- 自动化回归测试和桌面回放脚本保留在本地开发工作区，不随精简源码仓库发布。
- `scripts/query-runtime.ps1 -Query 'debug-sdk'` 查询两层 readiness、输入穿透标志、接管数量与浏览器诊断状态。`action=1` 执行浏览器 SDK 验证；`action=2/3/4` 为临时粒子测试副本提供播放、卸载和帧采样。

## 实现文件

- `assets/canvas/host/sdk.js`：开发者 API、资源归属、动画和事件。
- `assets/canvas/host/host.js`：版本化快照、manifest 加载与原生 RPC。
- `src/plugin_sdk.h/.cpp`：接管登记、稳定 ID、PNG 编码。
- `src/plugin_sdk_runtime.inl`：真实 Shell 场景、素材桥、绘制控制及输入观察。
- `src/desktop_canvas.cpp`：前后景合成宿主、加载、资源服务、热重载和异常恢复。

