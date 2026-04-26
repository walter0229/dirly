import Chart from 'chart.js/auto';
import { fetchExerciseStats } from './firebase';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';

export class StatsManager {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.charts = [];
        this.currentPeriod = 'weekly';
        this.currentReferenceDate = new Date();
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.querySelectorAll('.period-btn').forEach(btn => {
            btn.onclick = async (e) => {
                document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentPeriod = e.target.dataset.period;
                await this.updateStats(this.currentReferenceDate);
            };
        });
    }

    async updateStats(date = null) {
        if (date) {
            this.currentReferenceDate = new Date(date);
        }
        const data = await fetchExerciseStats();
        this.renderCharts(data);
    }

    getDateRange(now) {
        let labels = [];
        let dateKeys = [];

        if (this.currentPeriod === 'weekly') {
            const start = startOfWeek(now, { weekStartsOn: 1 });
            const end = endOfWeek(now, { weekStartsOn: 1 });
            const intervals = eachDayOfInterval({ start, end });
            labels = intervals.map(d => format(d, 'MM/dd(eee)'));
            dateKeys = intervals.map(d => format(d, 'yyyy-MM-dd'));
        } 
        else if (this.currentPeriod === 'monthly') {
            const start = startOfMonth(now);
            const end = endOfMonth(now);
            const intervals = eachDayOfInterval({ start, end });
            labels = intervals.map(d => format(d, 'dd일'));
            dateKeys = intervals.map(d => format(d, 'yyyy-MM-dd'));
        }
        else if (this.currentPeriod === 'yearly') {
            labels = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
            dateKeys = labels.map((_, i) => `${now.getFullYear()}-${String(i + 1).padStart(2, '0')}`);
        }

        return { labels, dateKeys };
    }

    renderCharts(rawData = []) {
        console.log('[Stats] Rendering with data:', rawData);
        this.charts.forEach(chart => chart.destroy());
        this.charts = [];
        this.container.innerHTML = '';
        
        // 종목별 단위 매핑 (v2.2.3)
        this.exerciseUnits = {
            '걷기': 'Km',
            '달리기': 'Km',
            '수영': '분',
            '레그레이즈': '회',
            '스쿼트': '회',
            '윗몸일으키기': '회',
            '역기들기': '회',
            '팔목운동': '회'
        };
        
        const now = this.currentReferenceDate || new Date();
        const titles = [...new Set(rawData.map(d => d.name || d.title))].filter(Boolean).sort();

        if (titles.length === 0) {
            this.container.innerHTML = '<div class="no-data">운동 기록이 없습니다.</div>';
            return;
        }

        // 1. 요약 표 렌더링 (At the top)
        this.renderSummaryTable(titles, rawData, now);

        // 2. 개별 차트 렌더링 (Below)
        titles.forEach(title => {
            const exerciseData = rawData.filter(d => (d.name || d.title) === title);
            const unit = exerciseData[0]?.unit || '회';
            this.createIndividualChart(title, unit, exerciseData, now);
        });
    }

    renderSummaryTable(titles, rawData, now) {
        const { labels, dateKeys } = this.getDateRange(now);
        
        const tableContainer = document.createElement('div');
        tableContainer.className = 'summary-table-container';

        let tableHtml = `
            <table class="summary-table">
                <thead>
                    <tr>
                        <th class="sticky-col-1">운동 종목</th>
                        <th class="sticky-col-2">합계</th>
                        ${labels.map(l => `<th>${l}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
        `;

        titles.forEach(title => {
            const exerciseData = rawData.filter(d => (d.name || d.title) === title);
            let rowTotal = 0;
            const unit = this.exerciseUnits[title] || '회';
            
            const cellHtml = dateKeys.map(key => {
                const val = exerciseData
                    .filter(item => this.currentPeriod === 'yearly' ? item.date.startsWith(key) : item.date === key)
                    .reduce((acc, curr) => acc + (Number(curr.value) || 0), 0);
                rowTotal += val;
                
                // 소수점이 있으면 그대로, 없으면 정수로 표시
                const displayVal = val > 0 ? (Number.isInteger(val) ? val : val.toFixed(1)) : '';
                return `<td>${displayVal}</td>`;
            }).join('');

            // 합계 표시 최적화 (v2.2.3)
            const displayTotal = rowTotal > 0 ? (Number.isInteger(rowTotal) ? rowTotal : rowTotal.toFixed(1)) : '';

            tableHtml += `
                <tr>
                    <td class="sticky-col-1">${title} (${unit})</td>
                    <td class="sticky-col-2 row-total">${displayTotal ? `${displayTotal} ${unit}` : ''}</td>
                    ${cellHtml}
                </tr>
            `;
        });

        tableHtml += `
                </tbody>
            </table>
        `;

        tableContainer.innerHTML = tableHtml;
        this.container.appendChild(tableContainer);
        console.log('[Stats] Summary table appended');
    }

    createIndividualChart(title, unit, exerciseData, now) {
        const { labels, dateKeys } = this.getDateRange(now);

        const wrapper = document.createElement('div');
        wrapper.className = 'individual-chart-wrapper glass-card';
        
        const header = document.createElement('div');
        header.className = 'chart-header';
        header.innerHTML = `<h3>* ${title} <small>(단위: ${unit})</small></h3>`;
        
        const canvasContainer = document.createElement('div');
        canvasContainer.className = 'individual-canvas-container';
        const canvas = document.createElement('canvas');
        
        canvasContainer.appendChild(canvas);
        wrapper.appendChild(header);
        wrapper.appendChild(canvasContainer);
        this.container.appendChild(wrapper);

        const dataValues = dateKeys.map(key => {
            return exerciseData
                .filter(item => this.currentPeriod === 'yearly' ? item.date.startsWith(key) : item.date === key)
                .reduce((acc, curr) => acc + (Number(curr.value) || 0), 0);
        });

        const chart = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: title,
                    data: dataValues,
                    backgroundColor: 'rgba(56, 189, 248, 0.5)',
                    borderColor: '#38bdf8',
                    borderWidth: 2,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#94a3b8', font: { size: 10 } }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#94a3b8', font: { size: 10 } }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => `${context.raw} ${unit}`
                        }
                    }
                }
            }
        });

        this.charts.push(chart);
    }
}
