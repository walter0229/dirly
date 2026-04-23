-- 1. 일정 테이블 생성
CREATE TABLE IF NOT EXISTS schedules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date DATE NOT NULL,
    time TIME NOT NULL,
    category TEXT CHECK (category IN ('회사', '운동', '자기관리', '기타')),
    content TEXT,
    status TEXT DEFAULT 'incomplete',
    memo TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(date, time) -- 날짜와 시간 조합은 유일해야 함
);

-- 2. 운동 통계 테이블 생성
CREATE TABLE IF NOT EXISTS exercises (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date DATE NOT NULL,
    name TEXT NOT NULL,
    value INTEGER,
    unit TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS (Row Level Security) 설정 (필요 시)
-- 모든 사용자가 읽고 쓸 수 있도록 설정 (Anon 키 사용 기준)
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON schedules FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON exercises FOR ALL USING (true) WITH CHECK (true);
