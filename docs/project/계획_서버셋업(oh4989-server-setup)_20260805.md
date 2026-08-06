---
date: 2026-08-05
project: oh4989
type: 계획
updated: 2026-08-06
---

# oh4989 서버 셋업 가이드 (서버 · DB · 웹)

**대상 서버**: 카페24 가상서버 `1.234.79.54` (호스트명 `ocy0027`)
**실측 사양** (2026-08-05 확인): Ubuntu 24.04.4 LTS · RAM 1.9Gi · SSD 38G(32G 여유) · **CPU 4코어** · **스왑 4GB 기존재**
**전제**: 아래 명령은 **전부 사장님이 직접 실행**합니다 (CLAUDE.md RULE-2 — Claude는 DB·서버에 접속하지 않습니다).

## 진행 상태 (2026-08-06 기준)

| 단계 | 상태 |
|---|---|
| 0 사전확인 | ✅ |
| 1 전용계정 + SSH 키 | ✅ |
| 2 스왑 | ✅ (기존 4GB + swappiness 10) |
| 3 PostgreSQL 17 설치 | ✅ 17.10 |
| 4 DB·롤 생성 | ✅ |
| 5 2GB 튜닝 | ✅ shared_buffers 256MB / max_connections 30 |
| 6 스키마 적용 | ✅ `0000_fresh_maelstrom.sql` (테이블 8 · FK 6 · 인덱스 10) |
| 7 Node·PM2 | ✅ Node 22 · PM2 · `pm2-oh4989.service` (User=oh4989) |
| 8 배포 디렉토리 | ⬜ |
| 9 Nginx·인증서 | ✅ Let's Encrypt (만료 2026-11-04) · HTTP→HTTPS · www→non-www 1회 리다이렉트 |
| 10 방화벽 | ✅ ufw active — 22/80/443만 허용. 5432·3100 외부 차단 확인 |

**서버 셋업 완료 (2026-08-06).** 외부 검증: `https://oh4989.com` 도달 · HTTP→HTTPS·www→non-www 1회 리다이렉트 · Let's Encrypt 인증서(만료 2026-11-04) · 5432/3100 차단.

**추가 보안 (사용자 조치)**: 카페24 웹방화벽에서 **22번을 특정 IP만 허용**하도록 제한함.
⚠️ 배포 파이프라인이 22번(scp·ssh)을 쓰므로, **개발 PC의 공인 IP가 바뀌면 배포가 `Connection timed out`으로 막힌다.** 그때는 카페24 콘솔에서 허용 IP를 갱신한다.

**비root 계정 실행 제약**: `oh4989`는 `perl`과 `whoami`를 실행할 수 없다(카페24 이미지 하드닝). 배포에 쓰는 `tar`·`gzip`·`ln`·`cp`·`rm`·`curl`·`readlink`·`node`·`npm`·`pm2`는 전부 정상. `psql`은 perl 래퍼라 비root로는 실행 불가하나, 앱은 TCP로 붙으므로 무관.

**설정 원본**: `C:\_Hope\Ohsite\oh4989\scripts\nginx-oh4989.conf` (저장소 보관본). 서버 설정을 고칠 일이 생기면 **여기서 고쳐 scp로 올린다** — 서버에서 직접 편집하면 변경 이력이 끊긴다.

---

## ⚠️ 이 서버에서 실제로 막혔던 지점 6개

다시 따라 하거나 다른 서버에 적용할 때 **여기서 시간을 씁니다.**

