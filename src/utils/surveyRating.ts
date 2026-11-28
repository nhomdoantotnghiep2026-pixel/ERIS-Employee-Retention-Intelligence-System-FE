const satisfactionLabels = ['Rất không hài lòng', 'Không hài lòng', 'Bình thường', 'Hài lòng', 'Rất hài lòng'];

/** Display the survey's rating wording without changing its stored numeric score. */
export function surveyRatingText(value: number, labels?: string[]): string {
  if (!Number.isInteger(value) || value < 1 || value > 5) return String(value);
  const label = labels?.[value - 1]?.trim();
  return label === 'Không hài lòng cũng không bất mãn' ? 'Bình thường' : label || satisfactionLabels[value - 1];
}
