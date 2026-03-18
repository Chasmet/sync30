const VEED_API_URL = "https://sync30-api.onrender.com";
const SYNCUP_API_URL = "https://sync30-kling-api.onrender.com";

const VEED_DISPLAY_SECONDS = 30;
const VEED_TOLERANCE_SECONDS = 32;
const SYNCUP_MAX_SECONDS = 9;

const ALLOWED_VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "m4v", "ogg"];
const ALLOWED_AUDIO_EXTENSIONS = ["mp3", "wav", "m4a", "aac", "ogg", "webm"];

const SUPABASE_URL = "https://hfzbkgnccyyrotijnlda.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_j_dMdudOZakRbeKQQRVWDQ_TYI2mwka";

const ADMIN_EMAILS = ["skypieachannel@gmail.com"];
const PASSWORD_RESET_REDIRECT_URL = "https://chasmet.github.io/sync30";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const themeToggle = document.getElementById("themeToggle");
const body = document.body;

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

const authStatusText = document.getElementById("authStatusText");
const signUpBtn = document.getElementById("signUpBtn");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const resetPasswordBtn = document.getElementById("resetPasswordBtn");

let freeTrials = parseInt(localStorage.getItem("sync30_free_trials"), 10);
if (Number.isNaN(freeTrials) || freeTrials < 1) {
  freeTrials = 1;
  localStorage.setItem("sync30_free_trials", "1");
}

let veedRefreshInterval = null;
let syncupPollingInterval = null;
let progressInterval = null;

let currentUser = null;
let activeResultObjectUrl = null;
let resultFileName = "sync30-result.mp4";
let resultDownloadUrl = "";
let resultPlayUrl = "";
let recoveryPromptShown = false;
let progressValue = 0;

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isAdminUser() {
  const email = normalizeEmail(currentUser?.email);
  return ADMIN_EMAILS.map(normalizeEmail).includes(email);
}

function getCurrentUserId() {
  if (currentUser?.id) return currentUser.id;
  return "admin-public";
}

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
    return `Le ${type === "video" ? "fichier vidéo" : "fichier audio"} dépasse la limite VEED. ${VEED_DISPLAY_SECONDS} secondes affichées, ${VEED_TOLERANCE_SECONDS} secondes tolérées maximum.`;
  }

  return `Le ${type === "video" ? "fichier vidéo" : "fichier audio"} dépasse la limite Sync-up. Maximum autorisé : ${SYNCUP_MAX_SECONDS} secondes.`;
}

function isAllowedExtension(fileName, allowedExtensions) {
  const parts = String(fileName || "").toLowerCase().split(".");
  if (parts.length < 2) return false;
  const ext = parts.pop();
  return allowedExtensions.includes(ext);
}

function showWarning(message) {
  if (!warningText) return;
  warningText.classList.remove("hidden");
  warningText.textContent = message;
}

