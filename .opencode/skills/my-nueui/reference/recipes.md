# Business Component Recipes

Practical, copy-pasteable patterns for common web UI needs. Each recipe includes the complete template, script, and notes on state handling. All examples assume `app.use(NueUI)` and both theme CSS imports are in place.

## Search Bar

Debounced search input with a search button.

```vue
<template>
  <NueDiv gap="8px" align="center">
    <NueInput
      v-model="query"
      placeholder="Search..."
      icon="search"
      clearable
      :debounceTime="300"
      @change="handleSearch"
    />
    <NueButton theme="primary" icon="search" @click="handleSearch">Search</NueButton>
  </NueDiv>
</template>

<script lang="ts" setup>
import { ref } from 'vue';

const query = ref('');

function handleSearch() {
  if (!query.value.trim()) return;
  // Call your search API with query.value
}
</script>
```

**Key points:** `debounceTime` on the input avoids firing on every keystroke. The button provides an explicit trigger. `clearable` lets users quickly reset.

## Login Form

Username + password + remember-me checkbox. Includes loading state on submit.

```vue
<template>
  <NueDiv vertical gap="16px" width="360px">
    <NueText tag="h2" size="xl" weight="bold">Sign In</NueText>

    <NueInput
      v-model="form.username"
      placeholder="Username"
      icon="user"
      clearable
      :disabled="loading"
    />

    <NueInput
      v-model="form.password"
      type="password"
      placeholder="Password"
      allowShowPassword
      :disabled="loading"
    />

    <NueCheckbox v-model="form.remember" label="Remember me" :disabled="loading" />

    <NueButton
      theme="primary"
      :loading="loading"
      :useThrottle="true"
      :throttleDuration="500"
      @click="handleLogin"
    >
      Sign In
    </NueButton>

    <NueDivider text="or" alignment="center" />

    <NueButton theme="ghost" icon="mail" @click="handleSSO">Sign in with SSO</NueButton>
  </NueDiv>
</template>

<script lang="ts" setup>
import { reactive, ref } from 'vue';
import { NueMessage } from 'nue-ui';

const form = reactive({
  username: '',
  password: '',
  remember: false,
});
const loading = ref(false);

async function handleLogin() {
  if (!form.username || !form.password) {
    NueMessage.warn('Please fill in all fields');
    return;
  }
  loading.value = true;
  try {
    // await authApi.login(form);
    NueMessage.success('Welcome back!');
  } catch {
    NueMessage.error('Login failed. Please check your credentials.');
  } finally {
    loading.value = false;
  }
}

function handleSSO() {
  // Redirect to SSO provider
}
</script>
```

**Key points:** `loading` disables all inputs during submission. `useThrottle` prevents double-clicks. `NueDivider` separates primary and alternative login methods. All feedback goes through `NueMessage`.

## Registration Form

Full registration with validation and async submission.

```vue
<template>
  <NueDiv vertical gap="16px" width="400px">
    <NueText tag="h2" size="xl" weight="bold">Create Account</NueText>

    <NueInput v-model="form.name" placeholder="Full name" icon="user" clearable :disabled="loading" />
    <NueInput v-model="form.email" placeholder="Email" icon="mail" clearable :disabled="loading" />
    <NueInput v-model="form.password" type="password" placeholder="Password" allowShowPassword :disabled="loading" />
    <NueInput v-model="form.confirmPassword" type="password" placeholder="Confirm password" allowShowPassword :disabled="loading" />

    <NueSelect v-model="form.role" placeholder="Role" :disabled="loading">
      <NueSelectOption label="Developer" value="dev" />
      <NueSelectOption label="Designer" value="design" />
      <NueSelectOption label="Manager" value="manager" />
    </NueSelect>

    <NueSwitch v-model="form.newsletter" label="Subscribe to newsletter" :disabled="loading" />

    <NueButton theme="primary" :loading="loading" :useThrottle="true" @click="handleRegister">
      Create Account
    </NueButton>

    <NueText size="sm" color="var(--nue-secondary-text-color)" align="center">
      Already have an account? <NueLink href="/login">Sign in</NueLink>
    </NueText>
  </NueDiv>
</template>

<script lang="ts" setup>
import { reactive, ref } from 'vue';
import { NueMessage } from 'nue-ui';

const form = reactive({
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  role: '',
  newsletter: false,
});
const loading = ref(false);

async function handleRegister() {
  if (!form.name || !form.email || !form.password) {
    NueMessage.warn('Please fill in all required fields');
    return;
  }
  if (form.password !== form.confirmPassword) {
    NueMessage.error('Passwords do not match');
    return;
  }
  loading.value = true;
  try {
    // await api.register(form);
    NueMessage.success('Account created! Check your email to verify.');
  } catch {
    NueMessage.error('Registration failed. Please try again.');
  } finally {
    loading.value = false;
  }
}
</script>
```

