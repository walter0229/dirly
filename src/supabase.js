import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isConfigured = supabaseUrl && supabaseUrl !== 'YOUR_NEW_SUPABASE_URL';
export const supabase = isConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null;

export async function saveSchedule(data) {
    if (!isConfigured) {
        // planner.js에서 이미 배열을 관리하므로 여기서는 개별 항목 또는 전체 배열 처리가 필요함
        // 일단 개별 항목 upsert 로직 유지 (단, date 필드 필요)
        const localData = JSON.parse(localStorage.getItem('local_schedules') || '[]');
        const index = localData.findIndex(item => item.id === data.id);
        if (index > -1) localData[index] = data;
        else localData.push(data);
        localStorage.setItem('local_schedules', JSON.stringify(localData));
        return true;
    }
    const { error } = await supabase.from('schedules').upsert(data);
    return !error;
}

export async function deleteSchedule(id) {
    if (!isConfigured) {
        const localData = JSON.parse(localStorage.getItem('local_schedules') || '[]');
        const filtered = localData.filter(item => item.id !== id);
        localStorage.setItem('local_schedules', JSON.stringify(filtered));
        return true;
    }
    const { error } = await supabase.from('schedules').delete().eq('id', id);
    return !error;
}

export async function fetchSchedules(date) {
    if (!isConfigured) {
        const localData = JSON.parse(localStorage.getItem('local_schedules') || '[]');
        return localData.filter(item => item.date === date);
    }
    const { data, error } = await supabase.from('schedules').select('*').eq('date', date);
    return data || [];
}

export async function saveExercise(data) {
    if (!isConfigured) {
        const localData = JSON.parse(localStorage.getItem('local_exercises') || '[]');
        localData.push(data);
        localStorage.setItem('local_exercises', JSON.stringify(localData));
        return true;
    }
    const { error } = await supabase.from('exercises').insert(data);
    return !error;
}

export async function fetchExerciseStats() {
    if (!isConfigured) {
        return JSON.parse(localStorage.getItem('local_exercises') || '[]');
    }
    const { data, error } = await supabase.from('exercises').select('*');
    return data || [];
}
export async function deleteExerciseByScheduleId(scheduleId) {
    if (!isConfigured) {
        const localData = JSON.parse(localStorage.getItem('local_exercises') || '[]');
        const filtered = localData.filter(item => item.schedule_id !== scheduleId);
        localStorage.setItem('local_exercises', JSON.stringify(filtered));
        return true;
    }
    const { error } = await supabase.from('exercises').delete().eq('schedule_id', scheduleId);
    return !error;
}
