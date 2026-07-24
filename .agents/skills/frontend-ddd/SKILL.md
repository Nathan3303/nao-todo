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

- **Business logic is first-class citizen**: Domain models are pure TypeScript with no framework dependencies.
- **Vertical slicing first**: Organize code by Bounded Contexts, each with complete `domain/application/presentation` layers.
- **Framework as plugin**: Presentation layer adapts by framework, isolated through independent packages (`vue-domain-*`, `react-domain-*`).
- **Application layer as glue**: UseCase orchestrates domain operations; presentation layer composes multiple usecases for page functionality.
- **Infrastructure is replaceable**: Repository interfaces in domain layer, concrete implementations in infrastructure, switched via DI.

> **Rich Domain Model**: Entities should have private fields + behavior methods + computed getters. Business rules belong in entity methods, not in converters or VO.validate(). Store holds ViewObject (read model), Entity lives in UseCase scope (write model). See [refs/rich-domain-model.md](refs/rich-domain-model.md) for full guide.

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
│               Views Layer                  │
│   (apps/web, apps/miniapp)                │
│   - Compose composables & components      │
│   - Handle routing, layout, env config    │
└──────────────┬────────────────────────────┘
               │ uses
┌──────────────▼────────────────────────────┐
│          Presentation Adapters             │
│   (vue-domain-order, react-domain-order)  │
│   - Composables / Hooks                   │
│   - Domain-specific UI components         │
│   - Encapsulate UI state (loading, error) │
└──────────────┬────────────────────────────┘
               │ calls
┌──────────────▼────────────────────────────┐
│        Application Layer (usecases)        │
│   (domain-order/application)              │
│   - Application services: orchestrate     │
│   - Call domain services, repos, events   │
└──────────────┬────────────────────────────┘
               │ operates
┌──────────────▼────────────────────────────┐
│       Domain Layer (pure business)         │
│   (domain-order/domain)                   │
│   - Entities, value objects, domain events│
│   - Domain services (cross-aggregate)     │
│   - Port interfaces (repos, event bus)    │
└───────────────────────────────────────────┘
        depends on abstract     implements
