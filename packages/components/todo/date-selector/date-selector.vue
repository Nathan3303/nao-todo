<template>
    <nue-div class="date-selector">
        <nue-div v-if="dateMoment" class="date-selector__input-wrapper">
            <nue-input
                theme="small,noshape"
                type="datetime-local"
                v-model="dateMoment"
                :debounce-time="1000"
            />
            <nue-button theme="small,pure" icon="clear" @click="dateMoment = null" />
        </nue-div>
        <nue-button v-else theme="small" @click="handleSetDate"> 设置结束时间</nue-button>
    </nue-div>
</template>

<script setup lang="ts">
import moment from 'moment'
import { computed } from 'vue'

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
        if (modelValue && moment(modelValue).isValid()) {
            return modelValue
        }
        if (date) {
            const _m = moment(date).utcOffset(8)
            return _m.isValid() ? _m.format('YYYY-MM-DDTHH:mm') : null
        }
        return null
    },
    set(value) {
        emit('update:modelValue', value)
        emit('change', value)
    }
})

const handleSetDate = () => {
    dateMoment.value = moment().utcOffset(8).toISOString(true)
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
