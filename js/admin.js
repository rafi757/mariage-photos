// js/admin.js

// ⚠️ Mot de passe simple côté client — dissuasif seulement, pas une vraie
// sécurité (site 100% statique, pas de serveur pour vérifier). Ne partage
// jamais ce lien admin publiquement. Change cette valeur avant de déployer.
const ADMIN_PASSWORD = "changeMoi2026";

const loginScreen = document.getElementById("loginScreen");
const adminScreen = document.getElementById("adminScreen");
const passwordInput = document.getElementById("passwordInput");
const loginBtn = document.getElementById("loginBtn");
const loginError = document.getElementById("loginError");

const countText = document.getElementById("countText");
const adminGrid = document.getElementById("adminGrid");
const downloadAllBtn = document.getElementById("downloadAllBtn");
const zipProgress = document.getElementById("zipProgress");

const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightboxImg");
const lightboxClose = document.getElementById("lightboxClose");
const lightboxCounter = document.getElementById("lightboxCounter");

let allPhotos = [];
let currentIndex = -1;

// --- Authentification simple (session le temps de l'onglet) ---

if (sessionStorage.getItem("adminAuth") === "true") {
  showAdmin();
}

loginBtn.addEventListener("click", checkPassword);
passwordInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") checkPassword();
});

function checkPassword() {
  if (passwordInput.value === ADMIN_PASSWORD) {
    sessionStorage.setItem("adminAuth", "true");
    showAdmin();
  } else {
    loginError.hidden = false;
  }
}

function showAdmin() {
  loginScreen.hidden = true;
  adminScreen.hidden = false;
  loadAllPhotos();
}

// --- Chargement de toutes les photos ---

async function loadAllPhotos() {
  allPhotos = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const url = `${CONFIG.SUPABASE_URL}/rest/v1/photos?select=id,url,nom_invite,public_id,created_at&order=created_at.desc&offset=${offset}&limit=${limit}`;
    const res = await fetch(url, {
      headers: {
        "apikey": CONFIG.SUPABASE_KEY,
        "Authorization": `Bearer ${CONFIG.SUPABASE_KEY}`
      }
    });
    if (!res.ok) break;
    const batch = await res.json();
    allPhotos = allPhotos.concat(batch);
    if (batch.length < limit) break;
    offset += limit;
  }

  countText.textContent = `${allPhotos.length} photo(s) au total`;
  renderGrid();
}

function renderGrid() {
  adminGrid.innerHTML = "";
  allPhotos.forEach((photo, index) => {
    const item = document.createElement("div");
    item.className = "photo-item";

    const img = document.createElement("img");
    img.src = photo.url;
    img.loading = "lazy";
    item.appendChild(img);

    const actions = document.createElement("div");
    actions.className = "photo-actions";

    const dlBtn = document.createElement("button");
    dlBtn.className = "download-single";
    dlBtn.type = "button";
    dlBtn.textContent = "⬇";
    dlBtn.title = "Télécharger";
    dlBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      downloadSinglePhoto(photo, index, dlBtn);
    });
    actions.appendChild(dlBtn);

    const delBtn = document.createElement("button");
    delBtn.className = "delete-single";
    delBtn.type = "button";
    delBtn.textContent = "🗑️";
    delBtn.title = "Supprimer";
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteSinglePhoto(photo, delBtn);
    });
    actions.appendChild(delBtn);

    item.appendChild(actions);

    item.addEventListener("click", () => openLightbox(index));

    adminGrid.appendChild(item);
  });
}

