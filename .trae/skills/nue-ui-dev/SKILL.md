---
name: "nue-ui-dev"
description: "NueUI 组件库开发工作流指南，包括构建、测试、代码规范等任务。Invoke when developing NueUI components or need to build/test the library."
---

# NueUI 开发与使用指南

## 组件库使用

### 安装

```bash
pnpm install nue-ui
```

### 完整导入

```typescript
import { createApp } from 'vue';
import NueUI from 'nue-ui';
import 'nue-ui/dist/index.css';

const app = createApp(App);
app.use(NueUI);
app.mount('#app');
```

### 按需导入（自动）

```bash
pnpm add nue-ui-resolver -D
```

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import Components from 'unplugin-vue-components/vite';
import { NueUiResolver } from 'nue-ui-resolver';

export default defineConfig({
    plugins: [
        Components({
            resolvers: [NueUiResolver()]
        })
    ]
});
```

### 主题包使用

```bash
pnpm install nue-ui-shadlike-theme
```

```typescript
// 全量引入
import 'nue-ui-shadlike-theme/dist/index.css';

// 或按需引入
import 'nue-ui-shadlike-theme/dist/components/button.css';
import 'nue-ui-shadlike-theme/dist/components/dialog.css';
```

### 图标库使用

```bash
pnpm install nue-ui-iconfont
```

```typescript
import 'nue-ui-iconfont/dist/iconfont.css';
```

## 组件使用

### 组件文档访问

每个组件的详细属性、自定义事件、插槽等信息，可以通过访问官方文档站点查看：

<https://nathan3303.github.io/nue-ui/tutorial/>

文档包含：

- 组件的属性说明
- 事件和插槽介绍
- 使用示例
- 组件 API 文档

### 基础组件

```vue
<template>
  <NueButton type="primary">按钮</NueButton>
  <NueText size="lg">文本</NueText>
  <NueIcon name="home" />
</template>
```

### 表单组件

```vue
<template>
  <NueInput v-model="value" placeholder="输入内容" />
  <NueSelect v-model="selected">
    <NueSelectOption label="选项1" value="1" />
    <NueSelectOption label="选项2" value="2" />
  </NueSelect>
</template>

<script setup lang="ts">
import { ref } from 'vue';
const value = ref('');
const selected = ref('1');
</script>
```

### 反馈组件

```vue
<template>
  <NueButton @click="showDialog = true">打开对话框</NueButton>
  <NueDialog v-model="showDialog" title="提示">
    这是一个对话框
  </NueDialog>
</template>

<script setup lang="ts">
import { ref } from 'vue';
const showDialog = ref(false);
</script>
```

## 开发工作流

### 常用命令

```bash
# 完整构建
pnpm build

# 单独构建 core 包
pnpm core build

# 运行测试
pnpm test:run

# 代码格式化
pnpm format
```

### 开发新组件

1. 在 `packages/components/` 下创建新组件
2. 添加类型定义 `types.ts`
3. 编写测试 `__tests__/`
4. 在 `packages/core/components.ts` 中导出
5. 运行构建和测试

## 项目结构

```
nue-ui/
├── packages/
│   ├── core/          # 核心构建包 (nue-ui)
│   ├── components/    # 组件源码
│   ├── hooks/         # Vue Hooks
│   ├── themes/        # 主题包
│   ├── plugins/       # 插件
│   └── utils/         # 工具函数
└── apps/
    ├── playground/    # 组件演示
    └── document/      # 文档站点
```
