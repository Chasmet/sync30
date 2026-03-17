const ADMIN_CODE = "CHK-PRO-28@2026-CHK";

const VEED_API_URL = "https://sync30-api.onrender.com";
const SYNCUP_API_URL = "https://sync30-kling-api.onrender.com";

const VEED_DISPLAY_SECONDS = 30;
const VEED_TOLERANCE_SECONDS = 32;
const SYNCUP_MAX_SECONDS = 9;

const ALLOWED_VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "m4v", "ogg"];
const ALLOWED_AUDIO_EXTENSIONS = ["mp3", "wav", "m4a", "aac", "ogg", "webm"];

// REMPLACE CES 2 VALEURS PAR LES TIENNES
const SUPABASE_URL = "TON_SUPABASE_URL";
const SUPABASE_PUBLISHABLE_KEY = "TON_SUPABASE_PUBLISHABLE_KEY";

const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

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

const videosContainer = document.getElementById("videosContainer");
const refreshVideosBtn = document.getElementById("refreshVideosBtn");

let freeTrials = parseInt(localStorage.getItem("sync30_free_trials") || "5", 10);
let isAdmin = localStorage.getItem("sync30_admin") === "true";
let veedRefreshInterval = null;

function getStoredAuthUser() {
  const raw = localStorage.getItem("sync30_auth_user");
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function setStoredAuthUser(user) {
  if (!user) {
    localStorage.removeItem("sync30_auth_user");
    localStorage.removeItem("sync30_user_id");
    return;
  }

  const safeUser = {
    id: user.id,
    email: user.email || ""
  };

  localStorage.setItem("sync30_auth_user", JSON.stringify(safeUser));
  localStorage.setItem("sync30_user_id", safeUser.id);
}

function isLoggedIn() {
  return !!getStoredAuthUser();
}

function getCurrentUserId() {
  return localStorage.getItem("sync30_user_id") || "";
}

function ensureAuthButtons() {
  let authCard = document.getElementById("authCard");

  if (!authCard) {
    authCard = document.createElement("div");
    authCard.className = "card";
    authCard.id = "authCard";

    authCard.innerHTML = `
      <div class="status-row" style="grid-template-columns: 1fr auto auto; gap: 10px; align-items: center;">
        <div>
          <h2 class="title" style="margin-bottom: 6px;">Compte</h2>
          <p class="sub" id="authStatusText" style="margin-bottom: 0;">Non connecté</p>
        </div>
        <button class="btn btn-secondary" id="loginBtn" type="button" style="width:auto; min-height:44px; padding:10px 14px;">
          Connexion
        </button>
        <button class="btn btn-secondary hidden" id="logoutBtn" type="button" style="width:auto; min-height:44px; padding:10px 14px;">
          Déconnexion
        </button>
      </div>
    `;

    const firstCard = document.querySelector(".app .card");
    if (firstCard) {
      firstCard.insertAdjacentElement("afterend", authCard);
    } else {
      document.querySelector(".app")?.prepend(authCard);
    }
  }

  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  loginBtn?.addEventListener("click", async () => {
    await openAuthPrompt();
  });

  logoutBtn?.addEventListener("click", async () => {
    await logOutUser();
  });

  updateAuthUi();
}

function updateAuthUi() {
  const authStatusText = document.getElementById("authStatusText");
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  const user = getStoredAuthUser();

  if (user) {
    if (authStatusText) {
      authStatusText.textContent = `Connecté : ${user.email || user.id}`;
    }
    loginBtn?.classList.add("hidden");
    logoutBtn?.classList.remove("hidden");
  } else {
    if (authStatusText) {
      authStatusText.textContent = "Non connecté";
    }
    loginBtn?.classList.remove("hidden");
    logoutBtn?.classList.add("hidden");
  }
}

async function openAuthPrompt() {
  const mode = prompt(
    "Tape 1 pour créer un compte ou 2 pour te connecter :"
  );

  if (mode === null) return;

  const email = prompt("Entre ton email :");
  if (!email) return;

  const password = prompt("Entre ton mot de passe (minimum 6 caractères) :");
  if (!password) return;

  if (mode === "1") {
    await signUp(email.trim(), password);
    return;
  }

  if (mode === "2") {
    await signIn(email.trim(), password);
    return;
  }

  alert("Choix invalide.");
}

async function signUp(email, password) {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    });

    if (error) {
      throw error;
    }

    if (data?.user) {
      setStoredAuthUser(data.user);
      updateAuthUi();
    }

    alert("Compte créé. Vérifie ton email si Supabase demande une confirmation.");
  } catch (error) {
    alert(`Erreur création compte : ${error.message}`);
  }
}

