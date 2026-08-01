# 项目清单（Project）名称和描述修改功能实现计划

## 需求概述

实现任务清单（Project）的名称和描述修改功能，具体包括：

1. 复用 ProjectCreator 中的 UI 界面，将其抽离成为一个单独的组件
2. 创建 ProjectUpdater 组件以实现更新功能
3. 将 ProjectUpdater 组件的触发按钮设置在 Project 子页面 Header 中的 OperationDropdown 里
4. 将 ProjectUpdater 对话框组件注册到 layouts/tasks/dialogs 中

---

## 实现步骤

### 阶段一：抽离可复用的表单 UI 组件

**目标**：将 ProjectCreator 中的表单部分抽离为独立的可复用组件

1. **创建 ProjectForm 基础表单组件**
    - 路径：`packages/components/tasks/forms/project-form.vue`
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

2. **在 packages/components 中导出 ProjectForm 组件**
    - 更新相应的 index.ts 文件，导出 ProjectForm

3. **修改 ProjectCreator 组件以复用 ProjectForm**
    - 文件：`apps/web/src/components/tasks/dialogs/project-creator/index.vue`
    - 从 `@nao-todo/components` 导入 ProjectForm 组件
    - 将原有 form 内容替换为 `<project-form />` 组件
    - 保持原有对话框结构和按钮逻辑

---

### 阶段二：创建 ProjectUpdater 组件

**目标**：创建 ProjectUpdater 对话框组件实现清单更新功能

1. **创建 ProjectUpdater 类型定义文件**
    - 路径：`apps/web/src/components/tasks/dialogs/project-updater/types.ts`
    - 定义类型：
        - `ProjectUpdaterVO`：更新视图对象 { projectId, name, description, updating, disabled }
        - `ProjectUpdaterProps`：组件 Props { updater, projectGetter }
        - `ProjectUpdaterEmits`：组件事件 { register(open, close) }

2. **创建 useProjectUpdater composable**
    - 路径：`apps/web/src/components/tasks/dialogs/project-updater/use-project-updater.ts`
    - 功能：
        - 响应式状态管理
        - 获取当前项目数据（名称和描述）
        - 更新项目名称和描述
        - 表单验证（名称不能为空）
        - 错误处理和成功提示

3. **创建 ProjectUpdater 主组件**
    - 路径：`apps/web/src/components/tasks/dialogs/project-updater/index.vue`
    - 复用 ProjectForm 组件作为表单内容
    - 对话框标题："修改清单"
    - 确认按钮文字："修改"
    - 参考 TagColorUpdater 组件的实现模式（支持传入 projectId）

4. **导出 ProjectUpdater 组件**
    - 文件：`apps/web/src/components/tasks/dialogs/index.ts`
    - 添加 import 和 export 语句

---

### 阶段三：注册 ProjectUpdater 到对话框管理系统

**目标**：将 ProjectUpdater 对话框集成到 layouts/tasks/dialogs 系统中

1. **在 useDialogs.ts 中添加相关逻辑**
    - 文件：`apps/web/src/layouts/tasks/dialogs/use-dialogs.ts`
    - 添加内容：
        - `projectUpdaterRegister`：注册对话框函数
        - `projectUpdaterHandler`：调用 projectUseCase 更新项目
        - `projectUpdaterOpener`：打开对话框函数（支持传入 projectId）
        - `projectGetter`：根据 ID 获取项目信息的函数

2. **在 converters.ts 中添加转换器（如需要）**
    - 文件：`apps/web/src/layouts/tasks/dialogs/converters.ts`
    - 添加 `projectUpdaterVO2ValueObject` 转换器（如有必要）

3. **在 dialogs/index.vue 中注册并使用 ProjectUpdater**
    - 文件：`apps/web/src/layouts/tasks/dialogs/index.vue`
    - 导入 ProjectUpdater 组件
    - 添加 `<project-updater />` 组件到模板
    - 绑定 props 和 events

---

### 阶段四：在 OperationDropdown 中添加触发按钮

**目标**：在 Project 子页面 Header 的 OperationDropdown 中添加"修改清单"选项

1. **修改 Project 页面的 OperationDropdown 组件**
    - 文件：`apps/web/src/layouts/tasks/project/header/operation-dropdown.vue`
    - 在"清单操作"区块中添加新选项：
        - 图标：`edit`
        - 标题：`修改清单`
        - execute-id：`update-project`
    - 在 `onMounted` 中注册 `update-project` 的执行函数：
        - 调用 dialogManager 打开 project-updater 对话框
        - 传入当前 projectId

---

### 阶段五：完善项目用例层更新后的状态同步

**目标**：确保项目更新后 store 中的数据能同步更新

**现状检查结果**：

- ✅ ProjectUseCase.update 方法已存在
- ✅ updateProjectViewObjectToValueObject 转换器已存在
- ✅ store.updateProject 方法已存在
- ❌ **问题**：`ProjectUseCase.update` 更新成功后未调用 store.updateProject 同步本地状态

1. **修改 ProjectUseCase.update 方法，添加 store 状态同步**
    - 文件：`packages/application/web/usecases/project.ts`
    - 位置：第 181-193 行的 update 方法
    - 修改内容：
        - 在调用 domain.update 成功后，调用 `this.store.updateProject` 同步本地状态
        - 参考 create 方法的模式（第 86 行 `this.store.addProject(project)`）

---

## 参考文件

### 现有组件参考

- **ProjectCreator 组件**：`apps/web/src/components/tasks/dialogs/project-creator/`
- **TagColorUpdater 组件**：`apps/web/src/components/tasks/dialogs/tag-color-updater/`

### 对话框管理系统

- **对话框注册**：`apps/web/src/layouts/tasks/dialogs/use-dialogs.ts`
- **对话框入口**：`apps/web/src/layouts/tasks/dialogs/index.vue`

### 下拉菜单

- **Project 页面下拉菜单**：`apps/web/src/layouts/tasks/project/header/operation-dropdown.vue`

### 类型定义

- **UpdateProjectViewObject**：`packages/types/viewobjects/project.ts`
- **UpdateProjectValueObject**：`packages/domain/project/valueobjects/update-project.ts`

---

## 注意事项

1. **复用优先**：尽量复用现有的 UI 组件和模式，保持代码一致性
2. **表单验证**：更新时同样需要验证名称不能为空
3. **状态管理**：更新成功后需要同步 store 中的数据
4. **用户体验**：更新成功后显示成功提示，对话框自动关闭
5. **错误处理**：网络错误或验证失败时显示相应的错误提示