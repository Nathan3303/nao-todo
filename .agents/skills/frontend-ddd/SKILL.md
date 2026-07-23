---
name: 'frontend-ddd'
description: 'Frontend Domain-Driven Design architecture guide based on Vue 3 + TypeScript + Pinia. Invoke when user wants to implement DDD, create new domains, or refactor project structure.'
---

# Frontend DDD Architecture Skill

## When Invoked

Follow this decision workflow:

1. **Assess project size** (lines of code, team size, feature count)
2. **Select appropriate DDD level** based on assessment
3. **Apply the minimal structure** for that level
4. **Provide code patterns** for the selected level
5. **Explain graduation criteria** for when to level up

---

## Core Concepts

- **Business logic is first-class citizen**: Domain models (entities, value objects, domain services) are pure TypeScript with no framework dependencies.
- **Vertical slicing first**: Organize code by Bounded Contexts (orders, products, customers), each with complete `domain/application/presentation` layers.
- **Framework as plugin**: Presentation layer (composables/hooks) adapts by framework, isolated through independent packages (`vue-domain-*`, `react-domain-*`), keeping the domain kernel pure.
- **Application layer as glue**: Application services are orchestrators for individual use cases; presentation layer combines multiple application services to build page functionality.
- **Infrastructure is replaceable**: Repository interfaces defined in domain layer, concrete implementations in infrastructure packages, switched via dependency injection (Web API / Mini Program / Local Storage).

---

## Architecture Overview

### Five Layers (Bottom-Up)

| Layer              | Responsibility                                                      | Example Directory                         |
| ------------------ | ------------------------------------------------------------------- | ----------------------------------------- |
| **Infrastructure** | Generic utilities, HTTP client, local storage, IoC container        | `packages/infrastructure/`, `src/shared/` |
| **Domain**         | Pure business logic, entities, value objects, repository interfaces | `packages/domain/`                        |
| **Application**    | Use cases, view objects, coordinators, application services         | `packages/application/`                   |
| **Presentation**   | Domain-specific components, stores, hooks, composables              | `packages/presentation/`, `src/domains/`  |
| **Views**          | Page orchestration, routing                                         | `apps/web/src/views/`, `src/app/`         |

**Dependency Direction**: Views → Presentation → Application → Domain → Infrastructure (one-way)

### Architecture Panorama

```text
┌───────────────────────────────────────────┐
│                   页面层                    │
│   (apps/web, apps/miniapp)                │
│   - 组装多个领域的 composable 和组件       │
│   - 处理路由、布局、环境配置               │
└──────────────┬────────────────────────────┘
               │ 使用
┌──────────────▼────────────────────────────┐
│            表现层适配器                     │
│   (vue-domain-order, react-domain-order)  │
│   - Composables / Hooks                   │
│   - 领域专用展示组件                       │
│   - 封装 UI 状态（loading, error）         │
└──────────────┬────────────────────────────┘
               │ 调用
┌──────────────▼────────────────────────────┐
│           应用层 (usecases)                 │
│   (domain-order/application)              │
│   - 应用服务：用例流程编排                  │
│   - 调用领域服务、仓储、事件                │
└──────────────┬────────────────────────────┘
               │ 操作
┌──────────────▼────────────────────────────┐
│           领域层 (纯业务)                   │
│   (domain-order/domain)                   │
│   - 实体、值对象、领域事件                  │
│   - 领域服务（跨聚合逻辑）                  │
│   - 端口接口（仓储、事件总线）              │
└───────────────────────────────────────────┘
        依赖抽象              实现抽象
┌──────────────▼──────────────┐
│      基础设施层              │
│   (infrastructure)          │
│   - HTTP 客户端（Web/小程序） │
│   - 仓储实现                 │
│   - 事件总线                 │
│   - IoC 容器                 │
└─────────────────────────────┘
```

---

## Monorepo Structure (Level 3+)

For large projects with multiple applications (Web, Desktop, Mini Program), use this monorepo structure:

