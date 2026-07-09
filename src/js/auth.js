let _accessToken = null;
let _tokenClient = null;
const STORAGE_KEY = "ht_auth";

function saveAuth(tokenResponse, userInfo) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    access_token: tokenResponse.access_token,
    expires_at: Date.now() + tokenResponse.expires_in * 1000,
    user: userInfo,
  }));
}

function loadStoredAuth() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; }
}

function clearAuth() {
  localStorage.removeItem(STORAGE_KEY);
}

async function onTokenReceived(tokenResponse, onReady) {
  _accessToken = tokenResponse.access_token;

  const userResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${_accessToken}` },
  });
  const userInfo = await userResponse.json();

  saveAuth(tokenResponse, userInfo);

  if (!CONFIG.ALLOWED_EMAILS.includes(userInfo.email)) {
    clearAuth();
    window.location.href = `401.html?email=${encodeURIComponent(userInfo.email)}`;
    return;
  }

  document.getElementById("authOverlay").classList.replace("d-flex", "d-none");
  document.getElementById("mainContent").classList.remove("d-none");
  onReady();
}

function login(onReady) {
  const stored = loadStoredAuth();
  if (stored && stored.expires_at - Date.now() > 60_000) {
    _accessToken = stored.access_token;
    document.getElementById("authOverlay").classList.replace("d-flex", "d-none");
    document.getElementById("mainContent").classList.remove("d-none");
    onReady();
    return;
  }

  const waitForGIS = () => {
    if (typeof google === "undefined" || !google.accounts) {
      setTimeout(waitForGIS, 100);
      return;
    }

    _tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CONFIG.GOOGLE_CLIENT_ID,
      scope: "https://www.googleapis.com/auth/spreadsheets email profile",
      callback: async (tokenResponse) => {
        if (tokenResponse.error) {
          console.error("Auth error:", tokenResponse.error);
          alert(`Sign-in failed: ${tokenResponse.error}`);
          return;
        }
        try {
          await onTokenReceived(tokenResponse, onReady);
        } catch (authError) {
          console.error("Failed to verify email:", authError);
          alert("Authentication failed. Please try again.");
        }
      },
    });

    document.getElementById("signInBtn").onclick = () => {
      _tokenClient.requestAccessToken({ prompt: "select_account" });
    };

    _tokenClient.requestAccessToken({ prompt: "" });
  };

  waitForGIS();
}

function logout() {
  clearAuth();
  _accessToken = null;
  window.location.reload();
}

function getUser() {
  return loadStoredAuth()?.user || null;
}

function getAccessToken() {
  return _accessToken;
}

window.auth = { login, logout, getUser, getAccessToken };
