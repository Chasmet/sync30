const ADMIN_CODE = "CHK-PRO-28@2026-CHK";

const MAX_RECOMMENDED_SECONDS = 30;
const MAX_ALLOWED_SECONDS = 32;

const themeToggle = document.getElementById("themeToggle");
const body = document.body;

const adminBtn = document.getElementById("adminBtn");

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
let fakeProgress = null;

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

  videoFileName.textContent = file.name;

  const ok = await validateMediaDuration(file, "video");

  if (!ok) {
    warningText.classList.remove("hidden");
    warningText.textContent =
      `La vidéo dépasse la limite autorisée. ${MAX_RECOMMENDED_SECONDS} secondes recommandées, ${MAX_ALLOWED_SECONDS} secondes tolérées maximum.`;
    videoInput.value = "";
    videoFileName.textContent = "Aucune vidéo sélectionnée";
  } else {
    warningText.classList.add("hidden");
    warningText.textContent = "";
  }
});

audioInput.addEventListener("change", async () => {
  const file = audioInput.files[0];
  if (!file) return;

  audioFileName.textContent = file.name;

  const ok = await validateMediaDuration(file, "audio");

  if (!ok) {
    warningText.classList.remove("hidden");
    warningText.textContent =
      `L’audio dépasse la limite autorisée. ${MAX_RECOMMENDED_SECONDS} secondes recommandées, ${MAX_ALLOWED_SECONDS} secondes tolérées maximum.`;
    audioInput.value = "";
    audioFileName.textContent = "Aucun audio sélectionné";
  } else {
    warningText.classList.add("hidden");
    warningText.textContent = "";
  }
});

generateBtn.addEventListener("click", async () => {
  const videoFile = videoInput.files[0];
  const audioFile = audioInput.files[0];

  if (!videoFile) {
    showWarning("Ajoute d’abord une vidéo.");
    return;
  }

  if (!audioFile) {
    showWarning("Ajoute d’abord un audio.");
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

  warningText.classList.add("hidden");
  warningText.textContent = "";

  if (!isAdmin) {
    freeTrials -= 1;
    localStorage.setItem("sync30_free_trials", String(freeTrials));
    updateAccountDisplay();
  }

  startFakeProcessing(videoFile);
});

resetBtn.addEventListener("click", () => {
  clearInterval(fakeProgress);

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

  warningText.classList.add("hidden");
  warningText.textContent = "";
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

function showWarning(message) {
  warningText.classList.remove("hidden");
  warningText.textContent = message;
}

function startFakeProcessing(videoFile) {
  progressCard.classList.remove("hidden");
  resultCard.classList.add("hidden");

  let progress = 0;
  clearInterval(fakeProgress);

  fakeProgress = setInterval(() => {
    progress += 10;
    if (progress > 100) progress = 100;

    progressFill.style.width = `${progress}%`;
    progressText.textContent = `${progress}%`;

    if (progress === 100) {
      clearInterval(fakeProgress);

      const url = URL.createObjectURL(videoFile);
      previewVideo.src = url;
      downloadBtn.href = url;
      resultCard.classList.remove("hidden");
    }
  }, 250);
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
