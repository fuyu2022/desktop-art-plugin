# Desktop Art Plugins

Desktop Art 的独立 JS 视觉插件仓库，配置遵循插件规范 v1，使用公开 SDK 2.2.0。工具源码由 `desktop-art` 仓库单独维护。

## 插件

| 目录 | 版本 | 绘制层 | 用途 |
| --- | --- | --- | --- |
| [glass-dome-emoji](plugins/glass-dome-emoji/README.md) | 1.0.0 | background | 透明玻璃半球、微表情和任务栏贴合 |
| [hello-desktop](plugins/hello-desktop/main.js) | 1.0.0 | background | 桌面右下角标记 |
| [particle-dissolve](plugins/particle-dissolve/main.js) | 1.0.0 | foreground | 图标粒子消散，播放结束恢复原图 |
| [plugin-template](plugins/plugin-template/src/main.js) | 1.0.0 | foreground | 插件模板，示范声明并导入随包发布的 JS 库 |

## 安装

在 Desktop Art 托盘菜单选择“JS 画布 → 打开插件目录”。将 `plugins/<id>` 整个文件夹复制到该目录，保留文件夹名，再在“插件管理…”中加载。实际安装路径可能受启动器重定向，以菜单打开的位置为准。

插件发布包不需要 Node.js。所有模块、CSS、SVG 和库文件都在各自插件目录内。`sdk/` 是编辑器参考文件，不需要复制到安装目录；安装后的 schema 由工具的 `canvas/host/plugin.schema.json` 提供，可调整 manifest 中的 `$schema` 编辑器路径。

## 检查更新与手动发布

每个插件的 `plugin.json.updateUrl` 指向 `updates/<id>.json` 的固定 GitHub Raw 地址。支持检查更新的 Desktop Art 管理器会读取清单中的 `version` 和 `downloadUrl`，与本地版本比较并显示 Release 包地址。发布包是 `<id>-<version>.zip`，压缩包内保留 `<id>/plugin.json` 和完整插件目录。

首次发布的四个插件均为 `1.0.0`，本地已准备的 ZIP 在 `dist/plugin-updates/`，此目录不会提交到源码仓库。按下面的 Tag 创建四个 GitHub Release，并上传对应 ZIP，文件名必须与清单一致：

| Tag | 上传附件 |
| --- | --- |
| `glass-dome-emoji-v1.0.0` | `glass-dome-emoji-1.0.0.zip` |
| `hello-desktop-v1.0.0` | `hello-desktop-1.0.0.zip` |
| `particle-dissolve-v1.0.0` | `particle-dissolve-1.0.0.zip` |
| `plugin-template-v1.0.0` | `plugin-template-1.0.0.zip` |

先提交并推送插件配置与 `updates/`，再在 GitHub 的 Releases 页面选择“Draft a new release”，以包含这些更改的提交为目标创建对应 Tag，上传 ZIP 并发布。清单在 Release 发布前已可读取，但包地址在附件上传并发布后才可下载。

以后更新某个插件时，先修改它的 `plugin.json.version`，打包完整目录，创建 `<id>-v<version>` Release 并上传 `<id>-<version>.zip`；确认附件可下载后，再更新同一个 `updates/<id>.json` 的版本、下载链接、Release 页面和 ZIP 的 SHA256，并推送到 `main`。`updateUrl` 保持不变。SHA256 使用 `Get-FileHash -Algorithm SHA256` 计算，必须对应上传的同一份 ZIP。

清单格式见 [插件更新 Schema](sdk/plugin-update.schema.json)。自建更新服务需要允许跨域读取 JSON（例如 `Access-Control-Allow-Origin: *`）；GitHub Raw 可直接用于清单。当前检查更新只获取元数据，安装仍由用户解压完成。

## 开发规范

- [插件配置、依赖与生命周期](docs/PLUGIN_SPEC.md)
- [全部公开 API](docs/PLUGIN_API.md)
- [视觉坐标、素材与绘制接管](docs/VISUAL_PLUGIN_SDK.md)
- [逐插件检查记录](docs/COMPLIANCE.md)
- [配置 Schema](sdk/plugin.schema.json) 与 [SDK 类型](sdk/sdk.d.ts)

`docs/` 和 `sdk/` 是工具仓库公开接口的发布副本，更新 SDK 时同步维护。插件只能改变显示，不能替换原生 Shell 输入。

`.gitignore` 逐项允许上述插件的必需文件与公开文档，忽略本地演示、测试、缓存和构建产物。添加插件或资源时须同时更新白名单，确保完整文件包被提交。
