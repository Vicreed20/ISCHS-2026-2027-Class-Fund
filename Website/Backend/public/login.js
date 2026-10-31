
        const form = document.getElementById("login-form");
        const email = document.getElementById("email");
        const password = document.getElementById("password");
        const toggle = document.getElementById("toggle-password");
        const button = document.getElementById("login-button");
        const message = document.getElementById("form-message");

        // Show / hide password
        toggle.addEventListener("click", () => {
            const hidden = password.type === "password";
            password.type = hidden ? "text" : "password";
            toggle.textContent = hidden ? "Hide" : "Show";
            toggle.setAttribute("aria-label", hidden ? "Hide password" : "Show password");
        });

        function showMessage(text, type) {
            message.textContent = text;
            message.className = "form-message " + type;
        }

        function shake() {
            form.classList.remove("shake");
            void form.offsetWidth;            // restart the animation
            form.classList.add("shake");
        }

        // Front-end only for now: validates, then fakes a loading state
        form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!email.checkValidity() || !email.value.trim()) {
        showMessage("Please enter a valid email address.", "error");
        shake();
        email.focus();
        return;
    }
    if (!password.value) {
        showMessage("Please enter your password.", "error");
        shake();
        password.focus();
        return;
    }

    button.classList.add("loading");
    button.disabled = true;
    showMessage("", "");

    try {
        const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: email.value.trim(), password: password.value })
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "Login failed. Please try again.");

        showMessage("Welcome back! Redirecting...", "success");
        setTimeout(() => {
            location.href = body.user.role === "admin" ? "/admin.html" : "/Index.html";
        }, 600);
    } catch (err) {
        button.classList.remove("loading");
        button.disabled = false;
        showMessage(err.message === "Failed to fetch" ? "Can't reach the server. Is it running?" : err.message, "error");
        shake();
    }
});