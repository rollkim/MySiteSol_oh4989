import { PropertyForm } from "../../../_components/PropertyForm";

/** 페이지 타이틀(h1)은 관리자 셸 상단바가 담당한다 — 여기서는 폼만 */
export default function NewPropertyPage() {
  return <PropertyForm mode="create" />;
}
