import { initializeApp } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-app.js";
import {
  getDatabase,
  ref,
  get,
  set,
} from "https://www.gstatic.com/firebasejs/9.21.0/firebase-database.js";

// Firebase Configuration
import { database } from "/js/firebase-config.js";

export async function generateBookingID(type) {
  const date = new Date();
  const year = date.getFullYear().toString().slice(2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const currentDate = `${year}${month}${day}`;
  const prefix = type === "tour" ? "T" : "TR";

  const sequenceRef = ref(database, `sequences/${currentDate}`);
  try {
    const snapshot = await get(sequenceRef);
    let sequence = 1;

    if (snapshot.exists()) {
      sequence = snapshot.val() + 1;
    }

    await set(sequenceRef, sequence);

    return `${prefix}-${currentDate}-${String(sequence).padStart(3, "0")}`;
  } catch (error) {
    console.error("Error generating Booking ID:", error);
    throw new Error("Failed to generate Booking ID");
  }
}
