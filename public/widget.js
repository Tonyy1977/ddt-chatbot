(function () {
  const CHAT_URL = "https://ddt-chatbot-gy6g.vercel.app";

  // --- Avatar Toggle iframe ---
  const avatarIframe = document.createElement("iframe");
  avatarIframe.src = `${CHAT_URL}/?mode=toggle`;
  avatarIframe.style.position = "fixed";
  avatarIframe.style.bottom = "0px";
  avatarIframe.style.right = "0px";
  avatarIframe.style.width = "320px";
  avatarIframe.style.height = "150px";
  avatarIframe.style.border = "none";
  avatarIframe.style.zIndex = "2147483646"; // right below chat
  avatarIframe.style.background = "transparent";
  avatarIframe.style.pointerEvents = "auto";
  avatarIframe.allowTransparency = "true";
  avatarIframe.setAttribute("frameborder", "0");
  avatarIframe.setAttribute("scrolling", "no");
  avatarIframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-popups");
  avatarIframe.setAttribute("referrerpolicy", "no-referrer");
  document.body.appendChild(avatarIframe);

  // --- Chat Box iframe ---
  const chatIframe = document.createElement("iframe");
  chatIframe.src = `${CHAT_URL}/?mode=chat`;
  chatIframe.style.position = "fixed";
  chatIframe.style.bottom = "40px";  // push up
  chatIframe.style.right = "20px";   // push left
  chatIframe.style.width = "350px";
  chatIframe.style.height = "500px";
  chatIframe.style.border = "none";
  chatIframe.style.zIndex = "2147483647"; // top layer
  chatIframe.style.borderRadius = "20px";
  chatIframe.style.display = "none";
  chatIframe.style.background = "none"; // force clean background
  chatIframe.style.overflow = "auto";
  chatIframe.style.isolation = "isolate";
  chatIframe.allowTransparency = "true";
  chatIframe.setAttribute("frameborder", "0");
  chatIframe.setAttribute("scrolling", "yes");
  chatIframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-popups");
  chatIframe.setAttribute("referrerpolicy", "no-referrer");
  document.body.appendChild(chatIframe);

  // --- Function: Resize Chat for Mobile/Desktop ---
  function resizeChat() {
    if (window.innerWidth <= 768) {
      chatIframe.style.width = "100vw";
      chatIframe.style.height = "100vh";
      chatIframe.style.borderRadius = "0";
      chatIframe.style.top = "0";
      chatIframe.style.left = "0";
      chatIframe.style.right = "0";
      chatIframe.style.bottom = "0";
    } else {
      chatIframe.style.width = "350px";
      chatIframe.style.height = "500px";
      chatIframe.style.bottom = "40px";  // push up
      chatIframe.style.right = "20px";   // push left
      chatIframe.style.borderRadius = "20px";
      chatIframe.style.left = "auto";
      chatIframe.style.top = "auto";
    }
  }

  // Run on load + resize
  resizeChat();
  window.addEventListener("resize", resizeChat);

  // --- Listener: toggle and close logic ---
  window.addEventListener("message", (event) => {
    if (event.data === "toggle-chat") {
  const isOpen = chatIframe.style.display === "block";

  if (isOpen) {
    // ✅ Closing chat
    chatIframe.style.display = "none";
    avatarIframe.style.display = "block";
    document.body.style.overflow = "auto"; // unlock scroll on close
  } else {
    // ✅ Opening chat
    chatIframe.style.display = "block";
    avatarIframe.style.display = "none";
    resizeChat();

    // ✅ Lock scroll ONLY on mobile full-screen
    if (window.innerWidth <= 768) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto"; // desktop stays scrollable
    }
  }
}

if (event.data === "close-chat") {
  // ✅ Always reset scroll when user closes chat
  chatIframe.style.display = "none";
  avatarIframe.style.display = "block";
  document.body.style.overflow = "auto";
}
  });
})();
