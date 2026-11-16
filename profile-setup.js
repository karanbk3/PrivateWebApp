```javascript
import { supabase } from "./supabase.js";

// ======================================
// 1. GET PAGE ELEMENTS
// ======================================

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


// ======================================
// 2. PAGE DATA
// ======================================

let currentUser = null;
let previewURL = null;
let isSaving = false;


// ======================================
// 3. NEPAL PROVINCES AND DISTRICTS
// ======================================

const districts = {

    Koshi: [
        "Bhojpur",
        "Dhankuta",
        "Ilam",
        "Jhapa",
        "Khotang",
        "Morang",
        "Okhaldhunga",
        "Panchthar",
        "Sankhuwasabha",
        "Solukhumbu",
        "Sunsari",
        "Taplejung",
        "Terhathum",
        "Udayapur"
    ],

    Madhesh: [
        "Bara",
        "Dhanusha",
        "Mahottari",
        "Parsa",
        "Rautahat",
        "Saptari",
        "Sarlahi",
        "Siraha"
    ],

    Bagmati: [
        "Bhaktapur",
        "Chitwan",
        "Dhading",
        "Dolakha",
        "Kathmandu",
        "Kavrepalanchok",
        "Lalitpur",
        "Makwanpur",
        "Nuwakot",
        "Ramechhap",
        "Rasuwa",
        "Sindhuli",
        "Sindhupalchok"
    ],

    Gandaki: [
        "Baglung",
        "Gorkha",
        "Kaski",
        "Lamjung",
        "Manang",
        "Mustang",
        "Myagdi",
        "Nawalpur",
        "Parbat",
        "Syangja",
        "Tanahun"
    ],

    Lumbini: [
        "Arghakhanchi",
        "Banke",
        "Bardiya",
        "Dang",
        "Gulmi",
        "Kapilvastu",
        "Palpa",
        "Parasi",
        "Pyuthan",
        "Rolpa",
        "Rukum East",
        "Rupandehi"
    ],

    Karnali: [
        "Dailekh",
        "Dolpa",
        "Humla",
        "Jajarkot",
        "Jumla",
        "Kalikot",
        "Mugu",
        "Rukum West",
        "Salyan",
        "Surkhet"
    ],

    Sudurpashchim: [
        "Achham",
        "Baitadi",
        "Bajhang",
        "Bajura",
        "Dadeldhura",
        "Darchula",
        "Doti",
        "Kailali",
        "Kanchanpur"
    ]

};


// ======================================
// 4. HELPER FUNCTIONS
// ======================================

function showMessage(message, isError = false) {

    setupMessage.textContent = message;

    setupMessage.style.color = isError
        ? "#f08a9c"
        : "#53d8e8";

}


function getTodayDate() {

    const today = new Date();

    const year = today.getFullYear();

    const month = String(today.getMonth() + 1)
        .padStart(2, "0");

    const day = String(today.getDate())
        .padStart(2, "0");

    return `${year}-${month}-${day}`;

}


function isValidDate(value) {

    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const [year, month, day] = value
        .split("-")
        .map(Number);

    const date = new Date(
        Date.UTC(year, month - 1, day)
    );

    return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
    );

}


function setButtonLoading(isLoading) {

    saveButton.disabled = isLoading;

    saveButton.textContent = isLoading
        ? "Saving your profile..."
        : "Complete my profile";

}


function resetAvatarPreview() {

    if (previewURL) {
        URL.revokeObjectURL(previewURL);
        previewURL = null;
    }

    avatarPreview.replaceChildren();

    const placeholder = document.createElement("span");

    placeholder.textContent = "👤";

    avatarPreview.appendChild(placeholder);

}


function validatePhoto(file) {

    if (!file) {
        return true;
    }

    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    if (!allowedTypes.includes(file.type)) {

        showMessage(
            "Please choose a JPG, PNG or WebP image.",
            true
        );

        return false;
    }

    if (file.size > 1024 * 1024) {

        showMessage(
            "Your profile photo must be smaller than 1 MB.",
            true
        );

        return false;
    }

    return true;

}


// ======================================
// 5. SET DATE LIMIT
// ======================================

dateOfBirthInput.max = getTodayDate();


// ======================================
// 6. CHECK LOGGED-IN USER
// ======================================

async function checkUser() {

    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {

        window.location.href = "./login.html";

        return null;

    }

    return data.user;

}


// ======================================
// 7. LOAD DISTRICTS
// ======================================

function loadDistricts() {

    const selectedProvince = provinceSelect.value;

    // Clear previous districts
    districtSelect.replaceChildren();

    const defaultOption = document.createElement("option");

    defaultOption.value = "";
    defaultOption.textContent = "Select your district";

    districtSelect.appendChild(defaultOption);

    const provinceDistricts = districts[selectedProvince];

    if (!provinceDistricts) {

        districtSelect.disabled = true;

        return;

    }

    // Add districts for selected province
    provinceDistricts.forEach(district => {

        const option = document.createElement("option");

        option.value = district;
        option.textContent = district;

        districtSelect.appendChild(option);

    });

    districtSelect.disabled = false;

}


// Listen for province changes
provinceSelect.addEventListener("change", () => {

    loadDistricts();

    showMessage("");

});


// ======================================
// 8. PROFILE PHOTO PREVIEW
// ======================================

profilePhotoInput.addEventListener("change", () => {

    const file = profilePhotoInput.files[0];

    if (!file) {

        resetAvatarPreview();

        return;

    }

    if (!validatePhoto(file)) {

        profilePhotoInput.value = "";

        resetAvatarPreview();

        return;

    }

    showMessage("");

    // Remove previous preview URL
    if (previewURL) {
        URL.revokeObjectURL(previewURL);
    }

    previewURL = URL.createObjectURL(file);

    // Create image safely
    const image = document.createElement("img");

    image.src = previewURL;
    image.alt = "Your selected profile photo";

    avatarPreview.replaceChildren(image);

});


// ======================================
// 9. UPLOAD PHOTO TO SUPABASE
// ======================================

async function uploadProfilePhoto(file) {

    if (!file) {
        return null;
    }

    const extensions = {

        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp"

    };

    const extension = extensions[file.type];

    if (!extension) {

        throw new Error(
            "Unsupported profile photo format."
        );

    }

    // Store the image inside the user's own folder
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

    // Get the public image address
    const { data } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

    if (!data?.publicUrl) {

        throw new Error(
            "Could not create the profile photo address."
        );

    }

    return data.publicUrl;

}


// ======================================
// 10. VALIDATE PROFILE FORM
// ======================================

function validateProfileForm() {

    const displayName = fullNameInput.value.trim();

    const dateOfBirth = dateOfBirthInput.value;

    const province = provinceSelect.value;

    const district = districtSelect.value;

    if (!displayName) {

        showMessage(
            "Please enter your full name.",
            true
        );

        fullNameInput.focus();

        return false;

    }

    if (displayName.length < 2) {

        showMessage(
            "Your name must contain at least 2 characters.",
            true
        );

        fullNameInput.focus();

        return false;

    }

    if (!dateOfBirth) {

        showMessage(
            "Please enter your date of birth.",
            true
        );

        dateOfBirthInput.focus();

        return false;

    }

    if (
        !isValidDate(dateOfBirth) ||
        dateOfBirth > getTodayDate()
    ) {

        showMessage(
            "Please enter a valid date of birth.",
            true
        );

        dateOfBirthInput.focus();

        return false;

    }

    if (!province || !districts[province]) {

        showMessage(
            "Please select your province.",
            true
        );

        provinceSelect.focus();

        return false;

    }

    if (!districts[province].includes(district)) {

        showMessage(
            "Please select a valid district.",
            true
        );

        districtSelect.focus();

        return false;

    }

    const photo = profilePhotoInput.files[0];

    if (photo && !validatePhoto(photo)) {
        return false;
    }

    return true;

}


// ======================================
// 11. SAVE PROFILE
// ======================================

form.addEventListener("submit", async (event) => {

    event.preventDefault();

    if (isSaving) {
        return;
    }

    if (!currentUser) {

        showMessage(
            "Your session has expired. Please sign in again.",
            true
        );

        return;

    }

    if (!validateProfileForm()) {
        return;
    }

    const displayName = fullNameInput.value.trim();

    const dateOfBirth = dateOfBirthInput.value;

    const province = provinceSelect.value;

    const district = districtSelect.value;

    const showLocation = showLocationCheckbox.checked;

    const photo = profilePhotoInput.files[0] || null;


    try {

        isSaving = true;

        setButtonLoading(true);

        showMessage("Preparing your profile...");


        // STEP 1: UPLOAD PROFILE PHOTO
        let avatarURL = null;

        if (photo) {

            showMessage("Uploading your profile photo...");

            avatarURL = await uploadProfilePhoto(photo);

        }


        // STEP 2: UPDATE PUBLIC PROFILE
        showMessage("Saving your profile information...");

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
                "Your profile could not be updated. Please check your database permissions."
            );

        }


        // STEP 3: SAVE PRIVATE PROFILE DETAILS
        showMessage("Saving your private information...");

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


        // STEP 4: SUCCESS
        showMessage(
            "Your profile has been saved successfully!"
        );

        saveButton.textContent = "Completed!";

        // Give the success message a moment to display
        window.location.href = "./main.html";


    } catch (error) {

        console.error(
            "Profile setup error:",
            error
        );

        showMessage(
            error.message ||
            "Something went wrong. Please try again.",
            true
        );

        setButtonLoading(false);

    } finally {

        isSaving = false;

    }

});


// ======================================
// 12. START PROFILE SETUP PAGE
// ======================================

async function startPage() {

    try {

        currentUser = await checkUser();

        if (!currentUser) {
            return;
        }

        // Page is ready for the member

    } catch (error) {

        console.error(
            "Profile setup initialization error:",
            error
        );

        showMessage(
            "Could not load your account. Please refresh the page.",
            true
        );

    }

}


// ======================================
// 13. START
// ======================================

startPage();
```
