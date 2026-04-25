const DB_NAME = "gestionnaire-mobile-db-final-v1";
const DB_VERSION = 1;

let db;
let currentFolderId = "root";
let selectedItem = null;
let viewerItem = null;
let selectionMode = false;
let selectedIds = new Set();
let currentVisibleItems = [];
let destinationMode = null;
let destinationFolderId = "root";
let viewMode = localStorage.getItem("gm_view_mode") || "grid";
let sortMode = localStorage.getItem("gm_sort_mode") || "name";

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
  normalTopbar: document.getElementById("normalTopbar"),
  selectTopbar: document.getElementById("selectTopbar"),
  selectCount: document.getElementById("selectCount"),
  btnExitSelect: document.getElementById("btnExitSelect"),
  btnSelectAll: document.getElementById("btnSelectAll"),

  storageInfo: document.getElementById("storageInfo"),
  btnSearch: document.getElementById("btnSearch"),
  btnViewMode: document.getElementById("btnViewMode"),
  btnSort: document.getElementById("btnSort"),

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

  bottomNav: document.getElementById("bottomNav"),
  selectActions: document.getElementById("selectActions"),

  btnCopy: document.getElementById("btnCopy"),
  btnMove: document.getElementById("btnMove"),
  btnRenameSelected: document.getElementById("btnRenameSelected"),
  btnDeleteSelected: document.getElementById("btnDeleteSelected"),
  btnMore: document.getElementById("btnMore"),

  optionsModal: document.getElementById("optionsModal"),
  modalTitle: document.getElementById("modalTitle"),
  btnOpenItem: document.getElementById("btnOpenItem"),
  btnShareItem: document.getElementById("btnShareItem"),
  btnCopyItem: document.getElementById("btnCopyItem"),
  btnMoveItem: document.getElementById("btnMoveItem"),
  btnRenameItem: document.getElementById("btnRenameItem"),
  btnDownloadItem: document.getElementById("btnDownloadItem"),
  btnPropertiesItem: document.getElementById("btnPropertiesItem"),
  btnDeleteItem: document.getElementById("btnDeleteItem"),
  btnCloseModal: document.getElementById("btnCloseModal"),

  moreModal: document.getElementById("moreModal"),
  btnShareSelected: document.getElementById("btnShareSelected"),
  btnDownloadSelected: document.getElementById("btnDownloadSelected"),
  btnPropertiesSelected: document.getElementById("btnPropertiesSelected"),
  btnCloseMore: document.getElementById("btnCloseMore"),

  viewerModal: document.getElementById("viewerModal"),
  viewerTitle: document.getElementById("viewerTitle"),
  viewerBody: document.getElementById("viewerBody"),
  btnCloseViewer: document.getElementById("btnCloseViewer"),
  btnViewerShare: document.getElementById("btnViewerShare"),
  btnViewerDownload: document.getElementById("btnViewerDownload"),
  btnViewerDelete: document.getElementById("btnViewerDelete"),

  destinationModal: document.getElementById("destinationModal"),
  destinationTitle: document.getElementById("destinationTitle"),
  destinationPath: document.getElementById("destinationPath"),
  destinationList: document.getElementById("destinationList"),
  btnDestinationBack: document.getElementById("btnDestinationBack"),
  btnConfirmDestination: document.getElementById("btnConfirmDestination"),
  btnCancelDestination: document.getElementById("btnCancelDestination"),

  toast: document.getElementById("toast"),

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

function store(mode = "readonly") {
  return db.transaction("items", mode).objectStore("items");
}

function putItem(item) {
  return new Promise((resolve, reject) => {
    const request = store("readwrite").put(item);
    request.onsuccess = () => resolve(item);
    request.onerror = () => reject("Erreur sauvegarde");
  });
}

function getItem(id) {
  return new Promise(resolve => {
    const request = store().get(id);
    request.onsuccess = () => resolve(request.result || null);
  });
}

function getAllItems() {
  return new Promise(resolve => {
    const request = store().getAll();
    request.onsuccess = () => resolve(request.result || []);
  });
}

function getChildren(parentId) {
  return new Promise(resolve => {
    const request = store().index("parentId").getAll(parentId);
    request.onsuccess = () => resolve(request.result || []);
  });
}

function removeItem(id) {
  return new Promise(resolve => {
    const request = store("readwrite").delete(id);
    request.onsuccess = () => resolve();
  });
}

