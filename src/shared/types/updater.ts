export type UpdateStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "downloading"; version: string; percent: number }
  | { state: "downloaded"; version: string }
  | { state: "not-available" }
  | { state: "error"; message: string };
