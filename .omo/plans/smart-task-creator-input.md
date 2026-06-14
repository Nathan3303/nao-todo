# 智能任务创建器输入方案

## 概述

在现有任务创建器对话框（`task-creator.vue`）中，**优雅地新增**一个智能输入模式，同时完整保留原有表单。通过一个开关（`nue-switch`）让用户在两者间切换。

原有表单中的 name（`nue-input`）、tags（`TaskTagBar`）、project（`TaskProjectSelector`）三个字段在"新创建器"模式下合并为一个 **`contentEditable` 智能输入框**。用户通过 `#标签名` 和 `@p:项目名` 的 inline 文法在一个输入区域内完成所有操作。description 字段在两个模式下均保留独立的 `nue-textarea`。

切换开关仅影响对话框的输入区域布局，不改变对话框的打开/关闭流程、提交逻辑、以及后续的字段（日期、状态、优先级）。

## 目录

- [1. 架构决策](#1-架构决策)
- [2. 数据模型](#2-数据模型)
- [3. 组件树](#3-组件树)
- [4. 交互流程](#4-交互流程)
- [5. 文件清单](#5-文件清单)
- [6. 详细实现规范](#6-详细实现规范)
- [7. 与现有系统的集成](#7-与现有系统的集成)
- [8. 文档渲染展示](#8-文档渲染展示)
- [9. 实现步骤](#9-实现步骤)

---

## 1. 架构决策

### 1.1 切换方式：`nue-switch`

在对话框标题栏下方或内容区顶部放置一个 `nue-switch`，标签为"使用新创建器"。

```
┌─ TaskCreator Dialog ───────────────────────────────┐
│ ● 新建待办                                          │
│                                                     │
│  ┌─ switch ────────────────────────────────────┐    │
│  │ 使用新创建器  [●━━━━━━━○]                    │    │
│  └──────────────────────────────────────────────┘    │
│                                                     │
│  ┌─ input area (old OR new) ───────────────────┐    │
│  │  ... (根据 switch 状态渲染不同内容)           │    │
│  └──────────────────────────────────────────────┘    │
│                                                     │
│  ┌─ date / state / priority (always shown) ────┐    │
│  │  [📅 截止日期]  [待办]  [低优先级]  [收集箱]  │    │
│  └──────────────────────────────────────────────┘    │
│                                                     │
│        [取消]                        [创建]          │
└─────────────────────────────────────────────────────┘
```

**开关组件选择**：使用 `nue-switch`（来自 NueUI，已在 pomodoro 设置中使用）。相比 `SwitchButton`（来自 `@nao-todo/components`），`nue-switch` 更紧凑，适合对话框内使用。

### 1.2 输入方式：`div[contenteditable="true"]`（已确认）

使用 `div[contenteditable="true"]`，因为只有它能在文本流中内联渲染 chip，提供"输入即所见"的体验。

**实施约束：**

- chip 占位 `<span>` 必须设置 `contenteditable="false"`，防止光标进入 chip 内部
- 每次 `input` 事件后必须调用 `reconcile()` 修复浏览器对 contentEditable 的自动修正
- IME 输入期间必须跳过解析（`compositionstart`/`compositionend` 标志）
- 粘贴事件需阻止默认，仅插入纯文本
- 无法使用 `<slot>` 或模板渲染 chip，必须通过 `createVNode + render` 在 DOM 层面操作

### 1.3 Chip 渲染方案：动态挂载真实组件

在 contentEditable 内通过 `createVNode + render` 动态挂载真实的 `TagNode` 和 `TaskBasicInfo` 组件到占位 `<span>` 上。

```
contentEditable 中的 chip 占位:
  <span class="vue-chip-mount" data-chip-id="xxx"></span>

每次 DOM 更新后:
  遍历 .vue-chip-mount 元素
  createVNode(TagNode, { tag: { id, name, color }, readonly: true })
  render(vnode, spanElement)

chip 被移除时:
  render(null, spanElement)  // 卸载组件
```

#### TagNode

```
组件: TagNode from @nao-todo/components
Props: { tag: { id, name, color }, readonly: true }
样式: 彩色圆角 pill，白色文字，显示标签名
位置: inline-block，contenteditable=false，光标跳过
```

#### TaskBasicInfo

```
组件: TaskBasicInfo from @nao-todo/components
Props: { icon: 'more2', text: projectName, clamped: Infinity }
样式: icon + 项目名
位置: inline-block，contenteditable=false，光标跳过
```

### 1.4 组件位置

- **共享组件包** `packages/components/task-creator-input/` — 智能输入主组件
- **应用层集成** `apps/web/src/layouts/app/dialogs/task-creator/` — 修改对话框添加 switch + 条件渲染
- **复用** `@nao-todo/components` 中的 `TagNode`、`TaskBasicInfo`

### 1.5 开关状态持久化

使用 `localStorage` 存储用户偏好（key: `TASK_CREATOR_SMART_MODE`），这样用户的选择在会话间保持。

---

## 2. 数据模型

### 2.1 输入组件数据模型

```typescript
// task-creator-input/types.ts

import type { TagViewObject, ProjectViewObject } from '@nao-todo/types'

/** 内联组件类型 */
export type InlineChipType = 'tag' | 'project'

/** 内联组件数据 — 对应一个 TagNode 或 TaskBasicInfo 实例 */
export type InlineChipData = {
    chipId: string // 唯一标识（用于 DOM 定位）
    type: InlineChipType
    entityId: string // 选中实体的 id (tagId / projectId)
    label: string // 显示文本（如 "工作"）
}

/** 输入组件 v-model 的值 */
export type TaskCreatorInputValue = {
    text: string // 纯文本（不含 chip 标签内容）
    tags: string[] // 选中的 tag id 列表
    projectId: string | null // 选中的 project id
}

/** 建议弹窗选项 */
export type SuggestionOption = {
    id: string
    label: string
    type: InlineChipType
    description?: string
    color?: string // 仅 tag 有
}

/** 触发状态 */
export type TriggerState = {
    active: boolean
    type: InlineChipType | null
    query: string
    startOffset: number // 触发字符在 textContent 中的位置
}
```

### 2.2 props / emits

```typescript
export type TaskCreatorInputProps = {
    modelValue: TaskCreatorInputValue
    tags: TagViewObject[]
    projects: ProjectViewObject[]
    placeholder?: string
    disabled?: boolean
    maxLength?: number
    autofocus?: boolean
}

export type TaskCreatorInputEmits = {
    (e: 'update:modelValue', value: TaskCreatorInputValue): void
    (e: 'create-tag', name: string): void
    (e: 'focus'): void
    (e: 'blur'): void
}
```

---

## 3. 组件树

```
task-creator.vue
├── nue-dialog
│   ├── #header: "新建待办"
│   │
│   ├── #content
│   │   ├── 【旧模式】v-if="!useSmartCreator"
│   │   │   ├── nome-input (name)
│   │   │   ├── nue-textarea (description)          ← 两个模式共享
│   │   │   ├── 标签、项目选择区
│   │   │   │   ├── task-date-selector (日期)
│   │   │   │   ├── task-selector (状态)
│   │   │   │   ├── task-selector (优先级)
│   │   │   │   ├── task-project-selector (项目)
│   │   │   │   └── task-tag-bar (标签)
│   │   │   └── ...
│   │   │
│   │   ├── 【新模式】v-if="useSmartCreator"
│   │   │   ├── TaskCreatorInput                    ← 替换 name + tag + project
│   │   │   ├── nue-textarea (description)          ← 共享
│   │   │   └── ... (日期、状态、优先级 — 共享)
│   │   │
│   │   └── 【共享】日期、状态、优先级字段（两个模式都显示）
│   │
│   └── #footer: [取消] [创建]

=========== 智能输入组件内部结构 ===========

TaskCreatorInput (task-creator-input.vue)
├── .input-wrapper (position: relative)
│   ├── .contenteditable-input (div[contenteditable=true])
│   │   ├── #text nodes
│   │   ├── .vue-chip-mount           ← TagNode / TaskBasicInfo 挂载点
│   │   └── ...
│   └── SuggestionPopover (条件渲染)
│       ├── .popover-option(v-for)     ← 建议列表项
│       └── .popover-create            ← 创建新标签按钮（无匹配时）
```

---

## 4. 交互流程

### 4.1 对话框切换流程

```
用户点击 "+" → dialogManager.open(TASK_CREATOR_DIALOG_KEY)
  → 对话框打开
  → useSmartCreator 从 localStorage 读取（默认 false）
  → 根据 useSmartCreator 渲染对应输入区域

用户切换 nue-switch:
  → useSmartCreator = !useSmartCreator
  → localStorage.setItem('TASK_CREATOR_SMART_MODE', useSmartCreator)
  → 输入区域即时切换

用户填写 → 点击创建:
  → handleCreateTask()
  → 根据 useSmartCreator 选择数据源
    - 旧模式: states.name, states.tags, states.projectId
    - 新模式: taskInputValue.text, taskInputValue.tags, taskInputValue.projectId
  → taskUseCase.createTask(...)
  → 关闭对话框
```

### 4.2 智能输入键盘事件

```
用户键入 '#' 字符
  → TriggerState.active = true, type = 'tag'
  → 以光标前文本检测 query
  → SuggestionPopover 出现，显示匹配标签

用户继续键入 '工'
  → query = '工'
  → 过滤显示 #工作

用户按 Enter / 点击
  → 选中 #工作
  → 占位 <span class="vue-chip-mount" ...> 替换 "#工作" 文本
  → createVNode(TagNode, { tag, readonly: true }) + render 挂载
  → 光标移到 span 之后
  → 更新 modelValue

用户按 Backspace（光标在 chip 后）:
  → render(null, spanElement) 卸载组件
  → 移除 span，恢复为纯文本 "#工作"

用户键入 '@'
  → TriggerState.active = true
  → 检测后续 "p:" → type = 'project'
  → 查询匹配项目
```

### 4.3 事件优先级

| 按键         | 有弹窗（智能模式）      | 无弹窗（智能模式）                |
| ------------ | ----------------------- | --------------------------------- |
| Enter        | 确认选择                | 提交表单                          |
| ArrowUp/Down | 导航列表                | (阻止默认)                        |
| Escape       | 关闭弹窗                | (无操作)                          |
| Backspace    | 如 query 为空则关闭弹窗 | 正常退格；光标在 chip 后移除 chip |
| 可打印字符   | 更新过滤词              | 正常输入                          |

### 4.4 弹窗定位

```typescript
function getPopoverPosition(container: HTMLElement) {
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount || !sel.isCollapsed) return { top: 0, left: 0 }
    const range = sel.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()
    return {
        top: rect.bottom - containerRect.top + 4,
        left: rect.left - containerRect.left
    }
}
```

---

## 5. 文件清单

### 新建文件

| #   | 文件                                                            | 职责                                                 |
| --- | --------------------------------------------------------------- | ---------------------------------------------------- |
| 1   | `packages/components/task-creator-input/types.ts`               | 所有类型定义                                         |
| 2   | `packages/components/task-creator-input/task-creator-input.vue` | 主组件（contentEditable + 弹窗）                     |
| 3   | `packages/components/task-creator-input/use-mention-parser.ts`  | 解析 #/@ 触发状态                                    |
| 4   | `packages/components/task-creator-input/use-chip-manager.ts`    | Chip 生命周期管理（挂载/卸载 TagNode/TaskBasicInfo） |
| 5   | `packages/components/task-creator-input/suggestion-popover.vue` | 浮动建议弹窗                                         |
| 6   | `packages/components/task-creator-input/index.ts`               | 导出入口                                             |

### 修改文件

| #   | 文件                                                                | 改动                                                               |
| --- | ------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 1   | `packages/components/index.ts`                                      | 添加 `export * from './task-creator-input'`                        |
| 2   | `apps/web/src/layouts/app/dialogs/task-creator/task-creator.vue`    | 添加 `nue-switch` + 条件渲染旧/新模式                              |
| 3   | `apps/web/src/layouts/app/dialogs/task-creator/use-task-creator.ts` | 添加 `useSmartCreator` 状态 + localStorage 持久化 + 双模式数据提交 |
| 4   | `apps/web/src/infrastructure/locales/zh-CN.ts`                      | 添加"使用新创建器"文案                                             |
| 5   | `apps/web/src/infrastructure/locales/en-US.ts`                      | 添加对应英文文案                                                   |

---

## 6. 详细实现规范

### 6.1 `task-creator.vue` 模板变更

```vue
<template>
    <nue-dialog
        theme="creator"
        v-model="visible"
        ref="dialogRef"
        :title="t('dialog.taskCreator.title')"
    >
        <template #content>
            <nue-div vertical align="stretch" gap="0.75rem">
                <!-- 切换开关 -->
                <nue-div align="center" gap="0.5rem">
                    <nue-text size="var(--nue-text-sm)">使用新创建器</nue-text>
                    <nue-switch v-model="useSmartCreator" size="small" />
                </nue-div>

                <!-- ═══ 旧模式 ═══ -->
                <template v-if="!useSmartCreator">
                    <nue-input
                        v-model="states.name"
                        clearable
                        :placeholder="t('dialog.taskCreator.namePlaceholder')"
                        maxlength="64"
                        counter="word-left"
                    />
                    <nue-textarea
                        v-model="states.description"
                        maxlength="256"
                        counter="word-left"
                        :autosize="{ minRows: 1, maxRows: 4 }"
                        :placeholder="t('dialog.taskCreator.descPlaceholder')"
                        theme="fix-padding"
                    />
                </template>

                <!-- ═══ 新模式 ═══ -->
                <template v-if="useSmartCreator">
                    <TaskCreatorInput
                        v-model="taskInputValue"
                        :tags="avaliableTags"
                        :projects="avaliableProjects"
                        :placeholder="t('dialog.taskCreator.namePlaceholder')"
                        @create-tag="(name) => dialogManager.open(TAG_CREATOR_DIALOG_KEY, { name })"
                    />
                    <nue-textarea
                        v-model="states.description"
                        maxlength="256"
                        counter="word-left"
                        :autosize="{ minRows: 1, maxRows: 4 }"
                        :placeholder="t('dialog.taskCreator.descPlaceholder')"
                        theme="fix-padding"
                    />
                </template>

                <!-- ═══ 共享字段（两个模式都显示）═══ -->
                <nue-div align="center" gap="0.5rem">
                    <task-date-selector
                        :colored="!isExpired"
                        v-model="states.endAt!"
                        :task-remind-data="states"
                        @change="handleUpdateEndAt"
                        @remind-change="handleUpdateRemind"
                        @update-all="handleUpdateEndAtAndRemind"
                    />
                </nue-div>
                <nue-div wrap="wrap" gap=".5rem">
                    <task-selector
                        :options="TaskStateSelectOptions"
                        :value="states.state"
                        @change="(s: any) => (states.state = s as TaskViewObject['state'])"
                    />
                    <task-selector
                        :options="TaskPrioritySelectOptions"
                        :value="states.priority"
                        @change="(p: any) => (states.priority = p as TaskViewObject['priority'])"
                    />
                    <nue-div flex="1" />
                    <!-- 新模式：Tag/TagBar/ProjectSelector 由 TaskCreatorInput 内联处理 -->
                    <task-project-selector
                        v-if="!useSmartCreator"
                        :project-id="states.projectId || ''"
                        :projects="avaliableProjects || []"
                        @select="(pid: string) => (states.projectId = pid)"
                    />
                </nue-div>
                <task-tag-bar
                    v-if="!useSmartCreator"
                    :available-tags="avaliableTags || []"
                    :task-tag-ids="states.tags || []"
                    @update-tags="(_tags: any) => (states.tags = _tags)"
                    @create-tag="(name: string) => dialogManager.open(TAG_CREATOR_DIALOG_KEY, { name })"
                />
            </nue-div>
        </template>
        <template #footer>
            <nue-button :disabled="states.disabled" @click="close">
                {{ t('common.cancel') }}
            </nue-button>
            <nue-button
                :disabled="states.disabled"
                :loading="states.creating"
                theme="primary"
                @click="handleSubmit"
            >
                {{ t('common.create') }}
            </nue-button>
        </template>
    </nue-dialog>
</template>
```

### 6.2 `use-task-creator.ts` 变更

```typescript
import { ref, reactive, inject, watch } from 'vue'
import type { TaskCreatorInputValue } from '@nao-todo/components'

// ★ 新增：LocalStorage key
const TASK_CREATOR_SMART_MODE_KEY = 'TASK_CREATOR_SMART_MODE'

// ... 原有 states 不变 ...

// ★ 新增：智能输入框 v-model
const taskInputValue = ref<TaskCreatorInputValue>({
    text: '',
    tags: [],
    projectId: ''
})

// ★ 新增：开关状态（以 localStorage 为准，默认 false）
const useSmartCreator = ref(false)

// ★ 新增：监听变化写入 localStorage
watch(useSmartCreator, (val) => {
    localStorage.setItem(TASK_CREATOR_SMART_MODE_KEY, String(val))
})

// ★ 修改：open 函数中每次打开对话框时从 localStorage 读取偏好
//    此函数由 task-creator.vue 的 open() 调用
const open = (createTaskOptions: CreateTaskViewObject) => {
    // 从 localStorage 读取用户偏好
    useSmartCreator.value = localStorage.getItem(TASK_CREATOR_SMART_MODE_KEY) === 'true'
    clearInputsValue()
    if (createTaskOptions) {
        Object.keys(createTaskOptions).forEach((key) => {
            const presetVal = createTaskOptions[key as keyof CreateTaskViewObject]
            if (!presetVal) return
            const targetKey = key as keyof typeof states
            if (targetKey in states) {
                ;(states as any)[targetKey] = presetVal
            }
        })
    }
    visible.value = true
}

// ★ 修改：创建任务时根据模式选择数据源
const handleCreateTask = async (): Promise<boolean> => {
    states.creating = true

    // 根据当前模式选择数据源
    let name: string
    let tags: string[]
    let projectId: string

    if (useSmartCreator.value) {
        // 新模式：从 TaskCreatorInput 取值
        name = taskInputValue.value.text
        tags = taskInputValue.value.tags
        projectId = taskInputValue.value.projectId || states.projectId || ''
    } else {
        // 旧模式：从原有表单取值
        name = states.name || ''
        tags = states.tags || []
        projectId = states.projectId || ''
    }

    const [task, err] = await taskUseCase.createTask({
        projectId,
        name,
        description: states.description || '',
        state: states.state || 'todo',
        priority: states.priority || 'low',
        startAt: states.startAt || null,
        endAt: states.endAt || null,
        tags
        // ... remind fields unchanged ...
    })
    // ... 后续不变 ...
}

// ★ 修改：清空时两个模式都清
const clearInputsValue = () => {
    states.projectId = ''
    states.name = ''
    states.description = ''
    states.state = 'todo'
    states.priority = 'low'
    states.startAt = ''
    states.endAt = ''
    states.tags = []
    taskInputValue.value = { text: '', tags: [], projectId: '' }
}
```

### 6.3 `use-mention-parser.ts`

```
功能：检测 contentEditable 中的 #/@p: 触发状态

输入:
  - textBeforeCursor: string  — 光标前的 textContent（含 chip 的 label）
  - isComposing: boolean      — IME 状态

输出: TriggerState

算法:
  1. 从 textBeforeCursor 末尾向前扫描
  2. 遇到 '#' 且前面是空白/行首 → tag 触发
  3. 遇到 '@' 且前面是空白/行首 → 检查后面是否跟着 'p:' → project 触发
  4. 提取触发字符到光标之间的文本作为 query
  5. 遇到空格 → 取消触发

边界:
  - IME composition 期间不触发
  - 光标在 chip 内部（contenteditable=false）→ 不触发
```

### 6.4 `use-chip-manager.ts`

```
功能：管理 contentEditable 内 TagNode/TaskBasicInfo 的挂载和卸载

维护状态: Map<chipId, { mountEl: HTMLElement, vnode: VNode }>

mountChip(chipData: InlineChipData):
  1. 创建 <span class="vue-chip-mount" contenteditable="false"
       data-chip-id="{id}" data-chip-type="{type}"
       data-entity-id="{entityId}" data-label="{label}">
     </span>
  2. 插入到光标位置
  3. 根据 type 创建 VNode:
     - tag:     h(TagNode, { tag: { id, name, color }, readonly: true })
     - project: h(TaskBasicInfo, { icon: 'more2', text: label, clamped: Infinity })
  4. render(vnode, spanElement)
  5. 记录到 Map

unmountChip(chipId: string):
  1. render(null, mountEl)  ← 卸载组件
  2. mountEl.remove()
  3. 从 Map 中删除

reconcile(): — 每次 input 事件后调用来修复浏览器可能破坏的挂载点
  遍历所有 .vue-chip-mount，与 Map 对比，缺失的重新挂载
```

### 6.5 `suggestion-popover.vue`

```
Props:
  visible, options, query, type, position, highlightIndex, canCreate

Emits:
  select, create, update:highlightIndex

模板:
  <div class="suggestion-popover" :style="{ top, left }" v-if="visible"
       @mousedown.prevent>  ← 防止 blur
    <div class="popover-header">{{ type === 'tag' ? '标签' : '清单' }}</div>
    <div v-for="(opt, i) in options" class="popover-option"
         :class="{ active: i === highlightIndex }"
         @click="select(opt)" @mouseenter="$emit('update:highlightIndex', i)">
      <span v-if="type === 'tag'" class="color-dot"
            :style="{ background: opt.color }" />
      <span class="label">{{ opt.label }}</span>
    </div>
    <div v-if="canCreate && !options.length" class="popover-create"
         @click="$emit('create', query)">
      创建标签 "{{ query }}"
    </div>
  </div>
```

### 6.6 `task-creator-input.vue` 主组件

```vue
<template>
    <div class="task-creator-input" ref="wrapperRef">
        <div
            ref="editorRef"
            class="contenteditable-input"
            contenteditable="true"
            :placeholder="placeholder"
            @input="handleInput"
            @keydown="handleKeydown"
            @focus="handleFocus"
            @blur="handleBlur"
            @compositionstart="isComposing = true"
            @compositionend="isComposing = false"
            v-html="innerHtml"
        ></div>
        <SuggestionPopover
            v-if="trigger.active"
            :visible="trigger.active"
            :options="filteredOptions"
            :query="trigger.query"
            :type="trigger.type"
            :position="popoverPosition"
            :highlight-index="highlightIndex"
            :can-create="trigger.type === 'tag'"
            @select="handleSelect"
            @create="handleCreateTag"
            @update:highlight-index="highlightIndex = $event"
        />
    </div>
</template>
```

**`handleInput` 逻辑：**

```typescript
function handleInput() {
    if (isComposing.value) return
    chipManager.reconcile() // 修复浏览器可能破坏的 chip
    updateTriggerState() // 从光标前文本检测 #/@p:
    emitModelValue() // 同步到 v-model
}
```

**`handleSelect` chip 插入：**

```typescript
function handleSelect(option: SuggestionOption) {
    const textBefore = getTextBeforeCursor()
    const fullTrigger =
        trigger.value.type === 'tag' ? `#${trigger.value.query}` : `@p:${trigger.value.query}`
    const replaceStart = textBefore.lastIndexOf(fullTrigger.charAt(0))

    // 删除触发文本 → 插入 chip 占位 span → render 挂载组件
    const range = window.getSelection()!.getRangeAt(0)
    range.setStart(range.startContainer, replaceStart)
    range.deleteContents()

    chipManager.mountChip(
        {
            chipId: generateId(),
            type: trigger.value.type!,
            entityId: option.id,
            label: option.label
        },
        range
    )

    resetTrigger()
    emitModelValue()
}
```

### 6.7 modelValue 同步

```typescript
function parseModelValue(): TaskCreatorInputValue {
    const editor = editorRef.value!
    let text = ''
    const tags: string[] = []
    let projectId: string | null = null

    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_ALL, null)
    while (walker.nextNode()) {
        const node = walker.currentNode
        if (node.nodeType === Node.TEXT_NODE) {
            text += node.textContent
        } else if (node instanceof HTMLElement && node.classList.contains('vue-chip-mount')) {
            text += node.dataset.label || ''
            const type = node.dataset.chipType
            const eid = node.dataset.entityId
            if (type === 'tag' && eid) tags.push(eid)
            if (type === 'project' && eid && !projectId) projectId = eid
        }
    }
    return { text: text.trim(), tags, projectId }
}
```

### 6.8 样式与 NueUI 统一

```scss
.task-creator-input {
    position: relative;
    width: 100%;

    .contenteditable-input {
        width: 100%;
        min-height: 2.5rem;
        padding: 0.5rem;
        border: 1px solid var(--nue-primary-color-300);
        border-radius: var(--nue-radius-sm);
        background: var(--nue-primary-color-100);
        color: var(--nue-primary-color-900);
        font-size: var(--nue-text-sm);
        line-height: 1.8;
        outline: none;
        cursor: text;
        word-break: break-all;

        &:focus {
            border-color: var(--nue-primary-color-900);
        }

        &:empty::before {
            content: attr(placeholder);
            color: var(--nue-primary-color-500);
        }

        .vue-chip-mount {
            display: inline-block;
            vertical-align: middle;
            user-select: none;

            > .nue-div {
                height: auto;
                padding: 0 0.25rem;
            }
        }
    }
}

.suggestion-popover {
    position: absolute;
    z-index: 1000;
    min-width: 160px;
    max-height: 180px;
    overflow-y: auto;
    background: var(--nue-primary-color-100);
    border: 1px solid var(--nue-primary-color-300);
    border-radius: var(--nue-radius-sm);
    box-shadow: var(--nue-shadow-md);
    padding: 0.25rem;

    .popover-header {
        font-size: var(--nue-text-xs);
        color: var(--nue-primary-color-500);
        padding: 0.25rem 0.5rem;
    }
    .popover-option {
        display: flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.375rem 0.5rem;
        border-radius: calc(var(--nue-radius-sm) - 1px);
        cursor: pointer;
        font-size: var(--nue-text-sm);
        &:hover,
        &.active {
            background: var(--nue-primary-color-200);
        }
    }
    .popover-create {
        padding: 0.5rem;
        font-size: var(--nue-text-sm);
        color: var(--nue-color-primary);
        cursor: pointer;
        text-align: center;
        &:hover {
            background: var(--nue-primary-color-200);
        }
    }
}
```

### 6.9 导入 TagNode / TaskBasicInfo

```typescript
// task-creator-input.vue
import { TagNode, TaskBasicInfo } from '@nao-todo/components'
import { h, render, type VNode } from 'vue'
import type { TagViewObject, ProjectViewObject } from '@nao-todo/types'
```

---

## 7. 与现有系统的集成

### 7.1 对话框结构对比

```
旧对话框内容区（全部保留）:
  nome-input (name)
  nue-textarea (description)
  task-date-selector (截止日期)
  task-selector (状态)
  task-selector (优先级)
  task-project-selector (项目)
  task-tag-bar (标签)

新对话框内容区（开关切换）:
  ┌─ 开关: 使用新创建器 ─────────────┐
  │  [新模式 ON]:                     │
  │    TaskCreatorInput (name+tags+project)  │
  │    nue-textarea (description)            │
  │  [新模式 OFF]:                           │
  │    nome-input, textarea                  │
  │    task-project-selector, task-tag-bar   │
  └──────────────────────────────────────────┘
  共享: task-date-selector (截止日期)
  共享: task-selector (状态)
  共享: task-selector (优先级)
```

### 7.2 数据流（新模式）

```
contentEditable div
    │ (input 事件)              suggestions from store
    ▼                                    │
parseContentToValue() ←──────── TagsStore.tags / ProjectsStore.avaliableProjects
    │
    ├─→ emit('update:modelValue', { text, tags, projectId })
    │       │
    │       ▼
    │   use-task-creator.ts
    │       │
    │       ▼
    │   taskUseCase.createTask({
    │       name: taskInputValue.text,
    │       tags: taskInputValue.tags,
    │       projectId: taskInputValue.projectId,
    │       ...shared fields
    │   })
```

### 7.3 标签创建流程

```
智能输入中键入 #不存在的标签名
  → 弹窗显示 "创建标签 '不存在的标签名'"
  → 用户点击
  → emit('create-tag', name)
  → 父组件: dialogManager.open(TAG_CREATOR_DIALOG_KEY, { name })
  → 标签创建成功 → Pinia store 更新
  → (avaliableTags 响应式更新)
  → 弹窗选项列表自动刷新
```

---

## 8. 文档渲染展示

在任务详情页渲染 `name` 字段中的 `#标签` 和 `@p:项目`：

```typescript
function renderTaskName(name: string): string {
    return name
        .replace(/#(\S+)/g, '<span class="inline-tag">#$1</span>')
        .replace(/@p:(\S+)/g, '<span class="inline-project">@p:$1</span>')
}
```

```css
.inline-tag {
    display: inline-block;
    padding: 0 6px;
    height: 22px;
    line-height: 22px;
    background: var(--nue-primary-color-200);
    border-radius: 99px;
    font-size: var(--nue-text-xs);
    color: var(--nue-primary-color-900);
}
.inline-project {
    font-weight: 500;
    color: var(--nue-color-primary);
}
```

---

## 9. 实现步骤

### Step 1: 基础类型

`packages/components/task-creator-input/types.ts` — 定义全部类型

### Step 2: 解析逻辑

`packages/components/task-creator-input/use-mention-parser.ts` — `#`/`@p:` 触发检测

### Step 3: Chip 管理器

`packages/components/task-creator-input/use-chip-manager.ts` — `h()` + `render()` 动态挂载 TagNode / TaskBasicInfo

### Step 4: 建议弹窗

`packages/components/task-creator-input/suggestion-popover.vue` — 浮动弹窗 UI

### Step 5: 主组件

`packages/components/task-creator-input/task-creator-input.vue` — 组合前 4 步，contentEditable 绑定 + 事件 + modelValue

### Step 6: 导出

`packages/components/task-creator-input/index.ts` + 修改 `packages/components/index.ts`

### Step 7: 对话框集成

- `task-creator.vue`: 添加 `nue-switch` + 条件渲染
- `use-task-creator.ts`: 添加 `useSmartCreator` + localStorage + 双模式数据提交
- i18n 文案

### Step 8: 样式打磨 + QA

- 统一 NueUI 变量
- chip inline-block 对齐
- 暗色模式适配
- 完整交互流程测试

---

## 附录：风险与注意事项

1. **contentEditable innerHTML 修正** — 用 `TreeWalker` + `data-*` 属性解析，不依赖 HTML 格式
2. **IME 中文输入** — `compositionstart`/`compositionend` 标志位
3. **粘贴** — 阻止默认，插入纯文本
4. **VNode 卸载** — `render(null, mountEl)` 确保组件生命周期
5. **chip 浏览器破坏** — `reconcile()` 每次 input 后修复挂载点
6. **垂直对齐** — `display: inline-block; vertical-align: middle`
7. **移动端光标** — `getBoundingClientRect` 降级方案

