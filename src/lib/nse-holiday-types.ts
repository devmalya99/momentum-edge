export interface Holiday {
  tradingDate: string;
  weekDay: string;
  description: string;
  morning_session: string;
  evening_session: string;
  Sr_no: number;
}

// Trading/Clearing holidays are returned as an object with segment keys
export interface HolidaysBySegment {
  [segment: string]: Holiday[];
}
