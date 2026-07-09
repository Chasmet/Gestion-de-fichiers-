(() => {
  function toast(message) {
    const el = document.getElementById("toast");
    if (el) {
      el.textContent = message;
      el.classList.remove("hidden");
      setTimeout(() => el.classList.add("hidden"), 2400);
      return;
    }
    alert(message);
  }

  function openAndroidFolderImporter() {
    if (!window.GestionNativeStore || typeof window.GestionNativeStore.openAndroidFolderImporter !== "function") {
      toast("Import dossier disponible seulement dans l’APK Gestionnaire.");
      return;
    }

    window.GestionNativeStore.openAndroidFolderImporter();
    toast("Choisis un dossier dans le gestionnaire de fichiers Android.");
  }

  function installButton() {
    if (document.getElementById("btnImportFolderNative")) return;

    const importButton = document.getElementById("btnImport");
    const actions = document.querySelector(".actions");
    if (!importButton || !actions) return;

    const btn = document.createElement("button");
    btn.id = "btnImportFolderNative";
    btn.type = "button";
    btn.className = importButton.className || "main-btn secondary";
    btn.textContent = "📂 Importer dossier";
    btn.onclick = openAndroidFolderImporter;

    actions.insertBefore(btn, importButton.nextSibling);
  }

  window.addEventListener("gestion-native-folder-imported", () => {
    toast("Dossier importé. Ouvre Montage IA pour piocher dedans.");
  });

  document.addEventListener("DOMContentLoaded", () => setTimeout(installButton, 400));
  setTimeout(installButton, 1200);
})();
