# 🎉 모임

단발 모임의 **공지 · 참석 집계 · 비용 정산**을 링크 하나로 끝내는 이벤트 관리 서비스입니다.
주최자만 계정을 만들고, 참여자는 가입 없이 링크에서 이름만 입력해 응답합니다.

**운영 주소**: <https://nextjs-supabase-app-virid.vercel.app>

> Supabase 공식 `with-supabase` 스타터에서 출발한 개인 프로젝트이며, 현재 MVP를 운영에 배포한 상태입니다.

<p align="center">
  <a href="#해결하려는-문제"><strong>문제</strong></a> ·
  <a href="#주요-기능"><strong>기능</strong></a> ·
  <a href="#화면-구성"><strong>화면</strong></a> ·
  <a href="#기술-스택"><strong>기술 스택</strong></a> ·
  <a href="#설계-특징"><strong>설계 특징</strong></a> ·
  <a href="#로컬에서-실행하기"><strong>실행</strong></a> ·
  <a href="#문서"><strong>문서</strong></a>
</p>

---

## 해결하려는 문제

수영·헬스·러닝·친구 모임을 한 번씩 여는 주최자가 카카오톡 단체방에서 겪는 네 가지 불편입니다.

1. 공지가 스크롤에 묻혀 "어디서 몇 시였죠?"가 반복된다.
2. 참석 인원을 댓글·이모지로 세다가 중복·번복으로 숫자가 틀린다.
3. "나중에 말씀드릴게요"가 그대로 미정으로 남아 확정 시점을 놓친다.
4. 정산할 때 1인당 금액을 손으로 계산하고 입금 여부를 한 명씩 추적한다.

이 네 가지만 정확히 없애는 것이 MVP의 범위입니다. 카풀·정기 모임·알림·결제 연동은 의도적으로 제외했습니다.

## 주요 기능

**주최자 (로그인 필요)**

- **모임 만들기·수정** — 제목, 일시, 장소, 설명, 정원, 응답 마감, 미정 확정 기한
- **공유 링크** — 추측 불가능한 토큰 링크, 만료 시각 설정(기본: 모임 당일 자정), 재발급(기존 링크 무효화)
- **응답 관리** — 참석 / 불참 / 미정 탭, 정원 초과 대기 순번, 미정 기한 초과 배지, 응답 변경 이력 타임라인
- **공지** — 여러 개 작성, 고정 공지는 항상 최대 1개
- **정산** — 비용 항목 입력 → 참석자 균등분할(10원 단위 절상) → 입금 체크 → 미수금 합계, 게스트에게 공개
- **삭제** — 모임 제목을 다시 입력해야 실행되는 소프트 삭제

**참여자 (가입 없음)**

- 링크를 열면 공지, 모임 정보, 참석 / 불참 / 미정 명단 전체를 확인
- 이름 + 응답 + 한 줄 메모로 응답하고, 같은 기기에서 다시 열면 본인 응답을 인식해 수정
- 주최자가 정산을 공개하면 본인 분담금과 입금 상태, 계좌 안내를 확인

**공통**

- 이메일/비밀번호, Google, 카카오 로그인
- 카카오톡 공유 시 모임 제목이 보이는 링크 미리보기(OG 이미지)
- 모바일 퍼스트 반응형, 다크 모드, 한국어 UI
- 홈 화면에 설치하는 PWA — 주최자 화면(`/events`)에 설치 배너(Android·Chrome은 설치 버튼, iOS Safari는 "홈 화면에 추가" 안내)

## 화면 구성

| 경로                      | 대상   | 설명                                         |
| ------------------------- | ------ | -------------------------------------------- |
| `/`                       | 공개   | 서비스 소개와 시작하기                       |
| `/auth/*`                 | 공개   | 로그인 · 가입 · 비밀번호 재설정              |
| `/events`                 | 주최자 | 내 모임 목록 (다가오는 / 지난), 미수금 배지  |
| `/events/new`             | 주최자 | 모임 만들기                                  |
| `/events/[id]`            | 주최자 | 개요, 인원 요약, 공유 링크 카드              |
| `/events/[id]/responses`  | 주최자 | 응답 관리와 변경 이력                        |
| `/events/[id]/notices`    | 주최자 | 공지 관리                                    |
| `/events/[id]/settlement` | 주최자 | 정산 · 입금 체크 · 공개                      |
| `/events/[id]/settings`   | 주최자 | 수정 · 응답 마감 · 삭제                      |
| `/e/[token]`              | 게스트 | 초대 페이지 (공지, 명단, 내 응답, 내 분담금) |
| `/e/[token]/respond`      | 게스트 | 응답 폼                                      |

## 기술 스택

