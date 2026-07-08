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

  document.addEventListener("DOMContentLoaded", () => setTimeout(installImportHook, 400));
  setTimeout(installImportHook, 1200);
})();