```text
project-root/
├── apps/
│   ├── web/                  # Web C端 (Vue 3 + Vite)
│   ├── admin/                # 后台管理 (Vue 3)
│   └── miniapp/              # 小程序 (uni-app Vue 3)
│
├── packages/
│   ├── domain/               # 框架无关的领域内核（可发布 @scope/domain-order 等）
│   │   ├── order/
│   │   ├── catalog/
│   │   ├── customer/
│   │   └── payment/
│   │
│   ├── presentation/         # 框架特定的表现层适配器（可发布 @scope/vue-domain-order 等）
│   │   ├── vue-order/        # 依赖 domain/order + Vue 3
│   │   ├── vue-catalog/
│   │   └── ...
│   │
│   ├── shared/               # 前后端共享的纯类型与契约（可发布 @scope/shared）
│   │   ├── events/           # 领域事件名称和载荷类型
│   │   ├── dtos/             # API DTO 接口定义
│   │   └── index.ts
│   │
│   └── infrastructure/       # 通用基础设施接口与实现（可发布 @scope/infrastructure）
│       ├── api-client/       # HttpClient 接口 + Web/小程序实现
│       ├── repositories/     # 可选：通用仓储基类
│       ├── event-bus/        # 领域事件总线
│       └── ioc/              # 简易 IoC 容器
│
├── pnpm-workspace.yaml
├── turbo.json
├── package.json
└── tsconfig.base.json
```

**Toolchain**: pnpm workspace + Turborepo + TypeScript + ESLint + Prettier + Vitest.

### Domain Package Internal Structure (e.g., `packages/domain/order`)

```text
packages/domain/order/
├── src/
│   ├── domain/                    # 领域层（纯逻辑，零依赖）
│   │   ├── entities/
│   │   │   └── Order.ts
│   │   ├── value-objects/
│   │   │   ├── OrderStatus.ts
│   │   │   ├── Money.ts
│   │   │   └── Address.ts
│   │   ├── events/
│   │   │   └── OrderPlaced.ts
│   │   ├── services/
│   │   │   └── PricingService.ts  # 领域服务
│   │   └── ports/                 # 依赖的抽象接口（仓储、事件总线）
│   │       ├── IOrderRepository.ts
│   │       └── IEventBus.ts
│   │
│   ├── application/               # 应用层（用例编排，无框架依赖）
│   │   ├── commands/
│   │   │   └── PlaceOrderCommand.ts
│   │   ├── queries/
│   │   │   └── GetOrderDetailQuery.ts
│   │   └── services/
│   │       └── OrderApplicationService.ts
│   │
│   ├── index.ts                   # 对外暴露：领域对象、应用服务、端口接口、类型
│   └── package.json
```

**Important**: The domain package **does not contain any UI code** and has no `presentation` directory. Its `package.json` should only depend on pure utility libraries (like `date-fns`), never Vue/React.

### Presentation Layer Adapter Package (e.g., `packages/presentation/vue-order`)

```text
packages/presentation/vue-order/
├── src/
│   ├── composables/
│   │   ├── usePlaceOrder.ts       # 封装 PlaceOrder 用例的 UI 状态
│   │   ├── useOrderDetail.ts
│   │   └── useOrderList.ts
│   ├── components/                # 可选：领域专用的展示组件
│   │   ├── OrderStatusBadge.vue
│   │   └── OrderItemCard.vue
│   ├── index.ts
│   └── package.json
```

`package.json` declaration:

```json
{
    "name": "@your-scope/vue-domain-order",
    "peerDependencies": {
        "vue": "^3.0.0"
    },
    "dependencies": {
        "@your-scope/domain-order": "workspace:^",
        "@your-scope/infrastructure": "workspace:^"
    }
}
```

### Package Dependencies

```text
packages/domain/          # No external dependencies (pure TypeScript)
        ↑
packages/application/     # Depends on domain (inside domain package)
        ↑
packages/presentation/    # Depends on domain + application + infrastructure + shared
        ↑
packages/shared/          # No external dependencies
        ↑
packages/infrastructure/  # Depends on domain (implements interfaces)
        ↑
apps/web/                 # Depends on presentation adapters + shared
apps/admin/               # Depends on presentation adapters + shared
apps/miniapp/             # Depends on presentation adapters + shared
```

