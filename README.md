# My Planner

개인용 일정 관리 웹앱. Next.js + Supabase + Telegram Bot.

## 구성
- **왼쪽**: 오늘 할 일 + 체크박스
- **가운데 위**: 월간 달력 (할 일/데드라인 미리보기)
- **가운데 아래**: 가로 슬라이드 데드라인 타임라인
- **오른쪽**: 목표 + 세부목표
- **Telegram 봇**: 할 일/데드라인 추가, 곧 다가오는 일정 알림
- **실시간 동기화**: 휴대폰/PC 어디서든 같은 데이터 (Supabase Realtime)

## 배포 절차

### 1) Supabase 스키마 적용
1. https://supabase.com/dashboard → 프로젝트 → **SQL Editor** → **New query**
2. `supabase/schema.sql` 내용을 붙여넣고 Run

### 2) GitHub 푸시
이미 git 초기화/푸시는 스크립트로 끝남.

### 3) Vercel 배포
1. https://vercel.com/new → GitHub repo `growandrun/my-planner` import
2. **Environment Variables** 에 `.env.local` 내용 그대로 입력 (모든 키):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_ALLOWED_CHAT_ID`
   - `TELEGRAM_WEBHOOK_SECRET` (랜덤 문자열로 교체)
   - `CRON_SECRET` (랜덤 문자열로 교체)
3. Deploy

### 4) Telegram Webhook 등록
배포 후 본인 도메인으로 한 번 접속:
```
https://<your-vercel-domain>/api/setup-webhook?secret=<CRON_SECRET>
```
응답에 `"ok": true` 면 성공.

### 5) 알림 (선택) — GitHub Actions로 15분마다 체크
1. GitHub repo → **Settings → Secrets and variables → Actions** → New repository secret
   - `NOTIFY_URL` = `https://<your-vercel-domain>/api/notify`
   - `CRON_SECRET` = (위에서 정한 값)
2. 자동으로 15분 간격으로 알림이 돕니다.

(Vercel Hobby 플랜은 일 1회 cron만 무료이므로 `vercel.json`은 매일 오전 9시 1회만 백업으로 돌아갑니다.)

## Telegram 사용법
- `/new` → 할 일 / 데드라인 버튼 선택 → 제목 입력 → 메모 입력 → 날짜/시간/중요도 버튼 선택
- `/today` → 오늘 일정 보기
- `/list` → 다가오는 할 일
- `/cancel` → 입력 취소
- `/help` → 도움말

## 로컬 개발
```
npm install
npm run dev
```
http://localhost:3000

## 보안 주의
이 앱은 단일 사용자용. RLS는 켜져 있지만 anon 키로 모든 접근이 가능하므로 URL을 공유하지 마세요.
강화하려면 Supabase Auth(`legal` 옵션)로 변경하거나 Vercel Password Protection을 켜세요.
