# IoC Container Pattern

## Overview

Dependency Injection (DI) through Inversion of Control (IoC) containers enables complete decoupling of interface definitions from concrete implementations. This is essential for:
- Testing (easily mock repositories)
- Platform switching (Web vs Mini Program HTTP clients)
- Dependency management in large codebases

## Simple IoC Container Implementation

```typescript
// packages/infrastructure/ioc/src/Container.ts
type Factory<T> = () => T

export class Container {
    private factories = new Map<string, Factory<any>>()
    private instances = new Map<string, any>()

    register<T>(key: string, factory: Factory<T>): void {
        this.factories.set(key, factory)
    }

    get<T>(key: string): T {
        if (!this.factories.has(key)) {
            throw new Error(`No factory registered for key: ${key}`)
        }

        if (!this.instances.has(key)) {
            const factory = this.factories.get(key)!
            this.instances.set(key, factory())
        }

        return this.instances.get(key) as T
    }

    clear(): void {
        this.instances.clear()
    }
}

// Singleton instance
export const container = new Container()
```

## Vue Composable for Container Access

```typescript
// packages/infrastructure/ioc/src/useContainer.ts
import { container } from './Container'

export function useContainer() {
    return container
}
```

## Repository Interface (Domain Layer)

```typescript
// packages/domain/order/src/domain/ports/IOrderRepository.ts
import { Order } from '../entities/Order'

export interface IOrderRepository {
    findById(id: string): Promise<Order | null>
    findByCustomerId(customerId: string): Promise<Order[]>
    save(order: Order): Promise<void>
    delete(id: string): Promise<void>
}
```

## HTTP Client Interface

```typescript
// packages/infrastructure/api-client/src/IHttpClient.ts
export interface IHttpClient {
    get<T>(url: string, config?: any): Promise<T>
    post<T>(url: string, data?: any, config?: any): Promise<T>
    put<T>(url: string, data?: any, config?: any): Promise<T>
    delete<T>(url: string, config?: any): Promise<T>
}
```

## Web Implementation (Fetch-based)

```typescript
// packages/infrastructure/api-client/src/WebHttpClient.ts
import { IHttpClient } from './IHttpClient'

export class WebHttpClient implements IHttpClient {
    private baseUrl: string

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl
    }

    async get<T>(url: string, config?: any): Promise<T> {
        const response = await fetch(`${this.baseUrl}${url}`, {
            method: 'GET',
            ...config
        })
        return response.json()
    }

    async post<T>(url: string, data?: any, config?: any): Promise<T> {
        const response = await fetch(`${this.baseUrl}${url}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            ...config
        })
        return response.json()
    }

    // ... put, delete implementations
}
```

## Mini Program Implementation (uni.request-based)

```typescript
// packages/infrastructure/api-client/src/MiniappHttpClient.ts
import { IHttpClient } from './IHttpClient'

export class MiniappHttpClient implements IHttpClient {
    private baseUrl: string

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl
    }

    async get<T>(url: string, config?: any): Promise<T> {
        return new Promise((resolve, reject) => {
            uni.request({
                url: `${this.baseUrl}${url}`,
                method: 'GET',
                success: (res) => resolve(res.data as T),
                fail: reject,
                ...config
            })
        })
    }

    // ... post, put, delete implementations
}
```

## Repository Implementation

```typescript
// packages/infrastructure/repositories/src/HttpOrderRepository.ts
import { IOrderRepository } from '@scope/domain-order'
import { Order } from '@scope/domain-order'
import { IHttpClient } from '../api-client/IHttpClient'

export class HttpOrderRepository implements IOrderRepository {
    constructor(private httpClient: IHttpClient) {}

    async findById(id: string): Promise<Order | null> {
        const data = await this.httpClient.get<any>(`/orders/${id}`)
        return data ? this.hydrateOrder(data) : null
    }

    async findByCustomerId(customerId: string): Promise<Order[]> {
        const data = await this.httpClient.get<any[]>(`/customers/${customerId}/orders`)
        return data.map(item => this.hydrateOrder(item))
    }

