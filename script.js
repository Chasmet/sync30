const ADMIN_CODE = "CHK-PRO-28@2026-CHK";
const API_BASE_URL = "https://sync30-api.onrender.com";
const API_UPLOAD_URL = `${API_BASE_URL}/upload`;

const MAX_RECOMMENDED_SECONDS = 30;
const MAX_ALLOWED_SECONDS = 32;

const ALLOWED_VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "m4v", "ogg"];
const ALLOWED_AUDIO_EXTENSIONS = ["mp3", "wav", "m4a", "aac", "ogg", "webm"];

const themeToggle = document.getElementById("themeToggle");
const body = document.body;

const adminBtn = document.getElementById("adminBtn");
const engineSelect = document.getElementById("engineSelect");

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
    showWarning(
      `La vidéo dépasse la limite autorisée. ${MAX_RECOMMENDED_SECONDS} secondes recommandées, ${MAX_ALLOWED_SECONDS} secondes tolérées maximum.`
    );
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
    showWarning(
      `L’audio dépasse la limite autorisée. ${MAX_RECOMMENDED_SECONDS} secondes recommandées, ${MAX_ALLOWED_SECONDS} secondes tolérées maximum.`
    );
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
    showWarning(
      `La vidéo dépasse la limite autorisée. ${MAX_RECOMMENDED_SECONDS} secondes recommandées, ${MAX_ALLOWED_SECONDS} secondes tolérées maximum.`
    );
    return;
  }

  if (!isAudioOk) {
    showWarning(
      `L’audio dépasse la limite autorisée. ${MAX_RECOMMENDED_SECONDS} secondes recommandées, ${MAX_ALLOWED_SECONDS} secondes tolérées maximum.`
    );
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
    const result = await uploadToBackend(videoFile, audioFile, engine);

    if (!result.ok) {
      throw new Error(result.error || "Erreur serveur");
    }

    if (!isAdmin) {
      freeTrials -= 1;
      localStorage.setItem("sync30_free_trials", String(freeTrials));
      updateAccountDisplay();
    }

    finishProgressAnimation();

    const localPreviewUrl = URL.createObjectURL(videoFile);
    previewVideo.src = localPreviewUrl;
    downloadBtn.href = localPreviewUrl;
    downloadBtn.setAttribute("download", "sync30-preview.mp4");

    resultCard.classList.remove("hidden");

    const serverMessage = result.message || "Fichiers envoyés avec succès au serveur.";
    hintText.textContent = `${serverMessage} Moteur choisi : ${engine.toUpperCase()}. Le vrai rendu lipsync sera branché à l’étape suivante.`;
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
      `Toi = mode admin gratuit illimité. Les autres = 5 essais gratuits puis packs payants. ${MAX_RECOMMENDED_SECONDS} secondes recommandées, ${MAX_ALLOWED_SECONDS} secondes tolérées maximum.`;
  }
}

async function uploadToBackend(videoFile, audioFile, engine) {
  const formData = new FormData();
  formData.append("video", videoFile);
  formData.append("audio", audioFile);
  formData.append("engine", engine);

  const response = await fetch(API_UPLOAD_URL, {
    method: "POST",
    body: formData
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Erreur inconnue du serveur");
  }

  return data;
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
}

function validateMediaDuration(file, type) {
  return new Promise((resolve) => {
    const element = document.createElement(type === "audio" ? "audio" : "video");
    element.preload = "metadata";
    element.src = URL.createObjectURL(file);

    element.onloadedmetadata = () => {
      URL.revokeObjectURL(element.src);
      resolve(element.duration <= MAX_ALLOWED_SECONDS);
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
