# 技术方案：新增“最近使用”功能与“后台运行提示”功能

本文档详细说明了在《视频格式转换大师》中增加“最近使用”功能和“后台运行提示”功能的技术实现方案。

## 1. “最近使用”功能 (Recently Used Tools)

### 1.1 功能目标
让用户能够快速访问最近使用过的转换工具，减少在多层分类中查找的时间。展示位置包括首页顶部和侧边栏顶部。

### 1.2 技术实现
- **数据存储**：使用 `localStorage` 持久化存储一个包含工具名称的数组（例如：`['MP4 To AVI', 'AVI To GIF']`）。
- **状态管理**：
  - 在 `frontend/src/stores/` 目录下新建 `useRecentToolsStore.js`。
  - 使用 `zustand` 管理状态，并限制数组长度（建议最多 5-8 个）。
  - 提供 `addTool(toolName)` 方法：若工具已存在，则移动到数组首位；若不存在，则插入首位并删除末尾多余项。
- **触发机制**：
  - 在 `MainPage.jsx` 的 `onToolClick` 回调中调用 `addTool`。
- **UI 展现**：
  - **首页 (Home.jsx)**：在工具分类网格上方新增“最近使用”区块，以图标+文字的形式横向排列。
  - **侧边栏 (ToolSidebar.jsx)**：在侧边栏菜单的最上方新增一个独立的分组“最近使用”。

---

## 2. “后台运行提示”功能 (Background Notification)

### 1.1 功能目标
当转换任务完成时（无论成功或失败），如果软件窗口处于非活动状态或已最小化，通过系统原生通知提醒用户。

### 1.2 技术实现
- **API 选择**：
  - 使用 Web Notification API 或 Electron 的 `Notification` 模块。考虑到本项目是 Electron 应用，优先通过 `window.electron` 调用原生通知以获得更好的兼容性。
- **触发逻辑**：
  - 修改 `frontend/src/rules/conversionNotificationRules.js`，在 `ConversionChannel` 中增加 `SYSTEM_NOTIFICATION` 类型。
  - 在 `applyConversionNotificationRule` 函数中，增加判断逻辑：如果当前窗口未获得焦点 (`!document.hasFocus()`)，则触发系统通知。
- **通知内容**：
  - **标题**：任务完成 / 任务出错。
  - **正文**：显示批处理摘要（如：“5 个文件转换成功，请点击查看”）。
  - **交互**：点击通知应能唤起并聚焦 Electron 窗口。
- **权限处理**：
  - 首次运行或设置中应有简单的逻辑确认是否允许发送系统通知（通常 Web API 需要用户交互后才能授权，Electron 主进程则无此限制）。

---

## 3. 实施计划（步骤）

1. **研究阶段**：确认 Electron 主进程是否已暴露 `Notification` 相关的接口给渲染进程。
2. **文档确认**：用户确认本方案。
3. **编码阶段**：
   - 第一步：实现 `useRecentToolsStore` 状态管理。
   - 第二步：在 `MainPage` 和 `Home` 页面接入“最近使用” UI。
   - 第三步：重构 `conversionNotificationRules.js`，集成系统通知逻辑。
4. **测试阶段**：验证本地存储是否正常，验证窗口最小化时能否收到通知。

**方案提交人**：FullStack-Guardian
**日期**：2026-03-02
