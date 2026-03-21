# Agent Working Notes

이 문서는 이 저장소에서 작업할 때 에이전트와 협업자가 공통 규칙으로 삼을 만한 운영 메모입니다.
기본 기여 규칙은 `CONTRIBUTING.md`, 실행/환경 설정은 `README.md`를 우선 참고하고, 이 문서는 실제 작업 과정에서 자주 헷갈렸던 판단 기준을 보완합니다.

## 1. 작업 대상과 기준 경로

- 현재 주 개발 대상은 `apps/web`, `apps/server`, `packages/game-core` 입니다.
- `api/*`, `server.js`, `script.js`, `game/*` 는 레거시 경로이므로 기본 구현 대상이 아닙니다.
- 작업을 시작하기 전에 반드시 현재 `cwd`, Git 브랜치, 원격 저장소를 확인합니다.
- 같은 저장소의 복사본이 여러 개 있을 수 있으므로, 한 번 작업 기준 복사본을 정하면 중간에 섞지 않습니다.

## 2. Git / GitHub 작업 규칙

- `main` 브랜치는 보호되어 있으므로 직접 push 하지 않습니다.
- 모든 변경은 토픽 브랜치에서 작업하고 PR로 머지합니다.
- 브랜치 이름은 아래 접두어를 사용합니다.
  - `feat/*` : 기능 추가
  - `fix/*` : 버그 수정
  - `chore/*` : 운영, 툴링, 유지보수
  - `docs/*` : 문서 전용
- 가능하면 이슈 번호를 브랜치 이름에 포함합니다.
  - 예: `feat/issue-26-panel-layout`
- 커밋 메시지는 `영문 prefix + 한글 제목` 형식을 사용합니다.
  - 예: `feat: 패널 접기와 접힘 상태 저장 추가`
  - 예: `fix: 오버월드 WASD 이동 잠금 흐름 수정`
- 아주 작은 문서 수정이 아니면 PR은 이슈와 연결합니다.
- PR 범위가 처음보다 커졌다면 제목과 본문도 현재 범위에 맞게 갱신합니다.
- PR 머지 후에는 로컬 `main`을 최신화하고, 작업 브랜치를 정리합니다.

## 3. GitHub CLI 사용 규칙

- `gh` 사용 전 기본 저장소가 맞는지 확인합니다.
  - 확인: `gh repo set-default --view`
  - 설정: `gh repo set-default Ron-kim-dlab/RPG`
- 기본 저장소가 헷갈릴 때는 항상 `--repo Ron-kim-dlab/RPG`를 명시합니다.
- 특히 PR, issue, Actions 조회는 저장소가 잘못 잡히면 전혀 다른 결과가 나오므로 먼저 확인합니다.
- 주의: GitHub secret 관련 명령은 기본 저장소 설정을 믿지 말고 가능하면 `--repo`를 명시합니다.

## 4. 로컬 실행 / 환경변수 규칙

- Windows 환경에서는 가능하면 WSL 또는 Unix 계열 셸을 기준으로 작업합니다.
- 개인 로컬 오버라이드는 `.env.local`에 두고 커밋하지 않습니다.
- 서버 포트를 바꾸면 아래 두 값도 함께 점검합니다.
  - `apps/web/.env` 또는 `apps/web/.env.local`의 `VITE_API_BASE_URL`
  - `apps/server/.env` 또는 `apps/server/.env.local`의 `CLIENT_ORIGIN`
- 빠른 로컬 테스트는 `STORAGE_DRIVER=memory`를 우선 사용합니다.
- 저장 유지가 필요한 테스트는 `STORAGE_DRIVER=mongo`와 로컬 MongoDB를 사용합니다.
- LAN 테스트가 필요할 때는 웹을 `--host 0.0.0.0`으로 띄우고, 서버 `CLIENT_ORIGIN`에 실제 접속 origin을 추가합니다.

## 5. 구현 시 판단 기준

- UI 작업은 데스크톱 기준 경험을 우선 정리하되, 모바일/좁은 화면에서 레이아웃이 깨지지 않도록 fallback을 유지합니다.
- 패널, 레이아웃, HUD 관련 상태를 추가할 때는 `UI 저장 / UI 불러오기 / UI 초기화` 흐름과 일관되게 동작하는지 함께 확인합니다.
- 인증, 저장, 실시간 통신을 건드릴 때는 최소한 아래 흐름을 다시 확인합니다.
  - 회원가입 / 로그인
  - 저장 / 불러오기
  - 소켓 연결 / 재접속
  - 같은 씬 `presence` / 채팅
- 전투, 성장, 콘텐츠 변환 로직을 건드릴 때는 가능하면 `packages/game-core`에서 먼저 해결하고, 웹/서버가 그 로직을 공유하도록 유지합니다.
- 월드나 맵 메타데이터를 수정할 때는 scene 링크, spawn 위치, collision, asset 경로가 같이 맞는지 확인합니다.

## 6. 품질 체크 규칙

- 작업 전부를 매번 풀로 돌릴 필요는 없지만, 머지 전에는 최소한 아래 검증을 통과시키는 것을 원칙으로 합니다.
  - `corepack pnpm lint`
  - `corepack pnpm typecheck`
  - `corepack pnpm test`
  - `corepack pnpm build`
- 반복 작업 중에는 `--filter`를 사용해 해당 패키지만 빠르게 검증해도 됩니다.
  - 예: `corepack pnpm --filter @rpg/web test`
- 최종 머지 기준은 GitHub의 `quality` 체크 통과입니다.

## 7. 보안 규칙

- 실제 비밀값, 운영용 DB 자격 증명, 토큰은 절대 커밋하지 않습니다.
- 한 번이라도 노출이 의심된 자격 증명은 재사용하지 말고 회전합니다.
- 운영 환경에서는 `STORAGE_DRIVER=memory`를 사용하지 않습니다.
- 비밀값 회전이나 배포 비밀값 교체 전후에는 아래 문서를 우선 확인합니다.
  - `docs/security-checklist.md`
  - `docs/secret-rotation.md`

## 8. 자주 헷갈리는 포인트

- VS Code의 `Sync Changes`가 `main`에서 실패하면, 보호된 `main`에 직접 push하려고 한 경우가 많습니다.
- `gh` 조회 결과가 이상하면 기본 저장소가 다른 repo로 잡혀 있는지 먼저 확인합니다.
- 오래된 브랜치나 복사본에서 작업을 시작하면 이미 머지된 내용을 다시 건드릴 수 있으므로, 본격 작업 전에 `main` 최신화와 기준 브랜치 확인을 먼저 합니다.
- PR에 새 커밋을 추가해 범위가 넓어졌다면, "중복 PR"이 아니라 "같은 PR에 추가 커밋"인지부터 확인합니다.

## 9. 권장 시작 순서

작업을 시작할 때는 가능하면 아래 순서를 따릅니다.

1. 현재 작업 복사본과 `cwd` 확인
2. `git status`와 현재 브랜치 확인
3. `main` 최신화
4. 이슈 확인 후 토픽 브랜치 생성
5. 필요한 범위만 구현
6. 관련 패키지 위주로 로컬 검증
7. 커밋
8. PR 생성 및 `quality` 확인
9. 머지 후 로컬 `main` 동기화
