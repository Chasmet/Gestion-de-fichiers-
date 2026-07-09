(() => {
  const isApk = () => Boolean(window.GestionNativeStore);
  let toastTimer = null;

  function nativeHaptic(kind = "soft") {
    try {
      if (isApk() && typeof window.GestionNativeStore.haptic === "function") {
        window.GestionNativeStore.haptic(kind);
      }
    } catch {}
  }

  function nativeToast(message) {
    try {
      if (isApk() && typeof window.GestionNativeStore.toast === "function") {
        window.GestionNativeStore.toast(message);
      }
    } catch {}
  }

  function appToast(message, type = "info") {
    if (!isApk()) return;

    let toast = document.querySelector(".apk-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "apk-toast";
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.className = `apk-toast ${type} show`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2300);
  }

  function feedbackForButton(button) {
    if (!button || button.disabled) return;

    const id = button.id || "";
    const text = (button.textContent || "").toLowerCase();
    const danger = button.classList.contains("danger") || id.toLowerCase().includes("delete") || text.includes("supprimer") || text.includes("vider");
    const importAction = id === "btnImport" || id === "btnImportFolderNative" || text.includes("importer");
    const downloadAction = text.includes("télécharger") || text.includes("download");

    nativeHaptic(danger ? "danger" : "soft");

    button.classList.add("apk-pressed");
    setTimeout(() => button.classList.remove("apk-pressed"), 160);

    if (importAction) {
      appToast(id === "btnImportFolderNative" ? "Ouverture du choix de dossier…" : "Ouverture du choix de fichier…");
      temporarilyBusy(button, 900);
      return;
    }

    if (downloadAction) {
      appToast("Téléchargement demandé…");
      temporarilyBusy(button, 800);
      return;
    }

    if (danger) {
      appToast("Action de suppression sélectionnée", "danger");
      temporarilyBusy(button, 450);
      return;
    }

    temporarilyBusy(button, 260);
  }

  function temporarilyBusy(button, delay) {
    if (!button || button.classList.contains("apk-busy")) return;
    button.classList.add("apk-busy");
    setTimeout(() => button.classList.remove("apk-busy"), delay);
  }

  function installTouchFeedback() {
    if (!isApk() || document.body.classList.contains("apk-runtime")) return;
    document.body.classList.add("apk-runtime");

    document.addEventListener("click", (event) => {
      const button = event.target.closest("button, .item, .folder-card, .file-card, [role='button']");
      if (!button) return;
      feedbackForButton(button);
    }, true);

    appToast("Mode APK optimisé actif", "success");
  }

  function installDeleteSafety() {
    if (!isApk() || window.__gestionDeleteSafetyInstalled) return;
    window.__gestionDeleteSafetyInstalled = true;

    document.addEventListener("click", (event) => {
      const button = event.target.closest("#btnDeleteItem, #btnDeleteSelected, #btnViewerDelete");
      if (!button) return;

      nativeHaptic("danger");
      setTimeout(() => appToast("Suppression en cours…", "danger"), 120);
    }, true);
  }

  window.addEventListener("gestion-native-folder-imported", (event) => {
    const count = Number(event.detail?.count || 0);
    if (count > 0) {
      nativeHaptic("success");
      appToast(`${count} fichier${count > 1 ? "s" : ""} importé${count > 1 ? "s" : ""}`, "success");
    } else {
      nativeHaptic("error");
      appToast("Aucun fichier importé", "danger");
    }
  });

  function boot() {
    installTouchFeedback();
    installDeleteSafety();
  }

  document.addEventListener("DOMContentLoaded", () => setTimeout(boot, 300));
  setTimeout(boot, 900);
  setInterval(boot, 2500);
})();
