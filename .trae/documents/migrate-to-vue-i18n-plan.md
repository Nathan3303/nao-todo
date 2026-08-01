# 迁移到 vue-i18n 的计划

## 概述

将项目现有的自定义国际化实现迁移到 vue-i18n 库。

## 当前实现分析

### 现有结构

- **位置**：`packages/infrastructure/locales/`
- **核心文件**：
    - `i18n.ts` - 自定义实现，包含 `t()`、`setLocale()` 等函数
    - `zh-CN.ts` - 中文语言包
    - `en-US.ts` - 英文语言包
    - `types.ts` - 类型定义
- **状态管理**：`apps/web/src/stores/locale-store.ts` 中的 Pinia store

### 使用方式

```typescript
import { t, setLocale } from '@nao-todo/infrastructure/locales'

// 在组件中使用
t('key.name')

// 切换语言
setLocale('zh-CN')
```

## 迁移计划

### 1. 修改 locales 包

重构 `packages/infrastructure/locales/` 目录：

- 保持现有语言包文件（zh-CN.ts 和 en-US.ts）
- 修改 i18n.ts 为 vue-i18n 初始化配置
- 更新类型定义以兼容 vue-i18n
- 更新入口文件导出

### 2. 更新主应用入口

修改 `apps/web/src/main.ts`：

- 引入并配置 vue-i18n
- 在应用中安装 i18n 插件

### 3. 更新 locale store

修改 `apps/web/src/stores/locale-store.ts`：

- 适配 vue-i18n 的语言切换方式
- 保持本地存储功能

### 4. 更新使用代码

将所有 `t()` 函数调用和相关导入更新为 vue-i18n 的方式：

- 使用 `useI18n()` 组合式函数
- 模板中使用 `$t()`
- TypeScript 类型适配

### 5. 测试验证

确保：

- 语言切换功能正常
- 现有所有翻译键正常工作
- TypeScript 类型检查通过
- 应用能够正常运行

## 关键文件修改

| 文件                                       | 操作                   |
| ------------------------------------------ | ---------------------- |
| `packages/infrastructure/locales/i18n.ts`  | 重构为 vue-i18n 配置   |
| `packages/infrastructure/locales/index.ts` | 更新导出               |
| `apps/web/src/main.ts`                     | 安装 vue-i18n 插件     |
| `apps/web/src/stores/locale-store.ts`      | 适配新的 i18n API      |
| 所有使用 `t()` 的文件                      | 更新为 vue-i18n 的 API |