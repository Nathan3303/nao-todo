<template>
    <nue-div class="date-selector">
        <nue-div v-if="dateMoment" class="date-selector__input-wrapper">
            <nue-input
                v-model="dateMoment"
                :debounce-time="1000"
                theme="small,pure"
                :type="('datetime-local' as never)"
            />
            <nue-button icon="clear" theme="small,ghost,icon,pure" @click="dateMoment = null" />
        </nue-div>
        <nue-button v-else theme="small" @click="handleAddDateByNow">设置截止时间</nue-button>
    </nue-div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useMoment, formatForDateTimeInput } from '@nao-todo/utils'
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
        if (modelValue) return formatForDateTimeInput(useMoment(modelValue))
        if (date) return formatForDateTimeInput(useMoment(date))
        return null
    },
    set(value) {
        if (value === 'NOW') {
            value = moment().toISOString()
        } else {
            value = value ? moment(value).toISOString() : null
        }
        emit('update:modelValue', value)
        emit('change', value)
    }
})

const handleAddDateByNow = () => {
    dateMoment.value = 'NOW'
}
</script>

<style scoped>
.date-selector {
    width: fit-content;
    align-items: center;
    gap: 0.25rem;
    border-radius: var(--nue-primary-radius);
}

.date-selector:hover {
    background-color: #f5f5f5;
}

.date-selector .date-selector__input-wrapper {
    gap: 0.5rem;
    padding: 0 0.5rem;
    border-radius: var(--nue-primary-radius);
    border: 1px solid var(--nue-divider-color);
    box-shadow: var(--nue-secondary-shadow);
    align-items: center;
}

.date-selector .nue-input--noshape {
    padding: 0;
}
</style>
