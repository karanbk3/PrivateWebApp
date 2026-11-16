
/*
==================================================
PRIVATE SPACE
USER SETTINGS
==================================================
*/

import { supabase } from "./supabase.js";

// ================================================
// 1. PAGE ELEMENTS
// ================================================

const authLoading = document.getElementById("authLoading");
const protectedContent = document.getElementById("protectedContent");

const memberName = document.getElementById("memberName");

const settingsAvatar = document.getElementById("settingsAvatar");
const settingsName = document.getElementById("settingsName");
const settingsEmail = document.getElementById("settingsEmail");

// Account settings
const accountForm = document.getElementById("accountForm");
const settingsDisplayName = document.getElementById("settingsDisplayName");
const settingsBio = document.getElementById("settingsBio");

const accountMessage = document.getElementById("accountMessage");
const saveAccountButton = document.getElementById("saveAccountButton");

// Password settings
const passwordForm = document.getElementById("passwordForm");

const currentPassword = document.getElementById("currentPassword");
const newPassword = document.getElementById("newPassword");
const confirmPassword = document.getElementById("confirmPassword");

const passwordMessage = document.getElementById("passwordMessage");
const changePasswordButton = document.getElementById("changePasswordButton");

// Privacy settings
const showLocation = document.getElementById("showLocation");
const privacyMessage = document.getElementById("privacyMessage");
const savePrivacyButton = document.getElementById("savePrivacyButton");

// Logout buttons
const logoutButton = document.getElementById("logoutButton");
const settingsLogoutButton = document.getElementById("settingsLogoutButton");

// Current user
let currentUser = null;


// ================================================
// 2. MESSAGE FUNCTION
// ================================================

function showMessage(element, message, type = "error") {

    if (!element) return;

    element.textContent = message;

    element.classList.remove("success", "error");

    if (message) {
        element.classList.add(type);
    }
}


// ================================================
// 3. BUTTON LOADING FUNCTION
// ================================================

function setButtonLoading(button, loading, loadingText, normalText) {

    if (!button) return;

    button.disabled = loading;
    button.textContent = loading ? loadingText : normalText;
}


// ================================================
// 4. SHOW SETTINGS PAGE
// ================================================

function showSettingsPage() {

    if (authLoading) {
        authLoading.hidden = true;
    }

    if (protectedContent) {
        protectedContent.hidden = false;
    }
}


// ================================================
// 5. LOGOUT
// ================================================

async function logout() {

    const buttons = [logoutButton, settingsLogoutButton];

    buttons.forEach(button => {
        if (button) {
            button.disabled = true;
            button.textContent = "Signing out...";
        }
    });

    try {

        const { error } = await supabase.auth.signOut();

        if (error) throw error;

        window.location.replace("../login.html");

    } catch (error) {

        console.error("Logout error:", error);

        alert("Unable to sign out. Please try again.");

        buttons.forEach(button => {
            if (button) {
                button.disabled = false;
                button.textContent = "Sign out";
            }
        });
    }
}


// ================================================
// 6. LOAD ACCOUNT SETTINGS
// ================================================

async function loadSettings() {

    try {

        // Check whether the member is logged in

        const { data: authData, error: authError } =
            await supabase.auth.getUser();

        if (authError) throw authError;

        if (!authData.user) {

            window.location.replace("../login.html");

            return;
        }

        currentUser = authData.user;


        // Get public profile information

        const { data: profile, error: profileError } =
            await supabase
                .from("profiles")
                .select("display_name, bio, avatar_url, role, approval_status")
                .eq("id", currentUser.id)
                .single();

        if (profileError) throw profileError;

        if (!profile) {
            throw new Error("Profile not found.");
        }


        // Check member approval

        if (profile.approval_status !== "approved") {

            await supabase.auth.signOut();

            window.location.replace("../login.html");

            return;
        }


        // Get private profile information

        const { data: privateDetails, error: privateError } =
            await supabase
                .from("private_profile_details")
                .select("profile_completed, show_location")
                .eq("user_id", currentUser.id)
                .maybeSingle();

        if (privateError) throw privateError;


        // Check profile completion

        if (!privateDetails || privateDetails.profile_completed !== true) {

            window.location.replace("./profile-setup.html");

            return;
        }


        // Display account name

        const name = profile.display_name || "Member";

        if (memberName) {
            memberName.textContent = name;
        }

        if (settingsName) {
            settingsName.textContent = name;
        }

        if (settingsDisplayName) {
            settingsDisplayName.value = name;
        }


        // Display email

        if (settingsEmail) {
            settingsEmail.textContent = currentUser.email || "";
        }


        // Display bio

        if (settingsBio) {
            settingsBio.value = profile.bio || "";
        }


        // Display profile picture

        if (settingsAvatar) {

            if (profile.avatar_url) {

                settingsAvatar.textContent = "";
                settingsAvatar.style.backgroundImage =
                    `url("${profile.avatar_url}")`;

                settingsAvatar.style.backgroundSize = "cover";
                settingsAvatar.style.backgroundPosition = "center";

            } else {

                settingsAvatar.style.backgroundImage = "none";
                settingsAvatar.textContent = name.charAt(0).toUpperCase();
            }
        }


        // Load privacy preference

        if (showLocation) {
            showLocation.checked = privateDetails.show_location === true;
        }


        // Display settings page

        showSettingsPage();

    } catch (error) {

        console.error("Settings loading error:", error);

        if (authLoading) {

            authLoading.innerHTML = `
                <p>We couldn't load your settings.</p>
                <p>Please refresh the page and try again.</p>
            `;
        }
    }
}


