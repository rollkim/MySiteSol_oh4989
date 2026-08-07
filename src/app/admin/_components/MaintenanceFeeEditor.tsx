"use client";

import { Plus, Trash2 } from "lucide-react";

import { MAINTENANCE_GROUP_LABEL, MAINTENANCE_GROUPS, type MaintenanceGroup } from "@/lib/codes";

import { INPUT_CLASS, NO_SPINNER } from "./FormKit";

/**
 * 관리비 3구분(일반/사용료/기타) 세부 비목 편집기 — 법정 3구분(§8)의 입력 지점.
 * 편집 중에는 금액을 문자열로 둔다(빈 입력 허용). 숫자 변환은 폼 제출 시 한 번에.
 */

export type MaintenanceDraftRow = { item: string; amountText: string };
export type MaintenanceDraft = Record<MaintenanceGroup, MaintenanceDraftRow[]>;

export const EMPTY_MAINTENANCE_DRAFT: MaintenanceDraft = {
  GENERAL: [],
  USAGE: [],
  ETC: [],
};

export function MaintenanceFeeEditor({
  value,
  onChange,
}: {
  value: MaintenanceDraft;
  onChange: (nextDraft: MaintenanceDraft) => void;
}) {
  function updateRow(
    group: MaintenanceGroup,
    rowIndex: number,
    patch: Partial<MaintenanceDraftRow>,
  ) {
    onChange({
      ...value,
      [group]: value[group].map((row, index) =>
        index === rowIndex ? { ...row, ...patch } : row,
      ),
    });
  }

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      {MAINTENANCE_GROUPS.map((group) => (
        <fieldset key={group} className="rounded-[10px] border border-[#e4e7ec] bg-[#f9fafb] p-3">
          <legend className="px-1 text-[13px] font-bold text-[#344054]">
            {MAINTENANCE_GROUP_LABEL[group]}
          </legend>
          {value[group].length === 0 && (
            <p className="text-xs text-[#98a2b3]">항목 없음</p>
          )}
          <ul className="flex flex-col gap-2">
            {value[group].map((row, rowIndex) => (
              <li key={rowIndex} className="flex items-center gap-1.5">
                <input
                  type="text"
                  aria-label={`${MAINTENANCE_GROUP_LABEL[group]} 항목명`}
                  placeholder="항목명"
                  value={row.item}
                  onChange={(event) => updateRow(group, rowIndex, { item: event.target.value })}
                  className={`${INPUT_CLASS} h-9 flex-1 text-[13px]`}
                />
                <input
                  type="number"
                  aria-label={`${MAINTENANCE_GROUP_LABEL[group]} 금액(만원)`}
                  placeholder="만원"
                  min={0}
                  value={row.amountText}
                  onChange={(event) =>
                    updateRow(group, rowIndex, { amountText: event.target.value })
                  }
                  className={`${INPUT_CLASS} ${NO_SPINNER} h-9 w-20 text-[13px]`}
                />
                <button
                  type="button"
                  aria-label="항목 삭제"
                  onClick={() =>
                    onChange({
                      ...value,
                      [group]: value[group].filter((_, index) => index !== rowIndex),
                    })
                  }
                  className="flex size-9 shrink-0 items-center justify-center rounded-[7px] border border-[#e4e7ec] text-[#d92d20] hover:bg-[#fef3f2]"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() =>
              onChange({ ...value, [group]: [...value[group], { item: "", amountText: "" }] })
            }
            className="mt-2 flex h-8 items-center gap-1 rounded-[7px] border border-[#d0d5dd] bg-white px-2.5 text-xs font-semibold text-[#475467] hover:bg-[#f2f4f7]"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            항목 추가
          </button>
        </fieldset>
      ))}
    </div>
  );
}