---

## Level 1: Lightweight (Small Projects)

### Entry Criteria

- < 5k LOC
- 1-2 developers
- 5-10 pages/features
- Simple data flow (mostly API → UI)

### Minimal Structure

```text
src/
├── composables/          # Business logic in composables
│   └── useTask.ts
├── services/             # API calls
│   └── taskApi.ts
├── types/                # Shared types
│   └── task.ts
├── components/           # All components
├── views/                # Pages
└── main.ts
```

### Key Pattern

**Composable-Based Business Logic**: Encapsulate business logic in Vue composables, called directly by components. See code examples in [refs/patterns-level1.md](refs/patterns-level1.md).

### Graduation Signals

- Business logic scattered across components
- Duplicate API calls in multiple places
- Team grows beyond 2 developers
- Complex state management needed

---

## Level 2: Basic DDD (Medium Projects)

### Entry Criteria

- 5k-20k LOC
- 3-5 developers
- 10-30 features
- Multiple related entities (Task + List + Tag)

### Minimal Structure

```text
src/
├── domains/
│   └── task/
│       ├── types/
│       │   └── index.ts
│       ├── services/
│       │   └── taskApi.ts
│       └── store/
│           └── useTaskStore.ts
├── shared/
│   ├── components/       # Pure UI components
│   └── utils/
├── views/                # Pages assemble domain components
└── main.ts
```

### Domain Division Principles

1. **Based on business nouns (Bounded Context)**: Aggregate operations around core entities
2. **Identify Aggregate Roots**: Each domain should have at least one aggregate root
3. **Consider change frequency and coupling**: Group logic that changes together
4. **Clarify value**: Core domain (core competitiveness), supporting domain (supporting), generic domain (outsourceable)

### Key Pattern

**Pinia Store with Business Rules**: Manage domain state and business rules using Pinia stores. See code examples in [refs/patterns-level2.md](refs/patterns-level2.md).

### Graduation Signals

- Multiple domains with cross-cutting concerns
- Need for explicit cross-domain communication
- Testing becomes critical
- Complex business rules spanning domains
- Need to share components across multiple applications

---

## Level 3: Full DDD (Large Projects)

### Entry Criteria

- > 20k LOC
- 5+ developers
- Multiple domains (task, user, payment, etc.)
- Complex cross-domain workflows
- Multiple applications (Web, Desktop, Mini Program)

### Full Structure (Monorepo)

```text
packages/
├── domain/                    # Pure domain layer
│   ├── task/
│   │   ├── entities/          # Task, TaskComment
│   │   ├── valueobjects/      # CreateTask, UpdateTask
│   │   ├── repositories/      # TaskRepository interface
│   │   └── services/          # TaskService (business rules)
│   └── user/
│       ├── entities/          # User, UserConfig
│       ├── valueobjects/      # UpdateNickname
│       ├── repositories/      # UserRepository interface
│       └── services/          # UserService
│
├── application/               # Application layer (inside domain package or separate)
│   ├── task/
│   │   ├── usecases/          # TaskUseCase
│   │   └── viewobjects/       # TaskViewObject, CreateTaskViewObject
│   └── user/
│       ├── usecases/          # UserUseCase
│       └── viewobjects/       # UserViewObject
│
├── presentation/              # Domain presentation layer adapters
│   ├── vue-task/
│   │   ├── components/        # TaskCard, TaskEditor, TaskList
│   │   ├── store/             # useTaskStore
│   │   ├── composables/       # useTaskFilters
│   │   └── services/          # taskApi
│   └── vue-user/
│       ├── components/        # UserAvatar, UserInfo
│       ├── store/             # useUserStore
│       └── services/          # userApi
│
└── shared/                    # Shared utilities
    ├── components/            # Pure UI components
    ├── utils/                 # Utility functions
    └── hooks/                 # Generic hooks
```

