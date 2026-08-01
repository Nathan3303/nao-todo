# Checklist

- [x] `GetTasksOptions` 新增可选 `parentTaskId` 字段，且能被查询串序列化透传
- [x] `TaskDetailsStore` 新增独立子任务 store 与 `subTasksLoading/subTasksError`，与主任务列表数据隔离
- [x] `use-subtasks.ts` 复用 `useTasksLoader`，以 `{ parentTaskId }` 加载并写入子任务 store
- [x] 打开/切换任务详情时会加载对应任务的子任务数据
- [x] 详情主体在标签栏下方渲染子任务区域，带顶部分割线，样式对齐评论区域
- [x] 无子任务且非加载/错误时不渲染子任务区域
- [x] 子任务加载中/错误时分别展示占位与重试
- [x] 点击子任务列表项调用 `switchTaskDetails` 切换到该子任务详情
- [x] 头部在 `task-check-button` 左侧于存在 `parentTaskId` 时显示返回按钮，点击返回父任务；无父任务时不显示
- [x] 底部「更多操作」新增「移动至子任务...」选项，点击打开 `ParentTaskSelector` 对话框
- [x] `ParentTaskSelector` 列表排除当前任务自身，确认后调用 `taskHandler.update(vo.id, { parentTaskId })` 并关闭对话框
- [x] 新增对话框已在 `dialog-adapter.vue`/`dialogs/index.ts` 注册，dialog key 已在常量文件定义
- [x] 新增文案已补齐 `zh-CN.ts`、`en-US.ts`、`types.ts`
- [x] web 类型检查/构建通过，无新增类型错误