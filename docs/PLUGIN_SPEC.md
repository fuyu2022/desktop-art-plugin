# Desktop Art 插件规范 v1

本规范描述当前已实现的浏览器 JS 插件。一个合格插件必须包含 UTF-8 的 `plugin.json`、配置指定的 ES module 入口，以及所有本地依赖文件。当前接口是视觉插件 SDK 2.2.0；配置格式版本 `manifestVersion: 1` 与 SDK 主版本 `sdkVersion: 2` 分开维护。

## 目录与完整配置

安装目录：`%LOCALAPPDATA%\DesktopArt\canvas\plugins\<id>`。目录名为插件 ID，只允许英文字母、数字、`-`、`_`，长度 1～64，区分配置中的大小写。显示名称可用中文。

```text
my-effect/
  plugin.json
  src/main.js
  vendor/color-utils.mjs
  assets/...
```

```json
{
  "$schema": "../../host/plugin.schema.json",
  "manifestVersion": 1,
  "id": "my-effect",
  "name": "图标特效",
  "version": "1.0.0",
  "author": "Your name",
  "dependencies": {
    "plugins": { "base-effect": "^1.0.0" },
    "libraries": {
      "color-utils": { "version": "1.0.0", "entry": "vendor/color-utils.mjs" }
    }
  },
  "entry": "src/main.js",
  "updateUrl": "https://example.com/my-effect/update.json",
  "sdkVersion": 2,
  "surface": "foreground"
}
```

`example.com` 是占位地址，发布前替换为自己的真实地址；没有更新服务的本地插件显式填 `null`。没有依赖时仍需填写 `"dependencies": {"plugins": {}, "libraries": {}}`。

`updateUrl` 指向版本更新清单，不是 GitHub 的 `tree` 网页。清单必须是 HTTPS JSON，格式如下：

```json
{
  "updateManifestVersion": 1,
  "id": "my-effect",
  "version": "1.2.0",
  "downloadUrl": "https://github.com/example/my-effect/releases/download/v1.2.0/my-effect-1.2.0.zip",
  "releaseUrl": "https://github.com/example/my-effect/releases/tag/v1.2.0",
  "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "notes": "修复桌面布局变化时的绘制问题。"
}
```

`id` 必须与本地插件一致，`version` 是最新版本号，`downloadUrl` 是最新 Release 包的 HTTPS 地址。`releaseUrl`、`sha256` 和 `notes` 可选。宿主插件管理器的“检查更新”会读取并校验清单，显示最新版本和包地址；它不会因为检查更新而自动替换本地文件。

清单最多 64 KiB，请求超时为 10 秒。自建服务需允许管理页面跨域读取，例如返回 `Access-Control-Allow-Origin: *`。GitHub Raw 地址可直接使用。

| 字段 | 必填 | 类型与规则 |
| --- | --- | --- |
| `manifestVersion` | 是 | 整数，当前为 `1` |
| `id` | 是 | 与插件文件夹名完全一致 |
| `name` | 是 | 非空显示名称，最多 128 个 UTF-16 单元 |
| `version` | 是 | 完整 SemVer，例如 `1.2.3`、`1.2.3-beta.1`，最多 128 字符 |
| `author` | 是 | 非空作者名称，最多 128 个 UTF-16 单元 |
| `dependencies` | 是 | 同时含 `plugins`、`libraries` 对象，每类最多 64 项 |
| `entry` | 是 | 相对插件根目录的 `.js` 或 `.mjs` 入口，文件必须存在，最多 240 单元 |
| `updateUrl` | 是 | 不含用户名、密码的 HTTPS 地址，最多 2048 单元；无更新服务填 `null` |
| `sdkVersion` | 是 | 整数，当前主版本为 `2` |
| `surface` | 是 | `background`、`foreground` 或 `both` |
| `description` | 否 | 一行说明，最多 512 单元 |
| `$schema` | 否 | 编辑器校验 schema 地址，不参与更新、运行或网络请求 |

名称、作者及其他字符串不能包含控制字符。未定义的配置字段会报错。配置文件最大 64 KiB；插件目录最多 4096 个文件。入口不能使用绝对路径、`..`、反斜线、查询参数或片段，也不能经符号链接／目录联接跳出文件夹。第三方库入口遵守相同规则。

Schema 位于 [plugin.schema.json](../sdk/plugin.schema.json)。它提供编辑器提示；文件是否存在、版本约束、依赖图和路径边界由宿主进一步校验。

## 插件版本与依赖

