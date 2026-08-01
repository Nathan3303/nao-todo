# TaskTable 组件重新设计计划文档

## 1. 概述

### 1.1 背景

对现有的 TaskTable 组件进行重新设计，在保留所有现有功能的基础上，增加表格列的手动排序功能以及宽度手动调整功能，并设计数据存储格式以便后端集成。

### 1.2 目标

- 保留所有现有功能
- 实现列手动排序（拖拽）
- 实现列宽手动调整
- 设计完整的数据存储格式（类型定义）
- 提供后端数据格式建议

### 1.3 范围

- 前端：TaskTable 组件及其相关文件
- 后端：数据存储格式设计和 API 建议

---

## 2. 现有功能分析

### 2.1 当前功能列表

| 功能                  | 状态    | 说明             |
| --------------------- | ------- | ---------------- |
| 任务列表展示          | ✅ 保留 | 显示所有任务     |
| 列显示/隐藏控制       | ✅ 保留 | 控制列的可见性   |
| 数据排序（升序/降序） | ✅ 保留 | 基于列的数据排序 |
| 多选功能              | ✅ 保留 | Shift 键多选任务 |
| 任务详情展示          | ✅ 保留 | 点击任务查看详情 |
| 删除/恢复功能         | ✅ 保留 | 软删除和恢复任务 |
| 标签显示              | ✅ 保留 | 显示任务标签     |
| 列手动排序            | 🆕 新增 | 拖拽交换列位置   |
| 列宽手动调整          | 🆕 新增 | 拖拽调整列宽度   |

### 2.2 现有文件结构

```
components/tasks/table/
├── table-main.vue          # 表格主体
├── table-header.vue        # 表格头部
├── table.vue               # 主组件
├── types.ts                # 类型定义
├── use-table.ts            # 组合式函数
├── use-multi-select.ts     # 多选逻辑
├── order-button.vue        # 排序按钮
└── table.css               # 样式文件
```

---

## 3. 新增功能设计

### 3.1 列手动排序功能

#### 3.1.1 技术方案

- 使用 HTML5 Drag & Drop API
- 实现列头拖拽交换
- 添加视觉反馈（高亮、占位符）

#### 3.1.2 交互设计

1. 鼠标悬停在列头时显示拖拽手柄图标
2. 拖拽时列头半透明
3. 目标位置显示插入指示器
4. 支持左右拖拽交换列位置

#### 3.1.3 核心实现逻辑

```typescript
// 拖拽开始
const handleDragStart = (e: DragEvent, index: number) => {
    e.dataTransfer?.setData('text/plain', index.toString())
    e.dataTransfer?.effectAllowed = 'move'
}

// 拖拽悬停
const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    e.dataTransfer!.dropEffect = 'move'
}

// 拖拽放置
const handleDrop = (e: DragEvent, targetIndex: number) => {
    e.preventDefault()
    const fromIndex = parseInt(e.dataTransfer?.getData('text/plain') || '0')
    emit('columnReorder', { fromIndex, toIndex: targetIndex })
}
```

### 3.2 列宽手动调整功能

#### 3.2.1 技术方案

- 在每列右侧添加可拖拽的调整手柄
- 使用鼠标事件监听拖拽过程
- 实时计算并应用列宽
- 设置最小/最大宽度限制

#### 3.2.2 交互设计

1. 鼠标悬停在列边界时显示调整光标（col-resize）
2. 拖拽时显示虚线指示器
3. 实时预览列宽变化
4. 支持双击重置为默认宽度

#### 3.2.3 核心实现逻辑

```typescript
const handleResizeStart = (e: MouseEvent, columnKey: string) => {
    const startX = e.clientX
    const startWidth = getCurrentColumnWidth(columnKey)

    const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startX
        const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + deltaX))
        updateColumnWidth(columnKey, newWidth)
    }

    const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        emit('columnResize', { columnKey, newWidth: getCurrentColumnWidth(columnKey) })
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
}
```

---

## 4. 数据存储格式设计

### 4.1 TypeScript 类型定义

#### 4.1.1 列配置类型

```typescript
export type TableColumnConfig = {
    key: keyof TaskColumnOptions
    label: string
    visible: boolean
    width: number | null
    minWidth: number
    maxWidth: number
    defaultWidth: number
}
```

#### 4.1.2 表格布局配置类型

```typescript
export type TableLayoutConfig = {
    columns: TableColumnConfig[]
    tableId: string
    version: string
    updatedAt: string
}
```

#### 4.1.3 事件类型

