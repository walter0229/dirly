import { getVietnamTime } from './utils';

export class Clock24H {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        this.schedules = [];
        this.onWedgeClick = null; 
        
        this.colors = {
            '회사': '#f43f5e',
            '집안일': '#38bdf8',
            '식사': '#facc15',
            '운동': '#22c55e',
            '자기관리': '#8b5cf6',
            '미팅': '#ec4899',
            '기타': '#1e40af'
        };

        window.addEventListener('resize', () => {
            this.resize();
            this.drawFace(); // 리사이즈 즉시 반영
        });
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
        this.init();
    }

    resize() {
        const parent = this.canvas.parentElement;
        // 부모 컨테이너 크기에 맞춰 최대한 크게 설정
        this.size = Math.min(parent.clientWidth, parent.clientHeight);
        this.radius = (this.size / 2) * 0.82; // 최대한 키움
        this.canvas.width = this.size;
        this.canvas.height = this.size;
    }

    init() {
        this.animate();
    }

    setScheduleData(data) {
        this.schedules = data;
    }

    handleCanvasClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const center = this.size / 2;

        const dx = x - center;
        const dy = y - center;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > this.radius + 40) return;

        let angle = Math.atan2(dy, dx) * (180 / Math.PI);
        angle = (angle + 90 + 360) % 360; 

        const clickedMins = (angle / 360) * 1440; 

        const found = this.schedules.find(item => {
            const [hStart, mStart] = item.startTime.split(':').map(Number);
            const [hEnd, mEnd] = item.endTime.split(':').map(Number);
            const startMins = hStart * 60 + mStart;
            const endMins = hEnd * 60 + mEnd;

            if (startMins > endMins) {
                return clickedMins >= startMins || clickedMins <= endMins;
            }
            return clickedMins >= startMins && clickedMins <= endMins;
        });

        if (this.onWedgeClick) {
            this.onWedgeClick(found || null, e.clientX, e.clientY);
        }
    }

    drawFace() {
        const { ctx, radius, size } = this;
        const center = size / 2;

        // 원판 배경 (사용자 요청: 일정이 없는 곳은 희색/밝은 톤)
        ctx.beginPath();
        ctx.arc(center, center, radius, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(248, 250, 252, 0.95)'; 
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.lineWidth = 1;
        ctx.stroke();

        this.drawWedges();

        // 24시간 숫자 및 눈금
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (let i = 0; i < 24; i++) {
            const angle = (i * (360 / 24) - 90) * (Math.PI / 180);
            const x = center + (radius + 35) * Math.cos(angle);
            const y = center + (radius + 35) * Math.sin(angle);
            
            if (i % 6 === 0) {
                ctx.fillStyle = '#0369a1'; // 더 진한 파란색 (밝은 배경용)
                ctx.font = 'bold 22px Outfit, Inter';
            } else {
                ctx.fillStyle = '#475569'; // 더 어두운 회색
                ctx.font = '600 16px Outfit, Inter';
            }
            ctx.fillText(i.toString(), x, y);

            // 눈금
            const tStart = center + (radius - 8) * Math.cos(angle);
            const tStart_y = center + (radius - 8) * Math.sin(angle);
            const tEnd = center + radius * Math.cos(angle);
            const tEnd_y = center + radius * Math.sin(angle);

            ctx.beginPath();
            ctx.moveTo(tStart, tStart_y);
            ctx.lineTo(tEnd, tEnd_y);
            ctx.strokeStyle = i % 6 === 0 ? '#0369a1' : 'rgba(0, 0, 0, 0.15)';
            ctx.lineWidth = i % 6 === 0 ? 4 : 2;
            ctx.stroke();
        }
    }

    drawWedges() {
        const { ctx, radius, size, schedules } = this;
        const center = size / 2;

        schedules.forEach(item => {
            if (item.startTime && item.endTime) {
                const [hStart, mStart] = item.startTime.split(':').map(Number);
                const [hEnd, mEnd] = item.endTime.split(':').map(Number);
                const startAngle = ((hStart * 60 + mStart) / 1440 * 360 - 90) * (Math.PI / 180);
                const endAngle = ((hEnd * 60 + mEnd) / 1440 * 360 - 90) * (Math.PI / 180);

                const isComplete = item.status === 'complete';
                const baseColor = this.colors[item.category] || this.colors['기타'];

                // 부채꼴 그리기
                ctx.beginPath();
                ctx.moveTo(center, center);
                ctx.arc(center, center, radius, startAngle, endAngle);
                ctx.closePath();

                // 완료 여부에 따른 색상 대비 (밝은 배경에 맞춰 알파값 조정)
                if (isComplete) {
                    ctx.fillStyle = baseColor + 'EE'; // 거의 불투명
                    ctx.shadowBlur = 15;
                    ctx.shadowColor = baseColor;
                } else {
                    ctx.fillStyle = baseColor + '55'; // 33% 투명도 (밝은 배경에서 가독성 확보)
                    ctx.shadowBlur = 0;
                }
                ctx.fill();
                ctx.shadowBlur = 0;

                // 테두리
                ctx.strokeStyle = isComplete ? '#ffffff' : baseColor + '88';
                ctx.lineWidth = isComplete ? 2 : 1;
                ctx.stroke();

                // 텍스트 레이블
                if (item.content) {
                    const isMobile = window.innerWidth <= 768;
                    if (isMobile) {
                        // 모바일: 도넛 몸통은 색깔만, 글자는 중앙 구멍 근처 내측에 작게 표시
                        this.drawMobileLabel(item.content, startAngle, endAngle, isComplete);
                    } else {
                        // 노트북: 기존 방식 (도넛 몸통 외측에 표시)
                        this.drawRadialLabel(item.content, startAngle, endAngle, isComplete);
                    }
                }
            }
        });
    }

    drawMobileLabel(text, startAngle, endAngle, isComplete) {
        const { ctx, size } = this;
        const center = size / 2;
        const innerRadius = 90; // 중앙 구멍 반지름 축소 (도넛 두께 확보를 위해 110 -> 90)
        
        let diff = endAngle - startAngle;
        if (diff < 0) diff += Math.PI * 2;
        if (diff < (Math.PI * 2 / 120)) return; // 아주 짧은 일정은 생략

        const midAngle = startAngle + diff / 2;

        ctx.save();
        ctx.translate(center, center);
        ctx.rotate(midAngle);

        // 글자 위치: 중앙 구멍 바로 안쪽
        const textX = innerRadius - 5;

        let displayText = (isComplete ? '✓ ' : '') + text;
        
        // 글자 길이에 따라 폰트 크기 동적 조절 (v2.1.5)
        let fontSize = 11;
        if (displayText.length > 8) fontSize = 9;
        if (displayText.length > 12) fontSize = 7;

        ctx.fillStyle = isComplete ? '#ffffff' : '#475569';
        ctx.font = `bold ${fontSize}px Inter`; 
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        ctx.fillText(displayText, textX, 0);
        ctx.restore();
    }

    drawRadialLabel(text, startAngle, endAngle, isComplete) {
        const { ctx, radius, size } = this;
        const center = size / 2;
        
        let diff = endAngle - startAngle;
        if (diff < 0) diff += Math.PI * 2;
        
        // 15분 미만 일정은 텍스트 생략
        if (diff < (Math.PI * 2 / 96)) return;

        const midAngle = startAngle + diff / 2;

        ctx.save();
        ctx.translate(center, center);
        ctx.rotate(midAngle);

        // 글자 위치 지정 (마지막 글자가 외각 테두리에 닿도록 설정)
        const endX = radius * 0.9;
        const availableWidth = radius * 0.75;

        // 텍스트 스타일
        ctx.fillStyle = isComplete ? '#ffffff' : '#0f172a'; // 미완료 일정은 어두운 텍스트 (가독성)
        ctx.font = `bold ${isComplete ? '18' : '15'}px Outfit, Inter`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        
        // 완료 시 체크 표시 추가
        let displayText = (isComplete ? '✓ ' : '') + text;

        // 글자수가 많으면 자르기
        const metrics = ctx.measureText(displayText);
        if (metrics.width > availableWidth) {
            let limit = Math.floor((availableWidth / metrics.width) * displayText.length) - 1;
            displayText = displayText.substring(0, Math.max(1, limit)) + '..';
        }

        ctx.fillText(displayText, endX, 0);
        ctx.restore();
    }

    drawHand(time) {
        const { ctx, radius, size, schedules } = this;
        const center = size / 2;

        const hours = time.getHours();
        const minutes = time.getMinutes();
        const seconds = time.getSeconds();
        const currentMins = hours * 60 + minutes;
        const angle = (((hours * 3600) + (minutes * 60) + seconds) / 86400 * 360 - 90) * (Math.PI / 180);

        // 현재 일정 찾기
        const currentTask = schedules.find(item => {
            const [hStart, mStart] = item.startTime.split(':').map(Number);
            const [hEnd, mEnd] = item.endTime.split(':').map(Number);
            const s = hStart * 60 + mStart;
            const e = hEnd * 60 + mEnd;
            if (s > e) return currentMins >= s || currentMins <= e;
            return currentMins >= s && currentMins <= e;
        });

        // 현재 시간 바늘 (사용자 요청: 무지개 색상 그라데이션)
        const tipX = center + (radius - 10) * Math.cos(angle);
        const tipY = center + (radius - 10) * Math.sin(angle);
        
        const rainbow = ctx.createLinearGradient(center, center, tipX, tipY);
        rainbow.addColorStop(0, '#ff0000'); // 빨강
        rainbow.addColorStop(0.2, '#ff7f00'); // 주황
        rainbow.addColorStop(0.4, '#ffff00'); // 노랑
        rainbow.addColorStop(0.6, '#00ff00'); // 초록
        rainbow.addColorStop(0.7, '#0000ff'); // 파랑
        rainbow.addColorStop(0.85, '#4b0082'); // 남색
        rainbow.addColorStop(1, '#9400d3'); // 보라

        ctx.shadowBlur = 20;
        ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        ctx.moveTo(center, center);
        ctx.lineTo(tipX, tipY);
        ctx.strokeStyle = rainbow;
        ctx.lineWidth = 7;
        ctx.lineCap = 'round';
        ctx.stroke();

        // 중앙 코어 (현재 일정 표시)
        const isMobile = window.innerWidth <= 768;
        const coreRadius = isMobile ? 95 : 65; // 모바일 중앙 구멍 크기 재조정 (도넛 두께 확보)

        ctx.beginPath();
        ctx.arc(center, center, coreRadius, 0, 2 * Math.PI);
        ctx.fillStyle = '#1e293b';
        ctx.fill();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = isMobile ? 2 : 3;
        ctx.stroke();

        if (currentTask) {
            ctx.fillStyle = '#38bdf8';
            ctx.font = isMobile ? 'bold 13px Inter' : 'bold 16px Inter';
            ctx.fillText('현재 일정', center, center - (isMobile ? 25 : 15));
            
            ctx.fillStyle = '#ffffff';
            const content = currentTask.content;
            
            if (isMobile) {
                // 모바일: 글자 길이에 따른 자동 줄바꿈 및 크기 조절
                let fontSize = 18;
                if (content.length > 6) fontSize = 15;
                if (content.length > 10) fontSize = 12;
                
                ctx.font = `bold ${fontSize}px Inter`;
                
                if (content.indexOf(' ') !== -1) {
                    // 공백이 있으면 공백 기준으로 나눔
                    const words = content.split(' ');
                    const mid = Math.ceil(words.length / 2);
                    const line1 = words.slice(0, mid).join(' ');
                    const line2 = words.slice(mid).join(' ');
                    
                    ctx.fillText(line1, center, center + 5);
                    ctx.fillText(line2, center, center + 5 + fontSize + 8); // 줄간격 8px 추가
                } else if (content.length > 8) {
                    // 공백이 없는데 길면 어쩔 수 없이 중간을 나눔 (단어 파괴 방지를 위해 폰트를 더 줄임)
                    const mid = Math.ceil(content.length / 2);
                    ctx.font = `bold ${fontSize - 2}px Inter`;
                    ctx.fillText(content.substring(0, mid), center, center + 5);
                    ctx.fillText(content.substring(mid), center, center + 5 + fontSize + 6);
                } else {
                    ctx.fillText(content, center, center + 10);
                }
            } else {
                ctx.font = 'bold 20px Inter';
                ctx.fillText(content.substring(0, 15), center, center + 12);
            }
        } else {
            ctx.fillStyle = '#64748b';
            ctx.font = isMobile ? '600 13px Inter' : '600 16px Inter';
            ctx.fillText('일정 없음', center, center);
        }

        ctx.shadowBlur = 0;
    }

    animate() {
        const render = () => {
            const time = getVietnamTime();
            this.ctx.clearRect(0, 0, this.size, this.size);
            this.drawFace();
            this.drawHand(time);
            requestAnimationFrame(render);
        };
        render();
    }
}
