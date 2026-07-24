# Rich Domain Model

## Rich vs Anemic

**Anemic Model (anti-pattern)**: Entities are data bags — all fields public, no behavior methods. Business rules scattered across UseCase, converter, and ValueObject.validate().

```typescript
// ❌ Anemic: 15 public fields, zero behavior
class TaskEntity {
    constructor(
        public state: string, // anyone can freely mutate
        public priority: string,
        public givenUpAt: string | null
        // ...
    ) {}
}
```

**Problem**:

- Entity dies after one line — `API Response → Entity → converter → ViewObject → GC`
- Business rules scattered — same logic (e.g. `isGivenUp` calculation) repeated in converter and UseCase
- Adding rules: where to change? (VO.validate()? UseCase? converter?)
- Entity cannot be unit-tested — must depend on Pinia / API mock

**Rich Model**: Fields private, computed properties via getters, state mutated through behavior methods, business rules encapsulated in methods.

```typescript
// ✅ Rich: private fields + behavior methods + computed getters
class Task {
    private _state: TaskState = 'todo'
    private _givenUpAt: string | null = null

    get isGivenUp(): boolean {
        return this._givenUpAt !== null
    }
    get state(): TaskState {
        return this._state
    }

    start(): void {
        if (this._state === 'given-up') throw new Error('Cannot start a given-up task')
        this._state = 'in-progress'
    }

    giveUp(): void {
        this._state = 'given-up'
        this._givenUpAt = new Date().toISOString()
    }
}
```

**Benefits**:

- Testable: `task.start()` is pure TypeScript, no framework dependencies
- Change-safe: new rules only change entity methods, not UseCase / converter
- Code navigation: IDE autocomplete tells you what the entity can do

---

## Entity Lifecycle & CQRS-lite

**Core problem**: Store holds ViewObject (read model). Entity exists only transiently during create/update, then garbage collected — no chance to execute behavior. The rich model is a facade.

**Solution**: CQRS-lite — separate read and write paths. Entity stays alive in UseCase scope.

```text
Write path (command): Entity lives a full lifecycle
  UI triggers action → TaskUseCase → TaskRepository.get() → Task (rich entity)
                                     → task.rename() / task.complete()  ← business rules here
                                     → TaskRepository.save(task)
                                     → taskEntityToViewObject() → Store[ViewObject]  ← sync read model

Read path (query): Store still holds ViewObject, components never touch Entity
  UI renders list ← Store[TaskViewObject]
```

**Entity cache strategy**: Cache loaded entities in the UseCase to avoid an extra GET request on every update.

```typescript
class TaskUseCase {
    private entityCache = new Map<string, Task>()

    private async loadEntity(id: string): Promise<Task | null> {
        const cached = this.entityCache.get(id)
        if (cached) return cached
        const [entity, err] = await this.taskRepo.get(id)
        if (err || !entity) return null
        this.entityCache.set(id, entity)
        return entity
    }
}
```

**Note**: Single-user apps have no concurrent conflicts, caching is safe. Multi-device scenarios need optimistic locking (`version` or `updatedAt` field).

---

## Execution Chain: Object Relationships

The lifecycle and responsibility of each layer's objects during a complete "update task" operation:

```text
UpdateTaskViewObject (from Presentation layer — pure DTO, carries "which fields the user changed")
         │
         ▼
TaskUseCase.update(id, changes)  ← application layer orchestration
         │
         ├─ loadEntity(id) → TaskRepository.get(id) → Task (rich entity, loaded from API or cache)
         │
         ├─ task.rename(changes.name)  ← entity method enforces business rules
         ├─ task.complete()            ← entity method maintains invariants
         │
         ├─ TaskRepository.save(task)  ← full persistence (PUT)
         │
         └─ taskEntityToViewObject(task) → Store[TaskViewObject]  ← sync read model
```

**Object responsibilities**:

| Object                   | Layer        | Responsibility                                                               | Lifecycle                                           |
| ------------------------ | ------------ | ---------------------------------------------------------------------------- | --------------------------------------------------- |
| `Task` (Entity)          | Domain       | Encapsulated business rules, state machine, invariants                       | Cached in UseCase, lives across multiple operations |
| `CreateTaskValueObject`  | Domain       | Input validation for creation (entity doesn't exist yet, can't call methods) | Single create call                                  |
| `UpdateTaskValueObject`  | Domain       | Degenerate — just a field bundle for the backend, no validation              | Optional; rich model prefers `save(entity)`         |
| `TaskUseCase`            | Application  | Orchestration: load entity → call methods → persist → sync read model        | Application lifecycle                               |
| `TaskViewObject`         | Application  | Read model DTO for UI rendering                                              | Resides in Store                                    |
| `TaskStore` (Pinia)      | Presentation | Read model storage, Map<id, ViewObject>                                      | Application lifecycle                               |
| `taskEntityToViewObject` | Application  | Write model → read model projection                                          | Called after every write operation                  |

