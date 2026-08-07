/**
 * 지도 화면 sessionStorage 스냅샷의 공유 지점 — MapScreen(저장·복원)과
 * 목록 ListScreen(지도 토글 직전 보정)이 같은 키를 봐야 한다(RULE-14 단일 출처).
 */
export const MAP_SNAPSHOT_KEY = "oh4989.map.v1";

/**
 * 목록 → 지도 토글 직전 호출: 스냅샷의 appliedSearch 기록을 지워,
 * 직전에 적용했던 것과 같은 쿼리라도 지도가 딥링크를 다시 적용하게 한다.
 * (appliedSearch 가드는 뒤로가기·새로고침용 — 명시적 토글은 항상 조건을 싣고 간다)
 */
export function clearMapSnapshotAppliedSearch(): void {
  try {
    const raw = window.sessionStorage.getItem(MAP_SNAPSHOT_KEY);
    if (!raw) return;
    const snapshot = JSON.parse(raw) as { appliedSearch?: string };
    delete snapshot.appliedSearch;
    window.sessionStorage.setItem(MAP_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    /* 스냅샷 손상 시 무시 — 지도는 초기값으로 뜬다 */
  }
}