async function initBaseFolders() {
  const root = await getItem("root");

  if (!root) {
    await putItem({
      id: "root",
      name: "Accueil",
      parentId: null,
      type: "folder",
      createdAt: Date.now()
    });

    for (const folder of defaultFolders) {
      await putItem(folder);
    }
  }
}

function createId(prefix = "item") {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.remove("hidden");
  setTimeout(() => els.toast.classList.add("hidden"), 2200);
}

function formatSize(bytes) {
  if (!bytes) return "0 o";

  const units = ["o", "Ko", "Mo", "Go"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size = size / 1024;
    unitIndex++;
  }

  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDate(timestamp) {
  if (!timestamp) return "Inconnue";
  return new Date(timestamp).toLocaleString("fr-FR");
}

function fileKind(item) {
  const mime = item.mimeType || "";
  const name = (item.name || "").toLowerCase();

  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".zip") || name.endsWith(".rar")) return "archive";
  return "document";
}

function getIcon(item) {
  if (item.type === "folder") return "📁";

  const kind = fileKind(item);

  if (kind === "image") return "🖼️";
  if (kind === "video") return "🎬";
  if (kind === "audio") return "🎵";
  if (kind === "pdf") return "📕";
  if (kind === "archive") return "🗜️";

  return "📄";
}

function getExtension(name = "") {
  const parts = name.split(".");
  if (parts.length < 2) return "";
  return parts.pop().toUpperCase();
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
  const folders = rootChildren.filter(item => item.type === "folder" && item.id !== "root");

  els.quickFolders.innerHTML = "";

  folders.forEach(folder => {
    const btn = document.createElement("button");
    btn.className = "quick-chip";
    btn.textContent = `📁 ${folder.name}`;
    btn.onclick = () => {
      currentFolderId = folder.id;
      exitSelection();
      render();
    };
    els.quickFolders.appendChild(btn);
  });
}

function sortItems(items) {
  return [...items].sort((a, b) => {
    if (a.type === "folder" && b.type !== "folder") return -1;
    if (a.type !== "folder" && b.type === "folder") return 1;

    if (sortMode === "date") return (b.createdAt || 0) - (a.createdAt || 0);
    if (sortMode === "size") return (b.size || 0) - (a.size || 0);
    if (sortMode === "type") return (a.mimeType || a.type).localeCompare(b.mimeType || b.type);

    return a.name.localeCompare(b.name);
  });
}

function createPreviewHTML(item) {
  if (item.type === "folder") {
    return `<div class="item-preview"><div class="item-icon">📁</div></div>`;
  }

  const kind = fileKind(item);

  if (kind === "image" && item.blob) {
    const url = URL.createObjectURL(item.blob);
    return `<div class="item-preview"><img src="${url}" alt=""></div>`;
  }

  if (kind === "video" && item.blob) {
    const url = URL.createObjectURL(item.blob);
    return `
      <div class="item-preview">
        <video src="${url}" muted preload="metadata"></video>
        <div class="play-badge">▶</div>
      </div>
    `;
  }

  if (kind === "audio") {
    return `<div class="item-preview"><div class="item-icon">🎵</div></div>`;
  }

  return `<div class="item-preview"><div class="item-icon">${getIcon(item)}</div></div>`;
}

async function renderItems(items = null) {
  let children = items || await getChildren(currentFolderId);
  children = sortItems(children);

  currentVisibleItems = children;

  els.itemsGrid.innerHTML = "";
  els.itemsGrid.classList.toggle("list-mode", viewMode === "list");
  els.itemsCount.textContent = `${children.length} élément${children.length > 1 ? "s" : ""}`;
  els.emptyState.classList.toggle("hidden", children.length > 0);

  children.forEach(item => {
    const card = document.createElement("div");
    card.className = "item";
    card.dataset.id = item.id;

    if (selectedIds.has(item.id)) {
      card.classList.add("selected");
    }

    const menu = document.createElement("button");
    menu.className = "item-menu";
    menu.textContent = "⋮";
    menu.onclick = event => {
      event.stopPropagation();
      openOptions(item);
    };

    const extension = item.type === "file" ? getExtension(item.name) : "Dossier";
    const meta = item.type === "folder" ? "Dossier" : `${extension || "Fichier"} - ${formatSize(item.size)}`;

    if (viewMode === "list") {
      card.innerHTML = `
        ${createPreviewHTML(item)}
        <div>
          <div class="item-name">${item.name}</div>
          <div class="item-meta">${meta}</div>
        </div>
      `;
    } else {
      card.innerHTML = `
        ${createPreviewHTML(item)}
        <div class="item-name">${item.name}</div>
        <div class="item-meta">${meta}</div>
      `;
    }

    card.appendChild(menu);

    card.onclick = () => handleItemClick(item);

    card.oncontextmenu = event => {
      event.preventDefault();
      enterSelection(item.id);
    };

    let pressTimer;
    card.addEventListener("touchstart", () => {
      pressTimer = setTimeout(() => enterSelection(item.id), 550);
    });

    card.addEventListener("touchend", () => clearTimeout(pressTimer));
    card.addEventListener("touchmove", () => clearTimeout(pressTimer));

    els.itemsGrid.appendChild(card);
  });

  updateSelectionUI();
}

