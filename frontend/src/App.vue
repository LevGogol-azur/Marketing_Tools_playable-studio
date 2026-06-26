<template>
  <nav class="nav container">
    <div class="brand"><span class="logo-dot"></span> Playable Studio</div>
    <button class="btn btn-ghost btn-sm" @click="openSettings">⚙ Сервер</button>
  </nav>

  <main class="container">
    <section class="hero">
      <h1>Playable Studio</h1>
      <p class="subtitle">Playable ad builders</p>
    </section>

    <div v-if="!server" class="banner">
      Сервер не настроен. Укажите публичный URL (ngrok), чтобы видеть и загружать страницы.
      <br /><button @click="openSettings">Указать сервер</button>
    </div>

    <section>
      <div class="section-head">
        <template v-if="currentFolder">
          <button class="crumb" @click="currentFolder = null">Builders</button>
          <span class="crumb-sep">/</span>
          <h2>{{ currentFolder }}</h2>
          <button
            class="icon-btn head-rename"
            title="Переименовать папку"
            @click="openRenameFolder(currentFolder)"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.9"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
            </svg>
          </button>
          <span class="count">{{ visiblePages.length }}</span>
        </template>
        <template v-else>
          <h2>Builders</h2>
          <span class="count">{{ pages.length }}</span>
        </template>
      </div>

      <div class="cards">
        <template v-if="!currentFolder">
          <FolderCard
            v-for="f in folderList"
            :key="'folder:' + f.name"
            :name="f.name"
            :count="f.count"
            @open="currentFolder = f.name"
            @drop-page="moveDragged(f.name)"
          />
        </template>
        <PageCard
          v-for="p in visiblePages"
          :key="p.file"
          :page="p"
          @open="openViewer(p)"
          @move="openMove(p)"
          @rename="openRenameFile(p)"
          @chat="chatting = p"
          @remove="removePage(p)"
          @prefetch="onPrefetch(p)"
          @dragstart="draggedPage = p"
          @dragend="draggedPage = null"
        />
        <UploadCard @click="openUpload()" @files="onDropped" />
      </div>
    </section>

    <div class="status">{{ status }}</div>
  </main>

  <footer>Marketing Tools · Playable Studio</footer>

  <UploadModal
    v-if="showUpload"
    :server="server"
    :initial-file="pendingFile"
    :initial-folder="currentFolder || ''"
    :folders="folderNames"
    @close="closeUpload"
    @uploaded="onUploaded"
  />
  <MoveModal
    v-if="moving"
    :server="server"
    :page="moving"
    :folders="folderNames"
    @close="moving = null"
    @moved="onMoved"
  />
  <RenameModal
    v-if="renaming"
    :heading="renaming.heading"
    :label="renaming.label"
    :initial="renaming.initial"
    @close="renaming = null"
    @save="onRename"
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
    :loading="viewer.loading"
    @back="closeViewer"
  />
  <ChatPanel
    v-if="chatting"
    :server="server"
    :page="chatting"
    @close="chatting = null"
    @created="onAgentCreated"
    @open="openViewer"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import PageCard from "@/components/PageCard.vue";
import FolderCard from "@/components/FolderCard.vue";
import UploadCard from "@/components/UploadCard.vue";
import UploadModal from "@/components/UploadModal.vue";
import MoveModal from "@/components/MoveModal.vue";
import RenameModal from "@/components/RenameModal.vue";
import ChatPanel from "@/components/ChatPanel.vue";
import SettingsModal from "@/components/SettingsModal.vue";
import PageViewer from "@/components/PageViewer.vue";
import * as api from "@/api";
import { toMessage } from "@/utils/errors";
import type { FolderEntry, Page, RenameState, ViewerState } from "@/types";

const server = ref("");
const pages = ref<Page[]>([]);
const status = ref("");
const showUpload = ref(false);
const showSettings = ref(false);
const pendingFile = ref<File | null>(null);
const moving = ref<Page | null>(null);
const renaming = ref<RenameState | null>(null);
const chatting = ref<Page | null>(null);
const currentFolder = ref<string | null>(null);
const draggedPage = ref<Page | null>(null);
const viewer = ref<ViewerState>({ open: false, title: "", blobUrl: "", loading: false });

const folderOf = (p: Page): string => (p.folder || "").trim();

