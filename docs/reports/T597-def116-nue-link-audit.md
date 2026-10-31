# T597 `DEF-116` 核查：`nue-link` 的 `route` / `to` / `href` 三形态

> 任务：`T597`（登录体验收尾批）· 结论：**本仓规避**（原生 `router-link`），**不改** `nue-ui` 组件库；上游另立单
> 环境：`nue-ui@1.13.0`（`node_modules/nue-ui/dist/es/link-DZ9yhz5S.js`）+ `vue-router` + jsdom 真实挂载

## 一、方法（可复现）

临时探针用例（`@vue/test-utils` 真实挂载 + `attachTo: document.body`，跑完即删，未入库）逐形态打印 DOM：

1. `<nue-link :route="{ path: '/auth/signup' }">`；
2. `<nue-link :to="{ path: '/auth/signup' }">`；
3. `<nue-link href="/auth/signup">`；
4. 原生 `<router-link :to="{ path: '/auth/signup' }">`（对照）。

## 二、实测结果（DOM 原文）

| #   | 用法                            | 渲染结果（去掉 `data-v`）                                                             | `href`         | 可聚焦 |
| :-- | :------------------------------ | :------------------------------------------------------------------------------------ | :------------- | :----- |
| 1   | `nue-link :route="{path}"`      | `<a class="nue-link"><span class="nue-text …nue-link__content">route-form</span></a>` | **无**         | **否** |
| 2   | `nue-link :to="{path}"`         | `<a active-class="" class="nue-link" to="[object Object]">…</a>`                      | **无**         | **否** |
| 3   | `nue-link href="/auth/signup"`  | `<a class="nue-link" href="/auth/signup" title="/auth/signup">…</a>`                  | `/auth/signup` | 是     |
| 4   | 原生 `router-link :to="{path}"` | `<a href="/auth/signup">router-link-form</a>`                                         | `/auth/signup` | 是     |

补充断言：形态 1 的组件树里 `RouterLink` **确实存在**（`findAllComponents({ name: 'RouterLink' }).length === 1`），
根节点是 `<a>`，但 **`href` 被吞掉** ⇒ 不是「没走 router-link」，而是「走了 router-link 但 href 被覆盖」。

## 三、根因（已用最小复现证实）

`nue-link` 的模板把 `href` **无条件**绑定进去：

```text
:is="disabled ? 'a' : tag"      // tag 在 route 形态下 = 'router-link'
:href="disabled || !href ? void 0 : href"
:to="to"
```

`route` 形态下该 `href` 恒为 `undefined`，经 `mergeProps` 合并后作为 **`href: undefined` 透传给 `RouterLink`**，
而 `RouterLink` 会把 `$attrs` 展开在 `<a>` 上 ⇒ **覆盖**它自己算出的 `href`。

最小复现（探针 5）：同页两个 `router-link`，其中一个附加 `:href="undefined"`：

```text
<a class="">with-href-undefined</a>          ← href 被 undefined 覆盖
<a href="/auth/signup" class="">plain</a>    ← 正常
```

另：`nue-ui@1.13.0` 的 `nue-link` **没有声明 `to` prop**（仅 `href/disabled/icon/route/size/title/theme`），
所以 `:to="…"` 落到 `$attrs` 被字符串化成无效的 DOM 属性 `to="[object Object]"`，**同样不产生 `href`**。

## 四、受影响页面清单（全仓 `nue-link` 清点，移动端红线区不计）

`nue-link :route` / `route="…"`（**均不可聚焦**，键盘与读屏拿不到链接语义）：

| 位置                                                         | 用法                                                                            | 本批处置                                |
| :----------------------------------------------------------- | :------------------------------------------------------------------------------ | :-------------------------------------- |
| `packages/presentation-identity/src/components/sign-in.vue`  | 登录 → 注册 互链                                                                | **已规避**（原生 `router-link`）        |
| `packages/presentation-identity/src/components/sign-up.vue`  | 注册 → 登录 互链                                                                | **已规避**（原生 `router-link`）        |
| `apps/web/src/components/pomodoro/aside/aside.vue`（4 处）   | 番茄钟侧栏导航                                                                  | 只登记（旁路：同页 `header.vue` 可用）  |
| `apps/web/src/components/pomodoro/header/header.vue`（4 处） | 番茄钟顶栏导航                                                                  | 只登记                                  |
| `apps/web/src/components/tasks/aside/aside.vue`（2 处）      | 任务侧栏清单导航（内置清单 v-for）                                              | 只登记                                  |
| `packages/shared/components/router-link/router-link.vue`     | 本仓 `NaoRouterLink` = `nue-link` 主题包装（`$attrs` 透传 `route`）⇒ **同缺陷** | 只登记（不改，避免牵连 5 处调用方布局） |

非 `route` 形态（`@click` / 纯文本型 `nue-link`）不受影响：`pomodoro/focus-depend-dropdown`、
`tasks/aside` 的「已归档」入口（`@click` 开弹窗）、`smart-list`（行内文本 + `append` 槽）。

## 五、规避结论（本仓）

- 认证互链改**原生 `router-link`**（保留 `class="nue-link"` 以免视觉漂移 + `auth-link` 补 `:focus-visible` 轮廓），
  因此 `href` / 可聚焦 / 键盘 Tab 全部成立，SPA 导航语义也保留；`redirect` query 透传逻辑不变（`DEF-95` 不回归）。
- **替代方案与否决理由**：
    - `nue-link href="…"`（形态 3）：能出 `href`，但会**丢失 router 语义**（整页刷新）、且需手工把路由拼成字符串，
      与 `query.redirect` 动态拼接易漂移 ⇒ 不采纳；
    - 在 `NaoRouterLink` 内部过滤 `href`：等于在本仓给组件库打补丁，牵连 5 处调用方视觉/布局回归风险 ⇒ 不采纳；
    - 改 `nue-ui` 组件库：按 PRD §九 **不在本仓做**。
- 其他页面（番茄钟 / 任务侧栏）**本批不改**：它们是纯导航链接，当前以 `@click`/鼠标可达，属独立缺陷面；
  修法同上（`router-link` 或修复上游后回退），登记到缺陷池由后续批处理。

## 六、上游问题（另立单，由 PM 处理）

- 仓库：`nue-ui`（本仓依赖 `1.13.0`）
- 标题建议：`nue-link 的 route/to 形态渲染 <a> 无 href（href: undefined 覆盖 RouterLink）`
- 复现：`<nue-link :route="{ path: '/x' }">` ⇒ `<a class="nue-link">`（无 `href`、不可聚焦）；`:to` 形态同上且产生无效属性 `to="[object Object]"`。
- 建议修法（任一）：① `href` 只在 `tag === 'a'` 时绑定（如 `v-bind="tag === 'a' ? { href } : {}"`）；
  ② 声明 `to` prop 并转发给 `router-link`；③ `mergeProps` 前剔除 `undefined` 的 `href`。
- 验收判据：`route` / `to` 两形态渲染 `<a href="<resolve 后的路径>">`，键盘 Tab 可聚焦，`aria-current` 正确。

## 七、本仓验证

- `packages/presentation-identity/src/components/__tests__/t596-def116-auth-links.test.ts`：4 例全绿
  （可访问名 + 原生 `href` 指向对应认证页 + 可聚焦）。
- 回归：`apps/web/src/views/auth/__tests__/sign-up-redirect.test.ts`（互链携带 `redirect`）4 例绿；
  `deep-link-resume` / `routes` 等认证面同批 22 文件 166 例绿。