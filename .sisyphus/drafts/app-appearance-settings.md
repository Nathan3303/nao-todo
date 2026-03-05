# 应用外观设置方案

## 需求概述

在 Settings 页面的"应用设置"子页面中，改进现有的外观设置组件，使其具有：

1. **卡片式布局** - 每个选项呈现为一个小卡片
2. **三个主题选项** - 浅色、深色、跟随系统
3. **预览图显示** - 每个卡片包含主题预览图/图标

---

## 现状分析

### 现有结构

```
apps/web/src/
├── views/index/settings/
│   ├── entry.vue              # Settings 主页面
│   ├── settings-view.ts       # Settings View 上下文
│   └── routes.ts              # Settings 路由配置
├── layouts/settings/contents/
│   ├── appsetting.vue         # 应用设置页面（已存在）
│   ├── profile.vue            # 个人信息页面（参考）
│   └── password.vue           # 密码设置页面
├── components/settings/appsetting/
│   ├── appereance.vue         # 外观设置组件（当前是 select）
│   └── index.ts               # 组件导出
└── infrastructure/
    ├── themes/index.ts        # 主题入口
    └── hooks/tasks-view/use-auto-change-theme.ts  # 自动主题切换
```

### 当前外观组件实现

当前使用 `nue-select` 下拉选择，仅有两个选项（默认/暗黑），需要改为卡片式布局并支持"跟随系统"。

### 主题系统现状

- 使用 CSS 变量 `--nue-dark-switch` 控制（0=日间，1=夜间）
- 自动主题切换基于时间（6-18点日间，其他时间夜间）
- 需要扩展为三种模式：light | dark | system

---

## 技术方案

### 方案 A：使用 NueUI 组件 + 自定义样式（推荐）

**核心思路**：使用 `nue-div` 配合自定义样式实现卡片布局，利用 NueUI 现有的布局能力。

**实现步骤**：

1. **修改外观设置组件** (`appereance.vue`)

    - 使用 `nue-div` 横向布局三个卡片
    - 每个卡片包含：预览区域 + Label + 单选按钮
    - 使用 CSS 自定义样式实现卡片视觉效果

2. **创建主题状态管理**

    - 扩展或新建 theme store（Pinia）
    - 支持三种模式：'light' | 'dark' | 'system'
    - localStorage 持久化用户选择
    - 系统主题检测（`matchMedia('(prefers-color-scheme: dark)')`）

3. **实现预览图**
    - 使用 CSS 绘制简化的主题预览（窗口框架 + 内容示意）
    - 或者使用图标（sun/moon/desktop）配合文字

### 方案 B：纯 CSS Grid 布局（备选）

使用原生 CSS Grid/Flex 实现更灵活的卡片布局，不依赖特定组件。

---

## 推荐方案：方案 A（NueUI + 自定义样式）

### 理由

1. **一致性**：与现有代码风格一致（使用 NueUI 组件）
2. **可维护性**：利用现有主题系统和工具函数
3. **快速实现**：项目已有相关基础设施

---

## 具体实现细节

### 1. 数据结构

```typescript
// 主题类型
type ThemeMode = 'light' | 'dark' | 'system'

// 选项数据
interface ThemeOption {
    value: ThemeMode
    label: string
    icon: string // 主图标
    previewClass: string // 预览区域 CSS 类
}

const themeOptions: ThemeOption[] = [
    { value: 'light', label: '浅色', icon: 'sun', previewClass: 'theme-preview-light' },
    { value: 'dark', label: '深色', icon: 'moon', previewClass: 'theme-preview-dark' },
    { value: 'system', label: '跟随系统', icon: 'desktop', previewClass: 'theme-preview-system' }
]
```

### 2. 卡片布局设计

```vue
<template>
    <nue-container>
        <nue-header>应用外观</nue-header>
        <nue-main>
            <nue-content>
                <nue-text size="14px" color="gray">选择你喜欢的主题</nue-text>

                <!-- 卡片容器 -->
                <nue-div class="theme-cards-container" gap="1rem" wrap>
                    <div
                        v-for="option in themeOptions"
                        :key="option.value"
                        class="theme-card"
                        :class="{ active: currentTheme === option.value }"
                        @click="selectTheme(option.value)"
                    >
                        <!-- 预览图区域 -->
                        <div class="theme-card__preview" :class="option.previewClass">
                            <!-- 使用 CSS 绘制预览 -->
                            <div class="preview-window">
                                <div class="preview-header"></div>
                                <div class="preview-content">
                                    <div class="preview-line"></div>
                                    <div class="preview-line short"></div>
                                </div>
                            </div>
                        </div>

                        <!-- 信息区域 -->
                        <div class="theme-card__info">
                            <nue-icon :name="option.icon" size="16px" />
                            <nue-text size="12px">{{ option.label }}</nue-text>
                        </div>

                        <!-- 选中指示器 -->
                        <div v-if="currentTheme === option.value" class="theme-card__check">
                            <nue-icon name="check" color="primary" />
                        </div>
                    </div>
                </nue-div>
            </nue-content>
        </nue-main>
    </nue-container>
</template>
```

