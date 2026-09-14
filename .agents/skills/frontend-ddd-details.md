---
description: 按需技能——前端 DDD 骨架、场景速决、命名、误区
---

# 前端 DDD 详细规范

## 标准骨架

```ts
// Domain 实体
class Task {
  complete() {
    if (overdue) throw new DomainError()
    this.status = 'done'
  }
}

// 用例（依赖接口）
class UseCase {
  constructor(repo, gateway) {}
  async exec(id) {
    const e = await repo.find(id)
    e.complete()
    await repo.save(e)
    this.gateway.update(e)
  }
}

// DI 组装点（Composable/Hook）
function useX() {
  const store = useStore()
  const uc = new UseCase(new HttpRepo(), store)
  return { ... }
}

// Mapper（Infra 层）
class Mapper {
  static toEntity(dto): Entity
  static toDto(entity): Dto
}
```

## 场景速决

- **路由**：Views 仅透传 `params` 给 Hook；禁 `onMounted` 直接调 API/用例
- **筛选/分页**：属 UI 状态（UI Store/局部），传纯 DTO 给用例；禁传 `ref` 响应式对象
- **表单**：UI 只做轻校验（必填/格式）；复杂规则放实体 `validate()`；UI 捕获 `DomainError` 映射回表单
- **错误**：用例统一转 `DomainError`/`InfraError`；UI 通过 `useErrorHandler` 映射 Toast（禁 `alert`）
- **WebSocket**：消息 → 领域事件 → `SyncUseCase` → 更新 Store；禁 `socket.on` 直改 Store
- **API 类型生成（OpenAPI）**：生成的 DTO 仅限 Infra，必须经 Mapper 转实体进 Domain
- **性能**：Store 存 Map/Record；组件用 Selector 取子集；禁全量解构 Store

## 命名

`I{Entity}Repository` / `{Entity}HttpRepo` / `{Entity}UseCase` / `{Entity}Dto` + `Mapper` / `useXxx`

## 测试

Domain：Vitest 纯单测；Application：Mock 端口；Infra：MSW；Pres：VTU/Testing-Library

## 误区

- DDD ≠ 重框架；规模不到 L1 用 DDD 反是负担
- 把业务规则写进 store 或组件
- 让 DTO 直接进 Domain
- 让 Store 调多个仓储做编排（应下沉 UseCase）