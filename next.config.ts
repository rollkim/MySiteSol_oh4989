import type { NextConfig } from "next";

/**
 * 배포는 **빌드 산출물만** 나간다(standalone).
 *
 * `.next/standalone/`에 server.js와 실제로 쓰이는 의존성만 추적되어 담긴다.
 * 서버에 src/·검증 스크립트·문서가 가지 않고, node_modules도 통째로 옮기지 않는다.
 *
 * **이 파일에서 path.join·fs 같은 파일시스템 호출을 하지 않는다.** 하면 추적기가
 * "프로젝트 전체가 필요하다"고 판단해 src/·.env까지 standalone에 담는다.
 *
 * **빌드는 반드시 로컬에서 한다. 서버(RAM 2GB)에서 빌드하지 않는다** —
 * OOM 위험이 있고, 빌드가 도는 동안 같은 서버의 사이트가 느려진다.
 * 이 앱은 네이티브 모듈을 쓰지 않으므로(이미지는 브라우저 Canvas 처리, sharp 미도입)
 * Windows에서 빌드한 산출물을 리눅스에 올려도 바이너리가 어긋나지 않는다.
 * → sharp를 도입하는 순간 이 전제가 깨진다. AGENTS.md 참조.
 */
const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
