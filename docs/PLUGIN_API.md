# Desktop Art 插件接口参考

当前 SDK 为 **2.3.0**，manifest 中声明 `sdkVersion: 2`。入口收到的 `api` 是本插件、本绘制层的 SDK 实例；类型声明见 [sdk.d.ts](../assets/canvas/host/sdk.d.ts)，配置规范见 [PLUGIN_SPEC.md](PLUGIN_SPEC.md)，绘制接管详解见 [VISUAL_PLUGIN_SDK.md](VISUAL_PLUGIN_SDK.md)。本文列出当前实现的全部公开插件接口。

插件运行于浏览器 ES module 环境，可调用 DOM、Canvas 2D、WebGL2、Web Animations、Worker 等可用 Web API；这些原生 Web API 不属于 Desktop Art SDK。插件共享各自 surface 的页面与来源，当前没有进程级／来源级插件隔离。SDK不提供文件增删、Shell COM、移动图标、命令／菜单注册、系统快捷键、通知或任务调度接口；README 中这些能力属于未来规划。

## 基础属性

| 属性 | 类型 | 含义 |
| --- | --- | --- |
| `api.version` | `string` | 当前 SDK 版本 `2.3.0` |
| `api.pluginId` | `string` | 插件目录 ID |
| `api.surface` | `'background' \| 'foreground'` | 当前实例所在绘制层 |
| `api.manifest` | 只读 `PluginDescriptor` | 宿主规范化的配置；兼容插件 `manifestVersion: 0`，版本／作者可能为空 |
| `api.state` | 只读 `Scene` | 最新场景，等同 `api.scene.snapshot()` |
| `api.capabilities` | 只读对象 | `canvas2d`、`webgl2`、`visualReplacement`、`sceneTexture`、`customCursor`、`nativeInput` |

`visualReplacement` 仅前景为真；`nativeInput` 始终为 `false`。`webgl2: true` 表示提供该后端接口，不保证此机器／当前上下文创建成功；失败时使用 Canvas 2D。调试控制台的 `window.desktopArt` 没有插件配置，`manifest` 为 `null`，普通插件应只使用入口传入的 `api`。

## dependencies：插件与库

| 方法 | 参数 | 返回及失败 |
| --- | --- | --- |
| `getPlugin(id)` | 在 `dependencies.plugins` 中声明的 ID | 已完成激活的同层插件入口模块命名空间；未声明、不可用或已卸载则抛错 |
| `importLibrary(name)` | 在 `dependencies.libraries` 中声明的名称 | `Promise<模块命名空间>`；导入失败、未声明或等待期间本插件已卸载则拒绝 |

```js
const base = api.dependencies.getPlugin('base-effect');
const utils = await api.dependencies.importLibrary('color-utils');
```

依赖插件公开的导出由其作者定义、版本化。不要替依赖调用生命周期函数，也不要在依赖更新后保留旧导出。库路径由已校验配置解析，不接受任意 URL／文件路径；不会自动安装 npm 包或下载库。

## scene：场景、订阅与坐标

| 方法 | 返回／行为 |
| --- | --- |
| `snapshot()` | 最新只读 `Scene`；原地查询不创建订阅 |
| `subscribe(listener)` | 立即调用 `listener(state)`，之后在每次场景推送时调用；返回取消订阅函数 |
| `getIcon(id)` | `IconState` 或 `undefined` |
| `getBox(id)` | `BoxState` 或 `undefined`；ID 接受数字、数字字符串或 `'box-1'` |
| `screenToCanvas({x,y})` | 原生屏幕坐标转 SDK 坐标 |
| `canvasToScreen({x,y})` | SDK 坐标转原生屏幕坐标 |

`api.onState(listener)` 是 `scene.subscribe` 的兼容入口。快照深只读；不要修改 `state` 或其中对象。

| `Scene` 字段 | 含义 |
| --- | --- |
| `version` | 快照协议主版本，当前 `2` |
| `revision` | 单调递增的场景修订号 |
| `time` | 宿主提供的单调毫秒计数，当前来自系统启动时间；初始空快照为 `0`，不是日期时间 |
| `surface` | 当前宿主层 |
| `viewport` | `{width,height}`，整个虚拟桌面的绘制尺寸 |
| `screenOrigin` | 虚拟桌面左上角的原生屏幕坐标，可为负数 |
| `desktop` | 主显示器的实时桌面环境，初始未就绪时为 `null`；见下文 |
| `icons` / `boxes` | 当前图标／可见盒子集合 |

