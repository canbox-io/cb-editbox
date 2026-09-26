# Changelog

本文件记录项目的所有版本变更。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/)。

## [0.0.1] - 2026-09-26

### feat | 新功能 / Features

首个版本发布，基于 CodeMirror 6 的轻量桌面文本编辑器

First release, a lightweight desktop text editor based on CodeMirror 6

多标签页编辑，标签页状态保活（切换不丢失光标、滚动与编辑内容），支持标签右键菜单

Multi-tab editing with state kept alive across switches (cursor, scroll and content preserved), plus tab context menu

文件打开、新建、保存、另存为，支持文件拖拽打开

Open, create, save and save-as files, with drag-and-drop file opening

自动探测文件编码（含 BOM 识别），支持编码转换与有损保存二次确认

Automatic encoding detection with BOM recognition, encoding conversion and lossy-save confirmation

支持 CRLF / LF / CR 换行符统计、混行提示与手动转换

CRLF / LF / CR line ending statistics, mixed-ending detection and manual conversion

脏文档 2 秒去抖自动备份，异常退出后下次启动静默恢复未保存内容

Debounced (2s) auto-backup of dirty documents with silent recovery of unsaved content after abnormal exit

外部文件变更监听：干净文档自动重载，脏文档弹出冲突处理提示

External file change watching: clean documents reload automatically, dirty documents prompt for conflict resolution

关闭窗口/标签时拦截未保存的磁盘文档，提供保存/不保存/取消选择

Intercept closing of unsaved on-disk documents with save / don't-save / cancel choices

原生应用菜单：文件、编辑、搜索（查找/替换）、视图、语言、选项、帮助

Native application menu: File, Edit, Search (find/replace), View, Language, Options, Help

界面缩放（Ctrl + 滚轮 / Ctrl+= / Ctrl+- / Ctrl+0）并持久化，窗口大小与位置记忆恢复

Interface zoom (Ctrl + wheel / Ctrl+= / Ctrl+- / Ctrl+0) with persistence, and window bounds memory and restoration

明/暗主题（含编辑器主题联动与跟随系统），中英文国际化，独立设置窗口

Light/dark themes (editor theme synced, system-follow supported), Chinese/English i18n, standalone settings window

### ci | 持续集成 / CI

新增 GitHub Release 工作流：v* tag 触发，自动构建并发布 canbox 标准 zip 安装包

Add GitHub Release workflow: triggered by v* tags, automatically builds and publishes the standard canbox zip package
