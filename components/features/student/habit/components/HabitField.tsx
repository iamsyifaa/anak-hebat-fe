"use client";

import { useDispatch } from "react-redux";
import OptionButton from "@/components/ui/form/OptionButton";
import type { AppDispatch } from "@/redux/store";
import { setHabitValue } from "@/redux/features/student/habit/habitSlice";
import type { HabitFormField } from "@/lib/types/studentDashboard";

interface Props {
  field: HabitFormField;
  value: string;
  locked: boolean;
}

function HabitField({ field, value, locked }: Props) {
  const dispatch = useDispatch<AppDispatch>();

  const updateValue = (nextValue: string) => {
    dispatch(setHabitValue({ fieldId: field.id, value: nextValue }));
  };

  // Kebiasaan yang membolehkan beberapa indikator (allows_multi_select)
  // menyimpan pilihannya sebagai array JSON di dalam satu nilai string.
  const selectedMulti: string[] = (() => {
    if (field.kind !== "multichoice" || !value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  })();

  const toggleMulti = (option: string) => {
    const next = selectedMulti.includes(option)
      ? selectedMulti.filter((item) => item !== option)
      : [...selectedMulti, option];
    updateValue(next.length ? JSON.stringify(next) : "");
  };

  return (
    <div>
      <div className="mb-2">
        <p className="text-sm font-black text-[#17204E]">
          {field.label}{" "}
          {!field.optional && <span className="text-red-500">*</span>}
        </p>
        {field.helper && (
          <p className="mt-0.5 text-sm text-slate-400">{field.helper}</p>
        )}
      </div>

      {field.kind === "choice" && field.options && (
        <div className="space-y-2">
          {field.options.map((option) => (
            <OptionButton
              key={option}
              label={option}
              selected={value === option}
              disabled={locked}
              onClick={() =>
                updateValue(field.optional && value === option ? "" : option)
              }
            />
          ))}
        </div>
      )}

      {field.kind === "multichoice" && field.options && (
        <div className="space-y-2">
          {field.options.map((option) => (
            <OptionButton
              key={option}
              label={option}
              selected={selectedMulti.includes(option)}
              disabled={locked}
              onClick={() => toggleMulti(option)}
            />
          ))}
        </div>
      )}

      {field.kind === "textarea" && (
        <div>
          <textarea
            value={value}
            maxLength={field.maxLength}
            onChange={(event) => updateValue(event.target.value)}
            placeholder={field.helper}
            disabled={locked}
            rows={4}
            className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none ring-[#2F6FED]/20 placeholder:text-slate-300 focus:border-[#8EACF2] focus:ring-2"
          />
          <p className="mt-1 text-right text-xs text-slate-400">
            {value.length}/{field.maxLength ?? 1000}
          </p>
        </div>
      )}
    </div>
  );
}

export default HabitField;
