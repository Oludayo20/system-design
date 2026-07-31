export interface UserRow {
  id: string; // BIGINT comes back from pg as a string
  email: string;
  display_name: string;
  region: string;
  created_at: Date;
}
