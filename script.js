const VEED_API_URL = "https://sync30-api.onrender.com";
const SYNCUP_API_URL = "https://sync30-kling-api.onrender.com";
const PADDLE_API_URL = "https://sync30-paddle-api.onrender.com";

const VEED_DISPLAY_SECONDS = 30;
const VEED_TOLERANCE_SECONDS = 32;
const SYNCUP_MAX_SECONDS = 9;

const VEED_PRICE_PER_30_SECONDS = 4.19;
const SYNCUP_PRICE_PER_30_SECONDS = 2.19;

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

const estimateCard = document.getElementById("estimateCard");
const estimateModeText = document.getElementById("estimateModeText");
const estimateDurationText = document.getElementById("estimateDurationText");
const estimateCostText = document.getElementById("estimateCostText");
const estimateRemainingText = document.getElementById("estimateRemainingText");

const buyButtons = Array.from(document.querySelectorAll(".buy-btn"));
const standardBuyBtn = buyButtons[0] || null;
const premiumBuyBtn = buyButtons[1] || null;
const creatorBuyBtn = buyButtons[2] || null;

let currentUser = null;
let walletState = {
  syncupSecondsBalance: 0,
  premiumSecondsBalance: 0,
  standardSecondsBalance: 0,
  secondsBalance: 0
};

let mediaState = {
  videoDuration: null,
  audioDuration: null
};

let progressInterval = null;
let syncupPollingInterval = null;

let activeResultObjectUrl = null;
let resultDownloadUrl = "";
let resultFileName = "sync30-result.mp4";
let recoveryHandled = false;
let paymentReturnHandled = false;

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isAdminUser() {
  const email = normalizeEmail(currentUser?.email);
  return ADMIN_EMAILS.map(normalizeEmail).includes(email);
}

function getCurrentUserId() {
  return currentUser?.id || "public";
}

function getSelectedEngine() {
  return engineSelect?.value || "syncup";
}

function getCurrentMaxSeconds() {
  return getSelectedEngine() === "veed"
    ? VEED_TOLERANCE_SECONDS
    : SYNCUP_MAX_SECONDS;
}

function formatPrice(value) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR"
  }).format(value);
}

function formatSeconds(value) {
  return `${Number(value || 0)} s`;
}

function roundSecondsForBilling(durationSeconds) {
  const value = Number(durationSeconds);

  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  const lower = Math.floor(value);
  const decimal = value - lower;

  let billed = decimal <= 0.5 ? lower : lower + 1;

  if (billed < 1) {
    billed = 1;
  }

  return billed;
}

function calculatePrice(engine, billedSeconds) {
  const per30 = engine === "veed"
    ? VEED_PRICE_PER_30_SECONDS
    : SYNCUP_PRICE_PER_30_SECONDS;

  return (billedSeconds / 30) * per30;
}

function safeText(value, fallback = "") {
  return value == null ? fallback : String(value);
}

function showWarning(message) {
  if (!warningText) return;
  warningText.textContent = message;
  warningText.classList.remove("hidden");
}

