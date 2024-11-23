<template>
    <nue-div class="date-selector">
        <nue-div v-if="dateMoment" class="date-selector__input-wrapper">
            <nue-input
                v-model="dateMoment"
                :debounce-time="1000"
                theme="small,noshape"
                type="datetime-local"
            />
            <nue-button icon="clear" theme="small,pure" @click="dateMoment = null" />
        </nue-div>
        <nue-button v-else theme="small" @click="handleSetDate">设置结束时间</nue-button>
    </nue-div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useMoment } from '@nao-todo/utils'
import moment from 'moment'

defineOptions({ name: 'TodoDateSelector' })
const props = defineProps<{
    modelValue?: string | null
    date?: Date | string | null
}>()
const emit = defineEmits<{
    (event: 'update:modelValue', value: string | null): void
    (event: 'change', value: string | null): void
}>()

const dateMoment = computed<string | null>({
    get() {
        const { modelValue, date } = props
        if (modelValue && useMoment(modelValue).isValid()) {
            return modelValue
        }
        if (date) {
            const m1 = useMoment(date)
            return m1.isValid() ? m1.toISOString(true).slice(0, 16) : null
        }
        return null
    },
    set(value) {
        value = moment(value).toISOString(true).slice(0, 16)
        emit('update:modelValue', value)
        emit('change', value)
    }
})

const handleSetDate = () => {
    dateMoment.value = useMoment().toISOString(true).slice(0, 16)
}
</script>

<style scoped>
.date-selector {
    width: fit-content;
    align-items: center;
    gap: 4px;
    border-radius: var(--primary-radius);
    height: 28px;

    &:hover {
        background-color: #f5f5f5;
    }

    .date-selector__input-wrapper {
        gap: 4px;
        padding: 0 8px;
        border-radius: var(--primary-radius);
        border: 1px solid var(--divider-color);
        box-shadow: var(--secondary-shadow);
    }

    .nue-input--noshape {
        padding: 0;
    }
}
</style>
