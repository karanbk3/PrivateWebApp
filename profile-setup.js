
import { supabase } from "./supabase.js";

// Get form elements
const form = document.getElementById("profileSetupForm");
const fullNameInput = document.getElementById("fullName");
const dateOfBirthInput = document.getElementById("dateOfBirth");
const provinceSelect = document.getElementById("province");
const districtSelect = document.getElementById("district");
const profilePhotoInput = document.getElementById("profilePhoto");
const avatarPreview = document.getElementById("avatarPreview");
const showLocationCheckbox = document.getElementById("showLocation");
const saveButton = document.getElementById("saveProfileButton");
const setupMessage = document.getElementById("setupMessage");


// Nepal's provinces and districts
const districts = {
    Koshi: [
        "Bhojpur", "Dhankuta", "Ilam", "Jhapa",
        "Khotang", "Morang", "Okhaldhunga", "Panchthar",
        "Sankhuwasabha", "Solukhumbu", "Sunsari",
        "Taplejung", "Terhathum", "Udayapur"
    ],

    Madhesh: [
        "Bara", "Dhanusha", "Mahottari", "Parsa",
        "Rautahat", "Saptari", "Sarlahi", "Siraha"
    ],

    Bagmati: [
        "Bhaktapur", "Chitwan", "Dhading", "Dolakha",
        "Kathmandu", "Kavrepalanchok", "Lalitpur",
        "Makwanpur", "Nuwakot", "Ramechhap", "Rasuwa",
        "Sindhuli", "Sindhupalchok"
    ],

    Gandaki: [
        "Baglung", "Gorkha", "Kaski", "Lamjung",
        "Manang", "Mustang", "Myagdi", "Nawalpur",
        "Parbat", "Syangja", "Tanahun"
    ],

    Lumbini: [
        "Arghakhanchi", "Banke", "Bardiya", "Dang",
        "Gulmi", "Kapilvastu", "Palpa", "Parasi",
        "Pyuthan", "Rolpa", "Rukum East", "Rupandehi"
    ],

    Karnali: [
        "Dailekh", "Dolpa", "Humla", "Jajarkot",
        "Jumla", "Kalikot", "Mugu", "Rukum West",
        "Salyan", "Surkhet"
    ],

    Sudurpashchim: [
        "Achham", "Baitadi", "Bajhang", "Bajura",
        "Dadeldhura", "Darchula", "Doti",
        "Kailali", "Kanchanpur"
    ]
};


// Get today's date
function getTodayDate() {
    const today = new Date();

    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

dateOfBirthInput.max = getTodayDate();


// Check logged-in member
async function checkUser() {
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
        window.location.href = "../login.html";
        return null;
    }

    return data.user;
}

let currentUser = null;


// Load districts when province changes
provinceSelect.addEventListener("change", () => {

    const selectedProvince = provinceSelect.value;

    districtSelect.innerHTML =
        '<option value="">Select your district</option>';

    const provinceDistricts = districts[selectedProvince];

    if (!provinceDistricts) {
        districtSelect.disabled = true;
        return;
    }

    provinceDistricts.forEach((district) => {

        const option = document.createElement("option");

        option.value = district;
        option.textContent = district;

        districtSelect.appendChild(option);

    });

    districtSelect.disabled = false;
});


// Preview profile photo
profilePhotoInput.addEventListener("change", () => {

    const file = profilePhotoInput.files[0];

    if (!file) return;

    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    if (!allowedTypes.includes(file.type)) {

        setupMessage.textContent =
            "Please choose a JPG, PNG or WebP image.";

        profilePhotoInput.value = "";
        return;
    }

    if (file.size > 1024 * 1024) {

        setupMessage.textContent =
            "Your photo must be smaller than 1 MB.";

        profilePhotoInput.value = "";
        return;
    }

    setupMessage.textContent = "";

    const imageURL = URL.createObjectURL(file);

    avatarPreview.innerHTML = "";

    const image = document.createElement("img");

    image.src = imageURL;
    image.alt = "Profile photo preview";

    avatarPreview.appendChild(image);
});


// Upload profile photo to Supabase
async function uploadProfilePhoto(file) {

    if (!file) return null;

    const extensions = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp"
    };

    const extension = extensions[file.type];

    if (!extension) {
        throw new Error("Unsupported photo format.");
    }

    const filePath =
        `${currentUser.id}/avatar-${Date.now()}.${extension}`;

    const { error } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, {
            contentType: file.type,
            cacheControl: "3600",
            upsert: false
        });

    if (error) {
        throw error;
    }

    const { data } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

    return data.publicUrl;
}


// Save profile information
form.addEventListener("submit", async (event) => {

    event.preventDefault();

    if (!currentUser) {

        setupMessage.textContent =
            "Please sign in again.";

        return;
    }

    const displayName = fullNameInput.value.trim();
    const dateOfBirth = dateOfBirthInput.value;
    const province = provinceSelect.value;
    const district = districtSelect.value;
    const showLocation = showLocationCheckbox.checked;
    const photo = profilePhotoInput.files[0];

    // Check required information
    if (
        !displayName ||
        !dateOfBirth ||
        !province ||
        !district
    ) {

        setupMessage.textContent =
            "Please complete all required fields.";

        return;
    }

    if (dateOfBirth > getTodayDate()) {

        setupMessage.textContent =
            "Please enter a valid date of birth.";

        return;
    }

    // Check photo
    if (photo) {

        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp"
        ];

        if (
            !allowedTypes.includes(photo.type) ||
            photo.size > 1024 * 1024
        ) {

            setupMessage.textContent =
                "Please choose a supported image smaller than 1 MB.";

            return;
        }
    }

    try {

        saveButton.disabled = true;
        saveButton.textContent = "Saving your profile...";

        setupMessage.textContent = "Please wait...";

        // Step 1: Upload photo
        const avatarURL = await uploadProfilePhoto(photo);


        // Step 2: Update public profile
        const profileData = {
            display_name: displayName
        };

        if (avatarURL) {
            profileData.avatar_url = avatarURL;
        }

        const { data: updatedProfile, error: profileError } =
            await supabase
                .from("profiles")
                .update(profileData)
                .eq("id", currentUser.id)
                .select("id");

        if (profileError) {
            throw profileError;
        }

        if (!updatedProfile || updatedProfile.length === 0) {
            throw new Error(
                "Could not update your profile. Please check your database permissions."
            );
        }


        // Step 3: Save private information
        const { error: detailsError } = await supabase
            .from("private_profile_details")
            .upsert({
                user_id: currentUser.id,
                date_of_birth: dateOfBirth,
                province: province,
                district: district,
                show_location: showLocation,
                profile_completed: true,
                updated_at: new Date().toISOString()
            }, {
                onConflict: "user_id"
            });

        if (detailsError) {
            throw detailsError;
        }


        // Step 4: Finish
        setupMessage.textContent =
            "Your profile has been saved successfully!";

        saveButton.textContent = "Completed!";

        window.location.href = "../main.html";

    } catch (error) {

        console.error("Profile setup error:", error);

        setupMessage.textContent =
            error.message || "Something went wrong. Please try again.";

        saveButton.disabled = false;

        saveButton.textContent = "Complete my profile";
    }

});


// Start the page
async function startPage() {

    currentUser = await checkUser();

    if (!currentUser) return;

}

startPage();
