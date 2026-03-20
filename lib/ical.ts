type IcalDispatchInput = {
  uid: string;
  title: string;
  description: string;
  location: string;
  startAtIso: string;
  endAtIso: string;
  attendees: string[];
};

type IcalScheduleEventInput = {
  uid: string;
  title: string;
  description: string;
  location: string;
  startAtIso: string;
  endAtIso: string;
};

const escapeIcal = (value: string) =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");

const formatUtc = (isoString: string) => {
  const date = new Date(isoString);
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
};

export function generateDispatchIcs(input: IcalDispatchInput) {
  const nowUtc = formatUtc(new Date().toISOString());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Citron ERP//Dispatch//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${escapeIcal(input.uid)}`,
    `DTSTAMP:${nowUtc}`,
    `DTSTART:${formatUtc(input.startAtIso)}`,
    `DTEND:${formatUtc(input.endAtIso)}`,
    `SUMMARY:${escapeIcal(input.title)}`,
    `DESCRIPTION:${escapeIcal(input.description)}`,
    `LOCATION:${escapeIcal(input.location)}`,
    ...input.attendees.map((email) => `ATTENDEE;CN=${escapeIcal(email)}:mailto:${email}`),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.join("\r\n")}\r\n`;
}

export function generateDispatchScheduleIcs(input: {
  calendarName: string;
  events: IcalScheduleEventInput[];
}) {
  const nowUtc = formatUtc(new Date().toISOString());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Citron ERP//Dispatch Team Feed//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcal(input.calendarName)}`,
  ];

  for (const event of input.events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${escapeIcal(event.uid)}`,
      `DTSTAMP:${nowUtc}`,
      `DTSTART:${formatUtc(event.startAtIso)}`,
      `DTEND:${formatUtc(event.endAtIso)}`,
      `SUMMARY:${escapeIcal(event.title)}`,
      `DESCRIPTION:${escapeIcal(event.description)}`,
      `LOCATION:${escapeIcal(event.location)}`,
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}
