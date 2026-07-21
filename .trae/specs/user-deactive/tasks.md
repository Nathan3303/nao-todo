# 用户注销功能 - 实现计划

## A. ResponseData 类型更新

### [ ] Task A1: Infrastructure 层 - 更新 ResponseData 类型定义
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 更新 `packages/infrastructure/backend/models/base.ts` 中的 `ResponseData` 类型
  - 添加 `businessCode: string | undefined` 属性
- **Acceptance Criteria Addressed**: AC-7
- **Test Requirements**:
  - `programmatic` TR-A1.1: TypeScript 编译通过，类型定义正确

### [ ] Task A2: Domain 层 - 更新 AuthSessionValueObject 添加待注销状态字段
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 更新 `packages/domain/auth/valueobjects/auth-session.ts` 中的 `AuthSessionValueObject` 类
  - 添加 `pendingDeletion: boolean` 和 `deletionDeadline: string | undefined` 属性
- **Acceptance Criteria Addressed**: AC-7
- **Test Requirements**:
  - `programmatic` TR-A2.1: TypeScript 编译通过，类型定义正确

### [ ] Task A3: Infrastructure 层 - 更新登录响应类型添加待注销状态字段
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 更新 `packages/infrastructure/backend/models/auth.ts` 中的登录响应类型（如 `SignInRes`）
  - 添加 `pendingDeletion: boolean` 和 `deletionDeadline: string | undefined` 属性
- **Acceptance Criteria Addressed**: AC-7
- **Test Requirements**:
  - `programmatic` TR-A3.1: TypeScript 编译通过，类型定义正确

## B. 用户注销功能

### [ ] Task B1: Domain 层 - 创建 DeactiveUserValueObject 值对象
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 在 `packages/domain/user/valueobjects/` 目录下创建 `deactive-user.ts`
  - 创建 `DeactiveUserValueObject` 类，包含 `password` 属性
  - 添加 `validate()` 方法，验证密码非空且格式正确
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `programmatic` TR-B1.1: 验证密码为空时返回错误信息
  - `programmatic` TR-B1.2: 验证密码格式不正确时返回错误信息
  - `human-judgement` TR-B1.3: 代码符合 Domain 层纯业务逻辑原则，无前端技术依赖

### [ ] Task B2: Domain 层 - 更新 UserRepository 接口（deactive）
- **Priority**: high
- **Depends On**: Task B1
- **Description**:
  - 更新 `packages/domain/user/repositories/user.ts` 中的 `deactive` 方法签名
  - 将 `deactive(): GoAsync<void>` 修改为 `deactive(deactiveVO: DeactiveUserValueObject): GoAsync<void>`
- **Acceptance Criteria Addressed**: AC-5
- **Test Requirements**:
  - `programmatic` TR-B2.1: TypeScript 编译通过，接口定义正确
  - `human-judgement` TR-B2.2: 接口定义清晰，参数类型正确

### [ ] Task B3: Infrastructure 层 - 更新 UserRepoImpl deactive 实现
- **Priority**: high
- **Depends On**: Task B2
- **Description**:
  - 更新 `packages/infrastructure/backend/user/user-repo-impl.ts` 中的 `deactive` 方法
  - 使用 DELETE 请求到 `/user/`，请求体使用现有类型 `DeactiveUserReq`（`{ password: string }`）
  - 更新 import 语句引入 `DeactiveUserValueObject` 和 `DeactiveUserReq`
- **Acceptance Criteria Addressed**: AC-5
- **Test Requirements**:
  - `programmatic` TR-B3.1: TypeScript 编译通过，实现类符合接口定义
  - `human-judgement` TR-B3.2: 请求体使用 `DeactiveUserReq` 类型，使用 DELETE 请求到 `/user/`

### [ ] Task B4: Application 层 - 创建 DeactiveUserViewObject 和转换器
- **Priority**: high
- **Depends On**: Task B1
- **Description**:
  - 在 `packages/application/user/viewobjects.ts` 中添加 `DeactiveUserViewObject` 类型，包含 `password`、`confirmPassword`、`agreed` 属性
  - 在 `packages/application/user/usecases/converters.ts` 中添加 `deactiveUserViewObjectToValueObject` 转换器函数
- **Acceptance Criteria Addressed**: AC-4, AC-5
- **Test Requirements**:
  - `programmatic` TR-B4.1: TypeScript 编译通过
  - `human-judgement` TR-B4.2: 转换器正确映射 ViewObject 到 ValueObject

