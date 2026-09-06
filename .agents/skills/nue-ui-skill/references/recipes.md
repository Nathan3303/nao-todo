# 画面编写套路（recipes）

可复制片段。用法与 props 名称**以文档为准**（本仓库 `apps/document/tutorial/...` 或在线文档）；这里示范结构。仓库内的演示文件路径已标注，可以直接打开抄。

约定：片段假设已全量注册（见 get-started.md），方法类组件需 `import { NueMessage } from 'nue-ui';`。

目录：1 应用壳布局 · 2 工具行 · 3 表单页 · 4 对话框+抽屉 · 5 确认/提示/消息流 · 6 数据列表 · 7 下拉菜单

## 1. 应用壳布局（后台/管理页）

来源演示：`apps/document/tutorial/basic/container/basic.vue`

```vue
<template>
    <nue-container height="100vh">
        <nue-header>Logo · 顶部栏</nue-header>
        <nue-main>
            <nue-aside width="220px">侧边导航</nue-aside>
            <nue-content fill>
                <nue-div flex="1" gap="var(--nue-gap-md)" style="padding: 1rem">
                    <!-- 页面内容 -->
                </nue-div>
            </nue-content>
        </nue-main>
        <nue-footer>底部版权</nue-footer>
    </nue-container>
</template>
```

要点：

- container 纵向排布 header/main/footer；main 内部是横向，可把 aside 放左右、content 放中间（`fill` 撑满）；
- 区域自身的视觉（背景/文字色）建议用 CSS 变量（如 `var(--nue-primary-color-100)`）覆盖，参照演示里的 scoped 样式写法；
- 单纯局部弹性排版优先 `<nue-div>`（flex/gap/align/justify），它是页面里出现率最高的组件。

## 2. 工具行（标题 + 操作按钮）

```vue
<template>
    <nue-div align="center" justify="space-between">
        <nue-text size="lg" weight="bold">用户列表</nue-text>
        <nue-div gap="var(--nue-gap-xs)">
            <nue-button icon="filter">筛选</nue-button>
            <nue-button icon="plus-circle" theme="primary">新增用户</nue-button>
        </nue-div>
    </nue-div>
</template>
```

## 3. 表单页

```vue
<script setup lang="ts">
import { reactive } from 'vue'
import { NueMessage } from 'nue-ui'

const form = reactive({ name: '', type: null, agree: false, notify: false, note: '' })
const typeOptions = [
    { label: '管理员', value: 'admin' },
    { label: '访客', value: 'guest' }
]
const submit = () => {
    NueMessage.success('提交成功', 3000)
}
</script>

<template>
    <nue-div direction="column" gap="var(--nue-gap-df)" style="max-width: 480px">
        <nue-div align="center" gap="var(--nue-gap-df)">
            <nue-text style="width: 6rem">姓名</nue-text>
            <nue-input v-model="form.name" placeholder="请输入姓名" flex="1" />
        </nue-div>

        <nue-div align="center" gap="var(--nue-gap-df)">
            <nue-text style="width: 6rem">类型</nue-text>
            <nue-select v-model="form.type" placeholder="请选择" flex="1">
                <nue-select-option
                    v-for="opt in typeOptions"
                    :key="opt.value"
                    :label="opt.label"
                    :value="opt.value"
                />
            </nue-select>
        </nue-div>

        <nue-div align="center" gap="var(--nue-gap-df)">
            <nue-text style="width: 6rem">备注</nue-text>
            <nue-textarea v-model="form.note" placeholder="选填" flex="1" :rows="3" />
        </nue-div>

        <nue-div align="center" gap="var(--nue-gap-df)">
            <nue-checkbox v-model="form.agree">我已阅读并同意协议</nue-checkbox>
        </nue-div>

        <nue-div align="center" gap="var(--nue-gap-df)">
            <nue-text style="width: 6rem">通知</nue-text>
            <nue-switch v-model="form.notify" />
            <nue-text size="sm">开启后发送站内信</nue-text>
        </nue-div>

        <nue-div justify="end" gap="var(--nue-gap-xs)">
            <nue-button theme="ghost">取消</nue-button>
            <nue-button theme="primary" @click="submit">保存</nue-button>
        </nue-div>
    </nue-div>
</template>
```

细节提醒：

- 行内 label 用 `<nue-text>` 固定宽度或 `nue-div` 对齐即可，库内没有表单布局封装；
- Select 的值类型很宽（string/number/boolean/…），v-model 默认 `null` 表示未选；
- 日期选择输出 ISO 字符串（`YYYY-MM-DDTHH:mm:ss.sssZ`），要展示友好格式自行截取/格式化（见 date-picker 文档）；
- 输入类带 `counter`/`maxlength` 可做字数统计，密码框可开 `allow-show-password`。

## 4. 对话框 + 抽屉

来源演示：`apps/document/tutorial/feedback/dialog/basic.vue`、`.../drawer/basic.vue`

