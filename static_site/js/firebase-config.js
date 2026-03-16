// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where, serverTimestamp, deleteDoc, doc, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBA9Ae9soKuwGfVtAgYLnHxPMzwpX_CHXw",
  authDomain: "biometric-authentication-e4b5f.firebaseapp.com",
  projectId: "biometric-authentication-e4b5f",
  storageBucket: "biometric-authentication-e4b5f.firebasestorage.app",
  messagingSenderId: "142173536021",
  appId: "1:142173536021:web:8371c9dc80d9e89311f31c",
  measurementId: "G-NDDHDESGV3"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Helper functions for auth

// Function to fetch IP Address
async function getIpAddress() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch (e) {
        console.error("Failed to fetch IP", e);
        return "Unknown";
    }
}
export async function registerUser(name, email, encoding) {
    try {
        const usersRef = collection(db, "users");
        
        // Check if email already exists
        const q = query(usersRef, where("email", "==", email));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            return { success: false, message: "Email already registered" };
        }

        // Store user with their encoding
        const docRef = await addDoc(usersRef, {
            name: name,
            email: email,
            encoding: Array.from(encoding), // Convert Float32Array to standard array for Firebase
            createdAt: serverTimestamp()
        });

        // Log the action
        const ip = await getIpAddress();
        await logAction(docRef.id, email, 'register', 'success', ip);

        return { success: true, message: "Identity Securely Enrolled", id: docRef.id };
    } catch (e) {
        console.error("Error adding document: ", e);
        return { success: false, message: e.message };
    }
}

export async function loginUser(capturedEncoding) {
    try {
        const usersRef = collection(db, "users");
        const querySnapshot = await getDocs(usersRef);
        
        let bestMatch = null;
        let lowestDistance = 0.6; // Threshold for matching (.6 is standard for face-api)

        // Iterate through all users to find the closest match
        querySnapshot.forEach((doc) => {
            const userData = doc.data();
            if (userData.encoding) {
                const storedEncoding = new Float32Array(userData.encoding);
                
                // Calculate Euclidean distance
                const distance = faceapi.euclideanDistance(storedEncoding, capturedEncoding);
                
                if (distance < lowestDistance) {
                    lowestDistance = distance;
                    bestMatch = { id: doc.id, ...userData };
                }
            }
        });

        const ip = await getIpAddress();

        if (bestMatch) {
            await logAction(bestMatch.id, bestMatch.email, 'login', 'success', ip);
            return { success: true, user: bestMatch.name, distance: lowestDistance };
        } else {
            await logAction('unknown', 'unknown', 'login', 'denied', ip);
            return { success: false, message: "Access Denied: Unrecognized Identity" };
        }

    } catch (e) {
        console.error("Error during login: ", e);
        return { success: false, message: "Database Error" };
    }
}

export async function logAction(userId, email, action, status, ip = 'Unknown') {
    try {
        await addDoc(collection(db, "auth_logs"), {
            userId: userId,
            email: email,
            action: action,
            status: status,
            ip_address: ip,
            timestamp: serverTimestamp()
        });
    } catch (e) {
        console.error("Error logging action: ", e);
    }
}

// === Admin Dashboard Functions ===
export async function getUsers() {
    const usersRef = collection(db, "users");
    const snapshot = await getDocs(usersRef);
    let users = [];
    snapshot.forEach(doc => {
        users.push({ id: doc.id, ...doc.data() });
    });
    // Sort locally by creation date
    return users.sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
}

export async function getLogs() {
    const logsRef = collection(db, "auth_logs");
    // Get latest 100 logs
    const q = query(logsRef, orderBy("timestamp", "desc"), limit(100));
    const snapshot = await getDocs(q);
    let logs = [];
    snapshot.forEach(doc => {
        logs.push({ id: doc.id, ...doc.data() });
    });
    return logs;
}

export async function deleteIdentity(userId) {
    try {
        // Find and delete the user
        await deleteDoc(doc(db, "users", userId));

        // Note: In Firestore it's usually better to trigger a Cloud Function to clean up associated logs,
        // but we'll try to delete logs related to this userId manually here for pure serverless effect.
        const logsRef = collection(db, "auth_logs");
        const q = query(logsRef, where("userId", "==", userId));
        const snapshot = await getDocs(q);
        const deletePromises = [];
        snapshot.forEach(document => {
            deletePromises.push(deleteDoc(doc(db, "auth_logs", document.id)));
        });
        await Promise.all(deletePromises);

        return { success: true };
    } catch (e) {
        console.error("Error deleting user: ", e);
        return { success: false };
    }
}
