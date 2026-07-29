// Single source of truth for the twins' timeline.
//
// Two dates, and they are not interchangeable:
//
//   TWINS_EDD is the estimated due date the OB practice put in writing
//   (Optum records, Jan 20 2027). Use it anywhere the app says the words
//   "due date" to the user, or anywhere a form or a benefit rule asks for
//   the EDD. Do not substitute a planning estimate for it.
//
//   TWINS_LIKELY_ARRIVAL is what to plan against. Median twin gestation is
//   35.2 weeks and roughly 57-60% of twin pregnancies deliver before 37
//   weeks, which puts the base case near Dec 17 2026 - a full month before
//   the due date. Countdowns, buy-by dates, and "get it done before they
//   come" deadlines anchor here.
//
// Both are ISO date strings so they can be compared and formatted without a
// timezone shifting the day. Build a Date with a midday local time.
export const TWINS_EDD = "2027-01-20";
export const TWINS_LIKELY_ARRIVAL = "2026-12-17";
