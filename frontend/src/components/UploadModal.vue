<template>
  <div class="overlay" @click.self="$emit('close')">
    <div class="modal">
      <h2>Загрузить страницу</h2>

      <div
        class="dropzone"
        :class="{ over: dragOver }"
        @click="input?.click()"
        @dragover.prevent="dragOver = true"
        @dragleave.prevent="dragOver = false"
        @drop.prevent="onDrop"
      >
        <input ref="input" type="file" accept=".html,.htm,text/html" hidden @change="onPick" />
        <template v-if="file"
          >Выбрано: <b>{{ file.name }}</b></template
        >
        <template v-else>Перетащите .html сюда или нажмите, чтобы выбрать</template>
      </div>

      <div class="field">
        <label>Название</label>
        <input v-model="title" type="text" placeholder="My Playable Builder" />
      </div>

      <div class="field">
        <label>Папка <span class="opt">(необязательно)</span></label>
        <input
          v-model="folder"
          type="text"
          list="folders-upload"
          placeholder="Без папки (корень)"
        />
        <datalist id="folders-upload">
          <option v-for="f in folders" :key="f" :value="f" />
        </datalist>
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

<script setup lang="ts">
import { ref, onMounted } from "vue";
import * as api from "@/api";
import { toMessage } from "@/utils/errors";

const props = withDefaults(
  defineProps<{
    server: string;
    initialFile?: File | null;
    initialFolder?: string;
    folders?: string[];
  }>(),
  { initialFile: null, initialFolder: "", folders: () => [] },
);
const emit = defineEmits<{
  (e: "close"): void;
  (e: "uploaded"): void;
}>();

const input = ref<HTMLInputElement | null>(null);
const file = ref<File | null>(null);
const title = ref("");
const folder = ref(props.initialFolder || "");
const error = ref("");
const busy = ref(false);
const dragOver = ref(false);

function setFile(f: File | null | undefined) {
  if (!f) return;
  if (!/\.html?$/i.test(f.name)) {
    error.value = "Файл должен быть .html";
    return;
  }
  error.value = "";
  file.value = f;
  if (!title.value) title.value = f.name.replace(/\.html?$/i, "");
}

function onPick(e: Event) {
  setFile((e.target as HTMLInputElement).files?.[0]);
}
function onDrop(e: DragEvent) {
  dragOver.value = false;
  setFile(e.dataTransfer?.files[0]);
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
      folder: folder.value.trim(),
      contentBase64,
    });
    emit("uploaded");
  } catch (e) {
    error.value = "Ошибка: " + toMessage(e);
  } finally {
    busy.value = false;
  }
}

onMounted(() => {
  if (props.initialFile) setFile(props.initialFile);
});
</script>