### Domain Module Responsibilities

| Module          | Responsibility                             |
| --------------- | ------------------------------------------ |
| `entities/`     | Domain entities with identity and behavior |
| `valueobjects/` | Immutable value objects                    |
| `repositories/` | Repository interfaces (no implementation)  |
| `services/`     | Domain services (pure business logic)      |
| `events/`       | Domain event definitions                   |
| `ports/`        | Abstract interfaces (IRepository, IEventBus) |

### Application Module Responsibilities

| Module         | Responsibility                                            |
| -------------- | --------------------------------------------------------- |
| `commands/`    | Command objects for write operations                      |
| `queries/`     | Query objects for read operations                         |
| `services/`    | Application services that orchestrate domain operations   |
| `viewobjects/` | DTOs for UI layer, convert domain entities to view models |

### Presentation Module Responsibilities

| Module         | Responsibility                                             |
| -------------- | ---------------------------------------------------------- |
| `components/`  | Domain-specific UI components                              |
| `store/`       | Pinia stores (state + getters + actions)                   |
| `composables/` | Domain-specific composition logic with UI state (loading, error) |
| `services/`    | API interactions (implementation of repository interfaces) |

### Dependency Rules

- ❌ Domains **cannot directly import** each other's store/types
- ✅ Presentation layer can depend on Domain + Application + Shared + Infrastructure
- ✅ Application layer can depend on Domain only
- ✅ Domain layer has **no external dependencies** (no Vue, no React)
- ✅ Cross-domain communication via **events** or **application layer coordinator**

### IoC Container Configuration

In `packages/infrastructure/ioc`, provide a simple container:

```typescript
export const container = new Container()
// Register implementations at app startup
container.register('IOrderRepository', () => new HttpOrderRepository(httpClient))
container.register('IEventBus', () => eventBusInstance)
container.register(
    'OrderApplicationService',
    () => new OrderApplicationService(container.get('IOrderRepository'), container.get('IEventBus'))
)
```

### Infrastructure Implementations (Platform Switching)

- `WebHttpClient` (based on `fetch`) → for Web applications
- `MiniappHttpClient` (based on `uni.request`) → for Mini Programs
  Inject different implementations through conditional compilation or runtime detection.

### Key Patterns

| Pattern                               | Description                                                              | Reference                                                  |
| ------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------- |
| Cross-Domain Communication via Events | Use event bus for decoupled communication between domains                | [refs/patterns-level3-key.md](refs/patterns-level3-key.md) |
| Domain Component Pattern              | Components that depend on domain stores and implement domain-specific UI | [refs/patterns-level3-key.md](refs/patterns-level3-key.md) |
| Page Component Pattern (Thin Layer)   | Page components only orchestrate domain components, no business logic    | [refs/patterns-level3-key.md](refs/patterns-level3-key.md) |
| Presentation Adapter Pattern          | Framework-specific composables wrapping pure application services        | [refs/patterns-level3-adapter.md](refs/patterns-level3-adapter.md) |
| IoC Container Pattern                 | Dependency injection for repository and service implementations          | [refs/patterns-level3-ioc.md](refs/patterns-level3-ioc.md) |

### Implementation Patterns (Store & UseCase)

| Pattern                              | Description                                                             | Reference                                                                      |
| ------------------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Store Base Hook Pattern              | Encapsulate `useMapperStoreBase<T>` to provide domain-specific naming   | [refs/patterns-level3-store-usecase.md](refs/patterns-level3-store-usecase.md) |
| Thin Store Pattern                   | Pinia store as thin wrapper around store base hook                      | [refs/patterns-level3-store-usecase.md](refs/patterns-level3-store-usecase.md) |
| Store Responsibility Separation      | Separate data store from session/UI state store                         | [refs/patterns-level3-store-usecase.md](refs/patterns-level3-store-usecase.md) |
| Store Interface in Application Layer | Define store interfaces in `viewobjects.ts` to decouple UseCase from UI | [refs/patterns-level3-store-usecase.md](refs/patterns-level3-store-usecase.md) |
| Usecase Factory Function             | Create usecase instances in hooks, injecting store implementations      | [refs/patterns-level3-store-usecase.md](refs/patterns-level3-store-usecase.md) |
| Callback Injection Pattern           | Expose setter functions instead of direct usecase imports in stores     | [refs/patterns-level3-store-usecase.md](refs/patterns-level3-store-usecase.md) |

