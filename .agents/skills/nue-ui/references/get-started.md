# 引入与起步（get started）

面向"在项目里用 NueUI 写界面"。先分清你的场景：

- **外部消费项目**（装了 npm 包）：看本文件的"三种引入方式"。
- **本仓库内部**（写 `apps/document` 的组件演示 / `apps/playground` 页面）：页面里组件已全局注册，直接写标签，见文末"仓库内写 demo"。

## 需要安装的包

| 包                      | 作用                                   | 必装         |
| ----------------------- | -------------------------------------- | ------------ |
| `nue-ui`                | 组件逻辑（Vue3）                       | 是           |
| `nue-ui-theme-shadlike` | 主题样式（组件**没有内置样式**，靠它） | 是           |
| `nue-ui-iconfont`       | 图标字体样式（`NueIcon` 的字形）       | 用到图标时   |
| `nue-ui-resolver`       | unplugin-vue-components 自动导入       | 走自动导入时 |

## 方式一：全量引入（省事，包稍大）

```ts
// main.ts
import { createApp } from 'vue'
import App from './App.vue'

import NueUI from 'nue-ui' // 组件库
import 'nue-ui-theme-shadlike/dist/index.css' // 全量样式（关键！）
import 'nue-ui-iconfont/dist/iconfont.css' // 用到图标时引入

createApp(App).use(NueUI).mount('#app')
```

- 之后模板里所有组件都可直接用（kebab-case 或 PascalCase）：`<nue-button>`、`<nue-dialog>`。
- 样式也可用构建产物里的聚合样式 `import 'nue-ui/dist/index.css'`（等价物，二选一即可）。
- Volar/Vue 类型提示可加：`tsconfig.json` 的 `compilerOptions.types` 配 `["nue-ui/dist/global"]`。

## 方式二：按需手动引入（推荐，树摇友好）

```ts
// 某个 .vue / .ts 里
import { NueButton, NueInput, NueMessage } from 'nue-ui'
```

模板里需将组件注册到局部（`defineOptions`/`components` 或 script setup 直接 import 即自动可用）。样式按需：

```ts
// main.ts（必须的两行基线 + 用到的组件样式）
import 'nue-ui-theme-shadlike/dist/global/index.css'
import 'nue-ui-theme-shadlike/dist/components/button.css'
import 'nue-ui-theme-shadlike/dist/components/input.css'
// 注意：一个组件的样式可能依赖别的组件样式（如 dialog 依赖 overlay/container/text 等），
// 拿不准就直接全量 import 'nue-ui-theme-shadlike/dist/index.css' 最稳。
```

## 方式三：自动导入（unplugin-vue-components + resolver）

```ts
// vite.config.ts
import Components from 'unplugin-vue-components/vite'
import { NueUiResolver } from 'nue-ui-resolver'

export default defineConfig({
    plugins: [
        Components({ resolvers: [NueUiResolver()], dts: true })
        // NueUiResolver({ importPath: 'nue-ui/es' }) 为默认；源码模式传 '@nue-ui/components'
    ]
})
```

模板里直接写 `<nue-button>` 即被自动按需导入；**样式仍要手动引入**（同上方式二）。细节见 `packages/plugins/resolver/README.md`。

## 三者的差异小结

|                       | 模板可用性     | 体积 | 备注                         |
| --------------------- | -------------- | ---- | ---------------------------- |
| 全量 `app.use(NueUI)` | 全部组件全局   | 大   | 最快上手，适合 demo/内部页   |
| 手动按需 import       | 仅 import 过的 | 小   | 每个组件独立注册，样式要配齐 |
| resolver 自动导入     | 写即自动       | 小   | 样式仍手动                   |

## 仓库内写 demo（apps/document 演示 / playground）

- 文档站点（`.vitepress/theme/index.ts`）已 `app.use(NueUI)` 并引入了主题与图标 css → **模板里直接写 `<nue-button>`、`<nue-dialog>` 等标签组件，无需 import**；
- **方法类组件（NueMessage/NueConfirm/NuePrompt）不是标签**，仍需在 `<script setup>` 里 `import { NueMessage } from 'nue-ui';`（仓库内演示页就是这么写的）；
- 文档演示页结构：一个用法一个小 `.vue`，由 `index.md` 用 `::: preview` 引用（改 demo 文件即可即时看到，dev server 是 `pnpm document dev`）。

## 常见坑速查

- 忘了样式 → 全素颜。先补 `import 'nue-ui-theme-shadlike/dist/index.css';`。
- 图标不显示 → 补 `import 'nue-ui-iconfont/dist/iconfont.css';` 或核对 `name`。
- 只有部分组件生效（按需场景）→ 该组件样式没引 / 依赖组件样式没引。
- 模板用了但 Vue 报"组件未注册"→ 全量模式下检查 `app.use(NueUI)`；按需模式下检查 import 与局部注册。