# IndexedDB 优先存储实现计划

## 实现范围

本次实现仅包含 **Task 模块** 的 IndexedDB 优先存储功能。其他模块（Project、Tag、Event、Comment）将在后续迭代中实现。

### 关键变更总结
- ✅ 专注于 Task 模块的所有操作
- ✅ 冲突处理策略：Last Write Wins（谁更新谁优先）
- ✅ 简化实现范围，快速验证方案可行性

## 概述

实现前端 IndexedDB 优先存储，再通过后端 API 异步同步到数据库的功能，提供离线优先的用户体验。

## 当前架构分析

### 现有技术栈
- 前端框架: Vue 3
- 状态管理: Pinia
- 语言: TypeScript
- HTTP 客户端: Axios
- 架构模式: DDD (Domain-Driven Design)

### 现有数据流程
1. 用户操作 -> 调用 Handler
2. Handler -> 调用 UseCase
3. UseCase -> 调用 Domain Service
4. Domain Service -> 调用 Repository (Backend API)
5. 响应返回 -> 更新 Store -> UI 更新

## 实现方案

### 核心思路
1. **写入流程**: 用户操作 -> 立即更新 UI + IndexedDB -> 后台异步同步到后端
2. **读取流程**: 优先从 IndexedDB 读取 -> 同时从后端获取最新数据并更新
3. **冲突处理**: 谁更新谁优先（Last Write Wins），基于 updatedAt 时间戳
4. **同步状态**: 显示数据同步状态（本地未同步/同步中/已同步）

### 新增模块

#### 1. IndexedDB 基础设施 (`packages/infrastructure/indexeddb/`)
- `db.ts`: IndexedDB 数据库初始化和配置
- `repositories/`: Task 实体的 IndexedDB Repository 实现
  - `task-repo.ts`
- `sync-queue.ts`: 同步队列管理
- `types.ts`: IndexedDB 相关类型定义

#### 2. 同步服务 (`packages/infrastructure/sync/`)
- `sync-service.ts`: 核心同步服务
- `conflict-resolver.ts`: 冲突解决器
- `sync-status.ts`: 同步状态管理

#### 3. 更新 Application 层 (`packages/application/web/usecases/`)
- 修改 Task UseCase，集成 IndexedDB 优先逻辑
- 新增同步 UseCase

#### 4. 更新前端 Stores (`apps/web/src/stores/`)
- 添加同步状态到 Tasks Store
- 支持从 IndexedDB 初始化数据

## 详细实现步骤

### 阶段一: IndexedDB 基础设施搭建（Task 模块）

#### 1.1 创建 IndexedDB 配置和数据库初始化
- 定义数据库名称、版本
- 定义 Task 对象仓库和 SyncOperation 对象仓库
- 实现数据库打开/升级逻辑

#### 1.2 实现基础 Repository 接口
- 定义通用的 CRUD 接口
- 实现基类 Repository

#### 1.3 实现 Task Repository
- Task 的增删改查操作
- 支持同步状态标记

### 阶段二: 同步队列和同步服务（Task 模块）

#### 2.1 实现同步队列
- 使用 IndexedDB 存储待同步操作
- 支持 Task 的操作类型：CREATE、UPDATE、DELETE
- 记录操作时间戳和状态

#### 2.2 实现同步服务
- 队列轮询机制
- 单个 Task 操作同步逻辑
- 网络状态监听（离线/在线）
- 重试机制（指数退避）

#### 2.3 实现冲突解决器
- 检测数据冲突（基于 updatedAt）
- Last Write Wins 策略（谁更新谁优先）
- 记录冲突日志

### 阶段三: 集成到现有架构（Task 模块）

#### 3.1 创建 Hybrid Task Repository
- 组合 IndexedDB Task Repository 和 Backend Task Repository
- 实现读取优先从 IndexedDB，同时后台刷新
- 实现写入先到 IndexedDB，再加入同步队列

#### 3.2 更新 Task Domain Service
- 注入 Hybrid Task Repository
- 保持现有接口不变

#### 3.3 更新 Task UseCases
- 调整 Task UseCases 以支持同步状态通知
- 添加同步状态管理

### 阶段四: 前端集成（Task 模块）

#### 4.1 更新 Tasks Store
- 添加同步状态字段
- 支持从 IndexedDB 初始化
- 监听同步状态变化

#### 4.2 更新 Task Handler
- 保持现有 Handler 接口
- 添加同步状态反馈

#### 4.3 UI 优化
- 添加同步状态指示器
- 离线提示

## 数据模型设计

### 同步操作记录 (SyncOperation)
```typescript
interface SyncOperation {
  id: string
  entityType: 'task'
  operationType: 'create' | 'update' | 'delete'
  entityId: string
  data: any
  status: 'pending' | 'syncing' | 'failed' | 'completed'
  createdAt: Date
  updatedAt: Date
  retryCount: number
  error?: string
}
```

### 实体扩展字段
```typescript
interface IndexedDBEntity {
  _localId?: string
  _syncStatus: 'local' | 'syncing' | 'synced' | 'conflict'
  _lastSyncedAt?: Date
}
```

## 关键技术点

1. **ID 生成**: 本地创建时使用临时 ID，同步后替换为服务端 ID
2. **乐观锁**: 使用 updatedAt 进行冲突检测
3. **幂等性**: 确保同步操作可重试而不会产生副作用
4. **网络状态**: 使用 `navigator.onLine` 监听网络变化
5. **后台同步**: 考虑使用 Background Sync API（可选）

## 风险和注意事项

1. **数据一致性**: 需要确保 IndexedDB 和后端数据最终一致
2. **存储空间**: IndexedDB 有存储限制，需要考虑数据清理策略
3. **性能**: 大量数据同步时需要考虑性能优化
4. **测试**: 需要充分测试离线场景和冲突场景
5. **迁移**: 需要考虑现有用户数据迁移方案
