<template>
    <div class="tooltip-wrapper" @mouseover="visible = true" @mouseleave="visible = false">
        <slot></slot>
        <transition name="fade">
            <div
                v-show="visible"
                class="tooltip"
                @mouseover.stop
                @mouseleave.stop
                :data-align="align"
            >
                {{ content }}
            </div>
        </transition>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import type { TooltipProps, TooltipEmits } from './types'

defineOptions({ name: 'Tooltip' })
const props = withDefaults(defineProps<TooltipProps>(), {
    align: 'center'
})
const emit = defineEmits<TooltipEmits>()

const visible = ref(false)
</script>

<style scoped>
.tooltip-wrapper {
    position: relative;

    .tooltip {
        position: absolute;
        top: calc(100% + 6px);
        padding: 4px 8px;
        background-color: #333;
        color: #fff;
        border-radius: 0.2rem;
        transition: opacity 0.3s ease-in-out;
        z-index: 99;
        width: max-content;
        font-weight: 500;
        font-size: 11px;

        &[data-align='left'] {
            left: 0px;
            transform: translateX(0);
        }

        &[data-align='center'] {
            left: 50%;
            transform: translateX(-50%);
        }

        &[data-align='right'] {
            right: 0px;
            transform: translateX(0);
        }
    }
}

.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.3s ease-in-out;
}

.fade-enter,
.fade-leave-to {
    opacity: 0;
}
</style>