```vue
<script setup lang="ts">
import { ref } from 'vue'

const dialogVisible = ref(false)
const drawerVisible = ref(false)
</script>

<template>
    <nue-button @click="dialogVisible = true">打开对话框</nue-button>
    <nue-button @click="drawerVisible = true">打开抽屉</nue-button>

    <!-- 对话框：title + footer 插槽（可解构 close）做操作按钮 -->
    <nue-dialog v-model="dialogVisible" title="编辑用户">
        <nue-div direction="column" gap="var(--nue-gap-df)">
            <nue-input v-model="form.name" placeholder="姓名" />
        </nue-div>
        <template #footer="{ close }">
            <nue-button theme="ghost" @click="close">取消</nue-button>
            <nue-button theme="primary" @click="saveUser(close)">保存</nue-button>
        </template>
    </nue-dialog>

    <!-- 抽屉：从右侧滑入 -->
    <nue-drawer v-model="drawerVisible" title="详情" open-from="right" span="400px">
        <nue-div style="padding: 1rem">抽屉内容</nue-div>
    </nue-drawer>
</template>
```

要点：v-model 即显示状态；插槽 `header/content/footer` 都解构 `close`；生命周期事件 `before-open/after-open/before-close/after-close` 可做"打开后聚焦、关闭前确认"等；Dialog 默认不可点遮罩关闭，需要时开 `allow-close-by-overlay`（Drawer 同）。

## 5. 确认/提示/输入流程（方法类）

来源演示：`apps/document/tutorial/feedback/confirm/basic.vue`、`.../prompt/basic.vue`、`.../message/quick-use.vue`

```vue
<script setup lang="ts">
import { NueConfirm, NueMessage, NuePrompt } from 'nue-ui'

const remove = () => {
    NueConfirm({
        title: '删除这条记录？',
        content: '删除后不可恢复。',
        confirmButtonText: '删除',
        cancelButtonText: '再想想'
    }).then(([isByCancel]) => {
        if (isByCancel) {
            NueMessage.info('已取消')
            return
        }
        // 真正的删除逻辑...
        NueMessage.success('删除成功')
    })
}

const askName = () => {
    NuePrompt({ title: '请输入姓名', placeholder: '姓名', confirmButtonText: '确定' }).then(
        ([isByCancel, value]) => {
            if (!isByCancel) NueMessage.log(`输入了：${value}`)
        }
    )
}
</script>

<template>
    <nue-button @click="remove">删除</nue-button>
    <nue-button @click="askName">输入姓名</nue-button>
    <!-- 快捷类型消息 -->
    <nue-button @click="NueMessage.error('出错了', 5000)">报错示例</nue-button>
</template>
```

要点：

- Confirm/Prompt 返回 Promise；点击确认或取消都会 resolve，用 `[isByCancel, result]` 判断，出错才 reject；
- Confirm 支持 `on-confirm`（异步亦可，执行期间按钮 loading）；`unuse-cancel-button` 可去掉取消钮；
- Message：`NueMessage.success/info/warn/error/log`；`duration: 0` 表示不自动消失；
- 用 tooltip 做轻量就地说明：`<nue-tooltip content="提示文字"><nue-button>?</nue-button></nue-tooltip>`。

## 6. 数据列表：加载状态 + 空态 + 滚动加载

```vue
<script setup lang="ts">
import { ref } from 'vue'

const list = ref<string[]>([])
const loading = ref(false)
const loadMore = () => {
    if (loading.value) return
    loading.value = true
    // 模拟请求
    setTimeout(() => {
        list.value.push(...['A', 'B', 'C'])
        loading.value = false
    }, 600)
}
</script>

<template>
    <nue-div v-if="list.length === 0 && !loading">
        <!-- 空态占位 -->
        <nue-empty description="暂无数据">
            <nue-button theme="primary" @click="loadMore">加载</nue-button>
        </nue-empty>
    </nue-div>

    <nue-infinite-scroll v-else height="300px" :loading="loading" @load-more="loadMore">
        <nue-div v-for="item in list" :key="item" class="row">{{ item }}</nue-div>
        <nue-div align="center" justify="center" style="padding: 0.5rem">
            <nue-icon v-if="loading" name="loading" spin />
            <nue-text v-else size="sm">没有更多了</nue-text>
        </nue-div>
    </nue-infinite-scroll>
</template>
```

其他数据展示组合：

- 徽标：`<nue-badge :value="count" :max="99"> <nue-button theme="icon" icon="bell" /> </nue-badge>`（见 badge 文档，徽标包在目标元素外）；
- 进度：`<nue-progress :percentage="64" />`（line），环形/仪表盘设 `type`；
- 折叠列表：`<nue-collapse v-model="actives" accordion>` + 若干 `<nue-collapse-item title="面板" name="p1">内容</nue-collapse-item>`（见 collapse 文档与 model-value.vue 演示）。

## 7. 下拉菜单

来源演示：`apps/document/tutorial/navigation/dropdown/`（用内置 item 组件）

```vue
<script setup lang="ts">
import { NueMessage } from 'nue-ui'

const onExecute = (id: string) => {
    NueMessage.info(`点击了：${id}`)
}
</script>

<template>
    <nue-dropdown trigger-text="更多操作" trigger-type="hover" @execute="onExecute">
        <nue-dropdown-item text="编辑" execute-id="edit" icon="edit" />
        <nue-dropdown-item text="删除" execute-id="delete" icon="delete" />
    </nue-dropdown>
</template>
```

要点：

- Dropdown 的选项机制：给菜单内任意可点元素加 `data-executeid="xxx"` 即可成为可执行选项，点击后父级 `@execute` 会收到该 id（`<nue-dropdown-item>` 内置组件用 `execute-id` 属性声明同一个标识）；
- `trigger-type` 可选 `click`/`hover`；`placement` 形如 `top-start`；跨组统一关闭可传 `group`（高级用法看文档）。