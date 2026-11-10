export type EmployeePositionOption = { id: number; name: string; code: string; jobLevel: number; departmentId?: number | null };

export function positionSelection(positions: EmployeePositionOption[], departmentId: string, title: string) {
  const inDepartment = departmentId ? positions.filter(position => String(position.departmentId) === departmentId) : [];
  const titles = [...new Set(inDepartment.map(position => position.name.trim()).filter(Boolean))];
  return { titles, levels: inDepartment.filter(position => position.name.trim() === title) };
}
