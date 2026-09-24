// js/galerie.js

const galerieGrid = document.getElementById("galerieGrid");
const emptyMsg = document.getElementById("emptyMsg");
const loadMoreBtn = document.getElementById("loadMoreBtn");
const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightboxImg");
const lightboxClose = document.getElementById("lightboxClose");
const lightboxCounter = document.getElementById("lightboxCounter");

const PAGE_SIZE = 12;
let currentOffset = 0;
let isLoading = false;
let noMoreToLoad = false;

// Toutes les photos chargées jusqu'ici (across les pages), pour permettre
// la navigation par swipe dans la lightbox.
let loadedPhotos = [];
let currentIndex = -1;

async function fetchPhotos(offset, limit) {
  const url = `${CONFIG.SUPABASE_URL}/rest/v1/photos?select=url,nom_invite,created_at&order=created_at.desc&offset=${offset}&limit=${limit}`;
  const res = await fetch(url, {
    headers: {
      "apikey": CONFIG.SUPABASE_KEY,
      "Authorization": `Bearer ${CONFIG.SUPABASE_KEY}`
    }
  });
  if (!res.ok) throw new Error("Échec chargement galerie");
  return res.json();
}

function renderPhotos(photos) {
  photos.forEach((photo) => {
    const index = loadedPhotos.length;
    loadedPhotos.push(photo);

    const item = document.createElement("div");
    item.className = "photo-item";

    const img = document.createElement("img");
    img.src = photo.url;
    img.loading = "lazy";
    img.alt = photo.nom_invite ? `Photo de ${photo.nom_invite}` : "Photo du mariage";
    item.appendChild(img);

    if (photo.nom_invite) {
      const badge = document.createElement("span");
      badge.className = "nom-badge";
      badge.textContent = photo.nom_invite;
      item.appendChild(badge);
    }

    item.addEventListener("click", () => openLightbox(index));
    galerieGrid.appendChild(item);
  });
}

async function loadMore() {
  if (isLoading || noMoreToLoad) return;
  isLoading = true;
  loadMoreBtn.disabled = true;
  loadMoreBtn.textContent = "Chargement...";

  try {
    const photos = await fetchPhotos(currentOffset, PAGE_SIZE);

    if (currentOffset === 0 && photos.length === 0) {
      emptyMsg.hidden = false;
      loadMoreBtn.hidden = true;
      noMoreToLoad = true;
      return;
    }

    renderPhotos(photos);
    currentOffset += photos.length;

    if (photos.length < PAGE_SIZE) {
      noMoreToLoad = true;
      loadMoreBtn.hidden = true;
    }
  } catch (err) {
    console.error("Erreur galerie:", err);
  } finally {
    isLoading = false;
    loadMoreBtn.disabled = false;
    loadMoreBtn.textContent = "Voir plus de photos";
  }
}

// --- Lightbox : ouverture / fermeture / navigation ---

function openLightbox(index) {
  currentIndex = index;
  showCurrentPhoto();
  lightbox.hidden = false;
  // On pousse un état dans l'historique pour pouvoir intercepter
  // le bouton "retour" du téléphone (voir écouteur popstate plus bas).
  history.pushState({ lightboxOpen: true }, "");
}

function closeLightbox(fromPopstate) {
  lightbox.hidden = true;
  lightboxImg.src = "";
  if (!fromPopstate) {
    // Retire l'état qu'on avait ajouté, sans quitter la page.
    history.back();
  }
}

lightboxClose.addEventListener("click", () => closeLightbox(false));

lightbox.addEventListener("click", (e) => {
  if (e.target === lightbox) closeLightbox(false);
});

// Bouton retour du téléphone / navigateur : si la lightbox est ouverte,
// on la ferme au lieu de quitter la galerie.
window.addEventListener("popstate", () => {
  if (!lightbox.hidden) {
    closeLightbox(true);
  }
});

// Flèches clavier (pratique aussi sur ordinateur/tablette avec clavier)
document.addEventListener("keydown", (e) => {
  if (lightbox.hidden) return;
  if (e.key === "ArrowRight") showPhoto(currentIndex + 1);
  if (e.key === "ArrowLeft") showPhoto(currentIndex - 1);
  if (e.key === "Escape") closeLightbox(false);
});

async function showPhoto(index) {
  if (index < 0) return;

  if (index >= loadedPhotos.length) {
    if (noMoreToLoad) return;
    await loadMore();
    if (index >= loadedPhotos.length) return;
  }

  currentIndex = index;
  showCurrentPhoto();
}

function showCurrentPhoto() {
  const photo = loadedPhotos[currentIndex];
  if (!photo) return;
  lightboxImg.src = photo.url;
  lightboxCounter.textContent = `${currentIndex + 1} / ${loadedPhotos.length}${noMoreToLoad ? "" : "+"}`;
}

// --- Swipe gauche / droite sur mobile ---

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

  // On ignore si le geste est plus vertical qu'horizontal
  // (évite de déclencher un swipe pendant un scroll).
  if (Math.abs(deltaX) > threshold && Math.abs(deltaX) > Math.abs(deltaY)) {
    if (deltaX > 0) {
      showPhoto(currentIndex - 1); // glissement vers la droite → photo précédente
    } else {
      showPhoto(currentIndex + 1); // glissement vers la gauche → photo suivante
    }
  }

  touchStartX = null;
  touchStartY = null;
});

loadMoreBtn.addEventListener("click", loadMore);

loadMore();