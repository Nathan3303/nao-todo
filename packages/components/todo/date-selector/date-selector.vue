<template>
    <nue-div class="date-selector" :data-expired="colored ? isExpired : void 0">
        <nue-div v-if="dateMoment" class="date-selector__input-wrapper" auto-fit>
            <nue-div align="center" gap="0.25rem">
                <nue-input
                    v-model="dateMoment"
                    :debounce-time="256"
                    theme="small,pure"
                    :type="'datetime-local' as never"
                />
                <!-- <nue-text size="0.75rem" color="#636363">{{ relativeDate }}</nue-text> -->
            </nue-div>
            <nue-divider vertical />
            <nue-button icon="clear" theme="small,icon,pure" @click="dateMoment = null" />
        </nue-div>
        <nue-button v-else theme="small" @click="handleAddDateByNow">设置截止时间</nue-button>
    </nue-div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
// import { useRelativeDate } from '@nao-todo/hooks'
import { useMoment, formatForDateTimeInput } from '@nao-todo/utils'
import moment from 'moment'

defineOptions({ name: 'TodoDateSelector' })
const props = defineProps<{
    colored?: boolean
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

const isExpired = computed(() => {
    if (!props.modelValue) return false
    return moment(props.modelValue).isBefore(moment())
})

// const relativeDate = computed(() => {
//     if (!props.modelValue) return ''
//     return useRelativeDate(props.modelValue)
// })

const handleAddDateByNow = () => {
    dateMoment.value = 'NOW'
}
</script>

<style scoped>
.date-selector {
    width: fit-content;
    align-items: center;

    .date-selector__input-wrapper {
        gap: 0.5rem;
        padding: 0 0.5rem;
        border-radius: var(--nue-primary-radius);
        border: 1px solid var(--nue-divider-color);
        box-shadow: var(--nue-secondary-shadow);
        align-items: center;

        .nue-input {
            padding: 0;
            margin: 0;

            &:deep(.nue-input__input) {
                width: 8rem;
            }
        }
    }

    &:hover {
        background-color: #f5f5f5;
    }

    &[data-expired='false'] .nue-input {
        --nue-input-color: rgb(112, 112, 255);
    }

    &[data-expired='true'] .nue-input {
        --nue-input-color: rgb(255, 74, 74);
    }
}
</style>