### Publishing as npm Packages

**Publishing Strategy**:

- Domain kernel packages: `@your-scope/domain-order` (private/public both acceptable)
- Vue adapter packages: `@your-scope/vue-domain-order`
- Infrastructure packages: `@your-scope/infrastructure`
- Shared type packages: `@your-scope/shared`

**Key points in each package's `package.json`**:

```json
{
    "private": false,
    "main": "./dist/index.js",
    "module": "./dist/index.mjs",
    "types": "./dist/index.d.ts",
    "files": ["dist"],
    "scripts": {
        "build": "tsup src/index.ts --format cjs,esm --dts --clean",
        "prepublishOnly": "pnpm build"
    },
    "publishConfig": {
        "access": "public"
    }
}
```

**Version Management**: Use Changesets to manage multi-package versions and Changelog uniformly.

### Graduation Signals

- Monorepo needed for independent domain deployment
- Microservices backend architecture
- Domain-driven frontend with separate deployments
- Need to share domain packages across tech stacks

---

## Core Code Examples

### Domain Entity (Framework Agnostic)

```typescript
// packages/domain/order/src/domain/entities/Order.ts
export class Order {
    private _status: OrderStatus = OrderStatus.Pending
    private _items: OrderItem[] = []

    constructor(
        public readonly id: string,
        public readonly customerId: string,
        private _totalAmount: Money,
        private _address: Address
    ) {}

    addItem(item: OrderItem) {
        if (this._status !== OrderStatus.Pending) throw new Error('仅待支付订单可修改')
        this._items.push(item)
        this.recalculateTotal()
    }

    place(): OrderPlaced {
        if (this._items.length === 0) throw new Error('订单必须包含至少一件商品')
        this._status = OrderStatus.Placed
        return new OrderPlaced(this)
    }
    // ...other behaviors
}
```

### Application Service (Framework Agnostic)

```typescript
// packages/domain/order/src/application/services/OrderApplicationService.ts
import { IOrderRepository } from '../domain/ports/IOrderRepository'
import { IEventBus } from '../domain/ports/IEventBus'

export class OrderApplicationService {
    constructor(
        private orderRepo: IOrderRepository,
        private eventBus: IEventBus
    ) {}

    async placeOrder(cmd: PlaceOrderCommand): Promise<Order> {
        // Basic validation
        if (!cmd.items.length) throw new Error('订单项不能为空')
        // Create aggregate
        const order = new Order(cmd.orderId, cmd.customerId, cmd.totalMoney, cmd.address)
        // Execute domain behavior
        const event = order.place()
        // Persist
        await this.orderRepo.save(order)
        // Publish event
        this.eventBus.publish(event)
        return order
    }
}
```

### Vue Composable (Presentation Layer Adapter)

```typescript
// packages/presentation/vue-order/src/composables/usePlaceOrder.ts
import { ref } from 'vue'
import { PlaceOrderCommand, OrderApplicationService } from '@your-scope/domain-order'
import { useContainer } from '@your-scope/infrastructure/ioc'

export function usePlaceOrder() {
    const orderService = useContainer().get<OrderApplicationService>('OrderApplicationService')
    const loading = ref(false)
    const error = ref<Error | null>(null)

    async function execute(cmd: PlaceOrderCommand) {
        loading.value = true
        error.value = null
        try {
            return await orderService.placeOrder(cmd)
        } catch (e) {
            error.value = e as Error
            throw e
        } finally {
            loading.value = false
        }
    }

    return { execute, loading, error }
}
```

### Usage in Page (Glue Layer)

