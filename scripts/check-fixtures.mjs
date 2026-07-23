import fixtures from '../fixtures/predicted-group-order.json' with { type: 'json' }
for (const fixture of fixtures) {
 if (fixture.teams.length !== 4) throw new Error(`${fixture.name}: expected four teams`)
 if (!['resolved','unresolved','incomplete'].includes(fixture.status)) throw new Error(`${fixture.name}: invalid status`)
}
console.log(`validated ${fixtures.length} predicted-group-order fixtures`)
