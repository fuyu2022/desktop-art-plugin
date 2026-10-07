# Desktop Art Plugins

Desktop Art 的独立 JS 视觉插件仓库，配置遵循插件规范 v1，使用公开 SDK 2.2.0。工具源码由 `desktop-art` 仓库单独维护。

## 插件

| 目录 | 版本 | 绘制层 | 用途 |
| --- | --- | --- | --- |
| [glass-dome-emoji](plugins/glass-dome-emoji/README.md) | 1.7.0 | background | 透明玻璃半球、微表情和任务栏贴合 |
| [hello-desktop](plugins/hello-desktop/main.js) | 1.0.0 | background | 桌面右下角标记 |
| [particle-dissolve](plugins/particle-dissolve/main.js) | 1.0.1 | foreground | 图标粒子消散，播放结束恢复原图 |
| [plugin-template](plugins/plugin-template/src/main.js) | 1.0.0 | foreground | 插件模板，示范声明并导入随包发布的 JS 库 |

## 安装

在 Desktop Art 托盘菜单选择“JS 画布 → 打开插件目录”。将 `plugins/<id>` 整个文件夹复制到该目录，保留文件夹名，再在“插件管理…”中加载。实际安装路径可能受启动器重定向，以菜单打开的位置为准。

插件发布包不需要 Node.js。所有模块、CSS、SVG 和库文件都在各自插件目录内。`sdk/` 是编辑器参考文件，不需要复制到安装目录；安装后的 schema 由工具的 `canvas/host/plugin.schema.json` 提供，可调整 manifest 中的 `$schema` 编辑器路径。

## 开发规范

- [插件配置、依赖与生命周期](docs/PLUGIN_SPEC.md)
- [全部公开 API](docs/PLUGIN_API.md)
- [视觉坐标、素材与绘制接管](docs/VISUAL_PLUGIN_SDK.md)
- [逐插件检查记录](docs/COMPLIANCE.md)
- [配置 Schema](sdk/plugin.schema.json) 与 [SDK 类型](sdk/sdk.d.ts)

`docs/` 和 `sdk/` 是工具仓库公开接口的发布副本，更新 SDK 时同步维护。插件只能改变显示，不能替换原生 Shell 输入。

`.gitignore` 逐项允许上述插件的必需文件与公开文档，忽略本地演示、测试、缓存和构建产物。添加插件或资源时须同时更新白名单，确保完整文件包被提交。