// ================================================
// 7. UPDATE ACCOUNT INFORMATION
// ================================================

accountForm?.addEventListener("submit", async function (event) {

    event.preventDefault();

    if (!currentUser) return;

    const displayName = settingsDisplayName.value.trim();
    const bio = settingsBio.value.trim();

    // Validate display name

    if (displayName.length < 2) {

        showMessage(
            accountMessage,
            "Your display name must contain at least 2 characters."
        );

        return;
    }

    if (displayName.length > 60) {

        showMessage(
            accountMessage,
            "Your display name cannot exceed 60 characters."
        );

        return;
    }


    setButtonLoading(
        saveAccountButton,
        true,
        "Saving...",
        "Save changes"
    );

    showMessage(accountMessage, "");


    try {

        const { error } = await supabase
            .from("profiles")
            .update({
                display_name: displayName,
                bio: bio
            })
            .eq("id", currentUser.id);

        if (error) throw error;


        // Update displayed name without refreshing

        if (memberName) {
            memberName.textContent = displayName;
        }

        if (settingsName) {
            settingsName.textContent = displayName;
        }

        if (settingsAvatar && !currentUser.user_metadata?.avatar_url) {

            if (!settingsAvatar.style.backgroundImage) {
                settingsAvatar.textContent =
                    displayName.charAt(0).toUpperCase();
            }
        }


        showMessage(
            accountMessage,
            "Your account information was updated successfully.",
            "success"
        );

    } catch (error) {

        console.error("Account update error:", error);

        showMessage(
            accountMessage,
            "We couldn't save your account information. Please try again."
        );

    } finally {

        setButtonLoading(
            saveAccountButton,
            false,
            "Saving...",
            "Save changes"
        );
    }
});


// ================================================
// 8. CHANGE PASSWORD
// ================================================

passwordForm?.addEventListener("submit", async function (event) {

    event.preventDefault();

    if (!currentUser || !currentUser.email) return;

    const oldPassword = currentPassword?.value || "";
    const password = newPassword.value;
    const confirmation = confirmPassword.value;


    // Check current password

    if (!oldPassword) {

        showMessage(
            passwordMessage,
            "Please enter your current password."
        );

        return;
    }


    // Check new password length

    if (password.length < 8) {

        showMessage(
            passwordMessage,
            "Your new password must contain at least 8 characters."
        );

        return;
    }


    // Check password confirmation

    if (password !== confirmation) {

        showMessage(
            passwordMessage,
            "Your new passwords do not match."
        );

        return;
    }


    // Prevent using the same password

    if (oldPassword === password) {

        showMessage(
            passwordMessage,
            "Choose a different password from your current password."
        );

        return;
    }


    setButtonLoading(
        changePasswordButton,
        true,
        "Verifying...",
        "Update password"
    );

    showMessage(passwordMessage, "");


    try {

        // Verify the current password by signing in again.
        // This checks the password without changing the session.

        const { error: verifyError } =
            await supabase.auth.signInWithPassword({
                email: currentUser.email,
                password: oldPassword
            });

        if (verifyError) {

            throw new Error("Your current password is incorrect.");
        }


        // Change password

        const { error: updateError } =
            await supabase.auth.updateUser({
                password: password
            });

        if (updateError) throw updateError;


        // Clear password fields

        passwordForm.reset();


        showMessage(
            passwordMessage,
            "Your password has been changed successfully.",
            "success"
        );

    } catch (error) {

        console.error("Password change error:", error);

        showMessage(
            passwordMessage,
            error.message || "Unable to change your password. Please try again."
        );

    } finally {

        setButtonLoading(
            changePasswordButton,
            false,
            "Verifying...",
            "Update password"
        );
    }
});


// ================================================
// 9. SAVE PRIVACY SETTINGS
// ================================================

savePrivacyButton?.addEventListener("click", async function () {

    if (!currentUser) return;

    setButtonLoading(
        savePrivacyButton,
        true,
        "Saving...",
        "Save privacy settings"
    );

    showMessage(privacyMessage, "");


    try {

        const { error } = await supabase
            .from("private_profile_details")
            .upsert({

                user_id: currentUser.id,

                show_location: showLocation.checked,

                updated_at: new Date().toISOString()

            }, {

                onConflict: "user_id"

            });

        if (error) throw error;


        showMessage(
            privacyMessage,
            "Your privacy preferences have been saved.",
            "success"
        );

    } catch (error) {

        console.error("Privacy settings error:", error);

        showMessage(
            privacyMessage,
            "Unable to save your privacy preferences. Please try again."
        );

    } finally {

        setButtonLoading(
            savePrivacyButton,
            false,
            "Saving...",
            "Save privacy settings"
        );
    }
});


// ================================================
// 10. CONNECT LOGOUT BUTTONS
// ================================================

logoutButton?.addEventListener("click", logout);

settingsLogoutButton?.addEventListener("click", logout);


// ================================================
// 11. START SETTINGS PAGE
// ================================================

loadSettings();