插件版本遵循 [SemVer 2.0.0](https://semver.org/)：不兼容变更增加主版本，兼容功能增加次版本，修复增加补丁版本；已发布版本的内容不应原地替换。热重载的内部 `revision` 是宿主实例代号，不是插件发布版本。

`dependencies.plugins` 的键是另一个插件的 ID，值是所需版本约束：

| 约束 | 含义 |
| --- | --- |
| `*` | 任意稳定版本 |
| `1.2.3` 或 `=1.2.3` | 精确版本，比较时忽略 `+build` |
| `^1.2.3` | `>=1.2.3 <2.0.0` |
| `^0.2.3` | `>=0.2.3 <0.3.0` |
| `^0.0.3` | `>=0.0.3 <0.0.4` |
| `~1.2.3` | `>=1.2.3 <1.3.0` |
| `>=1.2.3 <2.0.0` | 用空格组合至多 8 个 `= > >= < <=` 比较条件，全部必须满足 |

不支持 `1.x`、省略段数、`||`、连字符区间或 npm 标签。预发布版本只匹配明确包含相同主／次／补丁预发布版本的约束，例如 `>=1.2.3-beta.1 <1.3.0`；`*` 不选择预发布版本。

依赖必须已安装、已启用、配置有效且版本匹配，不能引用自身或形成循环。依赖插件的绘制层必须覆盖调用方：前景插件可依赖前景或 `both` 插件；背景同理；`both` 只能依赖 `both`。这使每个宿主都能在依赖成功激活后再激活调用方。旧插件没有正式版本号，不能作为合格插件的版本依赖。

宿主不擅自启用已停用的依赖。依赖缺失、停用、版本不匹配或激活失败时，调用方会停止加载并显示原因，其他无关插件继续运行。依赖文件热更新、重新加载或删除时，受影响的下游插件也会卸载／重建，以免继续使用旧实例。

调用已声明依赖的模块导出：

```js
export function activate(api) {
  const base = api.dependencies.getPlugin('base-effect');
  // base 是当前 surface 中已完成 activate() 的入口模块命名空间。
  // 只调用该插件公开承诺的导出；不要调用其 activate/dispose 生命周期函数。
  const color = base.getAccentColor();
}
```

## 第三方 JS 库

`dependencies.libraries` 按名称声明随插件打包的浏览器 ES module。每项必须包含完整实际版本 `version` 和本地模块路径 `entry`。例如 `three` 或 `@scope/library`；名称只接受 schema 中的 ASCII 模式，最多 128 字符。

```js
export async function activate(api) {
  const library = await api.dependencies.importLibrary('color-utils');
  const color = library.rgba(65, 170, 215, 0.8);
}
```

宿主校验声明及文件存在性，并按当前插件版本地址加载模块。相对导入和资源随该版本一起更新；不得加载未声明的库。库的版本由作者按实际打包内容记录，宿主不从源码猜测版本。

可在开发阶段使用 npm 和构建工具，但发布时必须提供浏览器可执行的产物。当前没有 npm 自动安装、CDN 下载、裸模块名称解析、Node.js 原生模块或跨语言进程依赖加载。带相对导入的库需要连同相关文件一起打包；需要相对资源 URL 时使用 `new URL('./asset', import.meta.url)`。

## 入口与生命周期

```js
/** @param {import('../../../host/sdk').PluginAPI} api */
export async function activate(api) {
  console.log(api.manifest.name, api.manifest.version, api.manifest.author);
  const layer = api.render.createLayer({backend: '2d'});
  const timer = setInterval(() => { /* 自建任务 */ }, 1000);
  api.lifecycle.onDispose(() => clearInterval(timer));
  // SDK 创建的 layer、订阅、动画、图片和绘制接管由 SDK 自动释放。
  // 也可 return 一个清理函数。
}

export function dispose() {
  // 可选：模块级清理；应该可重复调用。
}
```

入口必须导出 `activate(api)`，可同步或异步，可返回清理函数；可选导出 `dispose()`。模块导入、依赖等待及激活各有 10 秒超时，清理操作有 5 秒超时。热卸载不会等待尚未结束的激活 Promise；旧实例的迟到消息不能获得新的绘制接管。不要在模块顶层启动不可撤销任务，将副作用放入 `activate()` 并登记清理。清理不能抛出异常或依赖无限等待。

`surface: both` 会在前景、背景各激活一次，分别收到本层 `api`；模块对象与激活资源不跨宿主共享。SDK 设置按插件 ID 存储，但当前 `settingsChanged` 只在当前页面分发。

## 更新地址与兼容

`updateUrl` 是插件维护信息和远程更新清单地址。插件管理器会在用户主动点击“检查更新”时访问它，比较远程 `version` 与本地 SemVer，并显示 `downloadUrl`；不会后台自动访问，也不会自动下载、覆盖安装或执行远程代码。更新清单协议由 `updateManifestVersion` 单独版本化。

没有 `manifestVersion` 的旧配置，以及只有 `main.js` 的旧插件，仍按兼容模式运行，默认入口 `main.js`，默认背景层。它们在查询中标记 `legacy: true`，不认定为符合本规范；不猜测作者和版本，也不改写用户文件。升级时补齐完整 `plugin.json`，保留文件夹 ID 与原有 `surface`，即可继续使用现有启用状态和 SDK 设置。

## 合格插件检查

1. 配置包含所有必填字段，ID 与目录一致，名称／作者／版本准确。
2. 所有入口、库和资源均随包发布，没有路径越界或未声明依赖。
3. 依赖版本及 surface 兼容；冷启动、重复加载和热更新均能正常激活。
4. 卸载、删除、异常和目标消失时恢复原生显示，清理所有自建资源。
5. 使用公开 [接口文档](PLUGIN_API.md)，不替换 Shell 输入、不依赖内部 RPC 或调试变量。

本仓库提供完整模板 [plugin-template](../plugins/plugin-template/plugin.json)、[桌面标记](../plugins/hello-desktop/plugin.json)、[粒子消散](../plugins/particle-dissolve/plugin.json) 和 [玻璃半球 Emoji](../plugins/glass-dome-emoji/README.md)。

