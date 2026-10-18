export const employeeReferences = {
  departments: ['Engineering', 'Sales', 'Marketing', 'Operations', 'Human Resources', 'Finance'],
  positions: ['Software Engineer', 'Sales Representative', 'Marketing Specialist', 'HR Specialist', 'Data Analyst', 'Operations Analyst', 'Financial Analyst', 'Senior Engineer', 'HR Coordinator', 'Sales Manager', 'DevOps Engineer', 'Supply Chain Analyst', 'Senior Accountant', 'Content Strategist'],
};
const id = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
export const fixedId = (group: number, index: number) => `00000000-0000-4000-8000-${String(group).padStart(4, '0')}${String(index).padStart(8, '0')}`;
export const departmentRecords = employeeReferences.departments.map((name, index) => ({ id: fixedId(1, index + 1), code: id(name).toUpperCase(), name }));
export const positionRecords = employeeReferences.positions.map((name, index) => ({ id: fixedId(2, index + 1), code: id(name).toUpperCase(), name }));