function clearWarning() {
  if (!warningText) return;
  warningText.textContent = "";
  warningText.classList.add("hidden");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAllowedExtension(fileName, allowedExtensions) {
  const parts = String(fileName || "").toLowerCase().split(".");
  if (parts.length < 2) return false;
  const ext = parts.pop();
  return allowedExtensions.includes(ext);
}

function getDurationErrorMessage(type) {
  const engine = getSelectedEngine();

  if (engine === "veed") {
    return `Le ${type === "video" ? "fichier vidéo" : "fichier audio"} dépasse la limite Astra. ${VEED_DISPLAY_SECONDS} secondes affichées, ${VEED_TOLERANCE_SECONDS} secondes tolérées maximum.`;
  }

  return `Le ${type === "video" ? "fichier vidéo" : "fichier audio"} dépasse la limite Nova. Maximum autorisé : ${SYNCUP_MAX_SECONDS} secondes.`;
}

function getEngineBalance() {
  if (isAdminUser()) return Infinity;

  return getSelectedEngine() === "veed"
    ? Number(walletState.premiumSecondsBalance || 0)
    : Number(walletState.syncupSecondsBalance || 0);
}

function getDurationForBilling() {
  if (!mediaState.videoDuration) return null;
  return Math.min(mediaState.videoDuration, getCurrentMaxSeconds());
}

function updateAuthUI() {
  if (!authStatusText || !signUpBtn || !loginBtn || !logoutBtn) return;

  if (currentUser) {
    authStatusText.textContent = `Connecté : ${currentUser.email || "compte actif"}`;
    signUpBtn.classList.add("hidden");
    loginBtn.classList.add("hidden");
    logoutBtn.classList.remove("hidden");
  } else {
    authStatusText.textContent = "Mode test public";
    signUpBtn.classList.remove("hidden");
    loginBtn.classList.remove("hidden");
    logoutBtn.classList.add("hidden");
  }
}

function updateEngineTexts() {
  const engine = getSelectedEngine();

  if (engineSelect?.options?.[0]) {
    engineSelect.options[0].textContent = "Standard Nova (9 s max)";
  }

  if (engineSelect?.options?.[1]) {
    engineSelect.options[1].textContent = "Premium Astra - qualité (30 s max)";
  }

  if (engine === "veed") {
    engineRulesText.textContent =
      "Ajoute une vidéo et un audio. Astra : 30 secondes affichées, 32 secondes tolérées maximum.";
    engineDescription.textContent =
      "Astra = meilleure qualité. Tarif indicatif : 4,19 € pour 30 secondes.";
    videoRulesText.textContent =
      "Formats supportés : MP4, WEBM, MOV, M4V, OGG • Astra : 30 secondes affichées • tolérance jusqu’à 32 secondes.";
    audioRulesText.textContent =
      "Formats supportés : MP3, WAV, M4A, AAC, OGG, WEBM • Astra : 30 secondes affichées • tolérance jusqu’à 32 secondes.";
  } else {
    engineRulesText.textContent =
      "Ajoute une vidéo et un audio. Nova : 9 secondes maximum.";
    engineDescription.textContent =
      "Nova = plus économique. Tarif indicatif : 2,19 € pour 30 secondes.";
    videoRulesText.textContent =
      "Formats supportés : MP4, WEBM, MOV, M4V, OGG • Nova : 9 secondes maximum.";
    audioRulesText.textContent =
      "Formats supportés : MP3, WAV, M4A, AAC, OGG, WEBM • Nova : 9 secondes maximum.";
  }
}

function updateAccountDisplay() {
  const balance = getEngineBalance();
  const engine = getSelectedEngine();

  if (isAdminUser()) {
    modeLabel.textContent = "Admin";
    creditsLabel.textContent = "Illimité";
    accountBadge.textContent = "Compte administrateur";
    hintText.textContent = "Compte admin actif. Générations illimitées.";
    return;
  }

  if (currentUser) {
    modeLabel.textContent = "Connecté";
    accountBadge.textContent = "Compte personnel";
    creditsLabel.textContent = Number.isFinite(balance) ? formatSeconds(balance) : "0 s";
    hintText.textContent =
      engine === "veed"
        ? "Compte personnel actif. Astra utilise ton solde premium."
        : "Compte personnel actif. Nova utilise ton solde standard.";
    return;
  }

  modeLabel.textContent = "Public";
  accountBadge.textContent = "Mode test public";
  creditsLabel.textContent = Number.isFinite(balance) ? formatSeconds(balance) : "0 s";
  hintText.textContent =
    engine === "veed"
      ? "Mode test public actif. Astra utilise le solde premium public."
      : "Mode test public actif. Nova utilise le solde standard public.";
}

function updateEstimate() {
  if (!estimateCard || !estimateModeText || !estimateDurationText || !estimateCostText || !estimateRemainingText) {
    return;
  }

  const duration = getDurationForBilling();
  const engine = getSelectedEngine();

  if (!duration) {
    estimateCard.classList.add("hidden");
    return;
  }

  const billedSeconds = roundSecondsForBilling(duration);
  const price = calculatePrice(engine, billedSeconds);
  const balance = getEngineBalance();

  estimateModeText.textContent = engine === "veed" ? "Astra" : "Nova";
  estimateDurationText.textContent = `${duration.toFixed(1)} s`;
  estimateCostText.textContent = `${billedSeconds} s • ${formatPrice(price)}`;

  if (isAdminUser()) {
    estimateRemainingText.textContent = "Illimité";
  } else {
    const remaining = Math.max(0, Number(balance || 0) - billedSeconds);
    estimateRemainingText.textContent = `${remaining} s`;
  }

  estimateCard.classList.remove("hidden");
}

function updatePricingButtons() {
  if (standardBuyBtn) {
    standardBuyBtn.disabled = false;
    standardBuyBtn.textContent = "Acheter";
  }

  if (premiumBuyBtn) {
    premiumBuyBtn.disabled = false;
    premiumBuyBtn.textContent = "Acheter";
  }

  if (creatorBuyBtn) {
    creatorBuyBtn.disabled = true;
    creatorBuyBtn.textContent = "Bientôt";
  }
}

function setGeneratingState(loading) {
  if (!generateBtn) return;
  generateBtn.disabled = loading;
  generateBtn.textContent = loading ? "Traitement..." : "Générer";
}

function stopProgressAnimation() {
  clearInterval(progressInterval);
  progressInterval = null;
  if (progressFill) progressFill.style.width = "0%";
  if (progressText) progressText.textContent = "0%";
  progressCard?.classList.add("hidden");
}

function finishProgressAnimation() {
  clearInterval(progressInterval);
  progressInterval = null;
  if (progressFill) progressFill.style.width = "100%";
  if (progressText) progressText.textContent = "100%";
}

function startProgressAnimation(engine) {
  progressCard?.classList.remove("hidden");
  resultCard?.classList.add("hidden");

  let value = 0;
  if (progressFill) progressFill.style.width = "0%";
  if (progressText) progressText.textContent = engine === "veed" ? "Préparation Astra..." : "Préparation Nova...";

  clearInterval(progressInterval);

  progressInterval = setInterval(() => {
    const limit = engine === "veed" ? 92 : 88;
    const step = engine === "veed" ? 3 : 6;

    if (value < limit) {
      value += step;
      if (value > limit) value = limit;

      if (progressFill) progressFill.style.width = `${value}%`;

      if (progressText) {
        if (engine === "veed") {
          progressText.textContent =
            value < 20 ? "Envoi à Astra..." :
            value < 50 ? "Traitement Astra..." :
            "Astra finalise la vidéo...";
        } else {
          progressText.textContent =
            value < 20 ? "Envoi à Nova..." :
            value < 50 ? "Job Nova lancé..." :
            "Nova traite la vidéo...";
        }
      }
    }
  }, 1400);
}

function clearActiveResultObjectUrl() {
  if (activeResultObjectUrl) {
    URL.revokeObjectURL(activeResultObjectUrl);
    activeResultObjectUrl = null;
  }
}

async function fetchWithRetry(url, options, maxAttempts = 2) {
  let lastError = null;

  for (let i = 0; i < maxAttempts; i += 1) {
    try {
      return await fetch(url, options);
    } catch (error) {
      lastError = error;
      await sleep(1500);
    }
  }

  throw lastError || new Error("Connexion impossible");
}

async function wakeUpServer(baseUrl) {
  try {
    await fetch(baseUrl, { method: "GET" });
  } catch {}
  await sleep(1000);
}

async function getMediaDuration(file, type) {
  return new Promise((resolve, reject) => {
    const element = document.createElement(type === "audio" ? "audio" : "video");
    const objectUrl = URL.createObjectURL(file);

    element.preload = "metadata";
    element.src = objectUrl;

    element.onloadedmetadata = () => {
      const duration = Number(element.duration || 0);
      URL.revokeObjectURL(objectUrl);

      if (!Number.isFinite(duration) || duration <= 0) {
        reject(new Error("Impossible de lire la durée du fichier"));
        return;
      }

      resolve(duration);
    };

    element.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Impossible de lire le fichier"));
    };
  });
}

