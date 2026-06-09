<template>
  <div class="overlay" @click.self="$emit('close')">
    <div class="modal">
      <h2>Загрузить страницу</h2>

      <div
        class="dropzone"
        :class="{ over: dragOver }"
        @click="$refs.input.click()"
        @dragover.prevent="dragOver = true"
        @dragleave.prevent="dragOver = false"
        @drop.prevent="onDrop"
      >
        <input ref="input" type="file" accept=".html,.htm,text/html" hidden @change="onPick" />
        <template v-if="file">Выбрано: <b>{{ file.name }}</b></template>
        <template v-else>Перетащите .html сюда или нажмите, чтобы выбрать</template>
      </div>

      <div class="field">
        <label>Название</label>
        <input type="text" v-model="title" placeholder="My Playable Builder" />
      </div>

      <div class="error">{{ error }}</div>
      <div class="actions">
        <button class="btn btn-ghost" @click="$emit('close')">Отмена</button>
        <button class="btn btn-primary" :disabled="busy" @click="submit">
          <span v-if="busy" class="spinner-sm"></span>{{ busy ? "Загрузка…" : "Загрузить" }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import * as api from "../api.js";

const props = defineProps({
  server: { type: String, required: true },
  initialFile: { type: Object, default: null },
});
const emit = defineEmits(["close", "uploaded"]);

const file = ref(null);
const title = ref("");
const error = ref("");
const busy = ref(false);
const dragOver = ref(false);

function setFile(f) {
  if (!f) return;
  if (!/\.html?$/i.test(f.name)) {
    error.value = "Файл должен быть .html";
    return;
  }
  error.value = "";
  file.value = f;
  if (!title.value) title.value = f.name.replace(/\.html?$/i, "");
}

function onPick(e) {
  setFile(e.target.files[0]);
}
function onDrop(e) {
  dragOver.value = false;
  setFile(e.dataTransfer.files[0]);
}

async function submit() {
  error.value = "";
  if (!file.value) {
    error.value = "Выберите HTML-файл.";
    return;
  }
  if (!title.value.trim()) {
    error.value = "Укажите название.";
    return;
  }
  busy.value = true;
  try {
    const contentBase64 = await api.fileToBase64(file.value);
    await api.uploadPage(props.server, {
      filename: file.value.name,
      title: title.value.trim(),
      contentBase64,
    });
    emit("uploaded");
  } catch (e) {
    error.value = "Ошибка: " + e.message;
  } finally {
    busy.value = false;
  }
}

onMounted(() => {
  if (props.initialFile) setFile(props.initialFile);
});
</script>
