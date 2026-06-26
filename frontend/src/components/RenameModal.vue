<template>
  <div class="overlay" @click.self="$emit('close')">
    <div class="modal">
      <h2>{{ heading }}</h2>
      <div class="field">
        <label>{{ label }}</label>
        <input ref="inp" v-model="value" type="text" @keyup.enter="save" />
      </div>
      <div class="error">{{ error }}</div>
      <div class="actions">
        <button class="btn btn-ghost" @click="$emit('close')">Отмена</button>
        <button class="btn btn-primary" @click="save">Сохранить</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";

const props = withDefaults(
  defineProps<{
    heading?: string;
    label?: string;
    initial?: string;
  }>(),
  { heading: "Переименовать", label: "Название", initial: "" },
);
const emit = defineEmits<{
  (e: "close"): void;
  (e: "save", value: string): void;
}>();

const value = ref(props.initial);
const error = ref("");
const inp = ref<HTMLInputElement | null>(null);

function save() {
  const v = value.value.trim();
  if (!v) {
    error.value = "Укажите название.";
    return;
  }
  emit("save", v);
}

onMounted(() => {
  inp.value?.focus();
  inp.value?.select();
});
</script>