`DesktopEnvironment`（SDK 2.2.0 起）使用画布物理像素坐标：

| 字段 | 含义 |
| --- | --- |
| `rect` | 主显示器完整桌面 `{x,y,width,height}`，包含任务栏区域 |
| `bottomEdge` | 下方可绘制边界：底部任务栏露出时为实际顶部，收起／隐藏时为显示器底边 |
| `taskbar.visible` | 任务栏实际露出；自动隐藏的细小唤出条不算显示 |
| `taskbar.edge` | `'none'/'top'/'bottom'/'left'/'right'` |
| `taskbar.rect` | 任务栏实际露出部分的矩形，隐藏时为 `null` |

宿主仅在该环境改变时推送新场景，静止时不会重复推送；跟踪约每 50ms 检查一次。根据真实任务栏窗口判断显示，不依赖静态工作区，因此自动隐藏任务栏临时展开时也能正确跟随。当前 `desktop` 描述主显示器，其他显示器的任务栏不会影响其下方边界；上／左／右侧任务栏不改变 `bottomEdge`。插件使用 `api.scene.subscribe()` 接收变化，不读取内部 RPC 或系统设置。

`IconState`：

| 字段 | 类型与含义 |
| --- | --- |
| `id`、`boxId`、`name` | 稳定图标 ID、所属盒子 ID（`0` 为盒外桌面）、名称 |
| `rect`、`labelRect`、`clip` | `{x,y,width,height}`：图像区域、文字区域、盒内可见裁剪区域 |
| `visible`、`selected`、`hovered` | 可见、选中、悬停 |
| `dragging` | 当前宿主是否观察到图标拖动；不是逐图标精确拖动归属 |
| `labelVisible` | 原生名称是否显示 |
| `imageUrl`、`imageWidth`、`imageHeight` | 本地透明图像地址及素材原始尺寸；不可见时地址可能为空 |
| `imageSuppressed`、`labelSuppressed` | 原生图像／名称当前是否被绘制接管隐藏 |

`BoxState`：`id`、`x/y/width/height`、`itemCount`、`collapsed`、`title`、`scroll`、`dragging`、`titleVisible`、`headerVisible`。`headerPosition` 为 `0/1/2/3`＝上／下／左／右；`titleAlignment` 为 `0/1/2`＝起端／居中／末端。自动隐藏的盒子会从可见集合移除。

SDK 坐标以虚拟桌面左上角为原点，使用物理像素；宿主 rasterization scale 固定为 1，不再乘 `devicePixelRatio`。场景通常约 33ms 合并推送，短暂的中间状态可能合并。图标 ID 在普通移动、滚动、换盒和重启中保持稳定；重命名或 Shell 身份变化可能产生新 ID。

## assets：原生素材

| 方法 | 返回 | 失败条件 |
| --- | --- | --- |
| `getIcon(iconId)` | `Promise<ImageBitmap>` | ID 不存在、没有图像地址或加载失败 |
| `getPixels(iconId)` | `Promise<ImageData>`，完整 RGBA 像素 | 与 `getIcon` 相同；复制素材像素到临时 2D canvas |
| `getLabel(iconId)` | `Promise<ImageBitmap>`，原生名称透明位图 | 目标不可用、名称未显示或原生请求失败 |

素材由 SDK 缓存，卸载时自动关闭，插件不要自行 `close()` 共享的 `ImageBitmap`。图像保留原生透明度、覆盖标记等。名称位图是原生字体的白色字形，不含壁纸采样得到的自适应文字效果。`getPixels` 是像素复制，避免每个动画帧重复调用。

## render：绘制层与接管

### createLayer(options?)

| 选项 | 默认 | 行为 |
| --- | --- | --- |
| `backend` | `'2d'` | `'2d'` 或 `'webgl2'`，不可用时抛错 |
| `surface` | 当前层 | 只能指定当前 `api.surface`；跨层使用 manifest `surface: 'both'` |
| `iconId` | 无 | 跟随目标图标的可见性；不会自动移动绘制内容 |
| `boxId` | 无 | 跟随盒子可见性；同时指定时盒子绑定决定最终可见性，建议只选一种目标 |
| `clip` | 不裁剪 | `'box'` 根据绑定目标所属盒子裁剪；`'none'` 允许画到整个桌面；未绑定时无法计算盒子裁剪 |
| `zIndex` | `0` | 当前层内的顺序，限制在 `-10000…10000` |

