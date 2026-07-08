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

  async function sendItemsToMontage(items) {
    const safeItems = (items || []).filter(item => item && item.type === "file");
    if (!safeItems.length) {
      toast("Sélectionne un fichier à envoyer vers Montage IA");
      return;
    }

    if (typeof window.shareItems === "function") {
      toast("Choisis Montage IA dans la fenêtre de partage Android");
      await window.shareItems(safeItems);
      return;
    }

    toast("Partage Android indisponible dans cette version");
  }

  function makeButton(id, text) {
    if (document.getElementById(id)) return null;
    const btn = document.createElement("button");
    btn.id = id;
    btn.type = "button";
    btn.textContent = text;
    btn.style.fontWeight = "800";
    return btn;
  }

  function installButtons() {
    const modalCard = document.querySelector("#optionsModal .modal-card");
    const viewerFooter = document.querySelector("#viewerModal .viewer-footer");
    const moreCard = document.querySelector("#moreModal .modal-card");

    if (modalCard && !document.getElementById("btnSendToMontage")) {
      const btn = makeButton("btnSendToMontage", "🎬 Envoyer vers Montage IA");
      const reference = document.getElementById("btnDownloadItem");
      modalCard.insertBefore(btn, reference || modalCard.firstChild);
      btn.onclick = async () => {
        if (!window.selectedItem) return toast("Aucun fichier sélectionné");
        await sendItemsToMontage([window.selectedItem]);
        const modal = document.getElementById("optionsModal");
        if (modal) modal.classList.add("hidden");
      };
    }

    if (viewerFooter && !document.getElementById("btnViewerSendToMontage")) {
      const btn = makeButton("btnViewerSendToMontage", "🎬 Montage IA");
      viewerFooter.insertBefore(btn, viewerFooter.firstChild);
      btn.onclick = async () => {
        if (!window.viewerItem) return toast("Aucun fichier ouvert");
        await sendItemsToMontage([window.viewerItem]);
      };
    }

    if (moreCard && !document.getElementById("btnSendSelectedToMontage")) {
      const btn = makeButton("btnSendSelectedToMontage", "🎬 Envoyer vers Montage IA");
      const reference = document.getElementById("btnDownloadSelected");
      moreCard.insertBefore(btn, reference || moreCard.firstChild);
      btn.onclick = async () => {
        if (typeof window.getSelectedItems !== "function") return toast("Sélection indisponible");
        const items = await window.getSelectedItems();
        await sendItemsToMontage(items);
        const modal = document.getElementById("moreModal");
        if (modal) modal.classList.add("hidden");
      };
    }
  }

  document.addEventListener("DOMContentLoaded", () => setTimeout(installButtons, 500));
  setTimeout(installButtons, 1200);
})();
