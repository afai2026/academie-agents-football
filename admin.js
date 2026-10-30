const loginForm = document.querySelector("#admin-login-form");
const tokenInput = document.querySelector("#admin-token");
const statusMessage = document.querySelector("#admin-status");
const requestsSection = document.querySelector("#admin-requests");
const requestList = document.querySelector("#request-list");
const logoutButton = document.querySelector("#admin-logout");
const refreshButton = document.querySelector("#admin-refresh");

let adminToken = "";

function showStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle("is-error", isError);
  statusMessage.classList.toggle("is-success", !isError && Boolean(message));
}

async function adminFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${adminToken}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "La demande n’a pas pu être traitée.");
  return result;
}

function renderRequests(requests) {
  requestList.replaceChildren();
  if (!requests.length) {
    const empty = document.createElement("p");
    empty.className = "request-empty";
    empty.textContent = "Aucune demande reçue pour le moment.";
    requestList.append(empty);
    return;
  }

  requests.forEach((request) => {
    const card = document.createElement("article");
    card.className = "request-card";

    const header = document.createElement("div");
    header.className = "request-card-header";
    const name = document.createElement("h3");
    name.textContent = request.name;
    const badge = document.createElement("span");
    badge.className = `request-status status-${request.status}`;
    badge.textContent = {
      pending: "En attente",
      approved: "Acceptée",
      rejected: "Refusée"
    }[request.status] || "À vérifier";
    header.append(name, badge);

    const details = document.createElement("div");
    details.className = "request-details";
    const email = document.createElement("a");
    email.href = `mailto:${encodeURIComponent(request.email)}`;
    email.textContent = request.email;
    const phone = document.createElement("a");
    phone.href = `tel:${encodeURIComponent(request.phone)}`;
    phone.textContent = request.phone;
    const date = document.createElement("span");
    const createdAt = new Date(request.createdAt);
    date.textContent = Number.isNaN(createdAt.getTime())
      ? "Date de réception indisponible"
      : `Reçue le ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(createdAt)}`;
    details.append(email, phone, date);
    card.append(header, details);

    const actions = document.createElement("div");
    actions.className = "request-actions";
    [
      { status: "approved", text: "Accepter" },
      { status: "rejected", text: "Refuser" },
      ...(request.status !== "pending" ? [{ status: "pending", text: "Remettre en attente" }] : [])
    ].forEach(({ status, text }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = status === "approved" ? "request-approve" : status === "rejected" ? "request-reject" : "request-pending";
      button.textContent = text;
      button.disabled = request.status === status;
      button.addEventListener("click", async () => {
        button.disabled = true;
        try {
          await adminFetch(`/api/admin/requests/${encodeURIComponent(request.id)}`, {
            method: "POST",
            body: JSON.stringify({ status })
          });
          await loadRequests();
        } catch (error) {
          showStatus(error.message || "Impossible de mettre à jour cette demande.", true);
          button.disabled = false;
        }
      });
      actions.append(button);
    });
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "request-delete";
    deleteButton.textContent = "Supprimer définitivement";
    deleteButton.addEventListener("click", async () => {
      if (!window.confirm("Supprimer définitivement cette demande et ses coordonnées ?")) return;
      deleteButton.disabled = true;
      try {
        await adminFetch(`/api/admin/requests/${encodeURIComponent(request.id)}`, { method: "DELETE" });
        await loadRequests();
        showStatus("La demande et ses coordonnées ont été supprimées.");
      } catch (error) {
        showStatus(error.message || "Impossible de supprimer cette demande.", true);
        deleteButton.disabled = false;
      }
    });
    actions.append(deleteButton);
    card.append(actions);
    requestList.append(card);
  });
}

async function loadRequests() {
  const { requests } = await adminFetch("/api/admin/requests");
  renderRequests(requests);
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  adminToken = tokenInput.value;
  tokenInput.value = "";
  showStatus("Vérification de l’accès…");
  try {
    await loadRequests();
    requestsSection.hidden = false;
    loginForm.hidden = true;
    showStatus("Accès autorisé. Les décisions sont manuelles.");
  } catch (error) {
    adminToken = "";
    requestsSection.hidden = true;
    showStatus(error.message || "Impossible d’ouvrir les demandes.", true);
    tokenInput.focus();
  }
});

logoutButton.addEventListener("click", () => {
  adminToken = "";
  requestsSection.hidden = true;
  loginForm.hidden = false;
  requestList.replaceChildren();
  showStatus("Session fermée.");
  tokenInput.focus();
});

refreshButton.addEventListener("click", async () => {
  refreshButton.disabled = true;
  try {
    await loadRequests();
    showStatus("Liste des demandes actualisée.");
  } catch (error) {
    showStatus(error.message || "Impossible d’actualiser les demandes.", true);
  } finally {
    refreshButton.disabled = false;
  }
});