返回 `Layer`：`element`、`canvas`、`context`、`clear()`、`dispose()`。canvas 尺寸随 viewport 更新；窗口尺寸变化可能清空 canvas，需要重新绘制。2D 的 `clear()` 暂时重置变换后清空全部画布，再恢复状态；WebGL2 清空透明色缓冲，着色器／纹理／缓冲由插件配置。`dispose()` 移除层，WebGL 层同时请求释放上下文。

兼容接口 `api.createLayer(name)` 返回一个全桌面 DOM `<div>`，没有自动生成 canvas。所有绘制层都穿透输入。

### acquire(target, options?)

仅前景可调用，返回 `Promise<Lease>`。`target` 是图标稳定 ID；整盒接管使用 `'box-1'`。`options.parts` 默认 `'image'`，可为 `'image'`、`'label'`、`'icon'`（图片与名称）、`'box'`。目标必须存在且可见，整盒不能处于折叠／隐藏状态。

| Lease 成员 | 行为 |
| --- | --- |
| `token`、`target` | 本次接管令牌、目标 ID |
| `committed` | 是否已提交首帧接管 |
| `commit()` | `Promise<void>`；等待两个浏览器动画帧，再让原生层停止绘制对应部分 |
| `release()` | `Promise<void>`；幂等释放，恢复原生绘制 |

```js
const icon = api.scene.getIcon(iconId);
const bitmap = await api.assets.getIcon(iconId);
const layer = api.render.createLayer({iconId});
const lease = await api.render.acquire(iconId, {parts: 'image'});
try {
  layer.context.drawImage(bitmap, icon.rect.x, icon.rect.y, icon.rect.width, icon.rect.height);
  await lease.commit();
  // 播放特效……
} finally {
  layer.dispose();
  await lease.release();
}
```

同一部分只能有一个接管者；图片和文字可分别接管，整盒与盒内图标接管互斥。失联、卸载、重载、异常或目标消失会恢复显示；每 4 秒续租，原生租期 15 秒。浏览器与原生显示不是硬件级同帧原子提交。接管只改变显示，不改变原生点击区域、文件、格位或选中状态。

### getSceneTexture(boxId)

返回 `Promise<{bitmap:ImageBitmap,url:string,padding:number}>`，为请求时普通盒子显示面的快照，不支持盒外桌面 ID `0`。玻璃模式包括原生外扩阴影，`padding` 指示外扩像素。它不包含壁纸、其他应用或独立的越界悬停层；不会自动成为实时纹理。

## cursor：区域光标（2.3.0）

`customCursor` 仅背景层为真。`api.cursor.setRegion({asset,rect,shape='ellipse',padding=0})` 返回 `Promise<void>`，为当前插件注册一个原生鼠标光标区域；再次调用替换当前区域。`asset` 是插件目录内的本地 `.cur` 相对路径，最大 1 MiB；不支持绝对路径、网络 URL 或跳出插件目录的路径。`rect` 使用画布物理像素，允许负坐标。`shape` 可为 `rect`、`ellipse` 或 `dome`；`dome` 是区域内以底边中点为中心的上半椭圆。`padding` 为轮廓周围的等距扩展距离，物理像素 0～4096，包含底边和斜边。

```js
if (api.capabilities.customCursor) {
  await api.cursor.setRegion({asset:'lollipop.cur',shape:'dome',
    rect:{x:680,y:680,width:560,height:360}});
}
```

只改变宿主管理的桌面内容窗口的光标外观，Windows `.cur` 热点继续用于原生点击；不会替换全局系统光标方案。盒子标题、边缘缩放、拖放、编辑、捕获输入、菜单和其他应用保留原有指针。多个插件区域重叠时按插件 ID 排序取第一个。`api.cursor.clear()` 返回 `Promise<void>`，主动移除区域；卸载、热重载、画布关闭或 15 秒失联自动释放，SDK 每 4 秒续租。原生输入能力仍为 `false`。普通浏览器预览应自行模拟该接口，CSS 光标不代表桌面原生光标已经改变。

## events：事件订阅

`api.events.on(type, listener)` 返回取消订阅函数。事件对象只读；不能取消原生事件，也不能用事件回调替换 Shell 点击、选择、右键或拖放。

| 事件 | 数据 |
| --- | --- |
| `pointerMove`、`pointerLeave`、`pointerDown`、`click`、`doubleClick`、`wheel` | `iconId`、`boxId`、`x`、`y`、`delta`；空白处 `iconId` 为空字符串，`delta` 仅滚轮非零 |
| `hoverEnter`、`hoverLeave` | `icon`、`iconId` |
| `selectionChanged`、`visibilityChanged`、`iconAdded`、`iconRemoved`、`iconMoved` | `icon` |
| `boxShown`、`boxHidden`、`boxMoved`、`boxResized`、`boxFolded`、`scroll` | `box` |
| `dragStart`、`dragEnd` | `type`，当前不提供精确拖动项目列表 |
| `settingsChanged` | `pluginId`、`value`；当前页面所有订阅者可收到，按 ID 过滤 |