### 3. 预览图 CSS 设计

```css
/* 浅色主题预览 */
.theme-preview-light .preview-window {
    background: #ffffff;
    border: 1px solid #e0e0e0;
}
.theme-preview-light .preview-header {
    background: #f5f5f5;
    border-bottom: 1px solid #e0e0e0;
}

/* 深色主题预览 */
.theme-preview-dark .preview-window {
    background: #1a1a1a;
    border: 1px solid #333;
}
.theme-preview-dark .preview-header {
    background: #2a2a2a;
    border-bottom: 1px solid #333;
}

/* 系统主题预览 - 一半浅色一半深色 */
.theme-preview-system .preview-window {
    background: linear-gradient(90deg, #ffffff 50%, #1a1a1a 50%);
    border: 1px solid #ccc;
}
```

### 4. 主题状态管理

```typescript
// stores/theme-store.ts
import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

export type ThemeMode = 'light' | 'dark' | 'system'

export const useThemeStore = defineStore('ThemeStore', () => {
    // State
    const themeMode = ref<ThemeMode>('system')
    const systemPrefersDark = ref(false)

    // Computed - 实际应用的主题
    const actualTheme = computed(() => {
        if (themeMode.value === 'system') {
            return systemPrefersDark.value ? 'dark' : 'light'
        }
        return themeMode.value
    })

    // Actions
    const setTheme = (mode: ThemeMode) => {
        themeMode.value = mode
        localStorage.setItem('theme-mode', mode)
    }

    const initSystemListener = () => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
        systemPrefersDark.value = mediaQuery.matches

        mediaQuery.addEventListener('change', (e) => {
            systemPrefersDark.value = e.matches
        })
    }

    const loadSavedTheme = () => {
        const saved = localStorage.getItem('theme-mode') as ThemeMode
        if (saved) themeMode.value = saved
    }

    // Watch - 应用主题到 DOM
    watch(
        actualTheme,
        (newTheme) => {
            const flag = newTheme === 'dark' ? 1 : 0
            document.documentElement.style.setProperty('--nue-dark-switch', flag.toString())
        },
        { immediate: true }
    )

    return {
        themeMode,
        actualTheme,
        setTheme,
        initSystemListener,
        loadSavedTheme
    }
})
```

### 5. 文件变更清单

| 文件                                                         | 操作 | 说明                 |
| ------------------------------------------------------------ | ---- | -------------------- |
| `apps/web/src/components/settings/appsetting/appereance.vue` | 修改 | 重构为卡片式布局     |
| `apps/web/src/stores/theme-store.ts`                         | 新增 | 主题状态管理         |
| `apps/web/src/main.ts`                                       | 修改 | 初始化主题监听和加载 |

---

## UI 设计参考

### 卡片样式规格

- **尺寸**：140px × 160px
- **圆角**：12px
- **边框**：1px solid transparent（默认）/ 1px solid primary（选中）
- **阴影**：0 2px 8px rgba(0,0,0,0.08)
- **悬停效果**：阴影加深，轻微上移

### 预览图规格

- **尺寸**：100px × 70px
- **内容**：简化窗口（标题栏 + 两行内容）
- **圆角**：6px

### 选中状态

- 边框变为 primary 颜色
- 右上角显示 check 图标
- 轻微放大效果（scale: 1.02）

---

## 验收标准

- [ ] 三个主题选项（浅色、深色、跟随系统）以卡片形式展示
- [ ] 每个卡片包含预览图和文字标签
- [ ] 点击卡片即可切换主题
- [ ] 当前选中主题有视觉高亮
- [ ] 主题选择自动保存到 localStorage
- [ ] 选择"跟随系统"时，能自动响应系统主题变化
- [ ] 页面刷新后保持上次选择的主题

---

## 建议下一步

如果你认可这个方案，我可以为你生成详细的工作计划（Work Plan），包括：

1. 具体的实现步骤和任务分解
2. 代码片段和文件路径
3. 测试验证方案

请告诉我是否需要继续推进？
