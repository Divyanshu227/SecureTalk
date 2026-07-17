export interface User {
  id: number;
  name: string;
  username: string;
  email: string;
  public_key?: string;
  require_connection?: boolean;
}
