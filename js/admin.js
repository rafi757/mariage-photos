
const ADMIN_PASSWORD = "lcxchx";

const loginScreen = document.getElementById("loginScreen");
const adminScreen = document.getElementById("adminScreen");
const passwordInput = document.getElementById("passwordInput");
const loginBtn = document.getElementById("loginBtn");
const loginError = document.getElementById("loginError");

const countText = document.getElementById("countText");
const adminGrid = document.getElementById("adminGrid");
const downloadAllBtn = document.getElementById("downloadAllBtn");
const zipProgress = document.getElementById("zipProgress");

let allPhotos = [];

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

// --- Chargement de toutes les photos (pagination interne, tout récupérer) ---

async function loadAllPhotos() {
  allPhotos = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const url = `${CONFIG.SUPABASE_URL}/rest/v1/photos?select=url,nom_invite,created_at&order=created_at.desc&offset=${offset}&limit=${limit}`;
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

    const dl = document.createElement("a");
    dl.className = "download-single";
    dl.href = photo.url;
    dl.download = `photo-${index + 1}.jpg`;
    dl.textContent = "⬇";
    dl.target = "_blank";
    dl.rel = "noopener";
    item.appendChild(dl);

    adminGrid.appendChild(item);
  });
}

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
      const name = photo.nom_invite
        ? `${photo.nom_invite}-${done + 1}.${ext}`
        : `photo-${done + 1}.${ext}`;
      zip.file(name, blob);
    } catch (err) {
      console.error("Erreur téléchargement photo pour zip:", err);
    }
    done++;
    zipProgress.textContent = `Préparation du zip... ${done}/${allPhotos.length}`;
  }

  zipProgress.textContent = "Compression en cours...";
  const content = await zip.generateAsync({ type: "blob" });

  const link = document.createElement("a");
  link.href = URL.createObjectURL(content);
  link.download = "photos-mariage.zip";
  link.click();

  zipProgress.textContent = "✅ Téléchargement lancé";
  downloadAllBtn.disabled = false;
});