### [ ] Task B5: Application 层 - UserUseCase 添加 deactive 方法
- **Priority**: high
- **Depends On**: Task B2, Task B4
- **Description**:
  - 在 `packages/application/user/usecases/user.ts` 中添加 `deactive` 方法
  - 验证密码与确认密码一致
  - 验证协议已同意
  - 调用 `userRepo.deactive()` 方法
- **Acceptance Criteria Addressed**: AC-4, AC-5, AC-6
- **Test Requirements**:
  - `programmatic` TR-B5.1: 密码不一致时返回错误信息
  - `programmatic` TR-B5.2: 协议未同意时返回错误信息
  - `human-judgement` TR-B5.3: 方法实现符合现有代码风格

### [ ] Task B6: Presentation 层 - 创建用户注销组件
- **Priority**: high
- **Depends On**: Task B5
- **Description**:
  - 在 `packages/presentation/user/components/` 目录下创建 `deactive-user/` 目录
  - 创建 `deactive-user.vue` 组件，包含注销表单对话框
  - 创建 `types.ts` 定义组件属性
- **Acceptance Criteria Addressed**: AC-2, AC-3, AC-4
- **Test Requirements**:
  - `human-judgement` TR-B6.1: UI 包含密码输入框、确认密码输入框和同意协议复选框
  - `human-judgement` TR-B6.2: 显示冷却期提示信息

### [ ] Task B7: Views 层 - 在设置页面添加注销按钮和逻辑
- **Priority**: high
- **Depends On**: Task B6
- **Description**:
  - 修改 `apps/web/src/components/settings/profile-updater/index.vue`
  - 添加注销按钮
  - 实现点击注销按钮弹出确认框的逻辑
  - 确认后弹出注销表单对话框
  - 提交后调用 UserUseCase 的 `deactive` 方法
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-6
- **Test Requirements**:
  - `human-judgement` TR-B7.1: 页面显示注销按钮
  - `human-judgement` TR-B7.2: 点击按钮弹出确认框
  - `programmatic` TR-B7.3: 注销成功后清除认证数据并跳转登录页

## C. 登录时检测待注销状态与撤销注销功能

### [ ] Task C1: Domain 层 - 创建 RestoreUserValueObject 值对象
- **Priority**: high
- **Depends On**: None
- **Description**:
  - 在 `packages/domain/user/valueobjects/` 目录下创建 `restore-user.ts`
  - 创建 `RestoreUserValueObject` 类，包含 `password` 属性
  - 添加 `validate()` 方法，验证密码非空且格式正确
- **Acceptance Criteria Addressed**: AC-10
- **Test Requirements**:
  - `programmatic` TR-C1.1: 验证密码为空时返回错误信息
  - `programmatic` TR-C1.2: 验证密码格式不正确时返回错误信息
  - `human-judgement` TR-C1.3: 代码符合 Domain 层纯业务逻辑原则，无前端技术依赖

### [ ] Task C2: Domain 层 - 更新 UserRepository 接口（restore）
- **Priority**: high
- **Depends On**: Task C1
- **Description**:
  - 更新 `packages/domain/user/repositories/user.ts`，添加 `restore` 方法签名
  - 添加 `restore(restoreVO: RestoreUserValueObject): GoAsync<void>`
- **Acceptance Criteria Addressed**: AC-11
- **Test Requirements**:
  - `programmatic` TR-C2.1: TypeScript 编译通过，接口定义正确
  - `human-judgement` TR-C2.2: 接口定义清晰，参数类型正确

### [ ] Task C3: Infrastructure 层 - 更新 UserRepoImpl 添加 restore 实现
- **Priority**: high
- **Depends On**: Task C2
- **Description**:
  - 更新 `packages/infrastructure/backend/user/user-repo-impl.ts`，添加 `restore` 方法
  - 使用 PUT 请求到 `/user/restore`，请求体使用 `{ password: string }`
  - 更新 import 语句引入 `RestoreUserValueObject`
- **Acceptance Criteria Addressed**: AC-11
- **Test Requirements**:
  - `programmatic` TR-C3.1: TypeScript 编译通过，实现类符合接口定义
  - `human-judgement` TR-C3.2: 请求体使用正确类型，使用 PUT 请求到 `/user/restore`