┌──────────────▼──────────────┐
│      Infrastructure Layer    │
│   (infrastructure)          │
│   - HTTP client (Web/Mini)  │
│   - Repository impls        │
│   - Event bus               │
│   - IoC container           │
└─────────────────────────────┘
```

---

## Level 1: Lightweight (Small Projects)

### Entry Criteria

- < 5k LOC, 1-2 developers, 5-10 pages/features, simple data flow

### Minimal Structure

```text
src/
├── composables/          # Business logic in composables
├── services/             # API calls
├── types/                # Shared types
├── components/           # All components
├── views/                # Pages
└── main.ts
```

**Key Pattern**: Composable-based business logic. See [refs/patterns-level1.md](refs/patterns-level1.md).

### Graduation Signals

- Business logic scattered across components; duplicate API calls; team > 2; complex state management needed.

---

## Level 2: Basic DDD (Medium Projects)

### Entry Criteria

- 5k-20k LOC, 3-5 developers, 10-30 features, multiple related entities

### Minimal Structure

```text
src/
├── domains/
│   └── task/
│       ├── types/        # Domain types
│       ├── services/     # API layer
│       └── store/        # Pinia store
├── shared/
│   ├── components/       # Pure UI components
│   └── utils/
├── views/                # Pages
└── main.ts
```

### Domain Division Principles

1. **Based on business nouns (Bounded Context)**: Aggregate operations around core entities
2. **Identify Aggregate Roots**: Each domain should have at least one aggregate root
3. **Consider change frequency and coupling**: Group logic that changes together
4. **Clarify value**: Core domain (core competitiveness), supporting domain (supporting), generic domain (outsourceable)

**Key Pattern**: Pinia store with business rules. See [refs/patterns-level2.md](refs/patterns-level2.md).

### Graduation Signals

- Multiple domains with cross-cutting concerns; need for explicit cross-domain communication; testing becomes critical; complex business rules spanning domains; need to share components across multiple applications.

---

## Level 3: Full DDD (Large Projects)

### Entry Criteria

- > 20k LOC, 5+ developers, multiple domains, complex cross-domain workflows, multiple applications

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
├── application/               # Application layer
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

### Module Responsibilities

| Domain Module   | Responsibility                                                                                  |
| --------------- | ----------------------------------------------------------------------------------------------- |
| `entities/`     | Domain entities with **identity + behavior** (private fields, public methods, computed getters) |
| `valueobjects/` | Immutable; **Create\*VO** for creation validation, **Update\*VO** as pure DTO (no validate)     |
| `repositories/` | Repository interfaces; provide `get()` + `save(entity)` for rich model                          |
| `services/`     | Domain services (cross-aggregate logic, not single-entity CRUD)                                 |
| `events/`       | Domain event definitions                                                                        |
| `ports/`        | Abstract interfaces (IRepository, IEventBus)                                                    |

| Application Module | Responsibility                                            |
| ------------------ | --------------------------------------------------------- |
| `commands/`        | Command objects for write operations                      |
| `queries/`         | Query objects for read operations                         |
| `services/`        | Application services orchestrating domain operations      |
| `viewobjects/`     | DTOs for UI layer, convert domain entities to view models |

| Presentation Module | Responsibility                                             |
| ------------------- | ---------------------------------------------------------- |
| `components/`       | Domain-specific UI components                              |
| `store/`            | Pinia stores (state + getters + actions)                   |
| `composables/`      | Domain-specific composition logic with UI state            |
| `services/`         | API interactions (implementation of repository interfaces) |

### Dependency Rules

- ❌ Domains **cannot directly import** each other's store/types
- ✅ Presentation layer can depend on Domain + Application + Shared + Infrastructure
- ✅ Application layer can depend on Domain only
- ✅ Domain layer has **no external dependencies** (no Vue, no React)
- ✅ Cross-domain communication via **events** or **application layer coordinator**

### Key Patterns

| Pattern                               | Description                                                  | Reference                                                                      |
| ------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Cross-Domain Communication via Events | Event bus for decoupled communication                        | [refs/patterns-level3-key.md](refs/patterns-level3-key.md)                     |
| Domain Component Pattern              | Components depending on domain stores                        | [refs/patterns-level3-key.md](refs/patterns-level3-key.md)                     |
| Page Component Pattern (Thin Layer)   | Pages only orchestrate, no business logic                    | [refs/patterns-level3-key.md](refs/patterns-level3-key.md)                     |
| Presentation Adapter Pattern          | Framework-specific composables wrapping application services | [refs/patterns-level3-adapter.md](refs/patterns-level3-adapter.md)             |
| IoC Container Pattern                 | DI for repository and service implementations                | [refs/patterns-level3-ioc.md](refs/patterns-level3-ioc.md)                     |
| Store Base Hook Pattern               | `useMapperStoreBase<T>` with domain-specific naming          | [refs/patterns-level3-store-usecase.md](refs/patterns-level3-store-usecase.md) |
| Thin Store Pattern                    | Pinia store as thin wrapper around store base hook           | [refs/patterns-level3-store-usecase.md](refs/patterns-level3-store-usecase.md) |
| Store Responsibility Separation       | Data store vs session/UI state store                         | [refs/patterns-level3-store-usecase.md](refs/patterns-level3-store-usecase.md) |
| Store Interface in Application Layer  | Store interfaces in `viewobjects.ts`                         | [refs/patterns-level3-store-usecase.md](refs/patterns-level3-store-usecase.md) |
| Usecase Factory Function              | Factory hooks in `apps/{app}/src/hooks/usecases/`            | [refs/patterns-level3-store-usecase.md](refs/patterns-level3-store-usecase.md) |
| Callback Injection Pattern            | Setters instead of direct usecase imports in stores          | [refs/patterns-level3-store-usecase.md](refs/patterns-level3-store-usecase.md) |
| **Rich Domain Model**                 | Entities with behavior, CQRS-lite, entity caching            | [refs/rich-domain-model.md](refs/rich-domain-model.md)                         |

---

## Core Code Examples

### Domain Entity (Rich)

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
        if (this._status !== OrderStatus.Pending)
            throw new Error('Only pending orders can be modified')
        this._items.push(item)
        this.recalculateTotal()
    }

    place(): OrderPlaced {
        if (this._items.length === 0) throw new Error('Order must contain at least one item')
        this._status = OrderStatus.Placed
        return new OrderPlaced(this)
    }
}
```

### Application Service

```typescript
// packages/domain/order/src/application/services/OrderApplicationService.ts
export class OrderApplicationService {
    constructor(
        private orderRepo: IOrderRepository,
        private eventBus: IEventBus
    ) {}

    async placeOrder(cmd: PlaceOrderCommand): Promise<Order> {
        if (!cmd.items.length) throw new Error('Order items cannot be empty')
        const order = new Order(cmd.orderId, cmd.customerId, cmd.totalMoney, cmd.address)
        const event = order.place()
        await this.orderRepo.save(order)
        this.eventBus.publish(event)
        return order
    }
}
```

### Vue Composable (Presentation Adapter)

```typescript
// packages/presentation/vue-order/src/composables/usePlaceOrder.ts
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

### Page Usage (Glue Layer)

```vue
<!-- apps/web/src/pages/checkout/CheckoutPage.vue -->
<script setup lang="ts">
import { usePlaceOrder } from '@your-scope/vue-domain-order'
import { useCart } from '@your-scope/vue-domain-cart'

const { cartItems } = useCart()
const { execute: placeOrder, loading } = usePlaceOrder()

