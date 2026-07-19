<script setup lang="ts">
import { APP_CONTEXT_KEY } from '@/context'
import { responsiveTypes } from '@nao-todo/shared'
import { computed, inject } from 'vue'
import AppAside from './aside.vue'
import AppFloatAside from './float-aside.vue'

defineOptions({ name: 'AppAsideAdapter' })
const { responsiveFlag } = inject(APP_CONTEXT_KEY)!
const isDisplayed = defineModel('displayed', { type: Boolean, default: false })
const emit = defineEmits<{ (e: 'resize', width: number): void }>()

const isMobile = computed(() => responsiveFlag.value <= responsiveTypes.MOBILE)
const asideStyles = computed(() => ({ width: !isDisplayed.value ? 'auto' : void 0 }))
</script>

<template>
    <template v-if="isMobile">
        <app-float-aside v-bind="$attrs" v-model="isDisplayed">
            <slot></slot>
        </app-float-aside>
    </template>
    <template v-else>
        <nue-aside v-bind="$attrs" :style="asideStyles" style="padding: 0">
            <app-aside>
                <slot></slot>
                <template #actions>
                    <slot name="actions"></slot>
                </template>
            </app-aside>
        </nue-aside>
        <nue-separator
            v-if="isDisplayed"
            op-target="previous"
            @resize="(w: number) => emit('resize', w)"
        />
    </template>
</template>

<style scoped></style>