- **프레임워크**: Next.js 16 (App Router, Turbopack, Cache Components) · React 19 · TypeScript
- **백엔드**: Supabase (Postgres, Auth, Row Level Security) · `@supabase/ssr`
- **UI**: Tailwind CSS v3.4 · shadcn/ui (new-york) · Radix UI · next-themes · sonner
- **폼·검증**: react-hook-form · Zod 4
- **배포**: Vercel · GitHub Actions CI
- **품질 도구**: ESLint 9 (flat config) · Prettier · Husky + lint-staged

## 설계 특징

**게스트는 테이블을 만지지 못합니다.** 참여자는 계정이 없으므로 `anon` 키로 접근하는데, 7개 테이블 모두 RLS가 켜져 있고 `anon` 대상 정책이 하나도 없습니다. 게스트는 `api` 스키마의 `SECURITY DEFINER` 함수 3개(`guest_get_event`, `guest_submit_rsvp`, `guest_withdraw_rsvp`)만 호출할 수 있고, 토큰·만료·마감·길이 검증을 함수 안에서 다시 수행합니다. 보안 점검 결과는 [`docs/product/phase1-security-gate.md`](./docs/product/phase1-security-gate.md)에 있습니다.

**연락처를 수집하지 않습니다.** 게스트 식별은 표시 이름과 이벤트별로 분리된 `httpOnly` 쿠키(`moim_gk_<event_id 앞 8자>`)가 전부입니다.

**존재 여부를 숨깁니다.** 없는 링크, 만료된 링크, 삭제된 모임은 구분할 수 없는 같은 만료 화면으로 떨어집니다.

**응답 이력은 트리거가 남깁니다.** 상태나 이름이 바뀌면 DB 트리거가 append-only 이력을 기록하므로 어떤 경로로 수정해도 빠지지 않고, 주최자도 이력을 조작할 수 없습니다. 이력과 타인의 메모는 주최자 화면에만 나타납니다.

**정산 금액은 스냅샷입니다.** 분담금을 계산하는 시점의 참석자를 복사해 두므로 이후 응답이 바뀌어도 이미 산출된 금액은 흔들리지 않고, 재계산할 때 입금 상태를 승계합니다. 동시 수정은 서버에서 참석자 집합을 다시 비교해 막습니다.

**접근 제어는 한 곳입니다.** 루트 `proxy.ts` → `lib/supabase/proxy.ts`의 조건문 하나가 전체 라우트 보호를 맡고, 로그인 없이 열리는 경로는 `/`, `/auth/*`, `/e/*`, `/api/guest/*`뿐입니다.

**설치는 되지만 오프라인은 지원하지 않습니다.** `app/manifest.ts`와 아이콘만 두고 서비스워커는 두지 않았습니다. 명단·정산처럼 로그인이 필요한 페이지를 캐시하면 로그아웃 뒤나 다른 계정에서 이전 데이터가 보일 수 있기 때문입니다. 설치 배너는 카카오톡 인앱 브라우저로 들어오는 게스트가 아니라 주최자 화면에만 있습니다. 설치 가능 여부를 판정하는 브라우저는 로그인 없이 매니페스트를 가져가므로 `proxy.ts` matcher에서 `manifest.webmanifest`를 제외했습니다.

## 로컬에서 실행하기

필요한 것: Node.js 24 이상, npm, Supabase 프로젝트

1. 저장소를 받고 의존성을 설치합니다.

   ```bash
   git clone https://github.com/heymrcha/nextjs-supabase-app.git
   cd nextjs-supabase-app
   npm install
   ```

