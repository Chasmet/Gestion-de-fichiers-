const DB_NAME = "gestionnaire-mobile-db-v1";
const DB_VERSION = 1;

let db;
let currentFolderId = "root";
let selectedItem = null;
let searchMode = false;

const defaultFolders = [
  { id: "images", name: "Images", parentId: "root", type: "folder", createdAt: Date.now() },
  { id: "videos", name: "Vidéos", parentId: "root", type: "folder", createdAt: Date.now() },
  { id: "audio", name: "Audio", parentId: "root", type: "folder", createdAt: Date.now() },
  { id: "documents", name: "Documents", parentId: "root", type: "folder", createdAt: Date.now() },
  { id: "downloads", name: "Téléchargements", parentId: "root", type: "folder", createdAt: Date.now() },
  { id: "projects", name: "Mes projets", parentId: "root", type: "folder", createdAt: Date.now() },
  { id: "trash", name: "Corbeille", parentId: "root", type: "folder", createdAt: Date.now() }
];

const els = {
  storageInfo: document.getElementById("storageInfo"),
  btnSearch: document.getElementById("btnSearch"),
  searchPanel: document.getElementById("searchPanel"),
  searchInput: document.getElementById("searchInput"),
  btnClearSearch: document.getElementById("btnClearSearch"),

  btnHome: document.getElementById("btnHome"),
  btnBack: document.getElementById("btnBack"),
  breadcrumb: document.getElementById("breadcrumb"),

  btnNewFolder: document.getElementById("btnNewFolder"),
  btnImport: document.getElementById("btnImport"),
  fileInput: document.getElementById("fileInput"),

  quickFolders: document.getElementById("quickFolders"),
  currentTitle: document.getElementById("currentTitle"),
  itemsCount: document.getElementById("itemsCount"),
  itemsGrid: document.getElementById("itemsGrid"),
  emptyState: document.getElementById("emptyState"),

  optionsModal: document.getElementById("optionsModal"),
  modalTitle: document.getElementById("modalTitle"),
  btnOpenItem: document.getElementById("btnOpenItem"),
  btnRenameItem: document.getElementById("btnRenameItem"),
  btnDownloadItem: document.getElementById("btnDownloadItem"),
  btnDeleteItem: document.getElementById("btnDeleteItem"),
  btnCloseModal: document.getElementById("btnCloseModal"),

  navHome: document.getElementById("navHome"),
  navImages: document.getElementById("navImages"),
  navVideos: document.getElementById("navVideos"),
  navAudio: document.getElementById("navAudio"),
  navDocs: document.getElementById("navDocs")
};

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject("Erreur IndexedDB");

    request.onupgradeneeded = event => {
      const database = event.target.result;

      if (!database.objectStoreNames.contains("items")) {
        const store = database.createObjectStore("items", { keyPath: "id" });
        store.createIndex("parentId", "parentId", { unique: false });
        store.createIndex("type", "type", { unique: false });
      }
    };

    request.onsuccess = event => {
      db = event.target.result;
      resolve(db);
    };
  });
}

function tx(storeName, mode = "readonly") {
  return db.transaction(storeName, mode).objectStore(storeName);
}

function addItem(item) {
  return new Promise((resolve, reject) => {
    const request = tx("items", "readwrite").put(item);
    request.onsuccess = () => resolve(item);
    request.onerror = () => reject("Erreur ajout");
  });
}

function getItem(id) {
  return new Promise(resolve => {
    const request = tx("items").get(id);
    request.onsuccess = () => resolve(request.result || null);
  });
}

function getAllItems() {
  return new Promise(resolve => {
    const request = tx("items").getAll();
    request.onsuccess = () => resolve(request.result || []);
  });
}

function getChildren(parentId) {
  return new Promise(resolve => {
    const request = tx("items").index("parentId").getAll(parentId);
    request.onsuccess = () => resolve(request.result || []);
  });
}

function deleteItem(id) {
  return new Promise(resolve => {
    const request = tx("items", "readwrite").delete(id);
    request.onsuccess = () => resolve();
  });
}

async function deleteRecursive(item) {
  if (item.type === "folder") {
    const children = await getChildren(item.id);
    for (const child of children) {
      await deleteRecursive(child);
    }
  }

  await deleteItem(item.id);
}

