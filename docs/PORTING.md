# 다른 PC로 옮기기

이 저장소만 클론하면 **개발은 바로** 되고, **배포는 두 가지를 손으로 옮겨야** 한다.

| | 저장소에 있나 | 왜 |
|---|---|---|
| 소스·스키마·배포 스크립트·Nginx 설정 | ✅ | |
| 규칙 문서(`CLAUDE.md`·`AGENTS.md`) · 스펙 · 디자인가이드 | ✅ `docs/handoff/` | |
| **SSH 개인키** | ❌ | 이게 유출되면 서버가 통째로 넘어간다 |
| **`.env.local`의 실제 값** | ❌ | DB 비밀번호 |
| 디자인 확정안 프로토타입 (17MB HTML) | ❌ | 저장소를 무겁게 한다 |
| 참조 리포(명율·PaRaSOL) | ❌ | 별개 프로젝트 |

---

## 1. 클론 · 의존성

```
git clone https://github.com/rollkim/MySiteSol_oh4989.git oh4989
cd oh4989
npm install
```

## 2. `.env.local` 작성

```
cp .env.example .env.local
```

값을 채운다. **`DATABASE_URL`의 포트에 주의** — 개발은 SSH 터널이라 **15432**, 서버는 5432다.

```
DATABASE_URL=postgresql://oh4989_app:<비밀번호>@127.0.0.1:15432/oh4989
```

비밀번호를 모르면 서버에서 재설정한다 (SCRAM 해시라 되읽을 수 없다):

```
su - postgres -c /usr/lib/postgresql/17/bin/psql
```
→ `\password oh4989_app` → `\q`

바꿨으면 **서버의 `~/shared/oh4989.env`도 같은 값으로** 고쳐야 한다.

## 3. SSH 키 — 배포의 전제

배포(`npm run deploy`)는 `scp`·`ssh`로 22번 포트를 쓴다. **키 인증이 안 되면 배포가 멈춘다.**

### 방법 A — 기존 키를 옮긴다 (권장)

기존 PC의 `%USERPROFILE%\.ssh\id_ed25519`(개인키)와 `.pub`를 새 PC의 같은 위치로 복사한다.

> **USB나 암호화된 경로로 직접 옮긴다.** 메일·메신저·클라우드 드라이브에 올리지 않는다.
> 개인키는 그 자체로 서버 접속 권한이다.

권한 확인 (Windows는 파일 소유자만 읽을 수 있어야 한다):

```
icacls "%USERPROFILE%\.ssh\id_ed25519" /inheritance:r /grant:r "%USERNAME%:R"
```

### 방법 B — 새 키를 만들어 추가 등록

기존 키를 옮기기 어려우면 새 PC에서 새로 만들고, **서버의 `authorized_keys`에 한 줄 추가**한다(기존 키는 그대로 둔다 — 두 PC 모두에서 배포할 수 있게).

새 PC에서:
```
ssh-keygen -t ed25519
```
```
type %USERPROFILE%\.ssh\id_ed25519.pub
```

출력된 한 줄을 복사해, **서버(root)** 에서:
```
echo '<복사한 공개키 한 줄>' >> /home/oh4989/.ssh/authorized_keys
```
```
chown oh4989:oh4989 /home/oh4989/.ssh/authorized_keys && chmod 600 /home/oh4989/.ssh/authorized_keys
```

### 확인

```
ssh -o BatchMode=yes oh4989@1.234.79.54 "id -un"
```

`oh4989`가 **비밀번호 없이** 나오면 성공이다. (`whoami`는 이 서버에서 실행 권한이 막혀 있으니 `id -un`을 쓴다)

## 4. ⚠️ 카페24 웹방화벽 — 새 PC의 IP 등록

카페24 콘솔에서 **22번 포트를 특정 IP만 허용**하도록 제한해 두었다.
**새 PC(또는 새 회선)의 공인 IP를 허용 목록에 추가하지 않으면 3번이 `Connection timed out`으로 막힌다.**

현재 공인 IP 확인:
```
curl -s https://ifconfig.me
```

## 5. 배포 확인

```
npm run deploy
```

`4/4 외부 응답 확인 → HTTP 200`까지 나오면 이전 완료다. 실패하면 서버에서 `./deploy.sh rollback`.

---

## 선택 — 저장소에 없는 참조 자료

없어도 개발에 지장 없다. 필요하면 옮긴다.

| | 원래 위치 | 용도 |
|---|---|---|
| 확정안 프로토타입 (17MB) | `C:\_Hope\Ohsite\_핸드오프\확정안_프로토타입.html` | 브라우저로 열어 화면 확인. **재구현 대상이지 복사 대상이 아니다** |
| 명율 리포 | `C:\_Hope\myoungyul\mysite` | 가격 파서 등 부분 참조 |
| PaRaSOL 리포 | `C:\_Hope\PaRaSOL\parasolv1` | 레이어 구조·auth 패턴 참조 |
| 프로젝트 문서(작업로그·계획) | `C:\_Dev\_md_doc\conlab\projects\ocy\` | Obsidian Vault. 별도로 동기화한다 |

옮겼다면 `CLAUDE.md`의 참조 문서 표에서 경로를 새 PC에 맞게 고친다.

---

## 서버는 건드릴 것이 없다

서버(`1.234.79.54`)는 이미 구축돼 있고 PC를 바꿔도 그대로다. 재구축이 필요할 때만 `docs/`가 아닌 Obsidian의 `계획_서버셋업(oh4989-server-setup)_20260805.md`를 본다 — **함정 10건이 거기 정리돼 있다.**
