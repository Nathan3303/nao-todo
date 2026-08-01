# 用户注销功能 - 验证检查清单

## A. ResponseData 类型更新

- [ ] Checkpoint A1: Infrastructure 层 `ResponseData` 类型添加 `businessCode: string | undefined` 属性（可选，用于其他业务错误处理）
- [ ] Checkpoint A2: Domain 层 `AuthSessionValueObject` 添加 `pendingDeletion` 和 `deletionDeadline` 属性
- [ ] Checkpoint A3: Infrastructure 层登录响应类型（如 `SignInRes`）添加 `pendingDeletion` 和 `deletionDeadline` 属性

## B. 用户注销功能

- [ ] Checkpoint B1: Domain 层 `DeactiveUserValueObject` 值对象创建完成，包含密码验证逻辑
- [ ] Checkpoint B2: UserRepository 接口 `deactive` 方法签名更新，接受 `DeactiveUserValueObject` 参数
- [ ] Checkpoint B3: Infrastructure 层 `UserRepoImpl` 的 `deactive` 方法实现更新，使用 DELETE 请求到 `/user/`，请求体使用现有类型 `DeactiveUserReq`
- [ ] Checkpoint B4: Application 层 `DeactiveUserViewObject` 类型和转换器创建完成
- [ ] Checkpoint B5: Application 层 `UserUseCase` 添加 `deactive` 方法，包含表单验证逻辑
- [ ] Checkpoint B6: Presentation 层用户注销组件创建完成，包含密码输入、确认密码输入和协议同意复选框
- [ ] Checkpoint B7: Views 层设置页面添加注销按钮和完整流程逻辑

## C. 登录时检测待注销状态与撤销注销功能

- [ ] Checkpoint C1: Domain 层 `RestoreUserValueObject` 值对象创建完成，包含密码验证逻辑
- [ ] Checkpoint C2: UserRepository 接口添加 `restore` 方法签名，接受 `RestoreUserValueObject` 参数
- [ ] Checkpoint C3: Infrastructure 层 `UserRepoImpl` 添加 `restore` 方法实现，使用 PUT 请求到 `/user/restore`
- [ ] Checkpoint C4: Infrastructure 层 `AuthRepoImpl` 的 `signIn` 方法更新，映射 `pendingDeletion` 和 `deletionDeadline` 字段到 `AuthSessionValueObject`
- [ ] Checkpoint C5: Application 层 `RestoreUserViewObject` 类型和转换器创建完成
- [ ] Checkpoint C6: Application 层 `UserUseCase` 添加 `restore` 方法，包含表单验证逻辑
- [ ] Checkpoint C7: Application 层 `AuthUseCase` 的 `signIn` 方法添加 `onPendingDeletion` 回调参数
- [ ] Checkpoint C8: Presentation 层撤销注销页面组件创建完成，包含密码输入框和同意协议复选框
- [ ] Checkpoint C9: Views 层添加撤销注销页面路由和登录页面检测逻辑，撤销注销成功后清除认证数据并跳转登录页面

## D. 综合验证

- [ ] Checkpoint D1: 所有 TypeScript 编译通过，无类型错误
- [ ] Checkpoint D2: 应用构建成功，可正常运行