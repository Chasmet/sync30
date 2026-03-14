const ADMIN_CODE = "CHK-PRO-28@2026-CHK";
const API_BASE_URL = "https://sync30-api.onrender.com";
const API_UPLOAD_URL = `${API_BASE_URL}/sync`;

const VEED_DISPLAY_SECONDS = 30;
const VEED_TOLERANCE_SECONDS = 32;
const KLING_MAX_SECONDS = 9;

const ALLOWED_VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "m4v", "ogg"];
const ALLOWED_AUDIO_EXTENSIONS = ["mp3", "wav", "m4a", "aac", "ogg", "webm"];

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

let freeTrials = parseInt(localStorage.getItem("sync30_free_trials") || "5", 10);
let isAdmin = localStorage.getItem("sync30_admin") === "true";

themeToggle.addEventListener("click", () => {
  body.classList.toggle("light");
  body.classList.toggle("dark");
  themeToggle.textContent = body.classList.contains("light") ? "☀️" : "🌙";
  localStorage.setItem(
    "sync30_theme",
    body.classList.contains("light") ? "light" : "dark"
  );
});

adminBtn.addEventListener("click", () => {
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

engineSelect.addEventListener("change", () => {
  updateEngineTexts();
  revalidateSelectedFiles();
});

videoInput.addEventListener("change", async () => {
  const file = videoInput.files[0];
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

audioInput.addEventListener("change", async () => {
  const file = audioInput.files[0];
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

generateBtn.addEventListener("click", async () => {
  const videoFile = videoInput.files[0];
  const audioFile = audioInput.files[0];
  const engine = engineSelect ? engineSelect.value : "kling";

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

  try {
    const formData = new FormData();
    formData.append("video", videoFile);
    formData.append("audio", audioFile);
    formData.append("engine", engine);

    const response = await fetch(API_UPLOAD_URL, {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      throw new Error("Erreur serveur");
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    if (!isAdmin) {
      freeTrials -= 1;
      localStorage.setItem("sync30_free_trials", String(freeTrials));
      updateAccountDisplay();
    }

    finishProgressAnimation();

    previewVideo.src = url;
    downloadBtn.href = url;
    downloadBtn.download = "sync30-video.mp4";

    resultCard.classList.remove("hidden");
    hintText.textContent = `Vidéo générée avec le moteur ${engine.toUpperCase()}. Le nouvel audio doit remplacer l’ancien.`;
  } catch (error) {
    stopProgressAnimation();
    showWarning(`Erreur lors de l’envoi au serveur : ${error.message}`);
  } finally {
    setGeneratingState(false);
  }
});

resetBtn.addEventListener("click", () => {
  resetInterface();
});

function getSelectedEngine() {
  return engineSelect ? engineSelect.value : "veed";
}

function getCurrentMaxSeconds() {
  const engine = getSelectedEngine();
  return engine === "kling" ? KLING_MAX_SECONDS : VEED_TOLERANCE_SECONDS;
}

function getDurationErrorMessage(type) {
  const engine = getSelectedEngine();

  if (engine === "kling") {
    return `Le ${type === "video" ? "fichier vidéo" : "fichier audio"} dépasse la limite de Kling. Maximum autorisé : ${KLING_MAX_SECONDS} secondes.`;
  }

  return `Le ${type === "video" ? "fichier vidéo" : "fichier audio"} dépasse la limite de VEED. ${VEED_DISPLAY_SECONDS} secondes affichées, ${VEED_TOLERANCE_SECONDS} secondes tolérées maximum.`;
}

function updateEngineTexts() {
  const engine = getSelectedEngine();

  if (engine === "kling") {
    engineRulesText.textContent =
      "Mode Kling actif : vidéo et audio limités à 9 secondes maximum.";
    engineDescription.textContent =
      "Kling = moins cher • limite stricte à 9 secondes maximum.";
    videoRulesText.textContent =
      "Formats supportés : MP4, WEBM, MOV, M4V, OGG • Kling : 9 secondes maximum.";
    audioRulesText.textContent =
      "Formats supportés : MP3, WAV, M4A, AAC, OGG, WEBM • Kling : 9 secondes maximum.";
  } else {
    engineRulesText.textContent =
      "Mode VEED actif : 30 secondes affichées, avec tolérance technique jusqu’à 32 secondes pour la vidéo et l’audio.";
    engineDescription.textContent =
      "VEED = plus stable • 30 secondes affichées, 32 secondes tolérées.";
    videoRulesText.textContent =
      "Formats supportés : MP4, WEBM, MOV, M4V, OGG • VEED : 30 secondes affichées • tolérance jusqu’à 32 secondes.";
    audioRulesText.textContent =
      "Formats supportés : MP3, WAV, M4A, AAC, OGG, WEBM • VEED : 30 secondes affichées • tolérance jusqu’à 32 secondes.";
  }
}

async function revalidateSelectedFiles() {
  const videoFile = videoInput.files[0];
  const audioFile = audioInput.files[0];

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
    themeToggle.textContent = "☀️";
  } else {
    body.classList.remove("light");
    body.classList.add("dark");
    themeToggle.textContent = "🌙";
  }
}

applySavedTheme();
updateAccountDisplay();
updateEngineTexts();