async function signIn(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      throw error;
    }

    if (data?.user) {
      setStoredAuthUser(data.user);
      updateAuthUi();
      alert("Connexion réussie.");
      return;
    }

    alert("Connexion incomplète.");
  } catch (error) {
    alert(`Erreur connexion : ${error.message}`);
  }
}

async function logOutUser() {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }

    setStoredAuthUser(null);
    updateAuthUi();
    alert("Déconnexion réussie.");
  } catch (error) {
    alert(`Erreur déconnexion : ${error.message}`);
  }
}

async function hydrateCurrentUser() {
  try {
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      setStoredAuthUser(null);
      updateAuthUi();
      return;
    }

    if (data?.user) {
      setStoredAuthUser(data.user);
    } else {
      setStoredAuthUser(null);
    }

    updateAuthUi();
  } catch {
    setStoredAuthUser(null);
    updateAuthUi();
  }
}

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

  if (!isLoggedIn()) {
    showWarning("Connecte-toi d’abord pour utiliser l’application.");
    return;
  }

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
  stopVeedAutoRefresh();
  setGeneratingState(true);
  startProgressAnimation(engine);

  let objectUrlToRevoke = null;

  try {
    const formData = new FormData();
    formData.append("video", videoFile);
    formData.append("audio", audioFile);

    const userId = getCurrentUserId();
    const baseUrl = engine === "veed" ? VEED_API_URL : SYNCUP_API_URL;
    const endpoint =
      engine === "veed"
        ? `${VEED_API_URL}/lipsync`
        : `${SYNCUP_API_URL}/sync`;

    await wakeUpServer(baseUrl);

    const response = await fetchWithRetry(
      endpoint,
      {
        method: "POST",
        headers: {
          "x-user-id": userId
        },
        body: formData
      },
      engine === "veed" ? 1 : 2
    );

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

    if (engine === "veed") {
      const data = await response.json();

      if (!data.playUrl && !data.videoUrl) {
        throw new Error("Aucune URL vidéo renvoyée par VEED");
      }

      previewVideo.src = data.playUrl || data.videoUrl;
      downloadBtn.href = data.downloadUrl || data.videoUrl;
      downloadBtn.download = "sync30-veed.mp4";
      hintText.textContent =
        "VEED terminé. La vidéo est aussi rangée dans Mes vidéos.";
      resultCard.classList.remove("hidden");

      setTimeout(() => {
        loadVideosSilently();
      }, 1500);
    } else {
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      objectUrlToRevoke = url;

      previewVideo.src = url;
      downloadBtn.href = url;
      downloadBtn.download = "sync30-syncup.mp4";
      hintText.textContent =
        "Mode Sync-up = lip-sync économique.";
      resultCard.classList.remove("hidden");

      setTimeout(() => {
        loadVideosSilently();
      }, 1500);
    }

    resultCard.dataset.objectUrl = objectUrlToRevoke || "";
  } catch (error) {
    if (engine === "veed") {
      finishProgressAnimation();
      hintText.textContent =
        "VEED peut prendre plusieurs minutes. Si la prévisualisation n’apparaît pas tout de suite, regarde dans Mes vidéos.";
      showWarning(
        `VEED prend parfois longtemps. Laisse l'application ouverte et surveille Mes vidéos. Détail : ${error.message}`
      );
      startVeedAutoRefresh();
    } else {
      stopProgressAnimation();
      showWarning(`Erreur lors de l’envoi au serveur : ${error.message}`);
    }
  } finally {
    setGeneratingState(false);
  }
});

resetBtn?.addEventListener("click", () => {
  resetInterface();
});