```vue
<!-- apps/web/src/pages/checkout/CheckoutPage.vue -->
<script setup lang="ts">
import { usePlaceOrder } from '@your-scope/vue-domain-order'
import { useCart } from '@your-scope/vue-domain-cart'

const { cartItems } = useCart()
const { execute: placeOrder, loading } = usePlaceOrder()

async function handleSubmit() {
    await placeOrder({
        orderId: generateId(),
        customerId: '123',
        totalMoney: cartTotal.value,
        address: selectedAddress.value
    })
}
</script>
```

---

## Migration Path

### Level 1 → Level 2

1. Identify core business entities and group related logic
2. Create `domains/` folder
3. Move types, composables, services into domain subfolders
4. Replace composables with Pinia stores

### Level 2 → Level 3

1. Create `packages/domain/` — extract pure entities, valueobjects, repositories, services
2. Create `packages/application/` — extract usecases, viewobjects (or keep inside domain package)
3. Create `packages/presentation/` — extract components, stores, hooks, services as framework-specific adapter packages
4. Create `packages/infrastructure/` — IoC container, HTTP clients, repository implementations
5. Configure pnpm workspace and tsconfig path aliases
6. Update import paths across the codebase
7. Implement domain event system
8. Establish testing infrastructure

### Mixed Structure → Layered Structure

If you have a mixed structure where domain, application, and presentation code are all in one folder:

1. **Phase 1: Identify and extract pure domain code**
    - Move entities, valueobjects, repositories, services to `packages/domain/`
    - Ensure no frontend dependencies

2. **Phase 2: Extract application layer**
    - Move usecases, viewobjects to `packages/application/` (or inside domain package)
    - Update imports to depend on `@nao-todo/domain`

3. **Phase 3: Extract presentation layer**
    - Move components, stores, hooks, services to `packages/presentation/vue-*/` adapter packages
    - Update imports to depend on `@nao-todo/domain` and `@nao-todo/application`

4. **Phase 4: Clean up shared layer**
    - Move domain-specific components from `packages/shared/` to `packages/presentation/`
    - Ensure shared only contains pure UI components and shared types

---

## Quick Start Guide

### Creating a New Domain (Level 3+)

See step-by-step code examples in [refs/quick-start.md](refs/quick-start.md):

1. **Create domain layer** — entities, value objects, events, and repository interfaces
2. **Create application layer** — commands, queries, and application services
3. **Create presentation adapter** — composables wrapping UI state (loading, error), stores, and hooks
4. **Create domain components** — UI components specific to this domain
5. **Use in application** — page orchestration through presentation adapters
6. **Configure IoC container** — register repository and service implementations

### Component Ownership Decision

| Condition                         | Location                                     |
| --------------------------------- | -------------------------------------------- |
| Depends on domain types           | `packages/presentation/vue-<domain>/components/` |
| No business meaning               | `packages/shared/components/`                |
| Used by ≥2 domains                | `packages/shared/components/`                |
| Need to share across applications | `packages/presentation/vue-<domain>/components/` |

### Forbidden Practices

- ❌ Direct state modification in components
- ❌ Domain imports in shared components
- ❌ Cross-domain store imports
- ❌ Business logic in page components
- ❌ Creating "common" technical stores
- ❌ Mixing domain models with frontend code in the same package
- ❌ Including domain-specific components in `packages/shared/`
- ❌ Any frontend framework dependencies in `packages/domain/`
- ❌ Application services directly depending on Vue/Pinia
- ❌ Presentation layer bypassing application services to call domain entities directly

---

## Testing Strategy

| Layer                         | Test Type           | Tools                    | Description                                            |
| ----------------------------- | ------------------- | ------------------------ | ------------------------------------------------------ |
| domain                        | Unit Tests          | Vitest                   | Pure logic, no Mock, test entity behavior, VO immutability |
| application                   | Unit Tests          | Vitest + Mock repositories| Test use case flows, Mock repositories and event bus |
| presentation (composables)    | Component Tests     | Vitest + Vue Test Utils  | Test UI state logic, Mock application services         |
| pages                         | E2E                 | Playwright / Cypress     | Verify complete user flows                             |

---

