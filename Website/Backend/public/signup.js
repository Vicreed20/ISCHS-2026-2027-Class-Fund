const $ = id => document.getElementById(id);
        const form = $("signup-form");
        const first = $("first-name");
        const last = $("last-name");
        const email = $("email");
        const password = $("password");
        const confirmPw = $("confirm");
        const button = $("signup-button");
        const message = $("form-message");
        const fill = $("strength-fill");
        const strengthText = $("strength-text");

        // ---------- Show / hide password (works for both fields) ----------
        document.querySelectorAll(".toggle-password").forEach(btn => {
            btn.addEventListener("click", () => {
                const input = $(btn.dataset.target);
                const hidden = input.type === "password";
                input.type = hidden ? "text" : "password";
                btn.textContent = hidden ? "Hide" : "Show";
                btn.setAttribute("aria-label", hidden ? "Hide password" : "Show password");
            });
        });

        // ---------- Password rules ----------
        const rules = {
            length:  v => v.length >= 8 && v.length <= 25,
            upper:   v => /[A-Z]/.test(v),
            lower:   v => /[a-z]/.test(v),
            number:  v => /[0-9]/.test(v),
            special: v => /[^A-Za-z0-9]/.test(v)
        };

        const levels = [
            { text: "Enter a password", color: "transparent" },
            { text: "Very weak",        color: "#EF4444" },
            { text: "Weak",             color: "#F97316" },
            { text: "Okay",             color: "#F59E0B" },
            { text: "Strong",           color: "#84CC16" },
            { text: "Excellent!",       color: "#22C55E" }
        ];

        function checkPassword() {
            const value = password.value;
            let passed = 0;

            document.querySelectorAll("#rules li").forEach(li => {
                const ok = rules[li.dataset.rule](value);
                li.classList.toggle("met", ok);
                if (ok) passed++;
            });

            const level = value ? Math.max(1, passed) : 0;
            fill.style.width = (level / 5) * 100 + "%";
            fill.style.backgroundColor = levels[level].color;
            strengthText.textContent = levels[level].text;
            return passed === 5;
        }
        password.addEventListener("input", checkPassword);

        // ---------- Messages + shake ----------
        function showMessage(text, type) {
            message.textContent = text;
            message.className = "form-message " + type;
        }

        function fail(text, field) {
            showMessage(text, "error");
            form.classList.remove("shake");
            void form.offsetWidth;          // restart the animation
            form.classList.add("shake");
            field.focus();
        }

        // ---------- Submit (front-end only for now) ----------
form.addEventListener("submit", async e => {
    e.preventDefault();

    if (!first.value.trim()) return fail("Please enter your first name.", first);
    if (!last.value.trim()) return fail("Please enter your last name.", last);
    if (!email.value.trim() || !email.checkValidity())
        return fail("Please enter a valid email address.", email);
    if (!checkPassword())
        return fail("Your password doesn't meet all the requirements yet.", password);
    if (password.value !== confirmPw.value)
        return fail("Passwords don't match.", confirmPw);

    button.classList.add("loading");
    button.disabled = true;
    showMessage("", "");

    try {
        const res = await fetch("/api/auth/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                firstName: first.value.trim(),
                lastName: last.value.trim(),
                email: email.value.trim(),
                password: password.value
            })
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "Could not create your account.");

        showMessage("Account created! Redirecting...", "success");
        setTimeout(() => { location.href = "/Index.html"; }, 800);
    } catch (err) {
        button.classList.remove("loading");
        button.disabled = false;
        fail(err.message === "Failed to fetch" ? "Can't reach the server. Is it running?" : err.message, email);
    }
});