async function initBaseFolders() {
  const root = await getItem("root");

  if (!root) {
    await addItem({
      id: "root",
      name: "Accueil",
      parentId: null,
      type: "folder",
      createdAt: Date.now()
    });

    for (const folder of defaultFolders) {
      await addItem(folder);
    }
  }
}

function createId(prefix = "item") {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function getIconForFile(fileType, fileName) {
  const name = fileName.toLowerCase();

  if (fileType.startsWith("image/")) return "🖼️";
  if (fileType.startsWith("video/")) return "🎬";
  if (fileType.startsWith("audio/")) return "🎵";
  if (name.endsWith(".pdf")) return "📕";
  if (name.endsWith(".doc") || name.endsWith(".docx")) return "📘";
  if (name.endsWith(".xls") || name.endsWith(".xlsx")) return "📗";
  if (name.endsWith(".zip") || name.endsWith(".rar")) return "🗜️";
  return "📄";
}

function formatSize(bytes) {
  if (!bytes) return "";

  const units = ["o", "Ko", "Mo", "Go"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size = size / 1024;
    unitIndex++;
  }

  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

async function getPath(folderId) {
  const path = [];
  let current = await getItem(folderId);

  while (current) {
    path.unshift(current.name);
    if (!current.parentId) break;
    current = await getItem(current.parentId);
  }

  return path;
}

async function renderBreadcrumb() {
  const path = await getPath(currentFolderId);
  els.breadcrumb.textContent = path.join(" > ");
  els.currentTitle.textContent = path[path.length - 1] || "Accueil";
}

async function renderQuickFolders() {
  const rootChildren = await getChildren("root");
  const folders = rootChildren.filter(item => item.type === "folder");

  els.quickFolders.innerHTML = "";

  folders.forEach(folder => {
    const btn = document.createElement("button");
    btn.className = "quick-chip";
    btn.textContent = `📁 ${folder.name}`;
    btn.onclick = () => {
      currentFolderId = folder.id;
      searchMode = false;
      els.searchInput.value = "";
      render();
    };
    els.quickFolders.appendChild(btn);
  });
}

async function renderItems(items = null) {
  let children = items || await getChildren(currentFolderId);

  children.sort((a, b) => {
    if (a.type === "folder" && b.type !== "folder") return -1;
    if (a.type !== "folder" && b.type === "folder") return 1;
    return a.name.localeCompare(b.name);
  });

  els.itemsGrid.innerHTML = "";
  els.itemsCount.textContent = `${children.length} élément${children.length > 1 ? "s" : ""}`;
  els.emptyState.classList.toggle("hidden", children.length > 0);

  children.forEach(item => {
    const card = document.createElement("div");
    card.className = "item";

    const menu = document.createElement("button");
    menu.className = "item-menu";
    menu.textContent = "⋮";
    menu.onclick = event => {
      event.stopPropagation();
      openOptions(item);
    };

    let preview = "";

    if (item.type === "folder") {
      preview = `<div class="item-icon">📁</div>`;
    } else if (item.mimeType && item.mimeType.startsWith("image/") && item.blob) {
      const url = URL.createObjectURL(item.blob);
      preview = `<img src="${url}" alt="${item.name}">`;
    } else {
      preview = `<div class="item-icon">${getIconForFile(item.mimeType || "", item.name)}</div>`;
    }

    card.innerHTML = `
      ${preview}
      <div class="item-name">${item.name}</div>
      <div class="item-meta">${item.type === "folder" ? "Dossier" : formatSize(item.size)}</div>
    `;

    card.appendChild(menu);

    card.onclick = () => {
      if (item.type === "folder") {
        currentFolderId = item.id;
        searchMode = false;
        els.searchInput.value = "";
        render();
      } else {
        openFile(item);
      }
    };

    els.itemsGrid.appendChild(card);
  });
}

async function render() {
  await renderBreadcrumb();
  await renderQuickFolders();
  await renderItems();
  updateStorageInfo();
}

async function updateStorageInfo() {
  const all = await getAllItems();
  const files = all.filter(item => item.type === "file");
  const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);

  els.storageInfo.textContent = `${files.length} fichier${files.length > 1 ? "s" : ""} - ${formatSize(totalSize) || "0 o"}`;
}

async function createFolder() {
  const name = prompt("Nom du nouveau dossier :");

  if (!name || !name.trim()) return;

  const folder = {
    id: createId("folder"),
    name: name.trim(),
    parentId: currentFolderId,
    type: "folder",
    createdAt: Date.now()
  };

  await addItem(folder);
  render();
}

async function importFiles(files) {
  for (const file of files) {
    const item = {
      id: createId("file"),
      name: file.name,
      parentId: currentFolderId,
      type: "file",
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      blob: file,
      createdAt: Date.now()
    };

    await addItem(item);
  }

  els.fileInput.value = "";
  render();
}

function openFile(item) {
  if (!item.blob) return;

  const url = URL.createObjectURL(item.blob);
  window.open(url, "_blank");
}

function downloadFile(item) {
  if (!item || item.type !== "file" || !item.blob) return;

  const url = URL.createObjectURL(item.blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = item.name;
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function openOptions(item) {
  selectedItem = item;

  els.modalTitle.textContent = item.name;
  els.btnOpenItem.classList.toggle("hidden", false);
  els.btnDownloadItem.classList.toggle("hidden", item.type !== "file");

  els.optionsModal.classList.remove("hidden");
}

function closeOptions() {
  selectedItem = null;
  els.optionsModal.classList.add("hidden");
}

async function renameSelectedItem() {
  if (!selectedItem) return;

  const newName = prompt("Nouveau nom :", selectedItem.name);

  if (!newName || !newName.trim()) return;

  selectedItem.name = newName.trim();
  await addItem(selectedItem);

  closeOptions();
  render();
}

async function deleteSelectedItem() {
  if (!selectedItem) return;

  const confirmDelete = confirm(`Supprimer "${selectedItem.name}" ?`);

  if (!confirmDelete) return;

  await deleteRecursive(selectedItem);

  closeOptions();
  render();
}

async function goBack() {
  if (currentFolderId === "root") return;

  const current = await getItem(currentFolderId);

  if (current && current.parentId) {
    currentFolderId = current.parentId;
    searchMode = false;
    els.searchInput.value = "";
    render();
  }
}

async function searchItems(query) {
  const clean = query.trim().toLowerCase();

  if (!clean) {
    searchMode = false;
    renderItems();
    return;
  }

  searchMode = true;

  const all = await getAllItems();
  const results = all.filter(item => {
    if (item.id === "root") return false;
    return item.name.toLowerCase().includes(clean);
  });

  els.currentTitle.textContent = "Recherche";
  els.breadcrumb.textContent = `Résultats pour "${query}"`;
  await renderItems(results);
}

function bindEvents() {
  els.btnNewFolder.onclick = createFolder;

  els.btnImport.onclick = () => {
    els.fileInput.click();
  };

  els.fileInput.onchange = event => {
    importFiles(Array.from(event.target.files));
  };

  els.btnHome.onclick = () => {
    currentFolderId = "root";
    searchMode = false;
    els.searchInput.value = "";
    render();
  };

  els.btnBack.onclick = goBack;

  els.btnSearch.onclick = () => {
    els.searchPanel.classList.toggle("hidden");
    els.searchInput.focus();
  };

  els.searchInput.oninput = event => {
    searchItems(event.target.value);
  };

  els.btnClearSearch.onclick = () => {
    els.searchInput.value = "";
    searchMode = false;
    render();
  };

  els.btnCloseModal.onclick = closeOptions;

  els.btnOpenItem.onclick = () => {
    if (!selectedItem) return;

    const item = selectedItem;
    closeOptions();

    if (item.type === "folder") {
      currentFolderId = item.id;
      render();
    } else {
      openFile(item);
    }
  };

  els.btnRenameItem.onclick = renameSelectedItem;

  els.btnDeleteItem.onclick = deleteSelectedItem;

  els.btnDownloadItem.onclick = () => {
    downloadFile(selectedItem);
    closeOptions();
  };

  els.navHome.onclick = () => {
    currentFolderId = "root";
    render();
  };

  els.navImages.onclick = () => {
    currentFolderId = "images";
    render();
  };

  els.navVideos.onclick = () => {
    currentFolderId = "videos";
    render();
  };

  els.navAudio.onclick = () => {
    currentFolderId = "audio";
    render();
  };

  els.navDocs.onclick = () => {
    currentFolderId = "documents";
    render();
  };
}

async function startApp() {
  await openDB();
  await initBaseFolders();
  bindEvents();
  render();
}

startApp();