refreshVideosBtn?.addEventListener("click", async () => {
  await loadVideos();
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
      "VEED = qualité premium, mais le traitement peut prendre plusieurs minutes.";
    videoRulesText.textContent =
      "Formats supportés : MP4, WEBM, MOV, M4V, OGG • VEED : 30 secondes affichées • tolérance jusqu’à 32 secondes.";
    audioRulesText.textContent =
      "Formats supportés : MP3, WAV, M4A, AAC, OGG, WEBM • VEED : 30 secondes affichées • tolérance jusqu’à 32 secondes.";
    hintText.textContent =
      "Conseil : pour VEED, reste sur l’application pendant le traitement. Si c’est long, vérifie ensuite Mes vidéos.";
  } else {
    engineRulesText.textContent =
      "Mode Sync-up actif : vidéo et audio limités à 9 secondes maximum.";
    engineDescription.textContent =
      "Sync-up = lip-sync économique.";
    videoRulesText.textContent =
      "Formats supportés : MP4, WEBM, MOV, M4V, OGG • Sync-up : 9 secondes maximum.";
    audioRulesText.textContent =
      "Formats supportés : MP3, WAV, M4A, AAC, OGG, WEBM • Sync-up : 9 secondes maximum.";
    hintText.textContent =
      isAdmin
        ? "Ton mode admin est actif. Générations gratuites illimitées."
        : "Connecte-toi pour utiliser l’application. Les crédits payants seront ajoutés ensuite.";
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
    modeLabel.textContent = isLoggedIn() ? "Connecté" : "Utilisateur";
    creditsLabel.textContent = `${freeTrials} essais gratuits`;
    accountBadge.textContent = isLoggedIn() ? "Compte connecté" : "Compte standard";
    hintText.textContent = isLoggedIn()
      ? "Tu es connecté. Le stockage séparé par utilisateur sera branché ensuite."
      : "Connecte-toi pour utiliser l’application. Les crédits payants seront ajoutés ensuite.";
  }

  updateAuthUi();
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

function startProgressAnimation(engine = "syncup") {
  progressCard.classList.remove("hidden");
  resultCard.classList.add("hidden");
  progressValue = 0;
  progressFill.style.width = "0%";
  progressText.textContent =
    engine === "veed"
      ? "Préparation VEED... cela peut prendre plusieurs minutes"
      : "0%";

  clearInterval(progressInterval);

  progressInterval = setInterval(() => {
    const limit = engine === "veed" ? 95 : 90;
    const step = engine === "veed" ? Math.random() * 4 : Math.random() * 12;

    if (progressValue < limit) {
      progressValue += step;
      if (progressValue > limit) progressValue = limit;

      progressFill.style.width = `${progressValue}%`;

      if (engine === "veed") {
        progressText.textContent =
          progressValue < 20
            ? "Préparation des fichiers..."
            : progressValue < 45
              ? "Envoi à VEED..."
              : progressValue < 70
                ? "VEED traite la vidéo..."
                : "Traitement VEED en cours... reste sur l'application";
      } else {
        progressText.textContent = `${Math.round(progressValue)}%`;
      }
    }
  }, engine === "veed" ? 1500 : 400);
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
  stopVeedAutoRefresh();

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

function formatDateFr(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString("fr-FR");
  } catch {
    return value;
  }
}

function formatSize(bytes) {
  if (!bytes && bytes !== 0) return "";
  const kb = 1024;
  const mb = kb * 1024;
  if (bytes >= mb) return `${(bytes / mb).toFixed(2)} MB`;
  if (bytes >= kb) return `${(bytes / kb).toFixed(1)} KB`;
  return `${bytes} octets`;
}

function formatEngineLabel(engine) {
  if (engine === "veed") return "VEED";
  return "Sync-up";
}

async function wakeUpServer(baseUrl) {
  try {
    await fetch(baseUrl, { method: "GET" });
    await sleep(1200);
  } catch {
    await sleep(1500);
  }
}

async function fetchWithRetry(url, options, maxAttempts = 2) {
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fetch(url, options);
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await sleep(1800);
      }
    }
  }

  throw new Error(lastError?.message || "Connexion impossible au serveur");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stopVeedAutoRefresh() {
  if (veedRefreshInterval) {
    clearInterval(veedRefreshInterval);
    veedRefreshInterval = null;
  }
}

function startVeedAutoRefresh() {
  stopVeedAutoRefresh();

  let cycles = 0;
  veedRefreshInterval = setInterval(async () => {
    cycles += 1;
    await loadVideosSilently();

    if (cycles >= 20) {
      stopVeedAutoRefresh();
    }
  }, 15000);
}