async function handleSubmit() {
    await placeOrder({ orderId: generateId(), customerId: '123', ... })
}
</script>
```

---

## Migration Path

### Level 1 → Level 2

1. Identify core business entities, group related logic
2. Create `domains/` folder
3. Move types, composables, services into domain subfolders
4. Replace composables with Pinia stores

### Level 2 → Level 3

1. Create `packages/domain/` — extract pure entities, valueobjects, repositories, services
2. Create `packages/application/` — extract usecases, viewobjects
3. Create `packages/presentation/` — extract components, stores, hooks as adapter packages
4. Create `packages/infrastructure/` — IoC container, HTTP clients, repository implementations
5. Configure pnpm workspace and tsconfig path aliases
6. Implement domain event system
7. Establish testing infrastructure

### Anemic → Rich Model

See [refs/rich-domain-model.md](refs/rich-domain-model.md) for step-by-step migration:

1. Make entity fields private, add getters for computed properties
2. Add behavior methods (rename, start, complete, giveUp, etc.)
3. Move UpdateVO.validate() logic into entity methods
4. Add `repo.save(entity)` to Repository interface
5. Add `entityCache` to UseCase for loaded entities
6. Simplify converter to only field mapping (no computation)

---

## Quick Start Guide

### Creating a New Domain (Level 3+)

See [refs/quick-start.md](refs/quick-start.md):

1. **Create domain layer** — entities, value objects, events, and repository interfaces
2. **Create application layer** — commands, queries, and application services
3. **Create presentation adapter** — composables, stores, and hooks
4. **Create domain components** — UI components specific to this domain
5. **Use in application** — page orchestration through presentation adapters
6. **Configure IoC container** — register repository and service implementations

### Component Ownership Decision

| Condition                         | Location                                         |
| --------------------------------- | ------------------------------------------------ |
| Depends on domain types           | `packages/presentation/vue-<domain>/components/` |
| No business meaning               | `packages/shared/components/`                    |
| Used by ≥2 domains                | `packages/shared/components/`                    |
| Need to share across applications | `packages/presentation/vue-<domain>/components/` |

---

## Forbidden Practices

- ❌ Direct state modification in components
- ❌ Domain imports in shared components
- ❌ Cross-domain store imports
- ❌ Business logic in page components
- ❌ Creating "common" technical stores
- ❌ Mixing domain models with frontend code in the same package
- ❌ Any frontend framework dependencies in `packages/domain/`
- ❌ Application services directly depending on Vue/Pinia
- ❌ **Anemic entities**: All-public fields, no behavior methods
- ❌ **Business rules in converters**: Computation in converter — should be entity getter
- ❌ **Business rules in UpdateValueObject.validate()**: Should be in entity methods
- ❌ **Entity as transient DTO**: Creating entity only to immediately convert to ViewObject

---

## Architecture Checklist

- [ ] No domains are divided by page
- [ ] All business logic is in store actions, not components
- [ ] No cross-domain direct imports of stores
- [ ] No store exceeds 500 lines (consider splitting)
- [ ] Shared components are truly reusable across domains
- [ ] Page components only do orchestration, no business if/else
- [ ] `packages/domain/` has no frontend dependencies
- [ ] `packages/shared/` contains only pure UI components and shared types
- [ ] Presentation layer adapters encapsulate UI state (loading, error)
- [ ] Application services are pure TypeScript with no framework dependencies
- [ ] **Entities are not anemic**: Private fields, behavior methods, computed getters
- [ ] **Converters are thin**: Only field mapping, all computation in entity getters
- [ ] **Entity lifecycle is meaningful**: UseCase loads entity, calls methods, saves

> See [refs/rich-domain-model.md](refs/rich-domain-model.md) for the full rich model checklist.

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

## Testing Strategy

| Layer        | Test Type       | Tools                   | Description                                                |
| ------------ | --------------- | ----------------------- | ---------------------------------------------------------- |
| domain       | Unit Tests      | Vitest                  | Pure logic, no Mock, test entity behavior, VO immutability |
| application  | Unit Tests      | Vitest + Mock repos     | Test use case flows, Mock repositories and event bus       |
| presentation | Component Tests | Vitest + Vue Test Utils | Test UI state logic, Mock application services             |
| pages        | E2E             | Playwright / Cypress    | Verify complete user flows                                 |

---

## Common FAQ

**Q1: Is DDD necessary if the business is simple?**
A: No. DDD is suitable for medium-to-large projects. Small projects can be organized by feature directories.

**Q2: Is Pinia store the domain model?**
A: Not exactly. Pinia store carries state and behavior as the implementation carrier. In Level 3+, the domain model is pure TypeScript in `packages/domain/`, completely separate from Pinia.

**Q3: Where should global state (theme, language) be placed?**
A: In `packages/presentation/user/store/`, as it is a business concept of user preferences.

**Q4: What's the difference between packages/domain/ and packages/presentation/?**
A: `packages/domain/` is pure domain model (no frontend dependencies); `packages/presentation/` is the frontend implementation (depends on Vue/Pinia).

**Q5: Should I put Entity in Pinia Store?**
A: No. Store holds ViewObject (read model). Entity lives in UseCase scope (write model). See [refs/rich-domain-model.md](refs/rich-domain-model.md).

**Q6: What's the difference between CreateValueObject and UpdateValueObject in a rich model?**
A: `CreateVO` still needs `validate()` — entity doesn't exist yet. `UpdateVO` should NOT have `validate()` — entity methods enforce rules. See [refs/rich-domain-model.md](refs/rich-domain-model.md).