
const fileInput = document.getElementById("fileInput");
const previewGrid = document.getElementById("previewGrid");
const sendBtn = document.getElementById("sendBtn");
const nomInvite = document.getElementById("nomInvite");
const progressWrap = document.getElementById("progressWrap");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");
const successMsg = document.getElementById("successMsg");

let selectedFiles = [];

fileInput.addEventListener("change", (e) => {
  selectedFiles = Array.from(e.target.files);
  renderPreview();
  sendBtn.disabled = selectedFiles.length === 0;
});

function renderPreview() {
  previewGrid.innerHTML = "";
  selectedFiles.forEach((file) => {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    previewGrid.appendChild(img);
  });
}

sendBtn.addEventListener("click", async () => {
  if (selectedFiles.length === 0) return;

  sendBtn.disabled = true;
  progressWrap.hidden = false;
  successMsg.hidden = true;

  let uploaded = 0;

  for (const file of selectedFiles) {
    try {
      const compressed = await compressImage(file);
      const { url: cloudinaryUrl, publicId } = await uploadToCloudinary(compressed);
      await saveToSupabase(cloudinaryUrl, nomInvite.value.trim(), publicId);
      uploaded++;
      updateProgress(uploaded, selectedFiles.length);
    } catch (err) {
      console.error("Erreur upload:", err);
      alert("Une photo n'a pas pu être envoyée. On continue avec les suivantes.");
    }
  }

  progressWrap.hidden = true;
  successMsg.hidden = false;
  selectedFiles = [];
  previewGrid.innerHTML = "";
  fileInput.value = "";
  sendBtn.disabled = true;
});

function updateProgress(done, total) {
  const pct = Math.round((done / total) * 100);
  progressBar.style.width = pct + "%";
  progressText.textContent = `${done}/${total}`;
}

function compressImage(file, maxWidth = 1920, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => { img.src = e.target.result; };
    reader.onerror = reject;

    img.onload = () => {
      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error("Échec compression"));
          resolve(blob);
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = reject;

    reader.readAsDataURL(file);
  });
}

async function uploadToCloudinary(file) {
  const url = `https://api.cloudinary.com/v1_1/${CONFIG.CLOUDINARY_CLOUD_NAME}/image/upload`;
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CONFIG.CLOUDINARY_UPLOAD_PRESET);

  const res = await fetch(url, { method: "POST", body: formData });
  if (!res.ok) throw new Error("Échec upload Cloudinary");
  const data = await res.json();
  return { url: data.secure_url, publicId: data.public_id };
}

async function saveToSupabase(photoUrl, nom, publicId) {
  const url = `${CONFIG.SUPABASE_URL}/rest/v1/photos`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": CONFIG.SUPABASE_KEY,
      "Authorization": `Bearer ${CONFIG.SUPABASE_KEY}`,
      "Prefer": "return=minimal"
    },
    body: JSON.stringify({ url: photoUrl, nom_invite: nom || null, public_id: publicId || null })
  });
  if (!res.ok) throw new Error("Échec enregistrement Supabase");
}