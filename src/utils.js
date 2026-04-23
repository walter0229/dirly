import { format, addMinutes, startOfDay } from 'date-fns';
import { utcToZonedTime, format as formatTz } from 'date-fns-tz';
import { ko } from 'date-fns/locale';

const VIETNAM_TZ = 'Asia/Ho_Chi_Minh';

export function getVietnamTime() {
    return utcToZonedTime(new Date(), VIETNAM_TZ);
}

export function formatVN(date, pattern) {
    return formatTz(date, pattern, { timeZone: VIETNAM_TZ, locale: ko });
}

export function getVietnamDayStart(date = new Date()) {
    const vnDate = utcToZonedTime(date, VIETNAM_TZ);
    return startOfDay(vnDate);
}

export function generateTimeSlots() {
    const slots = [];
    let current = new Array(24 * 6).fill(0).map((_, i) => {
        const totalMinutes = i * 10;
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    });
    return current;
}
