
import { supabase } from "./supabase.js";

// Page elements
const authLoading = document.getElementById("authLoading");
const protectedContent = document.getElementById("protectedContent");
const memberGreeting = document.getElementById("memberGreeting");
const logoutButton = document.getElementById("logoutButton");

// Check the member's login
async function checkLogin() {
    try {
        const { data, error } = await supabase.auth.getSession();

        if (error) throw error;

        if (!data.session) {
            window.location.replace("./login.html");
            return;
        }

        const user = data.session.user;

        // Get the member's profile
        const { data: profile, error: profileError } =
            await supabase
                .from("profiles")
                .select("display_name")
                .eq("id", user.id)
                .single();

        if (profileError) throw profileError;

        const name = profile.display_name || "Member";

        // Welcome the signed-in member
        memberGreeting.textContent = `Welcome, ${name}. We're glad you're here.`;

        // Show the homepage
        authLoading.hidden = true;
        protectedContent.hidden = false;

    } catch (error) {
        console.error("Homepage error:", error);

        authLoading.querySelector("p").textContent =
            "Unable to load your account. Please refresh the page.";
    }
}

// Sign out
logoutButton.addEventListener("click", async function () {
    logoutButton.disabled = true;
    logoutButton.textContent = "Signing out...";

    try {
        const { error } = await supabase.auth.signOut();

        if (error) throw error;

        window.location.replace("./login.html");

    } catch (error) {
        console.error("Sign-out error:", error);

        alert("Unable to sign out. Please try again.");

        logoutButton.disabled = false;
        logoutButton.textContent = "Sign out";
    }
});

// Start the homepage
checkLogin();
