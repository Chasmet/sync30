(() => {
  const ADMIN_EMAIL = "skypieachannel@gmail.com";
  const API = "https://sync30-paddle-api.onrender.com";
  const CHECKOUTS = {
    nova: "https://checkout.revolut.com/pay/b6ca579f-e0de-4f03-9b3d-98c50839486f",
    astra: "https://checkout.revolut.com/pay/a068d6d7-0b65-47f7-bdf4-ce953458eab6",
    creator: "https://checkout.revolut.com/pay/78516714-39a6-4e2a-bef8-675ab3affa39"
  };
  const $ = (id) => document.getElementById(id);

  function authEmail() {
    if (typeof currentUser !== "undefined" && currentUser?.email) return String(currentUser.email).trim().toLowerCase();
    return String($("authStatusText")?.textContent || "").replace(/^Connecté\s*:/i, "").trim().toLowerCase();
  }

  function isAdmin() {
    return authEmail() === ADMIN_EMAIL || String($("modeLabel")?.textContent || "").toLowerCase().includes("admin");
  }

  async function sessionToken() {
    try {
      if (typeof supabaseClient !== "undefined" && supabaseClient?.auth?.getSession) {
        const { data } = await supabaseClient.auth.getSession();
        return data?.session?.access_token || "";
      }
    } catch {}
    return "";
  }

  async function api(path, { method = "GET", body, admin = false } = {}) {
    const headers = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (admin) {
      const token = await sessionToken();
      if (!token) throw new Error("Connecte-toi avec le compte administrateur.");
      headers.Authorization = `Bearer ${token}`;
    }
    const response = await fetch(`${API}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || "Erreur serveur Sync30");
    return data;
  }

  // Tous les achats lancés depuis l'application passent d'abord par Supabase.
  document.addEventListener("click", async (event) => {
    const button = event.target.closest(".buy-btn[data-pack]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const pack = String(button.dataset.pack || "").toLowerCase();
    const email = authEmail();
    if (!CHECKOUTS[pack]) return;
    if (!email || email.includes("mode test public") || !email.includes("@")) {
      alert("Connecte-toi d’abord à ton compte Sync30 avant d’acheter.");
      return;
    }

    const old = button.textContent;
    button.disabled = true;
    button.textContent = "Préparation…";
    try {
      await api("/purchase-request", {
        method: "POST",
        body: { userEmail: email, pack, source: "application_sync30" }
      });
      window.open(CHECKOUTS[pack], "_blank", "noopener,noreferrer");
      alert("Demande enregistrée. Termine le paiement Revolut ; l’admin vérifiera puis validera tes crédits.");
    } catch (error) {
      alert(error.message || String(error));
    } finally {
      button.disabled = false;
      button.textContent = old;
    }
  }, true);

  function message(text, error = false) {
    const box = $("adminQueueMessage");
    if (!box) return;
    box.textContent = text;
    box.style.color = error ? "#ff9aa2" : "#9cff4f";
  }

  function label(pack) {
    if (pack === "nova") return "Nova — 2,19 €";
    if (pack === "astra") return "Astra — 4,19 €";
    if (pack === "creator") return "Créateur — 7,99 €";
    return pack;
  }

  function dateFR(value) {
    try { return new Date(value).toLocaleString("fr-FR"); } catch { return String(value || ""); }
  }

  function renderQueue(items) {
    const list = $("adminPurchaseQueue");
    const count = $("adminPurchaseCount");
    if (!list) return;
    if (count) count.textContent = `${items.length} en attente`;
    if (!items.length) {
      list.innerHTML = '<div class="upload-box"><h3>Aucun achat en attente</h3><p>Les nouvelles demandes apparaîtront ici.</p></div>';
      return;
    }
    list.innerHTML = items.map((p) => {
      const approve = p.pack === "creator"
        ? `<button class="btn btn-primary" data-admin-action="approve" data-id="${p.id}" data-credit="creator_nova">Valider +110 s Nova</button>
           <button class="btn btn-primary" data-admin-action="approve" data-id="${p.id}" data-credit="creator_astra">Valider +60 s Astra</button>`
        : `<button class="btn btn-primary" data-admin-action="approve" data-id="${p.id}">Valider et créditer</button>`;
      return `<div class="upload-box" style="text-align:left">
        <h3>${label(p.pack)}</h3>
        <p><strong>${p.user_email}</strong><br>${dateFR(p.created_at)}</p>
        <div class="stack">${approve}<button class="btn btn-secondary" data-admin-action="reject" data-id="${p.id}">Rejeter</button></div>
      </div>`;
    }).join("");
  }

  async function refreshQueue() {
    if (!isAdmin()) return;
    try {
      const data = await api("/admin/purchase-requests", { admin: true });
      renderQueue(data.requests || []);
    } catch (error) {
      message(error.message || String(error), true);
    }
  }

  async function action(button) {
    const id = button.dataset.id;
    const kind = button.dataset.adminAction;
    if (!id) return;
    button.disabled = true;
    try {
      if (kind === "approve") {
        if (!confirm("Paiement vérifié dans Revolut Pro ? Valider les crédits ?")) return;
        const data = await api("/admin/approve-purchase", {
          method: "POST", admin: true,
          body: { requestId: id, approvedPack: button.dataset.credit || "" }
        });
        message(`Validé : ${data.label} • Nova ${data.syncupSecondsBalance}s • Astra ${data.premiumSecondsBalance}s`);
      } else {
        if (!confirm("Rejeter cette demande ?")) return;
        await api("/admin/reject-purchase", { method: "POST", admin: true, body: { requestId: id } });
        message("Demande rejetée.");
      }
      await refreshQueue();
    } catch (error) {
      message(error.message || String(error), true);
    } finally {
      button.disabled = false;
    }
  }

  function buildAdmin() {
    if ($("sync30AdminQueue")) return;
    const card = document.createElement("div");
    card.id = "sync30AdminQueue";
    card.className = "card hidden";
    card.innerHTML = `
      <div class="pill">ADMIN SYNC30</div>
      <h2 class="title">Achats à autoriser</h2>
      <p class="sub">Vérifie le paiement dans Revolut Pro, puis valide ici. Les crédits sont écrits dans Supabase.</p>
      <div class="status-row" style="grid-template-columns:1fr auto;align-items:center">
        <div class="mini-box"><div class="label">File</div><div class="value" id="adminPurchaseCount">—</div></div>
        <button class="btn btn-secondary" id="adminRefreshPurchases" style="width:auto">Actualiser</button>
      </div>
      <div id="adminPurchaseQueue" class="stack" style="margin-top:14px"></div>
      <p id="adminQueueMessage" class="hint"></p>
      <details class="info-collapse" style="margin-top:16px">
        <summary class="info-summary">Ajout manuel de secours</summary>
        <div class="info-content stack">
          <input id="adminManualEmail" type="email" placeholder="client@email.com" style="width:100%;min-height:52px;border-radius:15px;padding:12px;background:#07101f;color:#fff;border:1px solid rgba(255,255,255,.2)">
          <select id="adminManualPack" class="engine-select"><option value="nova">Nova +30 s</option><option value="astra">Astra +30 s</option><option value="creator_nova">Créateur +110 s Nova</option><option value="creator_astra">Créateur +60 s Astra</option></select>
          <button class="btn btn-primary" id="adminManualCredit">Ajouter les crédits</button>
        </div>
      </details>`;
    const account = Array.from(document.querySelectorAll(".card")).find((c) => c.textContent.includes("Compte"));
    if (account) account.insertAdjacentElement("afterend", card);
    else document.querySelector(".app")?.prepend(card);

    $("adminRefreshPurchases")?.addEventListener("click", refreshQueue);
    $("adminPurchaseQueue")?.addEventListener("click", (e) => {
      const b = e.target.closest("[data-admin-action]");
      if (b) action(b);
    });
    $("adminManualCredit")?.addEventListener("click", async () => {
      try {
        const email = String($("adminManualEmail")?.value || "").trim().toLowerCase();
        const pack = $("adminManualPack")?.value;
        if (!email) throw new Error("Email client manquant");
        const data = await api("/admin/add-credits", { method: "POST", admin: true, body: { userEmail: email, pack } });
        message(`Crédits ajoutés : ${data.label}`);
      } catch (error) { message(error.message || String(error), true); }
    });
  }

  function installOfferShortcut() {
    if ($("sync30OfferShortcut")) return;
    const topbar = document.querySelector(".topbar");
    if (!topbar) return;
    const box = document.createElement("div");
    box.id = "sync30OfferShortcut";
    box.className = "card";
    box.innerHTML = '<div class="pill">Offres Sync30</div><h2 class="title">Lipsync IA dès 2,19 €</h2><p class="sub">Nova • Astra • Créateur — paiement Revolut.</p><a class="btn btn-primary" href="/sync30/offre.html">Voir les packs</a>';
    topbar.insertAdjacentElement("afterend", box);
  }

  let shown = false;
  function syncAdminVisibility() {
    buildAdmin();
    const card = $("sync30AdminQueue");
    if (!card) return;
    const yes = isAdmin();
    card.classList.toggle("hidden", !yes);
    if (yes && !shown) refreshQueue();
    shown = yes;
  }

  window.addEventListener("load", () => {
    installOfferShortcut();
    syncAdminVisibility();
    setInterval(syncAdminVisibility, 800);
    setInterval(() => { if (isAdmin()) refreshQueue(); }, 30000);
  });
})();