**Key points:** Client-side validation before submission. All inputs disabled during loading. Mix of input types (`NueInput`, `NueSelect`, `NueSwitch`, `NueLink`). Uses `NueMessage` for all feedback.

## User Card

Avatar + name + role badge + action dropdown.

```vue
<template>
  <NueDiv align="center" gap="12px" style="padding: var(--nue-padding-df); border: 1px solid var(--nue-border-color); border-radius: var(--nue-primary-radius)">
    <NueAvatar :src="user.avatar" :alt="user.name" size="48px" rounded />

    <NueDiv vertical gap="2px" style="flex: 1">
      <NueText weight="bold">{{ user.name }}</NueText>
      <NueText size="sm" color="var(--nue-secondary-text-color)">{{ user.email }}</NueText>
    </NueDiv>

    <NueBadge :value="user.role" theme="primary" />

    <NueDropdown triggerType="click" placement="bottom-end">
      <NueDropdownItem text="Edit" icon="edit" executeId="edit" />
      <NueDropdownItem text="Delete" icon="delete" executeId="delete" theme="danger" />
      <template #trigger="{ trigger }">
        <NueButton theme="icon" icon="more" @click="trigger" />
      </template>
    </NueDropdown>
  </NueDiv>
</template>

<script lang="ts" setup>
defineProps<{
  user: {
    name: string;
    email: string;
    avatar?: string;
    role: string;
  };
}>();

const emit = defineEmits<{
  edit: [user: typeof user];
  delete: [user: typeof user];
}>();

// Listen to dropdown @execute event on the parent
</script>
```

**Key points:** `NueDiv` for horizontal layout with flex. `NueAvatar` with rounded style and alt fallback. `NueBadge` for role display. `NueDropdown` with custom trigger slot for the "more" button. Design tokens used for padding, border, and radius.

## Confirm Delete Flow

Uses the programmatic `NueConfirm` API — no template needed.

```vue
<template>
  <NueButton theme="danger" icon="delete" @click="handleDelete">Delete Item</NueButton>
</template>

<script lang="ts" setup>
import { NueConfirm, NueMessage } from 'nue-ui';

async function handleDelete() {
  const [cancelled] = await NueConfirm({
    title: 'Delete item?',
    content: 'This action cannot be undone. The item will be permanently removed.',
    confirmButtonText: 'Delete',
    cancelButtonText: 'Cancel',
  });

  if (cancelled) return;

  try {
    // await api.deleteItem(id);
    NueMessage.success('Item deleted');
  } catch {
    NueMessage.error('Failed to delete item');
  }
}
</script>
```

**Key points:** `NueConfirm` returns `[isCancelled, result]` — destructure to check. Show success/error feedback via `NueMessage`. No need to manually manage dialog visibility.

## Filter Panel

Collapsible filter section with select, date picker, checkbox group, and action buttons.

