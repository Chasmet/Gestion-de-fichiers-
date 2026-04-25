/*
  Gestionnaire CHK - Dossiers intelligents V2
  Ajoute : compteurs récursifs, icônes automatiques, couleurs, mosaïques, tri par dossier rempli.
*/

(function () {
  const SYSTEM_IDS = new Set(["root", "images", "videos", "audio", "documents", "downloads", "projects", "trash"]);

  const THEMES = [
    { id: "music", keys: ["rap", "clip", "musique", "music", "son", "master", "chk"], icon: "🎧", label: "Musique" },
    { id: "car", keys: ["voiture", "moto", "course", "racing", "auto", "car"], icon: "🏎️", label: "Course" },
    { id: "space", keys: ["sora", "science", "fiction", "fantaisie", "futur", "espace", "spatial", "robot", "ia"], icon: "🚀", label: "Sora" },
    { id: "social", keys: ["instagram", "tiktok", "short", "shorts", "reel", "reseau", "réseau"], icon: "📱", label: "Réseaux" },
    { id: "sport", keys: ["sport", "foot", "football", "psg", "match", "entrainement"], icon: "⚽", label: "Sport" },
    { id: "horror", keys: ["horreur", "zombie", "peur", "dark", "sombre", "clown"], icon: "🧟", label: "Horreur" },
    { id: "family", keys: ["famille", "maison", "enfant", "yvane", "nelvyn", "nelvin", "warrel", "moi"], icon: "🏠", label: "Famille" },
    { id: "nature", keys: ["nature", "loup", "neige", "foret", "forêt", "animal", "mer"], icon: "🐺", label: "Nature" },
    { id: "audio", keys: ["audio", "voix", "mp3", "wav"], icon: "🎵", label: "Audio" },
    { id: "doc", keys: ["doc", "document", "pdf", "papier", "texte"], icon: "📄", label: "Docs" },
    { id: "download", keys: ["telechargement", "téléchargement", "download"], icon: "⬇️", label: "Téléchargé" }
  ];

  const FALLBACK_ICONS = ["📁", "🗂️", "🎬", "✨", "🔥", "💎", "🌌", "🎯", "⚡", "📦", "🎨", "🧠"];

  let folderStatsCache = new Map();
  let lastStatsSignature = "";
  let patchReady = false;

  function normalize(value) {
    return (value || "")
      .toString()
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function escapeHtml(value) {
    return (value || "")
      .toString()
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function fileKindLocal(item) {
    try {
      if (typeof fileKind === "function") return fileKind(item);
    } catch {}

    const mime = item?.mimeType || "";
    const name = (item?.name || "").toLowerCase();
    if (mime.startsWith("image/")) return "image";
    if (mime.startsWith("video/")) return "video";
    if (mime.startsWith("audio/")) return "audio";
    if (name.endsWith(".pdf")) return "pdf";
    return "document";
  }

  function mediaIcon(item) {
    const kind = fileKindLocal(item);
    if (kind === "image") return "🖼️";
    if (kind === "video") return "🎬";
    if (kind === "audio") return "🎵";
    if (kind === "pdf") return "📕";
    return "📄";
  }

  function themeForName(name) {
    const clean = normalize(name);
    const found = THEMES.find((theme) => theme.keys.some((key) => clean.includes(normalize(key))));
    if (found) return found;

    let hash = 0;
    for (let i = 0; i < clean.length; i += 1) hash = (hash * 31 + clean.charCodeAt(i)) >>> 0;
    const icon = FALLBACK_ICONS[hash % FALLBACK_ICONS.length];
    return { id: "default", keys: [], icon, label: "Dossier" };
  }

  function formatCount(n) {
    return `${n} média${n > 1 ? "s" : ""}`;
  }

  function getStatsSignature(items) {
    return items
      .map((item) => `${item.id}:${item.parentId}:${item.type}:${item.size || 0}:${item.name || ""}`)
      .sort()
      .join("|");
  }

  async function getAllSafe() {
    try {
      if (typeof getAllItems === "function") return await getAllItems();
    } catch {}
    return [];
  }

  function buildStats(items) {
    const byParent = new Map();

    items.forEach((item) => {
      if (!byParent.has(item.parentId)) byParent.set(item.parentId, []);
      byParent.get(item.parentId).push(item);
    });

    const statsMap = new Map();

    function compute(folderId, stack = new Set()) {
      if (statsMap.has(folderId)) return statsMap.get(folderId);
      if (stack.has(folderId)) {
        return { total: 0, size: 0, images: 0, videos: 0, audio: 0, docs: 0, folders: 0, previews: [] };
      }

      stack.add(folderId);

      const children = byParent.get(folderId) || [];
      const stats = { total: 0, size: 0, images: 0, videos: 0, audio: 0, docs: 0, folders: 0, previews: [] };

      children.forEach((child) => {
        if (child.type === "folder") {
          stats.folders += 1;
          const sub = compute(child.id, stack);
          stats.total += sub.total;
          stats.size += sub.size;
          stats.images += sub.images;
          stats.videos += sub.videos;
          stats.audio += sub.audio;
          stats.docs += sub.docs;
          stats.previews.push(...sub.previews);
        } else {
          stats.total += 1;
          stats.size += child.size || 0;
          const kind = fileKindLocal(child);
          if (kind === "image") stats.images += 1;
          else if (kind === "video") stats.videos += 1;
          else if (kind === "audio") stats.audio += 1;
          else stats.docs += 1;

          if (stats.previews.length < 8) stats.previews.push(child);
        }
      });

      stats.previews = stats.previews
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        .slice(0, 4);

      stack.delete(folderId);
      statsMap.set(folderId, stats);
      return stats;
    }

    items.filter((item) => item.type === "folder").forEach((folder) => compute(folder.id));
    compute("root");
    return statsMap;
  }

  async function ensureStats() {
    const all = await getAllSafe();
    const signature = getStatsSignature(all);
    if (signature !== lastStatsSignature) {
      lastStatsSignature = signature;
      folderStatsCache = buildStats(all);
    }
    return folderStatsCache;
  }

  function dominantType(stats) {
    if (!stats || !stats.total) return "Dossier vide";
    const entries = [
      ["🎬 Vidéos", stats.videos],
      ["🖼️ Images", stats.images],
      ["🎵 Audio", stats.audio],
      ["📄 Docs", stats.docs]
    ].filter(([, value]) => value > 0);

    if (entries.length > 1) return "Mixte";
    return entries[0]?.[0] || "Dossier";
  }

  function details(stats) {
    if (!stats || !stats.total) return `<span>0 fichier</span>`;
    const parts = [];
    if (stats.videos) parts.push(`<span>🎬 ${stats.videos}</span>`);
    if (stats.images) parts.push(`<span>🖼️ ${stats.images}</span>`);
    if (stats.audio) parts.push(`<span>🎵 ${stats.audio}</span>`);
    if (stats.docs) parts.push(`<span>📄 ${stats.docs}</span>`);
    return parts.join("");
  }

  function previewCell(item) {
    if (!item || !item.blob) {
      return `<div class="smart-mosaic-cell"><span class="smart-media-icon">📄</span></div>`;
    }

    const kind = fileKindLocal(item);
    const url = URL.createObjectURL(item.blob);

    if (kind === "image") {
      return `<div class="smart-mosaic-cell"><img src="${url}" alt=""></div>`;
    }

    if (kind === "video") {
      return `<div class="smart-mosaic-cell"><video src="${url}" muted preload="metadata"></video><span class="play-badge">▶</span></div>`;
    }

    return `<div class="smart-mosaic-cell"><span class="smart-media-icon">${mediaIcon(item)}</span></div>`;
  }

  function folderPreviewHtml(item, stats, theme) {
    const previews = stats?.previews || [];
    if (previews.length) {
      return `
        <div class="smart-folder-preview">
          <div class="smart-mosaic">
            ${[0, 1, 2, 3].map((index) => previewCell(previews[index])).join("")}
          </div>
          <div class="smart-folder-overlay">${theme.icon} ${formatCount(stats.total)}</div>
          <div class="smart-folder-type">${dominantType(stats)}</div>
        </div>
      `;
    }

    return `
      <div class="smart-folder-preview empty">
        <span class="smart-folder-tab"></span>
        <span class="smart-icon-bg"></span>
        <span class="smart-folder-icon">${theme.icon}</span>
        <div class="smart-folder-overlay">${formatCount(0)}</div>
        <div class="smart-folder-type">Dossier vide</div>
      </div>
    `;
  }

  function folderCardHtml(item, stats) {
    const theme = themeForName(item.name || "");
    const meta = stats?.total ? `${formatCount(stats.total)} · ${formatSizeSafe(stats.size)}` : "Dossier vide";

    return `
      ${folderPreviewHtml(item, stats, theme)}
      <div class="item-name">${escapeHtml(item.name)}</div>
      <div class="item-meta smart-folder-meta">${meta}</div>
      <div class="smart-folder-detail">${details(stats)}</div>
    `;
  }

  function formatSizeSafe(bytes) {
    try {
      if (typeof formatSize === "function") return formatSize(bytes || 0);
    } catch {}
    return `${Math.round((bytes || 0) / 1024 / 1024)} Mo`;
  }

  function itemScoreForFilledSort(item) {
    if (item.type !== "folder") return item.size || 0;
    return folderStatsCache.get(item.id)?.total || 0;
  }

  function patchSortItems() {
    if (typeof window.sortItems !== "function" && typeof sortItems !== "function") return;
    const original = window.sortItems || sortItems;
    if (original.__smartFolderPatched) return;

    const patched = function (items) {
      const list = [...items].sort((a, b) => {
        if (a.type === "folder" && b.type !== "folder") return -1;
        if (a.type !== "folder" && b.type === "folder") return 1;

        if (sortMode === "filled") return itemScoreForFilledSort(b) - itemScoreForFilledSort(a);
        if (sortMode === "date") return (b.createdAt || 0) - (a.createdAt || 0);
        if (sortMode === "size") {
          const aSize = a.type === "folder" ? (folderStatsCache.get(a.id)?.size || 0) : (a.size || 0);
          const bSize = b.type === "folder" ? (folderStatsCache.get(b.id)?.size || 0) : (b.size || 0);
          return bSize - aSize;
        }
        if (sortMode === "type") return (a.mimeType || a.type).localeCompare(b.mimeType || b.type);

        return (a.name || "").localeCompare(b.name || "", "fr");
      });
      return list;
    };

    patched.__smartFolderPatched = true;
    window.sortItems = patched;
    try { sortItems = patched; } catch {}
  }

  function patchChangeSort() {
    if (typeof window.changeSort !== "function" && typeof changeSort !== "function") return;
    const original = window.changeSort || changeSort;
    if (original.__smartSortPatched) return;

    const patched = function () {
      const choices = ["name", "filled", "date", "size", "type"];
      const labels = {
        name: "Nom A-Z",
        filled: "Dossiers les plus remplis",
        date: "Plus récent",
        size: "Taille",
        type: "Type"
      };

      const currentIndex = choices.indexOf(sortMode);
      sortMode = choices[(currentIndex + 1) % choices.length];
      localStorage.setItem("gm_sort_mode", sortMode);
      showToast(`Tri : ${labels[sortMode]}`);
      render();
      showSortBadge(labels[sortMode]);
    };

    patched.__smartSortPatched = true;
    window.changeSort = patched;
    try { changeSort = patched; } catch {}
  }

  function showSortBadge(text) {
    document.querySelector(".sort-smart-badge")?.remove();
    const badge = document.createElement("div");
    badge.className = "sort-smart-badge";
    badge.textContent = text;
    document.body.appendChild(badge);
    setTimeout(() => badge.remove(), 1700);
  }

  function patchSearchItems() {
    if (typeof window.searchItems !== "function" && typeof searchItems !== "function") return;
    const original = window.searchItems || searchItems;
    if (original.__smartSearchPatched) return;

    const synonyms = {
      voiture: ["moto", "course", "racing", "auto"],
      sora: ["ia", "science", "fiction", "fantaisie", "clip"],
      rap: ["musique", "clip", "chk", "son"],
      instagram: ["reel", "short", "tiktok", "reseau"],
      foot: ["football", "sport", "match", "psg"]
    };

    const patched = async function (query) {
      const clean = normalize(query);
      if (!clean) {
        renderItems();
        return;
      }

      await ensureStats();
      const all = await getAllSafe();
      const tokens = clean.split(/\s+/).filter(Boolean);
      const expanded = new Set(tokens);
      tokens.forEach((token) => (synonyms[token] || []).forEach((s) => expanded.add(normalize(s))));

      const results = all.filter((item) => {
        if (item.id === "root") return false;
        const name = normalize(item.name);
        const theme = themeForName(item.name);
        const themeWords = normalize(`${theme.label} ${theme.keys.join(" ")}`);
        return [...expanded].some((token) => name.includes(token) || themeWords.includes(token));
      });

      els.currentTitle.textContent = "Recherche";
      els.breadcrumb.textContent = `Résultats pour "${query}"`;
      renderItems(results);
    };

    patched.__smartSearchPatched = true;
    window.searchItems = patched;
    try { searchItems = patched; } catch {}
  }

  function patchCreateFolder() {
    if (typeof window.createFolder !== "function" && typeof createFolder !== "function") return;
    const original = window.createFolder || createFolder;
    if (original.__smartCreatePatched) return;

    const patched = async function () {
      const name = prompt("Nom du nouveau dossier :");
      if (!name || !name.trim()) return;

      const cleanName = name.trim();
      const theme = themeForName(cleanName);

      await putItem({
        id: createId("folder"),
        name: cleanName,
        parentId: currentFolderId,
        type: "folder",
        icon: theme.icon,
        theme: theme.id,
        createdAt: Date.now()
      });

      showToast(`${theme.icon} Dossier créé`);
      render();
    };

    patched.__smartCreatePatched = true;
    window.createFolder = patched;
    try { createFolder = patched; } catch {}
  }

  function patchRenderQuickFolders() {
    if (typeof window.renderQuickFolders !== "function" && typeof renderQuickFolders !== "function") return;
    const original = window.renderQuickFolders || renderQuickFolders;
    if (original.__smartQuickPatched) return;

    const patched = async function () {
      await ensureStats();
      const rootChildren = await getChildren("root");
      const folders = rootChildren.filter((item) => item.type === "folder" && item.id !== "root");

      els.quickFolders.innerHTML = "";

      folders.forEach((folder) => {
        const theme = themeForName(folder.name);
        const stats = folderStatsCache.get(folder.id) || { total: 0 };
        const btn = document.createElement("button");
        btn.className = `quick-chip smart-quick-chip folder-theme-${theme.id}`;
        btn.innerHTML = `${theme.icon} ${escapeHtml(folder.name)} <span class="quick-count">${stats.total || 0}</span>`;
        btn.onclick = () => {
          currentFolderId = folder.id;
          exitSelection();
          render();
        };
        els.quickFolders.appendChild(btn);
      });
    };

    patched.__smartQuickPatched = true;
    window.renderQuickFolders = patched;
    try { renderQuickFolders = patched; } catch {}
  }

  function patchRenderItems() {
    if (typeof window.renderItems !== "function" && typeof renderItems !== "function") return;
    const original = window.renderItems || renderItems;
    if (original.__smartFolderPatched) return;

    const patched = async function (items = null) {
      await ensureStats();

      let children = items || await getChildren(currentFolderId);
      children = sortItems(children);
      currentVisibleItems = children;

      els.itemsGrid.innerHTML = "";
      els.itemsGrid.classList.toggle("list-mode", viewMode === "list");
      els.itemsCount.textContent = `${children.length} élément${children.length > 1 ? "s" : ""}`;
      els.emptyState.classList.toggle("hidden", children.length > 0);

      children.forEach((item) => {
        const card = document.createElement("div");
        const theme = themeForName(item.name || "");
        card.className = item.type === "folder" ? `item smart-folder-card folder-theme-${theme.id}` : "item";
        card.dataset.id = item.id;

        if (selectedIds.has(item.id)) card.classList.add("selected");

        const menu = document.createElement("button");
        menu.className = "item-menu";
        menu.textContent = "⋮";
        menu.onclick = (event) => {
          event.stopPropagation();
          openOptions(item);
        };

        if (item.type === "folder") {
          const stats = folderStatsCache.get(item.id) || { total: 0, size: 0, images: 0, videos: 0, audio: 0, docs: 0, previews: [] };
          card.innerHTML = folderCardHtml(item, stats);
        } else {
          const extension = item.type === "file" ? getExtension(item.name) : "Dossier";
          const meta = item.type === "folder" ? "Dossier" : `${extension || "Fichier"} - ${formatSizeSafe(item.size)}`;

          if (viewMode === "list") {
            card.innerHTML = `
              ${createPreviewHTML(item)}
              <div>
                <div class="item-name">${escapeHtml(item.name)}</div>
                <div class="item-meta">${escapeHtml(meta)}</div>
              </div>
            `;
          } else {
            card.innerHTML = `
              ${createPreviewHTML(item)}
              <div class="item-name">${escapeHtml(item.name)}</div>
              <div class="item-meta">${escapeHtml(meta)}</div>
            `;
          }
        }

        card.appendChild(menu);
        card.onclick = () => handleItemClick(item);
        card.oncontextmenu = (event) => {
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
    };

    patched.__smartFolderPatched = true;
    window.renderItems = patched;
    try { renderItems = patched; } catch {}
  }

  function patchProperties() {
    if (typeof window.showProperties !== "function" && typeof showProperties !== "function") return;
    const original = window.showProperties || showProperties;
    if (original.__smartPropPatched) return;

    const patched = async function (item) {
      if (!item) return;
      await ensureStats();
      const path = await getPath(item.parentId || "root");

      if (item.type === "folder") {
        const stats = folderStatsCache.get(item.id) || { total: 0, size: 0, images: 0, videos: 0, audio: 0, docs: 0 };
        const theme = themeForName(item.name);
        alert(
          `Nom : ${theme.icon} ${item.name}\n` +
          `Type : Dossier\n` +
          `Contenu : ${stats.total} média${stats.total > 1 ? "s" : ""}\n` +
          `Vidéos : ${stats.videos}\n` +
          `Images : ${stats.images}\n` +
          `Audio : ${stats.audio}\n` +
          `Documents : ${stats.docs}\n` +
          `Taille totale : ${formatSizeSafe(stats.size)}\n` +
          `Date d'ajout : ${formatDate(item.createdAt)}\n` +
          `Emplacement : ${path.join(" > ")}`
        );
        return;
      }

      return original(item);
    };

    patched.__smartPropPatched = true;
    window.showProperties = patched;
    try { showProperties = patched; } catch {}
  }

  async function refreshStorageInfo() {
    try {
      await ensureStats();
      const all = await getAllSafe();
      const files = all.filter((item) => item.type === "file" && item.parentId !== "trash");
      const folders = all.filter((item) => item.type === "folder" && item.id !== "root");
      const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);
      if (els.storageInfo) {
        els.storageInfo.textContent = `${files.length} fichiers · ${folders.length} dossiers · ${formatSizeSafe(totalSize)}`;
      }
    } catch {}
  }

  function patchUpdateStorageInfo() {
    if (typeof window.updateStorageInfo !== "function" && typeof updateStorageInfo !== "function") return;
    const original = window.updateStorageInfo || updateStorageInfo;
    if (original.__smartStoragePatched) return;

    const patched = async function () {
      await refreshStorageInfo();
    };

    patched.__smartStoragePatched = true;
    window.updateStorageInfo = patched;
    try { updateStorageInfo = patched; } catch {}
  }

  function installPatches() {
    if (!window.indexedDB || !document.getElementById("itemsGrid")) return;

    patchSortItems();
    patchChangeSort();
    patchSearchItems();
    patchCreateFolder();
    patchRenderQuickFolders();
    patchRenderItems();
    patchProperties();
    patchUpdateStorageInfo();

    patchReady = true;
  }

  function attachButtonsAgain() {
    try {
      if (els?.btnSort) els.btnSort.onclick = changeSort;
      if (els?.btnNewFolder) els.btnNewFolder.onclick = createFolder;
      if (els?.searchInput) els.searchInput.oninput = (event) => searchItems(event.target.value);
    } catch {}
  }

  async function boot() {
    installPatches();
    attachButtonsAgain();
    if (patchReady) {
      await ensureStats();
      await refreshStorageInfo();
      if (typeof render === "function") render();
    }
  }

  window.addEventListener("pageshow", () => setTimeout(boot, 300));
  setTimeout(boot, 500);
  setTimeout(boot, 1200);
})();
