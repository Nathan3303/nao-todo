---
name: 'nao-frontend-ddd'
description: 'DDD guide for Vue/React. 3‑level framework, core patterns, red lines.'
---

# Frontend DDD

## 1. Core Principle

**Domain layer must be pure TypeScript** – zero imports from Vue, React, axios, or any state library.
All business rules live inside entities/value objects. UseCases orchestrate via **ports** (interfaces).
Infrastructure implements those ports. Presentation is the **only** layer coupled to the UI framework.

**Dependency direction:**
`Views → Presentation → Application → Domain ← Infrastructure`
(Domain defines interfaces; Infrastructure implements; Application depends on abstractions).

## 2. Five Layers (Outside → Inside)

| Layer              | Responsibility                                                           | Dependencies          | Location (monorepo)        |
| ------------------ | ------------------------------------------------------------------------ | --------------------- | -------------------------- |
| **Domain**         | Aggregates, Entities, VOs, Repository interfaces, Events. Pure TS.       | None                  | `packages/domain/`         |
| **Application**    | UseCases, DTOs, outbound ports (e.g., `ITaskStateGateway`).              | Only Domain           | `packages/application/`    |
| **Infrastructure** | Repository impl (HTTP/LS), Mappers (DTO↔Entity).                         | HTTP client, no UI    | `packages/infrastructure/` |
| **Presentation**   | Stores, Hooks/Composables, domain components. **Only UI‑coupled layer**. | Vue/React + state lib | `packages/presentation-*`  |
| **Views**          | Pages, route assembly. **No business logic**.                            | Router                | `apps/*/src/views/`        |

## 3. Progressive Levels

### Level 1 – Lightweight (<5k LOC, 1‑2 devs)

- **Structure:** `src/domain/`, `src/infrastructure/`, `src/stores/`, `src/composables/` (or hooks), `src/views/`.
- **Core:** Rich entity (`complete()`), Composable assembles `new UseCase(repo, store)`.
- **Upgrade when:** >1 domain, entity >3 children, team >3.

### Level 2 – Standard (5k–20k LOC, 3‑5 devs)

- **Add:** UseCase layer (`application/`), outbound ports (`ITaskStateGateway`). Stores implement ports.
- **Rules:** Business store vs UI store separated; Components never call UseCase/repo directly.
- **Upgrade when:** Need Vue+React, >20k LOC, multiple teams.

### Level 3 – Full (>20k LOC, Monorepo)

- **Add:** Split presentation per framework. Outbound ports fully decouple UseCases from stores.
- **Component logic threshold:** >200 lines of logic → extract to local `useXxx.ts`.

## 4. Core Patterns (Code Snippets)

### Rich Entity (Domain)

```ts
export class Task {
    constructor(
        public id: string,
        public status: TaskStatus,
        public dueDate: Date
    ) {}
    complete() {
        if (this.status === 'DONE') throw new Error('Already done')
        if (this.dueDate < new Date()) throw new Error('Overdue')
        this.status = 'DONE'
    }
}
```

### UseCase (Application)

```ts
export class CompleteTaskUseCase {
    constructor(
        private repo: ITaskRepository,
        private gateway: ITaskStateGateway
    ) {}
    async execute(id: string) {
        const task = await this.repo.findById(id)
        task.complete()
        await this.repo.save(task)
        this.gateway.updateTask(task)
    }
}
```

### Mapper (Infrastructure)

```ts
export class TaskMapper {
    static toEntity(dto: TaskDto): Task {
        return new Task(dto.id, dto.status, new Date(dto.dueDate))
    }
    static toDto(entity: Task): TaskDto {
        return { id: entity.id, status: entity.status, dueDate: entity.dueDate.toISOString() }
    }
}
```

### DI Assembly (Presentation – Composable/Hook)

```ts
export function useTask() {
    const store = useTaskStore() // implements ITaskStateGateway
    const repo = new TaskHttpRepository()
    const useCase = new CompleteTaskUseCase(repo, store)
    return { tasks: store.tasks, completeTask: (id) => useCase.execute(id) }
}
```

## 5. Serialization Boundary

- **Store holds aggregates, not DTOs.**
- Flow: API DTO → `Mapper.toEntity()` → aggregate → store.
- Modification: entity method → `Mapper.toDto()` → API.
- DTO types **never** leak into Domain (only in Infrastructure).

## 6. Testing Strategy

| Layer          | Tools              | Focus                                      |
| -------------- | ------------------ | ------------------------------------------ |
| Domain         | Vitest/Jest (pure) | Entity invariants, value objects           |
| Application    | Vitest + mocks     | UseCase orchestration, port calls          |
| Infrastructure | Vitest + MSW       | Mapper conversion, HTTP mapping            |
| Presentation   | Testing Library    | Component rendering (with injected stores) |

## 7. Red Lines (Pre‑review Checklist)

- [ ] Domain/ folder has **no** Vue/React/axios imports.
- [ ] Entities are rich (business methods), not anemic.
- [ ] UseCases depend on interfaces, not concrete stores.
- [ ] Views contain no business `if/else` – only assembly.
- [ ] DTOs only in Infrastructure – Mapper centralises conversions.
- [ ] Store holds aggregates, updates via entity methods.
- [ ] Component logic >200 lines extracted to local `useXxx.ts`.
- [ ] No Context/Provide for UseCases – explicit assembly in Hooks/Composables.

**Vue‑specific:** Business store vs UI store separated; no direct mutation of aggregate props.
**React‑specific:** Zustand/Jotai for domain; UI state via `useState` or slice; no UseCase calls in JSX.

## 8. Migration Paths

- **L1 → L2:** Split domains; add UseCase layer; move repo interfaces to Domain; separate UI stores.
- **L2 → L3:** Switch to monorepo; split presentation per framework; introduce outbound ports; add Mappers; share utils/ui‑kit.

## 9. When to Skip DDD

If the app is pure CRUD (no state transitions, no invariants), use simple service+component pattern.
DDD is for **core domain** only – avoid over‑engineering non‑core areas.

## 10. FAQ (One‑liners)

- **UseCase vs Composable?** UseCase = pure orchestration (testable); Composable = UI assembler (injects deps).
- **Reactive proxy with aggregates?** Only call public methods; prefer full replacement.
- **SSR?** Assemble dependencies inside Hooks/Composables (not module top‑level) to avoid cross‑request pollution.
- **Events?** Use lightweight EventEmitter for in‑process decoupling – events carry IDs, not aggregates.
- **When to upgrade?** Follow the quantitative metrics in Section 3.