// --- Sauvegarde de fichier avec choix d'emplacement (avec repli automatique) ---
//
// showSaveFilePicker() n'est disponible que sur les navigateurs basés
// Chromium (Chrome/Edge, desktop et Android). Sur Safari/Firefox, on
// retombe automatiquement sur le téléchargement classique (dossier de
// téléchargement par défaut du navigateur).
async function saveBlob(blob, suggestedName, mimeType) {
  const supportsPicker = "showSaveFilePicker" in window;

  if (supportsPicker) {
    try {
      const ext = suggestedName.split(".").pop();
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [{
          description: "Fichier",
          accept: { [mimeType || "application/octet-stream"]: ["." + ext] }
        }]
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return "saved";
    } catch (err) {
      if (err.name === "AbortError") return "cancelled"; // l'utilisateur a fermé le dialogue
      console.error("Erreur showSaveFilePicker, repli classique:", err);
      // on continue vers le repli ci-dessous
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = suggestedName;
  link.click();
  URL.revokeObjectURL(url);
  return "saved";
}

function fileNameFor(photo, index, ext) {
  return photo.nom_invite
    ? `${photo.nom_invite}-${index + 1}.${ext}`
    : `photo-${index + 1}.${ext}`;
}

async function downloadSinglePhoto(photo, index, btnEl) {
  const original = btnEl.textContent;
  btnEl.disabled = true;
  btnEl.textContent = "…";
  try {
    const res = await fetch(photo.url);
    const blob = await res.blob();
    const ext = (blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
    await saveBlob(blob, fileNameFor(photo, index, ext), blob.type);
  } catch (err) {
    console.error("Erreur téléchargement photo:", err);
    alert("Impossible de télécharger cette photo.");
  } finally {
    btnEl.disabled = false;
    btnEl.textContent = original;
  }
}

// --- Suppression d'une photo ---
//
// Supprime uniquement la ligne dans Supabase (donc la photo disparaît du
// site : admin + galerie publique). Le fichier reste stocké chez Cloudinary
// (suppression réelle impossible en toute sécurité depuis un site 100%
// statique, ça nécessiterait la clé secrète). Le public_id est conservé
// dans Supabase avant suppression de la ligne si jamais tu veux la
// retrouver manuellement dans ta Media Library Cloudinary.
async function deleteSinglePhoto(photo, btnEl) {
  const confirmed = confirm("Supprimer définitivement cette photo du site ? Cette action est irréversible.");
  if (!confirmed) return;

  btnEl.disabled = true;
  const original = btnEl.textContent;
  btnEl.textContent = "…";

  try {
    const url = `${CONFIG.SUPABASE_URL}/rest/v1/photos?id=eq.${photo.id}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: {
        "apikey": CONFIG.SUPABASE_KEY,
        "Authorization": `Bearer ${CONFIG.SUPABASE_KEY}`,
        "Prefer": "return=minimal"
      }
    });
    if (!res.ok) throw new Error("Échec suppression");

    allPhotos = allPhotos.filter((p) => p.id !== photo.id);
    countText.textContent = `${allPhotos.length} photo(s) au total`;
    renderGrid();
  } catch (err) {
    console.error("Erreur suppression photo:", err);
    alert("Impossible de supprimer cette photo.");
    btnEl.disabled = false;
    btnEl.textContent = original;
  }
}

// --- Suppression de toutes les photos ---

const deleteAllBtn = document.getElementById("deleteAllBtn");
const deleteProgress = document.getElementById("deleteProgress");

deleteAllBtn.addEventListener("click", async () => {
  if (allPhotos.length === 0) return;

  const firstConfirm = confirm(
    `Supprimer définitivement les ${allPhotos.length} photo(s) du site ? Cette action est irréversible.`
  );
  if (!firstConfirm) return;

  const typed = prompt('Pour confirmer, tape SUPPRIMER en majuscules :');
  if (typed !== "SUPPRIMER") {
    alert("Suppression annulée.");
    return;
  }

  deleteAllBtn.disabled = true;
  downloadAllBtn.disabled = true;
  deleteProgress.hidden = false;

  let done = 0;
  const total = allPhotos.length;

  for (const photo of [...allPhotos]) {
    try {
      const url = `${CONFIG.SUPABASE_URL}/rest/v1/photos?id=eq.${photo.id}`;
      await fetch(url, {
        method: "DELETE",
        headers: {
          "apikey": CONFIG.SUPABASE_KEY,
          "Authorization": `Bearer ${CONFIG.SUPABASE_KEY}`,
          "Prefer": "return=minimal"
        }
      });
    } catch (err) {
      console.error("Erreur suppression:", err);
    }
    done++;
    deleteProgress.textContent = `Suppression... ${done}/${total}`;
  }

  allPhotos = [];
  countText.textContent = "0 photo(s) au total";
  renderGrid();

  deleteProgress.textContent = "✅ Toutes les photos ont été supprimées";
  deleteAllBtn.disabled = false;
  downloadAllBtn.disabled = false;
});

// --- Téléchargement groupé en .zip ---

downloadAllBtn.addEventListener("click", async () => {
  if (allPhotos.length === 0) return;

  downloadAllBtn.disabled = true;
  zipProgress.hidden = false;

  const zip = new JSZip();
  let done = 0;

  for (const photo of allPhotos) {
    try {
      const res = await fetch(photo.url);
      const blob = await res.blob();
      const ext = (blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
      zip.file(fileNameFor(photo, done, ext), blob);
    } catch (err) {
      console.error("Erreur téléchargement photo pour zip:", err);
    }
    done++;
    zipProgress.textContent = `Préparation du zip... ${done}/${allPhotos.length}`;
  }

  zipProgress.textContent = "Compression en cours...";
  const content = await zip.generateAsync({ type: "blob" });

  const result = await saveBlob(content, "photos-mariage.zip", "application/zip");
  zipProgress.textContent = result === "cancelled" ? "Téléchargement annulé" : "✅ Téléchargement terminé";
  downloadAllBtn.disabled = false;
});

// --- Lightbox : exploration en plein écran + swipe (identique à la galerie) ---

function setPhotoContent(photo) {
  lightboxImg.src = photo.url;
  lightboxCounter.textContent = `${currentIndex + 1} / ${allPhotos.length}`;
}

function openLightbox(index) {
  currentIndex = index;
  const photo = allPhotos[currentIndex];
  if (!photo) return;
  setPhotoContent(photo);
  lightbox.hidden = false;
  history.pushState({ lightboxOpen: true }, "");
}

function closeLightbox(fromPopstate) {
  lightbox.hidden = true;
  lightboxImg.src = "";
  if (!fromPopstate) {
    history.back();
  }
}

lightboxClose.addEventListener("click", () => closeLightbox(false));

lightbox.addEventListener("click", (e) => {
  if (e.target === lightbox) closeLightbox(false);
});

window.addEventListener("popstate", () => {
  if (!lightbox.hidden) {
    closeLightbox(true);
  }
});

document.addEventListener("keydown", (e) => {
  if (lightbox.hidden) return;
  if (e.key === "ArrowRight") showPhoto(currentIndex + 1);
  if (e.key === "ArrowLeft") showPhoto(currentIndex - 1);
  if (e.key === "Escape") closeLightbox(false);
});

function showPhoto(index) {
  if (index < 0 || index >= allPhotos.length) return;
  currentIndex = index;
  transitionToPhoto(allPhotos[currentIndex]);
}

function transitionToPhoto(photo) {
  lightboxImg.classList.add("is-changing");
  setTimeout(() => {
    setPhotoContent(photo);
    lightboxImg.onload = () => {
      requestAnimationFrame(() => lightboxImg.classList.remove("is-changing"));
    };
  }, 90);
}

let touchStartX = null;
let touchStartY = null;

lightbox.addEventListener("touchstart", (e) => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

lightbox.addEventListener("touchend", (e) => {
  if (touchStartX === null) return;

  const deltaX = e.changedTouches[0].clientX - touchStartX;
  const deltaY = e.changedTouches[0].clientY - touchStartY;
  const threshold = 50;

  if (Math.abs(deltaX) > threshold && Math.abs(deltaX) > Math.abs(deltaY)) {
    if (deltaX > 0) {
      showPhoto(currentIndex - 1);
    } else {
      showPhoto(currentIndex + 1);
    }
  }

  touchStartX = null;
  touchStartY = null;
});