function clearWarning() {
  if (!warningText) return;
  warningText.classList.add("hidden");
  warningText.textContent = "";
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

function updateAuthUI() {
  if (!authStatusText || !signUpBtn || !loginBtn || !logoutBtn) return;

  if (currentUser) {
    authStatusText.textContent = `Connecté : ${currentUser.email || "compte actif"}`;
    signUpBtn.classList.add("hidden");
    loginBtn.classList.add("hidden");
    logoutBtn.classList.remove("hidden");
  } else {
    authStatusText.textContent = "Non connecté";
    signUpBtn.classList.remove("hidden");
    loginBtn.classList.remove("hidden");
    logoutBtn.classList.add("hidden");
  }
}

function updateAccountDisplay() {
  if (!modeLabel || !creditsLabel || !accountBadge || !hintText) return;

  if (isAdminUser()) {
    modeLabel.textContent = "Admin";
    creditsLabel.textContent = "Illimité";
    accountBadge.textContent = "Compte administrateur";
    hintText.textContent = "Ton compte admin est actif. Générations illimitées.";
    return;
  }

  if (currentUser) {
    creditsLabel.textContent = `${freeTrials} essai${freeTrials > 1 ? "s" : ""} gratuit${freeTrials > 1 ? "s" : ""}`;
    modeLabel.textContent = "Connecté";
    accountBadge.textContent = "Compte personnel";
    hintText.textContent = "Tu es connecté. Tes vidéos sont liées à ton compte.";
  } else {
    creditsLabel.textContent = `${freeTrials} essai${freeTrials > 1 ? "s" : ""} gratuit${freeTrials > 1 ? "s" : ""}`;
    modeLabel.textContent = "Utilisateur";
    accountBadge.textContent = "Compte standard";
    hintText.textContent = "Connecte-toi pour utiliser ton espace vidéo personnel.";
  }
}

function updateEngineTexts() {
  const engine = getSelectedEngine();

  if (!engineRulesText || !engineDescription || !videoRulesText || !audioRulesText || !hintText) {
    return;
  }

  if (engine === "veed") {
    engineRulesText.textContent =
      "Mode VEED actif : 30 secondes affichées et tolérance technique jusqu’à 32 secondes.";
    engineDescription.textContent =
      "VEED = qualité premium, mais le traitement peut prendre plusieurs minutes.";
    videoRulesText.textContent =
      "Formats supportés : MP4, WEBM, MOV, M4V, OGG • VEED : 30 secondes affichées • tolérance jusqu’à 32 secondes.";
    audioRulesText.textContent =
      "Formats supportés : MP3, WAV, M4A, AAC, OGG, WEBM • VEED : 30 secondes affichées • tolérance jusqu’à 32 secondes.";

    if (!currentUser && !isAdminUser()) {
      hintText.textContent = "Connecte-toi pour utiliser ton espace vidéo personnel.";
    } else {
      hintText.textContent =
        "Conseil : pour VEED, reste sur l’application pendant le traitement. Si c’est long, vérifie ensuite Mes vidéos.";
    }
  } else {
    engineRulesText.textContent =
      "Mode Sync-up actif : vidéo et audio limités à 9 secondes maximum.";
    engineDescription.textContent = "Sync-up = lip-sync économique.";
    videoRulesText.textContent =
      "Formats supportés : MP4, WEBM, MOV, M4V, OGG • Sync-up : 9 secondes maximum.";
    audioRulesText.textContent =
      "Formats supportés : MP3, WAV, M4A, AAC, OGG, WEBM • Sync-up : 9 secondes maximum.";

    if (isAdminUser()) {
      hintText.textContent = "Ton compte admin est actif. Générations illimitées.";
    } else if (currentUser) {
      hintText.textContent = "Tu es connecté. Tes vidéos sont liées à ton compte.";
    } else {
      hintText.textContent = "Connecte-toi pour utiliser ton espace vidéo personnel.";
    }
  }
}

function setGeneratingState(isLoading) {
  if (!generateBtn) return;
  generateBtn.disabled = isLoading;
  generateBtn.textContent = isLoading ? "Envoi au serveur..." : "Générer";
}

function clearActiveResultObjectUrl() {
  if (activeResultObjectUrl) {
    URL.revokeObjectURL(activeResultObjectUrl);
    activeResultObjectUrl = null;
  }
}

function stopProgressAnimation() {
  clearInterval(progressInterval);
  progressCard?.classList.add("hidden");
  if (progressFill) progressFill.style.width = "0%";
  if (progressText) progressText.textContent = "0%";
}

function finishProgressAnimation() {
  clearInterval(progressInterval);
  progressValue = 100;
  if (progressFill) progressFill.style.width = "100%";
  if (progressText) progressText.textContent = "100%";
}

function startProgressAnimation(engine = "syncup") {
  progressCard?.classList.remove("hidden");
  resultCard?.classList.add("hidden");
  progressValue = 0;

  if (progressFill) progressFill.style.width = "0%";
  if (progressText) {
    progressText.textContent =
      engine === "veed"
        ? "Préparation VEED... cela peut prendre plusieurs minutes"
        : "0%";
  }

  clearInterval(progressInterval);

  progressInterval = setInterval(() => {
    const limit = engine === "veed" ? 95 : 90;
    const step = engine === "veed" ? Math.random() * 4 : Math.random() * 8;

    if (progressValue < limit) {
      progressValue += step;
      if (progressValue > limit) progressValue = limit;

      if (progressFill) progressFill.style.width = `${progressValue}%`;

      if (progressText) {
        if (engine === "veed") {
          progressText.textContent =
            progressValue < 20
              ? "Préparation des fichiers..."
              : progressValue < 45
                ? "Envoi à VEED..."
                : progressValue < 70
                  ? "VEED traite la vidéo..."
                  : "Traitement VEED en cours...";
        } else {
          progressText.textContent =
            progressValue < 20
              ? "Envoi du job Sync-up..."
              : progressValue < 45
                ? "Job lancé..."
                : progressValue < 70
                  ? "Sync-up traite la vidéo..."
                  : "Attente du résultat final...";
        }
      }
    }
  }, engine === "veed" ? 1500 : 1800);
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
  return engine === "veed" ? "VEED" : "Sync-up";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function revalidateSelectedFiles() {
  const videoFile = videoInput?.files?.[0];
  const audioFile = audioInput?.files?.[0];

  if (videoFile) {
    const ok = await validateMediaDuration(videoFile, "video");
    if (!ok) {
      showWarning(getDurationErrorMessage("video"));
      if (videoInput) videoInput.value = "";
      if (videoFileName) videoFileName.textContent = "Aucune vidéo sélectionnée";
      return;
    }
  }

  if (audioFile) {
    const ok = await validateMediaDuration(audioFile, "audio");
    if (!ok) {
      showWarning(getDurationErrorMessage("audio"));
      if (audioInput) audioInput.value = "";
      if (audioFileName) audioFileName.textContent = "Aucun audio sélectionné";
      return;
    }
  }

  clearWarning();
}

async function fetchVideoBlob(url) {
  const response = await fetch(url, {
    headers: {
      "x-user-id": getCurrentUserId()
    }
  });

  if (!response.ok) {
    let message = "Vidéo introuvable";
    try {
      const data = await response.json();
      message = data.error || message;
    } catch {}
    throw new Error(message);
  }

  return await response.blob();
}

async function setResultVideoSecure(playUrl, downloadUrl, fileName) {
  clearActiveResultObjectUrl();

  resultPlayUrl = playUrl;
  resultDownloadUrl = downloadUrl || playUrl;
  resultFileName = fileName || "sync30-result.mp4";

  const blob = await fetchVideoBlob(playUrl);
  const objectUrl = URL.createObjectURL(blob);
  activeResultObjectUrl = objectUrl;

  if (previewVideo) {
    previewVideo.pause();
    previewVideo.removeAttribute("src");
    previewVideo.load();

    previewVideo.src = objectUrl;
    previewVideo.setAttribute("playsinline", "true");
    previewVideo.setAttribute("preload", "metadata");
    previewVideo.load();
  }

  if (downloadBtn) {
    downloadBtn.href = "#";
    downloadBtn.setAttribute("download", resultFileName);
  }

  resultCard?.classList.remove("hidden");
}

async function openVideoSecure(url) {
  const blob = await fetchVideoBlob(url);
  const objectUrl = URL.createObjectURL(blob);
  window.open(objectUrl, "_blank", "noopener,noreferrer");

  setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 30000);
}

async function downloadVideoSecure(url, fileName = "video.mp4") {
  const blob = await fetchVideoBlob(url);
  const objectUrl = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 5000);
}

