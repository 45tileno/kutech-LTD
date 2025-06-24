import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // This imports your Tailwind CSS styles
import App from './App';

// IMPORTANT: For local development, define these global variables.
// In the Canvas environment, these are provided automatically.
// Replace the placeholder values with your actual Firebase project configuration.
window.__firebase_config = JSON.stringify({
  apiKey: "AIzaSyAoJ3y3FXo-NGexaFlLDkZxLzayH29HFo8", // e.g., "AIzaSyC..."
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com", // e.g., "my-project-12345.firebaseapp.com"
  projectId: "exam-registration-app", // e.g., "my-project-12345"
  storageBucket: "YOUR_PROJECT_ID.appspot.com", // e.g., "my-project-12345.appspot.com"
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID", // e.g., "1234567890"
  appId: "YOUR_APP_ID", // e.g., "1:1234567890:web:abcdef123456"
  measurementId: "YOUR_MEASUREMENT_ID" // Optional, e.g., "G-XXXXXX"
});
// This `__app_id` is used within your Firestore collection paths.
window.__app_id = "kisii-exam-reg-local"; // Use a unique ID for your app's data in Firestore

// The __initial_auth_token is specific to the Canvas environment for custom token sign-in.
// For local development with Email/Password or Anonymous auth, you can leave it undefined
// or set it to an empty string. The app's logic handles anonymous sign-in if no custom token is present.
// window.__initial_auth_token = ""; // Example: if you wanted to explicitly set it.

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);