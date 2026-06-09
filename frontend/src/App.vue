<template>
  <div class="topbar">
    <button @click="openSettings">⚙ Сервер</button>
  </div>

  <h1>Playable Studio</h1>
  <p class="subtitle">Playable ad builders</p>

  <div v-if="!server" class="banner">
    Сервер не настроен. Укажите публичный URL (ngrok), чтобы видеть и загружать страницы.
    <br /><button @click="openSettings">Указать сервер</button>
  </div>

  <div class="cards">
    <PageCard
      v-for="p in pages"
      :key="p.file"
      :page="p"
      @open="openViewer(p)"
      @remove="removePage(p)"
    />
    <UploadCard @click="openUpload()" @files="onDropped" />
  </div>

  <div class="status">{{ status }}</div>
  <footer>Marketing Tools · Playable Studio</footer>

  <UploadModal
    v-if="showUpload"
    :server="server"
    :initial-file="pendingFile"
    @close="closeUpload"
    @uploaded="onUploaded"
  />
  <SettingsModal
    v-if="showSettings"
    :current="server"
    @close="showSettings = false"
    @save="saveServer"
  />
  <PageViewer
    v-if="viewer.open"
    :title="viewer.title"
    :url="viewer.blobUrl"
    @back="closeViewer"
  />
</template>

<script setup>
import { ref, onMounted } from "vue";
import PageCard from "./components/PageCard.vue";
import UploadCard from "./components/UploadCard.vue";
import UploadModal from "./components/UploadModal.vue";
import SettingsModal from "./components/SettingsModal.vue";
import PageViewer from "./components/PageViewer.vue";
import * as api from "./api.js";

const server = ref("");
const pages = ref([]);
const status = ref("");
const showUpload = ref(false);
const showSettings = ref(false);
const pendingFile = ref(null);
const viewer = ref({ open: false, title: "", blobUrl: "" });

let currentBlob = null;

async function load() {
  server.value = await api.resolveServer();
  if (!server.value) {
    pages.value = [];
    return;
  }
  try {
    pages.value = await api.listPages(server.value);
    status.value = "";
  } catch (e) {
    status.value =
      "⚠️ Не удалось связаться с сервером (" + e.message +
      "). Проверь, что сервер и ngrok запущены, и адрес указан верно.";
  }
}

function openUpload(file = null) {
  if (!server.value) {
    openSettings();
    return;
  }
  pendingFile.value = file;
  showUpload.value = true;
}
function closeUpload() {
  showUpload.value = false;
  pendingFile.value = null;
}
function onDropped(file) {
  openUpload(file);
}
async function onUploaded() {
  closeUpload();
  status.value = "✅ Загружено.";
  await load();
}

async function removePage(p) {
  if (!confirm('Удалить "' + (p.title || p.file) + '"?')) return;
  try {
    await api.deletePage(server.value, p.file);
    status.value = "Удалено: " + (p.title || p.file);
    await load();
  } catch (e) {
    status.value = "⚠️ Не удалось удалить: " + e.message;
  }
}

async function openViewer(p) {
  viewer.value = { open: true, title: p.title || p.file, blobUrl: "" };
  try {
    if (currentBlob) URL.revokeObjectURL(currentBlob);
    currentBlob = await api.fetchPageBlobUrl(server.value, p.file);
    viewer.value.blobUrl = currentBlob;
  } catch (e) {
    status.value = "⚠️ Не удалось открыть страницу: " + e.message;
    viewer.value = { open: false, title: "", blobUrl: "" };
  }
}
function closeViewer() {
  viewer.value = { open: false, title: "", blobUrl: "" };
  if (currentBlob) {
    URL.revokeObjectURL(currentBlob);
    currentBlob = null;
  }
}

function openSettings() {
  showSettings.value = true;
}
function saveServer(url) {
  api.setOverride(url);
  showSettings.value = false;
  load();
}

onMounted(load);
</script>