function stopSyncupPolling() {
  if (syncupPollingInterval) {
    clearInterval(syncupPollingInterval);
    syncupPollingInterval = null;
  }
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

async function pollSyncupJob(jobId) {
  return new Promise((resolve, reject) => {
    const userId = getCurrentUserId();
    let tries = 0;

    syncupPollingInterval = setInterval(async () => {
      tries += 1;

      try {
        const response = await fetch(`${SYNCUP_API_URL}/sync-status/${jobId}`, {
          headers: {
            "x-user-id": userId
          }
        });

        const data = await response.json();

        if (!response.ok || !data.ok) {
          stopSyncupPolling();
          stopProgressAnimation();
          setGeneratingState(false);
          reject(new Error(data.error || "Erreur status Sync-up"));
          return;
        }

        if (data.status === "starting") {
          if (progressText) progressText.textContent = "Sync-up démarre...";
          return;
        }

        if (data.status === "processing") {
          if (progressText) progressText.textContent = "Sync-up traite la vidéo...";
          return;
        }

        if (data.status === "failed") {
          stopSyncupPolling();
          stopProgressAnimation();
          setGeneratingState(false);
          reject(new Error(data.error || "Le traitement Sync-up a échoué"));
          return;
        }

        if (data.status === "succeeded") {
          stopSyncupPolling();
          finishProgressAnimation();

          if (!data.playUrl) {
            stopProgressAnimation();
            setGeneratingState(false);
            reject(new Error("Aucune vidéo finale renvoyée"));
            return;
          }

          const fullPlayUrl =
            data.playUrl.startsWith("http") ? data.playUrl : `${SYNCUP_API_URL}${data.playUrl}`;
          const fullDownloadUrl =
            (data.downloadUrl || data.playUrl).startsWith("http")
              ? (data.downloadUrl || data.playUrl)
              : `${SYNCUP_API_URL}${data.downloadUrl || data.playUrl}`;

          await setResultVideoSecure(
            fullPlayUrl,
            fullDownloadUrl,
            data.fileName || "sync30-syncup.mp4"
          );

          if (hintText) {
            hintText.textContent = "Sync-up terminé. La vidéo est maintenant prête.";
          }

          setTimeout(() => {
            loadVideosSilently();
          }, 1200);

          setGeneratingState(false);
          resolve();
          return;
        }

        if (tries >= 180) {
          stopSyncupPolling();
          stopProgressAnimation();
          setGeneratingState(false);
          reject(new Error("Le traitement prend trop de temps"));
        }
      } catch (error) {
        stopSyncupPolling();
        stopProgressAnimation();
        setGeneratingState(false);
        reject(error);
      }
    }, 5000);
  });
}

async function handleSignUp() {
  const email = prompt("Entre ton email :");
  if (!email) return;

  const password = prompt("Entre ton mot de passe (minimum 6 caractères) :");
  if (!password) return;

  if (password.length < 6) {
    alert("Mot de passe trop court. Minimum 6 caractères.");
    return;
  }

  try {
    const { data, error } = await supabaseClient.auth.signUp({
      email: email.trim(),
      password
    });

    if (error) {
      throw error;
    }

    currentUser = data.user || null;
    updateAuthUI();
    updateAccountDisplay();
    updateEngineTexts();
    await loadVideos();

    alert("Compte créé avec succès.");
  } catch (error) {
    alert(`Erreur inscription : ${error.message}`);
  }
}

async function handleLogin() {
  const email = prompt("Entre ton email :");
  if (!email) return;

  const password = prompt("Entre ton mot de passe :");
  if (!password) return;

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: email.trim(),
      password
    });

    if (error) {
      throw error;
    }

    currentUser = data.user || null;
    updateAuthUI();
    updateAccountDisplay();
    updateEngineTexts();
    await loadVideos();

    alert("Connexion réussie.");
  } catch (error) {
    alert(`Erreur connexion : ${error.message}`);
  }
}