2. [Supabase 대시보드](https://database.new)에서 프로젝트를 만들고 `supabase/migrations/`의 SQL을 오래된 순서대로 적용합니다. Supabase CLI(`supabase db push`)나 SQL Editor를 쓸 수 있습니다.

3. **대시보드 설정**을 반영합니다. 마이그레이션으로 재현되지 않는 항목이라 빠뜨리면 게스트 기능이 동작하지 않습니다.
   - Project Settings → API(Data API) → **Exposed schemas**에 `api`를 추가합니다. 기존 `public`은 유지하고 `private`은 추가하지 않습니다.
   - 자세한 절차와 검증 명령은 [`docs/product/supabase-project-setup.md`](./docs/product/supabase-project-setup.md)에 있습니다.

4. `.env.example`을 `.env.local`로 복사해 값을 채웁니다.

   ```env
   NEXT_PUBLIC_SUPABASE_URL=[Supabase 프로젝트 URL]
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=[publishable 또는 anon 키]
   NEXT_PUBLIC_SITE_URL=   # 선택. 커스텀 도메인을 쓸 때만 지정
   ```

   > 앞의 두 변수 중 하나라도 비어 있으면 proxy의 인증 검사가 건너뛰어져 로그인하지 않아도 보호 페이지가 열립니다.

5. 개발 서버를 실행합니다.

   ```bash
   npm run dev
   ```

   [localhost:3000](http://localhost:3000)에서 확인할 수 있습니다.

Google·카카오 로그인은 Supabase의 Authentication → Providers에서 각 공급자를 켜고 키를 넣어야 동작합니다. 이메일/비밀번호 로그인은 별도 설정 없이 쓸 수 있습니다.

## 개발 명령어

| 명령어              | 설명                                    |
| ------------------- | --------------------------------------- |
| `npm run dev`       | 개발 서버                               |
| `npm run build`     | 프로덕션 빌드                           |
| `npm run check`     | lint + typecheck + format:check 한 번에 |
| `npm run lint`      | ESLint                                  |
| `npm run typecheck` | `tsc --noEmit`                          |
| `npm run format`    | Prettier로 전체 포맷                    |

테스트 스위트는 없습니다. 검증은 `check`, `build`, 브라우저 확인으로 합니다. 커밋 시 lint-staged, 푸시 시 typecheck + lint가 자동으로 돌고, GitHub Actions가 `lint → typecheck → format:check → build`를 실행합니다.

## 프로젝트 구조

```
app/
  events/        주최자 화면 (목록, 생성, 상세 · 응답 · 공지 · 정산 · 설정)
  e/             게스트 화면 (초대 페이지, 응답 폼, 만료, OG 이미지)
  api/guest/     게스트 쓰기의 유일한 입구 (RSVP 제출 · 철회)
  manifest.ts    PWA 매니페스트 (설치용 아이콘은 public/)
  auth/          로그인, 가입, 콜백
components/
  events/        주최자 화면 컴포넌트
  guest/         게스트 화면 컴포넌트
  ui/            shadcn/ui
lib/
  moim/          도메인 로직 (정산 계산, 명단 규칙, 스키마, 쿠키, 포맷)
  supabase/      클라이언트 3종 + 게스트 전용 클라이언트 + 세션 갱신
supabase/migrations/   DB 스키마, RLS, 게스트 함수
types/                 도메인 타입과 생성된 DB 타입
docs/                  PRD, 로드맵, 검증 기록, 개발 가이드
```

## 문서

| 문서                                                                                 | 내용                                     |
| ------------------------------------------------------------------------------------ | ---------------------------------------- |
| [`docs/product/moim-mvp-prd-alt.md`](./docs/product/moim-mvp-prd-alt.md)             | 확정된 PRD (범위, 시나리오, 데이터 모델) |
| [`docs/product/ROADMAP.md`](./docs/product/ROADMAP.md)                               | 개발 로드맵과 단계별 실행 결과           |
| [`docs/product/phase1-security-gate.md`](./docs/product/phase1-security-gate.md)     | 스키마·RLS 보안 점검 결과                |
| [`docs/product/phase6-verification.md`](./docs/product/phase6-verification.md)       | 엣지 케이스 13행 검증 기록               |
| [`docs/product/open-questions.md`](./docs/product/open-questions.md)                 | PRD 미해결 질문과 결론                   |
| [`docs/product/supabase-project-setup.md`](./docs/product/supabase-project-setup.md) | 코드에 남지 않는 Supabase 설정 절차      |
| [`docs/guides/`](./docs/guides)                                                      | 스택별 개발 가이드                       |

## 로드맵

MVP(Phase 0~6), 릴리스 후 개선(Phase 7: 캐주얼 UI, 카톡 미리보기, 카카오 로그인, 앱 아이콘), 설치형 웹앱(Phase 8: PWA 설치)까지 완료했습니다. 다음 후보는 **카풀 → 정기 모임 → 알림 → 참여자 계정(선택 가입)** 순이며 아직 착수하지 않았습니다.

## 알려진 한계

- Supabase Free 플랜에서는 유출 비밀번호 차단(Pro 전용)을 켤 수 없어 advisor 경고가 1건 남습니다.
- 카카오톡은 링크 미리보기를 캐시하므로 모임 제목을 바꿔도 이미 공유된 링크의 미리보기는 그대로입니다.
- 앱 아이콘의 🎉는 Twemoji(CC-BY 4.0)입니다. 정식 서비스 전에 자체 그림으로 교체할 예정입니다.
- 오프라인에서는 동작하지 않습니다(서비스워커 없음). 설치된 앱도 네트워크가 필요합니다.
- Android에서 설치 직후 홈 화면에 아이콘이 자동으로 생기지 않는 기기가 있었습니다. 런처 설정 때문으로 보이며 "홈 화면에 추가"를 따로 해야 할 수 있습니다.
- 이메일 없이 로그인한 카카오 사용자는 같은 사람의 Google 계정과 자동으로 연결되지 않고 별도 회원이 됩니다.
