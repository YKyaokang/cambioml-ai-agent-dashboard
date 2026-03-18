# 更改文档 — AI Agent Control Panel

## 概述

将原有的单页面 AI SDK Computer Use Demo 扩展为**生产级 AI 智能体控制面板**，实现了双面板仪表盘、事件管道状态管理、以及多会话聊天历史。

---

## 新增文件

### `lib/event-store.tsx`

**作用**：实现带类型的事件状态管理（Event Pipeline）。

**关键设计**：
- 定义 `ToolEvent` 判别联合类型（Discriminated Union）：`ComputerToolEvent | BashToolEvent`，每个事件包含 `id`、`timestamp`、`type`、`payload`、`status`、`duration` 字段。
- `ToolEventStatus` 枚举：`pending | running | success | aborted | error`。
- `deriveState()` 纯函数从事件数组派生：`totalEvents`、`eventCountByAction`（各操作类型计数）、`agentStatus`（`idle | running | error`）、`runningEventId`。
- 使用 `useReducer` + `createContext` 实现 `EventStoreProvider`，暴露 `addEvent`、`updateEvent`、`clearEvents` 方法。
- `updateEvent` 自动计算 `duration`（使用内部 `startTimes` ref 记录开始时间）。
- 严格遵守 TypeScript 最佳实践，无 `any`。

---

### `lib/use-sessions.tsx`

**作用**：多会话聊天历史管理，持久化到 `localStorage`。

**关键设计**：
- `ChatSession` 类型：`id`、`title`、`createdAt`、`updatedAt`、`messages`、`sandboxId`。
- `useSessions()` hook 提供：
  - `createNewSession()`：创建新会话并切换。
  - `switchSession(id)`：切换活跃会话。
  - `deleteSession(id)`：删除会话，若删除当前活跃会话则自动切换到最近一条。
  - `updateActiveSessionMessages(messages)`：同步消息到当前会话，并自动从第一条用户消息提取会话标题。
  - `updateActiveSessionSandboxId(id)`：保存沙箱 ID。
  - `renameSession(id, title)`：重命名会话。
- 每次状态变更后通过 `useEffect` 调用 `localStorage.setItem` 持久化，最多保存 20 条会话防止存储超限。

---

### `components/vnc-panel.tsx`

**作用**：VNC 远程桌面查看器面板，**memo 隔离防止聊天更新导致重渲染**。

**关键设计**：
- 使用 `React.memo` 包裹，并实现自定义比较函数，仅当 `streamUrl`、`isInitializing`、`onRefresh` 三个 props 变化时才重渲染。
- 确保聊天消息更新不会触发 `<iframe>` 重新加载，避免 VNC 连接中断。
- 加载中状态显示带动画的占位符（三个脉冲点）。
- "New Desktop" 按钮悬浮在 iframe 右上角，带 backdrop-blur 毛玻璃效果。

---

### `components/session-sidebar.tsx`

**作用**：左侧会话管理侧边栏。

**功能**：
- 会话列表（最新在上），高亮当前活跃会话。
- 每条会话支持：点击切换、重命名（内联编辑，回车确认/Escape 取消）、删除。
- 顶部「+」按钮新建会话。
- 底部显示会话总数统计。
- 深色主题，活跃会话以紫色高亮（`#7c6fcd`）。

---

### `components/debug-panel.tsx`

**作用**：可折叠的 Debug 面板，可视化事件存储（Event Store）。

**功能**：
- **Events 标签**：按倒序展示所有工具调用事件，每条可展开查看完整 JSON payload。显示状态图标（Loader/CheckCircle/XCircle）和耗时。
- **Stats 标签**：展示总事件数、运行中事件数，以及各操作类型的调用次数（横向进度条可视化）。
- 顶部显示 `AgentStatus` 徽章（Idle/Running/Error），Running 状态有 pulse 动画。
- 通过 `useEventStore()` hook 读取状态，无额外 prop drilling。

---

### `components/tool-call-detail.tsx`

