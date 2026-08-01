# 前端 DDD 终极实践方案

这是一份整合了我们所有讨论的**前端 DDD 终极实践方案**。它融合了 Monorepo 管理、垂直切分、框架适配、可发布资产包等要点，可直接作为你项目的架构蓝图。

## 核心理念

- **业务逻辑是第一公民**：领域模型（实体、值对象、领域服务）是纯 TypeScript，不依赖任何框架。
- **垂直切分优先**：按限界上下文（订单、商品、会员）组织代码，每个上下文拥有完整的 `domain/application/presentation` 三层。
- **框架是插件**：表现层（composables/hooks）按框架适配，但通过独立包（`vue-domain-*`、`react-domain-*`）隔离，领域内核保持纯净。
- **应用层做胶水**：应用服务是单个用例的编排者，表现层组合多个应用服务以构建页面功能。
- **基础设施可替换**：仓储接口在领域层定义，具体实现在基础设施包中，通过依赖注入切换（Web API / 小程序 / 本地存储）。

---

## 1. Monorepo 结构总览

```text
ecommerce-platform/
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

**工具链**：pnpm workspace + Turborepo + TypeScript + ESLint + Prettier + Vitest。

---

## 2. 领域包内部结构（以 `packages/domain/order` 为例）

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

**注意**：领域包**不包含任何 UI 代码**，也没有 `presentation` 目录。它的 `package.json` 依赖只应有纯工具库（如 `date-fns`），绝不依赖 Vue/React。

---

## 3. 表现层适配器包（以 `packages/presentation/vue-order` 为例）

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

`package.json` 需要声明：

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

---

## 4. 核心代码示例

### 4.1 领域实体与应用服务（框架无关）

#### **实体 (Order.ts)**

```typescript
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
    // ...其他行为
}
```

#### **应用服务 (OrderApplicationService.ts)**

```typescript
import { IOrderRepository } from '../domain/ports/IOrderRepository'
import { IEventBus } from '../domain/ports/IEventBus'

export class OrderApplicationService {
    constructor(
        private orderRepo: IOrderRepository,
        private eventBus: IEventBus
    ) {}

    async placeOrder(cmd: PlaceOrderCommand): Promise<Order> {
        // 基础校验
        if (!cmd.items.length) throw new Error('订单项不能为空')
        // 创建聚合
        const order = new Order(cmd.orderId, cmd.customerId, cmd.totalMoney, cmd.address)
        // 执行领域行为
        const event = order.place()
        // 持久化
        await this.orderRepo.save(order)
        // 发布事件
        this.eventBus.publish(event)
        return order
    }
}
```

### 4.2 Vue Composable（表现层适配器）

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

### 4.3 页面中使用（胶水层）

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

## 5. 依赖注入与基础设施实现

### 5.1 IoC 容器配置

在 `packages/infrastructure/ioc` 中提供一个简易容器：

```typescript
export const container = new Container()
// 在应用启动时注册实现
container.register('IOrderRepository', () => new HttpOrderRepository(httpClient))
container.register('IEventBus', () => eventBusInstance)
container.register(
    'OrderApplicationService',
    () => new OrderApplicationService(container.get('IOrderRepository'), container.get('IEventBus'))
)
```

### 5.2 基础设施实现（按平台切换）

- `WebHttpClient` (基于 `fetch`) → 用于 Web 应用
- `MiniappHttpClient` (基于 `uni.request`) → 用于小程序
  通过条件编译或运行时判断注入不同实现。

---

## 6. 发布为 npm 包

**发布策略**：

- 领域内核包：`@your-scope/domain-order` (私有/公有均可)
- Vue 适配包：`@your-scope/vue-domain-order`
- 基础设施包：`@your-scope/infrastructure`
- 共享类型包：`@your-scope/shared`

**每个包的 `package.json` 要点**：

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

**版本管理**：使用 Changesets，统一管理多包版本和 Changelog。

---

## 7. 测试策略

| 层                         | 测试类型            | 工具                    | 说明                                        |
| -------------------------- | ------------------- | ----------------------- | ------------------------------------------- |
| domain                     | 单元测试            | Vitest                  | 纯逻辑，无 Mock，测试实体行为、值对象不变性 |
| application                | 单元测试            | Vitest + Mock 仓储      | 测试用例流程，Mock 仓储和事件总线           |
| presentation (composables) | 组件/组合式函数测试 | Vitest + Vue Test Utils | 测试 UI 状态逻辑，Mock 应用服务             |
| 页面                       | E2E                 | Playwright / Cypress    | 验证完整用户流程                            |

---

## 8. 总结：架构全景图

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
└─────────────────────────────┘
```

**核心优势**：

- **业务资产可跨项目复用**：领域包可通过 npm 安装到任何 Web、小程序、甚至 Node.js 后端。
- **UI 与业务彻底解耦**：更换前端框架只需重写表现层适配包，领域和应用层零改动。
- **团队并行开发**：领域专家维护 `domain-*`，UI 团队维护 `vue-domain-*` 和页面，互不阻塞。
- **符合 DDD 的限界上下文思想**：每个领域包是高内聚的独立单元，可独立演进、独立发布。

这就是你最终可落地的前端 DDD 实践方案。它结合了 Monorepo 的工程便利性与 DDD 的业务内聚性，同时兼顾了现代前端的框架多样性和小程序复用的现实需求。