async function render() {
  await renderBreadcrumb();
  await renderQuickFolders();
  await renderItems();
  await updateStorageInfo();
  updateNavActive();
}

async function updateStorageInfo() {
  const all = await getAllItems();
  const files = all.filter(item => item.type === "file" && item.parentId !== "trash");
  const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);

  els.storageInfo.textContent = `${files.length} fichier${files.length > 1 ? "s" : ""} - ${formatSize(totalSize)}`;
}

function updateNavActive() {
  const map = {
    root: els.navHome,
    images: els.navImages,
    videos: els.navVideos,
    audio: els.navAudio,
    documents: els.navDocs
  };

  Object.values(map).forEach(btn => btn.classList.remove("active"));

  if (map[currentFolderId]) {
    map[currentFolderId].classList.add("active");
  }
}

async function handleItemClick(item) {
  if (selectionMode) {
    toggleSelection(item.id);
    return;
  }

  if (item.type === "folder") {
    currentFolderId = item.id;
    render();
    return;
  }

  openViewer(item);
}

async function createFolder() {
  const name = prompt("Nom du nouveau dossier :");

  if (!name || !name.trim()) return;

  await putItem({
    id: createId("folder"),
    name: name.trim(),
    parentId: currentFolderId,
    type: "folder",
    createdAt: Date.now()
  });

  showToast("Dossier créé");
  render();
}

async function importFiles(files) {
  if (!files.length) return;

  for (const file of files) {
    await putItem({
      id: createId("file"),
      name: file.name,
      parentId: currentFolderId,
      type: "file",
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      blob: file,
      createdAt: Date.now()
    });
  }

  els.fileInput.value = "";
  showToast(`${files.length} fichier${files.length > 1 ? "s importés" : " importé"}`);
  render();
}

function openOptions(item) {
  selectedItem = item;

  els.modalTitle.textContent = item.name;
  els.btnDownloadItem.classList.toggle("hidden", item.type !== "file");
  els.btnShareItem.classList.toggle("hidden", item.type !== "file");

  els.optionsModal.classList.remove("hidden");
}

function closeOptions() {
  selectedItem = null;
  els.optionsModal.classList.add("hidden");
}

async function renameItem(item) {
  if (!item) return;

  const newName = prompt("Nouveau nom :", item.name);

  if (!newName || !newName.trim()) return;

  item.name = newName.trim();
  await putItem(item);

  showToast("Renommé");
  render();
}

async function moveToTrash(item) {
  if (!item) return;

  if (item.id === "root" || ["images", "videos", "audio", "documents", "downloads", "projects", "trash"].includes(item.id)) {
    showToast("Ce dossier système ne peut pas être supprimé");
    return;
  }

  if (item.parentId === "trash" || currentFolderId === "trash") {
    await deleteRecursive(item);
    showToast("Supprimé définitivement");
  } else {
    item.previousParentId = item.parentId;
    item.parentId = "trash";
    item.deletedAt = Date.now();
    await putItem(item);
    showToast("Envoyé dans la corbeille");
  }

  render();
}

async function deleteRecursive(item) {
  if (item.type === "folder") {
    const children = await getChildren(item.id);
    for (const child of children) {
      await deleteRecursive(child);
    }
  }

  await removeItem(item.id);
}