async function validateSelectedMedia() {
  const videoFile = videoInput?.files?.[0];
  const audioFile = audioInput?.files?.[0];

  mediaState.videoDuration = null;
  mediaState.audioDuration = null;

  if (videoFile) {
    mediaState.videoDuration = await getMediaDuration(videoFile, "video");
    if (mediaState.videoDuration > getCurrentMaxSeconds()) {
      throw new Error(getDurationErrorMessage("video"));
    }
  }

  if (audioFile) {
    mediaState.audioDuration = await getMediaDuration(audioFile, "audio");
    if (mediaState.audioDuration > getCurrentMaxSeconds()) {
      throw new Error(getDurationErrorMessage("audio"));
    }
  }
}

async function refreshWallet() {
  const userId = getCurrentUserId();

  try {
    const [syncupRes, veedRes] = await Promise.all([
      fetch(`${SYNCUP_API_URL}/wallet`, {
        headers: { "x-user-id": userId }
      }),
      fetch(`${VEED_API_URL}/wallet`, {
        headers: { "x-user-id": userId }
      })
    ]);

    const syncupData = await syncupRes.json().catch(() => ({}));
    const veedData = await veedRes.json().catch(() => ({}));

    walletState = {
      secondsBalance: Number(veedData.secondsBalance || 0),
      standardSecondsBalance: Number(veedData.standardSecondsBalance || 0),
      premiumSecondsBalance: Number(veedData.premiumSecondsBalance || 0),
      syncupSecondsBalance: Number(syncupData.syncupSecondsBalance || 0)
    };
  } catch {
    walletState = {
      secondsBalance: 0,
      standardSecondsBalance: 0,
      premiumSecondsBalance: 0,
      syncupSecondsBalance: 0
    };
  }

  updateAccountDisplay();
  updateEstimate();
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

  const blob = await fetchVideoBlob(playUrl);
  const objectUrl = URL.createObjectURL(blob);

  activeResultObjectUrl = objectUrl;
  resultDownloadUrl = downloadUrl;
  resultFileName = fileName || "sync30-result.mp4";

  previewVideo.pause();
  previewVideo.removeAttribute("src");
  previewVideo.load();
  previewVideo.src = objectUrl;
  previewVideo.load();

  downloadBtn.href = "#";
  downloadBtn.setAttribute("download", resultFileName);

  resultCard.classList.remove("hidden");
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

async function pollSyncupJob(jobId) {
  return new Promise((resolve, reject) => {
    const userId = getCurrentUserId();
    let tries = 0;

    stopSyncupPolling();

    syncupPollingInterval = setInterval(async () => {
      tries += 1;

      try {
        const response = await fetch(`${SYNCUP_API_URL}/sync-status/${jobId}`, {
          headers: { "x-user-id": userId }
        });

        const data = await response.json();

        if (!response.ok || !data.ok) {
          stopSyncupPolling();
          reject(new Error(data.error || "Erreur status Nova"));
          return;
        }

        if (data.status === "starting" || data.status === "processing") {
          if (progressText) {
            progressText.textContent =
              data.status === "starting"
                ? "Job Nova démarre..."
                : "Nova traite la vidéo...";
          }
          return;
        }

        if (data.status === "failed") {
          stopSyncupPolling();

          if (data.syncupSecondsBalance != null) {
            walletState.syncupSecondsBalance = Number(data.syncupSecondsBalance || 0);
            updateAccountDisplay();
            updateEstimate();
          }

          reject(new Error(data.error || "Le traitement Nova a échoué"));
          return;
        }

        if (data.status === "succeeded") {
          stopSyncupPolling();
          finishProgressAnimation();

          const playUrl = data.playUrl.startsWith("http")
            ? data.playUrl
            : `${SYNCUP_API_URL}${data.playUrl}`;

          const downloadUrl = (data.downloadUrl || data.playUrl).startsWith("http")
            ? (data.downloadUrl || data.playUrl)
            : `${SYNCUP_API_URL}${data.downloadUrl || data.playUrl}`;

          await setResultVideoSecure(
            playUrl,
            downloadUrl,
            data.fileName || "sync30-syncup.mp4"
          );

          await refreshWallet();
          await loadVideos();

          hintText.textContent = "Nova terminé. Télécharge rapidement la vidéo.";
          resolve();
          return;
        }

        if (tries >= 180) {
          stopSyncupPolling();
          reject(new Error("Le traitement prend trop de temps"));
        }
      } catch (error) {
        stopSyncupPolling();
        reject(error);
      }
    }, 5000);
  });
}

async function deleteVideo(engine, videoName) {
  const apiBase = engine === "veed" ? VEED_API_URL : SYNCUP_API_URL;

  if (!confirm(`Supprimer cette vidéo ?\n\n${videoName}`)) {
    return;
  }

  try {
    const response = await fetch(`${apiBase}/delete-video`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": getCurrentUserId()
      },
      body: JSON.stringify({
        name: videoName
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Suppression impossible");
    }

    await loadVideos();
  } catch (error) {
    showWarning(`Erreur suppression vidéo : ${error.message}`);
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

async function fetchEngineVideos(apiBase, engine) {
  const response = await fetch(`${apiBase}/videos`, {
    headers: {
      "x-user-id": getCurrentUserId()
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.ok || !Array.isArray(data.videos)) {
    return [];
  }

  return data.videos.map((item) => ({
    ...item,
    engine,
    playUrl: item.playUrl.startsWith("http") ? item.playUrl : `${apiBase}${item.playUrl}`,
    downloadUrl: item.downloadUrl.startsWith("http") ? item.downloadUrl : `${apiBase}${item.downloadUrl}`
  }));
}async function loadVideos() {
  if (!videosContainer) return;

  videosContainer.innerHTML = `
    <div class="upload-box">
      <h3>Chargement des vidéos...</h3>
      <p>Patiente un instant.</p>
    </div>
  `;

  try {
    const [syncupVideos, veedVideos] = await Promise.all([
      fetchEngineVideos(SYNCUP_API_URL, "syncup"),
      fetchEngineVideos(VEED_API_URL, "veed")
    ]);

    const allVideos = [...syncupVideos, ...veedVideos].sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA;
    });

    if (allVideos.length === 0) {
      videosContainer.innerHTML = `
        <div class="upload-box">
          <h3>Aucune vidéo pour le moment</h3>
          <p>Les vidéos générées apparaîtront ici.</p>
        </div>
      `;
      return;
    }

    videosContainer.innerHTML = "";

    allVideos.forEach((item) => {
      const card = document.createElement("div");
      card.className = "card";

      const title = document.createElement("h3");
      title.className = "title";
      title.style.fontSize = "18px";
      title.textContent = safeText(item.name, "Vidéo");

      const meta = document.createElement("p");
      meta.className = "sub";
      meta.innerHTML = `
        Moteur : ${item.engine === "veed" ? "Astra" : "Nova"}<br>
        ${item.created_at ? `Ajout : ${formatDateFr(item.created_at)}` : ""}
      `;

      const watchBtn = document.createElement("button");
      watchBtn.className = "btn btn-primary";
      watchBtn.type = "button";
      watchBtn.textContent = "Regarder ici";
      watchBtn.onclick = async () => {
        await setResultVideoSecure(item.playUrl, item.downloadUrl, item.name || "video.mp4");
        resultCard.scrollIntoView({ behavior: "smooth", block: "center" });
      };

      const openBtn = document.createElement("button");
      openBtn.className = "btn btn-secondary btn-inline";
      openBtn.type = "button";
      openBtn.textContent = "Ouvrir";
      openBtn.onclick = async () => {
        try {
          await openVideoSecure(item.playUrl);
        } catch (error) {
          showWarning(`Erreur ouverture vidéo : ${error.message}`);
        }
      };

      const downloadButton = document.createElement("button");
      downloadButton.className = "btn btn-secondary btn-inline";
      downloadButton.type = "button";
      downloadButton.textContent = "Télécharger";
      downloadButton.onclick = async () => {
        try {
          await downloadVideoSecure(item.downloadUrl, item.name || "video.mp4");
        } catch (error) {
          showWarning(`Erreur téléchargement : ${error.message}`);
        }
      };

      const deleteButton = document.createElement("button");
      deleteButton.className = "btn btn-secondary btn-inline";
      deleteButton.type = "button";
      deleteButton.textContent = "Supprimer";
      deleteButton.onclick = async () => {
        await deleteVideo(item.engine, item.name);
      };

      const actions = document.createElement("div");
      actions.className = "stack";
      actions.appendChild(watchBtn);
      actions.appendChild(openBtn);
      actions.appendChild(downloadButton);
      actions.appendChild(deleteButton);

      card.appendChild(title);
      card.appendChild(meta);
      card.appendChild(actions);

      videosContainer.appendChild(card);
    });
  } catch (error) {
    videosContainer.innerHTML = `
      <div class="upload-box">
        <h3>Impossible de charger les vidéos</h3>
        <p>${safeText(error.message, "Réessaie plus tard.")}</p>
      </div>
    `;
  }
}

function resetInterface() {
  stopSyncupPolling();
  stopProgressAnimation();
  clearActiveResultObjectUrl();

  resultCard.classList.add("hidden");
  clearWarning();
  setGeneratingState(false);

  mediaState.videoDuration = null;
  mediaState.audioDuration = null;

  if (videoInput) videoInput.value = "";
  if (audioInput) audioInput.value = "";

  if (videoFileName) videoFileName.textContent = "Aucune vidéo sélectionnée";
  if (audioFileName) audioFileName.textContent = "Aucun audio sélectionné";

  previewVideo.pause();
  previewVideo.removeAttribute("src");
  previewVideo.load();

  resultDownloadUrl = "";
  resultFileName = "sync30-result.mp4";

  updateEstimate();
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

  const { error } = await supabaseClient.auth.signUp({
    email: email.trim(),
    password
  });

  if (error) {
    alert(`Erreur inscription : ${error.message}`);
    return;
  }

  alert("Compte créé. Vérifie tes emails si une confirmation est demandée.");
}

async function handleLogin() {
  const email = prompt("Entre ton email :");
  if (!email) return;

  const password = prompt("Entre ton mot de passe :");
  if (!password) return;

  const { error } = await supabaseClient.auth.signInWithPassword({
    email: email.trim(),
    password
  });

  if (error) {
    alert(`Erreur connexion : ${error.message}`);
    return;
  }

  alert("Connexion réussie.");
}

async function handleLogout() {
  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    alert(`Erreur déconnexion : ${error.message}`);
    return;
  }

  alert("Déconnexion réussie.");
}

async function handleResetPasswordRequest() {
  const email = prompt("Entre ton email pour recevoir le lien de réinitialisation :");
  if (!email) return;

  const { error } = await supabaseClient.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: PASSWORD_RESET_REDIRECT_URL
  });

  if (error) {
    alert(`Erreur réinitialisation : ${error.message}`);
    return;
  }

  alert("Email de réinitialisation envoyé.");
}

async function maybeHandleRecoverySession() {
  if (recoveryHandled) return;

  const url = `${window.location.hash}${window.location.search}`.toLowerCase();
  if (!url.includes("type=recovery")) return;

  recoveryHandled = true;

  const newPassword = prompt("Entre ton nouveau mot de passe (minimum 6 caractères) :");
  if (!newPassword) return;

  if (newPassword.length < 6) {
    alert("Mot de passe trop court.");
    recoveryHandled = false;
    return;
  }

  const { error } = await supabaseClient.auth.updateUser({
    password: newPassword
  });

  if (error) {
    alert(`Erreur mise à jour mot de passe : ${error.message}`);
    recoveryHandled = false;
    return;
  }

  window.history.replaceState({}, document.title, PASSWORD_RESET_REDIRECT_URL);
  alert("Mot de passe mis à jour.");
}

async function hydrateCurrentUser() {
  try {
    const { data } = await supabaseClient.auth.getUser();
    currentUser = data?.user || null;
  } catch {
    currentUser = null;
  }

  updateAuthUI();
  updateAccountDisplay();
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

async function createCheckoutLink(pack) {
  if (!currentUser) {
    alert("Connecte-toi d’abord pour acheter du temps.");
    return;
  }

  try {
    const response = await fetch(`${PADDLE_API_URL}/create-checkout-link`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": getCurrentUserId()
      },
      body: JSON.stringify({
        pack,
        email: currentUser?.email || ""
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.ok || !data.checkoutUrl) {
      throw new Error(data.error || "Impossible de créer le paiement");
    }

    window.location.href = data.checkoutUrl;
  } catch (error) {
    alert(`Erreur paiement : ${error.message}`);
  }
}

async function handlePaymentReturn() {
  if (paymentReturnHandled) return;

  const params = new URLSearchParams(window.location.search);
  const payment = params.get("payment");
  const pack = params.get("pack");

  if (payment !== "success") return;

  paymentReturnHandled = true;

  hintText.textContent =
    pack === "astra"
      ? "Paiement Astra validé. Mise à jour du solde..."
      : "Paiement Nova validé. Mise à jour du solde...";

  await sleep(3000);
  await refreshWallet();

  const cleanUrl = new URL(window.location.href);
  cleanUrl.searchParams.delete("payment");
  cleanUrl.searchParams.delete("pack");
  window.history.replaceState({}, document.title, cleanUrl.toString());

  alert("Paiement validé. Ton solde a été actualisé.");
}

function bindPricingButtons() {
  updatePricingButtons();

  standardBuyBtn?.addEventListener("click", async () => {
    await createCheckoutLink("nova");
  });

  premiumBuyBtn?.addEventListener("click", async () => {
    await createCheckoutLink("astra");
  });

  creatorBuyBtn?.addEventListener("click", () => {
    alert("Pack Créateur bientôt disponible.");
  });
}

themeToggle?.addEventListener("click", () => {
  const isLight = body.classList.contains("light");

  if (isLight) {
    body.classList.remove("light");
    body.classList.add("dark");
    themeToggle.textContent = "🌙";
    localStorage.setItem("sync30_theme", "dark");
  } else {
    body.classList.remove("dark");
    body.classList.add("light");
    themeToggle.textContent = "☀️";
    localStorage.setItem("sync30_theme", "light");
  }
});

engineSelect?.addEventListener("change", async () => {
  updateEngineTexts();
  updateAccountDisplay();

  try {
    const videoFile = videoInput?.files?.[0];
    const audioFile = audioInput?.files?.[0];

    if (videoFile || audioFile) {
      await validateSelectedMedia();
    }

    updateEstimate();
  } catch (error) {
    showWarning(error.message);
  }
});

videoInput?.addEventListener("change", async () => {
  clearWarning();

  const file = videoInput.files?.[0];
  mediaState.videoDuration = null;

  if (!file) {
    videoFileName.textContent = "Aucune vidéo sélectionnée";
    updateEstimate();
    return;
  }

  if (!isAllowedExtension(file.name, ALLOWED_VIDEO_EXTENSIONS)) {
    videoInput.value = "";
    videoFileName.textContent = "Aucune vidéo sélectionnée";
    showWarning("Format vidéo non supporté. Utilise MP4, WEBM, MOV, M4V ou OGG.");
    updateEstimate();
    return;
  }

  try {
    const duration = await getMediaDuration(file, "video");
    mediaState.videoDuration = duration;

    if (duration > getCurrentMaxSeconds()) {
      throw new Error(getDurationErrorMessage("video"));
    }

    videoFileName.textContent = `${file.name} • ${duration.toFixed(1)} s`;
    updateEstimate();
  } catch (error) {
    videoInput.value = "";
    videoFileName.textContent = "Aucune vidéo sélectionnée";
    mediaState.videoDuration = null;
    updateEstimate();
    showWarning(error.message);
  }
});

audioInput?.addEventListener("change", async () => {
  clearWarning();

  const file = audioInput.files?.[0];
  mediaState.audioDuration = null;

  if (!file) {
    audioFileName.textContent = "Aucun audio sélectionné";
    updateEstimate();
    return;
  }

  if (!isAllowedExtension(file.name, ALLOWED_AUDIO_EXTENSIONS)) {
    audioInput.value = "";
    audioFileName.textContent = "Aucun audio sélectionné";
    showWarning("Format audio non supporté. Utilise MP3, WAV, M4A, AAC, OGG ou WEBM.");
    updateEstimate();
    return;
  }

  try {
    const duration = await getMediaDuration(file, "audio");
    mediaState.audioDuration = duration;

    if (duration > getCurrentMaxSeconds()) {
      throw new Error(getDurationErrorMessage("audio"));
    }

    audioFileName.textContent = `${file.name} • ${duration.toFixed(1)} s`;
    updateEstimate();
  } catch (error) {
    audioInput.value = "";
    audioFileName.textContent = "Aucun audio sélectionné";
    mediaState.audioDuration = null;
    updateEstimate();
    showWarning(error.message);
  }
});

generateBtn?.addEventListener("click", async () => {
  clearWarning();

  const engine = getSelectedEngine();
  const videoFile = videoInput?.files?.[0];
  const audioFile = audioInput?.files?.[0];

  if (!videoFile) {
    showWarning("Ajoute d’abord une vidéo.");
    return;
  }

  if (!audioFile) {
    showWarning("Ajoute d’abord un audio.");
    return;
  }

  try {
    await validateSelectedMedia();
  } catch (error) {
    showWarning(error.message);
    return;
  }

  const duration = getDurationForBilling();

  if (!duration) {
    showWarning("Impossible de détecter la durée de la vidéo.");
    return;
  }

  const billedSeconds = roundSecondsForBilling(duration);
  const balance = getEngineBalance();

  if (!isAdminUser() && Number(balance || 0) < billedSeconds) {
    showWarning(
      `Pas assez de temps disponible pour ${engine === "veed" ? "Astra" : "Nova"}. Requis : ${billedSeconds} s. Disponible : ${Number(balance || 0)} s.`
    );
    return;
  }

  setGeneratingState(true);
  startProgressAnimation(engine);

  try {
    const baseUrl = engine === "veed" ? VEED_API_URL : SYNCUP_API_URL;
    const endpoint = engine === "veed"
      ? `${VEED_API_URL}/lipsync`
      : `${SYNCUP_API_URL}/sync`;

    await wakeUpServer(baseUrl);

    const formData = new FormData();
    formData.append("video", videoFile);
    formData.append("audio", audioFile);
    formData.append("duration_seconds", duration.toFixed(2));

    const response = await fetchWithRetry(endpoint, {
      method: "POST",
      headers: {
        "x-user-id": getCurrentUserId()
      },
      body: formData
    }, engine === "veed" ? 1 : 2);

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Erreur serveur");
    }

    if (engine === "veed") {
      finishProgressAnimation();

      const playUrl = (data.playUrl || data.videoUrl).startsWith("http")
        ? (data.playUrl || data.videoUrl)
        : `${VEED_API_URL}${data.playUrl || data.videoUrl}`;

      const downloadUrl = (data.downloadUrl || data.videoUrl).startsWith("http")
        ? (data.downloadUrl || data.videoUrl)
        : `${VEED_API_URL}${data.downloadUrl || data.videoUrl}`;

      await setResultVideoSecure(
        playUrl,
        downloadUrl,
        data.fileName || "sync30-veed.mp4"
      );

      if (data.premiumSecondsBalance != null) {
        walletState.premiumSecondsBalance = Number(data.premiumSecondsBalance || 0);
      }

      await refreshWallet();
      await loadVideos();

      hintText.textContent = "Astra terminé. Télécharge rapidement la vidéo.";
      setGeneratingState(false);
      return;
    }

    if (data.syncupSecondsBalance != null) {
      walletState.syncupSecondsBalance = Number(data.syncupSecondsBalance || 0);
      updateAccountDisplay();
      updateEstimate();
    }

    if (!data.jobId) {
      throw new Error("Job Nova non lancé");
    }

    if (progressText) {
      progressText.textContent = "Traitement Nova lancé...";
    }

    await pollSyncupJob(data.jobId);
    setGeneratingState(false);
  } catch (error) {
    stopProgressAnimation();
    setGeneratingState(false);
    showWarning(`Erreur génération : ${error.message}`);
  }
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

resetBtn?.addEventListener("click", () => {
  resetInterface();
});

refreshVideosBtn?.addEventListener("click", async () => {
  await loadVideos();
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

supabaseClient.auth.onAuthStateChange(async (_event, session) => {
  currentUser = session?.user || null;
  updateAuthUI();
  await refreshWallet();
  updateAccountDisplay();
  updateEngineTexts();
  updateEstimate();
  updatePricingButtons();
  await loadVideos();
  await maybeHandleRecoverySession();
  await handlePaymentReturn();
});

async function initApp() {
  applySavedTheme();
  setGeneratingState(false);
  updateEngineTexts();
  updatePricingButtons();
  bindPricingButtons();
  await hydrateCurrentUser();
  await refreshWallet();
  updateEstimate();
  await loadVideos();
  await maybeHandleRecoverySession();
  await handlePaymentReturn();
}

initApp();