**作用**：右侧面板下半部分，展示选中工具调用的详情。

**功能**：
- 无选中事件时显示空状态提示。
- 有选中事件时显示：工具图标、工具名、执行时间、状态徽章、耗时、完整 payload JSON、result（图片类型直接渲染截图，文本类型显示代码块）。
- 使用 `React.memo` 优化，只在 `id`、`status`、`duration` 变化时重渲染。

---

## 修改文件

### `app/page.tsx`（完全重写）

**原实现**：单页面，左右两栏（VNC + Chat），无状态管理，无会话系统。

**新实现**：

1. **布局结构**：
   - 最左侧：可折叠的 `SessionSidebar`（宽 192px，隐藏时 width=0，CSS transition 动画）。
   - 顶部 Header：sidebar 开关按钮、AI SDK Logo、Debug 切换按钮、Deploy 按钮。
   - 主区域：水平可拖拽 `ResizablePanelGroup`。
     - **左面板（30%）**：垂直 `ResizablePanelGroup`，上方聊天消息区 + 下方可选 Debug 面板。
     - **右面板（70%）**：垂直 `ResizablePanelGroup`，上方 VNC viewer + 下方工具调用详情。

2. **事件同步**：
   - `useEffect` 监听 `messages` 变化，遍历所有 assistant 消息的 `tool-invocation` parts。
   - 使用 `processedPartIds` ref 去重，避免重复添加事件。
   - 对已存在的事件调用 `updateEvent` 更新状态（running → success/aborted）。

3. **会话切换**：
   - 切换会话时清空 `processedPartIds`、清空事件存储、重置选中事件。
   - `useChat` 的 `id` 和 `initialMessages` 绑定到 `activeSession`，实现各会话独立聊天历史。

4. **VNC 防重渲染**：
   - `VncPanel` 通过 memo + `refreshDesktop` 用 `useCallback` 包裹，保证 `onRefresh` 引用稳定。

5. **`EventStoreProvider` 包裹**：根组件 `Page` 包裹 `EventStoreProvider`，`Dashboard` 内通过 `useEventStore()` 消费。

---

### `app/globals.css`

**原实现**：默认浅色主题（oklch 白底）。

**新实现**：
- 改为**深色终端主题**（always-dark），主色调为深蓝黑（`oklch(0.09 0.01 265)`），强调色为紫色（`oklch(0.65 0.18 285)`，即 `#7c6fcd`）。
- 所有 CSS 变量（`--background`、`--foreground`、`--primary` 等）均在 `:root` 下定义为深色值，不再区分 `.dark`。
- 新增细滚动条样式（`4px` 宽，hover 时略亮）。

---

### `app/layout.tsx`

- 更新 `metadata.title` 为 `"AI Agent Control Panel"`。
- 更新 `metadata.description` 为描述新功能的文本。

---

## TypeScript 规范遵守情况

| 规范 | 落实 |
|------|------|
| 无 `any` | 所有类型均明确标注，使用 `Record<string, unknown>` 替代 `any` |
| 判别联合类型 | `ToolEvent = ComputerToolEvent \| BashToolEvent`，通过 `type` 字段区分 |
| 严格枚举 | `ToolEventStatus`、`AgentStatus`、`ComputerAction` 均为字符串字面量联合类型 |
| memo 优化 | `VncPanel`、`ToolCallDetail`、`PreviewMessage` 均使用 `React.memo` |

---

## 架构图

```
Page
└── EventStoreProvider
    └── Dashboard
        ├── SessionSidebar (左侧)
        ├── Header (顶部)
        └── ResizablePanelGroup (水平)
            ├── Left Panel (30%)
            │   └── ResizablePanelGroup (垂直)
            │       ├── Chat Messages + Input
            │       └── DebugPanel (可折叠)
            └── Right Panel (70%)
                └── ResizablePanelGroup (垂直)
                    ├── VncPanel (memo隔离)
                    └── ToolCallDetail
```
