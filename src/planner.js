import { formatVN, getVietnamTime } from './utils';
import { saveSchedule, fetchSchedules, deleteSchedule, subscribeSchedules } from './firebase';

export class Planner {
    constructor() {
        // 시스템 시간이 아닌 베트남 시간을 즉시 가져와서 초기화 (v2.1.8)
        const vnNow = getVietnamTime();
        this.currentDate = formatVN(vnNow, 'yyyy-MM-dd');
        this.schedules = [];
        this.onUpdate = null;
        this.isInitialized = false;
        this.syncTimeout = null; 
        console.log('[Planner] Initialized with Vietnam Date:', this.currentDate);
    }

    async init() {
        if (this.isInitialized) return;
        
        // 1. 이벤트 리스너 먼저 등록 (UI 반응성 확보)
        this.setupEventListeners();
        this.updateDateDisplay();

        // 2. 초기 마이그레이션 (중요: 서버 구독 전에 로컬 데이터를 먼저 서버로 밀어넣음)
        console.log('[Planner] Starting critical migration check...');
        await this.migrateLocalToFirebase();

        // 3. 실시간 구독 설정
        this.unsubscribe = subscribeSchedules(async (allSchedules) => {
            console.log('[Planner] Real-time sync received:', allSchedules.length);
            
            // 서버에 데이터가 있고, 로컬 데이터와 다를 경우에만 업데이트
            const local = JSON.parse(localStorage.getItem('local_schedules') || '[]');
            if (allSchedules.length > 0) {
                // 단순 덮어쓰기가 아닌, ID 기반으로 없는 데이터만 추가하거나 업데이트하는 방식으로 개선 가능하지만
                // 여기서는 서버 데이터를 마스터로 보되, 마이그레이션이 끝난 후에만 작동하도록 함
                localStorage.setItem('local_schedules', JSON.stringify(allSchedules));
                await this.loadData();
                this.renderList();
            }
        });

        await this.loadData();
        this.renderList();
        this.isInitialized = true;
    }

    async migrateLocalToFirebase() {
        const hasMigrated = localStorage.getItem('firebase_migrated');
        if (hasMigrated) return;

        // 마이그레이션 시작 시점의 로컬 데이터를 확보
        const localSchedules = JSON.parse(localStorage.getItem('local_schedules') || '[]');
        
        if (localSchedules.length > 0) {
            console.log(`[Planner] Migrating ${localSchedules.length} local items to Firebase...`);
            try {
                for (const s of localSchedules) {
                    await saveSchedule(s);
                }
                localStorage.setItem('firebase_migrated', 'true');
                console.log('[Planner] Migration successfully completed');
            } catch (e) {
                console.error('[Planner] Migration failed:', e);
            }
        } else {
            // 데이터가 없어도 마이그레이션 시도는 한 것으로 간주하여 루프 방지
            localStorage.setItem('firebase_migrated', 'true');
            console.log('[Planner] No local data to migrate');
        }
    }

    async loadData() {
        try {
            const allSchedules = await this.fetchAllRelevantSchedules();
            this.schedules = allSchedules;
            if (this.onUpdate) this.onUpdate(this.schedules);
        } catch (e) {
            console.error('Data load failed', e);
        }
    }

    async fetchAllRelevantSchedules() {
        const all = JSON.parse(localStorage.getItem('local_schedules') || '[]');
        const targetDate = new Date(this.currentDate);
        const dayOfWeek = targetDate.getDay(); // 0:일, 1:월, ..., 6:토
        
        return all.filter(item => {
            if (!item.startTime || !item.endTime) return false;
            const itemDate = new Date(item.date);
            
            // 예외 날짜 체크 (당일만 삭제된 경우)
            if (item.exceptions && item.exceptions.includes(this.currentDate)) return false;

            // 1. 해당 날짜 직접 지정 일정
            if (item.date === this.currentDate) return true;
            
            // 2. 반복 일정 (시작일 이후여야 함)
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
        });
    }

