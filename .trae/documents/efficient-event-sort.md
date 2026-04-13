# 高效 Event 排序方案

## 问题分析

当前方案的问题：
- 每次排序都更新所有事件的 sortId
- 十几个检查事项就要更新十几条数据
- 不必要的数据库开销

## 更高效的排序方案

### 方案：浮动间隔排序法

#### 核心思路

1. **初始分配大间隔**：初始时 sortId 间隔为 1000（如 1000, 2000, 3000...）
2. **插入时取中间值**：在两个 sortId 之间取中间值作为新 sortId
3. **阈值触发重建**：当间隔小于 1 时，才触发批量重新分配

#### 优势

- **99% 的情况只更新 1 条数据**
- **减少数据库写入**
- **保持排序稳定性**
- **实现简单**

## 算法步骤

### 1. 检查间隔是否足够

```typescript
// 获取被拖拽事件和目标事件
const originalEvent = this.store.getEvent(originalId)
const boundEvent = this.store.getEvent(boundId)

// 获取所有事件并排序
const sortedEvents = [...eventsValue].sort((a, b) => a.sortId - b.sortId)

// 找到位置
const originalIndex = sortedEvents.findIndex(e => e.id === originalId)
const boundIndex = sortedEvents.findIndex(e => e.id === boundId)

// 计算新位置
// ... (同前)

// 确定相邻的两个事件
let prevEvent: EventViewObject | null = null
let nextEvent: EventViewObject | null = null

if (newIndex === 0) {
    // 插入到最前面
    nextEvent = sortedEvents[0]
} else if (newIndex === sortedEvents.length) {
    // 插入到最后面
    prevEvent = sortedEvents[sortedEvents.length - 1]
} else {
    // 插入到中间
    prevEvent = sortedEvents[newIndex - 1]
    nextEvent = sortedEvents[newIndex]
}

// 计算新的 sortId
let newSortId: number

if (!prevEvent) {
    // 插入到最前面
    newSortId = nextEvent!.sortId - 1000
} else if (!nextEvent) {
    // 插入到最后面
    newSortId = prevEvent.sortId + 1000
} else {
    // 插入到中间，取平均值
    newSortId = (prevEvent.sortId + nextEvent.sortId) / 2
}

// 检查间隔是否太小
const needsRebuild = prevEvent && nextEvent && 
    Math.abs(nextEvent.sortId - prevEvent.sortId) < 2

if (needsRebuild) {
    // 间隔太小，触发重建
    return this.resortWithRebuild(originalId, boundId, isBefore)
} else {
    // 只更新单个事件
    return this.resortSingle(originalId, newSortId)
}
```

### 2. 单事件更新（99% 的情况）

```typescript
async resortSingle(originalId: string, newSortId: number): GoAsync<void> {
    // 乐观更新本地
    this.store.updateEvent(originalId, { sortId: newSortId })
    
    // 更新后端
    const [, err] = await this.update(originalId, { sortId: newSortId })
    if (err !== null) return err
    
    return null
}
```

### 3. 重建排序（间隔太小时触发）

```typescript
async resortWithRebuild(
    originalId: string,
    boundId: string,
    isBefore: boolean
): GoAsync<void> {
    // 使用原来的批量重建方案
    // ... 重新分配所有 sortId 为 1000, 2000, 3000...
}
```

## 初始数据优化

### 创建事件时

```typescript
// 创建新事件时，sortId = 当前最大 sortId + 1000
const maxSortId = Math.max(...events.map(e => e.sortId), 0)
const newEventSortId = maxSortId + 1000
```

### 加载事件时

如果发现 sortId 间隔太小，可以自动重建：

```typescript
async loadEvents(taskId: string): GoAsync<EventViewObject['id'][]> {
    const [eventEntities, err] = await this.eventDomain.list(taskId)
    if (err !== null) return [null, err]
    
    let events = eventEntities.map(eventEntityToViewObject)
    
    // 检查是否需要重建
    const needsRebuild = this.checkNeedsRebuild(events)
    if (needsRebuild) {
        events = this.rebuildSortIds(events)
        // 可选：同步到后端
    }
    
    const eventIds = events.map((event) => event.id)
    this.store.setEvents(events)
    this.store.setEventIds(eventIds)
    return [eventIds, null]
}
```

## 优势对比

| 方案 | 平均更新次数 | 实现复杂度 | 推荐度 |
|------|------------|----------|--------|
| 当前方案（每次全量） | N | 低 | ⭐⭐ |
| 浮动间隔方案 | 1 (偶尔 N) | 中 | ⭐⭐⭐⭐⭐ |
| 链表方案（prevId/nextId） | 2-3 | 高 | ⭐⭐⭐ |

## 实现步骤

1. 修改 EventUseCase.resort 方法，实现浮动间隔逻辑
2. 添加 resortSingle 方法处理单事件更新
3. 添加 resortWithRebuild 方法处理重建场景
4. 优化 create 方法，使用大间隔创建新事件
5. （可选）优化 loadEvents 方法，自动检测并重建

## 文件修改清单

1. `packages/application/web/usecases/event.ts` - 重写 resort 方法，添加浮动间隔逻辑

