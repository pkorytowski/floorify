import { toDisplayLength, toInternalLength } from "../app/units";
import type { Project } from "../types";

type NumericFieldProps = {
  label: string;
  value: number;
  unit: Project["unit"];
  disabled?: boolean;
  onChange: (value: number) => void;
};

export function NumericField({ label, value, unit, disabled = false, onChange }: NumericFieldProps) {
  return (
    <label>
      {label}
      <input
        type="number"
        step="1"
        value={toDisplayLength(value, unit)}
        disabled={disabled}
        onChange={(event) => onChange(toInternalLength(Number(event.target.value), unit))}
      />
    </label>
  );
}
