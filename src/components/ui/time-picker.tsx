import * as React from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select"

export function generateTimeIntervals() {
  const intervals = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const hh = h.toString().padStart(2, '0');
      const mm = m.toString().padStart(2, '0');
      const isPM = h >= 12;
      const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const label = `${displayH}:${mm} ${isPM ? 'PM' : 'AM'}`;
      intervals.push({ value: `${hh}:${mm}`, label });
    }
  }
  return intervals;
}

interface TimePickerProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  disabledValues?: string[];
}

export function TimePicker({ value, onChange, className, disabled, disabledValues = [] }: TimePickerProps) {
  const times = React.useMemo(() => generateTimeIntervals(), []);

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={className}>
        <SelectValue placeholder="Select time" />
      </SelectTrigger>
      <SelectContent>
        {times
          .filter(t => !disabledValues.includes(t.value) || t.value === value)
          .map((t) => (
            <SelectItem key={t.value} value={t.value}>
              {t.label}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
}
