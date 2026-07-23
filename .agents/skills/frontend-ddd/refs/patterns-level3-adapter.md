# Presentation Adapter Pattern

## Overview

The Presentation Adapter Pattern creates framework-specific wrapper packages around pure domain and application layers. This enables complete framework independence - the domain kernel can be used across Vue, React, or even backend applications.

## Structure

```text
packages/presentation/vue-order/
├── src/
│   ├── composables/      # Vue composables wrapping application services
│   ├── components/       # Domain-specific Vue components
│   ├── store/           # Pinia stores (optional)
│   └── index.ts
└── package.json
```

## Pattern 1: Composable with UI State

Encapsulates loading/error states for clean usage in components.

```typescript
// packages/presentation/vue-order/src/composables/usePlaceOrder.ts
import { ref, computed } from 'vue'
import { PlaceOrderCommand, OrderApplicationService } from '@scope/domain-order'
import { useContainer } from '@scope/infrastructure/ioc'

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

    return { 
        execute, 
        loading, 
        error,
        isError: computed(() => error.value !== null)
    }
}
```

## Pattern 2: Domain-Specific Component

```vue
<!-- packages/presentation/vue-order/src/components/OrderStatusBadge.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { OrderStatus } from '@scope/domain-order'

const props = defineProps<{
    status: OrderStatus
}>()

const statusConfig = computed(() => {
    const configs = {
        [OrderStatus.Pending]: { text: '待支付', class: 'bg-yellow-100 text-yellow-800' },
        [OrderStatus.Placed]: { text: '已下单', class: 'bg-green-100 text-green-800' },
        [OrderStatus.Shipped]: { text: '配送中', class: 'bg-blue-100 text-blue-800' },
        [OrderStatus.Delivered]: { text: '已送达', class: 'bg-gray-100 text-gray-800' }
    }
    return configs[props.status]
})
</script>

<template>
    <span :class="['px-2 py-1 rounded text-sm font-medium', statusConfig.class]">
        {{ statusConfig.text }}
    </span>
</template>
```

## Pattern 3: Store Adapter (Pinia)

```typescript
// packages/presentation/vue-order/src/store/useOrderStore.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { Order, OrderApplicationService } from '@scope/domain-order'
import { useContainer } from '@scope/infrastructure/ioc'

export const useOrderStore = defineStore('order', () => {
    const orders = ref<Order[]>([])
    const selectedOrderId = ref<string | null>(null)
    
    const orderService = useContainer().get<OrderApplicationService>('OrderApplicationService')

    const selectedOrder = computed(() => 
        orders.value.find(o => o.id === selectedOrderId.value) ?? null
    )

    async function placeOrder(cmd: { orderId: string; customerId: string; items: any[] }) {
        const order = await orderService.placeOrder(cmd)
        orders.value.push(order)
        return order
    }

    async function loadOrders() {
        // Implementation...
    }

    return {
        orders,
        selectedOrderId,
        selectedOrder,
        placeOrder,
        loadOrders
    }
})
```

## Usage in Application

```vue
<!-- apps/web/src/pages/orders/OrderListPage.vue -->
<script setup lang="ts">
import { onMounted } from 'vue'
import { useOrderStore } from '@scope/vue-domain-order'
import { OrderStatusBadge } from '@scope/vue-domain-order/components'
import { usePlaceOrder } from '@scope/vue-domain-order/composables'

const orderStore = useOrderStore()
const { execute: placeOrder, loading } = usePlaceOrder()

onMounted(() => {
    orderStore.loadOrders()
})
</script>
```

## Benefits

1. **Framework Independence**: Domain layer remains pure, can be shared across tech stacks
2. **Clean Separation**: UI concerns (loading states, error handling) stay in presentation layer
3. **Reusability**: Same domain logic powers Web, Admin, and Mini Program applications
4. **Testability**: Application services can be tested without Vue/Pinia
5. **Progressive Migration**: Can migrate from Vue 2 → Vue 3 → React with zero domain changes

## When to Use

- Multiple applications sharing business logic (Web + Admin + Mini Program)
- Expecting framework evolution or migration in the future
- Team split between domain experts and UI developers
- Need to share business logic with backend services
