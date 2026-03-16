// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

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
        await logAction(docRef.id, email, 'register', 'success');

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

        if (bestMatch) {
            await logAction(bestMatch.id, bestMatch.email, 'login', 'success');
            return { success: true, user: bestMatch.name, distance: lowestDistance };
        } else {
            await logAction('unknown', 'unknown', 'login', 'denied');
            return { success: false, message: "Access Denied: Unrecognized Identity" };
        }

    } catch (e) {
        console.error("Error during login: ", e);
        return { success: false, message: "Database Error" };
    }
}

export async function logAction(userId, email, action, status) {
    try {
        await addDoc(collection(db, "auth_logs"), {
            userId: userId,
            email: email,
            action: action,
            status: status,
            timestamp: serverTimestamp()
        });
    } catch (e) {
        console.error("Error logging action: ", e);
    }
}
