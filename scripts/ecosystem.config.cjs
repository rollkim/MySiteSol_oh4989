/**
 * PM2 설정 — oh4989 운영.
 *
 * 이 파일은 배포 묶음에 담겨 서버의 `~/current/ecosystem.config.cjs`가 된다.
 * 실행 주체는 `oh4989` 계정이다(`pm2-oh4989.service`, User=oh4989).
 * root로 띄우면 업로드를 받는 Node 프로세스가 서버 전체 권한을 갖게 되므로 절대 하지 않는다.
 */

module.exports = {
  apps: [
    {
      name: "oh4989",
      script: "server.js",

      /**
       * ★ 반드시 심볼릭 링크 경로다. `__dirname`을 쓰면 안 된다 —
       * Node가 모듈 경로의 심볼릭 링크를 실제 경로로 풀어 버려서 PM2에
       * "그때의 릴리스 폴더"(releases/a 또는 b)가 박제된다. 그러면 다음 배포에서
       * 링크를 옮기고 reload해도 **옛 코드가 그대로 뜬다**("배포했는데 안 바뀐다" 증상).
       */
      cwd: "/home/oh4989/current",

      /**
       * 단일 프로세스. RAM 2GB에 PostgreSQL·Nginx가 함께 사는 서버라
       * 클러스터로 코어를 나눠 갖는 건 DB에서 메모리를 빼앗는 일이다.
       * 단일 중개사무소 사이트의 트래픽에는 1개로 충분하다.
       */
      exec_mode: "fork",
      instances: 1,

      env: {
        NODE_ENV: "production",
        PORT: 3100,

        /**
         * ★ 반드시 명시한다. standalone server.js는 `process.env.HOSTNAME || '0.0.0.0'`로
         * 바인딩 주소를 정하는데, 리눅스에는 HOSTNAME(머신 이름, 여기선 ocy0027)이 이미 있다.
         * 비워 두면 머신 이름에 바인딩하려다 실패한다.
         * 127.0.0.1로 못 박아 **Nginx를 거치지 않은 직접 접속을 차단**한다(ufw와 이중 방어).
         */
        HOSTNAME: "127.0.0.1",

        // 업로드는 릴리스 폴더 밖 고정 경로에 쌓는다 — 안에 두면 재배포 때 사라진다
        UPLOAD_DIR: "/home/oh4989/shared/uploads",
      },

      // 로그도 릴리스 폴더 밖에 — 재배포로 지난 로그가 날아가면 장애 추적이 끊긴다
      out_file: "/home/oh4989/shared/logs/oh4989-out.log",
      error_file: "/home/oh4989/shared/logs/oh4989-err.log",
      merge_logs: true,
      time: true,

      /**
       * 메모리 누수 방어선. 2GB 서버에서 PostgreSQL(약 300MB)과 공존해야 하므로
       * PaRaSOL(500M)보다 낮게 잡는다. 이 선을 넘으면 PM2가 재시작한다.
       */
      max_memory_restart: "400M",

      // 부팅 직후 연속 실패(예: DB 접속 불가)로 무한 재시작하지 않도록 간격을 둔다
      restart_delay: 3000,
      max_restarts: 10,
    },
  ],
};