```vue
<template>
  <NueCollapse v-model="activePanel" accordion>
    <NueCollapseItem title="Filters" name="filters">
      <NueDiv vertical gap="12px" style="padding: var(--nue-padding-df)">
        <NueDiv gap="12px" wrap="wrap">
          <NueSelect v-model="filters.status" placeholder="Status" clearable style="width: 180px">
            <NueSelectOption label="Active" value="active" />
            <NueSelectOption label="Inactive" value="inactive" />
            <NueSelectOption label="Pending" value="pending" />
          </NueSelect>

          <NueSelect v-model="filters.category" placeholder="Category" clearable style="width: 180px">
            <NueSelectOption label="Engineering" value="eng" />
            <NueSelectOption label="Design" value="design" />
            <NueSelectOption label="Marketing" value="mktg" />
          </NueSelect>

          <NueDatePicker v-model="filters.startDate" placeholder="Start date" clearable />
          <NueDatePicker v-model="filters.endDate" placeholder="End date" clearable />
        </NueDiv>

        <NueCheckboxGroup v-model="filters.tags">
          <NueCheckbox label="Urgent" name="urgent" />
          <NueCheckbox label="Reviewed" name="reviewed" />
          <NueCheckbox label="Blocked" name="blocked" />
        </NueCheckboxGroup>

        <NueDiv gap="8px">
          <NueButton theme="primary" icon="filter" @click="applyFilters">Apply</NueButton>
          <NueButton theme="ghost" icon="refresh" @click="resetFilters">Reset</NueButton>
        </NueDiv>
      </NueDiv>
    </NueCollapseItem>
  </NueCollapse>
</template>

<script lang="ts" setup>
import { reactive, ref } from 'vue';

const activePanel = ref<string[]>([]);

const defaultFilters = {
  status: '',
  category: '',
  startDate: null as string | null,
  endDate: null as string | null,
  tags: [] as string[],
};

const filters = reactive({ ...defaultFilters });

function applyFilters() {
  // Call API with filters
}

function resetFilters() {
  Object.assign(filters, defaultFilters);
  // Re-fetch unfiltered data
}
</script>
```

**Key points:** Filters wrapped in `NueCollapse` to save screen space. Mix of `NueSelect`, `NueDatePicker`, and `NueCheckboxGroup`. Reset button restores defaults. `clearable` on selects and date pickers for quick individual resets.

## Settings Drawer

A slide-in settings panel with form controls and save/cancel.

```vue
<template>
  <NueButton theme="ghost" icon="setting" @click="open = true">Settings</NueButton>

  <NueDrawer v-model="open" title="Settings" openFrom="right" :span="'400px'" allowCloseByOverlay>
    <NueDiv vertical gap="16px">
      <NueText weight="bold">Notifications</NueText>
      <NueSwitch v-model="settings.emailNotifications" label="Email notifications" />
      <NueSwitch v-model="settings.pushNotifications" label="Push notifications" />
      <NueSwitch v-model="settings.desktopNotifications" label="Desktop notifications" />

      <NueDivider />

      <NueText weight="bold">Appearance</NueText>
      <NueSwitch v-model="settings.darkMode" label="Dark mode" @change="toggleDarkMode" />
      <NueSelect v-model="settings.language" placeholder="Language">
        <NueSelectOption label="English" value="en" />
        <NueSelectOption label="中文" value="zh" />
        <NueSelectOption label="日本語" value="ja" />
      </NueSelect>
    </NueDiv>

    <template #footer="{ close }">
      <NueButton @click="close">Cancel</NueButton>
      <NueButton theme="primary" :loading="saving" @click="save(close)">Save</NueButton>
    </template>
  </NueDrawer>
</template>

<script lang="ts" setup>
import { reactive, ref } from 'vue';
import { NueMessage } from 'nue-ui';

const open = ref(false);
const saving = ref(false);

const settings = reactive({
  emailNotifications: true,
  pushNotifications: false,
  desktopNotifications: true,
  darkMode: false,
  language: 'en',
});

function toggleDarkMode(value: boolean) {
  document.documentElement.style.setProperty('--nue-dark-switch', value ? '1' : '0');
}

async function save(close: () => void) {
  saving.value = true;
  try {
    // await api.saveSettings(settings);
    NueMessage.success('Settings saved');
    close();
  } catch {
    NueMessage.error('Failed to save settings');
  } finally {
    saving.value = false;
  }
}
</script>
```

**Key points:** `NueDrawer` with `openFrom="right"` for a standard settings panel. `#footer` slot exposes `close` for programmatic dismissal. `NueDivider` separates setting groups. `NueSwitch` groups for boolean settings, `NueSelect` for choice settings. Dark mode toggle wires directly to `--nue-dark-switch`.

## Infinite Scroll List

A scrollable list that loads more items as the user scrolls down. Includes loading, empty, and "no more" states.