async function openViewer(item) {
  viewerItem = item;
  els.viewerTitle.textContent = item.name;
  els.viewerBody.innerHTML = "";

  if (!item.blob) return;

  const url = URL.createObjectURL(item.blob);
  const kind = fileKind(item);

  if (kind === "video") {
    els.viewerBody.innerHTML = `<video src="${url}" controls autoplay playsinline></video>`;
  } else if (kind === "image") {
    els.viewerBody.innerHTML = `<img src="${url}" alt="">`;
  } else if (kind === "audio") {
    els.viewerBody.innerHTML = `<audio src="${url}" controls autoplay></audio>`;
  } else {
    els.viewerBody.innerHTML = `
      <div class="viewer-doc">
        <div>${getIcon(item)}</div>
        <p>${item.name}</p>
        <p>${formatSize(item.size)}</p>
      </div>
    `;
  }

  els.viewerModal.classList.remove("hidden");
}

function closeViewer() {
  viewerItem = null;
  els.viewerBody.innerHTML = "";
  els.viewerModal.classList.add("hidden");
}

async function makeFile(item) {
  if (!item || item.type !== "file" || !item.blob) return null;

  return new File([item.blob], item.name, {
    type: item.mimeType || "application/octet-stream"
  });
}

async function shareItems(items) {
  const files = [];

  for (const item of items) {
    if (item.type === "file") {
      const file = await makeFile(item);
      if (file) files.push(file);
    }
  }

  if (!files.length) {
    showToast("Aucun fichier à partager");
    return;
  }

  try {
    if (navigator.canShare && navigator.canShare({ files })) {
      await navigator.share({
        files,
        title: "Partager fichier",
        text: "Fichier partagé depuis Gestionnaire Mobile"
      });
      return;
    }

    if (navigator.share && files.length === 1) {
      await navigator.share({
        title: files[0].name,
        text: "Fichier à partager"
      });
      return;
    }

    showToast("Partage non compatible. Utilise Télécharger.");
  } catch (error) {
    showToast("Partage annulé");
  }
}

