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
    if (window.supabaseClient?.auth?.getSession) {
      const { data } = await window.supabaseClient.auth.getSession();
      return data?.session?.access_token || "";
    }

    if (typeof supabaseClient !== "undefined" && supabaseClient?.auth?.getSession) {
      const { data } = await supabaseClient.auth.getSession();
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

  async function adminRequest(path, { method = "GET", body } = {}) {
    const token = await getToken();
    if (!token) throw new Error("Session admin introuvable. Connecte-toi avec le compte administrateur.");

    const options = {
      method,
      headers: {
        "Authorization": `Bearer ${token}`
      }
    };

    if (body !== undefined) {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${ADMIN_API_URL}${path}`, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || "Erreur serveur admin");
    return data;
  }

  function formatDate(value) {
    try {
      return new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "short",
        timeStyle: "short"
      }).format(new Date(value));
    } catch {
      return String(value || "");
    }
  }

  function packLabel(pack) {
    if (pack === "nova") return "Nova — 2,19 €";
    if (pack === "astra") return "Astra — 4,19 €";
    if (pack === "creator") return "Créateur — 7,99 €";
    return pack || "Pack";
  }

  function renderPendingPurchases(requests = []) {
    const container = $("pendingPurchasesList");
    const count = $("pendingPurchasesCount");
    if (!container) return;

    if (count) count.textContent = `${requests.length} en attente`;

    if (!requests.length) {
      container.innerHTML = `<div class="upload-box"><h3>Aucun achat en attente</h3><p>Les nouvelles demandes apparaîtront ici.</p></div>`;
      return;
    }

    container.innerHTML = requests.map((item) => {
      const id = String(item.id || "");
      const email = String(item.user_email || "");
      const pack = String(item.pack || "");
      const creatorButtons = pack === "creator"
        ? `<div class="stack" style="margin-top:10px;">
             <button class="btn btn-primary" data-purchase-action="approve" data-request-id="${id}" data-approved-pack="creator_nova" type="button">Valider +110 s Nova</button>
             <button class="btn btn-primary" data-purchase-action="approve" data-request-id="${id}" data-approved-pack="creator_astra" type="button">Valider +60 s Astra</button>
           </div>`
        : `<button class="btn btn-primary" style="margin-top:10px;" data-purchase-action="approve" data-request-id="${id}" type="button">Valider et créditer</button>`;

      return `<div class="upload-box" style="text-align:left;">
        <h3>${packLabel(pack)}</h3>
        <p><strong>${email}</strong></p>
        <p>Demande : ${formatDate(item.created_at)} • Source : ${String(item.source || "sync30")}</p>
        ${creatorButtons}
        <button class="btn btn-secondary" style="margin-top:8px;" data-purchase-action="reject" data-request-id="${id}" type="button">Rejeter</button>
      </div>`;
    }).join("");
  }

  async function loadPendingPurchases() {
    const container = $("pendingPurchasesList");
    if (container) container.innerHTML = `<div class="upload-box"><h3>Chargement…</h3></div>`;

    try {
      const data = await adminRequest("/admin/purchase-requests");
      renderPendingPurchases(data.requests || []);
    } catch (error) {
      if (container) {
        container.innerHTML = `<div class="upload-box"><h3>Impossible de charger</h3><p>${String(error.message || error)}</p></div>`;
      }
    }
  }

  async function handlePurchaseAction(button) {
    const action = button.dataset.purchaseAction;
    const requestId = button.dataset.requestId;
    const approvedPack = button.dataset.approvedPack || "";
    if (!requestId) return;

    button.disabled = true;
    try {
      if (action === "approve") {
        const ok = confirm("Tu as vérifié le paiement dans Revolut Pro. Valider et créditer ce client ?");
        if (!ok) return;
        const data = await adminRequest("/admin/approve-purchase", {
          method: "POST",
          body: { requestId, approvedPack }
        });
        showAdminMessage(`Achat validé : ${data.label}. Nova ${data.syncupSecondsBalance}s • Astra ${data.premiumSecondsBalance}s`);
      } else if (action === "reject") {
        const ok = confirm("Rejeter cette demande d’achat ?");
        if (!ok) return;
        await adminRequest("/admin/reject-purchase", {
          method: "POST",
          body: { requestId }
        });
        showAdminMessage("Demande rejetée.");
      }
      await loadPendingPurchases();
    } catch (error) {
      showAdminMessage(error.message, true);
    } finally {
      button.disabled = false;
    }
  }

  function buildAdminPanel() {
    if ($("inlineAdminPanel")) return;

    const panel = document.createElement("div");
    panel.id = "inlineAdminPanel";
    panel.className = "card hidden";
    panel.innerHTML = `
      <div class="pill">Administration Sync30</div>
      <h2 class="title">Achats à autoriser</h2>
      <p class="sub">Le client lance son achat. Tu vérifies le paiement dans Revolut Pro puis tu valides ici. Les crédits sont ajoutés dans Supabase.</p>

      <div class="status-row" style="grid-template-columns:1fr auto;align-items:center;margin-bottom:14px;">
        <div class="mini-box"><div class="label">File d’attente</div><div class="value" id="pendingPurchasesCount">—</div></div>
        <button class="btn btn-secondary" id="refreshPurchasesBtn" type="button" style="width:auto;">Actualiser</button>
      </div>

      <div id="pendingPurchasesList" class="stack">
        <div class="upload-box"><h3>Chargement…</h3></div>
      </div>

      <hr style="border:0;border-top:1px solid rgba(255,255,255,.12);margin:22px 0;" />
      <h2 class="title">Ajout manuel</h2>
      <p class="sub">À utiliser seulement si tu dois créditer un client manuellement.</p>

      <div class="stack">
        <div class="upload-box" style="text-align:left;">
          <h3>Email du client</h3>
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
        <button class="btn btn-primary" id="inlineValidateCreditsBtn" type="button">Ajouter les crédits</button>
        <p class="warning hidden" id="inlineAdminMessage"></p>
      </div>
    `;

    const accountCard = Array.from(document.querySelectorAll(".card")).find(card => card.textContent.includes("Compte"));
    if (accountCard) accountCard.insertAdjacentElement("afterend", panel);
    else document.querySelector(".app")?.appendChild(panel);

    $("refreshPurchasesBtn")?.addEventListener("click", loadPendingPurchases);

    $("pendingPurchasesList")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-purchase-action]");
      if (button) handlePurchaseAction(button);
    });

    $("inlineFindClientBtn")?.addEventListener("click", async () => {
      hideAdminMessage();
      try {
        const email = String($("inlineClientEmail")?.value || "").trim().toLowerCase();
        if (!email) throw new Error("Entre l’email du client.");
        const data = await adminRequest("/admin/find-user", {
          method: "POST",
          body: { userEmail: email }
        });
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
        const ok = confirm(`Ajouter les crédits à ${email} ?`);
        if (!ok) return;
        const data = await adminRequest("/admin/add-credits", {
          method: "POST",
          body: { userEmail: email, pack }
        });
        showAdminMessage(`Crédits ajoutés : ${data.label}. Nova ${data.syncupSecondsBalance}s • Astra ${data.premiumSecondsBalance}s`);
      } catch (error) {
        showAdminMessage(error.message, true);
      }
    });
  }

  let wasVisible = false;
  function updatePanelVisibility() {
    buildAdminPanel();
    const panel = $("inlineAdminPanel");
    if (!panel) return;
    const visible = isAdminVisible();
    if (visible) panel.classList.remove("hidden");
    else panel.classList.add("hidden");

    if (visible && !wasVisible) loadPendingPurchases();
    wasVisible = visible;
  }

  window.addEventListener("load", () => {
    updatePanelVisibility();
    setInterval(updatePanelVisibility, 700);
    setInterval(() => {
      if (isAdminVisible()) loadPendingPurchases();
    }, 30000);
  });
})();

(() => {
  function installOfferShortcut() {
    if (document.getElementById("sync30OfferShortcut")) return;
    const topbar = document.querySelector(".topbar");
    if (!topbar) return;

    const box = document.createElement("div");
    box.id = "sync30OfferShortcut";
    box.className = "card";
    box.style.cssText = "border:1px solid #9cff4f;box-shadow:0 0 0 1px rgba(156,255,79,.18) inset;";
    box.innerHTML = `
      <div class="pill">Offres Sync30</div>
      <h2 class="title">Crée ton lipsync IA dès 2,19 €</h2>
      <p class="sub">Nova 30 s • Astra 30 s • Pack Créateur. Paiement sécurisé Revolut.</p>
      <a class="btn btn-primary" href="/sync30/offre.html">Voir les packs et acheter</a>
    `;
    topbar.insertAdjacentElement("afterend", box);
  }

  window.addEventListener("load", installOfferShortcut);
})();
