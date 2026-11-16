```javascript
/*
==================================================
PRIVATESPACE
SIGN IN + CREATE ACCOUNT
==================================================
*/

import { supabase } from "./supabase.js";


// ================================================
// 1. GET HTML ELEMENTS
// ================================================

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


// ================================================
// 2. CHECK REQUIRED ELEMENTS
// ================================================

const requiredElements = [
    loginForm,
    emailInput,
    passwordInput,
    loginButton,
    loginMessage,
    signupForm,
    signupName,
    signupEmail,
    signupPassword,
    signupButton,
    signupMessage,
    switchAuthButton,
    switchText,
    pageTitle,
    pageSubtitle
];

if (requiredElements.some(element => !element)) {
    console.error(
        "PrivateSpace error: One or more required HTML elements are missing."
    );
    throw new Error("The account page could not be initialized.");
}


// ================================================
// 3. PAGE SETTINGS
// ================================================

let currentMode = "login";

const LOGIN_BUTTON_TEXT = "Enter your space";
const SIGNUP_BUTTON_TEXT = "Request access";


// ================================================
// 4. MESSAGE HELPER
// ================================================

function showMessage(element, message, type = "error") {

    element.textContent = message;

    element.className = "login-message";

    if (type === "success") {
        element.classList.add("success");
    }
}


// ================================================
// 5. BUTTON LOADING HELPER
// ================================================

function setButtonLoading(button, loading, message, normalText) {

    button.disabled = loading;

    const text = button.querySelector("span");

    if (text) {
        text.textContent = loading ? message : normalText;
    }
}


// ================================================
// 6. SWITCH BETWEEN SIGN IN AND SIGN UP
// ================================================

function switchMode() {

    const creatingAccount = currentMode === "login";

    currentMode = creatingAccount ? "signup" : "login";

    // Show the correct form
    loginForm.hidden = creatingAccount;
    signupForm.hidden = !creatingAccount;

    // Clear previous messages
    showMessage(loginMessage, "");
    showMessage(signupMessage, "");

    if (creatingAccount) {

        pageTitle.innerHTML = 'Join <span>PrivateSpace.</span>';

        pageSubtitle.textContent =
            "Create your account and request access to our community.";

        switchText.textContent = "Already have an account?";

        switchAuthButton.textContent = "Sign in";

    } else {

        pageTitle.innerHTML = 'Welcome <span>back.</span>';

        pageSubtitle.textContent =
            "Sign in to enter your private space. Your conversations belong here.";

        switchText.textContent = "New to PrivateSpace?";

        switchAuthButton.textContent = "Create an account";
    }

    // Clear passwords when changing forms
    passwordInput.value = "";
    signupPassword.value = "";
}

switchAuthButton.addEventListener("click", switchMode);


// ================================================
// 7. CHECK MEMBER APPROVAL
// ================================================

async function checkMemberApproval(userId) {

    const { data: profile, error } = await supabase
        .from("profiles")
        .select("approval_status")
        .eq("id", userId)
        .maybeSingle();

    if (error) {
        console.error("Profile check error:", error);
        throw new Error("We couldn't verify your account permissions.");
    }

    if (!profile) {
        throw new Error(
            "Your account profile has not been created. Please contact the administrator."
        );
    }

    return profile.approval_status;
}


// ================================================
// 8. SIGN IN
// ================================================

loginForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    // Validate fields
    if (!email || !password) {

        showMessage(
            loginMessage,
            "Please enter your email address and password."
        );

        return;
    }

    // Start loading
    setButtonLoading(
        loginButton,
        true,
        "Please wait...",
        LOGIN_BUTTON_TEXT
    );

    showMessage(loginMessage, "");

    let signedIn = false;

    try {

        // Authenticate with Supabase
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            throw error;
        }

        if (!data.user) {
            throw new Error("Login could not be completed.");
        }

        signedIn = true;

        // Check approval status
        const approvalStatus = await checkMemberApproval(data.user.id);

        // Reject accounts that are not approved
        if (approvalStatus !== "approved") {

            await supabase.auth.signOut();

            signedIn = false;

            if (approvalStatus === "rejected") {

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

        // Approved member
        showMessage(
            loginMessage,
            "Welcome! Opening your private space...",
            "success"
        );

        // Open dashboard
        window.location.replace("./main.html");

    } catch (error) {

        console.error("Login error:", error);

        // Sign out if verification failed after authentication
        if (signedIn) {

            const { error: signOutError } =
                await supabase.auth.signOut();

            if (signOutError) {
                console.error("Sign-out error:", signOutError);
            }
        }

        const message = (error.message || "").toLowerCase();

        if (message.includes("email not confirmed")) {

            showMessage(
                loginMessage,
                "Please confirm your email address before signing in."
            );

        } else if (
            message.includes("invalid login") ||
            message.includes("invalid credentials")
        ) {

            showMessage(
                loginMessage,
                "Incorrect email address or password."
            );

        } else if (message.includes("profile")) {

            showMessage(
                loginMessage,
                error.message
            );

        } else {

            showMessage(
                loginMessage,
                "We couldn't sign you in. Please try again."
            );
        }

    } finally {

        setButtonLoading(
            loginButton,
            false,
            "",
            LOGIN_BUTTON_TEXT
        );
    }

});


// ================================================
// 9. CREATE ACCOUNT / REQUEST ACCESS
// ================================================

signupForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    const name = signupName.value.trim();
    const email = signupEmail.value.trim();
    const password = signupPassword.value;

    // Validate name
    if (name.length < 2) {

        showMessage(
            signupMessage,
            "Please enter a name with at least 2 characters."
        );

        return;
    }

    // Validate email
    if (!email) {

        showMessage(
            signupMessage,
            "Please enter your email address."
        );

        return;
    }

    // Validate password
    if (password.length < 8) {

        showMessage(
            signupMessage,
            "Your password must contain at least 8 characters."
        );

        return;
    }

    // Start loading
    setButtonLoading(
        signupButton,
        true,
        "Creating account...",
        SIGNUP_BUTTON_TEXT
    );

    showMessage(signupMessage, "");

    try {

        // Create Supabase account
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

        if (error) {
            throw error;
        }

        if (!data.user) {
            throw new Error("Your account could not be created.");
        }

        // If Supabase automatically signs the user in,
        // immediately sign them out until approval.
        if (data.session) {

            const { error: signOutError } =
                await supabase.auth.signOut();

            if (signOutError) {
                throw signOutError;
            }
        }

        // Show confirmation message
        if (data.session) {

            showMessage(
                signupMessage,
                "Your account has been created. Your access request is waiting for administrator approval.",
                "success"
            );

        } else {

            showMessage(
                signupMessage,
                "Your account has been created. Please check your email to confirm your address. Administrator approval is also required.",
                "success"
            );
        }

        // Clear the form
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

        } else if (message.includes("password")) {

            showMessage(
                signupMessage,
                "Please use a valid password with at least 8 characters."
            );

        } else {

            showMessage(
                signupMessage,
                "We couldn't create your account. Please try again."
            );
        }

    } finally {

        setButtonLoading(
            signupButton,
            false,
            "",
            SIGNUP_BUTTON_TEXT
        );
    }

});


// ================================================
// 10. INITIAL PAGE STATE
// ================================================

loginForm.hidden = false;
signupForm.hidden = true;

console.log("PrivateSpace account page initialized.");
```
