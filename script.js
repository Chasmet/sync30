const ADMIN_CODE = "CHK-PRO-28@2026-CHK";

const VEED_API_URL = "https://sync30-api.onrender.com";
const SYNCUP_API_URL = "https://sync30-kling-api.onrender.com";

const VEED_DISPLAY_SECONDS = 30;
const VEED_TOLERANCE_SECONDS = 32;
const SYNCUP_MAX_SECONDS = 9;

const ALLOWED_VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "m4v", "ogg"];
const ALLOWED_AUDIO_EXTENSIONS = ["mp3", "wav", "m4a", "aac", "ogg", "webm"];

const SUPABASE_URL = "https://hfzbkgnccyyrotijnlda.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_j_dMdudOZakRbeKQQRVWDQ_TYI2mwka";
const SUPABASE_BUCKET = "videos";

const themeToggle = document.getElementById("themeToggle");
const body = document.body;

const adminBtn = document.getElementById("adminBtn");
const engineSelect = document.getElementById("engineSelect");

const engineRulesText = document.getElementById("engineRulesText");
const engineDescription = document.getElementById("engineDescription");
const videoRulesText = document.getElementById("videoRulesText");
const audioRulesText = document.getElementById("audioRulesText");

const videoInput = document.getElementById("videoInput");
const audioInput = document.getElementById("audioInput");
const videoFileName = document.getElementById("videoFileName");
const audioFileName = document.getElementById("audioFileName");
const generateBtn = document.getElementById("generateBtn");
const warningText = document.getElementById("warningText");

const progressCard = document.getElementById("progressCard");
const progressFill = document.getElementById("progressFill");
const progressText = document.getElementById("progressText");

const resultCard = document.getElementById("resultCard");
const previewVideo = document.getElementById("previewVideo");
const downloadBtn = document.getElementById("downloadBtn");
const resetBtn = document.getElementById("resetBtn");

const modeLabel = document.getElementById("modeLabel");
const creditsLabel = document.getElementById("creditsLabel");
const accountBadge = document.getElementById("accountBadge");
const hintText = document.getElementById("hintText");

const refreshVideosBtn = document.getElementById("refreshVideosBtn");
const videoGallery = document.getElementById("videoGallery");
const emptyVideosBox = document.getElementById("emptyVideosBox");

let freeTrials = parseInt(localStorage.getItem("sync30_free_trials") || "5", 10);
let isAdmin = localStorage.getItem("sync30_admin") === "true";

const supabaseClient =
  window.supabase && window.supabase.createClient
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
    : null;

themeToggle?.addEventListener("click", () => {
  body.classList.toggle("light");
  body.classList.toggle("dark");
  themeToggle.textContent = body.classList.contains("light") ? "☀️" : "🌙";
  localStorage.setItem(
    "sync30_theme",
    body.classList.contains("light") ? "light" : "dark"
  );
});

adminBtn?.addEventListener("click", () => {
  if (isAdmin) {
    const leaveAdmin = confirm("Tu es déjà en mode admin. Voulez-vous quitter le mode admin ?");
    if (leaveAdmin) {
      isAdmin = false;
      localStorage.setItem("sync30_admin", "false");
      updateAccountDisplay();
      alert("Mode admin désactivé.");
    }
    return;
  }

  const code = prompt("Entre ton code admin :");
  if (code === null) return;

  if (code === ADMIN_CODE) {
    isAdmin = true;
    localStorage.setItem("sync30_admin", "true");
    updateAccountDisplay();
    alert("Mode admin activé.");
  } else {
    alert("Code admin incorrect.");
  }
});

engineSelect?.addEventListener("change", () => {
  updateEngineTexts();
  revalidateSelectedFiles();
});

videoInput?.addEventListener("change", async () => {
  const file = videoInput.files?.[0];
  if (!file) return;

  if (!isAllowedExtension(file.name, ALLOWED_VIDEO_EXTENSIONS)) {
    showWarning("Format vidéo non supporté. Utilise MP4, WEBM, MOV, M4V ou OGG.");
    videoInput.value = "";
    videoFileName.textContent = "Aucune vidéo sélectionnée";
    return;
  }

  videoFileName.textContent = file.name;

  const ok = await validateMediaDuration(file, "video");
  if (!ok) {
    showWarning(getDurationErrorMessage("video"));
    videoInput.value = "";
    videoFileName.textContent = "Aucune vidéo sélectionnée";
    return;
  }

  clearWarning();
});

