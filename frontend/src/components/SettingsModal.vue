<template>
  <div class="overlay" @click.self="$emit('close')">
    <div class="modal">
      <h2>Адрес сервера</h2>
      <div class="field">
        <label>Публичный URL (ngrok)</label>
        <input type="url" v-model="url" placeholder="https://xxxx.ngrok-free.app" />
        <div class="hint">
          Обычно адрес берётся автоматически из <code>server-url.json</code> в репозитории.
          Это поле — локальный запасной вариант (если файла нет).
        </div>
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
import { ref } from "vue";

const props = defineProps({ current: { type: String, default: "" } });
const emit = defineEmits(["close", "save"]);

const url = ref(props.current || "");
const error = ref("");

function save() {
  if (!/^https?:\/\//i.test(url.value.trim())) {
    error.value = "Укажите URL, начиная с https://";
    return;
  }
  emit("save", url.value.trim());
}
</script>