| # | 증상 | 원인 | 해법 |
|---|---|---|---|
| 1 | `sudo -u postgres psql` → `Permission denied` | `/usr/bin/psql`은 Perl 스크립트(`pg_wrapper`)로 가는 링크인데 **postgres 계정이 `/usr/bin/perl`을 실행할 수 없음** | psql 실체 바이너리를 직접 호출: `su - postgres -c /usr/lib/postgresql/17/bin/psql` |
| 2 | `CREATE DATABASE` 후 프롬프트가 `postgres-#` | **세미콜론 누락.** `=#`는 입력 대기, `-#`는 문장 미완 | 여러 줄 SQL은 **한 줄로 합쳐서** 붙여넣기 |
| 3 | `fallocate: Text file busy` | `/swapfile`이 이미 활성 스왑 | 카페24가 4GB를 미리 잡아둠 — 생성 단계 자체를 건너뜀 |
| 4 | `scp` → `Could not resolve hostname c` | **서버에서 실행함.** 리눅스 scp가 `C:\...`의 `C:`를 호스트명으로 해석 | scp는 **반드시 로컬 PC(PowerShell)에서** |
| 5 | SSH 키 등록했는데 `Permission denied (publickey)` | `authorized_keys`가 **0바이트**. `type $env:USERPROFILE\...` 파이프가 서버 셸에서 빈 값을 흘림 | 공개키를 **서버에서 직접 `echo`로 기록** (아래 1단계) |
| 6 | `pm2 startup`이 `pm2---hp.service` 생성 | `su -c`로 실행하면 PM2가 `$USER`를 못 읽어 `-u` 가 빈 값이 되고 `--hp`가 사용자명 자리로 밀림 | **root에서 `-u oh4989` 명시**해 직접 실행 |
| 7 | 마이그레이션 재실행 시 `ERROR: ... already exists` 23줄 | **이미 적용된 스키마를 다시 실행**한 것 | **정상이고 무해합니다.** 모든 문장이 실패 = 아무것도 변경되지 않음. `\dt`로 개수만 확인하면 됨. 적용 여부는 작업로그로 관리 |
| 8 | nginx는 `0.0.0.0:80` 리슨 중이고 ufw·iptables도 비어 있는데 **밖에서 접속 불가** | **카페24 외부 방화벽.** 기본은 22(SSH)만 열려 있다 | **카페24 관리 콘솔에서 80·443 개방.** 서버 안만 봐서는 절대 안 보이므로, 원인 추적 전에 먼저 확인할 것 |
| 9 | 채팅에서 복사한 nginx 설정의 `server_name`이 `[www.oh4989.com](https://...)` 로 깨짐 | 채팅 클라이언트가 도메인을 **마크다운 링크로 자동 변환** | `nginx -t`는 통과하지만 www 요청이 매칭되지 않는다. **설정은 저장소 파일로 만들어 scp**로 올릴 것 |
| 10 | 서버에서 셸 스크립트 실행 시 `$'\r': command not found` | **Windows CRLF 줄바꿈.** 리눅스 bash는 `\r`을 명령의 일부로 읽는다 | 서버로 보내는 `.sh`는 **반드시 LF로 저장**한다. `deploy.sh`·`ecosystem.config.cjs` 작성 시 필수 확인 사항 |

---

## 단계별 실행 계정

카페24 가상서버는 root 접속이 기본입니다. **설치·시스템 설정은 root로 하되, 아래 ★ 두 곳만 `oh4989` 계정으로** 합니다.