    async changeDate(newDate) {
        this.currentDate = newDate;
        await this.loadData();
        this.renderList();
        this.updateDateDisplay();
    }

    updateDateDisplay() {
        const dateStr = formatVN(new Date(this.currentDate), 'yyyy년 MM월 dd일 (eeee)');
        const dateText = document.getElementById('date-text');
        if (dateText) dateText.textContent = dateStr;

        const plannerDateInput = document.getElementById('planner-date-input');
        if (plannerDateInput) plannerDateInput.value = this.currentDate;
    }

    renderList() {
        const tbody = document.getElementById('planner-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        // 시간순 정렬
        this.schedules.sort((a, b) => (a.startTime || '00:00').localeCompare(b.startTime || '00:00'));

        this.schedules.forEach((item) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div class="time-range-container">
                        <input type="text" class="time-input start-time" data-id="${item.id}" value="${item.startTime || '09:00'}" placeholder="00:00" maxlength="5">
                        <span style="color: var(--accent-color); font-weight: bold;">~</span>
                        <input type="text" class="time-input end-time" data-id="${item.id}" value="${item.endTime || '10:00'}" placeholder="00:00" maxlength="5">
                    </div>
                </td>
                <td>
                    <button class="save-btn" data-id="${item.id}" title="저장">✓</button>
                </td>
                <td>
                    <select class="cat-select cat-${item.category || '기타'}" data-id="${item.id}">
                        <option value="회사" ${item.category === '회사' ? 'selected' : ''}>회사</option>
                        <option value="미팅" ${item.category === '미팅' ? 'selected' : ''}>미팅</option>
                        <option value="집안일" ${item.category === '집안일' ? 'selected' : ''}>집안일</option>
                        <option value="식사" ${item.category === '식사' ? 'selected' : ''}>식사</option>
                        <option value="운동" ${item.category === '운동' ? 'selected' : ''}>운동</option>
                        <option value="자기관리" ${item.category === '자기관리' ? 'selected' : ''}>자기관리</option>
                        <option value="기타" ${item.category === '기타' ? 'selected' : ''}>기타</option>
                    </select>
                </td>
                <td>
                    <input type="text" class="content-input" data-id="${item.id}" value="${item.content || ''}" placeholder="무엇을 계획하시나요?">
                </td>
                <td>
                    <select class="repeat-select" data-id="${item.id}">
                        <option value="none" ${item.repeat === 'none' ? 'selected' : ''}>안함</option>
                        <option value="daily" ${item.repeat === 'daily' ? 'selected' : ''}>매일</option>
                        <option value="weekday" ${item.repeat === 'weekday' ? 'selected' : ''}>평일(월-금)</option>
                        <option value="sat" ${item.repeat === 'sat' ? 'selected' : ''}>토요일</option>
                        <option value="sun" ${item.repeat === 'sun' ? 'selected' : ''}>일요일</option>
                        <option value="weekly" ${item.repeat === 'weekly' ? 'selected' : ''}>매주</option>
                        <option value="monthly" ${item.repeat === 'monthly' ? 'selected' : ''}>매달</option>
                    </select>
                </td>
                <td>
                    <div class="action-btns">
                        <button class="delete-btn" data-id="${item.id}" title="삭제">&times;</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    }

    // 정밀 중복 체크 (분 단위 계산)
    isOverlap(testItem) {
        const parse = (t) => {
            if (!t) return 0;
            const [h, m] = t.split(':').map(Number);
            return h * 60 + m;
        };

        const s1 = parse(testItem.startTime);
        const e1 = parse(testItem.endTime);

        if (s1 >= e1) return true; // 시작 시간이 종료 시간보다 늦을 수 없음

        return this.schedules.some(s => {
            if (s.id === testItem.id) return false;
            const s2 = parse(s.startTime);
            const e2 = parse(s.endTime);
            
            // 표준 겹침 공식: (시작1 < 종료2) && (종료1 > 시작2)
            return (s1 < e2 && e1 > s2);
        });
    }

    async addSchedule() {
        // 비어있는 시간대 자동 탐색 로직 (간단히 1시간씩 추가)
        const newItem = {
            id: this.generateId(),
            date: this.currentDate,
            startTime: '12:00',
            endTime: '13:00',
            category: '기타',
            content: '',
            repeat: 'none',
            status: 'incomplete',
            memo: ''
        };

        // 가능한 시간대를 찾아서 추가
        let hour = 0;
        while(this.isOverlap(newItem) && hour < 23) {
            hour++;
            newItem.startTime = `${hour.toString().padStart(2, '0')}:00`;
            newItem.endTime = `${(hour + 1).toString().padStart(2, '0')}:00`;
        }

        this.schedules.push(newItem);
        this.renderList();
        await this.syncData(newItem);
    }

    setupEventListeners() {
        const tbody = document.getElementById('planner-body');
        if (!tbody) return;

        // [이전 값 저장] 포커스 시점에 현재 값을 저장하여 검증 실패 시 복원용으로 사용
        tbody.addEventListener('focusin', (e) => {
            if (e.target.classList.contains('start-time') || e.target.classList.contains('end-time')) {
                e.target.dataset.oldValue = e.target.value;
            }
        });

        // [삭제 및 추가 버튼 클릭 이벤트 위임]
        tbody.addEventListener('click', async (e) => {
            const delBtn = e.target.closest('.delete-btn');
            const saveBtn = e.target.closest('.save-btn');
            
            if (delBtn) {
                e.stopPropagation();
                const id = delBtn.dataset.id;
                console.log('[Planner] Delete clicked for ID:', id);
                await this.deleteSchedule(id);
            } else if (saveBtn) {
                e.stopPropagation();
                const id = saveBtn.dataset.id;
                const tr = saveBtn.closest('tr');
                const item = this.schedules.find(s => s.id === id);
                if (!item || !tr) return;

                // 입력 필드에서 현재 값 직접 추출 (데이터 동기화 보장)
                const startVal = tr.querySelector('.start-time').value;
                const endVal = tr.querySelector('.end-time').value;
                const contentVal = tr.querySelector('.content-input').value;
                const catVal = tr.querySelector('.cat-select').value;
                const repeatVal = tr.querySelector('.repeat-select').value;

                // 임시 객체로 검증 수행
                const testItem = { ...item, startTime: startVal, endTime: endVal };

                // 1. 형식 체크 (HH:mm)
                const timeRegex = /^\d{2}:\d{2}$/;
                if (!timeRegex.test(startVal) || !timeRegex.test(endVal)) {
                    alert('⚠️ 시간 형식이 올바르지 않습니다. (예: 09:00)');
                    return;
                }

                // 2. 논리적 오류 체크 (시작 >= 종료)
                if (startVal >= endVal) {
                    alert('⚠️ 시작 시간은 종료 시간보다 빨라야 합니다.');
                    await this.loadData();
                    this.renderList();
                    return;
                }

                // 3. 다른 일정과 중복 체크
                if (this.isOverlap(testItem)) {
                    alert('⚠️ 이미 해당 시간에 다른 일정이 있습니다! 다시 확인해 주세요.');
                    await this.loadData();
                    this.renderList();
                    return;
                }

                // 검증 통과 시 데이터 업데이트 및 서버 저장
                item.startTime = startVal;
                item.endTime = endVal;
                item.content = contentVal;
                item.category = catVal;
                item.repeat = repeatVal;

                const { saveSchedule: apiSaveSchedule } = await import('./firebase');
                await apiSaveSchedule(item);
                alert('✅ 저장되었습니다.');
                
                if (this.onUpdate) this.onUpdate(this.schedules);
                this.renderList();
            }
        });

        // 일정 추가 버튼은 모달 내부에 있으므로 document 또는 부모 컨테이너에 위임
        // (main.js와의 중복을 피하기 위해 여기서 처리하거나 main.js에서만 처리하도록 함. 
        // 여기서는 planner 자체의 독립성을 위해 유지하되 main.js를 정리할 예정)
        const addBtn = document.getElementById('add-schedule-btn');
        if (addBtn) {
            addBtn.onclick = () => this.addSchedule();
        }

        // [날짜 변경 이벤트]
        const dateInput = document.getElementById('planner-date-input');
        if (dateInput) {
            dateInput.addEventListener('change', async (e) => {
                await this.changeDate(e.target.value);
            });
        }

        // [입력값 변경 이벤트]
        tbody.addEventListener('change', async (e) => {
            const id = e.target.dataset.id;
            const item = this.schedules.find(s => s.id === id);
            if (!item) return;

            if (e.target.classList.contains('start-time')) item.startTime = e.target.value;
            if (e.target.classList.contains('end-time')) item.endTime = e.target.value;
            if (e.target.classList.contains('cat-select')) item.category = e.target.value;
            if (e.target.classList.contains('repeat-select')) item.repeat = e.target.value;

            // 내용, 카테고리, 반복 설정만 자동 저장 (시간은 저장 버튼으로만 저장 - v2.2.6)
            const isTimeInput = e.target.classList.contains('start-time') || e.target.classList.contains('end-time');
            
            if (!isTimeInput) {
                await this.syncData(item);
            } else {
                // 시간 변경 시에는 로컬 시계만 즉시 업데이트
                if (this.onUpdate) this.onUpdate(this.schedules);
            }
            
            // 카테고리나 반복 설정 변경 시에만 리스트 갱신 (시간 입력 시 렌더링 방지)
            const isContentInput = e.target.classList.contains('content-input');
            if (!isTimeInput && !isContentInput) {
                this.renderList();
            }
        });

        tbody.addEventListener('input', async (e) => {
            const id = e.target.dataset.id;
            const item = this.schedules.find(s => s.id === id);
            if (!item) return;

            if (e.target.classList.contains('content-input')) {
                item.content = e.target.value;
            } else if (e.target.classList.contains('start-time')) {
                item.startTime = e.target.value;
            } else if (e.target.classList.contains('end-time')) {
                item.endTime = e.target.value;
            }

            // 시간 입력 시 로컬 시계만 즉시 업데이트 (서버 저장 안 함 - v2.2.6)
            if (e.target.classList.contains('start-time') || e.target.classList.contains('end-time')) {
                // HH:mm 형식 자동 보정 (예: 9 -> 09:00)
                let val = e.target.value.replace(/[^0-9:]/g, '');
                if (val.length === 2 && !val.includes(':')) val += ':';
                e.target.value = val;

                // 시계 반영
                if (this.onUpdate) this.onUpdate(this.schedules);
            }
        });

        tbody.addEventListener('focusout', async (e) => {
            const id = e.target.dataset.id;
            const item = this.schedules.find(s => s.id === id);
            if (!item) return;

            // 내용 입력 등 일반 필드는 기존처럼 자동 저장 (시간 제외)
            if (e.target.classList.contains('content-input')) {
                await this.syncData(item);
            }
        });
    }

    async deleteSchedule(id) {
        const item = this.schedules.find(s => s.id === id);
        if (!item) return;

        if (!confirm('일정을 삭제하시겠습니까?')) return;

        let deleteFuture = false;
        // 반복 일정인 경우에만 물어봄
        if (item.repeat && item.repeat !== 'none') {
            deleteFuture = confirm('이후 반복되는 일정들도 모두 삭제할까요?\n(취소 시 오늘 일정만 삭제됩니다)');
        }

        try {
            console.log('[Planner] Processing deletion for ID:', id);
            const { deleteSchedule: apiDeleteSchedule, deleteExerciseByScheduleId, saveSchedule: apiSaveSchedule } = await import('./firebase');

            if (deleteFuture || !item.repeat || item.repeat === 'none') {
                // [전체 삭제 또는 단발성 일정 삭제]
                this.schedules = this.schedules.filter(s => s.id !== id);
                await apiDeleteSchedule(id);
                // 운동 데이터 삭제는 firebase.js 함수 사용
                await deleteExerciseByScheduleId(id);
                console.log('[Planner] Full deletion completed for ID:', id);
            } else {
                // [당일만 삭제]
                const all = JSON.parse(localStorage.getItem('local_schedules') || '[]');
                const found = all.find(s => s.id === id);
                if (found) {
                    if (!found.exceptions) found.exceptions = [];
                    if (!found.exceptions.includes(this.currentDate)) {
                        found.exceptions.push(this.currentDate);
                    }
                    // Firebase에 예외 상황 업데이트
                    await apiSaveSchedule(found);
                }
                this.schedules = this.schedules.filter(s => s.id !== id);
                console.log('[Planner] Single day exception added for ID:', id);
            }
            
            if (this.onUpdate) this.onUpdate(this.schedules);
            this.renderList();
        } catch (e) {
            console.error('[Planner] Delete failed', e);
            alert('삭제 중 오류가 발생했습니다.');
        }
    }

    async syncData(item) {
        // 실시간 시계 업데이트 (로컬)
        if (this.onUpdate) this.onUpdate(this.schedules);

        // Firebase 저장은 디바운스 처리 (500ms)
        if (this.syncTimeout) clearTimeout(this.syncTimeout);
        this.syncTimeout = setTimeout(async () => {
            try {
                console.log('[Planner] Debounced sync starting for:', item.id);
                await saveSchedule(item);
            } catch (e) {
                console.error('[Planner] Sync failed', e);
            }
        }, 500);
    }

    showMemoModal(item) {
        const modal = document.getElementById('memo-modal');
        const info = document.getElementById('memo-item-info');
        const input = document.getElementById('memo-input');
        
        if (info) info.textContent = `[${item.startTime}~${item.endTime}] ${item.content}`;
        if (input) input.value = item.memo || ''; // 기존 메모가 있으면 표시
        
        modal.dataset.id = item.id;
        modal.classList.add('active');
    }

    async updateMemo(id, memo) {
        const all = JSON.parse(localStorage.getItem('local_schedules') || '[]');
        const found = all.find(s => s.id === id);
        if (found) {
            found.memo = memo;
            found.status = 'complete';
            localStorage.setItem('local_schedules', JSON.stringify(all));
            
            // 기존 운동 데이터 삭제 및 새 운동 데이터 저장을 위한 함수 불러오기
            const { saveSchedule: apiSaveSchedule, saveExercise, deleteExerciseByScheduleId } = await import('./firebase');
            
            // 1. 일정 상태 및 메모를 서버에 저장 (v2.2.4 필수 수정)
            await apiSaveSchedule(found);
            
            // 2. 기존 운동 데이터 삭제 (해당 날짜만 삭제하여 다른 날짜 데이터 보존)
            await deleteExerciseByScheduleId(id, this.currentDate);
            
            // 새 운동 데이터 파싱 및 저장 (카테고리가 '운동'인 경우)
            if (found.category === '운동' && memo) {
                const lines = memo.split('\n');
                const exerciseData = [];
                
                lines.forEach(line => {
                    // 줄바꿈뿐만 아니라 콤마(,)로도 운동을 구분하여 파싱
                    const parts = line.split(',');
                    parts.forEach(part => {
                        // 패턴: 운동명 : 수치(단위) - 소수점 지원 (v2.2.3)
                        const match = part.match(/([^:]+)\s*:\s*(\d*\.?\d+)\s*(.*)/);
                        if (match) {
                            const title = match[1].trim();
                            const value = parseFloat(match[2]);
                            const unit = match[3].trim() || '회'; // 단위가 없으면 기본 '회'
                            
                            exerciseData.push({
                                id: this.generateId(),
                                date: this.currentDate, // 원본 날짜가 아닌 현재 플래너 날짜(오늘) 사용 (v2.1.8)
                                name: title, 
                                value,
                                unit,
                                schedule_id: id
                            });
                        }
                    });
                });
                
                if (exerciseData.length > 0) {
                    for (const data of exerciseData) {
                        await saveExercise(data);
                    }
                }
            }
            
            await this.loadData();
        }
    }
}