async function handleLogout() {
  try {
    const { error } = await supabaseClient.auth.signOut();

    if (error) {
      throw error;
    }

    currentUser = null;
    updateAuthUI();
    updateAccountDisplay();
    updateEngineTexts();
    await loadVideos();

    alert("Déconnexion réussie.");
  } catch (error) {
    alert(`Erreur déconnexion : ${error.message}`);
  }
}

async function handleResetPasswordRequest() {
  const email = prompt("Entre ton email pour recevoir le lien de réinitialisation :");
  if (!email) return;

  try {
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: PASSWORD_RESET_REDIRECT_URL
    });

    if (error) {
      throw error;
    }

    alert("Email de réinitialisation envoyé. Regarde ta boîte mail.");
  } catch (error) {
    alert(`Erreur réinitialisation : ${error.message}`);
  }
}

async function maybeHandleRecoverySession(eventName) {
  if (recoveryPromptShown) return;
  if (eventName !== "PASSWORD_RECOVERY") return;

  recoveryPromptShown = true;

  const newPassword = prompt("Entre ton nouveau mot de passe (minimum 6 caractères) :");
  if (!newPassword) return;

  if (newPassword.length < 6) {
    alert("Mot de passe trop court. Minimum 6 caractères.");
    return;
  }

  try {
    const { error } = await supabaseClient.auth.updateUser({
      password: newPassword
    });

    if (error) {
      throw error;
    }

    alert("Mot de passe mis à jour. Tu peux maintenant te connecter.");
  } catch (error) {
    alert(`Erreur mise à jour mot de passe : ${error.message}`);
  }
}