| 단계 | 계정 |
|---|---|
| 0 사전확인 · 1 계정생성 · 2 스왑 · 3 PostgreSQL 설치 | root |
| 4 DB·롤 생성 | root에서 `su - postgres -c /usr/lib/postgresql/17/bin/psql` |
| 5 튜닝 · 7 Node·PM2 설치 · 9 Nginx · 10 방화벽 | root |
| 6 스키마 적용 | root 또는 `oh4989` (TCP 접속이라 무관) |
| **8 배포 디렉토리** | **★ `oh4989`** |
| **7 `pm2 startup`** | **★ root에서 `-u oh4989` 명시** (표 #6 참조) |

**PM2가 `oh4989`로 돌아야 하는 이유**: 웹 요청을 처리하는 Node 프로세스가 root 권한을 갖게 됩니다. 이 앱은 관리자 화면에서 **파일 업로드를 받아 디스크에 씁니다** — 경로 검증에 구멍이 하나 생겼을 때 root면 서버 전체가, `oh4989`면 그 계정 홈 안에서 끝납니다.

**배포 디렉토리를 root 홈에 두면 안 되는 이유**: Nginx 설정이 `/home/oh4989/current/...`를 가리키고, `/root`는 Nginx가 읽을 수 없어 정적 파일이 전부 404가 됩니다.

## 이 서버가 PaRaSOL(명율)과 다른 점

| | 명율 서버 (PaRaSOL) | oh4989 |
|---|---|---|
| 서버 성격 | 기존 운영 서비스와 동거 → 격리가 최우선 | 전용 서버 |
| RAM | 여유 있음 | **2GB — 튜닝이 선택이 아니라 필수** |
| 빌드 위치 | 로컬 | 로컬 (**서버 빌드 금지**, 2GB로는 OOM) |
| 이미지 처리 | sharp | **브라우저 Canvas — 서버에 sharp 불필요** |
| PostgreSQL 튜닝 | "기본값으로 시작" | **처음부터 조정** (기본 `max_connections=100`은 2GB에 과함) |

---

## 0단계 — 사전 확인 ✅

```
cat /etc/os-release; echo ---; free -h; echo ---; df -h /; echo ---; swapon --show; echo ---; nproc; echo ---; psql --version 2>/dev/null; systemctl is-active postgresql 2>/dev/null; node -v 2>/dev/null; nginx -v 2>&1; echo ---; id oh4989 2>/dev/null
```

---

## 1단계 — 전용 계정 + SSH 키 인증 ✅

> ⚠️ `C:\_Dev\_md_doc\conlab\projects\ocy\info.md`에 root 비밀번호가 평문으로 있습니다. **키 인증 전환 후 비밀번호를 교체하고 그 파일을 지우세요.**
> 추가로, DB 롤 비밀번호를 root와 **같은 값으로 재사용하지 마세요** (2026-08-06 실제로 발생 → `\password`로 교체함).

**1-1. 계정 생성** (root)

```
adduser oh4989
usermod -aG sudo oh4989
```

**1-2. SSH 키** — 로컬에 이미 있으면 **절대 다시 만들지 않습니다.** 재생성하면 명율(PaRaSOL) 서버 자동배포가 즉시 깨집니다.

로컬에서 확인:

```
ssh-keygen -lf $env:USERPROFILE\.ssh\id_ed25519.pub
```

없을 때만 생성:

```
ssh-keygen -t ed25519
```

**1-3. 공개키 등록** — 파이프 방식(`type ... | ssh ...`)은 실패 사례가 있으므로(표 #5) **서버에서 직접 기록**합니다.

로컬에서 공개키 내용을 확인한 뒤:

```
Get-Content $env:USERPROFILE\.ssh\id_ed25519.pub
```

서버(root)에서 그 한 줄을 그대로 넣습니다:

```
echo '<위에서 복사한 공개키 한 줄>' > /home/oh4989/.ssh/authorized_keys
mkdir -p /home/oh4989/.ssh
chown -R oh4989:oh4989 /home/oh4989/.ssh
chmod 700 /home/oh4989/.ssh
chmod 600 /home/oh4989/.ssh/authorized_keys
ssh-keygen -lf /home/oh4989/.ssh/authorized_keys
```

마지막 줄의 지문이 로컬 지문과 **일치해야** 합니다.

**1-4. 키 접속 확인** (로컬) — 비밀번호를 안 묻고 `oh4989`가 나와야 합니다

```
ssh -o BatchMode=yes oh4989@1.234.79.54 "whoami"
```

**1-5. 비밀번호 로그인 차단** (root) — ⚠️ **1-4 성공 후에만.** 현재 root 세션은 열어둔 채 실행하고, 새 터미널에서 접속을 재확인한 뒤 닫습니다.

```
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/; s/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config && systemctl restart ssh
```

이후 root 직접 SSH는 막히고 `oh4989` → `sudo -i` 경로만 남습니다. 최후 수단은 카페24 관리 콘솔입니다.

---

## 2단계 — 스왑 ✅

**이 서버는 카페24가 4GB를 미리 잡아뒀습니다** (`/swapfile`, fstab 등록 완료). 생성 불필요 — 시도하면 `Text file busy`가 납니다.

swappiness만 낮춥니다 (기본 60은 DB 서버에 과하게 적극적):

```
echo 'vm.swappiness=10' > /etc/sysctl.d/99-swappiness.conf && sysctl --system && cat /proc/sys/vm/swappiness
```

> 스왑이 없는 서버라면: `fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile && echo '/swapfile none swap sw 0 0' >> /etc/fstab`

---

## 3단계 — PostgreSQL 17 설치 ✅

Ubuntu 24.04 기본 저장소는 16이라 공식 저장소(PGDG)를 씁니다.

```
apt update && apt install -y postgresql-common
```

```
/usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y
```

```
apt install -y postgresql-17 postgresql-contrib-17
```

```
systemctl is-active postgresql && psql --version
```

---

## 4단계 — DB · 롤 생성 ✅

**psql 진입** — `sudo -u postgres psql`은 이 서버에서 동작하지 않습니다(표 #1):

```
su - postgres -c /usr/lib/postgresql/17/bin/psql
```

psql 안에서 **한 줄씩** 실행합니다 (여러 줄 붙여넣기는 세미콜론 누락 사고가 납니다 — 표 #2):

```sql
CREATE ROLE oh4989_app LOGIN PASSWORD '강한_비밀번호';
```
```sql
CREATE DATABASE oh4989 OWNER oh4989_app ENCODING 'UTF8' TEMPLATE template0 LC_COLLATE 'C.UTF-8' LC_CTYPE 'C.UTF-8';
```
```
\c oh4989
```
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```
```sql
REVOKE ALL ON SCHEMA public FROM PUBLIC;
```
```sql
GRANT ALL ON SCHEMA public TO oh4989_app;
```
```sql
ALTER DATABASE oh4989 SET timezone TO 'Asia/Seoul';
```

**비밀번호를 나중에 바꿀 때**는 `ALTER ROLE ... PASSWORD` 대신 `\password oh4989_app`를 쓰세요 — 평문이 `~/.psql_history`와 서버 로그에 남지 않습니다.

**`C.UTF-8` 콜레이션을 쓰는 이유**: ① 완성형 한글은 유니코드 코드포인트 순 = 가나다 순이라 동 이름 정렬이 정상 ② glibc 콜레이션과 달리 **OS 업그레이드로 기존 인덱스가 조용히 깨지는 문제가 없음**.

**접속 확인**:

```
psql "postgresql://oh4989_app@127.0.0.1:5432/oh4989" -c "SELECT extname FROM pg_extension;" -c "SHOW timezone;"
```

`.env`에 넣을 형식 (값은 사장님만 다룹니다 — RULE-1):

```
DATABASE_URL=postgresql://oh4989_app:<비밀번호>@127.0.0.1:5432/oh4989
```

기본 설정이 localhost만 listen하므로 그대로 둡니다. **5432를 외부에 여는 일은 없습니다** — 개발 PC에서는 SSH 터널로 붙습니다.

---

## 5단계 — RAM 2GB / CPU 4코어 튜닝 ✅

기본값은 넉넉한 서버를 가정합니다. 특히 `max_connections = 100`은 커넥션마다 프로세스를 띄우므로 2GB에서 위험합니다(앱 풀은 10이면 충분). 4코어를 본 PostgreSQL이 켜는 병렬 쿼리도 **워커마다 `work_mem`을 따로 잡아** 메모리를 배로 씁니다.

```
tee /etc/postgresql/17/main/conf.d/oh4989.conf > /dev/null <<'EOF'
shared_buffers = 256MB           # RAM의 약 12%. 나머지는 OS 캐시와 앱에 남긴다
effective_cache_size = 768MB     # 플래너 힌트(실제 점유 아님)
maintenance_work_mem = 64MB      # VACUUM·인덱스 생성용. 평상시 점유하지 않는다
max_connections = 30             # 앱 풀 10 + psql·백업 여유
random_page_cost = 1.1           # SSD — 랜덤 읽기가 순차와 비슷하다
effective_io_concurrency = 200   # SSD 동시 IO
max_worker_processes = 4         # CPU 4코어
max_parallel_workers_per_gather = 1  # 병렬 워커가 work_mem을 따로 잡는다
EOF
```

```
systemctl restart postgresql && psql "postgresql://oh4989_app@127.0.0.1:5432/oh4989" -c "SHOW shared_buffers;" -c "SHOW max_connections;"
```

기대: `256MB` / `30`

---

## 6단계 — 스키마 적용 ⬜

**6-1. 파일 전송 — ⚠️ 반드시 로컬 PC(PowerShell)에서** (서버에서 실행하면 표 #4)

```
scp "C:\_Hope\Ohsite\oh4989\drizzle\0000_fresh_maelstrom.sql" oh4989@1.234.79.54:~/
```

**6-2. 적용** (서버)

```
psql "postgresql://oh4989_app@127.0.0.1:5432/oh4989" -f /home/oh4989/0000_fresh_maelstrom.sql
```

`CREATE TABLE` ×8 → `ALTER TABLE` ×6 → `CREATE INDEX` ×10.
**`ERROR`가 하나라도 뜨면 멈추고 확인하세요** — psql은 오류가 나도 다음 문장을 계속 실행하므로 부분 적용 상태가 만들어집니다.

**6-3. 확인** — 테이블 8개 / 인덱스 18개(PK 8 + 명시 10)

```
psql "postgresql://oh4989_app@127.0.0.1:5432/oh4989" -c "\dt" -c "SELECT count(*) FROM pg_indexes WHERE schemaname='public';"
```

> `drizzle-kit migrate`를 쓰지 않으므로(RULE-2) **적용한 마이그레이션 번호를 작업로그에 기록**합니다. 다음 변경은 `0001_*.sql`을 같은 방식으로 올려 실행합니다.

---

## 7단계 — Node 22 + PM2 🔶

```
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt install -y nodejs && npm i -g pm2 && node -v && pm2 -v
```

**부팅 자동기동 등록 — root에서 `-u oh4989`를 명시해 직접 실행합니다** (`su -c "pm2 startup"`은 사용자명이 비어 나옵니다 — 표 #6):

```
env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u oh4989 --hp /home/oh4989
```

**확인** — `User=oh4989`와 `PM2_HOME=/home/oh4989/.pm2` 두 줄이 핵심입니다:

```
ls -l /etc/systemd/system/pm2-*.service; systemctl is-enabled pm2-oh4989; grep -E '^(User|Environment=PM2_HOME|PIDFile)' /etc/systemd/system/pm2-oh4989.service
```

> **2026-08-06 이력**: 처음에 root로 실행해 `pm2-root.service`가, 이어서 `su -c` 방식으로 `pm2---hp.service`가 잘못 생성됐다. 둘 다 아래 방식으로 제거 후 위 명령으로 재등록해 정상화 완료. 같은 상황이 재발하면 서비스명만 바꿔 쓴다.
>
> ```
> systemctl disable pm2-<서비스명>; rm -f /etc/systemd/system/pm2-<서비스명>.service /etc/systemd/system/multi-user.target.wants/pm2-<서비스명>.service; systemctl daemon-reload
> ```

> **npm 업그레이드 알림은 무시합니다.** 이 서버는 빌드하지 않고 산출물을 실행만 하므로 npm 버전을 올릴 이유가 없습니다.
>
> **서버에 설치하지 않는 것**: sharp(브라우저 Canvas로 처리) · git(로컬 빌드 후 tar 전송) · 빌드 툴체인.

---

## 8단계 — 배포 디렉토리 ⬜ (★ `oh4989` 계정)

```
su - oh4989 -c "mkdir -p ~/releases ~/shared/uploads ~/shared/logs && chmod 700 ~/shared && ls -la ~"
```

- `~/releases/a`, `~/releases/b` — 번갈아 쓰는 릴리스 슬롯 (항상 직전 버전 1개 보존)
- `~/current` — 둘 중 하나를 가리키는 심볼릭 링크
- `~/shared/uploads` — 매물 사진. **릴리스 폴더 밖**이라 재배포에도 남습니다
- `~/shared/logs` — PM2 로그
- `~/shared/oh4989.env` — 운영 환경변수. 배포 때마다 릴리스로 복사됩니다 (tar에는 들어가지 않습니다)

**env 파일 작성**:

```
su - oh4989 -c "nano ~/shared/oh4989.env"
```

```
DATABASE_URL=postgresql://oh4989_app:<비밀번호>@127.0.0.1:5432/oh4989
SESSION_SECRET=
NEXT_PUBLIC_KAKAO_MAP_KEY=
KAKAO_REST_KEY=
NEXT_PUBLIC_SITE_URL=https://oh4989.com
UPLOAD_DIR=/home/oh4989/shared/uploads
NEXT_PUBLIC_GA_ID=
NAVER_SITE_VERIFICATION=
GOOGLE_SITE_VERIFICATION=
```

`SESSION_SECRET`은 `openssl rand -base64 32` 결과를 넣습니다. 작성 후:

```
chmod 600 /home/oh4989/shared/oh4989.env && ls -l /home/oh4989/shared/oh4989.env
```

---

## 9단계 — Nginx + HTTPS ⬜

> **선행 조건**: `oh4989.com`의 DNS A 레코드가 `1.234.79.54`를 가리켜야 certbot이 인증서를 받습니다. www도 함께 등록하세요.

```
apt install -y nginx certbot python3-certbot-nginx
```

```
tee /etc/nginx/sites-available/oh4989 > /dev/null <<'EOF'
server {
    listen 80;
    server_name oh4989.com www.oh4989.com;

    # 사진 여러 장 업로드 대비. 브라우저에서 이미 리사이즈해 올린다
    client_max_body_size 20M;

    # 빌드 산출물은 파일명에 해시가 붙어 내용이 바뀌면 이름이 바뀐다 → 영구 캐시 가능
    location /_next/static/ {
        alias /home/oh4989/current/.next/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # 매물 사진 — 릴리스 밖 고정 경로
    location /uploads/ {
        alias /home/oh4989/shared/uploads/;
        expires 30d;
        add_header Cache-Control "public";
        access_log off;
    }

    location / {
        proxy_pass http://127.0.0.1:3100;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        # 문의 레이트리밋(IP당 시간당 5회)이 이 헤더로 실제 방문자 IP를 읽는다
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF
```

```
ln -sf /etc/nginx/sites-available/oh4989 /etc/nginx/sites-enabled/ && rm -f /etc/nginx/sites-enabled/default && nginx -t && systemctl reload nginx
```

```
certbot --nginx -d oh4989.com -d www.oh4989.com
```

발급 후 **www → non-www 301**(SPEC §7)은 certbot이 만든 설정을 보고 조정합니다 — `nginx -T | grep -A5 server_name` 결과를 확인한 뒤 적용.

---

## 10단계 — 방화벽 ⬜

```
ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw --force enable && ufw status
```

**5432(PostgreSQL)와 3100(Node)은 절대 열지 않습니다.** 개발 PC에서는 SSH 터널로 붙습니다:

```
ssh -L 15432:127.0.0.1:5432 oh4989@1.234.79.54
```

---

## 나중에 (1차 구현 이후)

- **백업 크론** — `pg_dump` 일 1회 + `~/shared/uploads` rsync (SPEC §7)
- **로그 로테이션** — `pm2 install pm2-logrotate`
- **PostgreSQL 재튜닝** — 실측 후 조정. 현재 값은 저트래픽 전제의 보수적 시작점
- **`/usr/bin/perl` 권한** — postgres 계정이 실행 불가한 상태(표 #1). 앱은 TCP 접속이라 무관하지만, `pg_ctlcluster` 등 클러스터 관리 명령을 비root로 쓸 때 다시 걸립니다
