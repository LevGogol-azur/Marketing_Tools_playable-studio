<template>
  <div class="overlay" @click.self="$emit('close')">
    <div class="modal">
      <h2>Переместить</h2>
      <p class="move-sub">«{{ page.title || page.file }}»</p>
      <div class="field">
        <label>Папка</label>
        <input type="text" v-model="folder" list="folders-move" placeholder="Без папки (корень)" />
        <datalist id="folders-move">
          <option v-for="f in folders" :key="f" :value="f" />
        </datalist>
        <div class="hint">Оставьте пустым, чтобы переместить в корень. Можно ввести новое имя папки.</div>
      </div>
      <div class="error">{{ error }}</div>
      <div class="actions">
        <button class="btn btn-ghost" @click="$emit('close')">Отмена</button>
        <button class="btn btn-primary" :disabled="busy" @click="save">
          <span v-if="busy" class="spinner-sm"></span>{{ busy ? "Сохранение…" : "Переместить" }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import * as api from "../api.js";

const props = defineProps({
  server: { type: String, required: true },
  page: { type: Object, required: true },
  folders: { type: Array, default: () => [] },
});
const emit = defineEmits(["close", "moved"]);

const folder = ref(props.page.folder || "");
const error = ref("");
const busy = ref(false);

async function save() {
  error.value = "";
  busy.value = true;
  try {
    await api.movePage(props.server, props.page.file, folder.value.trim());
    emit("moved");
  } catch (e) {
    error.value = "Ошибка: " + e.message;
  } finally {
    busy.value = false;
  }
}
</script>