### [ ] Task C4: Infrastructure 层 - 更新 AuthRepoImpl signIn 方法映射待注销字段
- **Priority**: high
- **Depends On**: Task A2, Task A3
- **Description**:
  - 更新 `packages/infrastructure/backend/auth/repoImpl.ts` 中的 `signIn` 方法
  - 将后端响应中的 `pendingDeletion` 和 `deletionDeadline` 字段映射到 `AuthSessionValueObject`
- **Acceptance Criteria Addressed**: AC-7
- **Test Requirements**:
  - `programmatic` TR-C4.1: TypeScript 编译通过
  - `human-judgement` TR-C4.2: 正确映射 `pendingDeletion` 和 `deletionDeadline` 字段

### [ ] Task C5: Application 层 - 创建 RestoreUserViewObject 和转换器
- **Priority**: high
- **Depends On**: Task C1
- **Description**:
  - 在 `packages/application/user/viewobjects.ts` 中添加 `RestoreUserViewObject` 类型，包含 `password`、`agreed` 属性
  - 在 `packages/application/user/usecases/converters.ts` 中添加 `restoreUserViewObjectToValueObject` 转换器函数
- **Acceptance Criteria Addressed**: AC-10, AC-11
- **Test Requirements**:
  - `programmatic` TR-C5.1: TypeScript 编译通过
  - `human-judgement` TR-C5.2: 转换器正确映射 ViewObject 到 ValueObject

### [ ] Task C6: Application 层 - UserUseCase 添加 restore 方法
- **Priority**: high
- **Depends On**: Task C2, Task C5
- **Description**:
  - 在 `packages/application/user/usecases/user.ts` 中添加 `restore` 方法
  - 验证密码非空
  - 验证协议已同意
  - 调用 `userRepo.restore()` 方法
- **Acceptance Criteria Addressed**: AC-10, AC-11
- **Test Requirements**:
  - `programmatic` TR-C6.1: 密码为空时返回错误信息
  - `programmatic` TR-C6.2: 协议未同意时返回错误信息
  - `human-judgement` TR-C6.3: 方法实现符合现有代码风格

### [ ] Task C7: Application 层 - AuthUseCase signIn 添加待注销状态回调
- **Priority**: high
- **Depends On**: Task C4
- **Description**:
  - 更新 `packages/application/auth/usecases/auth.ts` 中的 `signIn` 方法
  - 添加可选回调参数 `onPendingDeletion?: (deletionDeadline: string | undefined) => void`
  - 当登录成功且 `pendingDeletion` 为 `true` 时，调用回调函数并传入 `deletionDeadline`
- **Acceptance Criteria Addressed**: AC-7
- **Test Requirements**:
  - `programmatic` TR-C7.1: TypeScript 编译通过
  - `human-judgement` TR-C7.2: 回调注入模式符合项目约定

### [ ] Task C8: Presentation 层 - 创建撤销注销页面组件
- **Priority**: high
- **Depends On**: Task C6
- **Description**:
  - 在 `packages/presentation/user/components/` 目录下创建 `restore-user/` 目录
  - 创建 `restore-user.vue` 组件，包含撤销注销页面内容
  - 创建 `types.ts` 定义组件属性，包含 `deletionDeadline` 属性
- **Acceptance Criteria Addressed**: AC-8, AC-9, AC-10
- **Test Requirements**:
  - `human-judgement` TR-C8.1: 页面显示待注销状态提示和数据删除截止时间
  - `human-judgement` TR-C8.2: UI 包含密码输入框和同意协议复选框

### [ ] Task C9: Views 层 - 添加撤销注销页面路由和登录页面检测逻辑
- **Priority**: high
- **Depends On**: Task C7, Task C8
- **Description**:
  - 在路由配置中添加撤销注销页面路由（如 `/restore`）
  - 修改登录页面组件，在 `signIn` 调用中注入 `onPendingDeletion` 回调
  - 当回调触发时，跳转到撤销注销页面
  - 在撤销注销页面调用 UserUseCase 的 `restore` 方法
  - 撤销注销成功后，清除认证数据并跳转到登录页面，用户需重新登录获取 JWT
- **Acceptance Criteria Addressed**: AC-7, AC-8, AC-11, AC-12
- **Test Requirements**:
  - `human-judgement` TR-C9.1: 登录成功后自动跳转到撤销注销页面
  - `human-judgement` TR-C9.2: 撤销注销页面显示待注销状态提示和删除截止时间
  - `programmatic` TR-C9.3: 撤销注销成功后清除认证数据并跳转登录页面