async function hydrateCurrentUser() {
  try {
    const { data, error } = await supabaseClient.auth.getUser();

    if (error) {
      currentUser = null;
    } else {
      currentUser = data.user || null;
    }
  } catch {
    currentUser = null;
  }

  updateAuthUI();
  updateAccountDisplay();
}

async function deleteVideo(engine, videoName) {
  if (!currentUser && !isAdminUser()) {
    showWarning("Connecte-toi pour supprimer tes vidéos.");
    return;
  }

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
  const response = await fetch(`${apiBase}/videos`, {
    headers: {
      "x-user-id": getCurrentUserId()
    }
  });

  const data = await response.json();

  if (!data.ok || !Array.isArray(data.videos)) {
    throw new Error(`Réponse vidéos invalide pour ${engine}`);
  }

  return data.videos.map((item) => {
    const playUrl =
      item.playUrl?.startsWith("http") ? item.playUrl : `${apiBase}${item.playUrl}`;
    const downloadUrl =
      item.downloadUrl?.startsWith("http") ? item.downloadUrl : `${apiBase}${item.downloadUrl}`;

    return {
      ...item,
      engine,
      playUrl,
      downloadUrl
    };
  });
}

async function loadVideos() {
  if (!videosContainer) return;

  if (!currentUser && !isAdminUser()) {
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
          <p>Les vidéos de ton compte apparaîtront ici.</p>
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

      const helper = document.createElement("p");
      helper.className = "sub";
      helper.style.marginBottom = "12px";
      helper.textContent = "Utilise les boutons ci-dessous pour ouvrir, télécharger ou supprimer la vidéo.";

      const openButton = document.createElement("button");
      openButton.className = "btn btn-primary";
      openButton.type = "button";
      openButton.textContent = "Ouvrir la vidéo";
      openButton.addEventListener("click", async () => {
        try {
          await openVideoSecure(item.playUrl);
        } catch (error) {
          showWarning(`Erreur ouverture vidéo : ${error.message}`);
        }
      });

      const downloadButton = document.createElement("button");
      downloadButton.className = "btn btn-secondary";
      downloadButton.type = "button";
      downloadButton.textContent = "Télécharger";
      downloadButton.addEventListener("click", async () => {
        try {
          await downloadVideoSecure(item.downloadUrl, item.name || "video.mp4");
        } catch (error) {
          showWarning(`Erreur téléchargement : ${error.message}`);
        }
      });

      const deleteButton = document.createElement("button");
      deleteButton.className = "btn btn-secondary";
      deleteButton.type = "button";
      deleteButton.textContent = "Supprimer";
      deleteButton.addEventListener("click", async () => {
        await deleteVideo(item.engine, item.name);
      });

      const actions = document.createElement("div");
      actions.className = "stack";
      actions.appendChild(openButton);
      actions.appendChild(downloadButton);
      actions.appendChild(deleteButton);

      wrapper.appendChild(title);
      wrapper.appendChild(meta);
      wrapper.appendChild(helper);
      wrapper.appendChild(actions);

      videosContainer.appendChild(wrapper);
    });
  } catch (error) {
    console.error("Erreur chargement vidéos :", error);
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

function resetInterface() {
  clearInterval(progressInterval);
  stopVeedAutoRefresh();
  stopSyncupPolling();

  progressCard?.classList.add("hidden");
  resultCard?.classList.add("hidden");

  if (progressFill) progressFill.style.width = "0%";
  if (progressText) progressText.textContent = "0%";

  clearActiveResultObjectUrl();

  if (previewVideo) {
    previewVideo.pause();
    previewVideo.removeAttribute("src");
    previewVideo.load();
  }

  if (downloadBtn) {
    downloadBtn.href = "#";
    downloadBtn.removeAttribute("download");
  }

  resultDownloadUrl = "";
  resultPlayUrl = "";
  resultFileName = "sync30-result.mp4";

  if (videoInput) videoInput.value = "";
  if (audioInput) audioInput.value = "";

  if (videoFileName) videoFileName.textContent = "Aucune vidéo sélectionnée";
  if (audioFileName) audioFileName.textContent = "Aucun audio sélectionné";

  clearWarning();
  setGeneratingState(false);
  updateAccountDisplay();
  updateEngineTexts();
}

themeToggle?.addEventListener("click", () => {
  body.classList.toggle("light");
  body.classList.toggle("dark");

  const isLight = body.classList.contains("light");
  themeToggle.textContent = isLight ? "☀️" : "🌙";

  localStorage.setItem("sync30_theme", isLight ? "light" : "dark");
});

signUpBtn?.addEventListener("click", async () => {
  await handleSignUp();
});

loginBtn?.addEventListener("click", async () => {
  await handleLogin();
});

logoutBtn?.addEventListener("click", async () => {
  await handleLogout();
});

resetPasswordBtn?.addEventListener("click", async () => {
  await handleResetPasswordRequest();
});

engineSelect?.addEventListener("change", () => {
  updateEngineTexts();
  revalidateSelectedFiles();
});

downloadBtn?.addEventListener("click", async (event) => {
  event.preventDefault();

  if (!resultDownloadUrl) {
    showWarning("Aucune vidéo prête à télécharger.");
    return;
  }

  try {
    await downloadVideoSecure(resultDownloadUrl, resultFileName);
  } catch (error) {
    showWarning(`Erreur téléchargement : ${error.message}`);
  }
});

videoInput?.addEventListener("change", async () => {
  const file = videoInput.files?.[0];
  if (!file) return;

  if (!isAllowedExtension(file.name, ALLOWED_VIDEO_EXTENSIONS)) {
    showWarning("Format vidéo non supporté. Utilise MP4, WEBM, MOV, M4V ou OGG.");
    videoInput.value = "";
    if (videoFileName) videoFileName.textContent = "Aucune vidéo sélectionnée";
    return;
  }

  if (videoFileName) videoFileName.textContent = file.name;

  const ok = await validateMediaDuration(file, "video");
  if (!ok) {
    showWarning(getDurationErrorMessage("video"));
    videoInput.value = "";
    if (videoFileName) videoFileName.textContent = "Aucune vidéo sélectionnée";
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
    if (audioFileName) audioFileName.textContent = "Aucun audio sélectionné";
    return;
  }

  if (audioFileName) audioFileName.textContent = file.name;

  const ok = await validateMediaDuration(file, "audio");
  if (!ok) {
    showWarning(getDurationErrorMessage("audio"));
    audioInput.value = "";
    if (audioFileName) audioFileName.textContent = "Aucun audio sélectionné";
    return;
  }

  clearWarning();
});

generateBtn?.addEventListener("click", async () => {
  const videoFile = videoInput?.files?.[0];
  const audioFile = audioInput?.files?.[0];
  const engine = getSelectedEngine();

  if (!currentUser && !isAdminUser()) {
    showWarning("Connecte-toi d’abord pour générer des vidéos.");
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

  if (!isAdminUser() && freeTrials <= 0) {
    showWarning("Tu n’as plus d’essais gratuits. Les crédits payants seront ajoutés ensuite.");
    return;
  }

  clearWarning();
  stopVeedAutoRefresh();
  stopSyncupPolling();
  setGeneratingState(true);
  startProgressAnimation(engine);

  try {
    const formData = new FormData();
    formData.append("video", videoFile);
    formData.append("audio", audioFile);

    const userId = getCurrentUserId();
    const baseUrl = engine === "veed" ? VEED_API_URL : SYNCUP_API_URL;
    const endpoint = engine === "veed" ? `${VEED_API_URL}/lipsync` : `${SYNCUP_API_URL}/sync`;

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

    if (!isAdminUser()) {
      freeTrials -= 1;
      localStorage.setItem("sync30_free_trials", String(freeTrials));
      updateAccountDisplay();
    }

    if (engine === "veed") {
      finishProgressAnimation();

      const data = await response.json();

      if (!data.playUrl && !data.videoUrl) {
        throw new Error("Aucune URL vidéo renvoyée par VEED");
      }

      const fullPlayUrl =
        (data.playUrl || data.videoUrl).startsWith("http")
          ? (data.playUrl || data.videoUrl)
          : `${VEED_API_URL}${data.playUrl || data.videoUrl}`;

      const fullDownloadUrl =
        (data.downloadUrl || data.videoUrl).startsWith("http")
          ? (data.downloadUrl || data.videoUrl)
          : `${VEED_API_URL}${data.downloadUrl || data.videoUrl}`;

      await setResultVideoSecure(
        fullPlayUrl,
        fullDownloadUrl,
        data.fileName || "sync30-veed.mp4"
      );

      if (hintText) {
        hintText.textContent = "VEED terminé. La vidéo est aussi rangée dans Mes vidéos.";
      }

      setTimeout(() => {
        loadVideosSilently();
      }, 1500);

      setGeneratingState(false);
      return;
    }

    const data = await response.json();

    if (!data.ok || !data.jobId) {
      throw new Error(data.error || "Job Sync-up non lancé");
    }

    if (progressText) {
      progressText.textContent = "Traitement Sync-up lancé...";
    }

    if (hintText) {
      hintText.textContent = "Sync-up traite la vidéo. La vidéo apparaîtra dès qu’elle sera prête.";
    }

    await pollSyncupJob(data.jobId);
  } catch (error) {
    if (engine === "veed") {
      finishProgressAnimation();

      if (hintText) {
        hintText.textContent =
          "VEED peut prendre plusieurs minutes. Si la prévisualisation n’apparaît pas tout de suite, regarde ensuite Mes vidéos.";
      }

      showWarning(
        `VEED prend parfois longtemps. Laisse l'application ouverte et surveille Mes vidéos. Détail : ${error.message}`
      );

      startVeedAutoRefresh();
      setGeneratingState(false);
    } else {
      stopProgressAnimation();
      showWarning(`Erreur lors de l’envoi au serveur : ${error.message}`);
      setGeneratingState(false);
    }
  }
});

resetBtn?.addEventListener("click", () => {
  resetInterface();
});

refreshVideosBtn?.addEventListener("click", async () => {
  await loadVideos();
});

async function initApp() {
  applySavedTheme();
  setGeneratingState(false);
  await hydrateCurrentUser();
  updateEngineTexts();
  loadVideosSilently();

  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    currentUser = session?.user || null;
    updateAuthUI();
    updateAccountDisplay();
    updateEngineTexts();
    loadVideosSilently();
    await maybeHandleRecoverySession(event);
  });
}

initApp();
