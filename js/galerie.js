// js/galerie.js

const galerieGrid = document.getElementById("galerieGrid");
const emptyMsg = document.getElementById("emptyMsg");
const loadMoreBtn = document.getElementById("loadMoreBtn");
const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightboxImg");
const lightboxClose = document.getElementById("lightboxClose");

const PAGE_SIZE = 12;
let currentOffset = 0;
let isLoading = false;

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

    item.addEventListener("click", () => openLightbox(photo.url));
    galerieGrid.appendChild(item);
  });
}

async function loadMore() {
  if (isLoading) return;
  isLoading = true;
  loadMoreBtn.disabled = true;
  loadMoreBtn.textContent = "Chargement...";

  try {
    const photos = await fetchPhotos(currentOffset, PAGE_SIZE);

    if (currentOffset === 0 && photos.length === 0) {
      emptyMsg.hidden = false;
      loadMoreBtn.hidden = true;
      return;
    }

    renderPhotos(photos);
    currentOffset += photos.length;

    loadMoreBtn.hidden = photos.length < PAGE_SIZE;
  } catch (err) {
    console.error("Erreur galerie:", err);
  } finally {
    isLoading = false;
    loadMoreBtn.disabled = false;
    loadMoreBtn.textContent = "Voir plus de photos";
  }
}

function openLightbox(url) {
  lightboxImg.src = url;
  lightbox.hidden = false;
}

function closeLightbox() {
  lightbox.hidden = true;
  lightboxImg.src = "";
}

lightboxClose.addEventListener("click", closeLightbox);
lightbox.addEventListener("click", (e) => {
  if (e.target === lightbox) closeLightbox();
});

loadMoreBtn.addEventListener("click", loadMore);

loadMore();