async function downloadItem(item) {
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

async function downloadItems(items) {
  for (const item of items) {
    await downloadItem(item);
  }
}

async function showProperties(item) {
  if (!item) return;

  const path = await getPath(item.parentId || "root");

  alert(
    `Nom : ${item.name}\n` +
    `Type : ${item.type === "folder" ? "Dossier" : item.mimeType || "Fichier"}\n` +
    `Taille : ${item.type === "file" ? formatSize(item.size) : "Non applicable"}\n` +
    `Date d'ajout : ${formatDate(item.createdAt)}\n` +
    `Emplacement : ${path.join(" > ")}`
  );
}

function enterSelection(id) {
  selectionMode = true;
  selectedIds.add(id);
  renderItems(currentVisibleItems);
}

function toggleSelection(id) {
  if (selectedIds.has(id)) {
    selectedIds.delete(id);
  } else {
    selectedIds.add(id);
  }

  if (selectedIds.size === 0) {
    exitSelection();
    return;
  }

  renderItems(currentVisibleItems);
}

function exitSelection() {
  selectionMode = false;
  selectedIds.clear();
  updateSelectionUI();
  renderItems(currentVisibleItems);
}

function updateSelectionUI() {
  const total = currentVisibleItems.length;
  const count = selectedIds.size;

  els.normalTopbar.classList.toggle("hidden", selectionMode);
  els.selectTopbar.classList.toggle("hidden", !selectionMode);
  els.bottomNav.classList.toggle("hidden", selectionMode);
  els.selectActions.classList.toggle("hidden", !selectionMode);
  els.selectCount.textContent = `${count}/${total}`;
}

async function getSelectedItems() {
  const items = [];

  for (const id of selectedIds) {
    const item = await getItem(id);
    if (item) items.push(item);
  }

  return items;
}

async function selectAllVisible() {
  selectionMode = true;
  currentVisibleItems.forEach(item => selectedIds.add(item.id));
  renderItems(currentVisibleItems);
}

async function renameSelected() {
  const items = await getSelectedItems();

  if (items.length !== 1) {
    showToast("Sélectionne un seul fichier pour renommer");
    return;
  }

  await renameItem(items[0]);
  exitSelection();
}

async function deleteSelected() {
  const items = await getSelectedItems();

  if (!items.length) return;

  const ok = confirm(`Supprimer ${items.length} élément${items.length > 1 ? "s" : ""} ?`);
  if (!ok) return;

  for (const item of items) {
    await moveToTrash(item);
  }

  exitSelection();
  render();
}

async function copyRecursive(item, newParentId) {
  const newId = createId(item.type);

  const clone = {
    ...item,
    id: newId,
    parentId: newParentId,
    name: item.name,
    createdAt: Date.now()
  };

  delete clone.deletedAt;
  delete clone.previousParentId;

  await putItem(clone);

  if (item.type === "folder") {
    const children = await getChildren(item.id);
    for (const child of children) {
      await copyRecursive(child, newId);
    }
  }
}

async function moveItemToFolder(item, newParentId) {
  if (item.id === "root") return;

  if (item.type === "folder") {
    const isBad = await isDescendant(newParentId, item.id);
    if (isBad || newParentId === item.id) {
      showToast("Impossible de déplacer un dossier dans lui-même");
      return;
    }
  }

  item.parentId = newParentId;
  delete item.deletedAt;
  delete item.previousParentId;

  await putItem(item);
}

async function isDescendant(folderId, possibleParentId) {
  let current = await getItem(folderId);

  while (current) {
    if (current.parentId === possibleParentId) return true;
    if (!current.parentId) return false;
    current = await getItem(current.parentId);
  }

  return false;
}

async function startDestination(mode, item = null) {
  destinationMode = mode;
  destinationFolderId = currentFolderId;

  if (item) {
    selectedIds.clear();
    selectedIds.add(item.id);
  }

  els.destinationTitle.textContent = mode === "copy" ? "Copier vers..." : "Déplacer vers...";
  await renderDestination();
  els.destinationModal.classList.remove("hidden");
}

async function renderDestination() {
  const path = await getPath(destinationFolderId);
  els.destinationPath.textContent = path.join(" > ");

  const children = await getChildren(destinationFolderId);
  const folders = children.filter(item => item.type === "folder");

  els.destinationList.innerHTML = "";

  folders.forEach(folder => {
    const btn = document.createElement("button");
    btn.className = "destination-folder";
    btn.textContent = `📁 ${folder.name}`;
    btn.onclick = () => {
      destinationFolderId = folder.id;
      renderDestination();
    };
    els.destinationList.appendChild(btn);
  });

  if (!folders.length) {
    els.destinationList.innerHTML = `<p style="color:#9ca3af;text-align:center;">Aucun sous-dossier ici</p>`;
  }
}

async function destinationBack() {
  if (destinationFolderId === "root") return;

  const folder = await getItem(destinationFolderId);

  if (folder && folder.parentId) {
    destinationFolderId = folder.parentId;
    renderDestination();
  }
}

async function confirmDestination() {
  const items = await getSelectedItems();

  for (const item of items) {
    if (destinationMode === "copy") {
      await copyRecursive(item, destinationFolderId);
    } else {
      await moveItemToFolder(item, destinationFolderId);
    }
  }

  els.destinationModal.classList.add("hidden");
  exitSelection();

  showToast(destinationMode === "copy" ? "Copié" : "Déplacé");
  render();
}

async function searchItems(query) {
  const clean = query.trim().toLowerCase();

  if (!clean) {
    renderItems();
    return;
  }

  const all = await getAllItems();
  const results = all.filter(item => {
    if (item.id === "root") return false;
    return item.name.toLowerCase().includes(clean);
  });

  els.currentTitle.textContent = "Recherche";
  els.breadcrumb.textContent = `Résultats pour "${query}"`;
  renderItems(results);
}

function changeSort() {
  const choices = ["name", "date", "size", "type"];
  const labels = {
    name: "Nom A-Z",
    date: "Plus récent",
    size: "Taille",
    type: "Type"
  };

  const currentIndex = choices.indexOf(sortMode);
  sortMode = choices[(currentIndex + 1) % choices.length];

  localStorage.setItem("gm_sort_mode", sortMode);
  showToast(`Tri : ${labels[sortMode]}`);
  render();
}

function toggleViewMode() {
  viewMode = viewMode === "grid" ? "list" : "grid";
  localStorage.setItem("gm_view_mode", viewMode);
  showToast(viewMode === "grid" ? "Mode grille" : "Mode liste");
  render();
}

function bindEvents() {
  els.btnNewFolder.onclick = createFolder;

  els.btnImport.onclick = () => els.fileInput.click();

  els.fileInput.onchange = event => importFiles(Array.from(event.target.files));

  els.btnHome.onclick = () => {
    currentFolderId = "root";
    exitSelection();
    render();
  };

  els.btnBack.onclick = async () => {
    if (currentFolderId === "root") return;

    const current = await getItem(currentFolderId);

    if (current && current.parentId) {
      currentFolderId = current.parentId;
      exitSelection();
      render();
    }
  };

  els.btnSearch.onclick = () => {
    els.searchPanel.classList.toggle("hidden");
    els.searchInput.focus();
  };

  els.searchInput.oninput = event => searchItems(event.target.value);

  els.btnClearSearch.onclick = () => {
    els.searchInput.value = "";
    render();
  };

  els.btnSort.onclick = changeSort;
  els.btnViewMode.onclick = toggleViewMode;

  els.btnCloseModal.onclick = closeOptions;

  els.btnOpenItem.onclick = () => {
    const item = selectedItem;
    closeOptions();
    if (!item) return;

    if (item.type === "folder") {
      currentFolderId = item.id;
      render();
    } else {
      openViewer(item);
    }
  };

  els.btnShareItem.onclick = async () => {
    if (selectedItem) await shareItems([selectedItem]);
    closeOptions();
  };

  els.btnCopyItem.onclick = () => {
    if (selectedItem) startDestination("copy", selectedItem);
    closeOptions();
  };

  els.btnMoveItem.onclick = () => {
    if (selectedItem) startDestination("move", selectedItem);
    closeOptions();
  };

  els.btnRenameItem.onclick = async () => {
    await renameItem(selectedItem);
    closeOptions();
  };

  els.btnDownloadItem.onclick = async () => {
    await downloadItem(selectedItem);
    closeOptions();
  };

  els.btnPropertiesItem.onclick = async () => {
    await showProperties(selectedItem);
    closeOptions();
  };

  els.btnDeleteItem.onclick = async () => {
    if (!selectedItem) return;

    const ok = confirm(`Supprimer "${selectedItem.name}" ?`);
    if (!ok) return;

    await moveToTrash(selectedItem);
    closeOptions();
  };

  els.btnExitSelect.onclick = exitSelection;
  els.btnSelectAll.onclick = selectAllVisible;

  els.btnCopy.onclick = () => startDestination("copy");
  els.btnMove.onclick = () => startDestination("move");
  els.btnRenameSelected.onclick = renameSelected;
  els.btnDeleteSelected.onclick = deleteSelected;

  els.btnMore.onclick = () => els.moreModal.classList.remove("hidden");
  els.btnCloseMore.onclick = () => els.moreModal.classList.add("hidden");

  els.btnShareSelected.onclick = async () => {
    const items = await getSelectedItems();
    await shareItems(items);
    els.moreModal.classList.add("hidden");
  };

  els.btnDownloadSelected.onclick = async () => {
    const items = await getSelectedItems();
    await downloadItems(items);
    els.moreModal.classList.add("hidden");
  };

  els.btnPropertiesSelected.onclick = async () => {
    const items = await getSelectedItems();

    if (items.length !== 1) {
      showToast("Sélectionne un seul élément");
      return;
    }

    await showProperties(items[0]);
    els.moreModal.classList.add("hidden");
  };

  els.btnCloseViewer.onclick = closeViewer;

  els.btnViewerShare.onclick = async () => {
    if (viewerItem) await shareItems([viewerItem]);
  };

  els.btnViewerDownload.onclick = async () => {
    if (viewerItem) await downloadItem(viewerItem);
  };

  els.btnViewerDelete.onclick = async () => {
    if (!viewerItem) return;

    const ok = confirm(`Supprimer "${viewerItem.name}" ?`);
    if (!ok) return;

    await moveToTrash(viewerItem);
    closeViewer();
  };

  els.btnDestinationBack.onclick = destinationBack;
  els.btnCancelDestination.onclick = () => els.destinationModal.classList.add("hidden");
  els.btnConfirmDestination.onclick = confirmDestination;

  els.navHome.onclick = () => {
    currentFolderId = "root";
    exitSelection();
    render();
  };

  els.navImages.onclick = () => {
    currentFolderId = "images";
    exitSelection();
    render();
  };

  els.navVideos.onclick = () => {
    currentFolderId = "videos";
    exitSelection();
    render();
  };

  els.navAudio.onclick = () => {
    currentFolderId = "audio";
    exitSelection();
    render();
  };

  els.navDocs.onclick = () => {
    currentFolderId = "documents";
    exitSelection();
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
