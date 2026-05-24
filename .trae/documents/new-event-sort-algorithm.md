# Event 排序算法优化方案

## 问题分析

当前排序算法存在以下问题：

1. **只更新单个 Event 的 sortId**：容易导致 sortId 冲突
2. **sortId 可能重复**：多次排序后可能出现相同的 sortId
3. **排序不稳定**：当 sortId 相同时，排序结果不确定
4. **缺乏连续性**：sortId 不是连续的，不利于后续维护

## 后端 BatchUpdate API

后端提供了批量更新 API：

```go
// BatchUpdateEventRes 批量更新事件响应
type BatchUpdateEventRes struct {
    UpdatedCount int64           `json:"updatedCount"`
    Events       []*GetEventRes  `json:"events"`
}
```

## 新排序算法设计

### 核心思路

1. **本地先重新排序**：在前端先完成数组的重新排列
2. **批量更新 sortId**：为所有事件重新分配连续的 sortId
3. **调用后端 BatchUpdate API**：一次性提交所有更新
4. **更新本地状态**：使用后端返回的最新数据同步本地

### 算法步骤

```
1. 获取当前所有事件列表
2. 按当前 sortId 排序得到 sortedEvents
3. 找到 originalEvent 在 sortedEvents 中的索引 originalIndex
4. 找到 boundEvent 在 sortedEvents 中的索引 boundIndex
5. 从 sortedEvents 中移除 originalEvent
6. 计算新位置 newIndex：
   - 如果 originalIndex < boundIndex：
     - isBefore=true → newIndex = boundIndex - 1
     - isBefore=false → newIndex = boundIndex
   - 如果 originalIndex > boundIndex：
     - isBefore=true → newIndex = boundIndex
     - isBefore=false → newIndex = boundIndex + 1
7. 将 originalEvent 插入到 sortedEvents 的 newIndex 位置
8. 为 sortedEvents 中的每个事件重新分配 sortId（从 1 开始连续）
9. 调用后端 BatchUpdate API 批量更新所有事件
10. 使用后端返回的 Events 数据更新本地 store
```

## 实现步骤

### 1. 更新 EventDomain 接口
- 添加 `batchUpdate` 方法，对应后端 BatchUpdate API

### 2. 更新 EventStore 接口
- 确保 `events` 可访问
- 确保 `setEvents` 方法可用

### 3. 重写 EventUseCase.resort 方法
- 实现新的排序算法
- 调用 EventDomain.batchUpdate
- 使用后端返回的数据更新本地状态

### 4. 更新 EventRepository 实现
- 实现 batchUpdate 方法调用后端 API

## 文件修改清单

1. `packages/application/web/usecases/event.ts` - 重写 resort 方法
2. `domain/event` 层 - 添加 batchUpdate 方法
3. `infrastructure/backend/event/repoImpl.ts` - 实现 batchUpdate API 调用

## 技术细节

### 使用 BatchUpdate API

```typescript
// 1. 重新排列并分配 sortId
const sortedEvents = this.rearrangeEvents(originalId, boundId, isBefore)

// 2. 调用后端批量更新
const [batchResult, err] = await this.eventDomain.batchUpdate(sortedEvents)
if (err !== null) return err

// 3. 使用后端返回的数据更新本地
const updatedEvents = batchResult.Events.map(eventEntityToViewObject)
this.store.setEvents(updatedEvents)
this.store.setEventIds(updatedEvents.map(e => e.id))
```

### 边界情况处理

1. originalId === boundId - 不执行任何操作
2. 事件不存在 - 返回错误
3. 单个事件 - 不执行排序
4. 后端返回错误 - 直接返回错误，不修改本地状态

