(() => {
  const ADMIN_EMAIL = "skypieachannel" + "@" + "gmail.com";
  const ADMIN_API_URL = "https://sync30-paddle-api.onrender.com";

  function $(id) {
    return document.getElementById(id);
  }

  function getAuthEmail() {
    return String($("authStatusText")?.textContent || "").replace("Connecté :", "").trim().toLowerCase();
  }

  function isAdminVisible() {
    return getAuthEmail() === ADMIN_EMAIL || String($("modeLabel")?.textContent || "").toLowerCase().includes("admin");
  }

  async function getToken() {
    if (!window.supabaseClient && window.supabase && window.SUPABASE_URL && window.SUPABASE_PUBLISHABLE_KEY) {
      window.supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_PUBLISHABLE_KEY);
    }

    if (window.supabaseClient?.auth?.getSession) {
      const { data } = await window.supabaseClient.auth.getSession();
      return data?.session?.access_token || "";
    }

    if (window.supabase?.createClient) {
      const localUrl = "https://hfzbkgnccyyrotijnlda.supabase.co";
      const localKey = "sb_publishable_j_dMdudOZakRbeKQQRVWDQ_TYI2mwka";
      const client = window.supabase.createClient(localUrl, localKey);
      const { data } = await client.auth.getSession();
      return data?.session?.access_token || "";
    }

    return "";
  }

  function showAdminMessage(text, danger = false) {
    const box = $("inlineAdminMessage");
    if (!box) return;
    box.textContent = text;
    box.classList.remove("hidden");
    box.style.color = danger ? "#ff8a8a" : "#9cff4f";
  }

  function hideAdminMessage() {
    const box = $("inlineAdminMessage");
    if (!box) return;
    box.textContent = "";
    box.classList.add("hidden");
  }

  async function adminPost(path, body) {
    const token = await getToken();
    if (!token) throw new Error("Session admin introuvable. Déconnecte-toi puis reconnecte-toi.");

    const response = await fetch(`${ADMIN_API_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(body)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || "Erreur serveur admin");
    return data;
  }

  function buildAdminPanel() {
    if ($("inlineAdminPanel")) return;

    const panel = document.createElement("div");
    panel.id = "inlineAdminPanel";
    panel.className = "card hidden";
    panel.innerHTML = `
      <div class="pill">Administration crédits</div>
      <h2 class="title">Valider une recharge</h2>
      <p class="sub">Vérifie d’abord le paiement dans Revolut Pro, puis ajoute les crédits ici.</p>

      <div class="stack">
        <div class="upload-box" style="text-align:left;">
          <h3>Email du client</h3>
          <p>Email utilisé pour créer son compte Sync30.</p>
          <input id="inlineClientEmail" type="email" placeholder="client@gmail.com" autocomplete="email" style="width:100%;min-height:58px;border-radius:20px;border:1px solid rgba(255,255,255,.22);padding:14px 16px;background:rgba(0,0,0,.24);color:white;font-size:17px;font-weight:800;" />
        </div>

        <div class="upload-box" style="text-align:left;">
          <h3>Pack payé</h3>
          <select id="inlinePackSelect" class="engine-select">
            <option value="nova">Nova 2,19 € - +30 s Nova</option>
            <option value="astra">Astra 4,19 € - +30 s Astra</option>
            <option value="creator_nova">Créateur 7,99 € - +110 s Nova</option>
            <option value="creator_astra">Créateur 7,99 € - +60 s Astra</option>
          </select>
        </div>

        <button class="btn btn-secondary" id="inlineFindClientBtn" type="button">Vérifier le client</button>
        <button class="btn btn-primary" id="inlineValidateCreditsBtn" type="button">Valider et ajouter les crédits</button>
        <p class="warning hidden" id="inlineAdminMessage"></p>
      </div>
    `;

    const accountCard = Array.from(document.querySelectorAll(".card")).find(card => card.textContent.includes("Compte"));
    if (accountCard) {
      accountCard.insertAdjacentElement("afterend", panel);
    } else {
      document.querySelector(".app")?.appendChild(panel);
    }

    $("inlineFindClientBtn")?.addEventListener("click", async () => {
      hideAdminMessage();
      try {
        const email = String($("inlineClientEmail")?.value || "").trim().toLowerCase();
        if (!email) throw new Error("Entre l’email du client.");
        const data = await adminPost("/admin/find-user", { userEmail: email });
        showAdminMessage(`Client trouvé. Nova : ${data.syncupSecondsBalance}s • Astra : ${data.premiumSecondsBalance}s`);
      } catch (error) {
        showAdminMessage(error.message, true);
      }
    });

    $("inlineValidateCreditsBtn")?.addEventListener("click", async () => {
      hideAdminMessage();
      try {
        const email = String($("inlineClientEmail")?.value || "").trim().toLowerCase();
        const pack = String($("inlinePackSelect")?.value || "");
        if (!email) throw new Error("Entre l’email du client.");
        const ok = confirm(`Valider la recharge Revolut pour ${email} ?`);
        if (!ok) return;
        const data = await adminPost("/admin/add-credits", { userEmail: email, pack });
        showAdminMessage(`Validé : ${data.label}. Nouveau solde Nova ${data.syncupSecondsBalance}s • Astra ${data.premiumSecondsBalance}s`);
      } catch (error) {
        showAdminMessage(error.message, true);
      }
    });
  }

  function updatePanelVisibility() {
    buildAdminPanel();
    const panel = $("inlineAdminPanel");
    if (!panel) return;
    if (isAdminVisible()) panel.classList.remove("hidden");
    else panel.classList.add("hidden");
  }

  window.addEventListener("load", () => {
    updatePanelVisibility();
    setInterval(updatePanelVisibility, 700);
  });
})();
