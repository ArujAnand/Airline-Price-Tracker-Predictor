import { firestoreDB } from '../server/firestoreService';
import { flightAggregator } from '../server/aggregator';

async function checkTimeOfDayMismatch() {
  await firestoreDB.init();
  const rawPnqLko = await firestoreDB.getSnapshots('PNQ-LKO', 2000);
  const rawLkoPnq = await firestoreDB.getSnapshots('LKO-PNQ', 2000);
  const snapshots = [...rawPnqLko, ...rawLkoPnq];

  const slots = [
    { label: '00:00 - 04:00', start: 0, end: 4 },
    { label: '04:00 - 08:00', start: 4, end: 8 },
    { label: '08:00 - 12:00', start: 8, end: 12 },
    { label: '12:00 - 16:00', start: 12, end: 16 },
    { label: '16:00 - 20:00', start: 16, end: 20 },
    { label: '20:00 - 24:00', start: 20, end: 24 },
  ];

  const slotCounts: Record<string, number> = {};
  slots.forEach(s => slotCounts[s.label] = 0);

  const sched = flightAggregator.getSchedule('ALL') || [];
  const schedMap: Record<string, number> = {};
  sched.forEach((f) => {
    if (f.departureTime) schedMap[f.flightNumber] = parseInt(f.departureTime.split(':')[0], 10);
  });

  console.log(`Total snapshots tested: ${snapshots.length}`);
  let matched = 0;
  let unassigned = 0;

  snapshots.forEach(snap => {
    let depH = schedMap[snap.flightNumber];
    if (depH === undefined && snap.flightId) {
      const m = snap.flightId.match(/-(\d{2})(\d{2})-/);
      if (m) depH = parseInt(m[1], 10);
    }
    if (depH === undefined) {
      depH = snap.capturedHour ?? (snap.timestamp ? new Date(snap.timestamp).getHours() : undefined);
    }

    const matchedSlot = slots.find((sl) => depH !== undefined && depH >= sl.start && depH < sl.end);
    if (matchedSlot) {
      slotCounts[matchedSlot.label]++;
      matched++;
    } else {
      unassigned++;
      console.log('Unassigned snap:', {
        flightNumber: snap.flightNumber,
        flightId: snap.flightId,
        capturedHour: snap.capturedHour,
        timestamp: snap.timestamp,
        depH
      });
    }
  });

  console.log(`Matched: ${matched}, Unassigned: ${unassigned}`);
  console.log('Slot counts:', slotCounts);
}

checkTimeOfDayMismatch().catch(console.error);
