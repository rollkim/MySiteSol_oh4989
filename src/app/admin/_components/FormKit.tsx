"use client";

/**
 * 관리자 폼 공통 조각 — 명율(mysite) `components/admin/FormKit.tsx`의
 * "매물 등록/수정 UX 고도화" 디자인을 이식한 것. 값 하드코딩은 의도다:
 * /admin은 리스킨 판매 대상이 아니라(RULE-11의 토큰화 대상은 공개면) 명율 팔레트
 * (#101828 그레이 스케일 + #2563eb 액센트)를 그대로 쓴다.
 */
import { useRef, type ReactNode } from "react";

/* ────────────────────────────── 섹션 카드 ────────────────────────────── */

type SectionCardProps = {
  id: string;
  icon: ReactNode;
  /** 아이콘 뱃지 배경/글자색 — 섹션별로 다르게 준다 */
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle?: string;
  /** 헤더 우측 영역 — 상태 pill, 카운터 표기 등 */
  right?: ReactNode;
  children: ReactNode;
};

export function SectionCard({
  id,
  icon,
  iconBg,
  iconColor,
  title,
  subtitle,
  right,
  children,
}: SectionCardProps) {
  return (
    <section
      id={id}
      // 앵커 이동 시 sticky 상단바에 가리지 않도록 보정
      className="scroll-mt-[92px] overflow-hidden rounded-[14px] border border-[#e4e7ec] bg-white shadow-[0_1px_2px_rgba(16,24,40,.04)]"
    >
      <div className="flex items-center gap-3 border-b border-[#f2f4f7] px-[22px] py-4">
        <span
          className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px]"
          style={{ background: iconBg, color: iconColor }}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-bold tracking-[-.2px] text-[#101828]">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-[#98a2b3]">{subtitle}</p>}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
      <div className="px-[22px] pt-5 pb-[22px]">{children}</div>
    </section>
  );
}

/* ────────────────────────────── 칩 토글 ────────────────────────────── */

export type ChipOption = {
  value: string;
  label: string;
  /** 선택 시 글자·테두리 색 (미지정이면 accent) */
  color?: string;
  /** 선택 시 배경 틴트 (미지정이면 accent 틴트) */
  tint?: string;
  /** 앞에 상태 점 표시 (매물 상태 칩) */
  dot?: boolean;
};

const ACCENT = "#2563eb";
const ACCENT_TINT = "#eff4ff";

type ChipGroupProps = {
  /** 라디오 그룹 접근성 라벨 */
  label: string;
  value: string;
  options: ChipOption[];
  onChange: (value: string) => void;
};

/** 상호배타 선택 칩 — radiogroup 시맨틱 + 좌우 방향키 이동 (명율 핸드오프 권고) */
export function ChipGroup({ label, value, options, onChange }: ChipGroupProps) {
  const ref = useRef<HTMLDivElement>(null);

  const moveFocus = (from: number, delta: number) => {
    const next = (from + delta + options.length) % options.length;
    onChange(options[next].value);
    const buttons = ref.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    buttons?.[next]?.focus();
  };

  return (
    <div ref={ref} role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option, index) => {
        const on = option.value === value;
        const color = option.color ?? ACCENT;
        const tint = option.tint ?? ACCENT_TINT;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                event.preventDefault();
                moveFocus(index, 1);
              }
              if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                event.preventDefault();
                moveFocus(index, -1);
              }
            }}
            className="inline-flex h-[38px] items-center gap-1.5 rounded-[9px] px-3.5 text-[13.5px] transition-all duration-[120ms]"
            style={
              on
                ? // inset 그림자로 1.5px 테두리 효과 — border 굵기를 안 바꿔 레이아웃이 안 밀린다
                  {
                    border: `1px solid ${color}`,
                    background: tint,
                    color,
                    fontWeight: 700,
                    boxShadow: `inset 0 0 0 1px ${color}`,
                  }
                : {
                    border: "1px solid #d0d5dd",
                    background: "#fff",
                    color: "#475467",
                    fontWeight: 500,
                  }
            }
          >
            {option.dot && (
              <span
                className="h-[7px] w-[7px] shrink-0 rounded-full"
                style={{ background: on ? color : "#c3c9d2" }}
              />
            )}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* ────────────────────────────── 숫자 스테퍼 ────────────────────────────── */

type StepperProps = {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  /** 빠른 선택 버튼 — 현재 값과 같으면 선택 스타일 */
  presets?: { label: string; value: number }[];
};

export function Stepper({ value, onChange, min, max, presets }: StepperProps) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex h-10 items-stretch overflow-hidden rounded-[9px] border border-[#d0d5dd] bg-white">
        <button
          type="button"
          aria-label="값 줄이기"
          onClick={() => onChange(clamp(value - 1))}
          className="w-9 text-[17px] font-semibold text-[#475467] transition-colors hover:bg-[#f2f4f7] hover:text-[#101828]"
        >
          −
        </button>
        <span className="flex w-14 items-center justify-center border-x border-[#eaecf0] text-[15px] font-bold text-[#101828] tabular-nums">
          {value}
        </span>
        <button
          type="button"
          aria-label="값 늘리기"
          onClick={() => onChange(clamp(value + 1))}
          className="w-9 text-[17px] font-semibold text-[#475467] transition-colors hover:bg-[#f2f4f7] hover:text-[#101828]"
        >
          +
        </button>
      </div>
      {presets?.map((preset) => {
        const on = preset.value === value;
        return (
          <button
            key={preset.label}
            type="button"
            onClick={() => onChange(clamp(preset.value))}
            className="h-[30px] rounded-[7px] px-2.5 text-xs font-semibold transition-all duration-[120ms]"
            style={
              on
                ? { border: `1px solid ${ACCENT}`, background: ACCENT_TINT, color: ACCENT }
                : { border: "1px solid #e4e7ec", background: "#fff", color: "#667085" }
            }
          >
            {preset.label}
          </button>
        );
      })}
    </div>
  );
}

/* ────────────────────────────── 필드 라벨 ────────────────────────────── */

export function FieldLabel({
  children,
  required,
  hint,
  unit,
}: {
  children: ReactNode;
  required?: boolean;
  hint?: string;
  unit?: string;
}) {
  return (
    <span className="mb-1.5 flex items-baseline gap-1 text-[13px] font-semibold text-[#344054]">
      <span>
        {children}
        {unit && <span className="ml-0.5 font-medium text-[#98a2b3]">({unit})</span>}
      </span>
      {required && <span className="text-[#d92d20]">*</span>}
      {hint && <span className="text-xs font-normal text-[#98a2b3]">· {hint}</span>}
    </span>
  );
}

/** 섹션 안에서 필드 묶음을 나누는 그룹 헤더 */
export function GroupHeader({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span className="text-xs font-bold tracking-[.4px] text-[#667085]">{children}</span>
      <span className="h-px flex-1 bg-[#f2f4f7]" />
    </div>
  );
}

/* ────────────────────────────── 입력 공통 클래스 ────────────────────────────── */

/** 명율 폼 입력 톤 — TextField류가 공유한다 */
export const INPUT_CLASS =
  "h-10 w-full rounded-[9px] border border-[#d0d5dd] bg-white px-3 text-[14px] text-[#101828] placeholder:text-[#98a2b3] focus:border-[#2563eb] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/15";

/** 숫자 입력의 스피너 숨김 — 휠로 값이 실수로 바뀌는 것도 막는다 (명율) */
export const NO_SPINNER =
  "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

/** 필드 단위 오류 문구 */
export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1 text-xs font-medium text-[#d92d20]">
      {message}
    </p>
  );
}
