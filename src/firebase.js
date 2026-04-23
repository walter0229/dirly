import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDocs, query, where, deleteDoc, onSnapshot, orderBy } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCNS8oKiNEIf7QOogKQygT9As6UmzedFbo",
  authDomain: "diary-plan.firebaseapp.com",
  projectId: "diary-plan",
  storageBucket: "diary-plan.firebasestorage.app",
  messagingSenderId: "658619247458",
  appId: "1:658619247458:web:f31a4e8bb6396e7b58da3b",
  measurementId: "G-F7CZTWC338"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// --- 일정 (Schedules) 관련 ---

export async function saveSchedule(data) {
    try {
        console.log('[Firebase] Saving schedule:', data.id);
        const docRef = doc(db, 'schedules', data.id);
        await setDoc(docRef, data, { merge: true });
        console.log('[Firebase] Save success:', data.id);
        return true;
    } catch (e) {
        console.error('[Firebase] Save schedule failed:', e);
        return false;
    }
}

export async function deleteSchedule(id) {
    try {
        await deleteDoc(doc(db, 'schedules', id));
        return true;
    } catch (e) {
        console.error('[Firebase] Delete schedule failed:', e);
        return false;
    }
}

export async function fetchSchedules(date) {
    try {
        const q = query(collection(db, 'schedules'), where('date', '==', date));
        const querySnapshot = await getDocs(q);
        const results = [];
        querySnapshot.forEach((doc) => results.push(doc.data()));
        return results;
    } catch (e) {
        console.error('[Firebase] Fetch schedules failed:', e);
        return [];
    }
}

// 실시간 리스너 (Planner에서 사용)
export function subscribeSchedules(callback) {
    const q = query(collection(db, 'schedules'));
    return onSnapshot(q, (snapshot) => {
        const schedules = [];
        snapshot.forEach((doc) => schedules.push(doc.data()));
        callback(schedules);
    }, (error) => {
        console.error('[Firebase] Subscription failed:', error);
    });
}

// --- 운동 (Exercises) 관련 ---

export async function saveExercise(data) {
    try {
        const docRef = doc(db, 'exercises', data.id);
        await setDoc(docRef, data);
        return true;
    } catch (e) {
        console.error('[Firebase] Save exercise failed:', e);
        return false;
    }
}

export async function fetchExerciseStats() {
    try {
        const q = query(collection(db, 'exercises'), orderBy('date', 'desc'));
        const querySnapshot = await getDocs(q);
        const results = [];
        querySnapshot.forEach((doc) => results.push(doc.data()));
        return results;
    } catch (e) {
        console.error('[Firebase] Fetch exercises failed:', e);
        return [];
    }
}

export async function deleteExerciseByScheduleId(scheduleId) {
    try {
        const q = query(collection(db, 'exercises'), where('schedule_id', '==', scheduleId));
        const querySnapshot = await getDocs(q);
        const batch = [];
        querySnapshot.forEach((doc) => {
            batch.push(deleteDoc(doc.ref));
        });
        await Promise.all(batch);
        return true;
    } catch (e) {
        console.error('[Firebase] Delete exercises failed:', e);
        return false;
    }
}
