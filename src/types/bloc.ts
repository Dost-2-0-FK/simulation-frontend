// Mirrors BlocResponse in ../../../simulation/src/handlers/blocs.rs
export interface Bloc {
  name: string
  /** Combat die odds for this bloc. */
  chance: number
  /** Share (0-1) of hourly income spent on military unit production. */
  militaryExpense: number
}