## Architecture Checklist

For code review, verify:

- [ ] No domains are divided by page
- [ ] All business logic is in store actions, not components
- [ ] No cross-domain direct imports of stores
- [ ] No store exceeds 500 lines (consider splitting)
- [ ] Shared components are truly reusable across domains
- [ ] Page components only do orchestration, no business if/else
- [ ] Domain types are strictly defined with TypeScript
- [ ] packages/domain/ has no frontend dependencies
- [ ] packages/presentation/ correctly depends on domain, application, and infrastructure
- [ ] packages/shared/ contains only pure UI components and shared types
- [ ] IoC container is properly configured for dependency injection
- [ ] Presentation layer adapters encapsulate UI state (loading, error)
- [ ] Application services are pure TypeScript with no framework dependencies

---

## Pinia Best Practices

- **Split stores by domain**: Each domain has its own store, avoid `useCommonStore`
- **Use Setup syntax**: `defineStore(id, () => { ... })`
- **Separate UI state from business state**: Use component `ref` or `useUiStore` for UI state
- **Avoid "god stores"**: Extract to `composables` or `services` when exceeding 500 lines
- **Stores should depend on UseCases**: Operate domain models through UseCases, avoid direct manipulation
- **Thin Store Pattern**: Pinia store should be a thin wrapper around store base hooks
- **Store Base Hook Pattern**: Encapsulate `useMapperStoreBase<T>` to provide domain-specific naming

---

## Core Advantages

- **Business assets reusable across projects**: Domain packages can be installed via npm in any Web, Mini Program, or even Node.js backend.
- **Complete decoupling of UI and business**: Changing frontend frameworks only requires rewriting the presentation layer adapter packages; domain and application layers require zero changes.
- **Parallel team development**: Domain experts maintain `domain-*`, UI teams maintain `vue-domain-*` and pages, no blocking each other.
- **Compliant with DDD Bounded Context philosophy**: Each domain package is a highly cohesive independent unit that can evolve and be published independently.

---

## Extension Suggestions

- **Domain Events**: Use `mitt` or `EventEmitter` for pub/sub pattern
- **Micro-frontends**: Each sub-app can have its own `domains/` or share `packages/presentation/`
- **Type-safe APIs**: Use OpenAPI or Zod for type-safe API contracts
- **Changesets**: Manage multi-package versions and Changelog
- **Turborepo**: Cache build outputs for monorepo efficiency

---

## Common FAQ

**Q1: Is DDD necessary if the business is simple?**
A: No. DDD is suitable for medium-to-large projects. Small projects can be organized by feature directories, but maintain the principle of logical cohesion.

**Q2: Is Pinia store the domain model?**
A: Not exactly. Pinia store carries state and behavior, serving as the implementation carrier of the domain model. Complex rules should be placed in Domain Service or UseCase. In Level 3+, the domain model is pure TypeScript in `packages/domain/`, completely separate from Pinia.

**Q3: How to divide domains and subdomains?**
A: A business module is a bounded context. Strongly related sub-modules can be placed in sub-directories within a domain, but avoid deep nesting.

**Q4: Where should global state (theme, language) be placed?**
A: In `packages/presentation/user/store/`, as it is a business concept of user preferences.

**Q5: How to share components with business logic across applications?**
A: Create a `packages/presentation/vue-*/` package dedicated to domain presentation layer code (components, stores, composables), which can be shared by multiple applications (Web, Desktop, Mini Program).

**Q6: What's the difference between packages/domain/ and packages/presentation/?**
A: packages/domain/ is pure domain model (no frontend dependencies) and can be used by any tech stack; packages/presentation/ is the frontend implementation of the domain (depends on Vue/Pinia) and can only be used by Vue applications.

**Q7: Why separate domain and presentation packages?**
A: This enables true framework independence. When migrating from Vue 3 to React (or a future framework), only the presentation adapter packages need to be rewritten - the entire domain and application layers remain completely unchanged. This also allows sharing business logic across different frontend applications (Web, Mini Program, Desktop) with a single domain kernel.
