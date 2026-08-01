# 引入 JsonStringValueObject 至 Tag / BuiltInProject 域并修复边界问题

## 摘要

把 Project 域已在用的 `JsonStringValueObject` 推广到 `domain-tag` 与 `domain-built-in-project`，让三个域的「JSON 字符串 ↔ 对象」转换走同一条路径；同时**强化该值对象自身的兜底能力**，根治「显示与隐藏列」菜单无选项的问题。

三项已确认的决策（来自澄清）：

1. 兜底放在 `JsonStringValueObject` 内部，而非各域 converter 重复三份
2. Project 域的调试痕迹与半成品兜底纳入本次一并修好
3. `BuiltInProjectPreferenceEntity` 改为真实构造函数调用，补齐 `id` / `userId`

风格约束：遵循现有代码风格（中文 JSDoc、`Go<T>` 元组返回、`// @xxx` 段落注释、4 空格缩进、无分号）。

---

## 现状分析

### 1. 三个域目前各走各的路

| 域                 | 实体字段类型                                                                                                                                                                              | 解析方式               | 兜底                               |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ---------------------------------- |
| **Project**        | `JsonStringValueObject` ([project-preference.ts#L16-L17](file:///c:/Users/LEE19/Projects/nao-todo/packages/domain-project/src/domain/entities/project-preference.ts#L16-L17))             | VO 的 `marshall()`     | **几乎没有**（见下）               |
| **Tag**            | `string` ([tag-preference.ts#L17-L18](file:///c:/Users/LEE19/Projects/nao-todo/packages/domain-tag/src/domain/entities/tag-preference.ts#L17-L18))                                        | `jsonParse()` 工具函数 | `{ limit: 20 }` / `defaultColumns` |
| **BuiltInProject** | `string` ([built-in-project-preference.ts#L20-L21](file:///c:/Users/LEE19/Projects/nao-todo/packages/domain-built-in-project/src/domain/entities/built-in-project-preference.ts#L20-L21)) | `jsonParse()` 工具函数 | `{}` / `defaultColumns`            |

两个 VO 的目标类型是一致的（`columns: TaskColumnOptions`、`getTasksOptions: Partial<GetTasksOptions>`），实体侧却是 `string`，说明转换责任本就该收拢。

### 2. 根因：`marshall()` 与 `jsonParse()` 语义不一致

[json-string.ts#L53-L69](file:///c:/Users/LEE19/Projects/nao-todo/packages/shared/valueobjects/json-string.ts#L53-L69) 的 `marshall()`：

| 输入                        | 返回                        | `vo.value` 最终值 |
| --------------------------- | --------------------------- | ----------------- |
| `''` / `null` / `undefined` | `[null, '...is empty']`     | **`null`**        |
| `'{}'`                      | `[{}, '...length is zero']` | `{}`              |
| 非法 JSON                   | `[null, '...parse failed']` | **`null`**        |
| 正常 JSON                   | `[parsed, null]`            | `parsed`          |

而 [json-parse.ts#L11](file:///c:/Users/LEE19/Projects/nao-todo/packages/shared/utils/json-parse.ts#L11) 的 `jsonParse()` 对空串返回 `[{}, null]`（**成功**，非错误）。两者对「空」的判断相反。

关键点：`CreateByJsonString` 在 [L30-L33](file:///c:/Users/LEE19/Projects/nao-todo/packages/shared/valueobjects/json-string.ts#L30-L33) 只 `console.error` 就继续 `vo.value = res`，**错误被吞掉**，`null` 直接流入下游。

### 3. 该缺陷如何表现为「显示与隐藏列」无选项

```
后端 res.columns（空串 / null / 非法 JSON）
  → CreateByJsonString → vo.value = null           [infrastructure]
  → projectPreferenceEntityToViewObject 裸赋值      [domain-project]
  → preference.columns = null
  → <task-column-display-controller :columns="null">
  → Object.keys(props.columns) → 菜单空
```

断链点是 [domain-project/converters.ts#L67](file:///c:/Users/LEE19/Projects/nao-todo/packages/domain-project/src/application/usecases/project-service/converters.ts#L67)：

```ts
vo.columns = entity.columns.value as TaskColumnOptions // 可能是 null
```

对比 [domain-tag/converters.ts#L58](file:///c:/Users/LEE19/Projects/nao-todo/packages/domain-tag/src/application/usecases/converters.ts#L58) 有 `{ ...defaultColumns, ...columns }` 合并兜底 —— Project 域缺的正是这个。

而 [column-display-controller.vue#L25](file:///c:/Users/LEE19/Projects/nao-todo/packages/presentation/task/components/dropdowns/column-display-controller.vue#L25) 直接 `Object.keys(props.columns)`，prop 类型标注是非空 `TaskColumnOptions`，运行时拿到 `null` 会抛错或产出空列表。

### 4. 未提交的调试痕迹（本次一并清理）

- [project.ts#L98](file:///c:/Users/LEE19/Projects/nao-todo/packages/domain-project/src/application/usecases/project-service/project.ts#L98)：`console.log(preference)`

- [infrastructure/project/converters.ts#L108](file:///c:/Users/LEE19/Projects/nao-todo/packages/infrastructure/src/persistence-go/project/converters.ts#L108)：`if (res.columns === '{}')` 只覆盖三种失效输入中的一种，且在 infrastructure 层判字符串字面量，层级不对

- [project-preference-repo-impl.ts](file:///c:/Users/LEE19/Projects/nao-todo/packages/infrastructure/src/persistence-go/project/project-preference-repo-impl.ts)：仅注释顺序调整，保留即可

### 5. BuiltInProject 域的实体从未被正确构造

全仓 `new BuiltInProjectPreferenceEntity` **0 处命中**。两处都是空对象断言，`id` 与 `userId` 永不赋值：

- [infrastructure/built-in/project/converters.ts#L30-L35](file:///c:/Users/LEE19/Projects/nao-todo/packages/infrastructure/src/built-in/project/converters.ts#L30-L35)（函数名 `bippRes2bippVO` 名不副实，返回的是 Entity）

- [domain-built-in-project/converters.ts#L67-L72](file:///c:/Users/LEE19/Projects/nao-todo/packages/domain-built-in-project/src/application/usecases/converters.ts#L67-L72)

该域数据源是 **localStorage + 本地默认值**，无后端请求（[repoImpl.ts#L46-L75](file:///c:/Users/LEE19/Projects/nao-todo/packages/infrastructure/src/built-in/project/repoImpl.ts#L46-L75)）。`getPreference` 是同步函数且 [L54 的](file:///c:/Users/LEE19/Projects/nao-todo/packages/infrastructure/src/built-in/project/repoImpl.ts#L54) [`JSON.parse`](file:///c:/Users/LEE19/Projects/nao-todo/packages/infrastructure/src/built-in/project/repoImpl.ts#L54) [未包 try/catch](file:///c:/Users/LEE19/Projects/nao-todo/packages/infrastructure/src/built-in/project/repoImpl.ts#L54) —— localStorage 被外部写坏会直接抛异常。

### 6. 额外发现：Tag 域偏好加载的默认值被丢弃

[tag-preference.ts#L37-L40](file:///c:/Users/LEE19/Projects/nao-todo/packages/infrastructure/src/persistence-go/tag/tag-preference.ts#L37-L40) 请求失败时返回 `[defaultTagPreferenceRes2Entity(), res.message]` —— **同时给了值和错误**。但调用方 [tag.ts#L102](file:///c:/Users/LEE19/Projects/nao-todo/packages/domain-tag/src/application/usecases/tag.ts#L102) 是 `if (err !== null) return err`，默认实体被直接丢弃，store 里的 preference 保持未初始化。这是 Tag 域同类症状的独立成因，与 VO 无关，需一并修。

---

## 变更方案

### A. 强化 `JsonStringValueObject`（核心）

**文件**：[packages/shared/valueobjects/json-string.ts](file:///c:/Users/LEE19/Projects/nao-todo/packages/shared/valueobjects/json-string.ts)

**做什么**：让 `value` 永不为 `null`，并新增带兜底的安全读取方法。

**为什么**：兜底集中一处，三个域共享；下游无需各自判空。

**怎么做**：

1. `marshall()` 语义对齐 `jsonParse()` —— 空串与解析失败都返回 `[{}, error]`（错误仍返回，但值可用）：

```ts
marshall(ostr: string): Go<Record<string, unknown>> {
    try {
        // 空字符串视为空对象，避免污染 value
        if (!ostr) return [{}, '[JsonParser] JSON string is empty.']
        // 解析
        const parsed = JSON.parse(ostr)
        // 判断是否是空对象
        if (Object.keys(parsed).length === 0) {
            return [{}, '[JsonParser] Object length is zero.']
        }
        // 正常返回
        return [parsed, null]
    } catch (err) {
        console.error('[JsonParser]', err)
        return [{}, '[JsonParser] JSON parse failed.']
    }
}
```

1. `value` 字段初值改为 `{}`，类型去掉 `| null`：

```ts
public value: Record<string, unknown> = {}
```

1. 新增 `valueOr` 方法，供需要 default 合并的场景使用：

```ts
/**
 * 读取值并与兜底对象合并
 * @description 用于列配置这类「必须有完整字段」的场景，
 *              解析结果中缺失的键由 fallback 补齐
 * @param fallback 兜底对象
 * @returns 合并后的对象
 */
valueOr<T extends Record<string, unknown>>(fallback: T): T {
    return { ...fallback, ...this.value } as T
}
```

1. `CreateByJsonString` 保留 `console.error`（现有风格），但因 `marshall` 不再返回 `null`，`vo.value` 恒为对象。

**风险**：`value` 类型收窄会让现有 `as` 断言处的类型推断变化。Project 域两处消费点在 §B 中同步调整。

---

### B. 修复 Project 域（纳入本次）

**文件 1**：[packages/domain-project/src/application/usecases/project-service/converters.ts](file:///c:/Users/LEE19/Projects/nao-todo/packages/domain-project/src/application/usecases/project-service/converters.ts)

L66-L67 改为经 `valueOr` 兜底：

```ts
vo.getTasksOptions = entity.getTasksOptions.valueOr({ limit: 20 }) as GetTasksOptions
vo.columns = entity.columns.valueOr(defaultColumns) as TaskColumnOptions
```

需新增 `defaultColumns` 的 import（来自 `@nao-todo/shared`）。同时删除 L68 已注释的 `console.log`。

**文件 2**：[packages/domain-project/src/application/usecases/project-service/project.ts](file:///c:/Users/LEE19/Projects/nao-todo/packages/domain-project/src/application/usecases/project-service/project.ts)

删除 L98 的 `console.log(preference)`。

**文件 3**：[packages/infrastructure/src/persistence-go/project/converters.ts](file:///c:/Users/LEE19/Projects/nao-todo/packages/infrastructure/src/persistence-go/project/converters.ts)

回退 L98/L108-L109 的半成品兜底，恢复为直接 `return new ProjectPreferenceEntity(...)`；兜底已由 VO 承担。同步移除因此不再使用的 `defaultColumns` import（若该文件其他位置仍在用则保留 —— L126 `defaultProjectPreferenceRes2Entity` 仍在用，**故保留 import**）。

---

### C. Tag 域引入 `JsonStringValueObject`

**文件 1**：[packages/domain-tag/src/domain/entities/tag-preference.ts](file:///c:/Users/LEE19/Projects/nao-todo/packages/domain-tag/src/domain/entities/tag-preference.ts)

字段类型 `string` → `JsonStringValueObject`，对齐 Project 域实体：

```ts
import { Entity, JsonStringValueObject } from '@nao-todo/shared'

export class TagPreferenceEntity extends Entity {
    constructor(
        public id: string, // 标签偏好ID
        public createdAt: string, // 创建时间
        public updatedAt: string, // 更新时间
        public deletedAt: string | null, // 删除时间
        public tagId: string, // 标签ID
        public viewType: string, // 视图类型
        public getTasksOptions: JsonStringValueObject, // 获取任务选项
        public columns: JsonStringValueObject // 列配置
    ) {
        super(id, createdAt, updatedAt, deletedAt)
    }
}
```

> 不新增 `updateGetTasksOptions` / `updateColumns` 方法 —— Project 域有是因为它被调用；Tag 域无调用点，按「不为假想需求设计」不加。

**文件 2**：[packages/domain-tag/src/application/usecases/converters.ts](file:///c:/Users/LEE19/Projects/nao-todo/packages/domain-tag/src/application/usecases/converters.ts)

- `tagPreferenceEntityToViewObject`（L48-L60）改用 `valueOr`，删除 `jsonParse` import：

```ts
vo.getTasksOptions = tagPreferenceEntity.getTasksOptions.valueOr({
    limit: 20
}) as Partial<GetTasksOptions>
vo.columns = tagPreferenceEntity.columns.valueOr(defaultColumns) as TaskColumnOptions
```

- `tagPreferenceViewObjectToEntity`（L67-L80）的 `JSON.stringify` 改为 `JsonStringValueObject.CreateByObject(...)`

**文件 3**：[packages/infrastructure/src/persistence-go/tag/converters.ts](file:///c:/Users/LEE19/Projects/nao-todo/packages/infrastructure/src/persistence-go/tag/converters.ts)

- `tagPreferenceRes2Entity`（L95-L106）：`res.getTasksOptions` / `res.columns` 包一层 `JsonStringValueObject.CreateByJsonString(...)`

- `defaultTagPreferenceRes2Entity`（L112-L124）：`'{}'` → `JsonStringValueObject.CreateByJsonString('{}')`；`JSON.stringify(defaultColumns)` → `JsonStringValueObject.CreateByObject(defaultColumns)`

**文件 4**：`UpdateTagPreferenceValueObject` 的写路径

[updateTagPreferenceValueObject2Req](file:///c:/Users/LEE19/Projects/nao-todo/packages/infrastructure/src/persistence-go/tag/converters.ts#L131-L139) 读 `updateVO.getTasksOptions` / `.columns` 并直接赋给请求体（需为字符串）。执行时需先读该 VO 的字段声明：若其类型改为 `JsonStringValueObject`，此处应改为 `.unmarshal()`；若保持 `string`，则 §C 文件 2 的 `tagPreferenceViewObjectToEntity` 产出需相应调整。**这是执行期必须先确认的一处**。

**文件 5**：修复 §6 的默认值丢弃

[packages/infrastructure/src/persistence-go/tag/tag-preference.ts#L37-L40](file:///c:/Users/LEE19/Projects/nao-todo/packages/infrastructure/src/persistence-go/tag/tag-preference.ts#L37-L40) 改为返回 `[defaultTagPreferenceRes2Entity(), null]`，与 [Project 域 repo 的写法](file:///c:/Users/LEE19/Projects/nao-todo/packages/infrastructure/src/persistence-go/project/project-preference-repo-impl.ts#L31-L33)一致 —— 「取不到就用默认」不是错误路径。同时修正 L38/L41 两条方向写反的注释。

---

### D. BuiltInProject 域引入 `JsonStringValueObject`

**文件 1**：[packages/domain-built-in-project/src/domain/entities/built-in-project-preference.ts](file:///c:/Users/LEE19/Projects/nao-todo/packages/domain-built-in-project/src/domain/entities/built-in-project-preference.ts)

`getTasksOptions` / `columns` 类型改为 `JsonStringValueObject`，保留其余参数与 JSDoc 结构。

> 该实体不继承 `Entity` 基类（现状如此），本次不改继承关系。

**文件 2**：[packages/infrastructure/src/built-in/project/converters.ts](file:///c:/Users/LEE19/Projects/nao-todo/packages/infrastructure/src/built-in/project/converters.ts)

`bippRes2bippVO`（L27-L36）改为真实构造：

```ts
export const bippRes2bippVO = (
    bippRes: BuiltInProjectPreferenceRes
): BuiltInProjectPreferenceEntity => {
    return new BuiltInProjectPreferenceEntity(
        '',
        bippRes.userId,
        bippRes.projectId,
        bippRes.viewType,
        JsonStringValueObject.CreateByJsonString(bippRes.getTasksOptions),
        JsonStringValueObject.CreateByJsonString(bippRes.columns)
    )
}
```

`import type` 需改为值导入（构造函数调用需要运行时绑定）。

`bippVO2bippRes`（L43-L52）反向改为 `.unmarshal()`：

```ts
bipp.userId = bippvo.userId
bipp.getTasksOptions = bippvo.getTasksOptions.unmarshal()
bipp.columns = bippvo.columns.unmarshal()
```

> `BuiltInProjectPreferenceRes.userId` 是必填（[types.ts#L16](file:///c:/Users/LEE19/Projects/nao-todo/packages/infrastructure/src/built-in/project/types.ts#L16)），原实现漏赋值，此处补上。

**文件 3**：[packages/domain-built-in-project/src/application/usecases/converters.ts](file:///c:/Users/LEE19/Projects/nao-todo/packages/domain-built-in-project/src/application/usecases/converters.ts)

- `builtInProjectPreferenceEntity2ViewObject`（L38-L57）用 `valueOr` 替换 `jsonParse` 分支，删除 `jsonParse` import。注意该 VO 有 `userId` 字段（[builtins.ts#L22](file:///c:/Users/LEE19/Projects/nao-todo/packages/domain-built-in-project/src/application/viewobjects/builtins.ts#L22)）而现实现未赋值，一并补上。

- `builtInProjectPreferenceViewObject2Entity`（L64-L73）改为 `new BuiltInProjectPreferenceEntity(...)` + `CreateByObject`，消除 `{} as Entity` 断言。

**文件 4**：[packages/infrastructure/src/built-in/project/repoImpl.ts](file:///c:/Users/LEE19/Projects/nao-todo/packages/infrastructure/src/built-in/project/repoImpl.ts)

L51-L59 的 `JSON.parse(localStorage.getItem(key))` 包 try/catch，解析失败时落到默认值分支而非抛异常：

```ts
if (builtInProjectPreferenceInLocalStorage) {
    try {
        const bippvo = bippRes2bippVO({
            ...JSON.parse(builtInProjectPreferenceInLocalStorage),
            projectId: id
        })
        return [bippvo, null]
    } catch (err) {
        // 本地存储被写坏时忽略，回退到默认偏好
        console.error('[BuiltInProjectRepo]', err)
    }
}
```

**文件 5**：`defaultBuiltInProjectPreferences`（[default.ts#L90-L210](file:///c:/Users/LEE19/Projects/nao-todo/packages/infrastructure/src/built-in/project/default.ts#L90-L210)）**不改** —— 它的类型是 `BuiltInProjectPreferenceRes`（字段为 `string`），`JSON.stringify` 写法正确，由 `bippRes2bippVO` 负责转 VO。

---

### E. 是否移除 `jsonParse` 工具函数

改完 §C/§D 后，`jsonParse` 在这两个域已无调用点。执行期需 grep 确认全仓无其他消费者：

- 若确实无人使用 → 删除 [packages/shared/utils/json-parse.ts](file:///c:/Users/LEE19/Projects/nao-todo/packages/shared/utils/json-parse.ts) 及其 barrel 导出

- 若仍有其他域在用 → 保留，不强行统一（超出本次范围）

---

## 假设与决策

| 项                                 | 决策                                    | 依据                               | <br />           |
| ---------------------------------- | --------------------------------------- | ---------------------------------- | :--------------- |
| 兜底层级                           | 放进 `JsonStringValueObject`            | 你的选择；避免三份重复             | <br />           |
| `marshall` 空串语义                | 与 `jsonParse` 对齐，返回 `[{}, error]` | 保留错误信号，但值可用             | <br />           |
| `value` 类型                       | 去掉 \`                                 | null\`                             | 消除下游全部判空 |
| Project 域                         | 纳入本次修好                            | 你的选择；同一根因                 | <br />           |
| 内建实体构造                       | 改真实构造函数                          | 你的选择；顺带补 `id`/`userId`     | <br />           |
| Tag 实体新增方法                   | **不加**                                | 无调用点，避免过度设计             | <br />           |
| `defaultBuiltInProjectPreferences` | **不改**                                | Res 层本就该是字符串               | <br />           |
| 内建实体继承 `Entity`              | **不改**                                | 超出本次范围                       | <br />           |
| `column-display-controller.vue`    | **不改**                                | 上游修好后 prop 恒为对象，无需防御 | <br />           |

**非目标**：不改 `TaskColumnOptions` / `GetTasksOptions` 类型定义；不改 presentation 层组件；不动 pomodoro 域的本地 `viewPreference`（与这两个 VO 无关）。

---

## 执行顺序

严格串行，每步后跑校验。

| #   | 任务                                                                                                              |
| --- | ----------------------------------------------------------------------------------------------------------------- |
| T1  | 读 `UpdateTagPreferenceValueObject` 与 `UpdateProjectPreferenceValueObject` 字段声明，确认 §C 文件 4 的写路径方向 |
| T2  | §A 改造 `JsonStringValueObject`（`marshall` + `value` + `valueOr`）                                               |
| T3  | §B 修 Project 域三个文件（converter 兜底 + 清 `console.log` + 回退半成品兜底）                                    |
| T4  | §C 改 Tag 域：实体 → application converter → infrastructure converter → 写路径                                    |
| T5  | §C 文件 5 修 Tag 偏好默认值丢弃 + 注释方向                                                                        |
| T6  | §D 改 BuiltInProject 域：实体 → 两个 converter → repoImpl try/catch                                               |
| T7  | §E grep `jsonParse` 残留消费者，决定删或留                                                                        |
| T8  | 全量校验 + 手测                                                                                                   |

---

## 验证

### 静态校验

```
vp check
vp test
```

> 注意：`vp` 在当前沙箱无法下载 Node runtime，需在本机终端执行。git pre-commit 钩子会跑 `vp check --fix`，只检查**暂存文件**，所以提交时才暴露的既存问题需留意。

### grep 验证

| 验证项                                                                     | 期望                         |
| -------------------------------------------------------------------------- | ---------------------------- |
| `rg "jsonParse" packages`                                                  | 仅剩确认保留的消费者（或 0） |
| `rg "\{\} as BuiltInProjectPreferenceEntity" packages`                     | 0                            |
| `rg "JSON.stringify" packages/domain-tag packages/domain-built-in-project` | 0（都走 `CreateByObject`）   |
| `rg "res.columns === '\{\}'" packages/infrastructure`                      | 0（半成品兜底已移除）        |
| `rg "console.log" packages/domain-project packages/domain-tag`             | 0                            |

### 手测（关键）

「显示与隐藏列」在**三个**入口都要验证菜单有完整 14 项：

1. **Project** — [project/header/operation-dropdown.vue#L80](file:///c:/Users/LEE19/Projects/nao-todo/apps/web/src/components/tasks/project/header/operation-dropdown.vue#L80)
2. **Tag** — [tag/header/operation-dropdown.vue#L76](file:///c:/Users/LEE19/Projects/nao-todo/apps/web/src/components/tasks/tag/header/operation-dropdown.vue#L76)
3. **BuiltInProject** — [built-in-project/header/operation-dropdown.vue#L68](file:///c:/Users/LEE19/Projects/nao-todo/apps/web/src/components/tasks/built-in-project/header/operation-dropdown.vue#L68)

补充场景：

- 勾选/取消某列 → 表格列随之增减，刷新后保持（验证写路径 `unmarshal` 正确）

- 排序下拉（`task-sort-operator`）字段列表正常 —— 同样吃 `preference.columns`

- **内建清单边界**：手动把 `localStorage` 某个 `<userId>/<projectId>` 值改成 `not-json`，刷新后应回退默认偏好而非白屏（验证 §D 文件 4）

- **Tag 边界**：Tag 偏好接口失败时，页面应使用默认列而非空菜单（验证 §C 文件 5）

---

## 风险

| 风险                                                        | 影响                                  | 缓解                                                                                                 | <br />                                                  |
| ----------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------- | :------------------------------------------------------ |
| `value` 去掉 \`                                             | null`后，现有`as\` 断言处类型推断变化 | 编译错                                                                                               | Project 域两处消费点在 T3 同步改；`vp check` 会全部暴露 |
| Tag 写路径方向判断错误，导致存进后端的是 `[object Object]`  | 偏好保存失效                          | T1 先确认 VO 字段声明；手测「勾选后刷新保持」                                                        | <br />                                                  |
| 内建 `bippVO2bippRes` 补 `userId` 后，localStorage 结构变化 | 旧数据读取异常                        | 结构是**增字段**，`bippRes2bippVO` 对缺失 `userId` 取 `undefined` 不影响 key 定位；必要时手测旧数据  | <br />                                                  |
| `valueOr` 浅合并对嵌套的 `getTasksOptions.sort` 不做深合并  | 排序配置可能丢字段                    | 现状 `jsonParse` 也是浅合并（`{ ...defaultColumns, ...columns }`），行为不退化；不在本次扩大为深合并 | <br />                                                  |
| 删除 `jsonParse` 可能影响未搜到的动态引用                   | 运行时报错                            | T7 grep 确认；不确定则保留                                                                           | <br />                                                  |

**提交建议**：按 §A / §B / §C / §D / §E 分 5 组提交，便于单步回退。