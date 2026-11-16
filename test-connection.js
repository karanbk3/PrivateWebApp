import { supabase } from "./supabase.js";

// Check Supabase connection
async function testConnection() {
    try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
            console.error("Supabase error:", error.message);
            return;
        }

        console.log("Supabase connection successful!");

        if (data.session) {
            console.log("User is logged in:", data.session.user.email);
        } else {
            console.log("No active user session.");
        }

    } catch (error) {
        console.error("Unexpected error:", error.message);
    }
}

// Run the test
testConnection();
