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

  async function syncFilesToNative(files) {
    if (!window.GestionNativeStore || !files || !files.length) return;

    for (const file of files) {
      try {
        const base64 = await blobToBase64(file);
        window.GestionNativeStore.saveFileBase64(file.name, file.type || "application/octet-stream", base64);
      } catch (error) {
        // Le fichier reste disponible dans le Gestionnaire web même si la copie native échoue.
      }
    }
  }

  async function syncExistingIndexedDbFiles() {
    if (window.__gestionExistingNativeSyncDone) return;
    if (!window.GestionNativeStore || typeof window.getAllItems !== "function") return;

    window.__gestionExistingNativeSyncDone = true;

    try {
      const items = await window.getAllItems();
      const files = (items || [])
        .filter(item => item && item.type === "file" && item.blob)
        .map(item => new File([item.blob], item.name || "fichier", {
          type: item.mimeType || item.blob.type || "application/octet-stream"
        }));

      await syncFilesToNative(files);
    } catch (error) {
      // Synchronisation silencieuse : l'app principale doit rester utilisable.
    }
  }

  function installImportHook() {
    if (typeof window.importFiles !== "function" || window.__gestionNativeSyncInstalled) return;
    window.__gestionNativeSyncInstalled = true;
    const originalImportFiles = window.importFiles;

    window.importFiles = async function patchedImportFiles(files) {
      const safeFiles = Array.from(files || []);
      const result = await originalImportFiles(safeFiles);
      await syncFilesToNative(safeFiles);
      return result;
    };
  }

  function boot() {
    installImportHook();
    setTimeout(syncExistingIndexedDbFiles, 1200);
    setTimeout(syncExistingIndexedDbFiles, 2800);
  }

  document.addEventListener("DOMContentLoaded", () => setTimeout(boot, 400));
  setTimeout(boot, 1200);
})();
