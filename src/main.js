import { Clock24H } from './clock';
import { Planner } from './planner';
import { StatsManager } from './stats';
import { DiaryManager } from './diary';
import { formatVN, getVietnamTime } from './utils';

document.addEventListener('DOMContentLoaded', async () => {
    // 요소 참조
    const plannerModal = document.getElementById('planner-modal');
    const statsModal = document.getElementById('stats-modal');
    const dateModal = document.getElementById('date-search-modal');
    const memoSearchModal = document.getElementById('memo-search-modal');
    const memoModal = document.getElementById('memo-modal');
    const floatingMenu = document.getElementById('clock-action-menu');

    // 앱 객체 생성
    const clock = new Clock24H('clock-24h');
    const planner = new Planner();
    const stats = new StatsManager('charts-container');
    const diary = new DiaryManager();

    // --- 상단 네비게이션 버튼 이벤트 ---

    document.getElementById('open-planner-btn').onclick = () => {
        plannerModal.classList.add('active');
        planner.renderList();
    };

    // add-schedule-btn 리스너는 planner.js의 setupEventListeners에서 처리하도록 위임함

    document.getElementById('open-stats-btn').onclick = () => {
        statsModal.classList.add('active');
        stats.updateStats();
    };

    document.getElementById('open-date-search-btn').onclick = () => {
        dateModal.classList.add('active');
        document.getElementById('history-date-picker').value = planner.currentDate;
    };

    document.getElementById('open-memo-search-btn').onclick = () => {
        memoSearchModal.classList.add('active');
    };

    // Diary 버튼 연동 (diary.js 내부에서도 처리하지만 확실히 하기 위해 여기서도 시도)
    const diaryBtn = document.getElementById('open-diary-btn');
    if (diaryBtn) {
        console.log('[Main] Diary button found, attaching listener');
        diaryBtn.onclick = () => {
            console.log('[Main] Diary button clicked');
            const diaryModal = document.getElementById('diary-modal');
            const diaryDateInput = document.getElementById('diary-date-input');
            if (diaryDateInput) diaryDateInput.value = diary.currentDate;
            diaryModal.classList.add('active');
            diary.updateDiary();
        };
    } else {
        console.error('[Main] Diary button not found!');
    }

    // --- 시계 일정 클릭 시 플로팅 메뉴 표시 ---
    clock.onWedgeClick = (item, x, y) => {
        if (!item) {
            floatingMenu.classList.remove('active');
            return;
        }

        floatingMenu.style.left = `${x}px`;
        floatingMenu.style.top = `${y}px`;
        floatingMenu.dataset.itemId = item.id;
        floatingMenu.classList.add('active');
    };

    // 플로팅 메뉴 액션 처리
    floatingMenu.addEventListener('click', async (e) => {
        const id = floatingMenu.dataset.itemId;
        const item = planner.schedules.find(s => s.id === id);
        
        if (e.target.classList.contains('complete-action')) {
            if (item) {
                planner.showMemoModal(item);
                floatingMenu.classList.remove('active');
            }
        } else if (e.target.classList.contains('edit-action')) {
            plannerModal.classList.add('active');
            planner.renderList();
            floatingMenu.classList.remove('active');
        } else if (e.target.classList.contains('delete-action')) {
            if (confirm('이 일정을 삭제하시겠습니까?')) {
                await planner.deleteSchedule(id);
                floatingMenu.classList.remove('active');
            }
        }
    });

    // 바탕 클릭 시 메뉴 닫기
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#clock-24h') && !e.target.closest('#clock-action-menu')) {
            floatingMenu.classList.remove('active');
        }
    });

    // --- 모달 닫기 이벤트들 ---
    const closeConfigs = [
        { id: 'close-planner-btn', modal: plannerModal },
        { id: 'close-stats-btn', modal: statsModal },
        { id: 'close-date-modal-btn', modal: dateModal },
        { id: 'close-memo-search-btn', modal: memoSearchModal },
        { id: 'close-memo-modal-btn', modal: memoModal },
        { id: 'close-diary-btn', modal: document.getElementById('diary-modal') }
    ];

    closeConfigs.forEach(cfg => {
        const btn = document.getElementById(cfg.id);
        if (btn) btn.onclick = () => {
            cfg.modal.classList.remove('active');
            if (cfg.modal === plannerModal) clock.setScheduleData(planner.schedules);
        };
    });

    // --- 날짜 이동 로직 ---
    document.getElementById('go-to-date-btn').onclick = async () => {
        const newDate = document.getElementById('history-date-picker').value;
        if (newDate) {
            await planner.changeDate(newDate);
            clock.setScheduleData(planner.schedules);
            dateModal.classList.remove('active');
        }
    };

    // --- 검색 로직 ---
    document.getElementById('search-btn').onclick = () => {
        const query = document.getElementById('history-search').value.toLowerCase();
        const resultsDiv = document.getElementById('search-results');
        const allSchedules = JSON.parse(localStorage.getItem('local_schedules') || '[]');
        const filtered = allSchedules.filter(item => 
            (item.content && item.content.toLowerCase().includes(query)) || 
            (item.memo && item.memo.toLowerCase().includes(query))
        );

        resultsDiv.innerHTML = filtered.length > 0 
            ? filtered.map(item => `
                <div class="glass-card result-item">
                    <p><span class="cat-badge">${item.date}</span> <strong>${item.startTime}~${item.endTime}</strong></p>
                    <p style="margin: 10px 0;">${item.content}</p>
                    <button class="glass-btn jump-to-date" data-date="${item.date}">이 날짜로 이동</button>
                </div>
            `).join('')
            : '<p>검색 결과가 없습니다.</p>';
            
        document.querySelectorAll('.jump-to-date').forEach(btn => {
            btn.onclick = async (e) => {
                const targetDate = e.target.dataset.date;
                await planner.changeDate(targetDate);
                clock.setScheduleData(planner.schedules);
                memoSearchModal.classList.remove('active');
            };
        });
    };

    // 메모 저장
    document.getElementById('save-memo-btn').onclick = async () => {
        const id = memoModal.dataset.id;
        const memo = document.getElementById('memo-input').value;
        await planner.updateMemo(id, memo);
        memoModal.classList.remove('active');
        clock.setScheduleData(planner.schedules);
    };

    planner.onUpdate = (data) => {
        clock.setScheduleData(data);
    };

    await planner.init();
    clock.setScheduleData(planner.schedules);
    
    // 실시간 시계 텍스트
    setInterval(() => {
        const now = getVietnamTime();
        const timeDisplay = document.getElementById('time-text');
        if (timeDisplay) timeDisplay.textContent = formatVN(now, 'HH:mm:ss');
    }, 1000);
});