async function deleteVideo(engine, videoName) {
  const confirmDelete = confirm(`Supprimer cette vidéo ?\n\n${videoName}`);
  if (!confirmDelete) return;

  const apiBase = engine === "veed" ? VEED_API_URL : SYNCUP_API_URL;

  try {
    const response = await fetch(`${apiBase}/delete-video`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": getCurrentUserId()
      },
      body: JSON.stringify({
        engine,
        name: videoName
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.ok) {
      throw new Error(data.details || data.error || "Suppression impossible");
    }

    await loadVideos();
  } catch (error) {
    showWarning(`Erreur suppression vidéo : ${error.message}`);
  }
}

async function fetchEngineVideos(apiBase, engine) {
  const res = await fetch(`${apiBase}/videos`, {
    headers: {
      "x-user-id": getCurrentUserId()
    }
  });

  const data = await res.json();

  if (!data.ok || !Array.isArray(data.videos)) {
    throw new Error(`Réponse vidéos invalide pour ${engine}`);
  }

  return data.videos.map((item) => ({
    ...item,
    engine
  }));
}

async function loadVideos() {
  if (!videosContainer) return;

  if (!isLoggedIn()) {
    videosContainer.innerHTML = `
      <div class="upload-box">
        <h3>Connexion requise</h3>
        <p>Connecte-toi pour voir tes vidéos.</p>
      </div>
    `;
    return;
  }

  videosContainer.innerHTML = `
    <div class="upload-box">
      <h3>Chargement des vidéos...</h3>
      <p>Patiente un instant.</p>
    </div>
  `;

  try {
    const [syncupVideos, veedVideos] = await Promise.allSettled([
      fetchEngineVideos(SYNCUP_API_URL, "syncup"),
      fetchEngineVideos(VEED_API_URL, "veed")
    ]);

    let allVideos = [];

    if (syncupVideos.status === "fulfilled") {
      allVideos = allVideos.concat(syncupVideos.value);
    }

    if (veedVideos.status === "fulfilled") {
      allVideos = allVideos.concat(veedVideos.value);
    }

    allVideos.sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA;
    });

    if (allVideos.length === 0) {
      videosContainer.innerHTML = `
        <div class="upload-box">
          <h3>Aucune vidéo pour le moment</h3>
          <p>Les vidéos Sync-up et VEED sauvegardées apparaîtront ici.</p>
        </div>
      `;
      return;
    }

    videosContainer.innerHTML = "";

    allVideos.forEach((item) => {
      const wrapper = document.createElement("div");
      wrapper.className = "card";

      const title = document.createElement("h3");
      title.className = "title";
      title.style.fontSize = "18px";
      title.style.marginBottom = "10px";
      title.textContent = item.name || "Vidéo";

      const meta = document.createElement("p");
      meta.className = "sub";
      meta.style.marginBottom = "12px";
      meta.innerHTML = `
        Moteur : ${formatEngineLabel(item.engine)}<br>
        ${item.created_at ? `Ajout : ${formatDateFr(item.created_at)}<br>` : ""}
        ${item.metadata?.size ? `Taille : ${formatSize(item.metadata.size)}` : ""}
      `;

      const video = document.createElement("video");
      video.controls = true;
      video.playsInline = true;
      video.preload = "metadata";
      video.src = item.playUrl;
      video.style.width = "100%";
      video.style.borderRadius = "16px";
      video.style.border = "1px solid var(--border)";
      video.style.background = "#000";
      video.style.marginBottom = "12px";

      const downloadLink = document.createElement("a");
      downloadLink.className = "btn btn-primary";
      downloadLink.href = item.downloadUrl;
      downloadLink.textContent = "Télécharger";

      const deleteButton = document.createElement("button");
      deleteButton.className = "btn btn-secondary";
      deleteButton.type = "button";
      deleteButton.textContent = "Supprimer";
      deleteButton.addEventListener("click", async () => {
        await deleteVideo(item.engine, item.name);
      });

      const actions = document.createElement("div");
      actions.className = "stack";
      actions.appendChild(downloadLink);
      actions.appendChild(deleteButton);

      wrapper.appendChild(title);
      wrapper.appendChild(meta);
      wrapper.appendChild(video);
      wrapper.appendChild(actions);

      videosContainer.appendChild(wrapper);
    });
  } catch (err) {
    console.error("Erreur chargement vidéos :", err);
    videosContainer.innerHTML = `
      <div class="upload-box">
        <h3>Impossible de charger les vidéos</h3>
        <p>Réessaie plus tard.</p>
      </div>
    `;
  }
}

function loadVideosSilently() {
  if (!videosContainer) return;
  loadVideos().catch(() => {});
}

applySavedTheme();
renameSyncupOption();
ensureAuthButtons();
hydrateCurrentUser().then(() => {
  updateAccountDisplay();
  updateEngineTexts();
  loadVideosSilently();
});
