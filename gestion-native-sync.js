(() => {
  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "");
        resolve(result.includes(",") ? result.split(",").pop() : result);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  function normalizeFolderPath(pathParts) {
    const parts = (pathParts || [])
      .map(part => String(part || "").trim())
      .filter(Boolean)
      .filter(part => part.toLowerCase() !== "accueil");
    return parts.length ? parts.join("/") : "Vrac";
  }

  async function folderPathForItem(item) {
    if (!item || !item.parentId || item.parentId === "root") return "Vrac";
    if (typeof window.getPath !== "function") return "Vrac";
    try {
      const path = await window.getPath(item.parentId);
      return normalizeFolderPath(path);
    } catch {
      return "Vrac";
    }
  }

  async function saveFileToNative(file, folderPath = "Vrac") {
    if (!window.GestionNativeStore || !file) return;
    const base64 = await blobToBase64(file);

    if (typeof window.GestionNativeStore.saveFileBase64InFolder === "function") {
      window.GestionNativeStore.saveFileBase64InFolder(
        folderPath,
        file.name,
        file.type || "application/octet-stream",
        base64
      );
      return;
    }

    window.GestionNativeStore.saveFileBase64(file.name, file.type || "application/octet-stream", base64);
  }

  async function syncFilesToNative(files, folderPath = "Vrac") {
    if (!window.GestionNativeStore || !files || !files.length) return;

    for (const file of files) {
      try {
        await saveFileToNative(file, folderPath);
      } catch (error) {
        // Le fichier reste disponible dans le Gestionnaire web même si la copie native échoue.
      }
    }
  }

  async function syncExistingIndexedDbFiles() {
    if (window.__gestionExistingNativeSyncBusy) return;
    if (!window.GestionNativeStore || typeof window.getAllItems !== "function") return;

    window.__gestionExistingNativeSyncBusy = true;

    try {
      const items = await window.getAllItems();
      const files = (items || []).filter(item => item && item.type === "file" && item.blob);

      for (const item of files) {
        const folderPath = await folderPathForItem(item);
        const file = new File([item.blob], item.name || "fichier", {
          type: item.mimeType || item.blob.type || "application/octet-stream"
        });
        await syncFilesToNative([file], folderPath);
      }
    } catch (error) {
      // Synchronisation silencieuse : l'app principale doit rester utilisable.
    } finally {
      window.__gestionExistingNativeSyncBusy = false;
      window.__gestionExistingNativeSyncDone = true;
    }
  }

  function installImportHook() {
    if (typeof window.importFiles !== "function" || window.__gestionNativeSyncInstalled) return;
    window.__gestionNativeSyncInstalled = true;
    const originalImportFiles = window.importFiles;

    window.importFiles = async function patchedImportFiles(files) {
      const safeFiles = Array.from(files || []);
      const result = await originalImportFiles(safeFiles);
      await syncExistingIndexedDbFiles();
      return result;
    };
  }

  function boot() {
    installImportHook();
    setTimeout(syncExistingIndexedDbFiles, 1200);
    setTimeout(syncExistingIndexedDbFiles, 3000);
    setTimeout(syncExistingIndexedDbFiles, 6000);
  }

  document.addEventListener("DOMContentLoaded", () => setTimeout(boot, 400));
  setTimeout(boot, 1200);
})();
