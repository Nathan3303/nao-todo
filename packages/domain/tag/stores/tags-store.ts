import { useLoadingErrorStoreBase } from '@nao-todo/shared'
import { defineStore } from 'pinia'
import { useTagPreferenceStoreBase, useTagsStoreBase } from '../hooks'

export const useTagsStore = defineStore('TagsStore', () => {
    const { tags, setTags, addTag, getTag, updateTag, updateTags, getAllTags, deleteTag } =
        useTagsStoreBase()
    const {
        tagPreference,
        setTagPreference,
        getTagPreference,
        updatePreferenceColumns,
        updatePreferenceGetTasksOptions,
        getPreferenceGetTasksOption,
        getPreferenceGetTasksOptions
    } = useTagPreferenceStoreBase()

    const { loading, error, setLoading, setError } = useLoadingErrorStoreBase()

    const {
        loading: preferenceLoading,
        error: preferenceError,
        setLoading: setPreferenceLoading,
        setError: setPreferenceError
    } = useLoadingErrorStoreBase()

    // @returns
    return {
        // --- Tag ---
        tags,
        setTags,
        addTag,
        getTag,
        updateTag,
        updateTags,
        getAllTags,
        deleteTag,
        // --- Tag Preference ---
        tagPreference,
        setTagPreference,
        getTagPreference,
        updatePreferenceColumns,
        updatePreferenceGetTasksOptions,
        getPreferenceGetTasksOption,
        getPreferenceGetTasksOptions,
        // --- Tag Loading Error ---
        loading,
        error,
        setLoading,
        setError,
        // --- Tag Preference Loading Error ---
        preferenceLoading,
        preferenceError,
        setPreferenceLoading,
        setPreferenceError
    }
})
