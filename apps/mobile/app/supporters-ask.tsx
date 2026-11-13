import { SupportersAskSheet } from '../src/features/supporters/SupportersAskSheet'

/* The question about the supporters' board: a sheet over whatever is
   beneath, asked once after a sign-in and opened again from the board.
   The sheet and its rules live in SupportersAskSheet. */
export default function SupportersAskRoute() {
  return <SupportersAskSheet />
}
