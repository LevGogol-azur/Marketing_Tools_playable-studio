<template>
  <div class="overlay" @click.self="$emit('close')">
    <div class="modal">
      <h2>{{ heading }}</h2>
      <div class="field">
        <label>{{ label }}</label>
        <input ref="inp" type="text" v-model="value" @keyup.enter="save" />
      </div>
      <div class="error">{{ error }}</div>
      <div class="actions">
        <button class="btn btn-ghost" @click="$emit('close')">Отмена</button>
        <button class="btn btn-primary" @click="save">Сохранить</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";

const props = defineProps({
  heading: { type: String, default: "Переименовать" },
  label: { type: String, default: "Название" },
  initial: { type: String, default: "" },
});
const emit = defineEmits(["close", "save"]);

const value = ref(props.initial);
const error = ref("");
const inp = ref(null);

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