audioInput?.addEventListener("change", async () => {
  const file = audioInput.files?.[0];
  if (!file) return;

  if (!isAllowedExtension(file.name, ALLOWED_AUDIO_EXTENSIONS)) {
    showWarning("Format audio non supporté. Utilise MP3, WAV, M4A, AAC, OGG ou WEBM.");
    audioInput.value = "";
    audioFileName.textContent = "Aucun audio sélectionné";
    return;
  }

  audioFileName.textContent = file.name;

  const ok = await validateMediaDuration(file, "audio");
  if (!ok) {
    showWarning(getDurationErrorMessage("audio"));
    audioInput.value = "";
    audioFileName.textContent = "Aucun audio sélectionné";
    return;
  }

  clearWarning();
});

generateBtn?.addEventListener("click", async () => {
  const videoFile = videoInput.files?.[0];
  const audioFile = audioInput.files?.[0];
  const engine = getSelectedEngine();

  if (!videoFile) {
    showWarning("Ajoute d’abord une vidéo.");
    return;
  }

  if (!audioFile) {
    showWarning("Ajoute d’abord un audio.");
    return;
  }

  if (!isAllowedExtension(videoFile.name, ALLOWED_VIDEO_EXTENSIONS)) {
    showWarning("Format vidéo non supporté. Utilise MP4, WEBM, MOV, M4V ou OGG.");
    return;
  }

  if (!isAllowedExtension(audioFile.name, ALLOWED_AUDIO_EXTENSIONS)) {
    showWarning("Format audio non supporté. Utilise MP3, WAV, M4A, AAC, OGG ou WEBM.");
    return;
  }

  const isVideoOk = await validateMediaDuration(videoFile, "video");
  const isAudioOk = await validateMediaDuration(audioFile, "audio");

  if (!isVideoOk) {
    showWarning(getDurationErrorMessage("video"));
    return;
  }

  if (!isAudioOk) {
    showWarning(getDurationErrorMessage("audio"));
    return;
  }

  if (!isAdmin && freeTrials <= 0) {
    showWarning("Tu n’as plus d’essais gratuits. Passe à un pack crédits.");
    return;
  }

  clearWarning();
  setGeneratingState(true);
  startProgressAnimation();

  let objectUrlToRevoke = null;

  try {
    const formData = new FormData();
    formData.append("video", videoFile);
    formData.append("audio", audioFile);

    const endpoint =
      engine === "veed"
        ? `${VEED_API_URL}/lipsync`
        : `${SYNCUP_API_URL}/sync`;

    const response = await fetch(endpoint, {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      let msg = "Erreur serveur";
      try {
        const errData = await response.json();
        msg = errData.details || errData.error || msg;
      } catch {}
      throw new Error(msg);
    }

    if (!isAdmin) {
      freeTrials -= 1;
      localStorage.setItem("sync30_free_trials", String(freeTrials));
      updateAccountDisplay();
    }

    finishProgressAnimation();

    let resultBlob = null;
    let fallbackPreviewUrl = "";
    let fallbackDownloadName = "";

    if (engine === "veed") {
      const data = await response.json();

      if (!data.videoUrl) {
        throw new Error("Aucune URL vidéo renvoyée par VEED");
      }

      fallbackPreviewUrl = data.videoUrl;
      fallbackDownloadName = "sync30-veed.mp4";

      try {
        const fetchedVideo = await fetch(data.videoUrl);
        if (!fetchedVideo.ok) {
          throw new Error("Impossible de télécharger la vidéo VEED pour l’enregistrer");
        }
        resultBlob = await fetchedVideo.blob();
      } catch (fetchError) {
        console.warn(fetchError);
      }
    } else {
      const blob = await response.blob();
      resultBlob = blob;
      const url = URL.createObjectURL(blob);
      objectUrlToRevoke = url;
      fallbackPreviewUrl = url;
      fallbackDownloadName = "sync30-syncup.mp4";
    }

    let savedPublicUrl = null;

    if (resultBlob) {
      try {
        savedPublicUrl = await uploadResultBlobToSupabase(resultBlob, engine);
      } catch (uploadError) {
        console.warn(uploadError);
      }
    }

    const finalPreviewUrl = savedPublicUrl || fallbackPreviewUrl;

    previewVideo.src = finalPreviewUrl;
    downloadBtn.href = finalPreviewUrl;
    downloadBtn.download = savedPublicUrl
      ? `sync30-${engine}-saved.mp4`
      : fallbackDownloadName;

    if (savedPublicUrl) {
      hintText.textContent =
        "Vidéo générée et enregistrée dans Mes vidéos.";
      await loadSavedVideos();
    } else {
      hintText.textContent =
        "Vidéo générée. Lecture disponible, mais l’enregistrement Supabase a échoué ou n’a pas encore les autorisations.";
      showWarning(
        "La génération a réussi, mais l’enregistrement dans Supabase a échoué. Il faudra probablement ajouter les policies Storage."
      );
    }

    resultCard.classList.remove("hidden");
    resultCard.dataset.objectUrl = objectUrlToRevoke || "";
  } catch (error) {
    stopProgressAnimation();
    showWarning(`Erreur lors de l’envoi au serveur : ${error.message}`);
  } finally {
    setGeneratingState(false);
  }
});

resetBtn?.addEventListener("click", () => {
  resetInterface();
});

refreshVideosBtn?.addEventListener("click", async () => {
  await loadSavedVideos();
});

function getSelectedEngine() {
  return engineSelect ? engineSelect.value : "syncup";
}

function getCurrentMaxSeconds() {
  const engine = getSelectedEngine();
  return engine === "veed" ? VEED_TOLERANCE_SECONDS : SYNCUP_MAX_SECONDS;
}

function getDurationErrorMessage(type) {
  const engine = getSelectedEngine();

  if (engine === "veed") {
    return `Le ${type === "video" ? "fichier vidéo" : "fichier audio"} dépasse la limite de VEED. ${VEED_DISPLAY_SECONDS} secondes affichées, ${VEED_TOLERANCE_SECONDS} secondes tolérées maximum.`;
  }

  return `Le ${type === "video" ? "fichier vidéo" : "fichier audio"} dépasse la limite de Sync-up. Maximum autorisé : ${SYNCUP_MAX_SECONDS} secondes.`;
}

function updateEngineTexts() {
  const engine = getSelectedEngine();

  if (engine === "veed") {
    engineRulesText.textContent =
      "Mode VEED actif : 30 secondes affichées et tolérance technique jusqu’à 32 secondes.";
    engineDescription.textContent =
      "VEED = qualité premium.";
    videoRulesText.textContent =
      "Formats supportés : MP4, WEBM, MOV, M4V, OGG • VEED : 30 secondes affichées • tolérance jusqu’à 32 secondes.";
    audioRulesText.textContent =
      "Formats supportés : MP3, WAV, M4A, AAC, OGG, WEBM • VEED : 30 secondes affichées • tolérance jusqu’à 32 secondes.";
  } else {
    engineRulesText.textContent =
      "Mode Sync-up actif : vidéo et audio limités à 9 secondes maximum.";
    engineDescription.textContent =
      "Sync-up = lip-sync économique.";
    videoRulesText.textContent =
      "Formats supportés : MP4, WEBM, MOV, M4V, OGG • Sync-up : 9 secondes maximum.";
    audioRulesText.textContent =
      "Formats supportés : MP3, WAV, M4A, AAC, OGG, WEBM • Sync-up : 9 secondes maximum.";
  }
}

async function revalidateSelectedFiles() {
  const videoFile = videoInput.files?.[0];
  const audioFile = audioInput.files?.[0];

  if (videoFile) {
    const ok = await validateMediaDuration(videoFile, "video");
    if (!ok) {
      showWarning(getDurationErrorMessage("video"));
      videoInput.value = "";
      videoFileName.textContent = "Aucune vidéo sélectionnée";
      return;
    }
  }

  if (audioFile) {
    const ok = await validateMediaDuration(audioFile, "audio");
    if (!ok) {
      showWarning(getDurationErrorMessage("audio"));
      audioInput.value = "";
      audioFileName.textContent = "Aucun audio sélectionné";
      return;
    }
  }

  clearWarning();
}

function updateAccountDisplay() {
  if (isAdmin) {
    modeLabel.textContent = "Admin";
    creditsLabel.textContent = "Illimité";
    accountBadge.textContent = "Compte administrateur";
    hintText.textContent = "Ton mode admin est actif. Générations gratuites illimitées.";
  } else {
    modeLabel.textContent = "Utilisateur";
    creditsLabel.textContent = `${freeTrials} essais gratuits`;
    accountBadge.textContent = "Compte standard";
    hintText.textContent =
      "Toi = mode admin gratuit illimité. Les autres = 5 essais gratuits puis packs payants.";
  }
}

function showWarning(message) {
  warningText.classList.remove("hidden");
  warningText.textContent = message;
}

function clearWarning() {
  warningText.classList.add("hidden");
  warningText.textContent = "";
}

function setGeneratingState(isLoading) {
  generateBtn.disabled = isLoading;
  generateBtn.textContent = isLoading ? "Envoi au serveur..." : "Generate";
}

let progressInterval = null;
let progressValue = 0;

function startProgressAnimation() {
  progressCard.classList.remove("hidden");
  resultCard.classList.add("hidden");
  progressValue = 0;
  progressFill.style.width = "0%";
  progressText.textContent = "0%";

  clearInterval(progressInterval);

  progressInterval = setInterval(() => {
    if (progressValue < 90) {
      progressValue += Math.random() * 12;
      if (progressValue > 90) progressValue = 90;
      progressFill.style.width = `${progressValue}%`;
      progressText.textContent = `${Math.round(progressValue)}%`;
    }
  }, 400);
}

function finishProgressAnimation() {
  clearInterval(progressInterval);
  progressValue = 100;
  progressFill.style.width = "100%";
  progressText.textContent = "100%";
}

function stopProgressAnimation() {
  clearInterval(progressInterval);
  progressCard.classList.add("hidden");
  progressFill.style.width = "0%";
  progressText.textContent = "0%";
}

function resetInterface() {
  clearInterval(progressInterval);

  progressCard.classList.add("hidden");
  resultCard.classList.add("hidden");

  progressFill.style.width = "0%";
  progressText.textContent = "0%";

  const oldObjectUrl = resultCard.dataset.objectUrl;
  if (oldObjectUrl) {
    URL.revokeObjectURL(oldObjectUrl);
    resultCard.dataset.objectUrl = "";
  }

  previewVideo.pause();
  previewVideo.removeAttribute("src");
  previewVideo.load();

  downloadBtn.href = "#";

  videoInput.value = "";
  audioInput.value = "";

  videoFileName.textContent = "Aucune vidéo sélectionnée";
  audioFileName.textContent = "Aucun audio sélectionné";

  clearWarning();
  setGeneratingState(false);
  updateAccountDisplay();
  updateEngineTexts();
}

function validateMediaDuration(file, type) {
  return new Promise((resolve) => {
    const element = document.createElement(type === "audio" ? "audio" : "video");
    element.preload = "metadata";
    element.src = URL.createObjectURL(file);

    element.onloadedmetadata = () => {
      URL.revokeObjectURL(element.src);
      resolve(element.duration <= getCurrentMaxSeconds());
    };

    element.onerror = () => {
      resolve(false);
    };
  });
}

function isAllowedExtension(fileName, allowedExtensions) {
  const parts = fileName.toLowerCase().split(".");
  if (parts.length < 2) return false;
  const ext = parts.pop();
  return allowedExtensions.includes(ext);
}

function applySavedTheme() {
  const savedTheme = localStorage.getItem("sync30_theme");

  if (savedTheme === "light") {
    body.classList.remove("dark");
    body.classList.add("light");
    if (themeToggle) themeToggle.textContent = "☀️";
  } else {
    body.classList.remove("light");
    body.classList.add("dark");
    if (themeToggle) themeToggle.textContent = "🌙";
  }
}

function renameSyncupOption() {
  if (!engineSelect) return;

  for (const option of engineSelect.options) {
    if (option.value === "kling") {
      option.value = "syncup";
      option.textContent = "Sync-up (moins cher, 9 s max)";
    } else if (option.value === "syncup") {
      option.textContent = "Sync-up (moins cher, 9 s max)";
    } else if (option.value === "veed") {
      option.textContent = "VEED (premium, 30 s)";
    }
  }
}

function sanitizeFileName(name) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function buildSavedFileName(engine) {
  const now = new Date();
  const pad = (v) => String(v).padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `${stamp}-${engine}-${Math.random().toString(36).slice(2, 8)}.mp4`;
}

async function uploadResultBlobToSupabase(blob, engine) {
  if (!supabaseClient) {
    throw new Error("Supabase n’est pas chargé.");
  }

  const fileName = buildSavedFileName(engine);
  const fileToUpload = new File([blob], fileName, {
    type: blob.type || "video/mp4"
  });

  const { error: uploadError } = await supabaseClient.storage
    .from(SUPABASE_BUCKET)
    .upload(fileName, fileToUpload, {
      cacheControl: "3600",
      upsert: false,
      contentType: fileToUpload.type
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabaseClient.storage
    .from(SUPABASE_BUCKET)
    .getPublicUrl(fileName);

  return data.publicUrl;
}

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "Taille inconnue";
  const units = ["octets", "Ko", "Mo", "Go"];
  let i = 0;
  let value = bytes;

  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }

  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDate(dateString) {
  if (!dateString) return "Date inconnue";
  return new Date(dateString).toLocaleString("fr-FR");
}

async function loadSavedVideos() {
  if (!videoGallery) return;

  videoGallery.innerHTML = `
    <div class="upload-box">
      <h3>Chargement…</h3>
      <p>Lecture de la liste des vidéos enregistrées.</p>
    </div>
  `;

  if (!supabaseClient) {
    videoGallery.innerHTML = `
      <div class="upload-box">
        <h3>Supabase non chargé</h3>
        <p>Le script Supabase ne s’est pas chargé correctement.</p>
      </div>
    `;
    return;
  }

  try {
    const { data, error } = await supabaseClient.storage
      .from(SUPABASE_BUCKET)
      .list("", {
        limit: 100,
        offset: 0,
        sortBy: { column: "created_at", order: "desc" }
      });

    if (error) {
      throw error;
    }

    const files = (data || []).filter((item) => item.name);

    if (!files.length) {
      videoGallery.innerHTML = `
        <div class="upload-box">
          <h3>Aucune vidéo pour le moment</h3>
          <p>Après une génération réussie, la vidéo apparaîtra ici.</p>
        </div>
      `;
      return;
    }

    videoGallery.innerHTML = "";

    for (const item of files) {
      const { data: publicData } = supabaseClient.storage
        .from(SUPABASE_BUCKET)
        .getPublicUrl(item.name);

      const publicUrl = publicData.publicUrl;

      const box = document.createElement("div");
      box.className = "upload-box";

      box.innerHTML = `
        <h3 style="word-break:break-word;">${escapeHtml(item.name)}</h3>
        <p>
          Ajout : ${formatDate(item.created_at)}<br>
          Taille : ${formatBytes(item.metadata?.size)}
        </p>
        <video controls playsinline style="width:100%;border-radius:16px;background:#000;margin:8px 0 12px 0;">
          <source src="${publicUrl}" />
        </video>
        <div class="stack">
          <a class="btn btn-primary" href="${publicUrl}" target="_blank" rel="noopener noreferrer">Ouvrir / Télécharger</a>
          <button class="btn btn-secondary" type="button" data-delete="${item.name}">Supprimer</button>
        </div>
      `;

      const deleteBtn = box.querySelector("[data-delete]");
      deleteBtn?.addEventListener("click", async () => {
        const confirmed = confirm(`Supprimer cette vidéo ?\n\n${item.name}`);
        if (!confirmed) return;

        deleteBtn.disabled = true;
        deleteBtn.textContent = "Suppression...";

        try {
          const { error: removeError } = await supabaseClient.storage
            .from(SUPABASE_BUCKET)
            .remove([item.name]);

          if (removeError) {
            throw removeError;
          }

          await loadSavedVideos();
        } catch (error) {
          console.error(error);
          showWarning(`Suppression impossible : ${error.message}`);
          deleteBtn.disabled = false;
          deleteBtn.textContent = "Supprimer";
        }
      });

      videoGallery.appendChild(box);
    }
  } catch (error) {
    console.error(error);
    videoGallery.innerHTML = `
      <div class="upload-box">
        <h3>Lecture impossible</h3>
        <p>${escapeHtml(error.message || "Erreur inconnue")}</p>
      </div>
    `;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

applySavedTheme();
renameSyncupOption();
updateAccountDisplay();
updateEngineTexts();
loadSavedVideos();