// Distinct folders (derived from page entries) with counts, sorted.
const folderList = computed<FolderEntry[]>(() => {
  const counts = new Map<string, number>();
  for (const p of pages.value) {
    const f = folderOf(p);
    if (f) counts.set(f, (counts.get(f) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
});
const folderNames = computed(() => folderList.value.map((f) => f.name));

// Pages shown in the current view: a folder's contents, or the ungrouped (root) pages.
const visiblePages = computed(() =>
  currentFolder.value
    ? pages.value.filter((p) => folderOf(p) === currentFolder.value)
    : pages.value.filter((p) => !folderOf(p)),
);

async function load() {
  server.value = await api.resolveServer();
  if (!server.value) {
    pages.value = [];
    return;
  }
  try {
    pages.value = await api.listPages(server.value);
    status.value = "";
    // Left a folder that no longer has any pages → return to root.
    if (currentFolder.value && !pages.value.some((p) => folderOf(p) === currentFolder.value)) {
      currentFolder.value = null;
    }
  } catch (e) {
    status.value =
      "⚠️ Не удалось связаться с сервером (" +
      toMessage(e) +
      "). Проверь, что сервер и ngrok запущены, и адрес указан верно.";
  }
}

function openUpload(file: File | null = null) {
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
function onDropped(file: File) {
  openUpload(file);
}
async function onUploaded() {
  closeUpload();
  status.value = "✅ Загружено.";
  await load();
}

function openMove(p: Page) {
  moving.value = p;
}

function openRenameFile(p: Page) {
  renaming.value = {
    kind: "file",
    page: p,
    heading: "Переименовать билдер",
    label: "Название",
    initial: p.title || p.file,
  };
}
function openRenameFolder(name: string) {
  renaming.value = {
    kind: "folder",
    folder: name,
    heading: "Переименовать папку",
    label: "Название папки",
    initial: name,
  };
}
async function onRename(newValue: string) {
  const r = renaming.value;
  if (!r) return;
  try {
    if (r.kind === "file") {
      await api.renamePage(server.value, r.page.file, newValue);
      status.value = "Переименовано.";
    } else {
      // Rename a folder = reassign every page inside it to the new folder name.
      const inFolder = pages.value.filter((p) => folderOf(p) === r.folder);
      for (const p of inFolder) await api.movePage(server.value, p.file, newValue);
      if (currentFolder.value === r.folder) currentFolder.value = newValue;
      status.value = "Папка переименована.";
    }
    renaming.value = null;
    await load();
  } catch (e) {
    status.value = "⚠️ Не удалось переименовать: " + toMessage(e);
  }
}
async function onMoved() {
  moving.value = null;
  status.value = "Перемещено.";
  await load();
}

// Drag a builder card onto a folder card to move it there.
async function moveDragged(folder: string) {
  const p = draggedPage.value;
  draggedPage.value = null;
  if (!p || folderOf(p) === folder) return;
  try {
    await api.movePage(server.value, p.file, folder);
    status.value = "«" + (p.title || p.file) + "» → " + folder;
    await load();
  } catch (e) {
    status.value = "⚠️ Не удалось переместить: " + toMessage(e);
  }
}

async function removePage(p: Page) {
  if (!confirm('Удалить "' + (p.title || p.file) + '"?')) return;
  try {
    await api.deletePage(server.value, p.file);
    status.value = "Удалено: " + (p.title || p.file);
    await load();
  } catch (e) {
    status.value = "⚠️ Не удалось удалить: " + toMessage(e);
  }
}

function onPrefetch(p: Page) {
  api.prefetchPage(server.value, p.file);
}

async function openViewer(p: Page) {
  viewer.value = { open: true, title: p.title || p.file, blobUrl: "", loading: true };
  try {
    // Blob URLs are cached for the session by api.js, so re-opening is instant.
    viewer.value.blobUrl = await api.fetchPageBlobUrl(server.value, p.file);
  } catch (e) {
    status.value = "⚠️ Не удалось открыть страницу: " + toMessage(e);
    viewer.value = { open: false, title: "", blobUrl: "", loading: false };
  } finally {
    viewer.value.loading = false;
  }
}
function closeViewer() {
  viewer.value = { open: false, title: "", blobUrl: "", loading: false };
}

// Agent finished and saved a new -ai copy. Refresh the list so the card appears;
// the user opens the result via the "Открыть результат" button (-> openViewer).
async function onAgentCreated(page: Page) {
  status.value = "✅ AI-вариант создан: " + (page.title || page.file);
  await load();
}

function openSettings() {
  showSettings.value = true;
}
function saveServer(url: string) {
  api.setOverride(url);
  showSettings.value = false;
  load();
}

onMounted(load);
</script>
