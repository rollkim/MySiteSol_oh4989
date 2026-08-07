"use client";

/**
 * 네이버 지도 SDK 로더 — 명율 PoiMap의 검증된 패턴(스크립트 id 중복 방어 + 로드 대기)을
 * 프로미스 캐시로 정리한 것. 어디서 몇 번을 불러도 스크립트는 한 번만 붙는다.
 *
 * 키는 NEXT_PUBLIC_NAVER_MAP_CLIENT_ID — JS SDK 특성상 스크립트 URL에 실려 공개된다.
 * (NCP 콘솔의 Web 서비스 URL 등록이 도용 방어를 담당한다)
 */

declare global {
  interface Window {
    naver?: typeof naver;
    /** SDK가 인증 실패 시 부르는 전역 훅 — 키·서비스 URL 미등록 진단용 */
    navermap_authFailure?: () => void;
  }
}

const SCRIPT_ID = "naver-maps-sdk";

let sdkPromise: Promise<typeof naver.maps> | null = null;

export function loadNaverMaps(): Promise<typeof naver.maps> {
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("네이버 지도 SDK는 브라우저에서만 로드할 수 있습니다."));
      return;
    }
    if (window.naver?.maps) {
      resolve(window.naver.maps);
      return;
    }

    const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
    if (!clientId) {
      reject(
        new Error("NEXT_PUBLIC_NAVER_MAP_CLIENT_ID가 설정되지 않았습니다. .env를 확인해 주세요."),
      );
      return;
    }

    window.navermap_authFailure = () => {
      reject(
        new Error(
          "네이버 지도 인증에 실패했습니다 — NCP 콘솔의 Client ID와 Web 서비스 URL 등록을 확인해 주세요.",
        ),
      );
    };

    const existingScript = document.getElementById(SCRIPT_ID);
    if (existingScript) {
      // 다른 곳(이전 라우트)이 붙여둔 스크립트가 로드 중 — 폴링으로 대기
      const timer = setInterval(() => {
        if (window.naver?.maps) {
          clearInterval(timer);
          resolve(window.naver.maps);
        }
      }, 100);
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${clientId}`;
    script.onload = () => {
      if (window.naver?.maps) resolve(window.naver.maps);
      else reject(new Error("네이버 지도 SDK 로드에 실패했습니다."));
    };
    script.onerror = () => reject(new Error("네이버 지도 스크립트를 불러오지 못했습니다."));
    document.head.appendChild(script);
  });

  // 실패했으면 다음 시도에서 다시 붙일 수 있게 캐시를 비운다
  sdkPromise.catch(() => {
    sdkPromise = null;
  });
  return sdkPromise;
}
