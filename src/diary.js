import { formatVN, getVietnamTime } from './utils';
import { fetchSchedules } from './firebase';

export class DiaryManager {
    constructor() {
        this.currentDate = formatVN(getVietnamTime(), 'yyyy-MM-dd');
        this.setupEventListeners();
    }

    setupEventListeners() {
        // main.js에서 통합 관리하므로 내부 리스너는 제거하거나 
        // 날짜 변경 같은 내부 요소만 관리함
        const dateInput = document.getElementById('diary-date-input');
        if (dateInput) {
            dateInput.onchange = (e) => {
                this.currentDate = e.target.value;
                this.updateDiary();
            };
        }
    }

    async updateDiary() {
        const container = document.getElementById('diary-content');
        if (!container) return;

        container.innerHTML = '<div class="generating">일기를 작성 중입니다...</div>';

        // 실제 데이터를 가져오기 위해 로컬스토리지에서도 필터링 필요 (planner.js 로직 참고)
        const allSchedules = JSON.parse(localStorage.getItem('local_schedules') || '[]');
        const targetDate = new Date(this.currentDate);
        const dayOfWeek = targetDate.getDay();

        const daySchedules = allSchedules.filter(item => {
            if (!item.startTime || !item.endTime) return false;
            const itemDate = new Date(item.date);
            if (item.exceptions && item.exceptions.includes(this.currentDate)) return false;
            if (item.date === this.currentDate) return true;
            if (itemDate > targetDate) return false;
            
            switch(item.repeat) {
                case 'daily': return true;
                case 'weekday': return dayOfWeek >= 1 && dayOfWeek <= 5;
                case 'sat': return dayOfWeek === 6;
                case 'sun': return dayOfWeek === 0;
                case 'weekly': return itemDate.getDay() === dayOfWeek;
                case 'monthly': return itemDate.getDate() === targetDate.getDate();
                default: return false;
            }
        }).sort((a, b) => a.startTime.localeCompare(b.startTime));

        // 지연 효과 (AI가 작성하는 느낌을 주기 위해)
        setTimeout(() => {
            const diaryText = this.generateDiaryText(daySchedules);
            container.innerHTML = `<div class="diary-paper">${diaryText}</div>`;
        }, 800);
    }

    generateDiaryText(schedules) {
        if (schedules.length === 0) {
            return `
                <p>오늘은 특별한 일정이 기록되지 않은 조용한 하루였습니다.</p>
                <p>가끔은 이렇게 아무것도 하지 않는 시간이 우리에게 큰 휴식이 되곤 하죠. 내일은 또 어떤 일들이 기다리고 있을까요?</p>
            `;
        }

        const completed = schedules.filter(s => s.status === 'complete');
        const categories = [...new Set(schedules.map(s => s.category))];
        
        let intro = '';
        const morningTask = schedules.find(s => s.startTime < '12:00');
        const eveningTask = schedules.find(s => s.startTime >= '18:00');

        // 서론 생성
        const intros = [
            `오늘은 ${this.formatDate(this.currentDate)}의 하루를 되돌아봅니다.`,
            `${this.formatDate(this.currentDate)}, 나만의 소중한 기록을 남겨봅니다.`,
            `오늘 하루도 참 바쁘게 지나갔네요. 기록을 보니 마음이 뿌듯해집니다.`
        ];
        intro = intros[Math.floor(Math.random() * intros.length)];

        // 본론 생성
        let body = '<p>';
        if (morningTask) {
            body += `하루의 시작은 <strong>${morningTask.content || morningTask.category}</strong>(으)로 열었습니다. `;
        }

        const exerciseTask = completed.find(s => s.category === '운동');
        if (exerciseTask) {
            body += `오늘 하루 중 가장 활력이 넘쳤던 순간은 역시 운동을 할 때였습니다. `;
            if (exerciseTask.memo) {
                body += `기록을 보니 <em>"${exerciseTask.memo.replace(/\n/g, ' ')}"</em>라며 스스로를 다독였네요. `;
            }
        }

        const workTasks = schedules.filter(s => s.category === '회사');
        if (workTasks.length > 0) {
            body += `업무에 몰입했던 시간들도 기억에 남습니다. `;
        }

        const selfCare = completed.find(s => s.category === '자기관리');
        if (selfCare) {
            body += `나를 위한 자기관리 시간도 잊지 않고 챙겼습니다. `;
        }

        body += '</p>';

        // 상세 목록 (완료된 항목 위주)
        let details = '<div class="diary-details"><h3>주요 기록들</h3><ul>';
        schedules.forEach(s => {
            const statusIcon = s.status === 'complete' ? '✅' : '⏳';
            details += `<li><span class="time-tag">${s.startTime}</span> ${s.content || s.category} ${statusIcon}`;
            if (s.memo) {
                details += `<div class="memo-quote">"${s.memo}"</div>`;
            }
            details += `</li>`;
        });
        details += '</ul></div>';

        // 결론 생성
        let conclusion = '<p class="diary-closing">';
        const completeRate = (completed.length / schedules.length) * 100;
        
        if (completeRate >= 80) {
            conclusion += `대부분의 계획을 완수하며 정말 알차게 보낸 하루였습니다. 나 자신에게 칭찬 한마디 해주고 싶네요.`;
        } else if (completeRate >= 50) {
            conclusion += `오늘 계획한 일들을 차근차근 해내며 적당한 리듬을 유지한 하루였습니다. `;
        } else {
            conclusion += `오늘은 조금 여유롭게 보낸 것 같아요. 내일은 오늘보다 조금 더 활기찬 하루가 되길 기대해 봅니다.`;
        }
        conclusion += '</p>';

        return `
            <div class="diary-header">
                <h2>${this.formatDate(this.currentDate)}</h2>
                <div class="diary-intro">${intro}</div>
            </div>
            <hr class="diary-divider">
            <div class="diary-body">
                ${body}
                ${details}
            </div>
            <hr class="diary-divider">
            <div class="diary-footer">
                ${conclusion}
            </div>
        `;
    }

    formatDate(dateStr) {
        const d = new Date(dateStr);
        return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
    }
}
