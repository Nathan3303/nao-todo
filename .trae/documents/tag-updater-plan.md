# 标签（Tag）名称和描述修改功能实现计划

## 需求概述

参考 Project 子页面的实现方案，实现 Tag 子页面的标签名称和描述修改功能。**合并 TagColorUpdater 功能，在一个对话框中完成名称、描述、颜色的修改**。

---

## 现状分析

### 已存在的功能

- ✅ TagUseCase.update 方法已存在（packages/application/web/usecases/tag.ts 第 84-96 行）
- ✅ store.updateTag 方法已存在（apps/web/src/stores/base/tags-store-base.ts 第 26-30 行）
- ✅ TagColorUpdater 组件已存在（修改标签颜色）
- ✅ Tag 子页面 Header 的 OperationDropdown 已存在

---

## 实现步骤

### 阶段一：抽离可复用的 Tag 表单 UI 组件

**目标**：将 TagCreator 中的表单部分（名称、描述）抽离为独立的可复用组件

1. **创建 TagForm 基础表单组件
    - 路径：`packages/components/tag-form/`
    - 包含内容：
        - 名称输入框（nue-input）
        - 描述输入框（nue-textarea）
        - 空名称错误提示
    - 支持 Props：
        - `modelValue`：表单数据对象 { name, description }
        - `disabled`：是否禁用输入
        - `isNameEmpty`：名称是否为空的标记
    - 支持 Emits：
        - `update:modelValue`：更新表单数据

2. **在 packages/components/index.ts 中导出 TagForm 组件**

3. **修改 TagCreator 组件以复用 TagForm**
    - 文件：`apps/web/src/components/tasks/dialogs/tag-creator/tag-creator.vue`
    - 导入 TagForm 组件
    - 将原有名称和描述输入框部分替换为 `<tag-form />` 组件
    - 保留颜色选择器部分

---

### 阶段二：创建整合版 TagUpdater 组件（合并 TagColorUpdater）

**目标**：创建整合版 TagUpdater 对话框组件，支持同时修改标签名称、描述和颜色

1. **创建 TagUpdater 类型定义文件**
    - 路径：`apps/web/src/components/tasks/dialogs/tag-updater/types.ts`
    - 定义类型：
        - `TagUpdaterVO`：更新视图对象 { tagId, name, description, color, updating, disabled }
        - `TagUpdaterProps`：组件 Props { updater, tagGetter }
        - `TagUpdaterEmits`：组件事件 { register(open, close) }

2. **创建 useTagUpdater composable**
    - 路径：`apps/web/src/components/tasks/dialogs/tag-updater/use-tag-updater.ts`
    - 功能：
        - 响应式状态管理
        - 获取当前标签数据（名称、描述、颜色）
        - 更新标签名称、描述和颜色
        - 表单验证（名称不能为空）
        - 错误处理和成功提示

3. **创建 TagUpdater 主组件**
    - 路径：`apps/web/src/components/tasks/dialogs/tag-updater/index.vue`
    - 组件内容：
        - 复用 TagForm 组件作为名称和描述输入
        - 添加 TagColorSelector 颜色选择器
        - 对话框标题："修改标签"
        - 确认按钮文字："修改"

4. **创建 tag-updater/index.ts 导出组件**
    - 使用异步组件方式导出

5. **在 dialogs/index.ts 中导出 TagUpdater 组件**
    - 文件：`apps/web/src/components/tasks/dialogs/index.ts`
    - 添加 import 和 export 语句

6. **移除旧的 TagColorUpdater 组件（可选，保持向后兼容）**
    - 保持现有代码不删除，确保其他引用位置不报错
    - 将 OperationDropdown 中的"修改标签颜色"合并到新的"修改标签"选项中

---

### 阶段三：注册 TagUpdater 到对话框管理系统

**目标**：将 TagUpdater 对话框集成到 layouts/tasks/dialogs 系统中

1. **在 use-dialogs.ts 中添加相关逻辑**
    - 文件：`apps/web/src/layouts/tasks/dialogs/use-dialogs.ts`
    - 添加内容：
        - `tagUpdaterRegister`：注册对话框函数
        - `tagUpdaterHandler`：调用 tagUseCase 更新标签
        - `tagUpdaterOpener`：打开对话框函数（支持传入 tagId）
        - `tagGetter`：根据 ID 获取标签信息的函数（已有 store.getTag）

2. **在 dialogs/index.vue 中注册并使用 TagUpdater**
    - 文件：`apps/web/src/layouts/tasks/dialogs/index.vue`
    - 导入 TagUpdater 组件
    - 添加 `<tag-updater />` 组件到模板
    - 绑定 props 和 events

---

### 阶段四：在 Tag 子页面 OperationDropdown 中添加触发按钮

**目标**：在 Tag 子页面 Header 的 OperationDropdown 中添加"修改标签"选项，整合原有的颜色修改功能

1. **修改 Tag 页面的 OperationDropdown 组件**
    - 文件：`apps/web/src/layouts/tasks/tag/header/operation-dropdown.vue`
    - 在"标签操作"区块中：
        - 移除原有的"修改标签颜色"选项
        - 添加新的"修改标签"选项：
            - 图标：`edit`
            - 标题：`修改标签`
            - execute-id：`update-tag`
    - 在 `onMounted` 中注册 `update-tag` 的执行函数：
        - 调用 dialogManager 打开 tag-updater 对话框
        - 传入当前 tagId

---

## 参考文件

### 现有组件参考

- **ProjectUpdater 组件**：`apps/web/src/components/tasks/dialogs/project-updater/`
- **TagColorUpdater 组件**：`apps/web/src/components/tasks/dialogs/tag-color-updater/`（参考实现，完成后可保留）
- **TagCreator 组件**：`apps/web/src/components/tasks/dialogs/tag-creator/`

### 对话框管理系统

- **对话框注册**：`apps/web/src/layouts/tasks/dialogs/use-dialogs.ts`
- **对话框入口**：`apps/web/src/layouts/tasks/dialogs/index.vue`

### 下拉菜单

- **Tag 页面下拉菜单**：`apps/web/src/layouts/tasks/tag/header/operation-dropdown.vue`

### 类型定义

- **UpdateTagViewObject**：`packages/types/viewobjects/tag.ts`

---

## 注意事项

1. **功能整合**：TagUpdater 整合了名称、描述、颜色三项修改功能，一个对话框完成所有修改
2. **复用优先**：尽量复用现有的 UI 组件和模式，保持代码一致性
3. **表单验证**：更新时同样需要验证名称不能为空
4. **状态管理**：TagUseCase.update 方法已存在且已实现 store 更新，无需额外修改
5. **用户体验**：更新成功后显示成功提示，对话框自动关闭
6. **错误处理**：网络错误或验证失败时显示相应的错误提示
7. **向后兼容**：保留 TagColorUpdater 组件，避免其他引用位置报错