```typescript
export type ColumnReorderPayload = {
    fromIndex: number
    toIndex: number
}

export type ColumnResizePayload = {
    columnKey: keyof TaskColumnOptions
    newWidth: number
}

export type TableConfigEmits = {
    (e: 'columnReorder', payload: ColumnReorderPayload): void
    (e: 'columnResize', payload: ColumnResizePayload): void
    (e: 'columnVisibilityChange', key: keyof TaskColumnOptions, visible: boolean): void
    (e: 'resetTableConfig'): void
}
```

### 4.2 默认配置

#### 4.2.1 默认列配置

```typescript
export const DEFAULT_TABLE_COLUMNS: TableColumnConfig[] = [
    {
        key: 'name',
        label: '任务名称',
        visible: true,
        width: null,
        minWidth: 200,
        maxWidth: 600,
        defaultWidth: 300
    },
    {
        key: 'createdAt',
        label: '创建时间',
        visible: true,
        width: null,
        minWidth: 100,
        maxWidth: 200,
        defaultWidth: 120
    }
    // ... 其他列配置
]
```

### 4.3 后端数据格式建议

#### 4.3.1 数据库 Schema（PostgreSQL）

```sql
CREATE TABLE user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    preference_key VARCHAR(100) NOT NULL,
    preference_value JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, preference_key)
);
```

#### 4.3.2 示例数据

```sql
INSERT INTO user_preferences (user_id, preference_key, preference_value) VALUES
(
    'user-uuid-here',
    'task_table_layout_config',
    '{
        "tableId": "default",
        "version": "1.0.0",
        "updatedAt": "2024-01-15T10:30:00.000Z",
        "columns": [...]
    }'::jsonb
);
```

#### 4.3.3 API 接口设计

```typescript
// GET /api/user/preferences/task-table-layout
interface GetTableLayoutResponse {
    config: TableLayoutConfig | null
}

// PUT /api/user/preferences/task-table-layout
interface UpdateTableLayoutRequest {
    config: TableLayoutConfig
}

interface UpdateTableLayoutResponse {
    success: boolean
    config: TableLayoutConfig
}
```

---

## 5. 实施计划

### 5.1 阶段一：类型定义和配置管理

1. 更新 `types.ts` 添加新的类型定义
2. 创建 `use-column-config.ts` 组合式函数
3. 实现默认配置
4. 实现配置管理逻辑（获取、更新、重置）

### 5.2 阶段二：列排序功能

1. 修改 `table-header.vue` 添加拖拽功能
2. 实现拖拽开始、悬停、放置事件
3. 添加视觉反馈样式
4. 实现列顺序更新逻辑

### 5.3 阶段三：列宽调整功能

1. 修改 `table-header.vue` 添加调整手柄
2. 实现拖拽调整逻辑
3. 添加宽度限制验证
4. 实现双击重置功能

### 5.4 阶段四：样式和集成

1. 更新 `table.css` 添加新样式
2. 修改 `table-main.vue` 应用动态列宽
3. 更新 `use-table.ts` 集成新功能
4. 测试所有功能

### 5.5 文件变更清单

| 文件                   | 操作 | 说明                   |
| ---------------------- | ---- | ---------------------- |
| `types.ts`             | 修改 | 添加新类型定义         |
| `table-header.vue`     | 修改 | 添加拖拽排序和列宽调整 |
| `table-main.vue`       | 修改 | 应用动态列宽           |
| `use-table.ts`         | 修改 | 集成新功能             |
| `table.css`            | 修改 | 添加新样式             |
| `use-column-config.ts` | 新增 | 列配置管理             |

---

## 6. 注意事项

### 6.1 技术风险

- 列宽调整需要考虑响应式布局
- 拖拽排序需要处理边界情况
- 配置更新需要防抖处理

### 6.2 性能考虑

- 配置更新使用防抖，避免频繁请求
- 拖拽操作优化，减少重排重绘
- 本地缓存配置，减少后端请求

### 6.3 兼容性

- 向后兼容现有代码
- 版本号支持配置迁移
- 提供默认配置作为降级方案

---

## 7. 验收标准

- [ ] 所有现有功能正常工作
- [ ] 列排序功能正常（拖拽交换）
- [ ] 列宽调整功能正常（拖拽调整）
- [ ] 配置持久化正常（保存到后端）
- [ ] 配置重置功能正常
- [ ] 响应式布局正常
- [ ] 无 TypeScript 类型错误

---

## 8. 时间线

| 阶段                       | 预估时间   |
| -------------------------- | ---------- |
| 阶段一：类型定义和配置管理 | 1 小时     |
| 阶段二：列排序功能         | 1.5 小时   |
| 阶段三：列宽调整功能       | 1.5 小时   |
| 阶段四：样式和集成         | 1 小时     |
| 测试和调试                 | 1 小时     |
| **总计**                   | **6 小时** |