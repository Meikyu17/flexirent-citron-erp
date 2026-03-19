type IcalDispatchInput = {
  uid: string;
  title: string;
  description: string;
  location: string;
  startAtIso: string;
  endAtIso: string;
  attendees: string[];
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