---

## Rich Entity UseCase with CQRS-lite

```typescript
// packages/application/task/usecases/task.ts
export class TaskUseCase {
    private entityCache = new Map<string, Task>()

    constructor(
        private taskDomain: TaskDomain,
        private taskRepo: TaskRepository,
        private taskStore: TaskStore // Store<ViewObject> — read model
    ) {}

    // --- Create: ValueObject does input validation, entity doesn't exist yet ---
    async create(dto: CreateTaskViewObject): GoAsync<TaskViewObject> {
        const vo = createTaskViewObjectToValueObject(dto)
        const err = vo.validate()
        if (err) return [null, err]

        const [entity, repoErr] = await this.taskRepo.create(vo)
        if (repoErr) return [null, repoErr]

        this.entityCache.set(entity.id, entity)
        const viewObject = taskEntityToViewObject(entity)
        this.taskStore.addTask(viewObject)
        return [viewObject, null]
    }

    // --- Update: load entity → call methods → full save → sync read model ---
    async update(id: string, changes: UpdateTaskViewObject): GoAsync<void> {
        const entity = await this.loadEntity(id)
        if (!entity) return 'Task not found'

        // Entity methods handle business rules
        if (changes.name !== undefined) entity.rename(changes.name)
        if (changes.state === 'done') entity.complete()
        else if (changes.state === 'in-progress') entity.start()
        if (changes.priority !== undefined) entity.changePriority(changes.priority)
        if (changes.givenUpAt !== undefined && changes.givenUpAt !== null) entity.giveUp()

        const saveErr = await this.taskRepo.save(entity)
        if (saveErr) return saveErr

        // Sync read model: entity → ViewObject → Store
        this.taskStore.updateTask(id, taskEntityToViewObject(entity))
        return null
    }

    // --- Internal: entity cache, avoids GET on every update ---
    private async loadEntity(id: string): Promise<Task | null> {
        const cached = this.entityCache.get(id)
        if (cached) return cached
        const [entity, err] = await this.taskRepo.get(id)
        if (err || !entity) return null
        this.entityCache.set(id, entity)
        return entity
    }
}
```

---

## Rich Model Checklist

- [ ] **Entities are not anemic**: Fields are private, business rules are in methods, not in converters or VO.validate()
- [ ] **Entity has computed getters**: `isDeleted`, `isArchived`, `isGivenUp` etc. computed in entity, not in converter
- [ ] **Entity lifecycle is meaningful**: UseCase loads entity, calls methods, saves — entity is not a transient DTO
- [ ] **ValueObject.validate() is only for creation**: Update validation lives in entity methods, not UpdateValueObject
- [ ] **Converter is thin**: Only maps entity fields to ViewObject; all computation (isXxx) lives in entity getters

---

## Rich Model Forbidden Practices

- ❌ **Anemic entities**: Entities with all-public fields and no behavior methods
- ❌ **Business rules in converters**: Computation like `dayjs(entity.givenUpAt).isValid()` in converter — should be entity getter
- ❌ **Business rules in UpdateValueObject.validate()**: Update validation should be in entity methods, not VO
- ❌ **Entity as transient DTO**: Creating entity only to immediately convert to ViewObject — entity should live in UseCase scope

---

## Rich Model FAQ

**Q: Should I put Entity in Pinia Store?**
A: No. Store should hold ViewObject (read model) for UI rendering. Entity (write model) should live in UseCase scope — loaded via `repo.get()`, modified via entity methods, saved via `repo.save()`, then projected to ViewObject via converter. This is CQRS-lite: read and write paths are separated, each with the right model for its purpose.

**Q: What's the difference between CreateValueObject and UpdateValueObject in a rich model?**
A: `CreateValueObject` still needs `validate()` — the entity doesn't exist yet, so there's nothing to call methods on. `UpdateValueObject` should NOT have `validate()` — the entity is loaded and its methods enforce business rules. The UpdateVO becomes a pure DTO carrying "which fields changed", or is eliminated entirely in favor of `repo.save(entity)`.

**Q: When should I use UpdateValueObject.patch() vs repo.save(entity)?**
A: `repo.save(entity)` when the change involves business rules (state transitions, validation that depends on current state). `repo.patch(id, diff)` when it's a simple field update with no business implications (e.g., changing a display color). The split is: "does this change need the entity's current state to validate?" If yes → load entity → entity method → save. If no → patch directly.