```vue
<template>
  <NueDiv vertical gap="16px">
    <NueDiv gap="12px" align="center">
      <NueInput v-model="search" placeholder="Search items..." icon="search" clearable :debounceTime="300" />
      <NueButton theme="primary" icon="plus" @click="createItem">New</NueButton>
    </NueDiv>

    <NueInfiniteScroll
      height="500px"
      :disabled="noMore"
      :loading="loading"
      @loadMore="fetchItems"
    >
      <NueEmpty v-if="!loading && items.length === 0" description="No items found">
        <NueButton theme="primary" @click="createItem">Create your first item</NueButton>
      </NueEmpty>

      <NueDiv v-else vertical gap="8px">
        <div
          v-for="item in items"
          :key="item.id"
          style="padding: var(--nue-padding-df); border: 1px solid var(--nue-border-color); border-radius: var(--nue-primary-radius); cursor: pointer"
          @click="selectItem(item)"
        >
          <NueDiv align="center" gap="12px">
            <NueAvatar :src="item.image" :alt="item.title" size="40px" rounded />
            <NueDiv vertical gap="2px" style="flex: 1">
              <NueText weight="bold">{{ item.title }}</NueText>
              <NueText size="sm" color="var(--nue-secondary-text-color)">{{ item.description }}</NueText>
            </NueDiv>
            <NueBadge :value="item.status" :theme="item.status === 'active' ? 'success' : 'warning'" />
          </NueDiv>
        </div>
      </NueDiv>

      <template #loading>
        <NueDiv align="center" justify="center" style="padding: var(--nue-padding-df)">
          <NueIcon name="loading" spin size="24px" />
          <NueText size="sm" color="var(--nue-secondary-text-color)">Loading more...</NueText>
        </NueDiv>
      </template>

      <template #disabled>
        <NueDivider text="No more items" alignment="center" />
      </template>
    </NueInfiniteScroll>
  </NueDiv>
</template>

<script lang="ts" setup>
import { ref } from 'vue';

interface Item {
  id: number;
  title: string;
  description: string;
  image?: string;
  status: string;
}

const search = ref('');
const items = ref<Item[]>([]);
const loading = ref(false);
const noMore = ref(false);
let page = 1;

async function fetchItems() {
  loading.value = true;
  try {
    // const newItems = await api.getItems({ page, search: search.value });
    const newItems: Item[] = [];
    if (newItems.length === 0) {
      noMore.value = true;
    } else {
      items.value.push(...newItems);
      page++;
    }
  } finally {
    loading.value = false;
  }
}

function createItem() {
  // Open create dialog/drawer
}

function selectItem(item: Item) {
  // Navigate or open detail
}
</script>
```

**Key points:** `NueInfiniteScroll` manages scroll detection — no manual `IntersectionObserver` code. `#loading` slot for the loading indicator (spinning icon + text). `#disabled` slot for "no more" state. `NueEmpty` for the initial empty state. `NueDivider` as a clean end-of-list marker. List items use design tokens for consistent styling.

---

## Recipe Dependency Summary

| Recipe | Components Used | Theme Packages Needed |
|--------|----------------|----------------------|
| Search Bar | `NueInput`, `NueButton`, `NueDiv` | shadlike + iconfont |
| Login Form | `NueInput`, `NueButton`, `NueCheckbox`, `NueDiv`, `NueText`, `NueDivider`, `NueMessage` | shadlike + iconfont |
| Registration Form | `NueInput`, `NueSelect`, `NueSwitch`, `NueButton`, `NueText`, `NueLink`, `NueDiv`, `NueMessage` | shadlike + iconfont |
| User Card | `NueAvatar`, `NueText`, `NueBadge`, `NueDropdown`, `NueButton`, `NueDiv` | shadlike + iconfont |
| Confirm Delete | `NueButton`, `NueConfirm`, `NueMessage` | shadlike + iconfont |
| Filter Panel | `NueCollapse`, `NueSelect`, `NueDatePicker`, `NueCheckboxGroup`, `NueButton`, `NueDiv` | shadlike + iconfont |
| Settings Drawer | `NueDrawer`, `NueSwitch`, `NueSelect`, `NueButton`, `NueText`, `NueDivider`, `NueDiv`, `NueMessage` | shadlike + iconfont |
| Infinite Scroll List | `NueInfiniteScroll`, `NueInput`, `NueButton`, `NueAvatar`, `NueText`, `NueBadge`, `NueEmpty`, `NueIcon`, `NueDivider`, `NueDiv` | shadlike + iconfont |
