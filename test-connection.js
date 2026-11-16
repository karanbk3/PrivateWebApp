
import { supabase } from "./supabase.js";

async function testConnection() {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
        console.error("Connection error:", error.message);
        return;
    }

    console.log("Supabase connection successful!");
    console.log("Current session:", data.session);
}

testConnection();
