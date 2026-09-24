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

## UI/UX 落地（通用，不绑定具体组件库）

> 两个单一事实来源：**Design Tokens**（视觉）+ **UX Playbook**（交互）。
> 组件只允许消费令牌与 playbook 约定，硬编码/自造即违规。

### 单一事实来源

- **Design Tokens**：`tokens.css`，命名空间 `--<prefix>-*`（颜色/间距/圆角/阴影/字号/动效）。任何情形下都是视觉唯一来源。
- **UX Playbook**：`ux-playbook.md`——用户想要的 UX 的可执行定义：页面四态（加载/空/错误/成功）、反馈模式（Toast/确认/骨架屏）、空态文案、表单校验时机、加载位置、键盘导航。**落地代码的唯一交互依据，不临场发明**。

### 按技术栈落地

| 情形 | 令牌 | UX | 组件 |
| :--- | :--- | :--- | :--- |
| 组件库+主题（NueUI+shadlike） | 用库令牌（如 `--nue-*`），缺口补 tokens.css | 用库语义组件/属性 | 库原语优先，不新造 |
| 组件库无主题 | 自建 tokens.css，对齐/覆盖库变量 | 用库语义组件/属性 | 库原语优先 |
| 纯手写 | **必建** tokens.css | **必建** ux-playbook.md | 自建基础组件按 playbook |

### 红线（任何情形）

- 组件/样式禁裸色值（`#fff`/`rgba(...)`）、禁无令牌的魔法尺寸/圆角/阴影——一律 `var(--<prefix>-*)`；仅 tokens.css 允许定义令牌。
- 新 UI 用既有原语/基础组件组装；页面不另起风格。
- **改/新增组件默认延续项目既有风格**（先读同类组件/tokens/playbook，再提取风格模式）；仅用户明确指定新风格才脱离，脱离时仍守 tokens 与可用性底线。
- 四态与反馈模式严格按 UX Playbook；交互变更须 PM/用户确认。
- 交付前：`bash "$NAO_SKILLS/.agents/scripts/ui-tokens-check.sh" <repo>`（进 CI 则自动拦截）。

### 模板

- `tokens.css` 骨架 + `ux-playbook.md` 骨架：`@.agents/templates/frontend-ui/`（复制到项目按需裁剪）。

## 测试

Domain：Vitest 纯单测；Application：Mock 端口；Infra：MSW；Pres：VTU/Testing-Library

## 误区

- DDD ≠ 重框架；规模不到 L1 用 DDD 反是负担
- 把业务规则写进 store 或组件
- 让 DTO 直接进 Domain
- 让 Store 调多个仓储做编排（应下沉 UseCase）
