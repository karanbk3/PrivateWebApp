
/*
   PRIVATESPACE
   SIGN IN + CREATE ACCOUNT
*/

import { supabase } from "./supabase.js";

// Sign-in elements
const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginButton = document.getElementById("loginButton");
const loginMessage = document.getElementById("loginMessage");

// Sign-up elements
const signupForm = document.getElementById("signupForm");
const signupName = document.getElementById("signupName");
const signupEmail = document.getElementById("signupEmail");
const signupPassword = document.getElementById("signupPassword");
const signupButton = document.getElementById("signupButton");
const signupMessage = document.getElementById("signupMessage");

// Form switch elements
const switchAuthButton = document.getElementById("switchAuthButton");
const switchText = document.getElementById("switchText");
const pageTitle = document.getElementById("pageTitle");
const pageSubtitle = document.getElementById("pageSubtitle");

let currentMode = "login";

// Display messages
function showMessage(element, message, type = "error") {
    element.textContent = message;
    element.className = `login-message ${type}`;
}

// Switch between sign-in and sign-up
function switchMode() {
    const creatingAccount = currentMode === "login";

    currentMode = creatingAccount ? "signup" : "login";

    loginForm.hidden = creatingAccount;
    signupForm.hidden = !creatingAccount;

    loginMessage.textContent = "";
    signupMessage.textContent = "";

    if (creatingAccount) {
        pageTitle.innerHTML = 'Join <span>PrivateSpace.</span>';

        pageSubtitle.textContent =
            "Create your account and request access to our community.";

        switchText.textContent = "Already a member?";
        switchAuthButton.textContent = "Sign in";

    } else {
        pageTitle.innerHTML = 'Welcome <span>back.</span>';

        pageSubtitle.textContent =
            "Sign in to enter your private space. Your conversations belong here.";

        switchText.textContent = "New to PrivateSpace?";
        switchAuthButton.textContent = "Create an account";
    }
}

switchAuthButton.addEventListener("click", switchMode);

// =====================================
// SIGN IN
// =====================================

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
        showMessage(loginMessage, "Please enter your email and password.");
        return;
    }

    loginButton.disabled = true;
    loginButton.querySelector("span").textContent = "Please wait...";

    showMessage(loginMessage, "");

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        if (!data.user) {
            throw new Error("Login could not be completed.");
        }

        // Check administrator approval
        const { data: profile, error: profileError } =
            await supabase
                .from("profiles")
                .select("approval_status")
                .eq("id", data.user.id)
                .single();

        if (profileError) throw profileError;

        if (profile.approval_status !== "approved") {

            await supabase.auth.signOut();

            if (profile.approval_status === "rejected") {
                showMessage(
                    loginMessage,
                    "Your access request was not approved. Please contact the administrator."
                );
            } else {
                showMessage(
                    loginMessage,
                    "Your account is waiting for administrator approval. Please try again later.",
                    "success"
                );
            }

            return;
        }

        showMessage(
            loginMessage,
            "Welcome! Opening your private space...",
            "success"
        );

        window.location.replace("./main.html");

    } catch (error) {
        console.error("Login error:", error);

        const message = (error.message || "").toLowerCase();

        if (message.includes("email not confirmed")) {
            showMessage(loginMessage, "Please confirm your email first.");

        } else if (message.includes("invalid login")) {
            showMessage(loginMessage, "Incorrect email or password.");

        } else {
            showMessage(
                loginMessage,
                "We couldn't sign you in. Please try again."
            );
        }

    } finally {
        loginButton.disabled = false;
        loginButton.querySelector("span").textContent = "Enter your space";
    }
});

// =====================================
// CREATE ACCOUNT / REQUEST ACCESS
// =====================================

signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = signupName.value.trim();
    const email = signupEmail.value.trim();
    const password = signupPassword.value;

    if (!name || !email || !password) {
        showMessage(signupMessage, "Please complete all fields.");
        return;
    }

    if (name.length < 2) {
        showMessage(
            signupMessage,
            "Please enter a name with at least 2 characters."
        );
        return;
    }

    if (password.length < 8) {
        showMessage(
            signupMessage,
            "Your password must be at least 8 characters."
        );
        return;
    }

    signupButton.disabled = true;
    signupButton.querySelector("span").textContent = "Creating account...";

    showMessage(signupMessage, "");

    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    display_name: name
                },
                emailRedirectTo:
                    window.location.origin + window.location.pathname
            }
        });

        if (error) throw error;

        if (!data.user) {
            throw new Error("Your account could not be created.");
        }

        // Sign out if Supabase created a session.
        if (data.session) {
            const { error: signOutError } =
                await supabase.auth.signOut();

            if (signOutError) throw signOutError;
        }

        showMessage(
            signupMessage,
            data.session
                ? "Your account has been created. Your request is waiting for administrator approval."
                : "Account created! Please check your email to confirm your address. Administrator approval is also required.",
            "success"
        );

        signupForm.reset();

    } catch (error) {
        console.error("Registration error:", error);

        const message = (error.message || "").toLowerCase();

        if (
            message.includes("already registered") ||
            message.includes("already exists")
        ) {
            showMessage(
                signupMessage,
                "This email may already have an account. Try signing in."
            );

        } else {
            showMessage(
                signupMessage,
                "We couldn't create your account. Please try again."
            );
        }

    } finally {
        signupButton.disabled = false;
        signupButton.querySelector("span").textContent = "Request access";
    }
});