输入事件来自原生已观察到的消息；场景事件由合并快照差异产生。没有 `pointerUp`、右键菜单拦截或逐帧拖动事件接口。普通 DOM HTML 控件无法接收桌面鼠标，因为插件窗口输入穿透。

## animation：动画

`api.animation.start(options)`：

| 参数 | 默认 | 含义 |
| --- | --- | --- |
| `duration` | `600` | 大于 0 的有限毫秒数 |
| `from`、`to` | `0`、`1` | 起止进度 |
| `easing(t)` | 线性 | 接收 0～1 的归一进度，返回变换后的进度 |
| `onFrame(frame)` | 必填 | `{time,delta,progress,state}`；time 为浏览器帧时间，delta 上限 100ms |
| `onComplete()` | 空函数 | 正常完成时调用 |

返回 `Animation`：`done` 为 `Promise<{cancelled:boolean}>`；`cancel()` 取消、`pause()` 暂停、`resume()` 继续、`reverse()` 反转播放方向。正常完成返回 `cancelled:false`，取消／卸载返回 `true`。非法参数会抛错，帧回调抛错使 `done` 拒绝并清理插件。动画结束后不再申请帧。

## settings：插件设置

`api.settings.get(defaults={})` 将保存的 JSON 对象浅合并到 defaults 后返回；没有保存内容或解析失败时返回 defaults 的浅拷贝。`set(object)` 将对象 JSON 序列化并存入当前插件命名空间，再分发本页面 `settingsChanged`；序列化错误或存储额度异常会抛错。

存储键按插件 ID 隔离，前后景同 ID 共享 localStorage；不是文件系统、不是启用状态配置。当前没有删除设置接口，也没有跨宿主的 SDK 设置变更广播。卸载／删除插件文件不会自动清除 SDK 设置，回收站还原可继续使用。避免保存令牌、密码等敏感数据。

## lifecycle：资源清理

`api.lifecycle.onDispose(cleanup)` 注册自建定时器、Worker、库实例等清理函数，并返回一个函数；调用返回函数会立刻执行清理并取消此登记。`api.dispose()` 为幂等 `Promise<void>`，清理 SDK 层、订阅、动画、缓存图片、续租及原生绘制接管。

清理函数应同步完成资源释放；需要等待异步库收尾时，将异步清理作为 `activate()` 返回值或模块 `dispose()` 的 Promise。`onDispose` 返回 Promise 不会由 SDK 逐项等待。订阅和事件回调同步抛错时，SDK 清理资源并向宿主报告失败；异步回调的 Promise 错误必须由插件自己捕获。

卸载或重载后，创建资源／订阅／接管／设置写入和依赖调用会拒绝“disposed”实例。纯场景查询和设置读取仍可能读到快照；不要让卸载后的代码继续运行。

## 错误与调试

| 错误 | 常见原因 |
| --- | --- |
| `plugin_unloaded_or_replaced` | 插件停用、依赖失败或运行实例已被新版本替换 |
| `target_unavailable` | 目标不存在、折叠、停靠隐藏或层已挂起 |
| `target_busy` | 绘制部分已有接管者，或整盒／图标接管冲突 |
| `lease_expired` | 接管已释放或租期失效 |
| `label_unavailable` | 原生名称未显示或无法生成纹理 |
| `invalid_request` | 无效目标、参数、操作场景等 |
| `Native SDK request timed out` | 原生桥 5 秒内未响应 |
| `Undeclared … dependency` | 未在配置中声明该插件或 JS 库 |

SDK 的异步接口通过 Promise 拒绝错误；直接检查调用也可能同步抛错。管理界面显示配置／依赖／激活失败；开发者工具提供详细 JS 错误。当前宿主同一页面内的插件没有 CPU 时间隔离，耗时绘制需要作者控制。

`window.desktopArtHost` 是开发者工具辅助对象，不是插件间调用接口：`version`、`surface`、`pluginIds`、`states` 为查询；`unload(id)` 只卸载当前页面的实例，不保存停用状态，之后可能由原生注册表重新加载；`load(id)`、`reload(id)` 请求原生插件管理动作。持久加载／卸载／删除使用管理界面，插件间使用 `api.dependencies`。
