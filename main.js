```javascript
/*
==================================================
    PRIVATESPACE
    MAIN HOMEPAGE
==================================================
*/

import { supabase } from "./supabase.js";


// ================================================
// 1. GET PAGE ELEMENTS
// ================================================

const authLoading = document.getElementById("authLoading");
const protectedContent = document.getElementById("protectedContent");

const memberGreeting = document.getElementById("memberGreeting");
const logoutButton = document.getElementById("logoutButton");


// ================================================
// 2. SHOW LOADING MESSAGE
// ================================================

function showLoadingMessage(message) {
    const loadingText = authLoading?.querySelector("p");

    if (loadingText) {
        loadingText.textContent = message;
    }

    authLoading.hidden = false;
    protectedContent.hidden = true;
}


// ================================================
// 3. CHECK MEMBER APPROVAL
// ================================================

async function checkMemberApproval(userId) {

    const { data: profile, error } = await supabase
        .from("profiles")
        .select("display_name, approval_status")
        .eq("id", userId)
        .maybeSingle();

    if (error) {
        throw error;
    }

    if (!profile) {
        throw new Error("Your member profile could not be found.");
    }

    return profile;
}


// ================================================
// 4. LOAD HOMEPAGE
// ================================================

async function checkLogin() {

    showLoadingMessage("Preparing PrivateSpace...");

    try {

        // Check current login session
        const { data, error } = await supabase.auth.getSession();

        if (error) {
            throw error;
        }

        // If nobody is logged in, open login page
        if (!data.session) {

            window.location.replace("./login.html");
            return;
        }

        const user = data.session.user;

        // Get member profile and approval status
        const profile = await checkMemberApproval(user.id);


        // Check approval
        if (profile.approval_status !== "approved") {

            await supabase.auth.signOut();

            window.location.replace("./login.html");
            return;
        }


        // Get member name
        const name = profile.display_name?.trim() || "Member";


        // Show personal welcome message
        if (memberGreeting) {

            memberGreeting.textContent =
                `Welcome, ${name}. We're glad you're here.`;

        }


        // Display homepage
        authLoading.hidden = true;
        protectedContent.hidden = false;

    } catch (error) {

        console.error("Homepage loading error:", error);

        showLoadingMessage(
            "Unable to load your account. Please refresh the page."
        );

    }

}


// ================================================
// 5. SIGN OUT
// ================================================

async function signOutMember() {

    if (!logoutButton) {
        return;
    }

    logoutButton.disabled = true;
    logoutButton.textContent = "Signing out...";

    try {

        const { error } = await supabase.auth.signOut();

        if (error) {
            throw error;
        }

        // Return to login page
        window.location.replace("./login.html");

    } catch (error) {

        console.error("Sign-out error:", error);

        alert("Unable to sign out. Please try again.");

        logoutButton.disabled = false;
        logoutButton.textContent = "Sign out";

    }

}


// ================================================
// 6. CONNECT BUTTON
// ================================================

if (logoutButton) {

    logoutButton.addEventListener("click", signOutMember);

}


// ================================================
// 7. START HOMEPAGE
// ================================================

checkLogin();
```
