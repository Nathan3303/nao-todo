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

## Architecture Overview

### Five Layers (Bottom-Up)

| Layer              | Responsibility                                                      | Example Directory                         |
| ------------------ | ------------------------------------------------------------------- | ----------------------------------------- |
| **Infrastructure** | Generic utilities, HTTP client, local storage                       | `packages/infrastructure/`, `src/shared/` |
| **Domain**         | Pure business logic, entities, value objects, repository interfaces | `packages/domain/`                        |
| **Application**    | Use cases, view objects, coordinators                               | `packages/application/`                   |
| **Presentation**   | Domain-specific components, stores, hooks                           | `packages/presentation/`, `src/domains/`  |
| **Views**          | Page orchestration, routing                                         | `src/views/`, `src/app/`                  |

**Dependency Direction**: Views → Presentation → Application → Domain → Infrastructure (one-way)

---

## Monorepo Structure (Level 3+)

For large projects with multiple applications (Web, Desktop, Mobile), use this monorepo structure:

```text
project-root/
├── packages/                          # Shared packages
│   ├── domain/                        # Pure domain layer
│   │   ├── task/
│   │   │   ├── entities/              # Task, TaskComment
│   │   │   ├── valueobjects/          # CreateTask, UpdateTask
│   │   │   ├── repositories/          # Repository interfaces
│   │   │   └── services/              # Domain services
│   │   └── ...
│   │
│   ├── application/                   # Application layer
│   │   ├── task/
│   │   │   ├── usecases/              # TaskUseCase
│   │   │   └── viewobjects/           # TaskViewObject
│   │   └── ...
│   │
│   ├── presentation/                  # Domain presentation layer
│   │   ├── task/
│   │   │   ├── components/            # TaskCard, TaskEditor
│   │   │   ├── store/                 # useTaskStore
│   │   │   ├── composables/           # useTaskFilters
│   │   │   └── services/              # API calls
│   │   └── ...
│   │
│   ├── infrastructure/                # Infrastructure layer
│   │   └── repositories/               # Repository implementations
│   │
│   └── shared/                        # Shared utilities
│       ├── components/                 # Pure UI components (Button, Input)
│       ├── utils/                     # Utility functions
│       └── hooks/                     # Generic hooks (useDebounce)
│
└── apps/
    ├── web/                           # Web application
    │   └── src/
    │       ├── app/                   # Router, plugins
    │       ├── views/                 # Pages
    │       └── main.ts
    └── desktop/                       # Desktop application
        └── src/
            ├── app/
            ├── views/
            └── main.ts
```

### Package Dependencies