    async save(order: Order): Promise<void> {
        await this.httpClient.post('/orders', {
            id: order.id,
            customerId: order.customerId,
            // ... map order properties
        })
    }

    async delete(id: string): Promise<void> {
        await this.httpClient.delete(`/orders/${id}`)
    }

    private hydrateOrder(data: any): Order {
        // Convert plain data to domain entity
        return new Order(
            data.id,
            data.customerId,
            // ... hydrate value objects
        )
    }
}
```

## Container Configuration (App Startup)

```typescript
// apps/web/src/main.ts
import { createApp } from 'vue'
import { container } from '@scope/infrastructure/ioc'
import { WebHttpClient } from '@scope/infrastructure/api-client'
import { HttpOrderRepository } from '@scope/infrastructure/repositories'
import { OrderApplicationService } from '@scope/domain-order'
import App from './App.vue'

// Configure HttpClient based on platform
const httpClient = new WebHttpClient(import.meta.env.VITE_API_BASE_URL)

// Register repositories
container.register('IOrderRepository', () => 
    new HttpOrderRepository(httpClient)
)

// Register application services
container.register('OrderApplicationService', () => 
    new OrderApplicationService(
        container.get('IOrderRepository'),
        container.get('IEventBus')
    )
)

createApp(App).mount('#app')
```

## Testing with Mocks

```typescript
// packages/domain/order/tests/OrderApplicationService.test.ts
import { describe, it, expect, vi } from 'vitest'
import { Container } from '@scope/infrastructure/ioc'
import { OrderApplicationService } from '../src/application/services/OrderApplicationService'

describe('OrderApplicationService', () => {
    it('should place order successfully', async () => {
        // Create test container with mocks
        const testContainer = new Container()
        
        // Mock repository
        const mockRepo = {
            save: vi.fn().mockResolvedValue(undefined)
        }
        testContainer.register('IOrderRepository', () => mockRepo)
        
        // Mock event bus
        const mockEventBus = {
            publish: vi.fn()
        }
        testContainer.register('IEventBus', () => mockEventBus)

        // Create service with dependencies
        const service = new OrderApplicationService(
            testContainer.get('IOrderRepository'),
            testContainer.get('IEventBus')
        )

        // Execute test
        const result = await service.placeOrder({
            orderId: 'test-001',
            customerId: 'customer-001',
            items: []
        })

        // Assertions
        expect(mockRepo.save).toHaveBeenCalled()
        expect(mockEventBus.publish).toHaveBeenCalled()
    })
})
```

## Platform-Specific Configuration

```typescript
// packages/infrastructure/api-client/src/index.ts
import { IHttpClient } from './IHttpClient'
import { WebHttpClient } from './WebHttpClient'
import { MiniappHttpClient } from './MiniappHttpClient'

// Platform detection at runtime
export function createHttpClient(baseUrl: string): IHttpClient {
    // #ifdef H5
    return new WebHttpClient(baseUrl)
    // #endif

    // #ifdef MP-WEIXIN
    return new MiniappHttpClient(baseUrl)
    // #endif

    throw new Error('Unsupported platform')
}
```

## Benefits

1. **Testability**: Easy to mock dependencies for unit tests
2. **Platform Agnostic**: Switch HTTP implementations based on platform
3. **Flexibility**: Change implementations without affecting domain code
4. **Centralized Configuration**: All dependencies registered in one place
5. **Singleton Management**: Container handles instance lifecycle

## Best Practices

1. **Register at Startup**: All registrations should happen during application initialization
2. **Interface First**: Always depend on interfaces, not concrete implementations
3. **Constructor Injection**: Prefer constructor injection over service locator pattern
4. **Clear Naming**: Use interface names as registration keys (e.g., `'IOrderRepository'`)
5. **Test Isolation**: Create fresh container instances for each test to avoid state leakage
6. **Avoid Overuse**: Don't inject everything - simple utilities can be imported directly
