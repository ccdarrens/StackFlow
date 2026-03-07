
export type EventType =
  | 'investment'   // money put into session
  | 'expense'      // money spent during session, tip, food etc
  | 'return';      // money taken out

export type ExpenseCategory =
  | 'tip'
  | 'food'
  | 'drink'
  | 'travel'
  | 'lodging'
  | 'other';

export interface SessionEvent {
  id: string;
  type: EventType;
  amount: number;     // stored in cents (integer)
  timestamp: number;  // epoch ms
  category?: ExpenseCategory; // only for expense
  note?: string;
}