```text
packages/domain/          # No external dependencies (pure TypeScript)
        ↑
packages/application/     # Depends on domain
        ↑
packages/presentation/    # Depends on domain + application + shared
        ↑
packages/shared/          # No external dependencies
        ↑
packages/infrastructure/  # Depends on domain
        ↑
apps/web/                 # Depends on presentation + shared
apps/desktop/             # Depends on presentation + shared
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
- Multiple applications (Web, Desktop, Mobile)

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
├── presentation/              # Domain presentation layer
│   ├── task/
│   │   ├── components/        # TaskCard, TaskEditor, TaskList
│   │   ├── store/             # useTaskStore
│   │   ├── composables/       # useTaskFilters
│   │   └── services/          # taskApi
│   └── user/
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

### Application Module Responsibilities

| Module         | Responsibility                                            |
| -------------- | --------------------------------------------------------- |
| `usecases/`    | Application services that orchestrate domain operations   |
| `viewobjects/` | DTOs for UI layer, convert domain entities to view models |

### Presentation Module Responsibilities

| Module         | Responsibility                                             |
| -------------- | ---------------------------------------------------------- |
| `components/`  | Domain-specific UI components                              |
| `store/`       | Pinia stores (state + getters + actions)                   |
| `composables/` | Domain-specific composition logic                          |
| `services/`    | API interactions (implementation of repository interfaces) |

### Dependency Rules

- ❌ Domains **cannot directly import** each other's store/types
- ✅ Presentation layer can depend on Domain + Application + Shared
- ✅ Application layer can depend on Domain
- ✅ Domain layer has **no external dependencies**
- ✅ Cross-domain communication via **events** or **application layer coordinator**

### Key Patterns

| Pattern                               | Description                                                              | Reference                                                  |
| ------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------- |
| Cross-Domain Communication via Events | Use event bus for decoupled communication between domains                | [refs/patterns-level3-key.md](refs/patterns-level3-key.md) |
| Domain Component Pattern              | Components that depend on domain stores and implement domain-specific UI | [refs/patterns-level3-key.md](refs/patterns-level3-key.md) |
| Page Component Pattern (Thin Layer)   | Page components only orchestrate domain components, no business logic    | [refs/patterns-level3-key.md](refs/patterns-level3-key.md) |

### Implementation Patterns (Store & UseCase)

| Pattern                              | Description                                                             | Reference                                                                      |
| ------------------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Store Base Hook Pattern              | Encapsulate `useMapperStoreBase<T>` to provide domain-specific naming   | [refs/patterns-level3-store-usecase.md](refs/patterns-level3-store-usecase.md) |
| Thin Store Pattern                   | Pinia store as thin wrapper around store base hook                      | [refs/patterns-level3-store-usecase.md](refs/patterns-level3-store-usecase.md) |
| Store Responsibility Separation      | Separate data store from session/UI state store                         | [refs/patterns-level3-store-usecase.md](refs/patterns-level3-store-usecase.md) |
| Store Interface in Application Layer | Define store interfaces in `viewobjects.ts` to decouple UseCase from UI | [refs/patterns-level3-store-usecase.md](refs/patterns-level3-store-usecase.md) |
| Usecase Factory Function             | Create usecase instances in hooks, injecting store implementations      | [refs/patterns-level3-store-usecase.md](refs/patterns-level3-store-usecase.md) |
| Callback Injection Pattern           | Expose setter functions instead of direct usecase imports in stores     | [refs/patterns-level3-store-usecase.md](refs/patterns-level3-store-usecase.md) |

### Graduation Signals

- Monorepo needed for independent domain deployment
- Microservices backend architecture
- Domain-driven frontend with separate deployments

---

## Migration Path

### Level 1 → Level 2

1. Identify core business entities and group related logic
2. Create `domains/` folder
3. Move types, composables, services into domain subfolders
4. Replace composables with Pinia stores

### Level 2 → Level 3

1. Create `packages/domain/` — extract pure entities, valueobjects, repositories, services
2. Create `packages/application/` — extract usecases, viewobjects
3. Create `packages/presentation/` — extract components, stores, hooks, services
4. Configure pnpm workspace and tsconfig path aliases
5. Update import paths across the codebase
6. Implement domain event system
7. Establish testing infrastructure

### Mixed Structure → Layered Structure

If you have a mixed structure where domain, application, and presentation code are all in one folder:

1. **Phase 1: Identify and extract pure domain code**
    - Move entities, valueobjects, repositories, services to `packages/domain/`
    - Ensure no frontend dependencies

2. **Phase 2: Extract application layer**
    - Move usecases, viewobjects to `packages/application/`
    - Update imports to depend on `@nao-todo/domain`

3. **Phase 3: Extract presentation layer**
    - Move components, stores, hooks, services to `packages/presentation/`
    - Update imports to depend on `@nao-todo/domain` and `@nao-todo/application`

4. **Phase 4: Clean up shared layer**
    - Move domain-specific components from `packages/shared/` to `packages/presentation/`
    - Ensure shared only contains pure UI components

---

## Quick Start Guide

### Creating a New Domain (Level 3+)

See step-by-step code examples in [refs/quick-start.md](refs/quick-start.md):

1. **Create domain layer** — entities and repository interfaces
2. **Create application layer** — usecases and viewobjects
3. **Create presentation layer** — stores and hooks
4. **Create domain component** — UI components
5. **Use in application** — page orchestration

### Component Ownership Decision

| Condition                         | Location                                     |
| --------------------------------- | -------------------------------------------- |
| Depends on domain types           | `packages/presentation/<domain>/components/` |
| No business meaning               | `packages/shared/components/`                |
| Used by ≥2 domains                | `packages/shared/components/`                |
| Need to share across applications | `packages/presentation/<domain>/components/` |

### Forbidden Practices

- ❌ Direct state modification in components
- ❌ Domain imports in shared components
- ❌ Cross-domain store imports
- ❌ Business logic in page components
- ❌ Creating "common" technical stores
- ❌ Mixing domain models with frontend code in the same package
- ❌ Including domain-specific components in `packages/shared/`

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
- [ ] packages/presentation/ correctly depends on domain and application
- [ ] packages/shared/ contains only pure UI components

---

## Pinia Best Practices

- **Split stores by domain**: Each domain has its own store, avoid `useCommonStore`
- **Use Setup syntax**: `defineStore(id, () => { ... })`
- **Separate UI state from business state**: Use component `ref` or `useUiStore` for UI state
- **Avoid "god stores"**: Extract to `composables` or `services` when exceeding 500 lines
- **Stores should depend on UseCases**: Operate domain models through UseCases, avoid direct manipulation

---

## Extension Suggestions

- **Testing Strategy**: Unit tests for domain services with vitest, integration tests for use cases, component tests for presentation layer
- **Domain Events**: Use `mitt` or `EventEmitter` for pub/sub pattern
- **Micro-frontends**: Each sub-app can have its own `domains/` or share `packages/presentation/`
- **Type-safe APIs**: Use OpenAPI or Zod for type-safe API contracts

---

## Common FAQ

**Q1: Is DDD necessary if the business is simple?**
A: No. DDD is suitable for medium-to-large projects. Small projects can be organized by feature directories, but maintain the principle of logical cohesion.

**Q2: Is Pinia store the domain model?**
A: Not exactly. Pinia store carries state and behavior, serving as the implementation carrier of the domain model. Complex rules should be placed in Domain Service or UseCase.

**Q3: How to divide domains and subdomains?**
A: A business module is a bounded context. Strongly related sub-modules can be placed in sub-directories within a domain, but avoid deep nesting.

**Q4: Where should global state (theme, language) be placed?**
A: In `packages/presentation/user/store/`, as it is a business concept of user preferences.

**Q5: How to share components with business logic across applications?**
A: Create a `packages/presentation/` package dedicated to domain presentation layer code (components, stores, hooks), which can be shared by multiple applications (Web, Desktop, Mobile).

**Q6: What's the difference between packages/domain/ and packages/presentation/?**
A: packages/domain/ is pure domain model (no frontend dependencies) and can be used by any tech stack; packages/presentation/ is the frontend implementation of the domain (depends on Vue/Pinia) and can only be used by Vue applications.
